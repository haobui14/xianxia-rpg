/**
 * Region Definitions for the Xianxia World
 * 5 Regions with unique themes, enemies, and resources
 */

import { Region, Area, AreaAction, RegionId } from '@/types/world';

// ========================================
// COMMON AREA ACTIONS
// ========================================

const COMMON_ACTIONS: Record<string, AreaAction> = {
  explore: {
    id: 'explore',
    name: 'Khám phá',
    name_en: 'Explore',
    description: 'Tìm kiếm bí ẩn và tài nguyên trong khu vực',
    description_en: 'Search for secrets and resources in the area',
    stamina_cost: 10,
    time_segments: 1,
    type: 'explore',
  },
  cultivate: {
    id: 'cultivate',
    name: 'Tu luyện',
    name_en: 'Cultivate',
    description: 'Tĩnh tâm tu luyện để tăng cường tu vi',
    description_en: 'Meditate and cultivate to increase cultivation',
    stamina_cost: 5,
    time_segments: 2,
    type: 'cultivate',
  },
  hunt: {
    id: 'hunt',
    name: 'Săn bắt',
    name_en: 'Hunt',
    description: 'Săn tìm yêu thú để luyện tập và thu thập nguyên liệu',
    description_en: 'Hunt monsters for training and materials',
    stamina_cost: 15,
    time_segments: 1,
    type: 'hunt',
  },
  gather: {
    id: 'gather',
    name: 'Thu thập',
    name_en: 'Gather',
    description: 'Thu thập dược liệu và nguyên liệu tự nhiên',
    description_en: 'Gather herbs and natural materials',
    stamina_cost: 8,
    time_segments: 1,
    type: 'gather',
  },
  rest: {
    id: 'rest',
    name: 'Nghỉ ngơi',
    name_en: 'Rest',
    description: 'Nghỉ ngơi để phục hồi thể lực',
    description_en: 'Rest to recover stamina',
    stamina_cost: 0,
    time_segments: 1,
    type: 'rest',
  },
  travel_region: {
    id: 'travel_region',
    name: 'Di chuyển vùng',
    name_en: 'Travel to Region',
    description: 'Di chuyển đến vùng khác',
    description_en: 'Travel to another region',
    stamina_cost: 20,
    time_segments: 4,
    type: 'travel',
  },
  travel_area: {
    id: 'travel_area',
    name: 'Di chuyển',
    name_en: 'Travel',
    description: 'Di chuyển trong vùng',
    description_en: 'Travel within the region',
    stamina_cost: 5,
    time_segments: 1,
    type: 'travel',
  },
};

// ========================================
// REGION 1: THANH VÂN (Azure Cloud) - Tier 1
// ========================================

