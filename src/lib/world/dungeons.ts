/**
 * Dungeon/Secret Realm Definitions for the Xianxia World
 * 5 Dungeons - one per region, each with unique themes and rewards
 */

import { Dungeon, DungeonFloor, DungeonReward } from "@/types/world";

// ========================================
// ITEM NAME TRANSLATIONS
// ========================================

const ITEM_TRANSLATIONS: Record<string, { vi: string; en: string }> = {
  fire_token: { vi: "Hỏa Bài", en: "Fire Token" },
  water_pearl: { vi: "Thủy Ngọc", en: "Water Pearl" },
  thunder_seal: { vi: "Lôi Ấn", en: "Thunder Seal" },
  spirit_jade: { vi: "Linh Ngọc", en: "Spirit Jade" },
  void_crystal: { vi: "Hư Không Thạch", en: "Void Crystal" },
  sect_token: { vi: "Tông Môn Lệnh", en: "Sect Token" },
  elder_recommendation: {
    vi: "Thư Giới Thiệu Trưởng Lão",
    en: "Elder Recommendation",
  },
  trial_pass: { vi: "Thẻ Thử Thách", en: "Trial Pass" },
  ancient_key: { vi: "Chìa Khóa Cổ", en: "Ancient Key" },
  beast_core: { vi: "Yêu Đan", en: "Beast Core" },
  phoenix_feather: { vi: "Lông Phượng Hoàng", en: "Phoenix Feather" },
  dragon_scale: { vi: "Vảy Rồng", en: "Dragon Scale" },
};

// Helper function to get translated item name
function getItemName(itemId: string): { vi: string; en: string } {
  if (ITEM_TRANSLATIONS[itemId]) {
    return ITEM_TRANSLATIONS[itemId];
  }
  // Fallback: format the ID
  const formatted = itemId
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { vi: formatted, en: formatted };
}

// ========================================
// DUNGEON 1: THANH VÂN - Spirit Herb Garden Secret Realm
// ========================================

const SPIRIT_HERB_REALM_FLOORS: DungeonFloor[] = [
  {
    floor_number: 1,
    name: "Ngoại Viên",
    name_en: "Outer Garden",
    description:
      "Vườn ngoài với các loại thảo dược thường thấy, được bảo vệ bởi côn trùng khổng lồ.",
    description_en: "Outer garden with common herbs, guarded by giant insects.",
    enemy_waves: [
      {
        id: "wave_1_1",
        enemies: ["spirit_bee", "spirit_bee"],
        spawn_chance: 1,
      },
      { id: "wave_1_2", enemies: ["venomous_snake"], spawn_chance: 0.7 },
    ],
    chest_count: 2,
    chest_loot_table: "herb_garden_chest_1",
    hidden_chest_count: 1,
    hidden_loot_table: "herb_garden_hidden_1",
    floor_events: ["rare_herb_bloom", "poisonous_mist"],
  },
  {
    floor_number: 2,
    name: "Nội Viên",
    name_en: "Inner Garden",
    description: "Vườn trong với dược liệu quý hiếm, nơi tinh linh cây bắt đầu xuất hiện.",
    description_en: "Inner garden with rare herbs, where tree spirits begin to appear.",
    enemy_waves: [
      {
        id: "wave_2_1",
        enemies: ["herb_guardian", "spirit_bee"],
        spawn_chance: 1,
      },
      { id: "wave_2_2", enemies: ["tree_spirit"], spawn_chance: 0.5 },
    ],
    mini_boss: "elder_herb_guardian",
    chest_count: 3,
    chest_loot_table: "herb_garden_chest_2",
    hidden_chest_count: 1,
    hidden_loot_table: "herb_garden_hidden_2",
    floor_events: ["garden_spirit_test"],
  },
  {
    floor_number: 3,
    name: "Thần Mộc Đường",
    name_en: "Divine Tree Hall",
    description: "Trung tâm bí cảnh, nơi cổ thụ thần mộc ngự trị.",
    description_en: "The realm's center, where the ancient divine tree resides.",
    enemy_waves: [
      {
        id: "wave_3_1",
        enemies: ["tree_spirit", "tree_spirit", "herb_guardian"],
        spawn_chance: 1,
      },
    ],
    floor_boss: "ancient_tree_spirit",
    chest_count: 2,
    chest_loot_table: "herb_garden_boss_chest",
    hidden_chest_count: 2,
    hidden_loot_table: "herb_garden_boss_hidden",
    floor_events: ["tree_blessing"],
    has_shortcut: true,
    shortcut_requirements: { item: "verdant_key" },
  },
];

