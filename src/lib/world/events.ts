/**
 * Random Event Definitions for the Xianxia World
 * Events trigger during exploration, travel, cultivation, and other activities
 */

import { RandomEvent, EventChoice, EventOutcome } from '@/types/world';

// ========================================
// EXPLORATION EVENTS (40% chance during explore)
// ========================================

const EXPLORATION_EVENTS: RandomEvent[] = [
  // COMMON EVENTS
  {
    id: 'resource_discovery',
    name: 'Phát hiện tài nguyên',
    name_en: 'Resource Discovery',
    trigger: 'exploration',
    rarity: 'common',
    weight: 30,
    narrative: 'Trong lúc khám phá, ngươi phát hiện một mảng dược liệu hoang dã mọc đầy.',
    narrative_en: 'While exploring, you discover a patch of wild medicinal herbs growing abundantly.',
    choices: [
      {
        id: 'gather_all',
        text: 'Thu hoạch tất cả',
        text_en: 'Harvest everything',
        outcomes: [
          {
            id: 'success',
            narrative: 'Ngươi cẩn thận thu hoạch dược liệu.',
            narrative_en: 'You carefully harvest the herbs.',
            effects: [
              { field: 'stats.stamina', operation: 'subtract', value: 5 },
            ],
            items: ['spirit_herb', 'spirit_herb', 'medicinal_grass'],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'gather_some',
        text: 'Thu hoạch một phần, để lại cho tái sinh',
        text_en: 'Harvest some, leave rest to regrow',
        outcomes: [
          {
            id: 'karma_bonus',
            narrative: 'Ngươi thu hoạch có chừng mực, để lại cho thiên nhiên tái sinh. Karma +5.',
            narrative_en: 'You harvest moderately, leaving nature to regenerate. Karma +5.',
            effects: [
              { field: 'karma', operation: 'add', value: 5 },
            ],
            items: ['spirit_herb'],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'hidden_cache',
    name: 'Kho báu ẩn',
    name_en: 'Hidden Cache',
    trigger: 'exploration',
    rarity: 'uncommon',
    weight: 15,
    narrative: 'Ngươi tìm thấy một hang động nhỏ với dấu vết của tu sĩ đã rời đi từ lâu. Bên trong có một chiếc rương cũ.',
    narrative_en: 'You find a small cave with traces of a cultivator long gone. Inside is an old chest.',
    choices: [
      {
        id: 'open_chest',
        text: 'Mở rương',
        text_en: 'Open the chest',
        outcomes: [
          {
            id: 'treasure',
            narrative: 'Rương chứa một số vật phẩm có giá trị!',
            narrative_en: 'The chest contains some valuable items!',
            effects: [
              { field: 'inventory.silver', operation: 'add', value: 100 },
            ],
            items: ['low_grade_pill'],
          },
          {
            id: 'trap',
            narrative: 'Rương có bẫy! Ngươi bị thương nhẹ.',
            narrative_en: 'The chest was trapped! You suffer minor injuries.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 15 },
              { field: 'inventory.silver', operation: 'add', value: 50 },
            ],
          },
        ],
        outcome_weights: [70, 30],
      },
      {
        id: 'leave_alone',
        text: 'Không động đến',
        text_en: 'Leave it alone',
        outcomes: [
          {
            id: 'caution',
            narrative: 'Ngươi quyết định không mạo hiểm và rời đi.',
            narrative_en: 'You decide not to risk it and leave.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'wounded_cultivator',
    name: 'Tu sĩ bị thương',
    name_en: 'Wounded Cultivator',
    trigger: 'exploration',
    rarity: 'uncommon',
    weight: 12,
    narrative: 'Ngươi tìm thấy một tu sĩ bị thương nặng dựa vào gốc cây, hơi thở yếu ớt.',
    narrative_en: 'You find a heavily wounded cultivator leaning against a tree, barely breathing.',
    choices: [
      {
        id: 'help',
        text: 'Giúp đỡ họ',
        text_en: 'Help them',
        requirements: {
          item: 'healing_pill',
        },
        outcomes: [
          {
            id: 'grateful',
            narrative: 'Tu sĩ hồi phục và biết ơn ngươi. Họ tặng ngươi một vật phẩm quý.',
            narrative_en: 'The cultivator recovers and is grateful. They gift you a valuable item.',
            effects: [
              { field: 'karma', operation: 'add', value: 10 },
              { field: 'reputation', operation: 'add', value: 5 },
            ],
            items: ['cultivation_manual_basic'],
            remove_items: ['healing_pill'],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'ignore',
        text: 'Bỏ qua',
        text_en: 'Ignore them',
        outcomes: [
          {
            id: 'pass_by',
            narrative: 'Ngươi lạnh lùng bước qua. Trong thế giới tu tiên, đây là chuyện thường.',
            narrative_en: 'You coldly walk past. In the cultivation world, this is common.',
            effects: [
              { field: 'karma', operation: 'subtract', value: 5 },
            ],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'rob',
        text: 'Lục soát túi họ',
        text_en: 'Search their belongings',
        outcomes: [
          {
            id: 'loot',
            narrative: 'Ngươi lấy đi những gì họ có. Karma giảm mạnh.',
            narrative_en: 'You take what they have. Karma drops significantly.',
            effects: [
              { field: 'karma', operation: 'subtract', value: 20 },
              { field: 'inventory.silver', operation: 'add', value: 80 },
            ],
            items: ['spirit_stone'],
          },
          {
            id: 'revenge',
            narrative: 'Tu sĩ bất ngờ tỉnh dậy và tấn công ngươi!',
            narrative_en: 'The cultivator suddenly wakes and attacks you!',
            effects: [
              { field: 'karma', operation: 'subtract', value: 15 },
            ],
            trigger_combat: 'wounded_cultivator_revenge',
          },
        ],
        outcome_weights: [60, 40],
      },
    ],
  },
  {
    id: 'ancient_formation',
    name: 'Trận pháp cổ đại',
    name_en: 'Ancient Formation',
    trigger: 'exploration',
    rarity: 'rare',
    weight: 5,
    narrative: 'Ngươi phát hiện một trận pháp cổ đại khắc trên đá. Nó dường như đang bảo vệ điều gì đó.',
    narrative_en: 'You discover an ancient formation carved into stone. It seems to be protecting something.',
    choices: [
      {
        id: 'study',
        text: 'Nghiên cứu trận pháp',
        text_en: 'Study the formation',
        requirements: {
          stat: { key: 'attrs.int', min: 15 },
        },
        outcomes: [
          {
            id: 'breakthrough',
            narrative: 'Ngươi lĩnh ngộ được một phần bí mật của trận pháp!',
            narrative_en: 'You comprehend part of the formation\'s secrets!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 50 },
            ],
            items: ['formation_fragment'],
          },
          {
            id: 'backlash',
            narrative: 'Trận pháp phản ứng và gây tổn thương cho ngươi!',
            narrative_en: 'The formation reacts and damages you!',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 30 },
              { field: 'stats.qi', operation: 'subtract', value: 20 },
            ],
          },
        ],
        outcome_weights: [60, 40],
      },
      {
        id: 'force_break',
        text: 'Cố phá vỡ trận pháp',
        text_en: 'Try to break the formation',
        requirements: {
          stat: { key: 'attrs.str', min: 20 },
        },
        outcomes: [
          {
            id: 'success',
            narrative: 'Ngươi phá vỡ trận pháp và lấy được bảo vật bên trong!',
            narrative_en: 'You break the formation and obtain the treasure within!',
            effects: [],
            items: ['rare_treasure'],
          },
          {
            id: 'explosion',
            narrative: 'Trận pháp nổ tung! Ngươi bị thương nặng.',
            narrative_en: 'The formation explodes! You are severely injured.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 50 },
            ],
          },
        ],
        outcome_weights: [40, 60],
      },
      {
        id: 'leave',
        text: 'Rời đi',
        text_en: 'Leave',
        outcomes: [
          {
            id: 'safe',
            narrative: 'Ngươi quyết định không mạo hiểm.',
            narrative_en: 'You decide not to risk it.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'legacy_inheritance',
    name: 'Di sản truyền thừa',
    name_en: 'Legacy Inheritance',
    trigger: 'exploration',
    rarity: 'legendary',
    weight: 1,
    realm_requirement: 'LuyệnKhí',
    narrative: 'Một tia sáng dẫn ngươi đến một hang động bí mật. Bên trong, linh hồn của một đại năng cổ đại đang chờ đợi người kế thừa.',
    narrative_en: 'A beam of light leads you to a secret cave. Inside, the spirit of an ancient master awaits an inheritor.',
    choices: [
      {
        id: 'accept',
        text: 'Chấp nhận thử thách kế thừa',
        text_en: 'Accept the inheritance trial',
        outcomes: [
          {
            id: 'success',
            narrative: 'Ngươi vượt qua thử thách và nhận được truyền thừa của đại năng!',
            narrative_en: 'You pass the trial and receive the master\'s inheritance!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 200 },
            ],
            items: ['legendary_technique'],
            set_flags: ['received_legacy'],
          },
          {
            id: 'failure',
            narrative: 'Ngươi không đủ tư chất. Linh hồn thất vọng rời đi.',
            narrative_en: 'You lack the aptitude. The spirit leaves in disappointment.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 20 },
            ],
          },
        ],
        outcome_weights: [30, 70],
      },
      {
        id: 'decline',
        text: 'Từ chối',
        text_en: 'Decline',
        outcomes: [
          {
            id: 'respect',
            narrative: 'Linh hồn tôn trọng quyết định của ngươi và ban tặng một phần nhỏ.',
            narrative_en: 'The spirit respects your decision and grants a small blessing.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 30 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
    excludes_flags: ['received_legacy'],
  },
];

// ========================================
// TRAVEL EVENTS (25% chance when traveling)
// ========================================

const TRAVEL_EVENTS: RandomEvent[] = [
  {
    id: 'bandit_ambush',
    name: 'Phục kích cướp',
    name_en: 'Bandit Ambush',
    trigger: 'travel',
    rarity: 'common',
    weight: 25,
    narrative: 'Một nhóm cướp xuất hiện từ bóng tối, chặn đường ngươi!',
    narrative_en: 'A group of bandits emerge from the shadows, blocking your path!',
    choices: [
      {
        id: 'fight',
        text: 'Chiến đấu',
        text_en: 'Fight',
        outcomes: [
          {
            id: 'combat',
            narrative: 'Ngươi quyết định chiến đấu!',
            narrative_en: 'You decide to fight!',
            effects: [],
            trigger_combat: 'bandit_leader',
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'pay_toll',
        text: 'Trả tiền mãi lộ (50 bạc)',
        text_en: 'Pay toll (50 silver)',
        requirements: {
          stat: { key: 'inventory.silver', min: 50 },
        },
        outcomes: [
          {
            id: 'pass',
            narrative: 'Bọn cướp nhận tiền và để ngươi đi.',
            narrative_en: 'The bandits take the money and let you pass.',
            effects: [
              { field: 'inventory.silver', operation: 'subtract', value: 50 },
            ],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'intimidate',
        text: 'Dọa nạt chúng',
        text_en: 'Intimidate them',
        requirements: {
          realm: 'TrúcCơ',
        },
        outcomes: [
          {
            id: 'flee',
            narrative: 'Cảm nhận tu vi của ngươi, bọn cướp hoảng sợ bỏ chạy!',
            narrative_en: 'Sensing your cultivation, the bandits flee in terror!',
            effects: [
              { field: 'reputation', operation: 'add', value: 5 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'merchant_caravan',
    name: 'Đoàn thương nhân',
    name_en: 'Merchant Caravan',
    trigger: 'travel',
    rarity: 'common',
    weight: 20,
    narrative: 'Ngươi gặp một đoàn thương nhân đang nghỉ ngơi bên đường.',
    narrative_en: 'You encounter a merchant caravan resting by the road.',
    choices: [
      {
        id: 'trade',
        text: 'Xem hàng hóa',
        text_en: 'Browse their goods',
        outcomes: [
          {
            id: 'good_deals',
            narrative: 'Thương nhân có một số vật phẩm thú vị!',
            narrative_en: 'The merchants have some interesting items!',
            effects: [],
            // This would typically trigger a shop interface
            set_flags: ['merchant_encounter'],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'chat',
        text: 'Trò chuyện',
        text_en: 'Chat with them',
        outcomes: [
          {
            id: 'rumor',
            narrative: 'Thương nhân chia sẻ tin đồn về một bí cảnh gần đây.',
            narrative_en: 'The merchants share rumors about a nearby secret realm.',
            effects: [],
            unlock_area: 'hidden_cave',
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'continue',
        text: 'Tiếp tục hành trình',
        text_en: 'Continue journey',
        outcomes: [
          {
            id: 'pass',
            narrative: 'Ngươi chào họ và tiếp tục đi.',
            narrative_en: 'You greet them and continue on.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'weather_event',
    name: 'Thời tiết khắc nghiệt',
    name_en: 'Harsh Weather',
    trigger: 'travel',
    rarity: 'uncommon',
    weight: 15,
    narrative: 'Bất ngờ bão tố kéo đến, mưa như trút nước và gió mạnh!',
    narrative_en: 'A sudden storm arrives, with heavy rain and strong winds!',
    choices: [
      {
        id: 'shelter',
        text: 'Tìm nơi trú ẩn',
        text_en: 'Find shelter',
        outcomes: [
          {
            id: 'safe',
            narrative: 'Ngươi tìm được một hang động nhỏ để trú mưa.',
            narrative_en: 'You find a small cave to shelter from the rain.',
            effects: [
              { field: 'stats.stamina', operation: 'subtract', value: 5 },
            ],
          },
          {
            id: 'discovery',
            narrative: 'Trong hang động, ngươi phát hiện một thứ gì đó!',
            narrative_en: 'In the cave, you discover something!',
            effects: [],
            items: ['mysterious_herb'],
          },
        ],
        outcome_weights: [70, 30],
      },
      {
        id: 'brave_it',
        text: 'Tiếp tục đi trong bão',
        text_en: 'Brave the storm',
        outcomes: [
          {
            id: 'endure',
            narrative: 'Ngươi dũng cảm vượt qua bão, nhưng mất nhiều thể lực.',
            narrative_en: 'You bravely push through, but lose stamina.',
            effects: [
              { field: 'stats.stamina', operation: 'subtract', value: 20 },
            ],
          },
          {
            id: 'lightning',
            narrative: 'Sét đánh gần ngươi! May mắn ngươi chỉ bị thương nhẹ.',
            narrative_en: 'Lightning strikes near you! Luckily you\'re only lightly injured.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 15 },
              { field: 'stats.stamina', operation: 'subtract', value: 15 },
            ],
          },
        ],
        outcome_weights: [70, 30],
      },
    ],
  },
  {
    id: 'portal_discovery',
    name: 'Cổng không gian',
    name_en: 'Portal Discovery',
    trigger: 'travel',
    rarity: 'rare',
    weight: 5,
    narrative: 'Một vết nứt không gian xuất hiện trước mặt ngươi, phát ra năng lượng huyền bí!',
    narrative_en: 'A spatial rift appears before you, emanating mysterious energy!',
    choices: [
      {
        id: 'enter',
        text: 'Bước vào cổng',
        text_en: 'Enter the portal',
        outcomes: [
          {
            id: 'secret_realm',
            narrative: 'Cổng dẫn ngươi đến một bí cảnh!',
            narrative_en: 'The portal leads you to a secret realm!',
            effects: [],
            unlock_area: 'mysterious_realm',
            set_flags: ['discovered_portal'],
          },
          {
            id: 'trap',
            narrative: 'Đây là một bẫy! Ngươi bị dịch chuyển đến nơi nguy hiểm.',
            narrative_en: 'It\'s a trap! You\'re teleported to a dangerous place.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 25 },
            ],
            trigger_combat: 'void_beast',
          },
        ],
        outcome_weights: [60, 40],
      },
      {
        id: 'observe',
        text: 'Quan sát từ xa',
        text_en: 'Observe from afar',
        outcomes: [
          {
            id: 'insight',
            narrative: 'Ngươi lĩnh ngộ được một chút về không gian chi đạo.',
            narrative_en: 'You gain insight into spatial dao.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 20 },
            ],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'leave',
        text: 'Rời đi nhanh',
        text_en: 'Leave quickly',
        outcomes: [
          {
            id: 'safe',
            narrative: 'Ngươi quyết định không mạo hiểm với thứ chưa biết.',
            narrative_en: 'You decide not to risk the unknown.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'celestial_phenomenon',
    name: 'Dị tượng thiên văn',
    name_en: 'Celestial Phenomenon',
    trigger: 'travel',
    rarity: 'legendary',
    weight: 1,
    narrative: 'Bầu trời bất ngờ sáng rực với ánh sáng ngũ sắc! Một thiên tượng hiếm có đang diễn ra!',
    narrative_en: 'The sky suddenly lights up with five-colored light! A rare celestial phenomenon is occurring!',
    choices: [
      {
        id: 'cultivate',
        text: 'Tu luyện ngay lập tức',
        text_en: 'Cultivate immediately',
        outcomes: [
          {
            id: 'breakthrough',
            narrative: 'Ngươi hấp thụ năng lượng thiên đạo! Tu vi tăng mạnh!',
            narrative_en: 'You absorb the heavenly energy! Your cultivation increases greatly!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 100 },
              { field: 'stats.qi', operation: 'set', value: 'qi_max' },
            ],
          },
        ],
        outcome_weights: [1],
      },
      {
        id: 'observe',
        text: 'Quan sát thiên tượng',
        text_en: 'Observe the phenomenon',
        outcomes: [
          {
            id: 'insight',
            narrative: 'Ngươi lĩnh ngộ được đạo lý từ thiên tượng.',
            narrative_en: 'You gain enlightenment from the phenomenon.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 50 },
              { field: 'attrs.perception', operation: 'add', value: 1 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
];

// ========================================
// CULTIVATION EVENTS (15% chance during cultivate)
// ========================================

const CULTIVATION_EVENTS: RandomEvent[] = [
  {
    id: 'qi_deviation',
    name: 'Tẩu hỏa nhập ma',
    name_en: 'Qi Deviation',
    trigger: 'cultivation',
    rarity: 'uncommon',
    weight: 15,
    narrative: 'Trong lúc tu luyện, khí lực trong cơ thể ngươi bắt đầu loạn động!',
    narrative_en: 'During cultivation, the qi in your body starts to go berserk!',
    choices: [
      {
        id: 'suppress',
        text: 'Cố gắng trấn áp',
        text_en: 'Try to suppress',
        outcomes: [
          {
            id: 'success',
            narrative: 'Ngươi trấn áp thành công và lĩnh ngộ thêm về kiểm soát khí lực!',
            narrative_en: 'You successfully suppress it and gain insight into qi control!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 30 },
            ],
          },
          {
            id: 'failure',
            narrative: 'Ngươi thất bại! Cơ thể bị tổn thương nội thương.',
            narrative_en: 'You fail! Your body suffers internal injuries.',
            effects: [
              { field: 'stats.hp', operation: 'subtract', value: 40 },
              { field: 'stats.qi', operation: 'set', value: 0 },
            ],
          },
        ],
        outcome_weights: [50, 50],
      },
      {
        id: 'release',
        text: 'Thả lỏng để khí tự điều chỉnh',
        text_en: 'Relax and let qi self-regulate',
        outcomes: [
          {
            id: 'balance',
            narrative: 'Khí lực dần ổn định. Ngươi mất một ít tu vi nhưng an toàn.',
            narrative_en: 'The qi gradually stabilizes. You lose some cultivation but are safe.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'subtract', value: 10 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'breakthrough_opportunity',
    name: 'Cơ hội đột phá',
    name_en: 'Breakthrough Opportunity',
    trigger: 'cultivation',
    rarity: 'rare',
    weight: 8,
    narrative: 'Ngươi cảm thấy một bức tường vô hình trước mắt! Có thể đây là cơ hội đột phá!',
    narrative_en: 'You feel an invisible wall before you! This might be a breakthrough opportunity!',
    choices: [
      {
        id: 'attempt',
        text: 'Thử đột phá ngay',
        text_en: 'Attempt breakthrough now',
        outcomes: [
          {
            id: 'success',
            narrative: 'Ngươi xuyên thủng bức tường! Tu vi tăng mạnh!',
            narrative_en: 'You break through the wall! Your cultivation increases greatly!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 80 },
            ],
          },
          {
            id: 'failure',
            narrative: 'Ngươi thất bại nhưng không bị thương.',
            narrative_en: 'You fail but suffer no injuries.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 20 },
            ],
          },
        ],
        outcome_weights: [40, 60],
      },
      {
        id: 'prepare',
        text: 'Tích lũy thêm rồi đột phá sau',
        text_en: 'Accumulate more and break through later',
        outcomes: [
          {
            id: 'store',
            narrative: 'Ngươi ghi nhớ cảm giác này để chuẩn bị cho lần sau.',
            narrative_en: 'You memorize this feeling for next time.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 15 },
            ],
            set_flags: ['stored_breakthrough_feeling'],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'inner_demon',
    name: 'Tâm ma',
    name_en: 'Inner Demon',
    trigger: 'cultivation',
    rarity: 'rare',
    weight: 6,
    narrative: 'Trong định, một bóng tối xuất hiện - tâm ma của ngươi hiện hình!',
    narrative_en: 'During meditation, a shadow appears - your inner demon manifests!',
    choices: [
      {
        id: 'confront',
        text: 'Đối mặt với tâm ma',
        text_en: 'Confront the inner demon',
        requirements: {
          stat: { key: 'attrs.int', min: 12 },
        },
        outcomes: [
          {
            id: 'overcome',
            narrative: 'Ngươi đánh bại tâm ma! Tâm cảnh được nâng cao!',
            narrative_en: 'You defeat the inner demon! Your mental state improves!',
            effects: [
              { field: 'attrs.int', operation: 'add', value: 1 },
              { field: 'progress.cultivation_exp', operation: 'add', value: 40 },
            ],
            set_flags: ['overcame_inner_demon'],
          },
          {
            id: 'corrupted',
            narrative: 'Tâm ma quá mạnh! Ngươi bị ảnh hưởng.',
            narrative_en: 'The inner demon is too strong! You are affected.',
            effects: [
              { field: 'karma', operation: 'subtract', value: 10 },
              { field: 'stats.qi', operation: 'subtract', value: 30 },
            ],
          },
        ],
        outcome_weights: [60, 40],
      },
      {
        id: 'flee',
        text: 'Thoát khỏi định cảnh',
        text_en: 'Exit meditation',
        outcomes: [
          {
            id: 'escape',
            narrative: 'Ngươi thoát ra an toàn nhưng cảm thấy không yên.',
            narrative_en: 'You escape safely but feel unsettled.',
            effects: [
              { field: 'stats.stamina', operation: 'subtract', value: 10 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'enlightenment',
    name: 'Đốn ngộ',
    name_en: 'Enlightenment',
    trigger: 'cultivation',
    rarity: 'legendary',
    weight: 2,
    narrative: 'Một tia sáng lóe lên trong tâm thức! Ngươi bắt đầu lĩnh ngộ đạo lý thiên địa!',
    narrative_en: 'A flash of light in your consciousness! You begin to comprehend the dao of heaven and earth!',
    choices: [
      {
        id: 'embrace',
        text: 'Toàn tâm toàn ý lĩnh ngộ',
        text_en: 'Fully embrace the enlightenment',
        outcomes: [
          {
            id: 'major',
            narrative: 'Ngươi đại triệt đại ngộ! Tu vi nhảy vọt!',
            narrative_en: 'You achieve great enlightenment! Your cultivation leaps forward!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 150 },
              { field: 'attrs.perception', operation: 'add', value: 2 },
            ],
            set_flags: ['achieved_enlightenment'],
          },
        ],
        outcome_weights: [1],
      },
    ],
    excludes_flags: ['achieved_enlightenment'],
    cooldown_turns: 100,
  },
];

// ========================================
// REST EVENTS (10% chance during rest)
// ========================================

const REST_EVENTS: RandomEvent[] = [
  {
    id: 'strange_dream',
    name: 'Giấc mơ kỳ lạ',
    name_en: 'Strange Dream',
    trigger: 'rest',
    rarity: 'uncommon',
    weight: 20,
    narrative: 'Trong giấc ngủ, ngươi mơ thấy một hình ảnh kỳ lạ...',
    narrative_en: 'In your sleep, you dream of a strange vision...',
    choices: [
      {
        id: 'follow',
        text: 'Đi theo hướng dẫn trong mơ',
        text_en: 'Follow the dream\'s guidance',
        outcomes: [
          {
            id: 'revelation',
            narrative: 'Giấc mơ dẫn ngươi đến một nhận thức mới!',
            narrative_en: 'The dream leads you to a new realization!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 15 },
            ],
          },
          {
            id: 'nightmare',
            narrative: 'Giấc mơ biến thành ác mộng! Ngươi tỉnh dậy kiệt sức.',
            narrative_en: 'The dream turns into a nightmare! You wake exhausted.',
            effects: [
              { field: 'stats.stamina', operation: 'subtract', value: 20 },
            ],
          },
        ],
        outcome_weights: [70, 30],
      },
      {
        id: 'wake',
        text: 'Cố gắng thức dậy',
        text_en: 'Try to wake up',
        outcomes: [
          {
            id: 'normal',
            narrative: 'Ngươi tỉnh dậy bình thường.',
            narrative_en: 'You wake up normally.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'night_visitor',
    name: 'Khách đêm',
    name_en: 'Night Visitor',
    trigger: 'rest',
    rarity: 'rare',
    weight: 8,
    narrative: 'Một bóng người xuất hiện trong đêm, quan sát ngươi từ xa.',
    narrative_en: 'A figure appears in the night, watching you from afar.',
    choices: [
      {
        id: 'confront',
        text: 'Đối mặt với kẻ lạ',
        text_en: 'Confront the stranger',
        outcomes: [
          {
            id: 'friend',
            narrative: 'Đó là một tu sĩ lang thang. Họ chia sẻ một số kinh nghiệm.',
            narrative_en: 'It\'s a wandering cultivator. They share some insights.',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 25 },
            ],
          },
          {
            id: 'enemy',
            narrative: 'Đó là kẻ thù! Hắn tấn công ngươi!',
            narrative_en: 'It\'s an enemy! They attack you!',
            effects: [],
            trigger_combat: 'mysterious_assassin',
          },
        ],
        outcome_weights: [60, 40],
      },
      {
        id: 'hide',
        text: 'Giả vờ ngủ',
        text_en: 'Pretend to sleep',
        outcomes: [
          {
            id: 'leave',
            narrative: 'Kẻ lạ đứng một lúc rồi rời đi.',
            narrative_en: 'The stranger stands for a moment then leaves.',
            effects: [],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
];

// ========================================
// COMBAT END EVENTS (20% chance after combat victory)
// ========================================

const COMBAT_END_EVENTS: RandomEvent[] = [
  {
    id: 'hidden_loot',
    name: 'Bảo vật ẩn',
    name_en: 'Hidden Treasure',
    trigger: 'combat_end',
    rarity: 'uncommon',
    weight: 20,
    narrative: 'Sau trận chiến, ngươi phát hiện kẻ địch mang theo một vật phẩm ẩn!',
    narrative_en: 'After the battle, you discover the enemy was carrying a hidden item!',
    choices: [
      {
        id: 'take',
        text: 'Lấy vật phẩm',
        text_en: 'Take the item',
        outcomes: [
          {
            id: 'bonus',
            narrative: 'Đó là một vật phẩm có giá trị!',
            narrative_en: 'It\'s a valuable item!',
            effects: [],
            items: ['random_treasure'],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
  {
    id: 'combat_insight',
    name: 'Ngộ đạo chiến đấu',
    name_en: 'Combat Insight',
    trigger: 'combat_end',
    rarity: 'rare',
    weight: 10,
    narrative: 'Trận chiến đã cho ngươi một cái nhìn sâu sắc về võ đạo!',
    narrative_en: 'The battle has given you deep insight into martial dao!',
    choices: [
      {
        id: 'meditate',
        text: 'Suy ngẫm về trận chiến',
        text_en: 'Reflect on the battle',
        outcomes: [
          {
            id: 'improve',
            narrative: 'Ngươi lĩnh ngộ được cách cải thiện kỹ năng chiến đấu!',
            narrative_en: 'You understand how to improve your combat skills!',
            effects: [
              { field: 'progress.cultivation_exp', operation: 'add', value: 20 },
              { field: 'attrs.str', operation: 'add', value: 1 },
            ],
          },
        ],
        outcome_weights: [1],
      },
    ],
  },
];

// ========================================
// EXPORTS
// ========================================

export const ALL_EVENTS: RandomEvent[] = [
  ...EXPLORATION_EVENTS,
  ...TRAVEL_EVENTS,
  ...CULTIVATION_EVENTS,
  ...REST_EVENTS,
  ...COMBAT_END_EVENTS,
];

export const EVENTS_BY_TRIGGER: Record<string, RandomEvent[]> = {
  exploration: EXPLORATION_EVENTS,
  travel: TRAVEL_EVENTS,
  cultivation: CULTIVATION_EVENTS,
  rest: REST_EVENTS,
  combat_end: COMBAT_END_EVENTS,
};

// Helper functions
export function getEventById(eventId: string): RandomEvent | undefined {
  return ALL_EVENTS.find(event => event.id === eventId);
}

export function getEventsByTrigger(trigger: string): RandomEvent[] {
  return EVENTS_BY_TRIGGER[trigger] || [];
}

export function getEventsForRegion(regionId: string, trigger: string): RandomEvent[] {
  const events = getEventsByTrigger(trigger);
  return events.filter(event =>
    !event.regions || event.regions.includes(regionId as any)
  );
}

export function getEventWeight(event: RandomEvent, hasElementAffinity: boolean): number {
  let weight = event.weight;
  if (hasElementAffinity && event.element_affinity) {
    weight *= 1.5; // 50% bonus for element affinity
  }
  return weight;
}