const THANH_VAN_AREAS: Area[] = [
  {
    id: 'thanh_van_village',
    region_id: 'thanh_van',
    name: 'Thanh Vân Thôn',
    name_en: 'Azure Cloud Village',
    type: 'city',
    danger_level: 1,
    description: 'Một ngôi làng yên bình dưới chân núi, nơi khởi đầu của nhiều tu sĩ.',
    description_en: 'A peaceful village at the foot of the mountains, where many cultivators begin their journey.',
    available_actions: [COMMON_ACTIONS.rest, COMMON_ACTIONS.travel_area, COMMON_ACTIONS.travel_region],
    enemy_pool: [],
    loot_table: 'village_common',
    event_pool: ['merchant_visit', 'village_rumor', 'beggar_blessing'],
    connected_areas: ['verdant_forest', 'spirit_herb_garden'],
    is_safe: true,
    cultivation_bonus: 0,
  },
  {
    id: 'verdant_forest',
    region_id: 'thanh_van',
    name: 'Thanh Lâm',
    name_en: 'Verdant Forest',
    type: 'wilderness',
    danger_level: 2,
    description: 'Khu rừng xanh tốt với nhiều dược liệu quý và yêu thú cấp thấp.',
    description_en: 'A lush green forest with valuable herbs and low-level beasts.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.rest,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['forest_wolf', 'wild_boar', 'corrupted_vine', 'goblin_scout'],
    loot_table: 'forest_tier1',
    event_pool: ['herb_discovery', 'wounded_traveler', 'hidden_cave', 'beast_stampede'],
    connected_areas: ['thanh_van_village', 'ancient_tree_hollow', 'spirit_herb_garden'],
    is_safe: false,
    cultivation_bonus: 5,
  },
  {
    id: 'spirit_herb_garden',
    region_id: 'thanh_van',
    name: 'Linh Thảo Viên',
    name_en: 'Spirit Herb Garden',
    type: 'wilderness',
    danger_level: 2,
    description: 'Khu vườn thiên nhiên nơi linh thảo mọc hoang dã, được bảo vệ bởi tinh linh cây.',
    description_en: 'A natural garden where spirit herbs grow wild, protected by tree spirits.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.rest,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['herb_guardian', 'spirit_bee', 'venomous_snake'],
    loot_table: 'herb_garden_tier1',
    event_pool: ['rare_herb_bloom', 'garden_spirit_test', 'poisonous_mist'],
    connected_areas: ['thanh_van_village', 'verdant_forest', 'ancient_tree_hollow'],
    is_safe: false,
    cultivation_bonus: 10,
  },
  {
    id: 'ancient_tree_hollow',
    region_id: 'thanh_van',
    name: 'Cổ Thụ Động',
    name_en: 'Ancient Tree Hollow',
    type: 'dungeon',
    danger_level: 3,
    description: 'Hang động bên trong một cây cổ thụ ngàn năm, chứa đựng bí mật cổ xưa.',
    description_en: 'A hollow within an ancient thousand-year tree, containing ancient secrets.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['tree_spirit', 'bark_golem', 'ancient_tree_guardian'],
    loot_table: 'dungeon_tier1',
    event_pool: ['ancient_inscription', 'spirit_spring', 'tree_memory'],
    connected_areas: ['verdant_forest', 'spirit_herb_garden'],
    is_safe: false,
    cultivation_bonus: 15,
  },
];

const THANH_VAN: Region = {
  id: 'thanh_van',
  name: 'Thanh Vân',
  name_en: 'Azure Cloud',
  description: 'Vùng đất khởi đầu với rừng xanh tốt và làng mạc yên bình. Nơi lý tưởng cho tu sĩ mới bắt đầu con đường tu tiên.',
  description_en: 'A starting region with lush forests and peaceful villages. Ideal for new cultivators beginning their immortal path.',
  element: 'Mộc',
  tier: 1,
  recommended_realm: 'PhàmNhân',
  areas: THANH_VAN_AREAS,
  adjacent_regions: ['hoa_son', 'huyen_thuy'],
  unique_resources: ['Linh Thảo', 'Mộc Tinh', 'Thú Đan Cấp Thấp'],
};

// ========================================
// REGION 2: HỎA SƠN (Fire Mountain) - Tier 2
// ========================================