const SPIRIT_HERB_REALM: Dungeon = {
  id: "spirit_herb_realm",
  name: "Linh Thảo Bí Cảnh",
  name_en: "Spirit Herb Garden Secret Realm",
  description:
    "Một bí cảnh được tạo ra bởi đại năng thời xưa để nuôi trồng linh thảo. Nay đã hoang phế và bị tinh linh cây chiếm giữ.",
  description_en:
    "A secret realm created by an ancient master to cultivate spirit herbs. Now abandoned and occupied by tree spirits.",
  type: "secret_realm",
  region: "thanh_van",
  area: "spirit_herb_garden",
  tier: 1,
  recommended_realm: "PhàmNhân",
  floors: SPIRIT_HERB_REALM_FLOORS,
  time_limit: 30,
  entry_cost: {
    silver: 100,
  },
  completion_rewards: [
    { type: "exp", amount: 100 },
    { type: "item", id: "spirit_root_pill", chance: 1 },
    { type: "item", id: "rare_spirit_herb", chance: 0.5 },
  ],
  first_clear_bonus: [
    { type: "technique", id: "wood_cultivation_manual" },
    { type: "spirit_stones", amount: 50 },
  ],
  respawn_days: 7,
};

// ========================================
// DUNGEON 2: HỎA SƠN - Phoenix Ancestor Tomb
// ========================================

const PHOENIX_TOMB_FLOORS: DungeonFloor[] = [
  {
    floor_number: 1,
    name: "Hỏa Diễm Đường",
    name_en: "Flame Hall",
    description: "Đại sảnh đầu tiên với những ngọn lửa vĩnh cửu.",
    description_en: "The first hall with eternal flames.",
    enemy_waves: [
      {
        id: "wave_1_1",
        enemies: ["fire_lizard", "fire_lizard"],
        spawn_chance: 1,
      },
      { id: "wave_1_2", enemies: ["flame_spirit"], spawn_chance: 0.6 },
    ],
    chest_count: 2,
    chest_loot_table: "phoenix_tomb_chest_1",
    floor_events: ["fire_trap", "flame_puzzle"],
  },
  {
    floor_number: 2,
    name: "Dung Nham Hồ",
    name_en: "Lava Lake",
    description: "Hồ dung nham sôi sục với đảo đá rải rác.",
    description_en: "A boiling lava lake with scattered stone platforms.",
    enemy_waves: [
      { id: "wave_2_1", enemies: ["magma_golem"], spawn_chance: 1 },
      {
        id: "wave_2_2",
        enemies: ["lava_slug", "lava_slug", "lava_slug"],
        spawn_chance: 0.8,
      },
    ],
    mini_boss: "lava_serpent",
    chest_count: 3,
    chest_loot_table: "phoenix_tomb_chest_2",
    hidden_chest_count: 1,
    hidden_loot_table: "phoenix_tomb_hidden",
    floor_events: ["lava_surge", "fire_crystal_vein"],
  },
  {
    floor_number: 3,
    name: "Phượng Vũ Các",
    name_en: "Phoenix Feather Pavilion",
    description: "Nơi lưu giữ vũ mao phượng hoàng.",
    description_en: "Where phoenix feathers are kept.",
    enemy_waves: [
      {
        id: "wave_3_1",
        enemies: ["flame_hawk", "flame_hawk"],
        spawn_chance: 1,
      },
      { id: "wave_3_2", enemies: ["fire_elemental"], spawn_chance: 0.7 },
    ],
    chest_count: 2,
    chest_loot_table: "phoenix_tomb_chest_3",
    floor_events: ["phoenix_feather_shower"],
    has_shortcut: true,
    shortcut_requirements: { item: "flame_medallion" },
  },
  {
    floor_number: 4,
    name: "Niết Bàn Thất",
    name_en: "Nirvana Chamber",
    description: "Căn phòng bí mật nơi phượng hoàng tái sinh.",
    description_en: "The secret chamber where the phoenix is reborn.",
    enemy_waves: [
      {
        id: "wave_4_1",
        enemies: ["fire_elemental", "flame_hawk", "magma_golem"],
        spawn_chance: 1,
      },
    ],
    mini_boss: "phoenix_remnant",
    chest_count: 3,
    chest_loot_table: "phoenix_tomb_chest_4",
    hidden_chest_count: 2,
    hidden_loot_table: "phoenix_tomb_hidden_2",
    floor_events: ["nirvana_fire"],
  },
  {
    floor_number: 5,
    name: "Tổ Sư Đường",
    name_en: "Patriarch Hall",
    description: "Nơi an nghỉ của Phượng Hoàng Tổ Sư.",
    description_en: "The resting place of the Phoenix Patriarch.",
    enemy_waves: [
      {
        id: "wave_5_1",
        enemies: ["phoenix_remnant", "fire_elemental", "fire_elemental"],
        spawn_chance: 1,
      },
    ],
    floor_boss: "flame_specter_patriarch",
    chest_count: 3,
    chest_loot_table: "phoenix_tomb_boss_chest",
    hidden_chest_count: 2,
    hidden_loot_table: "phoenix_tomb_boss_hidden",
    floor_events: ["patriarch_trial"],
  },
];

