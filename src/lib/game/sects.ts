import { Sect, SectType } from "@/types/game";

// Named sects the player can encounter or join. Each sect has a type, an
// optional element, a tier (1-5, controls enemy/mission difficulty scaling),
// a rival list, and an ally list. Rivals and allies drive the sect_relations
// system (ambushes, negotiated missions, war events later).

export interface NamedSect extends Sect {
  rivals: string[]; // sect ids
  allies: string[]; // sect ids
  home_region?: string; // region id where this sect is based
}

export const NAMED_SECTS: NamedSect[] = [
  {
    id: "thanh_van_kiem",
    name: "Thanh Vân Kiếm Phái",
    name_en: "Azure Cloud Sword Sect",
    type: "Kiếm",
    element: "Mộc",
    tier: 2,
    description: "Kiếm phái chính đạo nổi danh Thanh Vân, kỷ luật nghiêm minh, chuyên về kiếm thuật nhanh và sắc bén.",
    description_en:
      "A renowned righteous sword sect of the Azure Cloud region, disciplined and focused on swift, precise swordplay.",
    rivals: ["huyet_sat_ma_tong"],
    allies: ["tuyet_nguyet_phat_am", "van_hoa_dan_mon"],
    home_region: "thanh_van",
  },
  {
    id: "van_hoa_dan_mon",
    name: "Vạn Hoa Đan Môn",
    name_en: "Myriad Flower Alchemy Sect",
    type: "Đan",
    element: "Mộc",
    tier: 3,
    description: "Đan phái số một về luyện đan và dược thảo, đệ tử thường là y sư và thương nhân linh dược.",
    description_en:
      "The foremost alchemy sect, masters of pill refinement and herbology; disciples often serve as healers and pill merchants.",
    rivals: ["huyet_sat_ma_tong"],
    allies: ["thanh_van_kiem"],
    home_region: "hoa_son",
  },
  {
    id: "tuyet_nguyet_phat_am",
    name: "Tuyết Nguyệt Phật Am",
    name_en: "Snow Moon Buddhist Monastery",
    type: "PhậtMôn",
    tier: 3,
    description: "Phật môn thanh tu, đề cao từ bi và nhẫn nhục, sở trường hộ thể và trị thương.",
    description_en:
      "A contemplative Buddhist monastery emphasizing compassion and forbearance, renowned for protective arts and healing.",
    rivals: ["huyet_sat_ma_tong"],
    allies: ["thanh_van_kiem"],
    home_region: "huyen_thuy",
  },
  {
    id: "huyet_sat_ma_tong",
    name: "Huyết Sát Ma Tông",
    name_en: "Blood Killing Demonic Sect",
    type: "Ma",
    element: "Hỏa",
    tier: 4,
    description: "Ma tông sát khí ngút trời, tu ma công hút linh khí sinh linh, bị chính đạo căm ghét.",
    description_en:
      "A bloodthirsty demonic sect cultivating killing arts that drain spiritual essence; loathed by the righteous path.",
    rivals: ["thanh_van_kiem", "tuyet_nguyet_phat_am", "van_hoa_dan_mon"],
    allies: [],
    home_region: "tram_loi",
  },
  {
    id: "bach_thu_thuan_son",
    name: "Bách Thú Thuần Sơn",
    name_en: "Hundred Beasts Peak",
    type: "YêuThú",
    element: "Thổ",
    tier: 3,
    description: "Tông môn thuần thú ẩn cư trong núi sâu, đệ tử kết bạn với linh thú cùng chiến đấu.",
    description_en:
      "A beast-taming sect hidden deep in the mountains; disciples bond with spirit beasts as battle companions.",
    rivals: [],
    allies: [],
    home_region: "vong_linh",
  },
];

const SECTS_BY_ID: Record<string, NamedSect> = Object.fromEntries(
  NAMED_SECTS.map((s) => [s.id, s])
);

const SECTS_BY_TYPE: Record<SectType, NamedSect[]> = NAMED_SECTS.reduce(
  (acc, s) => {
    (acc[s.type] ||= []).push(s);
    return acc;
  },
  {} as Record<SectType, NamedSect[]>
);

export function getSectById(id: string): NamedSect | undefined {
  return SECTS_BY_ID[id];
}

export function getSectsByType(type: SectType): NamedSect[] {
  return SECTS_BY_TYPE[type] || [];
}

/**
 * Resolve a sect id by matching against a player's SectMembership. We prefer
 * exact id match; fall back to first sect of matching type (covers AI-created
 * ad-hoc sects that don't map to a named one).
 */
export function resolveNamedSect(sectId: string, sectType: SectType): NamedSect | undefined {
  return SECTS_BY_ID[sectId] ?? SECTS_BY_TYPE[sectType]?.[0];
}

/**
 * Initial relations matrix when a player joins a sect. Rivals start at -50
 * (hostile), allies at +30 (friendly), others at 0 (neutral). The player's
 * own sect is not included (that's tracked via sect_membership.reputation).
 */
export function initialRelationsForSect(sectId: string): Record<string, number> {
  const sect = SECTS_BY_ID[sectId];
  if (!sect) return {};
  const relations: Record<string, number> = {};
  for (const rivalId of sect.rivals) relations[rivalId] = -50;
  for (const allyId of sect.allies) relations[allyId] = 30;
  // Neutral entries for all other named sects so UI can display the full map.
  for (const other of NAMED_SECTS) {
    if (other.id === sectId) continue;
    if (!(other.id in relations)) relations[other.id] = 0;
  }
  return relations;
}

/**
 * Fallback relations matrix when the player joins a sect the AI invented
 * (id not in NAMED_SECTS). We seed relations against named sects using a
 * fixed type-compatibility matrix so rival-hunt missions, ambushes, and
 * the Relations panel all have something to work with.
 *
 * Alignment baseline:
 * - Ma (demonic) vs all righteous types (Kiếm / PhậtMôn / Đan / Trận) → hostile.
 * - Righteous types allied to each other; hostile to Ma.
 * - YêuThú / Tổng / ThươngHội / anything else → neutral.
 */
export function initialRelationsForSectByType(
  sectType: SectType,
  ownSectId?: string
): Record<string, number> {
  const RIGHTEOUS: SectType[] = ["Kiếm", "PhậtMôn", "Đan", "Trận"];
  const DEMONIC: SectType[] = ["Ma"];

  const isRighteous = RIGHTEOUS.includes(sectType);
  const isDemonic = DEMONIC.includes(sectType);

  const relations: Record<string, number> = {};
  for (const other of NAMED_SECTS) {
    if (ownSectId && other.id === ownSectId) continue;
    let rel = 0;
    if (isRighteous && DEMONIC.includes(other.type)) rel = -50;
    else if (isRighteous && RIGHTEOUS.includes(other.type)) rel = 30;
    else if (isDemonic && RIGHTEOUS.includes(other.type)) rel = -50;
    else if (isDemonic && DEMONIC.includes(other.type)) rel = 30;
    relations[other.id] = rel;
  }
  return relations;
}