const HOA_SON_AREAS: Area[] = [
  {
    id: 'flame_gate_city',
    region_id: 'hoa_son',
    name: 'Hỏa Môn Thành',
    name_en: 'Flame Gate City',
    type: 'city',
    danger_level: 2,
    description: 'Thành phố được xây dựng quanh cổng vào núi lửa, nơi tụ hội các tu sĩ hỏa hệ.',
    description_en: 'A city built around the entrance to the volcano, gathering place for fire cultivators.',
    available_actions: [COMMON_ACTIONS.rest, COMMON_ACTIONS.travel_area, COMMON_ACTIONS.travel_region],
    enemy_pool: [],
    loot_table: 'city_fire',
    event_pool: ['fire_merchant', 'volcanic_rumbling', 'fire_sect_recruitment'],
    connected_areas: ['lava_tunnels', 'ash_wasteland'],
    is_safe: true,
    cultivation_bonus: 0,
  },
  {
    id: 'lava_tunnels',
    region_id: 'hoa_son',
    name: 'Dung Nham Động',
    name_en: 'Lava Tunnels',
    type: 'wilderness',
    danger_level: 3,
    description: 'Hệ thống đường hầm chứa đầy dung nham, nơi sinh sống của các sinh vật lửa.',
    description_en: 'A tunnel system filled with lava, home to fire creatures.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['fire_lizard', 'magma_golem', 'flame_spirit', 'lava_slug'],
    loot_table: 'lava_tier2',
    event_pool: ['lava_surge', 'fire_crystal_vein', 'trapped_miner'],
    connected_areas: ['flame_gate_city', 'phoenix_peak'],
    is_safe: false,
    cultivation_bonus: 10,
  },
  {
    id: 'phoenix_peak',
    region_id: 'hoa_son',
    name: 'Phượng Hoàng Phong',
    name_en: 'Phoenix Peak',
    type: 'wilderness',
    danger_level: 4,
    description: 'Đỉnh núi cao nhất, nơi truyền thuyết kể rằng phượng hoàng từng đậu.',
    description_en: 'The highest peak, where legend says a phoenix once perched.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['flame_hawk', 'fire_elemental', 'phoenix_remnant'],
    loot_table: 'phoenix_tier2',
    event_pool: ['phoenix_feather', 'fire_tribulation', 'ancient_nest'],
    connected_areas: ['lava_tunnels', 'ash_wasteland'],
    is_safe: false,
    cultivation_bonus: 20,
  },
  {
    id: 'ash_wasteland',
    region_id: 'hoa_son',
    name: 'Tro Tàn Hoang Địa',
    name_en: 'Ash Wasteland',
    type: 'wilderness',
    danger_level: 3,
    description: 'Vùng đất bị phủ tro từ núi lửa, nơi các linh hồn bất an lang thang.',
    description_en: 'Land covered in volcanic ash, where restless spirits wander.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.rest,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['ash_wraith', 'ember_zombie', 'cinder_wolf'],
    loot_table: 'ash_tier2',
    event_pool: ['ash_storm', 'buried_treasure', 'wandering_soul'],
    connected_areas: ['flame_gate_city', 'phoenix_peak'],
    is_safe: false,
    cultivation_bonus: 5,
  },
];

const HOA_SON: Region = {
  id: 'hoa_son',
  name: 'Hỏa Sơn',
  name_en: 'Fire Mountain',
  description: 'Dãy núi lửa khổng lồ với nhiệt độ cực cao. Nơi đây có nhiều nguyên liệu hỏa hệ quý hiếm và bí kíp luyện hỏa.',
  description_en: 'A massive volcanic mountain range with extreme temperatures. Contains rare fire materials and flame cultivation techniques.',
  element: 'Hỏa',
  tier: 2,
  recommended_realm: 'LuyệnKhí',
  areas: HOA_SON_AREAS,
  adjacent_regions: ['thanh_van', 'tram_loi'],
  unique_resources: ['Hỏa Tinh', 'Núi Lửa Kim Loại', 'Phượng Vũ'],
};

// ========================================
// REGION 3: HUYỀN THỦY (Mystic Waters) - Tier 3
// ========================================