const PHOENIX_TOMB: Dungeon = {
  id: "phoenix_tomb",
  name: "Phượng Hoàng Tổ Mộ",
  name_en: "Phoenix Ancestor Tomb",
  description:
    "Lăng mộ của Phượng Hoàng Tổ Sư, một đại năng hỏa hệ thời cổ đại. Nơi đây chứa đựng những bí kíp hỏa công và bảo vật phượng hoàng.",
  description_en:
    "Tomb of the Phoenix Patriarch, an ancient fire cultivation master. Contains fire techniques and phoenix treasures.",
  type: "ancient_tomb",
  region: "hoa_son",
  area: "phoenix_peak",
  tier: 2,
  recommended_realm: "LuyệnKhí",
  floors: PHOENIX_TOMB_FLOORS,
  time_limit: 50,
  entry_cost: {
    silver: 500,
    item: "fire_token",
  },
  entry_requirements: {
    realm: "LuyệnKhí",
  },
  completion_rewards: [
    { type: "exp", amount: 300 },
    { type: "item", id: "phoenix_feather", chance: 1 },
    { type: "item", id: "fire_essence", chance: 0.7 },
    { type: "spirit_stones", amount: 100 },
  ],
  first_clear_bonus: [
    { type: "technique", id: "phoenix_fire_manual" },
    { type: "item", id: "phoenix_blood_pill" },
  ],
  respawn_days: 14,
};

// ========================================
// DUNGEON 3: HUYỀN THỦY - Dragon Turtle Lair
// ========================================

