using System.Collections.Generic;
using System.Globalization;
using System.Text.Json.Serialization;

// Everything that goes into a save file. Plain data with non-null defaults so older saves
// deserialize cleanly after new fields are added (see SaveCodec for versioned migrations).
namespace TuTien.Core.State
{
    public sealed class GameState
    {
        public int Version { get; set; } = SaveCodec.CurrentVersion;
        /// <summary>Stored as a decimal string: JSON numbers can't hold a full 64-bit seed.</summary>
        public string WorldSeed { get; set; } = "0";
        public Locale Locale { get; set; } = Locale.En;
        public PlayerState Player { get; set; } = new PlayerState();
        public CalendarState Calendar { get; set; } = new CalendarState();
        public WorldState World { get; set; } = new WorldState();
        public Dictionary<string, bool> Flags { get; set; } = new Dictionary<string, bool>();
        public List<ChronicleEntry> Chronicle { get; set; } = new List<ChronicleEntry>();
        public int NextId { get; set; } = 1;

        [JsonIgnore]
        public ulong Seed => ulong.Parse(WorldSeed, CultureInfo.InvariantCulture);

        public string NewId(string prefix) => prefix + "_" + (NextId++).ToString(CultureInfo.InvariantCulture);

        public bool Flag(string name) => Flags.TryGetValue(name, out var v) && v;
    }

    public sealed class CalendarState
    {
        /// <summary>Months elapsed since the run started — the strategic clock.</summary>
        public int MonthIndex { get; set; }
        public int Month { get; set; } = 1;
        public int Year { get; set; } = 1;
    }

    public sealed class SpiritRootState
    {
        public List<Element> Elements { get; set; } = new List<Element>();
        public RootGrade Grade { get; set; } = RootGrade.PhoThong;
    }

    public sealed class Attributes
    {
        public int Str { get; set; } = 3;
        public int Agi { get; set; } = 3;
        public int Int { get; set; } = 3;
        public int Per { get; set; } = 3;
        public int Luck { get; set; } = 3;
    }

    public sealed class PlayerState
    {
        public string Name { get; set; } = "";
        public int Age { get; set; } = 16;
        public int AgeMonths { get; set; }
        public SpiritRootState Root { get; set; } = new SpiritRootState();

        public Realm Realm { get; set; } = Realm.PhamNhan;
        public int Stage { get; set; }
        public long Exp { get; set; }
        public BodyRealm BodyRealm { get; set; } = BodyRealm.PhamThe;
        public int BodyStage { get; set; }
        public long BodyExp { get; set; }
        public CultivationPath Path { get; set; } = CultivationPath.Qi;
        /// <summary>Share of monthly exp that goes to Qi when cultivating both (kiêm tu), 0–100.</summary>
        public int QiShare { get; set; } = 70;
        /// <summary>Set when a major breakthrough (a set piece) is available and waiting.</summary>
        public bool PendingMajorBreakthrough { get; set; }
        /// <summary>The foundation laid at Trúc Cơ; it scales that breakthrough's gains and every fight after.</summary>
        public FoundationGrade Foundation { get; set; }

        public int Hp { get; set; } = 100;
        public int HpMax { get; set; } = 100;
        public int Qi { get; set; }
        public int QiMax { get; set; }
        public int Stamina { get; set; } = 100;
        public int StaminaMax { get; set; } = 100;
        public Attributes Attrs { get; set; } = new Attributes();

        public int Silver { get; set; }
        public int SpiritStones { get; set; }
        public List<ItemStack> Items { get; set; } = new List<ItemStack>();
        /// <summary>What is worn in each gear slot ("Weapon", "Chest", "Accessory"), and how far each slot is enhanced.</summary>
        public Dictionary<string, GearSlot> Gear { get; set; } = new Dictionary<string, GearSlot>();
        /// <summary>The weapon in hand: the Weapon slot's item.</summary>
        [JsonIgnore]
        public string? WeaponId => Gear.TryGetValue("Weapon", out var slot) ? slot.ItemId : null;
        /// <summary>Saves before v4 kept only a weapon, here; <see cref="SaveCodec"/> moves it into <see cref="Gear"/>.</summary>
        [JsonPropertyName("weapon_id")]
        public string? LegacyWeaponId { get; set; }
        public List<SkillState> Skills { get; set; } = new List<SkillState>();
        /// <summary>Four spirit-art slots (RMB, 1, 2, 3). Empty string = empty slot.</summary>
        public List<string> SkillSlots { get; set; } = new List<string> { "", "", "", "" };
        public List<TechniqueState> Techniques { get; set; } = new List<TechniqueState>();

        public int Karma { get; set; }
        public int Reputation { get; set; }
        public List<LedgerEntry> Ledger { get; set; } = new List<LedgerEntry>();