const HUYEN_THUY_AREAS: Area[] = [
  {
    id: 'pearl_harbor',
    region_id: 'huyen_thuy',
    name: 'Trân Châu Cảng',
    name_en: 'Pearl Harbor',
    type: 'city',
    danger_level: 3,
    description: 'Hải cảng sầm uất nơi buôn bán hải sản và bảo vật dưới nước.',
    description_en: 'A bustling harbor for trading seafood and underwater treasures.',
    available_actions: [COMMON_ACTIONS.rest, COMMON_ACTIONS.travel_area, COMMON_ACTIONS.travel_region],
    enemy_pool: [],
    loot_table: 'harbor_tier3',
    event_pool: ['sea_merchant', 'pirate_sighting', 'mermaid_tale'],
    connected_areas: ['coral_depths', 'dragon_turtle_island'],
    is_safe: true,
    cultivation_bonus: 0,
  },
  {
    id: 'coral_depths',
    region_id: 'huyen_thuy',
    name: 'San Hô Thâm Uyên',
    name_en: 'Coral Depths',
    type: 'wilderness',
    danger_level: 4,
    description: 'Vùng biển sâu với rạn san hô khổng lồ và sinh vật biển kỳ dị.',
    description_en: 'Deep ocean with massive coral reefs and strange sea creatures.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['sea_serpent', 'water_elemental', 'coral_golem', 'giant_octopus'],
    loot_table: 'coral_tier3',
    event_pool: ['sunken_ship', 'pearl_bed', 'underwater_cave'],
    connected_areas: ['pearl_harbor', 'abyssal_trench', 'dragon_turtle_island'],
    is_safe: false,
    cultivation_bonus: 15,
  },
  {
    id: 'dragon_turtle_island',
    region_id: 'huyen_thuy',
    name: 'Long Quy Đảo',
    name_en: 'Dragon Turtle Island',
    type: 'wilderness',
    danger_level: 4,
    description: 'Hòn đảo huyền bí nơi long quy cổ đại từng trú ngụ.',
    description_en: 'A mysterious island where an ancient dragon turtle once resided.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.rest,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['island_crab', 'sea_drake', 'turtle_warrior'],
    loot_table: 'island_tier3',
    event_pool: ['dragon_turtle_blessing', 'island_secret', 'storm_warning'],
    connected_areas: ['pearl_harbor', 'coral_depths'],
    is_safe: false,
    cultivation_bonus: 20,
  },
  {
    id: 'abyssal_trench',
    region_id: 'huyen_thuy',
    name: 'Thâm Uyên Vực',
    name_en: 'Abyssal Trench',
    type: 'dungeon',
    danger_level: 5,
    description: 'Vực sâu không đáy, nơi sinh sống của những sinh vật từ bóng tối.',
    description_en: 'A bottomless trench, home to creatures from the darkness.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['deep_one', 'abyssal_horror', 'void_fish', 'ancient_leviathan'],
    loot_table: 'abyssal_tier3',
    event_pool: ['pressure_shift', 'ancient_ruin', 'deep_whisper'],
    connected_areas: ['coral_depths'],
    is_safe: false,
    cultivation_bonus: 25,
  },
];

const HUYEN_THUY: Region = {
  id: 'huyen_thuy',
  name: 'Huyền Thủy',
  name_en: 'Mystic Waters',
  description: 'Vùng biển huyền bí với những hòn đảo và vực sâu. Nơi ẩn chứa nhiều bí mật của long tộc và các sinh vật biển.',
  description_en: 'Mysterious waters with islands and deep trenches. Hides many secrets of the dragon race and sea creatures.',
  element: 'Thủy',
  tier: 3,
  recommended_realm: 'TrúcCơ',
  areas: HUYEN_THUY_AREAS,
  adjacent_regions: ['thanh_van', 'vong_linh'],
  unique_resources: ['Hải Châu', 'Thủy Tinh', 'Long Lân'],
};

// ========================================
// REGION 4: TRẦM LÔI (Silent Thunder) - Tier 4
// ========================================