const DRAGON_TURTLE_FLOORS: DungeonFloor[] = [
  {
    floor_number: 1,
    name: "Hải Động Nhập Khẩu",
    name_en: "Sea Cave Entrance",
    description: "Lối vào hang động dưới nước với rạn san hô.",
    description_en: "Underwater cave entrance with coral reefs.",
    enemy_waves: [
      {
        id: "wave_1_1",
        enemies: ["giant_crab", "giant_crab"],
        spawn_chance: 1,
      },
      { id: "wave_1_2", enemies: ["coral_golem"], spawn_chance: 0.5 },
    ],
    chest_count: 2,
    chest_loot_table: "dragon_turtle_chest_1",
    floor_events: ["pearl_bed", "current_shift"],
  },
  {
    floor_number: 2,
    name: "San Hô Mê Cung",
    name_en: "Coral Labyrinth",
    description: "Mê cung san hô phức tạp với những sinh vật biển kỳ dị.",
    description_en: "Complex coral maze with strange sea creatures.",
    enemy_waves: [
      { id: "wave_2_1", enemies: ["sea_serpent"], spawn_chance: 1 },
      {
        id: "wave_2_2",
        enemies: ["water_elemental", "coral_golem"],
        spawn_chance: 0.7,
      },
    ],
    mini_boss: "maze_guardian",
    chest_count: 3,
    chest_loot_table: "dragon_turtle_chest_2",
    hidden_chest_count: 2,
    hidden_loot_table: "dragon_turtle_hidden",
    floor_events: ["sunken_ship"],
  },
  {
    floor_number: 3,
    name: "Thâm Hải Vực",
    name_en: "Deep Sea Abyss",
    description: "Vùng nước sâu tối tăm với áp suất cực cao.",
    description_en: "Dark deep waters with extreme pressure.",
    enemy_waves: [
      { id: "wave_3_1", enemies: ["deep_one", "deep_one"], spawn_chance: 1 },
      {
        id: "wave_3_2",
        enemies: ["abyssal_fish", "abyssal_fish", "abyssal_fish"],
        spawn_chance: 0.8,
      },
    ],
    chest_count: 2,
    chest_loot_table: "dragon_turtle_chest_3",
    floor_events: ["pressure_shift", "ancient_ruin"],
    has_shortcut: true,
    shortcut_requirements: { item: "water_breathing_pearl" },
  },
  {
    floor_number: 4,
    name: "Long Cung Tiền Đường",
    name_en: "Dragon Palace Antechamber",
    description: "Tiền sảnh của cung điện long quy với kiến trúc cổ đại.",
    description_en: "Antechamber of the dragon turtle palace with ancient architecture.",
    enemy_waves: [
      {
        id: "wave_4_1",
        enemies: ["turtle_warrior", "turtle_warrior"],
        spawn_chance: 1,
      },
      { id: "wave_4_2", enemies: ["sea_drake"], spawn_chance: 0.6 },
    ],
    mini_boss: "dragon_turtle_guardian",
    chest_count: 4,
    chest_loot_table: "dragon_turtle_chest_4",
    hidden_chest_count: 1,
    hidden_loot_table: "dragon_turtle_hidden_2",
    floor_events: ["dragon_turtle_blessing"],
  },
  {
    floor_number: 5,
    name: "Long Quy Điện",
    name_en: "Dragon Turtle Hall",
    description: "Đại điện nơi Long Quy Cổ Thú ngự trị.",
    description_en: "The great hall where the Ancient Dragon Turtle resides.",
    enemy_waves: [
      {
        id: "wave_5_1",
        enemies: ["turtle_warrior", "sea_drake", "water_elemental"],
        spawn_chance: 1,
      },
    ],
    floor_boss: "ancient_dragon_turtle",
    chest_count: 3,
    chest_loot_table: "dragon_turtle_boss_chest",
    hidden_chest_count: 2,
    hidden_loot_table: "dragon_turtle_boss_hidden",
    floor_events: ["dragon_bloodline_trial"],
  },
];

const DRAGON_TURTLE_LAIR: Dungeon = {
  id: "dragon_turtle_lair",
  name: "Long Quy Sào Huyệt",
  name_en: "Dragon Turtle Lair",
  description:
    "Hang động dưới nước của Long Quy Cổ Thú, một sinh vật mang huyết mạch long tộc. Cần có vật phẩm hô hấp dưới nước.",
  description_en:
    "Underwater cave of the Ancient Dragon Turtle, a creature with dragon bloodline. Water breathing items needed.",
  type: "beast_lair",
  region: "huyen_thuy",
  area: "dragon_turtle_island",
  tier: 3,
  recommended_realm: "TrúcCơ",
  floors: DRAGON_TURTLE_FLOORS,
  time_limit: 60,
  entry_cost: {
    spirit_stones: 50,
  },
  entry_requirements: {
    realm: "TrúcCơ",
    items: ["water_breathing_pill"],
  },
  completion_rewards: [
    { type: "exp", amount: 500 },
    { type: "item", id: "dragon_scale", chance: 1 },
    { type: "item", id: "water_essence", chance: 0.8 },
    { type: "spirit_stones", amount: 200 },
  ],
  first_clear_bonus: [
    { type: "item", id: "dragon_bloodline_pill" },
    { type: "technique", id: "water_dragon_manual" },
  ],
  respawn_days: 21,
};

// ========================================
// DUNGEON 4: TRẦM LÔI - Heavenly Tribulation Grounds
// ========================================

