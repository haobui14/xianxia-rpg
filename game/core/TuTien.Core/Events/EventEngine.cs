using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Events
{
    public sealed class ChoiceView
    {
        public EventChoiceDef Choice { get; set; } = new EventChoiceDef();
        public bool Available { get; set; }
        public bool Hidden { get; set; }
        public string Reason { get; set; } = "";
        public string ReasonEn { get; set; } = "";
    }

    public sealed class OutcomeResult
    {
        public EventOutcomeDef Outcome { get; set; } = new EventOutcomeDef();
        public List<GameEvent> Events { get; } = new List<GameEvent>();
        /// <summary>Enemy to fight right away (the host starts the arena).</summary>
        public string? CombatEnemyId { get; set; }
    }

    /// <summary>
    /// How much a single effect may change the state. Authored content is trusted more than
    /// storyteller output (the web game's AI clamps), which goes through <see cref="Ai"/>.
    /// </summary>
    public sealed class DeltaPolicy
    {
        public int MaxStatChange { get; set; }
        public int MaxSilver { get; set; }
        public int MaxSpiritStones { get; set; }
        public int MaxKarma { get; set; }
        public int MaxAttr { get; set; }
        public long MaxExp { get; set; }

        public static readonly DeltaPolicy Authored = new DeltaPolicy
        {
            MaxStatChange = 500, MaxSilver = 5000, MaxSpiritStones = 500, MaxKarma = 100, MaxAttr = 5, MaxExp = 5000,
        };

        /// <summary>The clamps from the web game's /api/turn delta validator.</summary>
        public static readonly DeltaPolicy Ai = new DeltaPolicy
        {
            MaxStatChange = 100, MaxSilver = 1000, MaxSpiritStones = 100, MaxKarma = 20, MaxAttr = 5, MaxExp = 100,
        };
    }

    /// <summary>Port of the web game's event-engine.ts, driven by map adventures instead of AI turns.</summary>
    public static class EventEngine
    {
        public static IEnumerable<EventDef> ValidEvents(GameState state, ContentDb content, string trigger, string regionId)
        {
            var p = state.Player;
            foreach (var e in content.Events.Values)
            {
                if (e.Trigger != trigger) continue;
                if (e.Regions != null && e.Regions.Count > 0 && !e.Regions.Contains(regionId)) continue;
                if (state.World.EventCooldowns.TryGetValue(e.Id, out var cd) && cd > 0) continue;
                if (e.RealmRequirement != null && p.Realm < e.RealmRequirement.Value) continue;
                if (e.RealmMaximum != null && p.Realm > e.RealmMaximum.Value) continue;
                if (e.RequiresFlags != null && e.RequiresFlags.Any(f => !state.Flag(f))) continue;
                if (e.ExcludesFlags != null && e.ExcludesFlags.Any(state.Flag)) continue;
                yield return e;
            }
        }

        /// <summary>Weighted pick; matching the spirit root's element makes an event 50% likelier.</summary>
        public static EventDef? Select(IEnumerable<EventDef> events, PlayerState p, Pcg32 rng)
        {
            var list = events.ToList();
            if (list.Count == 0) return null;
            var weights = list
                .Select(e => e.Weight * (e.ElementAffinity != null && p.Root.Elements.Contains(e.ElementAffinity.Value) ? 1.5 : 1.0))
                .ToList();
            var i = rng.WeightedIndex(weights);
            return i < 0 ? null : list[i];
        }

        public static List<ChoiceView> Choices(GameState state, EventDef ev)
        {
            var views = new List<ChoiceView>();
            var p = state.Player;
            foreach (var choice in ev.Choices)
            {
                var view = new ChoiceView { Choice = choice, Available = true };
                var req = choice.Requirements;
                if (req != null)
                {
                    if (req.Stat != null)
                    {
                        var value = ReadStat(p, req.Stat.Key);
                        if (value == null || value.Value < req.Stat.Min)
                            Fail(view, $"Cần {StatLabel(req.Stat.Key, Locale.Vi)} ≥ {req.Stat.Min}", $"Requires {StatLabel(req.Stat.Key, Locale.En)} ≥ {req.Stat.Min}");
                    }
                    if (req.Item != null && Inventory.Count(p, req.Item) <= 0)
                        Fail(view, $"Cần vật phẩm: {req.Item}", $"Requires item: {req.Item}");
                    if (req.Skill != null && !Skills.Knows(p, req.Skill))
                        Fail(view, $"Cần kỹ năng: {req.Skill}", $"Requires art: {req.Skill}");
                    if (req.Realm != null && p.Realm < req.Realm.Value)
                        Fail(view, $"Cần cảnh giới {Names.Display(req.Realm.Value, Locale.Vi)}", $"Requires {Names.Display(req.Realm.Value, Locale.En)}");
                    if (req.KarmaMin != null && p.Karma < req.KarmaMin.Value)
                        Fail(view, $"Cần nhân quả ≥ {req.KarmaMin}", $"Requires karma ≥ {req.KarmaMin}");
                    if (req.KarmaMax != null && p.Karma > req.KarmaMax.Value)
                        Fail(view, $"Cần nhân quả ≤ {req.KarmaMax}", $"Requires karma ≤ {req.KarmaMax}");
                }
                view.Hidden = !view.Available && choice.HiddenUntilMet == true;
                views.Add(view);
            }
            return views;
        }

        private static void Fail(ChoiceView view, string vi, string en)
        {
            view.Available = false;
            if (view.Reason.Length == 0)
            {
                view.Reason = vi;
                view.ReasonEn = en;
            }
        }

        public static EventOutcomeDef SelectOutcome(EventChoiceDef choice, Pcg32 rng)
        {
            if (choice.Outcomes.Count == 1) return choice.Outcomes[0];
            var weights = choice.OutcomeWeights.Count == choice.Outcomes.Count
                ? choice.OutcomeWeights
                : choice.Outcomes.Select(_ => 1.0).ToList();
            var i = rng.WeightedIndex(weights);
            return choice.Outcomes[i < 0 ? 0 : i];
        }

        /// <summary>Resolve a choice: roll the outcome, apply effects, set the event's cooldown.</summary>
        public static OutcomeResult Resolve(GameState state, ContentDb content, EventDef ev, string choiceId, Pcg32 rng, DeltaPolicy policy)
        {
            var choice = ev.Choices.FirstOrDefault(c => c.Id == choiceId)
                         ?? throw new ArgumentException($"event {ev.Id} has no choice '{choiceId}'");
            var outcome = SelectOutcome(choice, rng);
            var result = new OutcomeResult { Outcome = outcome };
            var p = state.Player;

            foreach (var delta in outcome.Effects) ApplyDelta(state, content, delta, policy, result.Events);

            foreach (var id in outcome.Items ?? new List<string>())
            {
                var stack = Inventory.Resolve(content, id);
                Inventory.Add(p, stack);
                result.Events.Add(GameEvent.Info("item_gained", $"Nhận được {stack.Name}.", $"Received {stack.NameEn}."));
            }
            foreach (var id in outcome.RemoveItems ?? new List<string>()) Inventory.Remove(p, id);
            foreach (var f in outcome.SetFlags ?? new List<string>()) state.Flags[f] = true;
            foreach (var f in outcome.ClearFlags ?? new List<string>()) state.Flags.Remove(f);
            if (outcome.UnlockArea != null)
            {
                state.Flags["unlocked_" + outcome.UnlockArea] = true;
                result.Events.Add(GameEvent.Info("area_unlocked", "Một nơi mới hiện ra trong tâm trí.", "A new place is revealed to you."));
            }
            if (!string.IsNullOrEmpty(outcome.TriggerCombat)) result.CombatEnemyId = outcome.TriggerCombat;
            if (ev.CooldownTurns != null && ev.CooldownTurns.Value > 0) state.World.EventCooldowns[ev.Id] = ev.CooldownTurns.Value;
            p.Counters.AdventuresResolved += 1;
            return result;
        }

        /// <summary>Apply one effect with the web game's field names ("stats.hp", "inventory.silver", "karma", …).</summary>
        public static void ApplyDelta(GameState state, ContentDb content, DeltaDef delta, DeltaPolicy policy, List<GameEvent> events)
        {
            var p = state.Player;
            var sign = delta.Operation == "subtract" ? -1 : 1;
            var number = Number(delta.Value);
            if (number == null) return;
            var n = number.Value;

            int Clamp(double v, int max) => (int)Math.Max(-max, Math.Min(max, Math.Round(v)));

            switch (delta.Field)
            {
                case "stats.hp":
                    p.Hp = Math.Max(0, Math.Min(p.HpMax, p.Hp + sign * Clamp(n, policy.MaxStatChange)));
                    break;
                case "stats.qi":
                    p.Qi = Math.Max(0, Math.Min(p.QiMax, p.Qi + sign * Clamp(n, policy.MaxStatChange)));
                    break;
                case "stats.stamina":
                    p.Stamina = Math.Max(0, Math.Min(p.StaminaMax, p.Stamina + sign * Clamp(n, policy.MaxStatChange)));
                    break;
                case "inventory.silver":
                    p.Silver = Math.Max(0, p.Silver + sign * Clamp(n, policy.MaxSilver));
                    if (sign > 0) events.Add(GameEvent.Info("silver", $"+{Clamp(n, policy.MaxSilver)} bạc", $"+{Clamp(n, policy.MaxSilver)} silver"));
                    break;
                case "inventory.spirit_stones":
                    p.SpiritStones = Math.Max(0, p.SpiritStones + sign * Clamp(n, policy.MaxSpiritStones));
                    break;
                case "karma":
                    var changed = Karma.Add(p, sign * Clamp(n, policy.MaxKarma));
                    if (changed != 0)
                        events.Add(GameEvent.Info("karma", $"Nhân quả {(changed > 0 ? "+" : "")}{changed}", $"Karma {(changed > 0 ? "+" : "")}{changed}"));
                    break;
                case "reputation":
                    p.Reputation += sign * Clamp(n, policy.MaxKarma);
                    break;
                case "progress.cultivation_exp":
                    if (sign > 0)
                    {
                        var exp = Math.Min(policy.MaxExp, (long)Math.Round(n));
                        events.AddRange(Cultivation.AddExp(state, content, exp, 0));
                    }
                    break;
                default:
                    if (delta.Field.StartsWith("attrs.", StringComparison.Ordinal) && sign > 0)
                    {
                        var amount = Clamp(n, policy.MaxAttr);
                        switch (delta.Field.Substring(6))
                        {
                            case "str": p.Attrs.Str += amount; break;
                            case "agi": p.Attrs.Agi += amount; break;
                            case "int": p.Attrs.Int += amount; break;
                            case "perception": p.Attrs.Per += amount; break;
                            case "luck": p.Attrs.Luck += amount; break;
                        }
                    }
                    break;
            }
        }

        private static double? Number(JsonElement value)
        {
            switch (value.ValueKind)
            {
                case JsonValueKind.Number:
                    return value.GetDouble();
                case JsonValueKind.String:
                    return double.TryParse(value.GetString(), System.Globalization.NumberStyles.Float,
                        System.Globalization.CultureInfo.InvariantCulture, out var d) ? d : (double?)null;
                default:
                    return null;
            }
        }

        /// <summary>Stat paths used by event requirements, mapped onto the new player state.</summary>
        public static double? ReadStat(PlayerState p, string key) => key switch
        {
            "inventory.silver" => p.Silver,
            "inventory.spirit_stones" => p.SpiritStones,
            "stats.hp" => p.Hp,
            "stats.qi" => p.Qi,
            "stats.stamina" => p.Stamina,
            "attrs.str" => p.Attrs.Str,
            "attrs.agi" => p.Attrs.Agi,
            "attrs.int" => p.Attrs.Int,
            "attrs.perception" => p.Attrs.Per,
            "attrs.luck" => p.Attrs.Luck,
            "karma" => p.Karma,
            "progress.realm_stage" => p.Stage,
            _ => null,
        };

        private static string StatLabel(string key, Locale locale) => key switch
        {
            "inventory.silver" => locale == Locale.En ? "silver" : "bạc",
            "inventory.spirit_stones" => locale == Locale.En ? "spirit stones" : "linh thạch",
            "stats.hp" => "HP",
            "stats.qi" => "Qi",
            "attrs.str" => locale == Locale.En ? "strength" : "lực",
            "attrs.agi" => locale == Locale.En ? "agility" : "thân pháp",
            "attrs.int" => locale == Locale.En ? "insight" : "ngộ tính",
            "attrs.perception" => locale == Locale.En ? "perception" : "cảm tri",
            "attrs.luck" => locale == Locale.En ? "luck" : "vận khí",
            _ => key,
        };

        public static void TickCooldowns(GameState state)
        {
            foreach (var key in state.World.EventCooldowns.Keys.ToList())
            {
                var left = state.World.EventCooldowns[key] - 1;
                if (left <= 0) state.World.EventCooldowns.Remove(key);
                else state.World.EventCooldowns[key] = left;
            }
        }
    }
}
