using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

// Content definitions. Shapes mirror the web game's TypeScript types (exported by
// scripts/export-game-content.ts) so the same data drives both games during migration.
// Hand-authored additions (enemies, skills, maps, npc names, towns) live beside them.
namespace TuTien.Core.Content
{
    // ---------------------------------------------------------------- world

    public sealed class RegionDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public Element Element { get; set; }
        public int Tier { get; set; } = 1;
        public Realm RecommendedRealm { get; set; }
        public List<AreaDef> Areas { get; set; } = new List<AreaDef>();
        public List<string> AdjacentRegions { get; set; } = new List<string>();
        public List<string> UniqueResources { get; set; } = new List<string>();
    }

    public sealed class AreaDef
    {
        public string Id { get; set; } = "";
        public string RegionId { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Type { get; set; } = "wilderness";
        public int DangerLevel { get; set; } = 1;
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public List<string> EnemyPool { get; set; } = new List<string>();
        public string LootTable { get; set; } = "";
        public List<string> EventPool { get; set; } = new List<string>();
        public List<string> ConnectedAreas { get; set; } = new List<string>();
        public bool IsSafe { get; set; }
        public int CultivationBonus { get; set; }
    }

    public sealed class DungeonDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public string Type { get; set; } = "";
        public string Region { get; set; } = "";
        public string Area { get; set; } = "";
        public int Tier { get; set; } = 1;
        public Realm RecommendedRealm { get; set; }
        public List<FloorDef> Floors { get; set; } = new List<FloorDef>();
        public int? TimeLimit { get; set; }
        public EntryCostDef? EntryCost { get; set; }
        public List<DungeonRewardDef> CompletionRewards { get; set; } = new List<DungeonRewardDef>();
        public List<DungeonRewardDef>? FirstClearBonus { get; set; }
    }

    public sealed class FloorDef
    {
        public int FloorNumber { get; set; }
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public List<WaveDef> EnemyWaves { get; set; } = new List<WaveDef>();
        public string? MiniBoss { get; set; }
        public string? FloorBoss { get; set; }
        public int ChestCount { get; set; }
        public string ChestLootTable { get; set; } = "";
        public int? HiddenChestCount { get; set; }
        public string? HiddenLootTable { get; set; }
        public List<string> FloorEvents { get; set; } = new List<string>();
    }

    public sealed class WaveDef
    {
        public string Id { get; set; } = "";
        public List<string> Enemies { get; set; } = new List<string>();
        public double SpawnChance { get; set; } = 1;
        public bool? IsAmbush { get; set; }
    }

    public sealed class EntryCostDef
    {
        public int? Silver { get; set; }
        public int? SpiritStones { get; set; }
        public string? Item { get; set; }
    }

    public sealed class DungeonRewardDef
    {
        public string Type { get; set; } = "";
        public string? Id { get; set; }
        public int? Amount { get; set; }
        public double? Chance { get; set; }
    }

    // ---------------------------------------------------------------- events

    public sealed class EventDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Trigger { get; set; } = "exploration";
        public string Rarity { get; set; } = "common";
        public double Weight { get; set; } = 1;
        public List<string>? Regions { get; set; }
        public List<string>? Areas { get; set; }
        public Realm? RealmRequirement { get; set; }
        public Realm? RealmMaximum { get; set; }
        public Element? ElementAffinity { get; set; }
        public List<string>? RequiresFlags { get; set; }
        public List<string>? ExcludesFlags { get; set; }
        public string Narrative { get; set; } = "";
        public string NarrativeEn { get; set; } = "";
        public List<EventChoiceDef> Choices { get; set; } = new List<EventChoiceDef>();
        public int? CooldownTurns { get; set; }
    }

    public sealed class EventChoiceDef
    {
        public string Id { get; set; } = "";
        public string Text { get; set; } = "";
        public string TextEn { get; set; } = "";
        public ChoiceRequirementsDef? Requirements { get; set; }
        public bool? HiddenUntilMet { get; set; }
        public List<EventOutcomeDef> Outcomes { get; set; } = new List<EventOutcomeDef>();
        public List<double> OutcomeWeights { get; set; } = new List<double>();
    }

    public sealed class ChoiceRequirementsDef
    {
        public StatRequirementDef? Stat { get; set; }
        public string? Item { get; set; }
        public string? Skill { get; set; }
        public Realm? Realm { get; set; }
        public int? KarmaMin { get; set; }
        public int? KarmaMax { get; set; }
    }

    public sealed class StatRequirementDef
    {
        public string Key { get; set; } = "";
        public double Min { get; set; }
    }

    public sealed class EventOutcomeDef
    {
        public string Id { get; set; } = "";
        public string Narrative { get; set; } = "";
        public string NarrativeEn { get; set; } = "";
        public List<DeltaDef> Effects { get; set; } = new List<DeltaDef>();
        public List<string>? Items { get; set; }
        public List<string>? RemoveItems { get; set; }
        public string? TriggerCombat { get; set; }
        public string? UnlockArea { get; set; }
        public List<string>? SetFlags { get; set; }
        public List<string>? ClearFlags { get; set; }
        public TeleportDef? TeleportTo { get; set; }
    }

    /// <summary>A state change proposed by content or by the storyteller; always validated before it applies.</summary>
    public sealed class DeltaDef
    {
        public string Field { get; set; } = "";
        public string Operation { get; set; } = "add";
        public JsonElement Value { get; set; }
        public string? Reason { get; set; }
    }

    public sealed class TeleportDef
    {
        public string Region { get; set; } = "";
        public string Area { get; set; } = "";
    }

    // ---------------------------------------------------------------- sects

    public sealed class SectDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Type { get; set; } = "";
        public Element? Element { get; set; }
        public int Tier { get; set; } = 1;
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public List<string> Rivals { get; set; } = new List<string>();
        public List<string> Allies { get; set; } = new List<string>();
        public string? HomeRegion { get; set; }
    }

    public sealed class MissionTemplateDef
    {
        public string Id { get; set; } = "";
        public List<string> SectTypes { get; set; } = new List<string>();
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public string Difficulty { get; set; } = "easy";
        public MissionObjectiveDef Objective { get; set; } = new MissionObjectiveDef();
        public MissionRewardDef Reward { get; set; } = new MissionRewardDef();
        public int DeadlineTurns { get; set; }
        public string? MinRank { get; set; }
    }

    public sealed class MissionObjectiveDef
    {
        public string Kind { get; set; } = "";
        public int? Count { get; set; }
        public string? ItemType { get; set; }
        public string? MinRarity { get; set; }
        public int? Amount { get; set; }
        public string? RegionId { get; set; }
        public string? RivalSectId { get; set; }
    }

    public sealed class MissionRewardDef
    {
        public int Contribution { get; set; }
        public int? Silver { get; set; }
        public int? SpiritStones { get; set; }
    }

    // ---------------------------------------------------------------- items & loot

    public class ItemDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public string Type { get; set; } = "Misc";
        public string Rarity { get; set; } = "Common";
        public Dictionary<string, double>? Effects { get; set; }
        public string? EquipmentSlot { get; set; }
        public Dictionary<string, double>? BonusStats { get; set; }
        public TechniqueDef? TeachesTechnique { get; set; }
        public string? TeachesSkillId { get; set; }
    }

    public sealed class LootEntryDef : ItemDef
    {
        public double Weight { get; set; } = 1;
    }

    public sealed class LootTableDef
    {
        public string Id { get; set; } = "";
        public int Tier { get; set; } = 1;
        public List<LootEntryDef> Entries { get; set; } = new List<LootEntryDef>();

        // The web game's loot tables are camelCase for these three fields.
        [JsonPropertyName("silverRange")] public int[] SilverRange { get; set; } = { 0, 0 };
        [JsonPropertyName("spiritStoneChance")] public double SpiritStoneChance { get; set; }
        [JsonPropertyName("spiritStoneRange")] public int[] SpiritStoneRange { get; set; } = { 0, 0 };
    }

    public sealed class LootContent
    {
        public List<LootTableDef> Tables { get; set; } = new List<LootTableDef>();
        public Dictionary<string, ItemDef> RewardItems { get; set; } = new Dictionary<string, ItemDef>();
        public Dictionary<string, string> Aliases { get; set; } = new Dictionary<string, string>();
    }

    public sealed class TechniqueDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string? Description { get; set; }
        public string? DescriptionEn { get; set; }
        public string Grade { get; set; } = "Mortal";
        public List<Element> Elements { get; set; } = new List<Element>();
        public double CultivationSpeedBonus { get; set; }
        public double? QiRecoveryBonus { get; set; }
        public double? BreakthroughBonus { get; set; }
        public int? Level { get; set; }
        public int? MaxLevel { get; set; }
    }

    // ---------------------------------------------------------------- progression

    public sealed class ProgressionDef
    {
        public Dictionary<string, long[]> CultivationExp { get; set; } = new Dictionary<string, long[]>();
        public Dictionary<string, long[]> BodyExp { get; set; } = new Dictionary<string, long[]>();
        public Dictionary<string, int> RealmLifespanBonus { get; set; } = new Dictionary<string, int>();
        public Dictionary<string, BodyBonusDef> BodyRealmBonuses { get; set; } = new Dictionary<string, BodyBonusDef>();
        public Dictionary<string, int[]> SeasonMonths { get; set; } = new Dictionary<string, int[]>();
        public Dictionary<string, Dictionary<string, int>> SeasonElementBonus { get; set; } =
            new Dictionary<string, Dictionary<string, int>>();
    }

    public sealed class BodyBonusDef
    {
        public int Hp { get; set; }
        public int Str { get; set; }
        public int Stamina { get; set; }
    }

    // ---------------------------------------------------------------- hand-authored (new)

    /// <summary>
    /// Enemy catalog entry. The web game only had IDs; archetype + element + stats are new.
    /// Archetypes: charger, swarm, ranged, tank, caster, boss, and brute (rears up and slams),
    /// trickster (blinks away and casts), flier (swoops and drains), phantom (drifts through trees,
    /// fades out), serpent (a lair boss that lunges, sweeps and spits).
    /// </summary>
    public sealed class EnemyDef
    {
        /// <summary>Zones this creature also roams (added to their enemy pools; the exported areas stay untouched).</summary>
        public List<string> Zones { get; set; } = new List<string>();
        /// <summary>A lair beast: it always prowls alone, and a zone holds only one.</summary>
        public bool Solitary { get; set; }
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Glyph { get; set; } = "妖";
        public string Archetype { get; set; } = "charger";
        public Element? Element { get; set; }
        public Realm Realm { get; set; }
        public int Stage { get; set; }
        public int Hp { get; set; } = 60;
        public int Atk { get; set; } = 10;
        public int Def { get; set; } = 5;
        public int Res { get; set; } = 5;
        public double Speed { get; set; } = 140;
        public double Radius { get; set; } = 18;
        public string? LootTable { get; set; }
        public int Exp { get; set; } = 10;
        public int Silver { get; set; }
        public int Karma { get; set; }
        public bool Humanoid { get; set; }
        public List<string> Skills { get; set; } = new List<string>();
    }

    /// <summary>
    /// A martial/spirit art. Keeps the web game's Skill fields (damage_multiplier, qi_cost,
    /// cooldown, effects) and adds how it is cast in real time.
    /// </summary>
    public sealed class SkillDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Description { get; set; } = "";
        public string DescriptionEn { get; set; } = "";
        public string Glyph { get; set; } = "技";
        public string Type { get; set; } = "attack"; // attack | defense | support
        public string Damage { get; set; } = "spirit"; // spirit | physical
        public Element? Element { get; set; }
        public double DamageMultiplier { get; set; } = 1.5;
        public int QiCost { get; set; }
        public int StaminaCost { get; set; }
        public double Cooldown { get; set; } = 2;
        public CastDef Cast { get; set; } = new CastDef();
        public SkillEffectsDef? Effects { get; set; }
        public Realm? UnlockRealm { get; set; }
        public int UnlockStage { get; set; }
    }

    public sealed class CastDef
    {
        /// <summary>
        /// melee_arc | projectile | aoe_circle | dash_strike | self_buff | heal | nova, and beam (a piercing
        /// line), orbit (blades or leaves circling the caster), wave (a cone that throws foes back), field
        /// (burning ground that lingers) and wall (pillars that block movement and shots).
        /// </summary>
        public string Shape { get; set; } = "projectile";
        public double Range { get; set; } = 400;
        public double Radius { get; set; } = 12;
        public double Arc { get; set; } = 110;
        public double Speed { get; set; } = 520;
        public double Windup { get; set; } = 0.1;
        public int Count { get; set; } = 1;
        public double Spread { get; set; }
        /// <summary>Seconds a buff lasts (self_buff).</summary>
        public double Duration { get; set; }
        /// <summary>Radius of the explosion when a projectile lands (0 = single target).</summary>
        public double Burst { get; set; }
    }

    public sealed class SkillEffectsDef
    {
        public double? StunChance { get; set; }
        public double? BleedDamage { get; set; }
        public double? DefenseBreak { get; set; }
        public double? HealPercent { get; set; }
        public double? DefenseBoost { get; set; }
        public double? Shield { get; set; }
        /// <summary>Pixels a hit throws the target back.</summary>
        public double? Knockback { get; set; }
        /// <summary>Seconds a hit slows the target to half speed.</summary>
        public double? Slow { get; set; }
        /// <summary>Seconds a hit roots the target in place.</summary>
        public double? Root { get; set; }
    }

    /// <summary>A region map authored as ASCII rows: one terrain char and one zone char per tile.</summary>
    public sealed class MapDef
    {
        public string Id { get; set; } = "";
        public string RegionId { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public int Width { get; set; }
        public int Height { get; set; }
        public List<string> Terrain { get; set; } = new List<string>();
        public List<string> Zones { get; set; } = new List<string>();
        public Dictionary<string, string> ZoneLegend { get; set; } = new Dictionary<string, string>();
        public List<PoiDef> Pois { get; set; } = new List<PoiDef>();
        public PointDef Start { get; set; } = new PointDef();
    }

    public sealed class PoiDef
    {
        public string Id { get; set; } = "";
        /// <summary>town | sect | secret_realm | spirit_vein | herb | pass</summary>
        public string Kind { get; set; } = "";
        public int X { get; set; }
        public int Y { get; set; }
        public string? Ref { get; set; }
        public string Glyph { get; set; } = "?";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public int QiBonus { get; set; }
        public string? LootTable { get; set; }
    }

    public sealed class PointDef
    {
        public int X { get; set; }
        public int Y { get; set; }
    }

    public sealed class NpcNamesDef
    {
        public List<string> Surnames { get; set; } = new List<string>();
        public List<string> GivenMale { get; set; } = new List<string>();
        public List<string> GivenFemale { get; set; } = new List<string>();
        /// <summary>Famous novel protagonists — never generated, to keep NPC names original.</summary>
        public List<string> Denylist { get; set; } = new List<string>();
        public List<NpcTraitDef> Traits { get; set; } = new List<NpcTraitDef>();
    }

    public sealed class NpcTraitDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public double Aggression { get; set; }
        public double Sociability { get; set; }
        public double Greed { get; set; }
    }

    public sealed class TownDef
    {
        public string AreaId { get; set; } = "";
        public int RestCost { get; set; } = 10;
        public int SeclusionCostPerMonth { get; set; } = 20;
        public List<ShopEntryDef> Shop { get; set; } = new List<ShopEntryDef>();
        public List<BountyDef> Bounties { get; set; } = new List<BountyDef>();
    }

    public sealed class ShopEntryDef
    {
        public string ItemId { get; set; } = "";
        public int Price { get; set; }
    }

    public sealed class BountyDef
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string EnemyId { get; set; } = "";
        public int Count { get; set; }
        public int RewardSilver { get; set; }
        public int RewardKarma { get; set; }
    }
}