        public string? SectId { get; set; }
        public string? SectRank { get; set; }
        /// <summary>Cống hiến to spend at the treasury.</summary>
        public int Contribution { get; set; }
        /// <summary>Công trạng: all the contribution ever earned. Promotions look at this, so spending never costs a rank.</summary>
        public int Merit { get; set; }
        /// <summary>Sect missions taken at the mission hall (design §7.9).</summary>
        public List<ActiveMission> Missions { get; set; } = new List<ActiveMission>();
        /// <summary>What the mission hall is offering, rolled every few months.</summary>
        public MissionBoardState MissionBoard { get; set; } = new MissionBoardState();
        public List<ActiveBounty> Bounties { get; set; } = new List<ActiveBounty>();

        public List<InjuryState> Injuries { get; set; } = new List<InjuryState>();
        public int LifespanBase { get; set; } = 80;
        public int LifespanSpecial { get; set; }
        public int LifespanPenalty { get; set; }
        public bool Dead { get; set; }
        public string? DeathCause { get; set; }

        public string Region { get; set; } = "thanh_van";
        public int X { get; set; }
        public int Y { get; set; }
        /// <summary>Cước lực left this month.</summary>
        public int Footwork { get; set; }
        public int FootworkMax { get; set; }
        /// <summary>Per-map fog of war, base64 bitsets (see FogMask).</summary>
        public Dictionary<string, string> Revealed { get; set; } = new Dictionary<string, string>();
        /// <summary>A Thần thức pulse widens the sense radius until the month ends.</summary>
        public bool SensePulse { get; set; }

        public PlayerCounters Counters { get; set; } = new PlayerCounters();
    }

    public sealed class PlayerCounters
    {
        public int Kills { get; set; }
        public int Fights { get; set; }
        public int Defeats { get; set; }
        public int AdventuresResolved { get; set; }
        public int HerbsGathered { get; set; }
        public int MissionsCompleted { get; set; }
        public Dictionary<string, int> KillsByEnemy { get; set; } = new Dictionary<string, int>();
    }

    /// <summary>A gear slot: what is worn there (an item in the bag), and how far the slot is enhanced.</summary>
    public sealed class GearSlot
    {
        public string? ItemId { get; set; }
        /// <summary>Enhancement, 0–10: whatever is worn here gains 10% of its bonuses per level.</summary>
        public int Level { get; set; }
        /// <summary>The max health and Qi this slot added, so taking the item off removes exactly that.</summary>
        public int AppliedHp { get; set; }
        public int AppliedQi { get; set; }
    }