const TRIBULATION_GROUNDS_FLOORS: DungeonFloor[] = [
  {
    floor_number: 1,
    name: "Lôi Vân Đài",
    name_en: "Thunder Cloud Platform",
    description: "Đài cao với mây sấm bao quanh.",
    description_en: "High platform surrounded by thunder clouds.",
    enemy_waves: [
      {
        id: "wave_1_1",
        enemies: ["static_golem", "static_golem"],
        spawn_chance: 1,
      },
    ],
    chest_count: 2,
    chest_loot_table: "tribulation_chest_1",
    floor_events: ["lightning_strike"],
  },
  {
    floor_number: 2,
    name: "Điện Phách Lâm",
    name_en: "Lightning Soul Forest",
    description: "Rừng cây bị sét đánh thành than nhưng vẫn đứng.",
    description_en: "Forest of charred trees still standing after lightning strikes.",
    enemy_waves: [
      { id: "wave_2_1", enemies: ["thunder_beast"], spawn_chance: 1 },
      {
        id: "wave_2_2",
        enemies: ["lightning_hawk", "lightning_hawk"],
        spawn_chance: 0.7,
      },
    ],
    mini_boss: "storm_wolf",
    chest_count: 3,
    chest_loot_table: "tribulation_chest_2",
    hidden_chest_count: 1,
    hidden_loot_table: "tribulation_hidden",
    floor_events: ["thunder_crystal", "storm_shelter"],
  },
  {
    floor_number: 3,
    name: "Thiên Lôi Trận",
    name_en: "Heavenly Thunder Array",
    description: "Trận pháp cổ đại dùng để hấp thụ thiên lôi.",
    description_en: "Ancient array used to absorb heavenly lightning.",
    enemy_waves: [
      { id: "wave_3_1", enemies: ["storm_elemental"], spawn_chance: 1 },
      {
        id: "wave_3_2",
        enemies: ["lightning_serpent", "thunder_beast"],
        spawn_chance: 0.8,
      },
    ],
    chest_count: 2,
    chest_loot_table: "tribulation_chest_3",
    floor_events: ["array_activation", "lightning_baptism"],
    has_shortcut: true,
    shortcut_requirements: { item: "thunder_medallion" },
  },
  {
    floor_number: 4,
    name: "Cửu Thiên Lôi Trì",
    name_en: "Nine Heavens Thunder Pool",
    description: "Hồ chứa đầy năng lượng sấm sét tinh thuần.",
    description_en: "Pool filled with pure lightning energy.",
    enemy_waves: [
      {
        id: "wave_4_1",
        enemies: ["lightning_serpent", "storm_elemental"],
        spawn_chance: 1,
      },
      { id: "wave_4_2", enemies: ["thunder_elemental"], spawn_chance: 0.6 },
    ],
    mini_boss: "thunder_serpent_king",
    chest_count: 3,
    chest_loot_table: "tribulation_chest_4",
    hidden_chest_count: 2,
    hidden_loot_table: "tribulation_hidden_2",
    floor_events: ["tribulation_opportunity"],
  },
  {
    floor_number: 5,
    name: "Luyện Lôi Điện",
    name_en: "Lightning Refinement Hall",
    description: "Đại điện nơi tu sĩ thời xưa rèn luyện thân thể bằng thiên lôi.",
    description_en: "Hall where ancient cultivators tempered their bodies with heavenly lightning.",
    enemy_waves: [
      {
        id: "wave_5_1",
        enemies: ["ancient_construct", "ancient_construct"],
        spawn_chance: 1,
      },
    ],
    chest_count: 3,
    chest_loot_table: "tribulation_chest_5",
    floor_events: ["ancient_scroll", "mechanism_puzzle"],
  },
  {
    floor_number: 6,
    name: "Thiên Kiếp Đàn",
    name_en: "Tribulation Altar",
    description: "Tế đàn nơi diễn ra thiên kiếp nhân tạo.",
    description_en: "Altar where artificial tribulations were conducted.",
    enemy_waves: [
      {
        id: "wave_6_1",
        enemies: ["tribulation_beast", "thunder_elemental", "storm_elemental"],
        spawn_chance: 1,
      },
    ],
    mini_boss: "tribulation_avatar_fragment",
    chest_count: 4,
    chest_loot_table: "tribulation_chest_6",
    hidden_chest_count: 2,
    hidden_loot_table: "tribulation_hidden_3",
    floor_events: ["altar_activation"],
  },
  {
    floor_number: 7,
    name: "Thiên Kiếp Điện",
    name_en: "Tribulation Temple",
    description: "Nơi Thiên Kiếp Hóa Thân ngự trị.",
    description_en: "Where the Lightning Tribulation Avatar resides.",
    enemy_waves: [
      {
        id: "wave_7_1",
        enemies: ["tribulation_avatar_fragment", "thunder_elemental", "lightning_serpent"],
        spawn_chance: 1,
      },
    ],
    floor_boss: "lightning_tribulation_avatar",
    chest_count: 4,
    chest_loot_table: "tribulation_boss_chest",
    hidden_chest_count: 3,
    hidden_loot_table: "tribulation_boss_hidden",
    floor_events: ["final_tribulation"],
  },
];

