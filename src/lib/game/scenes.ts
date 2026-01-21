import { Locale, Choice, GameState } from '@/types/game';

export interface SceneTemplate {
  id: string;
  name: string;
  name_en: string;
  category: 'exploration' | 'combat' | 'social' | 'cultivation' | 'rest';
  tier: number; // Difficulty/danger level
  tags: string[];
  weight: number; // Probability weight
  
  // Requirements
  minRealmStage?: number;
  requiredFlags?: string[];
  
  // Generate description for AI
  getPromptContext: (state: GameState, locale: Locale) => string;
  
  // Base choices (AI can modify these)
  getBaseChoices: (locale: Locale) => Choice[];
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'gather_herbs',
    name: 'Hái Linh Thảo',
    name_en: 'Gather Spirit Herbs',
    category: 'exploration',
    tier: 1,
    tags: ['herbs', 'gathering', 'peaceful'],
    weight: 20,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật đang ở ${state.location.place}, phát hiện một khu vực có linh thảo. Họ có thể hái linh thảo để bán hoặc dùng sau này.`;
      }
      return `The character is in ${state.location.place} and discovers an area with spirit herbs. They can gather herbs to sell or use later.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'gather_carefully',
        text: locale === 'vi' ? 'Hái cẩn thận' : 'Gather carefully',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'gather_quickly',
        text: locale === 'vi' ? 'Hái nhanh' : 'Gather quickly',
        cost: { stamina: 2 },
      },
      {
        id: 'ignore',
        text: locale === 'vi' ? 'Bỏ qua' : 'Ignore',
      },
    ],
  },

  {
    id: 'bandit_encounter',
    name: 'Gặp Thổ Phỉ',
    name_en: 'Bandit Encounter',
    category: 'combat',
    tier: 1,
    tags: ['bandits', 'combat', 'danger'],
    weight: 15,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật gặp một nhóm thổ phỉ đang cướp đường. Có ${state.stats.hp}/${state.stats.hp_max} HP và ${state.stats.qi}/${state.stats.qi_max} Linh lực.`;
      }
      return `The character encounters a group of bandits blocking the road. Has ${state.stats.hp}/${state.stats.hp_max} HP and ${state.stats.qi}/${state.stats.qi_max} Qi.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'fight',
        text: locale === 'vi' ? 'Chiến đấu' : 'Fight',
        cost: { stamina: 2 },
      },
      {
        id: 'negotiate',
        text: locale === 'vi' ? 'Thương lượng' : 'Negotiate',
        cost: { silver: 20 },
      },
      {
        id: 'flee',
        text: locale === 'vi' ? 'Chạy trốn' : 'Flee',
        cost: { stamina: 3, time_segments: 1 },
      },
    ],
  },

  {
    id: 'traveling_merchant',
    name: 'Thương Nhân Lang Bạt',
    name_en: 'Traveling Merchant',
    category: 'social',
    tier: 1,
    tags: ['merchant', 'trade', 'peaceful'],
    weight: 12,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật gặp một thương nhân lang bạt. Có ${state.inventory.silver} bạc và ${state.inventory.spirit_stones} linh thạch.`;
      }
      return `The character meets a traveling merchant. Has ${state.inventory.silver} silver and ${state.inventory.spirit_stones} spirit stones.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'browse_goods',
        text: locale === 'vi' ? 'Xem hàng hóa' : 'Browse goods',
      },
      {
        id: 'sell_items',
        text: locale === 'vi' ? 'Bán đồ' : 'Sell items',
      },
      {
        id: 'chat',
        text: locale === 'vi' ? 'Trò chuyện' : 'Chat',
      },
      {
        id: 'leave',
        text: locale === 'vi' ? 'Rời đi' : 'Leave',
      },
    ],
  },

  {
    id: 'sect_recruitment',
    name: 'Tuyển Đệ Tử Tông Môn',
    name_en: 'Sect Recruitment',
    category: 'social',
    tier: 1,
    tags: ['sect', 'opportunity', 'important'],
    weight: 8,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Một tông môn nhỏ đang tuyển đệ tử. Linh căn của nhân vật: ${state.spirit_root.elements.join(', ')} - ${state.spirit_root.grade}.`;
      }
      return `A small sect is recruiting disciples. Character's spirit root: ${state.spirit_root.elements.join(', ')} - ${state.spirit_root.grade}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'apply',
        text: locale === 'vi' ? 'Xin gia nhập' : 'Apply to join',
      },
      {
        id: 'ask_details',
        text: locale === 'vi' ? 'Hỏi thêm chi tiết' : 'Ask for details',
      },
      {
        id: 'decline',
        text: locale === 'vi' ? 'Từ chối' : 'Decline',
      },
    ],
  },

  {
    id: 'mysterious_cave',
    name: 'Hang Động Bí Ẩn',
    name_en: 'Mysterious Cave',
    category: 'exploration',
    tier: 2,
    tags: ['cave', 'danger', 'treasure'],
    weight: 10,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật phát hiện một hang động có khí linh lực kỳ lạ. Có ${state.stats.hp}/${state.stats.hp_max} HP.`;
      }
      return `The character discovers a cave with strange spiritual energy. Has ${state.stats.hp}/${state.stats.hp_max} HP.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'explore_cave',
        text: locale === 'vi' ? 'Thám hiểm hang động' : 'Explore the cave',
        cost: { stamina: 2, time_segments: 1 },
      },
      {
        id: 'investigate_carefully',
        text: locale === 'vi' ? 'Điều tra cẩn thận' : 'Investigate carefully',
        cost: { stamina: 1, time_segments: 2 },
      },
      {
        id: 'mark_location',
        text: locale === 'vi' ? 'Đánh dấu vị trí và quay lại sau' : 'Mark location and return later',
      },
    ],
  },

  {
    id: 'cultivation_session',
    name: 'Tu Luyện',
    name_en: 'Cultivation Session',
    category: 'cultivation',
    tier: 0,
    tags: ['cultivation', 'rest', 'progress'],
    weight: 25,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật tìm nơi yên tĩnh để tu luyện. Tu vi hiện tại: ${state.progress.realm} tầng ${state.progress.realm_stage}. Kinh nghiệm: ${state.progress.cultivation_exp}.`;
      }
      return `The character finds a quiet place to cultivate. Current cultivation: ${state.progress.realm} stage ${state.progress.realm_stage}. Experience: ${state.progress.cultivation_exp}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'cultivate_short',
        text: locale === 'vi' ? 'Tu luyện ngắn (1 giờ)' : 'Short cultivation (1 hour)',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'cultivate_long',
        text: locale === 'vi' ? 'Tu luyện sâu (4 giờ)' : 'Deep cultivation (4 hours)',
        cost: { stamina: 2, time_segments: 2 },
      },
      {
        id: 'meditate',
        text: locale === 'vi' ? 'Thiền định' : 'Meditate',
        cost: { time_segments: 1 },
      },
    ],
  },

  {
    id: 'rest_recovery',
    name: 'Nghỉ Ngơi',
    name_en: 'Rest and Recovery',
    category: 'rest',
    tier: 0,
    tags: ['rest', 'recovery', 'safe'],
    weight: 20,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật cần nghỉ ngơi. HP: ${state.stats.hp}/${state.stats.hp_max}, Stamina: ${state.stats.stamina}/${state.stats.stamina_max}.`;
      }
      return `The character needs rest. HP: ${state.stats.hp}/${state.stats.hp_max}, Stamina: ${state.stats.stamina}/${state.stats.stamina_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'short_rest',
        text: locale === 'vi' ? 'Nghỉ ngơi ngắn' : 'Short rest',
        cost: { time_segments: 1 },
      },
      {
        id: 'long_rest',
        text: locale === 'vi' ? 'Nghỉ ngơi dài (ngủ)' : 'Long rest (sleep)',
        cost: { time_segments: 3 },
      },
      {
        id: 'continue',
        text: locale === 'vi' ? 'Tiếp tục hành trình' : 'Continue journey',
      },
    ],
  },

  {
    id: 'village_trouble',
    name: 'Dân Làng Cầu Cứu',
    name_en: 'Village in Trouble',
    category: 'social',
    tier: 1,
    tags: ['village', 'quest', 'karma'],
    weight: 10,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Một làng gần đó có người dân cầu cứu về vấn đề ma thú hoặc bệnh tật. Nhân quả hiện tại: ${state.karma}.`;
      }
      return `Villagers nearby seek help with demon beasts or illness. Current karma: ${state.karma}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'help_village',
        text: locale === 'vi' ? 'Giúp đỡ dân làng' : 'Help the villagers',
        cost: { stamina: 2, time_segments: 2 },
      },
      {
        id: 'ask_reward',
        text: locale === 'vi' ? 'Hỏi về phần thưởng' : 'Ask about reward',
      },
      {
        id: 'ignore_plea',
        text: locale === 'vi' ? 'Bỏ qua' : 'Ignore their plea',
      },
    ],
  },

  {
    id: 'hunt_demon_beast',
    name: 'Săn Yêu Thú',
    name_en: 'Hunt Demon Beast',
    category: 'combat',
    tier: 2,
    tags: ['beast', 'combat', 'danger', 'loot'],
    weight: 12,
    minRealmStage: 1,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật phát hiện dấu vết của yêu thú. Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage}.`;
      }
      return `The character discovers traces of a demon beast. Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'track_beast',
        text: locale === 'vi' ? 'Theo dấu vết' : 'Track the beast',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'set_trap',
        text: locale === 'vi' ? 'Đặt bẫy' : 'Set a trap',
        cost: { stamina: 2, time_segments: 2 },
      },
      {
        id: 'avoid',
        text: locale === 'vi' ? 'Tránh xa' : 'Avoid',
      },
    ],
  },

  {
    id: 'find_jade_slip',
    name: 'Nhặt Ngọc Giản',
    name_en: 'Find Jade Slip',
    category: 'exploration',
    tier: 1,
    tags: ['treasure', 'knowledge', 'lucky'],
    weight: 8,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật tình cờ phát hiện một ngọc giản cũ. May mắn: ${state.attrs.luck}.`;
      }
      return `The character stumbles upon an old jade slip. Luck: ${state.attrs.luck}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'examine_slip',
        text: locale === 'vi' ? 'Kiểm tra ngọc giản' : 'Examine the jade slip',
        cost: { stamina: 1 },
      },
      {
        id: 'take_and_leave',
        text: locale === 'vi' ? 'Lấy và rời đi' : 'Take it and leave',
      },
      {
        id: 'leave_it',
        text: locale === 'vi' ? 'Để lại' : 'Leave it',
      },
    ],
  },

  // === NEW SCENE TEMPLATES FOR VARIETY ===
  
  {
    id: 'ancient_ruins',
    name: 'Di Tích Cổ Đại',
    name_en: 'Ancient Ruins',
    category: 'exploration',
    tier: 2,
    tags: ['ruins', 'mystery', 'danger', 'treasure'],
    weight: 8,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật phát hiện di tích của một tông môn cổ đại đã thất truyền hàng ngàn năm. Không khí u ám, có thể có cơ duyên nhưng cũng nhiều nguy hiểm. Linh lực: ${state.stats.qi}/${state.stats.qi_max}.`;
      }
      return `The character discovers ruins of an ancient sect lost for thousands of years. The atmosphere is ominous - potential treasures but also dangers lurk. Qi: ${state.stats.qi}/${state.stats.qi_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'enter_ruins',
        text: locale === 'vi' ? 'Vào khám phá di tích' : 'Enter and explore ruins',
        cost: { stamina: 3, time_segments: 2 },
      },
      {
        id: 'search_perimeter',
        text: locale === 'vi' ? 'Tìm kiếm xung quanh' : 'Search the perimeter',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'mark_and_leave',
        text: locale === 'vi' ? 'Đánh dấu và quay lại sau' : 'Mark location and leave',
      },
    ],
  },

  {
    id: 'alchemy_opportunity',
    name: 'Cơ Hội Luyện Đan',
    name_en: 'Alchemy Opportunity',
    category: 'cultivation',
    tier: 1,
    tags: ['alchemy', 'crafting', 'learning'],
    weight: 10,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật tìm thấy một lò đan cổ còn hoạt động được, cùng với một số nguyên liệu. Trí tuệ: ${state.attrs.int}. Đây là cơ hội học luyện đan.`;
      }
      return `The character finds an ancient but functional alchemy furnace with some ingredients nearby. Intelligence: ${state.attrs.int}. This is a chance to learn alchemy.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'try_alchemy',
        text: locale === 'vi' ? 'Thử luyện đan' : 'Try alchemy',
        cost: { stamina: 2, time_segments: 2 },
      },
      {
        id: 'study_furnace',
        text: locale === 'vi' ? 'Nghiên cứu lò đan' : 'Study the furnace',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'take_ingredients',
        text: locale === 'vi' ? 'Lấy nguyên liệu và đi' : 'Take ingredients and leave',
      },
    ],
  },

  {
    id: 'fellow_cultivator',
    name: 'Gặp Đồng Đạo',
    name_en: 'Fellow Cultivator',
    category: 'social',
    tier: 1,
    tags: ['cultivator', 'social', 'learning', 'trade'],
    weight: 12,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật gặp một tu sĩ khác đang nghỉ ngơi bên đường. Người này có vẻ thân thiện và sẵn sàng trò chuyện. Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage}.`;
      }
      return `The character meets another cultivator resting by the road. They seem friendly and open to conversation. Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'exchange_knowledge',
        text: locale === 'vi' ? 'Trao đổi kinh nghiệm tu luyện' : 'Exchange cultivation knowledge',
        cost: { time_segments: 1 },
      },
      {
        id: 'spar',
        text: locale === 'vi' ? 'Xin tỉ thí qua đường' : 'Request a friendly spar',
        cost: { stamina: 2 },
      },
      {
        id: 'trade_items',
        text: locale === 'vi' ? 'Trao đổi vật phẩm' : 'Trade items',
      },
      {
        id: 'continue_alone',
        text: locale === 'vi' ? 'Tiếp tục một mình' : 'Continue alone',
      },
    ],
  },

  {
    id: 'spirit_spring',
    name: 'Linh Tuyền',
    name_en: 'Spirit Spring',
    category: 'cultivation',
    tier: 2,
    tags: ['spring', 'cultivation', 'rare', 'healing'],
    weight: 6,
    minRealmStage: 1,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật phát hiện một suối linh tuyền hiếm có, nước suối chứa linh khí thuần khiết. Đây là cơ duyên tốt để tu luyện hoặc hồi phục. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
      }
      return `The character discovers a rare spirit spring with pure spiritual energy in its waters. An excellent opportunity for cultivation or recovery. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'bathe_cultivate',
        text: locale === 'vi' ? 'Tắm và tu luyện trong suối' : 'Bathe and cultivate in the spring',
        cost: { stamina: 1, time_segments: 2 },
      },
      {
        id: 'drink_water',
        text: locale === 'vi' ? 'Uống nước suối' : 'Drink the spring water',
      },
      {
        id: 'collect_water',
        text: locale === 'vi' ? 'Thu thập nước suối' : 'Collect spring water',
        cost: { time_segments: 1 },
      },
    ],
  },

  {
    id: 'weather_phenomenon',
    name: 'Hiện Tượng Kỳ Lạ',
    name_en: 'Strange Weather Phenomenon',
    category: 'exploration',
    tier: 1,
    tags: ['weather', 'mystery', 'qi', 'opportunity'],
    weight: 7,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Bầu trời đột nhiên có hiện tượng kỳ lạ - có thể là dấu hiệu của bảo vật xuất thế hoặc ai đó đang đột phá cảnh giới. Vị trí: ${state.location.place}.`;
      }
      return `The sky suddenly shows a strange phenomenon - possibly a sign of a treasure appearing or someone breaking through to a new realm. Location: ${state.location.place}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'investigate',
        text: locale === 'vi' ? 'Đi điều tra' : 'Investigate',
        cost: { stamina: 2, time_segments: 1 },
      },
      {
        id: 'observe_safely',
        text: locale === 'vi' ? 'Quan sát từ xa' : 'Observe from a distance',
        cost: { time_segments: 1 },
      },
      {
        id: 'hide',
        text: locale === 'vi' ? 'Ẩn náu' : 'Hide',
      },
    ],
  },

  {
    id: 'night_market',
    name: 'Chợ Đêm Tu Sĩ',
    name_en: 'Cultivator Night Market',
    category: 'social',
    tier: 1,
    tags: ['market', 'trade', 'social', 'items'],
    weight: 9,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật tình cờ gặp một chợ đêm dành cho tu sĩ, nơi buôn bán nhiều vật phẩm quý hiếm. Tài sản: ${state.inventory.silver} bạc, ${state.inventory.spirit_stones} linh thạch.`;
      }
      return `The character stumbles upon a secret night market for cultivators, selling rare items. Resources: ${state.inventory.silver} silver, ${state.inventory.spirit_stones} spirit stones.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'browse_weapons',
        text: locale === 'vi' ? 'Xem vũ khí' : 'Browse weapons',
      },
      {
        id: 'browse_pills',
        text: locale === 'vi' ? 'Xem đan dược' : 'Browse pills',
      },
      {
        id: 'browse_techniques',
        text: locale === 'vi' ? 'Tìm công pháp' : 'Look for techniques',
      },
      {
        id: 'gather_info',
        text: locale === 'vi' ? 'Thu thập tin tức' : 'Gather information',
        cost: { time_segments: 1 },
      },
    ],
  },

  {
    id: 'wounded_cultivator',
    name: 'Tu Sĩ Bị Thương',
    name_en: 'Wounded Cultivator',
    category: 'social',
    tier: 1,
    tags: ['wounded', 'karma', 'choice', 'danger'],
    weight: 8,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật gặp một tu sĩ bị thương nặng đang cầu cứu. Có thể là cạm bẫy hoặc cơ hội tích đức. Nhân quả: ${state.karma}. HP của người đó rất thấp.`;
      }
      return `The character encounters a severely wounded cultivator begging for help. Could be a trap or an opportunity for good karma. Karma: ${state.karma}. Their HP is very low.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'help_immediately',
        text: locale === 'vi' ? 'Cứu giúp ngay' : 'Help immediately',
        cost: { stamina: 1 },
      },
      {
        id: 'examine_first',
        text: locale === 'vi' ? 'Quan sát trước' : 'Examine situation first',
      },
      {
        id: 'rob_them',
        text: locale === 'vi' ? 'Cướp đồ' : 'Rob them',
      },
      {
        id: 'ignore',
        text: locale === 'vi' ? 'Bỏ đi' : 'Ignore and leave',
      },
    ],
  },

  {
    id: 'legacy_trial',
    name: 'Thử Thách Truyền Thừa',
    name_en: 'Legacy Trial',
    category: 'exploration',
    tier: 3,
    tags: ['trial', 'legacy', 'danger', 'great_reward'],
    weight: 5,
    minRealmStage: 2,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật vô tình kích hoạt một trận pháp cổ - đây là thử thách truyền thừa của một vị tiền bối đã ngã. Nếu vượt qua sẽ nhận được cơ duyên lớn. Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage}. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
      }
      return `The character accidentally activates an ancient formation - this is a legacy trial left by a fallen senior. Passing it will grant great rewards. Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage}. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'accept_trial',
        text: locale === 'vi' ? 'Chấp nhận thử thách' : 'Accept the trial',
        cost: { stamina: 3 },
      },
      {
        id: 'refuse_trial',
        text: locale === 'vi' ? 'Từ chối thử thách' : 'Refuse the trial',
      },
    ],
  },

  {
    id: 'poisonous_swamp',
    name: 'Đầm Lầy Độc',
    name_en: 'Poisonous Swamp',
    category: 'exploration',
    tier: 2,
    tags: ['swamp', 'danger', 'herbs', 'poison'],
    weight: 7,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `Nhân vật đến một vùng đầm lầy độc. Nơi đây nguy hiểm nhưng có nhiều dược liệu quý hiếm mọc trong môi trường độc hại. Stamina: ${state.stats.stamina}/${state.stats.stamina_max}.`;
      }
      return `The character arrives at a poisonous swamp. Dangerous, but rare medicinal herbs grow in this toxic environment. Stamina: ${state.stats.stamina}/${state.stats.stamina_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'venture_in',
        text: locale === 'vi' ? 'Mạo hiểm vào trong' : 'Venture inside',
        cost: { stamina: 3, time_segments: 1 },
      },
      {
        id: 'search_edge',
        text: locale === 'vi' ? 'Tìm kiếm ở rìa' : 'Search the edges',
        cost: { stamina: 1, time_segments: 1 },
      },
      {
        id: 'go_around',
        text: locale === 'vi' ? 'Đi vòng' : 'Go around',
        cost: { time_segments: 2 },
      },
    ],
  },

  {
    id: 'breakthrough_location',
    name: 'Địa Điểm Đột Phá',
    name_en: 'Breakthrough Location',
    category: 'cultivation',
    tier: 2,
    tags: ['breakthrough', 'cultivation', 'progress'],
    weight: 6,
    minRealmStage: 1,
    getPromptContext: (state, locale) => {
      const expNeeded = getExpForBreakthrough(state.progress.realm_stage);
      if (locale === 'vi') {
        return `Nhân vật tìm thấy nơi linh khí dồi dào, rất thích hợp để tu luyện đột phá. Kinh nghiệm hiện tại: ${state.progress.cultivation_exp}/${expNeeded}. Tu vi: ${state.progress.realm} tầng ${state.progress.realm_stage}.`;
      }
      return `The character finds a place rich with spiritual energy, perfect for breakthrough cultivation. Current exp: ${state.progress.cultivation_exp}/${expNeeded}. Cultivation: ${state.progress.realm} stage ${state.progress.realm_stage}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'attempt_breakthrough',
        text: locale === 'vi' ? 'Thử đột phá' : 'Attempt breakthrough',
        cost: { stamina: 4, qi: 20, time_segments: 3 },
      },
      {
        id: 'cultivate_normally',
        text: locale === 'vi' ? 'Tu luyện bình thường' : 'Cultivate normally',
        cost: { stamina: 2, time_segments: 2 },
      },
      {
        id: 'rest_first',
        text: locale === 'vi' ? 'Nghỉ ngơi trước' : 'Rest first',
        cost: { time_segments: 1 },
      },
    ],
  },

  // ===== SECT-RELATED SCENES =====
  {
    id: 'sect_mission_board',
    name: 'Bảng Nhiệm Vụ Tông Môn',
    name_en: 'Sect Mission Board',
    category: 'social',
    tier: 1,
    tags: ['sect', 'mission', 'reward'],
    weight: 12,
    getPromptContext: (state, locale) => {
      const hasSect = !!state.sect_membership;
      if (locale === 'vi') {
        if (hasSect) {
          return `Nhân vật đứng trước bảng nhiệm vụ của ${state.sect_membership?.sect.name}. Vị thế: ${state.sect_membership?.rank}. Đóng góp: ${state.sect_membership?.contribution}.`;
        }
        return `Nhân vật thấy bảng nhiệm vụ của một tông môn, nhưng chưa phải là đệ tử nên không thể nhận nhiệm vụ.`;
      }
      if (hasSect) {
        return `The character stands before ${state.sect_membership?.sect.name_en}'s mission board. Rank: ${state.sect_membership?.rank}. Contribution: ${state.sect_membership?.contribution}.`;
      }
      return `The character sees a sect's mission board, but cannot accept missions as they are not a disciple.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'accept_easy_mission',
        text: locale === 'vi' ? 'Nhận nhiệm vụ dễ' : 'Accept easy mission',
        cost: { stamina: 1 },
      },
      {
        id: 'accept_medium_mission',
        text: locale === 'vi' ? 'Nhận nhiệm vụ trung bình' : 'Accept medium mission',
        cost: { stamina: 2 },
      },
      {
        id: 'accept_hard_mission',
        text: locale === 'vi' ? 'Nhận nhiệm vụ khó' : 'Accept hard mission',
        cost: { stamina: 3 },
      },
      {
        id: 'leave',
        text: locale === 'vi' ? 'Rời đi' : 'Leave',
      },
    ],
  },

  {
    id: 'sect_treasury',
    name: 'Tàng Kinh Các',
    name_en: 'Sect Treasury',
    category: 'social',
    tier: 2,
    tags: ['sect', 'treasure', 'technique'],
    weight: 8,
    getPromptContext: (state, locale) => {
      const hasSect = !!state.sect_membership;
      if (locale === 'vi') {
        if (hasSect) {
          const hasAccess = state.sect_membership?.benefits.technique_access;
          return `Nhân vật đến Tàng Kinh Các của ${state.sect_membership?.sect.name}. ${hasAccess ? 'Với tư cách ' + state.sect_membership?.rank + ', ngươi có thể tham khảo các bí kíp.' : 'Tư cách chưa đủ để vào khu vực cấm.'}`;
        }
        return `Nhân vật thấy Tàng Kinh Các của một tông môn từ xa, nhưng không phải đệ tử nên không thể vào.`;
      }
      if (hasSect) {
        const hasAccess = state.sect_membership?.benefits.technique_access;
        return `The character arrives at ${state.sect_membership?.sect.name_en}'s Scripture Pavilion. ${hasAccess ? 'As a ' + state.sect_membership?.rank + ', you may browse the techniques.' : 'Your rank is insufficient to enter the restricted area.'}`;
      }
      return `The character sees a sect's Scripture Pavilion from afar, but cannot enter as they are not a disciple.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'browse_techniques',
        text: locale === 'vi' ? 'Xem các công pháp' : 'Browse techniques',
        cost: { time_segments: 1 },
      },
      {
        id: 'study_technique',
        text: locale === 'vi' ? 'Học một công pháp' : 'Study a technique',
        cost: { stamina: 3, time_segments: 2 },
      },
      {
        id: 'leave',
        text: locale === 'vi' ? 'Rời đi' : 'Leave',
      },
    ],
  },

  {
    id: 'sect_elder_meeting',
    name: 'Gặp Trưởng Lão',
    name_en: 'Meeting with Elder',
    category: 'social',
    tier: 2,
    tags: ['sect', 'npc', 'important'],
    weight: 6,
    getPromptContext: (state, locale) => {
      const hasSect = !!state.sect_membership;
      if (locale === 'vi') {
        if (hasSect) {
          return `Một trưởng lão của ${state.sect_membership?.sect.name} muốn gặp nhân vật. Thanh danh hiện tại: ${state.sect_membership?.reputation}/100.`;
        }
        return `Một vị trưởng lão của tông môn gần đây chú ý đến nhân vật và muốn gặp mặt.`;
      }
      if (hasSect) {
        return `An elder of ${state.sect_membership?.sect.name_en} wishes to meet the character. Current reputation: ${state.sect_membership?.reputation}/100.`;
      }
      return `An elder from a nearby sect has noticed the character and wishes to meet.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'meet_respectfully',
        text: locale === 'vi' ? 'Gặp với thái độ kính cẩn' : 'Meet respectfully',
      },
      {
        id: 'ask_for_guidance',
        text: locale === 'vi' ? 'Xin chỉ điểm' : 'Ask for guidance',
        cost: { stamina: 1 },
      },
      {
        id: 'politely_decline',
        text: locale === 'vi' ? 'Khéo léo từ chối' : 'Politely decline',
      },
    ],
  },

  {
    id: 'sect_competition',
    name: 'Tỷ Võ Đại Hội',
    name_en: 'Sect Competition',
    category: 'combat',
    tier: 2,
    tags: ['sect', 'combat', 'competition', 'reward'],
    weight: 5,
    minRealmStage: 1,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        return `${state.sect_membership ? state.sect_membership.sect.name : 'Một tông môn'} đang tổ chức Tỷ Võ Đại Hội. Các đệ tử tranh đấu để thể hiện thực lực. HP: ${state.stats.hp}/${state.stats.hp_max}, Qi: ${state.stats.qi}/${state.stats.qi_max}.`;
      }
      return `${state.sect_membership ? state.sect_membership.sect.name_en : 'A sect'} is holding a martial arts competition. Disciples compete to prove their strength. HP: ${state.stats.hp}/${state.stats.hp_max}, Qi: ${state.stats.qi}/${state.stats.qi_max}.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'participate',
        text: locale === 'vi' ? 'Tham gia thi đấu' : 'Participate',
        cost: { stamina: 3 },
      },
      {
        id: 'observe',
        text: locale === 'vi' ? 'Quan sát học hỏi' : 'Observe and learn',
        cost: { time_segments: 1 },
      },
      {
        id: 'leave',
        text: locale === 'vi' ? 'Rời đi' : 'Leave',
      },
    ],
  },

  {
    id: 'sect_resource_distribution',
    name: 'Phát Tài Nguyên Tông Môn',
    name_en: 'Sect Resource Distribution',
    category: 'social',
    tier: 1,
    tags: ['sect', 'resources', 'reward'],
    weight: 7,
    getPromptContext: (state, locale) => {
      const hasSect = !!state.sect_membership;
      if (locale === 'vi') {
        if (hasSect) {
          const hasAccess = state.sect_membership?.benefits.resource_access;
          return `Đến ngày phát tài nguyên hàng tháng của ${state.sect_membership?.sect.name}. Vị thế: ${state.sect_membership?.rank}. ${hasAccess ? 'Ngươi đủ tư cách nhận tài nguyên.' : 'Ngoại môn đệ tử chỉ nhận được phần nhỏ.'}`;
        }
        return `Nhân vật thấy các đệ tử của một tông môn xếp hàng nhận tài nguyên hàng tháng.`;
      }
      if (hasSect) {
        const hasAccess = state.sect_membership?.benefits.resource_access;
        return `It's the monthly resource distribution day at ${state.sect_membership?.sect.name_en}. Rank: ${state.sect_membership?.rank}. ${hasAccess ? 'You qualify for full resources.' : 'Outer disciples receive only a small portion.'}`;
      }
      return `The character sees disciples of a sect lining up for monthly resource distribution.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'collect_resources',
        text: locale === 'vi' ? 'Nhận tài nguyên' : 'Collect resources',
      },
      {
        id: 'request_extra',
        text: locale === 'vi' ? 'Xin thêm (dùng đóng góp)' : 'Request extra (use contribution)',
        cost: { time_segments: 1 },
      },
      {
        id: 'skip',
        text: locale === 'vi' ? 'Bỏ qua' : 'Skip',
      },
    ],
  },

  {
    id: 'rival_sect_encounter',
    name: 'Gặp Đệ Tử Địch Môn',
    name_en: 'Rival Sect Encounter',
    category: 'combat',
    tier: 2,
    tags: ['sect', 'combat', 'rival', 'danger'],
    weight: 8,
    getPromptContext: (state, locale) => {
      if (locale === 'vi') {
        if (state.sect_membership) {
          return `Nhân vật gặp đệ tử của tông môn đối địch với ${state.sect_membership.sect.name}. Không khí căng thẳng. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
        }
        return `Nhân vật vô tình chứng kiến cuộc xung đột giữa đệ tử hai tông môn đối địch.`;
      }
      if (state.sect_membership) {
        return `The character encounters disciples from a sect rival to ${state.sect_membership.sect.name_en}. The atmosphere is tense. HP: ${state.stats.hp}/${state.stats.hp_max}.`;
      }
      return `The character accidentally witnesses a conflict between disciples of two rival sects.`;
    },
    getBaseChoices: (locale) => [
      {
        id: 'confront',
        text: locale === 'vi' ? 'Đối đầu' : 'Confront',
        cost: { stamina: 2 },
      },
      {
        id: 'avoid',
        text: locale === 'vi' ? 'Tránh né' : 'Avoid',
        cost: { stamina: 1 },
      },
      {
        id: 'negotiate',
        text: locale === 'vi' ? 'Thương lượng' : 'Negotiate',
      },
    ],
  },
];

/**
 * Helper function to get exp needed for breakthrough
 */
function getExpForBreakthrough(realmStage: number): number {
  const expTable = [100, 200, 400, 800, 1600];
  return expTable[Math.min(realmStage, expTable.length - 1)];
}

/**
 * Get applicable templates for current state
 */
export function getApplicableTemplates(state: GameState): SceneTemplate[] {
  return SCENE_TEMPLATES.filter((template) => {
    // Check realm stage requirement
    if (
      template.minRealmStage !== undefined &&
      state.progress.realm_stage < template.minRealmStage
    ) {
      return false;
    }

    // Check required flags
    if (template.requiredFlags) {
      for (const flag of template.requiredFlags) {
        if (!state.flags[flag]) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Select weighted random template
 */
export function selectRandomTemplate(
  templates: SceneTemplate[],
  rng: { random(): number }
): SceneTemplate | null {
  if (templates.length === 0) return null;

  const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
  let roll = rng.random() * totalWeight;

  for (const template of templates) {
    roll -= template.weight;
    if (roll <= 0) {
      return template;
    }
  }

  return templates[templates.length - 1];
}