const TRAM_LOI_AREAS: Area[] = [
  {
    id: 'thunder_citadel',
    region_id: 'tram_loi',
    name: 'Lôi Đình Thành',
    name_en: 'Thunder Citadel',
    type: 'city',
    danger_level: 4,
    description: 'Thành trì cổ đại được xây bằng kim loại dẫn điện, nơi các tu sĩ lôi hệ tu luyện.',
    description_en: 'An ancient citadel built with conductive metals, where thunder cultivators train.',
    available_actions: [COMMON_ACTIONS.rest, COMMON_ACTIONS.travel_area, COMMON_ACTIONS.travel_region],
    enemy_pool: [],
    loot_table: 'citadel_tier4',
    event_pool: ['lightning_smith', 'thunder_sect_trial', 'ancient_mechanism'],
    connected_areas: ['storm_plains', 'lightning_valley'],
    is_safe: true,
    cultivation_bonus: 0,
  },
  {
    id: 'storm_plains',
    region_id: 'tram_loi',
    name: 'Bão Phong Nguyên',
    name_en: 'Storm Plains',
    type: 'wilderness',
    danger_level: 4,
    description: 'Đồng bằng rộng lớn luôn bị bao phủ bởi bão điện không ngừng.',
    description_en: 'Vast plains constantly covered by endless electrical storms.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['thunder_beast', 'storm_elemental', 'lightning_hawk', 'static_golem'],
    loot_table: 'storm_tier4',
    event_pool: ['lightning_strike', 'storm_shelter', 'thunder_crystal'],
    connected_areas: ['thunder_citadel', 'ruined_observatory', 'lightning_valley'],
    is_safe: false,
    cultivation_bonus: 20,
  },
  {
    id: 'lightning_valley',
    region_id: 'tram_loi',
    name: 'Lôi Điện Cốc',
    name_en: 'Lightning Valley',
    type: 'wilderness',
    danger_level: 5,
    description: 'Thung lũng nơi sét đánh liên tục, được coi là nơi thử thách thiên kiếp.',
    description_en: 'A valley where lightning strikes constantly, considered a tribulation testing ground.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['tribulation_beast', 'lightning_serpent', 'thunder_elemental'],
    loot_table: 'lightning_tier4',
    event_pool: ['tribulation_opportunity', 'lightning_baptism', 'ancient_cultivator_remains'],
    connected_areas: ['thunder_citadel', 'storm_plains'],
    is_safe: false,
    cultivation_bonus: 30,
  },
  {
    id: 'ruined_observatory',
    region_id: 'tram_loi',
    name: 'Cổ Quan Thiên Đài',
    name_en: 'Ruined Observatory',
    type: 'dungeon',
    danger_level: 5,
    description: 'Đài quan sát cổ đại bị bỏ hoang, chứa đựng tri thức của các tu sĩ thời xưa.',
    description_en: 'An abandoned ancient observatory containing knowledge of cultivators from ages past.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['ancient_construct', 'rogue_automaton', 'lightning_guardian'],
    loot_table: 'observatory_tier4',
    event_pool: ['ancient_scroll', 'mechanism_puzzle', 'star_map'],
    connected_areas: ['storm_plains'],
    is_safe: false,
    cultivation_bonus: 25,
  },
];

const TRAM_LOI: Region = {
  id: 'tram_loi',
  name: 'Trầm Lôi',
  name_en: 'Silent Thunder',
  description: 'Vùng đất với bão điện vĩnh cửu và di tích cổ đại. Nơi thử thách thiên kiếp và chứa nhiều kỹ thuật lôi điện.',
  description_en: 'A land of eternal electrical storms and ancient ruins. A place of heavenly tribulation trials and thunder techniques.',
  element: 'Kim',
  tier: 4,
  recommended_realm: 'KếtĐan',
  areas: TRAM_LOI_AREAS,
  adjacent_regions: ['hoa_son', 'vong_linh'],
  unique_resources: ['Lôi Tinh', 'Kim Tinh', 'Cổ Di Vật'],
};

// ========================================
// REGION 5: VỌNG LINH (Spirit Watch) - Tier 5
// ========================================

const VONG_LINH_AREAS: Area[] = [
  {
    id: 'spirit_gate',
    region_id: 'vong_linh',
    name: 'Linh Môn',
    name_en: 'Spirit Gate',
    type: 'city',
    danger_level: 5,
    description: 'Cổng vào vùng đất linh hồn, nơi ranh giới giữa âm và dương mờ nhạt.',
    description_en: 'The gateway to spirit lands, where the boundary between yin and yang fades.',
    available_actions: [COMMON_ACTIONS.rest, COMMON_ACTIONS.travel_area, COMMON_ACTIONS.travel_region],
    enemy_pool: [],
    loot_table: 'spirit_city_tier5',
    event_pool: ['spirit_guide', 'ancestral_vision', 'void_merchant'],
    connected_areas: ['ancestral_tombs', 'soul_river'],
    is_safe: true,
    cultivation_bonus: 0,
  },
  {
    id: 'ancestral_tombs',
    region_id: 'vong_linh',
    name: 'Tổ Mộ',
    name_en: 'Ancestral Tombs',
    type: 'dungeon',
    danger_level: 5,
    description: 'Quần thể lăng mộ của các đại năng thời cổ, nơi an nghỉ và thử thách.',
    description_en: 'Tomb complex of ancient great powers, a place of rest and trials.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['ghost_cultivator', 'tomb_guardian', 'yin_spirit', 'ancestral_remnant'],
    loot_table: 'tomb_tier5',
    event_pool: ['legacy_trial', 'tomb_trap', 'ancestral_blessing'],
    connected_areas: ['spirit_gate', 'void_nexus'],
    is_safe: false,
    cultivation_bonus: 30,
  },
  {
    id: 'soul_river',
    region_id: 'vong_linh',
    name: 'Linh Hồn Hà',
    name_en: 'Soul River',
    type: 'wilderness',
    danger_level: 5,
    description: 'Dòng sông mang theo linh hồn người chết, nơi âm khí tập trung.',
    description_en: 'A river carrying souls of the dead, where yin energy gathers.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.gather,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['soul_devourer', 'river_phantom', 'drowned_cultivator'],
    loot_table: 'soul_river_tier5',
    event_pool: ['soul_ferry', 'river_treasure', 'memory_fragment'],
    connected_areas: ['spirit_gate', 'void_nexus'],
    is_safe: false,
    cultivation_bonus: 25,
  },
  {
    id: 'void_nexus',
    region_id: 'vong_linh',
    name: 'Hư Không Tâm',
    name_en: 'Void Nexus',
    type: 'secret_realm',
    danger_level: 5,
    description: 'Điểm giao cắt giữa các chiều không gian, nơi hư vô trở thành thực tại.',
    description_en: 'The intersection point between dimensions, where void becomes reality.',
    available_actions: [
      COMMON_ACTIONS.explore,
      COMMON_ACTIONS.cultivate,
      COMMON_ACTIONS.hunt,
      COMMON_ACTIONS.travel_area,
    ],
    enemy_pool: ['void_creature', 'dimensional_beast', 'void_emperor_shade'],
    loot_table: 'void_tier5',
    event_pool: ['dimensional_rift', 'void_whisper', 'reality_tear'],
    connected_areas: ['ancestral_tombs', 'soul_river'],
    is_safe: false,
    cultivation_bonus: 40,
  },
];