const TRIBULATION_GROUNDS: Dungeon = {
  id: "tribulation_grounds",
  name: "Thiên Kiếp Trường",
  name_en: "Heavenly Tribulation Grounds",
  description:
    "Vùng thử thách thiên kiếp được tạo ra bởi các đại năng cổ đại. Nơi đây có thể giúp tu sĩ rèn luyện thân thể bằng thiên lôi.",
  description_en:
    "Tribulation testing grounds created by ancient masters. Can help cultivators temper their bodies with heavenly lightning.",
  type: "trial_ground",
  region: "tram_loi",
  area: "lightning_valley",
  tier: 4,
  recommended_realm: "KếtĐan",
  floors: TRIBULATION_GROUNDS_FLOORS,
  time_limit: 80,
  entry_cost: {
    spirit_stones: 100,
  },
  entry_requirements: {
    realm: "KếtĐan",
  },
  completion_rewards: [
    { type: "exp", amount: 800 },
    { type: "item", id: "tribulation_crystal", chance: 1 },
    { type: "item", id: "lightning_essence", chance: 0.9 },
    { type: "spirit_stones", amount: 500 },
  ],
  first_clear_bonus: [
    { type: "technique", id: "thunder_body_manual" },
    { type: "skill", id: "lightning_immunity" },
    { type: "item", id: "tribulation_resistance_pill" },
  ],
  respawn_days: 30,
};

// ========================================
// DUNGEON 5: VỌNG LINH - Void Ancestral Hall
// ========================================

