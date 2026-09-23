using System;
using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Combat
{
    /// <summary>One enemy in a fight, with stats already scaled for the zone and realm.</summary>
    public sealed class EnemyInstance
    {
        public string InstanceId { get; set; } = "";
        public EnemyDef Template { get; set; } = new EnemyDef();
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public int HpMax { get; set; }
        public double Attack { get; set; }
        public double Defense { get; set; }
        public double Resistance { get; set; }
        public double Speed { get; set; }
        public Realm Realm { get; set; }
        public int Stage { get; set; }
        public Element? Element { get; set; }

        public Combatant ToCombatant() => new Combatant
        {
            PhysicalPower = Attack,
            SpiritPower = Attack,
            Def = Defense,
            Res = Resistance,
            Per = 5,
            Luck = 5,
            RealmValue = Progression.RealmValue(Realm, Stage),
            Element = Element,
            Root = Element != null ? new[] { Element.Value } : Array.Empty<Element>(),
        };
    }

    /// <summary>What the arena reports back when a fight ends.</summary>
    public sealed class CombatOutcome
    {
        public string EncounterId { get; set; } = "";
        public bool Victory { get; set; }
        public bool Fled { get; set; }
        public int HpLeft { get; set; }
        public int QiLeft { get; set; }
        public List<string> Defeated { get; set; } = new List<string>();
        public Dictionary<string, int> SkillUses { get; set; } = new Dictionary<string, int>();
        /// <summary>Pills eaten mid-fight (item id → count); removed from the bag when the fight resolves.</summary>
        public Dictionary<string, int> ItemsUsed { get; set; } = new Dictionary<string, int>();
        public double Seconds { get; set; }
    }

    public sealed class CombatResolution
    {
        public List<GameEvent> Events { get; } = new List<GameEvent>();
        public LootRoll Loot { get; set; } = new LootRoll();
        public long Exp { get; set; }
        public int MonthsLost { get; set; }
        /// <summary>A follow-up adventure (combat_end trigger) to show after the fight.</summary>
        public string? FollowUpEventId { get; set; }
    }

    public static class Encounters
    {
        /// <summary>Stand-in for enemy ids the catalog doesn't cover yet (the web game's 60/20/10 default).</summary>
        public static EnemyDef Fallback(string id)
        {
            var name = string.Join(" ", id.Split('_').Select(w => w.Length == 0 ? w : char.ToUpperInvariant(w[0]) + w.Substring(1)));
            return new EnemyDef { Id = id, Name = name, NameEn = name, Glyph = "妖", Archetype = "charger", Hp = 60, Atk = 12, Def = 8, Res = 8, Speed = 130, Exp = 12 };
        }

        public static List<EnemyInstance> Build(ContentDb content, Encounter encounter)
        {
            var result = new List<EnemyInstance>();
            var danger = Math.Max(1, encounter.Danger);
            var zoneScale = 1 + 0.15 * (danger - 1);
            var i = 0;
            foreach (var id in encounter.EnemyIds)
            {
                var def = content.Enemy(id) ?? Fallback(id);
                var inst = new EnemyInstance
                {
                    InstanceId = $"{encounter.Id}:{i++}",
                    Template = def,
                    Name = def.Name,
                    NameEn = def.NameEn,
                    HpMax = (int)Math.Round(def.Hp * zoneScale),
                    Attack = def.Atk * zoneScale,
                    Defense = def.Def * zoneScale,
                    Resistance = def.Res * zoneScale,
                    Speed = def.Speed,
                    Realm = def.Realm,
                    Stage = def.Stage,
                    Element = def.Element,
                };

                if (encounter.RealmOverride != null)
                {
                    // NPC cultivators fight at their own realm: the catalog entry is a template,
                    // scaled by how far their realm is above the template's.
                    var steps = Progression.RealmValue(encounter.RealmOverride.Value, encounter.StageOverride)
                                - Progression.RealmValue(def.Realm, def.Stage);
                    var scale = Math.Pow(1.9, Math.Max(-0.9, steps));
                    inst.Realm = encounter.RealmOverride.Value;
                    inst.Stage = encounter.StageOverride;
                    inst.HpMax = (int)Math.Round(inst.HpMax * scale);
                    inst.Attack *= scale;
                    inst.Defense *= Math.Sqrt(scale);
                    inst.Resistance *= Math.Sqrt(scale);
                }
                if (!string.IsNullOrEmpty(encounter.DisplayName))
                {
                    inst.Name = encounter.DisplayName!;
                    inst.NameEn = encounter.DisplayName!;
                }
                result.Add(inst);
            }
            return result;
        }

        /// <summary>Every wave whose spawn roll succeeds (the web game only ever fought enemies[0]), plus bosses.</summary>
        public static List<string> RollFloor(FloorDef floor, Pcg32 rng)
        {
            var ids = new List<string>();
            foreach (var wave in floor.EnemyWaves)
                if (ids.Count == 0 || rng.Chance(wave.SpawnChance)) ids.AddRange(wave.Enemies);
            if (floor.MiniBoss != null) ids.Add(floor.MiniBoss);
            if (floor.FloorBoss != null) ids.Add(floor.FloorBoss);
            return ids;
        }
    }
}