const VONG_LINH: Region = {
  id: 'vong_linh',
  name: 'Vọng Linh',
  name_en: 'Spirit Watch',
  description: 'Vùng đất của linh hồn và hư vô, nơi cao thủ thời cổ an nghỉ. Chứa đựng di sản mạnh nhất nhưng cũng nguy hiểm nhất.',
  description_en: 'Land of spirits and void, where ancient masters rest. Contains the most powerful legacies but also the greatest dangers.',
  element: 'Thổ',
  tier: 5,
  recommended_realm: 'NguyênAnh',
  areas: VONG_LINH_AREAS,
  adjacent_regions: ['huyen_thuy', 'tram_loi'],
  unique_resources: ['Hồn Ngọc', 'Âm Tinh', 'Hư Không Tinh'],
};

// ========================================
// EXPORTS
// ========================================

export const REGIONS: Record<RegionId, Region> = {
  thanh_van: THANH_VAN,
  hoa_son: HOA_SON,
  huyen_thuy: HUYEN_THUY,
  tram_loi: TRAM_LOI,
  vong_linh: VONG_LINH,
};

export const ALL_AREAS: Area[] = [
  ...THANH_VAN_AREAS,
  ...HOA_SON_AREAS,
  ...HUYEN_THUY_AREAS,
  ...TRAM_LOI_AREAS,
  ...VONG_LINH_AREAS,
];

// Helper functions
export function getRegion(regionId: RegionId): Region {
  return REGIONS[regionId];
}

export function getArea(areaId: string): Area | undefined {
  return ALL_AREAS.find(area => area.id === areaId);
}

export function getAreasInRegion(regionId: RegionId): Area[] {
  return REGIONS[regionId]?.areas || [];
}

export function getAdjacentRegions(regionId: RegionId): Region[] {
  const region = REGIONS[regionId];
  if (!region) return [];
  return region.adjacent_regions.map(id => REGIONS[id]).filter(Boolean);
}

export function getConnectedAreas(areaId: string): Area[] {
  const area = getArea(areaId);
  if (!area) return [];
  return area.connected_areas.map(id => getArea(id)).filter(Boolean) as Area[];
}

export function getStartingArea(): { region: RegionId; area: string } {
  return {
    region: 'thanh_van',
    area: 'thanh_van_village',
  };
}

export function isRegionAccessible(regionId: RegionId, fromRegionId: RegionId): boolean {
  const fromRegion = REGIONS[fromRegionId];
  return fromRegion?.adjacent_regions.includes(regionId) || false;
}
