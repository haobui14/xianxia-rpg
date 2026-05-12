// ============================================================
// XIANXIA — mock data (Tiếng Việt)
// ============================================================

const MOCK = {
  character: {
    name: "Lý Vô Tâm",
    nameHan: "李無心",
    title: "Đệ Tử Lưu Lãng",
    age: 23,
    sect: "Bích Vân Các",
    sectHan: "碧雲閣",
    spiritRoot: "Tam Linh Căn — Thủy · Mộc · Phong",
    realm: {
      name: "Luyện Khí",
      han: "練氣",
      stage: 4,
      stageMax: 9,
      progress: 62,
      next: "Trúc Cơ",
      nextHan: "築基",
    },
    bodyRealm: { name: "Đoán Cốt", han: "鍛骨", stage: 2, progress: 38 },
    stats: {
      hp: 312, hpMax: 380,
      qi: 184, qiMax: 240,
      stamina: 71, staminaMax: 100,
    },
    attrs: {
      strength: 14, agility: 19, constitution: 16,
      perception: 21, willpower: 18, charisma: 11,
    },
    abilities: [
      { id: "a1", name: "Hạc Bộ Liệt Vân", han: "鶴步", type: "Thân Pháp",  qi: 12, cd: 0 },
      { id: "a2", name: "Băng Châm",       han: "冰針", type: "Tấn Công",   qi: 22, cd: 2 },
      { id: "a3", name: "Kính Đường Thức", han: "鏡塘", type: "Phòng Thủ",  qi: 14, cd: 1 },
      { id: "a4", name: "Thúy Dũng",       han: "翠湧", type: "Tuyệt Học",  qi: 38, cd: 4 },
    ],
    meridians: [
      { id: "lung", name: "Phế",   open: true,  flow: 0.92 },
      { id: "ht",   name: "Tâm",   open: true,  flow: 0.81 },
      { id: "liv",  name: "Can",   open: true,  flow: 0.66 },
      { id: "spl",  name: "Tỳ",    open: false, flow: 0.34 },
      { id: "kid",  name: "Thận",  open: true,  flow: 0.71 },
      { id: "gov",  name: "Đốc",   open: false, flow: 0.18 },
    ],
  },
  resources: { silver: 1284, spiritStones: 47, contribution: 218 },
  time: {
    year: 3, month: 7, day: 14, segment: "Chiều",
    segmentName: "Buổi Chiều", season: "Cuối Hạ",
    icon: "☀",
  },
  activity: {
    type: "Luyện Khí",
    han: "練氣",
    progress: 0.66,
    segmentsLeft: 2,
    segmentsTotal: 6,
    bonuses: { technique: 1.10, location: 1.20, season: 1.05, total: 1.39 },
  },
  narrative:
    "Sương mù bám lên bậc đá của Bích Vân Các, vầng dương buổi chiều mỏng đi sau những đám mây xám tựa biển. " +
    "Dưới sườn nam, ngươi cảm nhận một mạch khí lạ — một sợi linh khí lạnh hơn nước xuân, len lỏi qua rừng trúc. " +
    "Tiếng tụng kinh của một vị trưởng lão vọng qua sân, nửa là chân ngôn, nửa là lời cảnh. " +
    "Kinh mạch của ngươi, chỉ cách đột phá vài ngày, ngân lên hưởng ứng.",
  choices: [
    { id: "c1", ord: "一", text: "Lần theo sợi linh khí lạnh vào rừng trúc phía nam.", cost: { qi: 8, stamina: 6 } },
    { id: "c2", ord: "二", text: "Tiến đến chỗ trưởng lão, thỉnh giáo về mạch khí dị thường.", cost: {} },
    { id: "c3", ord: "三", text: "Lui về động phủ luyện lại Băng Châm chú thuật.", cost: { qi: 22, time: 2 } },
    { id: "c4", ord: "四", text: "Đến Đan Đường hỏi thăm về Trúc Cơ Đan.", cost: { silver: 80 } },
  ],
  inventory: [
    { id: "i1", name: "Sương Liên Tử",     han: "霜蓮籽", glyph: "蓮", rarity: "rare",      qty: 3,  type: "ingredient" },
    { id: "i2", name: "Hạc Cương Phù",     han: "鶴鋼符", glyph: "符", rarity: "uncommon",  qty: 7,  type: "talisman" },
    { id: "i3", name: "Xuyên Vân Đao",     han: "穿雲刀", glyph: "刀", rarity: "epic",      qty: 1,  type: "weapon", lvl: "+3" },
    { id: "i4", name: "Bích Đệ Bào",       han: "碧弟袍", glyph: "袍", rarity: "rare",      qty: 1,  type: "armor",  lvl: "+1" },
    { id: "i5", name: "Linh Tuyền Bình",   han: "靈泉",   glyph: "瓶", rarity: "uncommon",  qty: 12, type: "consumable" },
    { id: "i6", name: "Tiếp Cốt Đan",      han: "接骨丹", glyph: "丹", rarity: "rare",      qty: 4,  type: "pill" },
    { id: "i7", name: "Tinh Thiết",        han: "星鐵",   glyph: "鐵", rarity: "uncommon",  qty: 5,  type: "material" },
    { id: "i8", name: "Cửu Tâm Kinh",      han: "九心經", glyph: "經", rarity: "legendary", qty: 1,  type: "manual" },
    { id: "i9", name: "Ma Nhãn Tinh",      han: "魔眼",   glyph: "眼", rarity: "epic",      qty: 1,  type: "artifact" },
    { id: "i10",name: "Linh Thạch Thô",    han: "粗靈石", glyph: "石", rarity: "common",    qty: 24, type: "currency" },
  ],
  equipment: {
    head:  null,
    chest: { name: "Bích Đệ Bào",    han: "碧弟袍", glyph: "袍", rarity: "rare", lvl: "+1" },
    hand:  { name: "Xuyên Vân Đao",  han: "穿雲刀", glyph: "刀", rarity: "epic", lvl: "+3" },
    waist: { name: "Ngọc Linh Bội",  han: "玉鈴",   glyph: "玉", rarity: "uncommon" },
    leg:   null,
    foot:  { name: "Hạc Bộ Lý",      han: "鶴履",   glyph: "履", rarity: "rare" },
  },
  market: [
    { id: "m1", name: "Trúc Cơ Đan",       han: "築基丹", glyph: "丹", rarity: "epic",      price: 1200, stock: 1 },
    { id: "m2", name: "Hồi Dương Đan",     han: "回陽丹", glyph: "丹", rarity: "rare",      price: 240,  stock: 4 },
    { id: "m3", name: "Ngũ Hành Đồ",       han: "五行圖", glyph: "圖", rarity: "rare",      price: 680,  stock: 1 },
    { id: "m4", name: "Linh Thạch Thô",    han: "靈石",   glyph: "石", rarity: "common",    price: 12,   stock: 99 },
    { id: "m5", name: "Liệt Phong Phù",    han: "裂風符", glyph: "符", rarity: "uncommon",  price: 90,   stock: 12 },
    { id: "m6", name: "Hồn Cao",           han: "魂膏",   glyph: "膏", rarity: "rare",      price: 320,  stock: 3 },
    { id: "m7", name: "Xích Liên Hoa",     han: "赤蓮",   glyph: "蓮", rarity: "uncommon",  price: 55,   stock: 8 },
    { id: "m8", name: "Trữ Vật Hoàn",      han: "儲物環", glyph: "環", rarity: "rare",      price: 980,  stock: 1 },
  ],
  sect: {
    name: "Bích Vân Các",
    han: "碧雲閣",
    rank: "Đệ Tử Ngoại Môn",
    rankHan: "外門",
    rankProgress: 72,
    rep: 412,
    repRank: "Thân Cận",
    elder: "Trưởng Lão Nhuyễn Tùy",
    missions: [
      { id: "s1", name: "Tuần Tra Nam Trúc Lâm",   diff: "Sơ Cấp",  reward: "60 cống hiến · 200 bạc",      desc: "Có báo cáo về dị khí lạnh ở khu vực sườn nam." },
      { id: "s2", name: "Hộ Tống Đan Đường",       diff: "Sơ Cấp",  reward: "120 cống hiến · 1 Hồi Dương Đan", desc: "Hộ tống lô đan dược đến Bạch Tùng Thôn." },
      { id: "s3", name: "Trừ Khử Linh Thú Hung",   diff: "Đệ Tử",   reward: "240 cống hiến · chiến lợi phẩm",  desc: "Một dã trư đã bắt đầu luyện khí. Trấn áp nó." },
    ],
    members: [
      { name: "Mỹ Yến",      han: "美雁",   rank: "Nội Môn",  realm: "Trúc Cơ 2" },
      { name: "Hàn Cửu",     han: "韓九",   rank: "Ngoại Môn", realm: "Luyện Khí 7" },
      { name: "Đỗ Linh",     han: "杜玲",   rank: "Ngoại Môn", realm: "Luyện Khí 5" },
      { name: "Nhậm Bất Tri", han: "任不知", rank: "Nội Môn", realm: "Kết Đan 1" },
    ],
  },
  world: {
    current: "bichvancac",
    regions: [
      { id: "bichvancac",  name: "Bích Vân Các",     han: "碧雲閣", x: 38, y: 44, tier: "Đệ Tử",    current: true },
      { id: "bachtungthon",name: "Bạch Tùng Thôn",   han: "白松村", x: 22, y: 60, tier: "Phàm Tục",  current: false },
      { id: "namtruclam",  name: "Nam Trúc Lâm",     han: "南竹林", x: 50, y: 64, tier: "Sơ Cấp",    current: false },
      { id: "thietcotbao", name: "Thiết Cốt Bảo",    han: "鐵骨堡", x: 68, y: 30, tier: "Trúc Cơ",   current: false, locked: false },
      { id: "notrieuloan", name: "Nộ Triều Loan",    han: "怒潮灣", x: 80, y: 52, tier: "Trúc Cơ",   current: false, locked: true },
      { id: "cuutrungphong",name:"Cửu Trùng Phong",  han: "九重峰", x: 50, y: 18, tier: "Kết Đan",   current: false, locked: true },
    ],
  },
  combat: {
    enemy: {
      name: "Trúc Yêu",
      han: "竹魘",
      tier: "Sơ Cấp · Luyện Khí 5",
      hp: 184, hpMax: 240,
      intent: "Tụ Khí — Lưỡi Phong",
    },
    log: [
      { side: "you",   text: "Ngươi vận Hạc Bộ, áp sát yêu vật.", dmg: null },
      { side: "enemy", text: "Yêu vật vung trúc rỗng đập tới.", dmg: -22 },
      { side: "you",   text: "Băng Châm xuyên qua vỏ linh khí.", dmg: 41 },
      { side: "you",   text: "Kính Đường Thức bẻ chiều phản đòn.", dmg: null },
    ],
  },
};

window.MOCK = MOCK;