    public sealed class ItemStack
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Type { get; set; } = "Misc";
        public string Rarity { get; set; } = "Common";
        public int Qty { get; set; } = 1;
    }

    public sealed class SkillState
    {
        public string Id { get; set; } = "";
        public int Level { get; set; } = 1;
        public int Exp { get; set; }
    }

    public sealed class TechniqueState
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public string Grade { get; set; } = "Mortal";
        public List<Element> Elements { get; set; } = new List<Element>();
        public double SpeedBonus { get; set; }
        public int Level { get; set; } = 1;
    }

    public enum LedgerKind
    {
        /// <summary>Ân — a debt of gratitude someone owes you (or you owe them).</summary>
        An,
        /// <summary>Oán — a grudge.</summary>
        Oan,
    }

    /// <summary>One line in the Sổ nhân quả: who, what kind of bond, how heavy, and why.</summary>
    public sealed class LedgerEntry
    {
        public string NpcId { get; set; } = "";
        public LedgerKind Kind { get; set; }
        public int Weight { get; set; }
        public int Month { get; set; }
        public string Context { get; set; } = "";
        public string ContextEn { get; set; } = "";
        public bool Settled { get; set; }
    }

    public sealed class InjuryState
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
        public int MonthsLeft { get; set; }
        /// <summary>Multiplier on monthly cultivation while the injury lasts.</summary>
        public double CultivationMultiplier { get; set; } = 1;
    }

    public sealed class ActiveBounty
    {
        public string Id { get; set; } = "";
        public string EnemyId { get; set; } = "";
        public int Count { get; set; }
        public int Progress { get; set; }
        public int RewardSilver { get; set; }
        public int RewardKarma { get; set; }
        public string Name { get; set; } = "";
        public string NameEn { get; set; } = "";
    }

    /// <summary>
    /// A sect mission in hand. The objective is copied from its template when it's taken, so a content
    /// change never alters a mission already under way.
    /// </summary>
    public sealed class ActiveMission
    {
        public string Id { get; set; } = "";
        public string TemplateId { get; set; } = "";
        /// <summary>gather_items | win_combats | defeat_rival_member | cultivate_exp | visit_region</summary>
        public string Kind { get; set; } = "";
        public int Goal { get; set; } = 1;
        public int Progress { get; set; }
        public string? ItemType { get; set; }
        public string? MinRarity { get; set; }
        public string? RivalSectId { get; set; }
        public string? RegionId { get; set; }
        public int AcceptedMonth { get; set; }
        /// <summary>The month index it must be done by; a finished mission waits to be reported without one.</summary>
        public int DeadlineMonth { get; set; }
        public int RewardContribution { get; set; }
        public int RewardSilver { get; set; }
        public int RewardStones { get; set; }
        /// <summary>The player has been told it is done (it waits at the hall for the reward).</summary>
        public bool Announced { get; set; }

        [JsonIgnore] public bool Done => Progress >= Goal;
    }

    public sealed class MissionBoardState
    {
        /// <summary>The month index the board was last rolled; −1 before the first time.</summary>
        public int RolledMonth { get; set; } = -1;
        public List<string> Offers { get; set; } = new List<string>();
    }

    public sealed class ChronicleEntry
    {
        public int MonthIndex { get; set; }
        public string Text { get; set; } = "";
        public string TextEn { get; set; } = "";
    }

    // ---------------------------------------------------------------- the living world

    public sealed class WorldState
    {
        public List<NpcState> Npcs { get; set; } = new List<NpcState>();
        public List<BeastPack> Beasts { get; set; } = new List<BeastPack>();
        public List<AdventureSpot> Adventures { get; set; } = new List<AdventureSpot>();
        public List<NodeState> Nodes { get; set; } = new List<NodeState>();
        public List<Rumor> Rumors { get; set; } = new List<Rumor>();
        public Dictionary<string, int> EventCooldowns { get; set; } = new Dictionary<string, int>();
        public Dictionary<string, int> DungeonClears { get; set; } = new Dictionary<string, int>();
        public SecretRealmRun? Run { get; set; }
        /// <summary>A fight the world forced on you (e.g. an ambush during the month tick).</summary>
        public Encounter? PendingAmbush { get; set; }
    }

    public sealed class NpcState
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
        public bool Female { get; set; }
        public int Age { get; set; }
        public int AgeMonths { get; set; }
        public int Lifespan { get; set; }
        public Realm Realm { get; set; }
        public int Stage { get; set; }
        public long Exp { get; set; }
        public RootGrade Grade { get; set; }
        public List<Element> Elements { get; set; } = new List<Element>();
        /// <summary>−100 demonic … +100 righteous.</summary>
        public int Alignment { get; set; }
        public List<string> Traits { get; set; } = new List<string>();
        public string? SectId { get; set; }
        public string Zone { get; set; } = "";
        public int X { get; set; }
        public int Y { get; set; }
        public string Goal { get; set; } = "cultivate";
        /// <summary>Relations to other NPCs and to "player": −100 … +100.</summary>
        public Dictionary<string, int> Relations { get; set; } = new Dictionary<string, int>();
        public bool Alive { get; set; } = true;
        public int InjuredMonths { get; set; }
        public bool Anchor { get; set; }
        public string? Role { get; set; }
        public string? RoleEn { get; set; }
        public int LastTalkMonth { get; set; } = -1;
        public int LastGiftMonth { get; set; } = -1;

        public int RelationTo(string id) => Relations.TryGetValue(id, out var v) ? v : 0;
    }

    public sealed class BeastPack
    {
        public string Id { get; set; } = "";
        public List<string> EnemyIds { get; set; } = new List<string>();
        public string Zone { get; set; } = "";
        public int X { get; set; }
        public int Y { get; set; }
        public bool Aggressive { get; set; }
    }

    public sealed class AdventureSpot
    {
        public string Id { get; set; } = "";
        public string EventId { get; set; } = "";
        public string Zone { get; set; } = "";
        public int X { get; set; }
        public int Y { get; set; }
        public int ExpiresMonth { get; set; }
        /// <summary>Hidden spots need a Thần thức pulse or high perception to see.</summary>
        public bool Hidden { get; set; }
    }

    public sealed class NodeState
    {
        public string PoiId { get; set; } = "";
        public int ReadyMonth { get; set; }
    }

    public sealed class Rumor
    {
        public int MonthIndex { get; set; }
        public string Kind { get; set; } = "";
        public string Text { get; set; } = "";
        public string TextEn { get; set; } = "";
        public string? Subject { get; set; }
    }

    public sealed class SecretRealmRun
    {
        public string DungeonId { get; set; } = "";
        public int Floor { get; set; } = 1;
        public bool FloorCleared { get; set; }
        public int ChestsOpened { get; set; }
        public bool Completed { get; set; }
    }

    /// <summary>A fight about to happen. The engine creates it; the arena plays it; ResolveCombat closes it.</summary>
    public sealed class Encounter
    {
        public string Id { get; set; } = "";
        /// <summary>beast | npc | spar | adventure | dungeon | trial | ambush</summary>
        public string Source { get; set; } = "beast";
        public string? SourceId { get; set; }
        public List<string> EnemyIds { get; set; } = new List<string>();
        public string? Zone { get; set; }
        public int Danger { get; set; } = 1;
        /// <summary>Spars end at low HP instead of death, and never cost karma.</summary>
        public bool NonLethal { get; set; }
        /// <summary>For NPC fights: the NPC's realm overrides the catalog enemy's.</summary>
        public Realm? RealmOverride { get; set; }
        public int StageOverride { get; set; }
        public string? DisplayName { get; set; }
    }
}
