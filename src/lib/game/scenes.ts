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
];

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
