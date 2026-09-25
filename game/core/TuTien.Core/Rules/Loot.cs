using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    public sealed class LootRoll
    {
        public int Silver { get; set; }
        public int SpiritStones { get; set; }
        public List<ItemStack> Items { get; set; } = new List<ItemStack>();
    }

    /// <summary>Port of the web game's generateLoot: silver range, spirit-stone chance, 1–3 weighted items.</summary>
    public static class Loot
    {
        public static LootRoll Roll(ContentDb content, string? tableId, int fallbackTier, Pcg32 rng, int maxItems = 3)
        {
            var roll = new LootRoll();
            var id = content.ResolveLootTable(tableId, fallbackTier);
            if (!content.LootTables.TryGetValue(id, out var table)) return roll;

            roll.Silver = rng.Range(table.SilverRange[0], table.SilverRange[1]);
            if (rng.Chance(table.SpiritStoneChance))
                roll.SpiritStones = rng.Range(table.SpiritStoneRange[0], table.SpiritStoneRange[1]);

            var count = rng.Range(1, 3);
            if (count > maxItems) count = maxItems;
            var weights = table.Entries.Select(e => e.Weight).ToList();
            for (var i = 0; i < count; i++)
            {
                var idx = rng.WeightedIndex(weights);
                if (idx < 0) break;
                var entry = table.Entries[idx];
                var existing = roll.Items.FirstOrDefault(s => s.Id == entry.Id);
                if (existing != null) existing.Qty += 1;
                else roll.Items.Add(Inventory.StackOf(entry, 1));
            }
            return roll;
        }
    }

    public static class Inventory
    {
        public static ItemStack StackOf(ItemDef def, int qty) => new ItemStack
        {
            Id = def.Id,
            Name = def.Name,
            NameEn = string.IsNullOrEmpty(def.NameEn) ? def.Name : def.NameEn,
            Type = def.Type,
            Rarity = def.Rarity,
            Qty = qty,
        };

        /// <summary>An item referenced by id only (e.g. from an event) that has no definition yet.</summary>
        public static ItemStack StubStack(string id, int qty)
        {
            var words = id.Split('_').Where(w => w.Length > 0).Select(w => char.ToUpperInvariant(w[0]) + w.Substring(1));
            var name = string.Join(" ", words);
            return new ItemStack { Id = id, Name = name, NameEn = name, Type = "Material", Rarity = "Common", Qty = qty };
        }

        public static ItemStack Resolve(ContentDb content, string id, int qty = 1)
        {
            var def = content.Item(id);
            return def != null ? StackOf(def, qty) : StubStack(id, qty);
        }

        public static void Add(PlayerState p, ItemStack stack)
        {
            var existing = p.Items.FirstOrDefault(i => i.Id == stack.Id);
            if (existing != null) existing.Qty += stack.Qty;
            else p.Items.Add(new ItemStack
            {
                Id = stack.Id, Name = stack.Name, NameEn = stack.NameEn,
                Type = stack.Type, Rarity = stack.Rarity, Qty = stack.Qty,
            });
        }

        public static int Count(PlayerState p, string id) => p.Items.Where(i => i.Id == id).Sum(i => i.Qty);

        public static bool Remove(PlayerState p, string id, int qty = 1)
        {
            var stack = p.Items.FirstOrDefault(i => i.Id == id);
            if (stack == null || stack.Qty < qty) return false;
            stack.Qty -= qty;
            if (stack.Qty <= 0) p.Items.Remove(stack);
            return true;
        }

        /// <summary>Loot, a gathered herb, a chest: into the bag (and it counts for a gathering mission).</summary>
        public static void Apply(GameState state, ContentDb content, LootRoll roll)
        {
            state.Player.Silver += roll.Silver;
            state.Player.SpiritStones += roll.SpiritStones;
            foreach (var s in roll.Items) Add(state.Player, s);
            SectMissions.Gathered(state, roll.Items);
        }

        /// <summary>Medicine, manuals (Book) and effect-bearing materials can be used; gear is equipped instead.</summary>
        public static bool IsConsumable(ContentDb content, string id)
        {
            var def = content.Item(id);
            if (def == null || def.Type == "Equipment" || def.Type == "Accessory") return false;
            return def.Type == "Medicine"
                   || (def.Type == "Book" && (def.TeachesTechnique != null || def.TeachesSkillId != null))
                   || (def.Effects != null && def.Effects.Count > 0);
        }

        /// <summary>
        /// Use a consumable. Same effect keys as the web game's use-item route
        /// (hp/qi/stamina restore, cultivation_exp, permanent_*); anything else is ignored.
        /// </summary>
        public static List<GameEvent> Use(GameState state, ContentDb content, string id)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var def = content.Item(id);
            if (def == null || !IsConsumable(content, id) || Count(p, id) <= 0) return events;
            Remove(p, id);

            var fx = def.Effects ?? new Dictionary<string, double>();
            double Get(string key) => fx.TryGetValue(key, out var v) ? v : 0;

            p.Hp = System.Math.Min(p.HpMax, p.Hp + (int)Get("hp_restore"));
            p.Qi = System.Math.Min(p.QiMax, p.Qi + (int)Get("qi_restore"));
            p.Stamina = System.Math.Min(p.StaminaMax, p.Stamina + (int)Get("stamina_restore"));
            p.HpMax += (int)Get("permanent_hp");
            p.Hp += (int)Get("permanent_hp");
            p.QiMax += (int)Get("permanent_qi");
            p.Qi += (int)Get("permanent_qi");
            p.Attrs.Str += (int)Get("permanent_str");
            p.Attrs.Agi += (int)Get("permanent_agi");
            p.Attrs.Int += (int)Get("permanent_int");
            p.Attrs.Per += (int)Get("permanent_perception");
            p.Attrs.Luck += (int)Get("permanent_luck");

            events.Add(GameEvent.Info("item_used", $"Dùng {def.Name}.", $"Used {def.NameEn}."));
            var exp = (long)Get("cultivation_exp");
            if (exp > 0)
            {
                var qi = p.Path == CultivationPath.Body ? 0 : p.Path == CultivationPath.Kiem ? exp * p.QiShare / 100 : exp;
                events.AddRange(Cultivation.AddExp(state, content, qi, exp - qi));
            }

            if (def.TeachesTechnique != null && p.Techniques.All(t => t.Id != def.TeachesTechnique.Id))
            {
                var t = def.TeachesTechnique;
                p.Techniques.Add(new TechniqueState
                {
                    Id = t.Id, Name = t.Name, NameEn = t.NameEn, Grade = t.Grade,
                    Elements = t.Elements.ToList(), SpeedBonus = t.CultivationSpeedBonus, Level = t.Level ?? 1,
                });
                events.Add(GameEvent.Major("technique_learned", $"Lĩnh ngộ công pháp {t.Name}.", $"Learned the technique {t.NameEn}."));
            }
            if (def.TeachesSkillId != null)
                events.AddRange(Skills.Learn(state, content, def.TeachesSkillId));
            return events;
        }
    }

    public static class Skills
    {
        /// <summary>Luyện Khí stage at which the root's element opens its second art (lĩnh ngộ).</summary>
        public const int SecondArtStage = 5;

        /// <summary>The first spirit art, awakened by the root's element at Luyện Khí.</summary>
        public static string StarterArt(Element element) => element switch
        {
            Element.Kim => "kim_kiem_khi",
            Element.Moc => "thanh_moc_cham",
            Element.Thuy => "thuy_nhan",
            Element.Hoa => "hoa_cau_thuat",
            _ => "tho_thu",
        };

        /// <summary>The second: comprehended at Luyện Khí 5, or learned from a manual by anyone.</summary>
        public static string SecondArt(Element element) => element switch
        {
            Element.Kim => "kim_quang_tram",
            Element.Moc => "van_diep_ho_than",
            Element.Thuy => "thuy_long_ba",
            Element.Hoa => "liet_diem_dia",
            _ => "tho_lao_thuat",
        };

        public static bool Knows(PlayerState p, string skillId) => p.Skills.Any(s => s.Id == skillId);

        /// <summary>Learn an art and slot it into the first free spirit-art slot.</summary>
        public static List<GameEvent> Learn(GameState state, ContentDb content, string skillId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            var def = content.Skill(skillId);
            if (def == null || Knows(p, skillId)) return events;
            p.Skills.Add(new SkillState { Id = skillId, Level = 1 });
            while (p.SkillSlots.Count < 4) p.SkillSlots.Add("");
            var free = p.SkillSlots.FindIndex(s => string.IsNullOrEmpty(s));
            if (free >= 0) p.SkillSlots[free] = skillId;
            events.Add(GameEvent.Major("skill_learned", $"Lĩnh ngộ {def.Name}.", $"Learned {def.NameEn}."));
            return events;
        }

        /// <summary>Skill exp from use in battle (5–15 per use, as in the web game), 100 × level per level.</summary>
        public static List<GameEvent> GrantUseExp(GameState state, ContentDb content, string skillId, int uses, Pcg32 rng)
        {
            var events = new List<GameEvent>();
            var s = state.Player.Skills.FirstOrDefault(x => x.Id == skillId);
            var def = content.Skill(skillId);
            if (s == null || def == null || uses <= 0) return events;
            for (var i = 0; i < System.Math.Min(uses, 20); i++) s.Exp += rng.Range(5, 15);
            while (s.Level < 10 && s.Exp >= s.Level * 100)
            {
                s.Exp -= s.Level * 100;
                s.Level += 1;
                events.Add(GameEvent.Info("skill_level", $"{def.Name} lên cấp {s.Level}.", $"{def.NameEn} reached level {s.Level}."));
            }
            return events;
        }

        /// <summary>+5% damage per level beyond 1 (the web game's per-level multiplier).</summary>
        public static double LevelMultiplier(PlayerState p, string skillId)
        {
            var s = p.Skills.FirstOrDefault(x => x.Id == skillId);
            return s == null ? 1.0 : System.Math.Pow(1.05, s.Level - 1);
        }
    }
}