const VOID_HALL_FLOORS: DungeonFloor[] = [
  {
    floor_number: 1,
    name: "U Minh Môn",
    name_en: "Netherworld Gate",
    description: "Cổng vào thế giới linh hồn với âm khí nặng nề.",
    description_en: "Gateway to the spirit world with heavy yin energy.",
    enemy_waves: [
      {
        id: "wave_1_1",
        enemies: ["yin_spirit", "yin_spirit"],
        spawn_chance: 1,
      },
    ],
    chest_count: 2,
    chest_loot_table: "void_hall_chest_1",
    floor_events: ["spirit_whisper", "yin_surge"],
  },
  {
    floor_number: 2,
    name: "Vong Hồn Đạo",
    name_en: "Path of Lost Souls",
    description: "Con đường dài với vô số linh hồn lạc lối.",
    description_en: "Long path with countless lost souls.",
    enemy_waves: [
      { id: "wave_2_1", enemies: ["ghost_cultivator"], spawn_chance: 1 },
      { id: "wave_2_2", enemies: ["soul_devourer"], spawn_chance: 0.5 },
    ],
    mini_boss: "soul_shepherd",
    chest_count: 3,
    chest_loot_table: "void_hall_chest_2",
    hidden_chest_count: 1,
    hidden_loot_table: "void_hall_hidden",
    floor_events: ["soul_fragment", "memory_echo"],
  },
  {
    floor_number: 3,
    name: "Âm Dương Giới",
    name_en: "Yin-Yang Boundary",
    description: "Ranh giới giữa âm và dương, nơi thực tại bắt đầu méo mó.",
    description_en: "Boundary between yin and yang, where reality begins to distort.",
    enemy_waves: [
      {
        id: "wave_3_1",
        enemies: ["void_walker", "yin_spirit"],
        spawn_chance: 1,
      },
      { id: "wave_3_2", enemies: ["dimensional_beast"], spawn_chance: 0.7 },
    ],
    chest_count: 3,
    chest_loot_table: "void_hall_chest_3",
    floor_events: ["reality_tear", "balance_trial"],
    has_shortcut: true,
    shortcut_requirements: { item: "yin_yang_medallion" },
  },
  {
    floor_number: 4,
    name: "Tổ Linh Hồi Lang",
    name_en: "Ancestral Spirit Corridor",
    description: "Hành lang với linh ảnh của các tổ tiên.",
    description_en: "Corridor with ancestral spirit projections.",
    enemy_waves: [
      {
        id: "wave_4_1",
        enemies: ["ancestral_remnant", "ghost_cultivator"],
        spawn_chance: 1,
      },
    ],
    mini_boss: "ancestral_guardian",
    chest_count: 4,
    chest_loot_table: "void_hall_chest_4",
    hidden_chest_count: 2,
    hidden_loot_table: "void_hall_hidden_2",
    floor_events: ["ancestral_vision", "legacy_trial"],
  },
  {
    floor_number: 5,
    name: "Hư Vô Hải",
    name_en: "Sea of Void",
    description: "Biển hư vô nơi không gian và thời gian mất ý nghĩa.",
    description_en: "Sea of void where space and time lose meaning.",
    enemy_waves: [
      {
        id: "wave_5_1",
        enemies: ["void_creature", "void_creature"],
        spawn_chance: 1,
      },
      { id: "wave_5_2", enemies: ["void_whale"], spawn_chance: 0.4 },
    ],
    chest_count: 3,
    chest_loot_table: "void_hall_chest_5",
    floor_events: ["void_whisper", "time_distortion"],
  },
  {
    floor_number: 6,
    name: "Thiên Đế Di Cảnh",
    name_en: "Heavenly Emperor's Legacy",
    description: "Di tích của một vị Thiên Đế cổ đại.",
    description_en: "Remains of an ancient Heavenly Emperor.",
    enemy_waves: [
      {
        id: "wave_6_1",
        enemies: ["void_emperor_shade", "ancestral_remnant"],
        spawn_chance: 1,
      },
    ],
    mini_boss: "emperor_guard",
    chest_count: 4,
    chest_loot_table: "void_hall_chest_6",
    hidden_chest_count: 2,
    hidden_loot_table: "void_hall_hidden_3",
    floor_events: ["emperor_trial", "void_enlightenment"],
  },
  {
    floor_number: 7,
    name: "Hồn Ngục",
    name_en: "Soul Prison",
    description: "Nhà ngục giam giữ những linh hồn tội đồ.",
    description_en: "Prison holding criminal souls.",
    enemy_waves: [
      {
        id: "wave_7_1",
        enemies: ["soul_devourer", "soul_devourer", "ghost_cultivator"],
        spawn_chance: 1,
      },
    ],
    mini_boss: "prison_warden",
    chest_count: 3,
    chest_loot_table: "void_hall_chest_7",
    floor_events: ["soul_liberation"],
  },
  {
    floor_number: 8,
    name: "Hư Không Trung Tâm",
    name_en: "Void Core",
    description: "Tâm điểm của hư không, nơi mọi thứ hội tụ.",
    description_en: "Core of the void, where everything converges.",
    enemy_waves: [
      {
        id: "wave_8_1",
        enemies: ["void_creature", "dimensional_beast", "void_walker"],
        spawn_chance: 1,
      },
    ],
    chest_count: 4,
    chest_loot_table: "void_hall_chest_8",
    hidden_chest_count: 3,
    hidden_loot_table: "void_hall_hidden_4",
    floor_events: ["dimensional_rift"],
  },
  {
    floor_number: 9,
    name: "Hư Đế Điện",
    name_en: "Void Emperor Hall",
    description: "Đại điện của Hư Không Đế Quân.",
    description_en: "The great hall of the Void Emperor.",
    enemy_waves: [
      {
        id: "wave_9_1",
        enemies: ["void_emperor_shade", "void_creature", "dimensional_beast", "void_walker"],
        spawn_chance: 1,
      },
    ],
    floor_boss: "void_emperor_remnant",
    chest_count: 5,
    chest_loot_table: "void_hall_boss_chest",
    hidden_chest_count: 3,
    hidden_loot_table: "void_hall_boss_hidden",
    floor_events: ["emperor_legacy", "void_ascension"],
  },
];

const VOID_ANCESTRAL_HALL: Dungeon = {
  id: "void_ancestral_hall",
  name: "Hư Không Tổ Đường",
  name_en: "Void Ancestral Hall",
  description:
    "Tổ đường của Hư Không Đế Quân, một trong những đại năng mạnh nhất thời thượng cổ. Nơi đây chứa đựng di sản và bí mật của hư không chi đạo.",
  description_en:
    "Ancestral hall of the Void Emperor, one of the most powerful beings of the primordial era. Contains legacies and secrets of the void dao.",
  type: "ancient_tomb",
  region: "vong_linh",
  area: "void_nexus",
  tier: 5,
  recommended_realm: "NguyênAnh",
  floors: VOID_HALL_FLOORS,
  time_limit: 100,
  entry_cost: {
    spirit_stones: 500,
    item: "void_key",
  },
  entry_requirements: {
    realm: "NguyênAnh",
    flags: ["completed_tribulation_grounds"],
  },
  completion_rewards: [
    { type: "exp", amount: 2000 },
    { type: "item", id: "void_crystal", chance: 1 },
    { type: "item", id: "void_essence", chance: 1 },
    { type: "spirit_stones", amount: 2000 },
  ],
  first_clear_bonus: [
    { type: "technique", id: "void_emperor_manual" },
    { type: "skill", id: "void_step" },
    { type: "item", id: "void_emperor_ring" },
  ],
};

// ========================================
// EXPORTS
// ========================================

export const ALL_DUNGEONS: Dungeon[] = [
  SPIRIT_HERB_REALM,
  PHOENIX_TOMB,
  DRAGON_TURTLE_LAIR,
  TRIBULATION_GROUNDS,
  VOID_ANCESTRAL_HALL,
];

export const DUNGEONS_BY_REGION: Record<string, Dungeon[]> = {
  thanh_van: [SPIRIT_HERB_REALM],
  hoa_son: [PHOENIX_TOMB],
  huyen_thuy: [DRAGON_TURTLE_LAIR],
  tram_loi: [TRIBULATION_GROUNDS],
  vong_linh: [VOID_ANCESTRAL_HALL],
};

// Helper functions
export function getDungeonById(dungeonId: string): Dungeon | undefined {
  return ALL_DUNGEONS.find((d) => d.id === dungeonId);
}

export function getDungeonsInRegion(regionId: string): Dungeon[] {
  return DUNGEONS_BY_REGION[regionId] || [];
}

export function getDungeonFloor(dungeonId: string, floorNumber: number): DungeonFloor | undefined {
  const dungeon = getDungeonById(dungeonId);
  return dungeon?.floors.find((f) => f.floor_number === floorNumber);
}

export function canEnterDungeon(
  dungeon: Dungeon,
  playerRealm: string,
  playerItems: string[],
  playerFlags: string[],
  playerSilver: number,
  playerSpiritStones: number
): { canEnter: boolean; reason?: string; reason_en?: string } {
  // Check realm requirement
  if (dungeon.entry_requirements?.realm) {
    const realmOrder = ["PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh"];
    const requiredIndex = realmOrder.indexOf(dungeon.entry_requirements.realm);
    const playerIndex = realmOrder.indexOf(playerRealm);
    if (playerIndex < requiredIndex) {
      return {
        canEnter: false,
        reason: `Cần đạt ${dungeon.entry_requirements.realm} để vào`,
        reason_en: `Requires ${dungeon.entry_requirements.realm} realm`,
      };
    }
  }

  // Check required items
  if (dungeon.entry_requirements?.items) {
    for (const item of dungeon.entry_requirements.items) {
      if (!playerItems.includes(item)) {
        const itemName = getItemName(item);

        return {
          canEnter: false,
          reason: `Thiếu vật phẩm cần thiết: ${itemName.vi}`,
          reason_en: `Missing required item: ${itemName.en}`,
        };
      }
    }
  }

  // Check required flags
  if (dungeon.entry_requirements?.flags) {
    for (const flag of dungeon.entry_requirements.flags) {
      if (!playerFlags.includes(flag)) {
        return {
          canEnter: false,
          reason: "Chưa hoàn thành điều kiện tiên quyết",
          reason_en: "Prerequisites not met",
        };
      }
    }
  }

  // Check entry cost
  if (dungeon.entry_cost) {
    if (dungeon.entry_cost.silver && playerSilver < dungeon.entry_cost.silver) {
      return {
        canEnter: false,
        reason: `Thiếu ${dungeon.entry_cost.silver - playerSilver} bạc`,
        reason_en: `Need ${dungeon.entry_cost.silver - playerSilver} more silver`,
      };
    }
    if (dungeon.entry_cost.spirit_stones && playerSpiritStones < dungeon.entry_cost.spirit_stones) {
      return {
        canEnter: false,
        reason: `Thiếu ${dungeon.entry_cost.spirit_stones - playerSpiritStones} linh thạch`,
        reason_en: `Need ${dungeon.entry_cost.spirit_stones - playerSpiritStones} more spirit stones`,
      };
    }
    if (dungeon.entry_cost.item && !playerItems.includes(dungeon.entry_cost.item)) {
      const itemName = getItemName(dungeon.entry_cost.item);

      return {
        canEnter: false,
        reason: `Cần vật phẩm đặc biệt để vào: ${itemName.vi}`,
        reason_en: `Requires special item to enter: ${itemName.en}`,
      };
    }
  }

  return { canEnter: true };
}
