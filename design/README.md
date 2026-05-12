# Handoff: Xianxia RPG — Ink Wash & Jade UI Redesign

## Overview

A complete UI redesign for the **Tu Tiên Lục** (Xianxia RPG) Next.js app. The redesign replaces the current dark navy + purple/gold "xianxia" palette with an **ink wash & jade** aesthetic — warm parchment backgrounds, deep ink typography, jade qi accents, cinnabar seal stamps, and authentic Hán-Việt terminology for an immersive Vietnamese cultivation-novel feel.

The redesign covers **all 9 main surfaces**:
- Login / Đăng nhập
- Character creation / Tạo nhân vật (3-step flow with spirit-root reveal)
- Main game screen / Hành trình (narrative + choices + cultivator rail)
- Character sheet / Tu sĩ (realm, attributes, meridians, abilities)
- Sect / Môn phái
- Inventory / Túi đồ
- Market / Chợ linh vật
- World map / Thiên hạ
- Combat overlay / Chiến đấu

## About the Design Files

The files in this bundle (`prototype/`) are **design references created as a standalone HTML+React prototype**, not production code to copy directly.

The task is to **recreate these designs inside the existing `xianxia-rpg/` Next.js codebase** (React 18 + Next App Router + Tailwind + Supabase). All gameplay logic, state, types, hooks, and API routes already exist — only the presentational layer of the affected components needs to be replaced.

- Strip the current `bg-xianxia-*` / `text-xianxia-*` Tailwind classes from the components listed under **Files Affected** below.
- Introduce the new design tokens as CSS custom properties (recommended) or as new Tailwind theme tokens.
- Re-implement each screen's markup and styles to match the prototype.
- Keep the existing TypeScript prop interfaces, hooks, and handlers unchanged.

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, components, and copy. Recreate the visual treatment pixel-faithfully. The prototype uses mocked data — wire each screen to the existing hooks (`useGameState`, `useItemHandlers`, `useTravelHandlers`, `useCombat`, etc.) and props.

---

## Design System

### Palette (light / "Giấy cổ" — parchment)

| Token            | Value      | Use |
|------------------|------------|------|
| `--paper`        | `#efe5cd`  | Page background (warm parchment) |
| `--paper-deep`   | `#e2d2ab`  | Subtle dropped panel bg |
| `--paper-darker` | `#d9c89c`  | Inset / track wells |
| `--card`         | `#f7eed5`  | Card surface (lifted off paper) |
| `--card-deep`    | `#ebdfb9`  | Secondary card surface |
| `--ink`          | `#1c2230`  | Primary text |
| `--ink-soft`     | `#3f4757`  | Body / secondary text |
| `--ink-mute`     | `#6f6856`  | Muted / labels |
| `--ink-faint`    | `#9b917a`  | Disabled / faint text |
| `--line`         | `#c8bb96`  | Hairline borders |
| `--line-soft`    | `#d6caa5`  | Soft dividers |
| `--line-strong`  | `#a3946a`  | Emphasis borders |
| `--jade`         | `#4e7f6c`  | Qi / cultivation accent |
| `--jade-deep`    | `#2e5246`  | Jade on light bg |
| `--jade-soft`    | `#88ad9b`  | Subtle jade |
| `--cinnabar`     | `#9b2a26`  | Seal red — primary accent |
| `--cinnabar-deep`| `#751c18`  | Cinnabar on light bg |
| `--gold`         | `#a07a2e`  | Realm progression accent |
| `--gold-deep`    | `#7a5b1c`  | Currency / silver |

### Two alternate themes (offered as Tweaks)

- **Bamboo Night** (dark): `--paper #181c25`, ink inverts to `#ece4cc`, jade brightens to `#88ad9b`. Cinnabar/gold lifts.
- **Cinnabar Dusk** (warm red parchment): `--paper #ecd9c1`, jade shifts to cinnabar-leaning tones.

(Complete dark-theme overrides are in `prototype/styles.css` under `[data-theme="night"]` and `[data-theme="cinnabar"]`.)

### Rarity colors

| Tier (vi) | Tier (en) | Hex |
|---|---|---|
| Phàm Phẩm | Common    | `#6f6856` |
| Hạ Phẩm   | Uncommon  | `#4e7f6c` (jade) |
| Trung Phẩm| Rare      | `#3a6280` (water-blue) |
| Thượng Phẩm| Epic     | `#6b4a7c` (royal violet) |
| Cực Phẩm  | Legendary | `#9b2a26` (cinnabar) |

### Realm colors

| Realm | Hex |
|---|---|
| Phàm Nhân (Mortal)     | `#6f6856` |
| Luyện Khí (Qi Cond.)   | `#4e7f6c` |
| Trúc Cơ (Foundation)   | `#3a6280` |
| Kết Đan (Core)         | `#6b4a7c` |
| Nguyên Anh (Nascent)   | `#a07a2e` |

### Typography

| Role            | Font (primary)              | Fallbacks                       | Weights used |
|-----------------|-----------------------------|----------------------------------|--------------|
| Display (titles)| **Cormorant Garamond**      | Noto Serif SC, serif             | 500, 600     |
| Han characters  | **Noto Serif SC**           | Cormorant Garamond, serif        | 500, 600     |
| Body            | **Spectral**                | Cormorant Garamond, Georgia      | 400 + italic |
| UI / labels     | **Inter**                   | system-ui, sans-serif            | 500, 600     |
| Numbers         | **Inter** (tabular-nums)    | ui-monospace                     | 500, 600     |

All four families are loaded together from Google Fonts (see `prototype/Xianxia UI.html` head). Spectral and Cormorant Garamond both have full Vietnamese (Việt) subset coverage — important since the entire UI is in Vietnamese with Hán-Việt diacritics.

#### Type scale (px)

| Class / context | Size | Line-height | Weight | Letter-spacing |
|---|---|---|---|---|
| Page hero `t-display` | 26–78 | 0.95–1.1 | 500 | 0.005–0.04em |
| Section title    | 26 | 1.1 | 500 | 0.005em |
| Card title       | 17–22 | 1.1–1.15 | 500 | — |
| Body / narrative | 14–17 | 1.55–1.75 | 400 | — |
| Label (uppercase)| 10.5 | 1 | 500 | 0.16em (UPPERCASE) |
| Numbers          | 11–18 | 1 | 500 | tabular-nums |
| Han large        | 26–78 | 0.85–1 | 500 | 0–0.04em |

### Spacing

8-px base. Card padding 16/20/24/28/32/36. Vertical gap between major sections: 24. Inline gaps: 6/8/10/14.

### Border radius

Almost everything is sharp: `--radius: 4px` for cards, `2px` for inputs / buttons, `999px` only for pills and full circles (orb, portrait).

### Shadows

Avoid drop shadows on cards — use hairline borders + a top inset highlight instead:
```
box-shadow:
  0 1px 0 rgba(255, 250, 230, 0.6) inset,
  0 1px 2px rgba(70, 50, 20, 0.10);
```
Only the floating Tweaks panel, modal overlays, and the stage switcher get a real drop shadow.

### Texture / decoration

- **Paper grain**: SVG noise (`feTurbulence baseFrequency='0.85'`) layered via `mix-blend-mode: multiply` on the page background — see `.paper-bg::before` in `styles.css`.
- **Han watermarks** (`.han-bg`): oversized Chinese characters set to `opacity: 0.04`, absolutely positioned on cards. Adds atmosphere without competing with copy.
- **Brush rule** (`.brush-rule`): a 6-px high element with an SVG mask drawing an ink-stroke line. Use under section heads.
- **Seal stamp** (`.seal`): square cinnabar block with white Han character, slightly mottled (SVG noise overlay) and double-border. Comes in cinnabar / ink / jade / ghost variants and sm/md/lg sizes.

---

## Component Library

All shared primitives are in `prototype/components.jsx`. Translate each into the target codebase's component idiom.

- **`<Card>`** — paper-surface container. Props: `padding`, `deep`, `className` (use `card-corner` to enable the folded-corner ornament).
- **`<Bar kind={"hp"|"qi"|"stam"|"exp"} value max label sub>`** — labelled stat bar with current/max numbers above. Color variants are CSS-driven.
- **`<Pill variant={"default"|"jade"|"cinnabar"|"gold"} solid>`** — uppercase chip with optional leading dot.
- **`<Seal variant={"cinnabar"|"ink"|"jade"|"ghost"} size={"sm"|""|"lg"}>`** — Chinese-character cinnabar stamp.
- **`<SectionHead han title subtitle right>`** — Han glyph + display title + meta + brush rule.
- **`<SmallHead right>`** — uppercase mini-label row with optional right-aligned content.
- **`<RealmOrb han name stage stageMax progress>`** — circular SVG showing realm Han, stage ticks (filled cinnabar / unfilled), progress arc in jade.
- **`<MeridianStrip meridians>`** — 6 conic-gradient flow dots with percentages and labels.
- **`<ItemSlot item selected onClick showQty showLvl>`** — rarity-edged square slot showing item glyph, optional enhance level, quantity badge.
- **`<Resource glyph amount label>`** — Han + tabular number + tiny uppercase label.
- **`<Stat label value icon>`** — Han icon + label + right-aligned tabular value with dotted underline.

### Buttons

`btn`, with modifiers `primary` (filled ink), `ghost`, `cinnabar`, `sm`. Always a 1-px border, 2-px radius, slight letter-spacing.

### Choice (narrative options)

`.choice` — left-aligned wide button with a circled ordinal Han glyph at left (一/二/三/四), the choice text, and a small "cost" row at the bottom (氣 Qi / 力 Stamina / 銀 Silver / 時 Time). Hover lifts background + translates 2px right. Insufficient-resources state dims to 0.55 opacity and shows costs in cinnabar.

### Tabs

Horizontal strip, each tab contains a Han glyph (cinnabar) + Vietnamese label. Active tab has a 2-px cinnabar bottom border that overlaps the parent's bottom rule. See `.tabs` / `.tab` / `.tab.active`.

---

## Screens

### 1. Login / Đăng nhập

**File**: `prototype/auth-screens.jsx` → `LoginScreen`
**Replaces**: `src/components/Login.tsx`

**Layout**: Two-column grid (1.05fr / 1fr, 40-px gap), centered max-width 960, full viewport height. Background uses `.paper-bg` with four `.han-bg` Han watermarks (道 仙 修 緣) placed at the corners.

**Left column** — title + intro:
- Large cinnabar `<Seal size="lg">仙`
- Uppercase kicker label "Hành trình tu đạo"
- H1 stack: 修仙錄 (cinnabar, 68px Han) over "Tu Tiên Lục" (78px Cormorant)
- Brush rule (max-width 280)
- Italic Vietnamese quote: *"Đại đạo xa thẳm, một bước một bước mà nên. Ai gieo căn cơ, người sẽ gặt được tiên quả."*
- Three feature pills with Han icons: 存 Tự động lưu hành trình · 機 Trí huệ AI dẫn truyện · 器 Mọi thiết bị

**Right column** — `<Card padding={36} className="card-corner">`:
- Top row: ink seal (入 for sign-in, 新 for sign-up) + "🌐 EN" toggle
- Uppercase label ("Đăng Nhập" or "Tạo Tài Khoản")
- H2: **"Tiếp Tục Tu Luyện"** (signin) or **"Khởi Hành Tu Đạo"** (signup)
- Italic sub: signin *"Nhập danh hiệu cũ để nối lại con đường."* / signup *"Lập danh hiệu mới và bước chân lên tiên lộ."*
- Input field: label "Linh Đài (Email)" → email input, placeholder `dao.huu@thien.gioi`
- Input field: label "Mật Quyết" → password input with Han 視/閉 visibility toggle on the right
- Primary button "入 Bước Vào Tiên Lộ" / "立 Lập Danh — Đăng Ký", full-width
- Mode-toggle link (centered, dotted-underline italic)
- Soft hr + centered "Hoặc tiếp tục bằng [Khách Lữ Hành]"

**Behavior**: existing `supabase.auth.signInWithPassword` / `signUp` flow from `Login.tsx`. Mode toggle resets the form. Successful auth still triggers the existing `setTimeout(() => window.location.reload(), 6000)` recovery. Keep the `clearAllSessions` button — render it as a tiny dotted link below the card (copy: "Xóa phiên đăng nhập cũ").

### 2. Character creation / Tạo nhân vật

**File**: `prototype/auth-screens.jsx` → `CharacterCreationScreen`
**Replaces**: `src/components/CharacterCreation.tsx`

**Layout**: Centered max-width 980 column, two `.han-bg` (緣 / 命) at corners. Three rendered modes via local `step` state: `existing` (resume saved char), `form` (name + age), `reveal` (spirit-root reveal).

**Shared header**:
- Centered seal `<Seal size="lg">命`
- Uppercase kicker "Tạo Nhân Vật"
- H1: 立命 (cinnabar) + "Lập Danh — Cầu Linh Căn"
- Brush rule
- 3-step indicator row: 名 Lập Danh → 根 Cầu Linh Căn → 啟 Khai Hành. Each step is a 36-px circle (cinnabar fill = current, ink fill = done, paper-with-border = future) + label below.

**Step `existing`** (only if user already has saved character):
- Single card max-width 540
- Inset card showing nameplate (3-Han block "李/無/心" stacked) + name + spirit root + pills (練氣 4, sect)
- Three vertically stacked buttons: primary "續 Tiếp Tục Hành Trình" / ghost "Tạo Nhân Vật Mới" / cinnabar-bordered ghost "Xóa Dữ Liệu & Tạo Lại"

**Step `form`** — two-column grid (1fr / 1.05fr, 24-px gap):
- Left card `card-corner` with watermark 名:
  - SmallHead "Lập Danh — Khắc Tên Vào Trời"
  - Label "Danh Hiệu Của Ngươi" + text input (Cormorant 18 px)
  - Italic helper "Danh hiệu phải có ít nhất 2 ký tự. Người tu tiên ít khi đổi tên — hãy chọn cẩn thận."
  - Label "Tuổi Khai Đạo" + range slider (15–40) + boxed numeric display
  - Italic dynamic helper based on age (15-18 / 19-25 / 26-32 / 33+)
  - Soft hr + primary button "求 Khẩn Cầu Linh Căn" (or "卜 Thiên cơ đang hiện lộ…" during the 800-ms reveal delay). Disabled when name length < 2.
- Right inset card "Linh căn là gì?":
  - Italic intro about spirit roots
  - Five rows for Kim 金 / Mộc 木 / Thủy 水 / Hỏa 火 / Thổ 土 — each a colored Han disc + name + italic effect description
  - Hr + label "Phẩm Chất" + 5 pills (Phàm/Hạ/Trung/Thượng/Thiên Phẩm)

**Step `reveal`**:
- Big card with massive 根 watermark
- Two-column grid: 220-px element wheel (custom SVG, see below) on the left, reveal text on the right
- Right: uppercase "Thiên Cơ Phán Định" + H2 with Han grade (天品/上品/中品/下品) and Vietnamese grade name + brush rule + label "Thuộc Tính" + element chips (colored border, Han + name) + italic flavor text per grade tier
- Footer row: italic caveat + ghost "卜 Bói Lại" + primary "啟 Khởi Hành Tu Tiên"
- Below the main card, a small 3-column summary card (Danh Hiệu / Tuổi Khai Đạo / Cảnh Giới Khởi Đầu = 凡人 Phàm Nhân · Tầng 1)

#### Element wheel SVG (`<ElementWheel>`)

220×220 viewBox, pentagonal layout:
- Outer dashed ring (radius +14)
- Star-pattern connecting lines between alternate nodes (skip-one)
- Central radial glow + watermark 根 character
- 5 element nodes at radius 78, each a 22-px-radius circle with the Han char inside and ELEMENT name in uppercase below
- **Active nodes** (those in `spiritRoot.elements`): filled with the element's accent color (Kim gold, Mộc green, Thủy blue, Hỏa cinnabar, Thổ ochre), paper-colored Han, animate with `.breathe` class (jade glow filter, 3.4s ease-in-out infinite)
- **Inactive nodes**: paper fill, faint Han, thin line-strong border

### 3. Main game / Hành trình

**File**: `prototype/screens-a.jsx` → `GameScreen`
**Replaces**: the `activeTab === "game"` block in `src/components/GameScreen.tsx`

**Layout**: two-pane grid (left rail 320 px + main content). On `world` and `inventory` tabs the rail collapses (those tabs use full width).

**Left rail — `CultivatorRail`** (`prototype/rail.jsx`) — sticky, top 16. Five stacked cards:

1. **Nameplate card** — vertical 3-Han block (李/無/心) + name + italic title + pills (cinnabar realm + jade age) + small spirit-root description.
2. **Realm orb card** — RealmOrb (168 px) + soft hr + "Cảnh Giới Kế Tiếp" with next realm Han + Vietnamese + faint italic *"Còn N% nữa là có thể đột phá"*.
3. **Vitality card** — three Bars (HP / Qi / Stamina) + soft hr + Body Tempering ("Thân Cảnh") with body-realm Han, name, stage, and progress bar.
4. **Current activity card** (if `state.activity`) — Han watermark, "Đang Tiến Hành" + Han + activity name + countdown + qi-colored progress bar + 2-col bonus grid (Công Pháp / Địa Lợi / Thiên Thời / Tổng) with multipliers.
5. **Resources card** — 3 Resource items (銀 Bạc / 靈 Linh Thạch / 功 Cống Hiến).

**Main content** (right pane on the game tab):

- **Time + setting strip** — left: ink seal 境 + "Cảnh Hiện Tại" label + display title ("Nam Đài — Bích Vân Các") + italic subtext. Right: Time block (Năm/Tháng/Ngày + segment + season) + sun/moon medallion (44-px circle with `time.icon`).
- **Narrative card** — large `card-corner` with watermark 道, header row (Seal 章 + chapter label + chapter title), brush rule, body paragraph with a **floating drop-cap** Han character (78 px cinnabar, `float: left`), meta footer (Han + location/time/qi tags).
- **Choices block** — H2 row (Han 抉 + "Lựa Chọn Của Ngươi" + uppercase mini-label), then 4 stacked `<button class="choice">` items showing ordinal Han (一二三四), text, and costs. Disabled state for unaffordable choices.
- **Custom action input** — dashed-border parchment well: "或 — Tự Nói Hành Động Riêng", italic placeholder *"Nói ra một con đường mà thiên cơ chưa hé lộ…"*, primary button "Khắc Lên".

### 4. Character sheet / Tu sĩ

**File**: `prototype/screens-a.jsx` → `CharacterScreen`
**Replaces**: `src/components/CharacterSheet.tsx`

- SectionHead 身 "Bảng Tu Sĩ" / "Thân — Tâm — Pháp" with two pills (realm Han + progress%).
- Three-column grid (1.1 / 1.4 / 1):
  - **Left card** "Song Tu Pháp Lộ": RealmOrb on top, soft hr, body realm row (Đoán Cốt + progress bar), hr, "Đại Đạo Thăng Tiến" — vertical timeline of 5 realms (Phàm Nhân → Nguyên Anh). Each row: 8-px state dot + Han + Vietnamese name + (current row) tabular stage/max. Locked rows at 0.4 opacity.
  - **Middle card** "Lục Diện Thuộc Tính": six `<Stat>` rows (Lực Lượng/Nhanh Nhẹn/Thể Phách/Ngộ Tính/Tâm Cảnh/Khí Chất) with dotted underline and Han icons (力敏體覺志儀). Soft hr + "Sinh Lực" + three Bars.
  - **Right card** "Kinh Mạch Đồ": MeridianStrip (Phế/Tâm/Can/Tỳ/Thận/Đốc) + soft hr + label "Khí Lưu Tâm Đắc" + italic Vietnamese reading + hr + "Vị Thế Trong Môn Phái" — rank + sect + cinnabar pill (`repRank`) + sect-rank progress bar.
- Bottom card "Công Pháp · Đã Trang Bị" — 4-column grid of ability cards (each: large cinnabar Han + name + uppercase type label + qi cost in jade + cooldown in faint, F1–F4 mark in top-right).

### 5. Sect / Môn phái

**File**: `prototype/screens-b.jsx` → `SectScreen`
**Replaces**: `src/components/SectView.tsx`

- SectionHead 派 with sect Vietnamese name + rank + elder + reputation pill.
- Two-column grid (1 / 1.6):
  - **Left**: big "sect identity" card (massive 派 watermark, 64-px cinnabar sect Han, sect name, brush rule, italic patriarch's inscription). Below it, "Disciple standing" card with four `<Stat>` rows and the rank-up progress bar.
  - **Right**: missions card listing each mission as an inset row (title, difficulty pill, italic description, hr, gold reward + primary "Nhận" button). Below: 2×N grid of fellow disciples — each a 36-px circular Han avatar + name + faint italic "realm · rank".

### 6. Inventory / Túi đồ

**File**: `prototype/screens-b.jsx` → `InventoryScreen`
**Replaces**: `src/components/InventoryView.tsx`

- SectionHead 物 "Túi Đồ Trữ Vật" with pill showing N/64 slots + "Sắp Xếp" button.
- Two-column grid (1.4 / 1):
  - **Left**: filter pill row (Tất Cả / Vũ Khí / Hộ Giáp / Đan Dược / Phù Lục / Công Pháp / Linh Dược / Vật Liệu — Han + Vietnamese label, active = filled ink). Below it a single card containing an 8-col grid of `<ItemSlot>` items (filled + empty placeholders to reach 32 cells). Footer hr + italic hint + rarity legend pills.
  - **Right**: stacked cards.
    - "Worn Equipment" card with 3×2 slot grid (head/chest/hand/waist/leg/foot, each labelled with Han + Vietnamese). Jade pill in header showing aggregate bonus.
    - Item detail card with the selected item's huge glyph watermark, name, type/rarity meta, gold-level pill, italic flavor text, 2-col stat grid (damage / qi affinity / bound / worth), and action buttons (Trang Bị / Khắc Trận / Vứt Đi).

### 7. Market / Chợ linh vật

**File**: `prototype/screens-b.jsx` → `MarketScreen`
**Replaces**: `src/components/MarketView.tsx`

- SectionHead 市 "Chợ Linh Vật" with resource counters (Bạc / Linh Thạch) and ghost "Làm Mới — 50 bạc" button on the right.
- Sub-tabs: 買 Mua / 賣 Bán / 兌 Đổi (Han + Vietnamese, cinnabar underline on active) + right-aligned faint "Quầy hàng đổi mới mỗi 3 ngày" note.
- 2-column grid of listing cards — each row has an `<ItemSlot>` glyph + flex column with name/price (price in gold tabular + tiny 銀 unit), Han + rarity color + stock, and a `Mua 1` primary button + `Xem Kỹ` ghost button.

### 8. World map / Thiên hạ

**File**: `prototype/screens-b.jsx` → `WorldScreen`
**Replaces**: `src/components/WorldMap.tsx`

- SectionHead 界 "Thiên Hạ Lục Cảnh" with current-location cinnabar pill.
- 2-column grid (2.1 / 1):
  - **Left**: aspect-ratio 16/10 paper map card.
    - SVG background: paper grid + three layered sumi-e mountain silhouettes (linear-gradient ink fill, varying opacity), jade river line, dotted connection lines between regions.
    - Compass top-left (60×60 SVG with cinnabar arrow, Han 北/南).
    - Big watermark 界 dead center.
    - Region buttons positioned by `(x%, y%)` — each has a 18-px circular pin (cinnabar pulse for current, dashed for locked) + label tile (Han + Vietnamese, paper background, 1-px ink border).
    - Bottom-right scale chip: `一 = 三百里 · 1 tấc = 300 lý`.
  - **Right**: region detail card. Huge first-Han watermark, "Chi Tiết Vùng" SmallHead, large cinnabar Han + Vietnamese name + tier subtitle. Italic atmospheric description (3 variants: current / locked / accessible). 2-col stat grid (cost / danger / encounters / sects). Bottom: primary "Du Hành" (or "Đang Ở Đây" / "Bị Khóa") + ghost "Suy Bốc".

### 9. Combat overlay / Chiến đấu

**File**: `prototype/screens-b.jsx` → `CombatOverlay`
**Replaces**: `src/components/CombatView.tsx` (as modal overlay)

- Fixed overlay (rgba(20,24,32,0.6) + 4-px blur backdrop). Centered modal max-width 920.
- Top bar: large 戰 seal + "Chiến Đấu" label + display title + ghost "Rút Lui ✕" close button.
- Combat stage: muted card background with bottom-corner cinnabar/ink radial fog. Three sections:
  - **Player** (left): 88-px circular portrait (Han glyph), name + realm, two compact Bars (HP / Qi).
  - **Center**: massive 戰 Han at 0.6 opacity.
  - **Enemy** (right, mirrored): cinnabar-bordered portrait, name + tier, enemy HP bar, uppercase "Ý Đồ — {intent}" in cinnabar.
- Action grid (2-col under stage): Techniques on the left as 4 mini choice buttons (Han ord + name + qi cost + cooldown). Below them three buttons: Đánh Thường / Phòng Thủ / Chạy Trốn (cinnabar variant for flee).
- Combat log on the right (parchment-deep panel): each entry is a 2-px left border (jade for player, cinnabar for enemy) + italic narration + tabular dmg/HP line in jade-deep (+dmg) or cinnabar-deep (-hp).

---

## Animations & Interactions

| Trigger                       | Effect | Duration / easing |
|-------------------------------|--------|-------------------|
| Tab switch                    | `.fade-in` — opacity 0→1 + translateY 6→0 | 0.35s ease-out |
| Cultivating / activity card   | `.breathe` — jade glow drop-shadow pulse | 3.4s infinite |
| Current location pin          | `.region.current .pin` cinnabar ring pulse | 2s infinite |
| Choice hover                  | bg darken + `translateX(2px)`, border → ink | 0.18s |
| Tweaks/Stage Switcher buttons | bg/color instant swap on active | — |

Keep animations purposeful; the existing `globals.css` has many extra keyframes (breakthroughExplosion, qiFlow, etc.) that should continue to work — these animations are additive, not replacements.

---

## State Management

No state shape changes are required. Wire each new screen to the existing hooks:

- `useGameState({ runId, locale })` → `state, narrative, choices, processing, ...`
- `useItemHandlers` → `onEquipItem, onUseItem, onDiscardItem, onEnhanceItem, onMarketAction`
- `useTravelHandlers` → `onTravelArea, onTravelRegion, onDungeonAction`
- `useCombat` → `activeCombat, handleActiveCombatAction, handleActiveCombatEnd`
- `useAbilityHandlers` → `onAbilitySwap, onToggleDualCultivation, onSetExpSplit`

The prototype uses a single static `MOCK` object (`prototype/data.js`) — replace those references with the real `state` payload from `useGameState`.

### Locale

Game is **Vietnamese-first**. Keep the existing `Locale` type and `t(locale, key)` system. All new copy in the prototype is `vi` only; before wiring to production, port the strings into `src/lib/i18n/translations.ts` so the English fallback continues to work. Suggested key names below are illustrative.

#### New / changed copy keys (Vietnamese)

| Key                   | vi                                          |
|------------------------|---------------------------------------------|
| `tabGame`              | Hành Trình                                 |
| `tabCharacter`         | Tu Sĩ                                       |
| `tabSect`              | Môn Phái                                   |
| `tabInventory`         | Túi Đồ                                     |
| `tabMarket`            | Chợ                                         |
| `tabWorld`             | Thiên Hạ                                    |
| `stats.hp`             | Khí Huyết                                   |
| `stats.qi`             | Linh Lực                                    |
| `stats.stamina`        | Thể Lực                                     |
| `attr.strength`        | Lực Lượng                                   |
| `attr.agility`         | Nhanh Nhẹn                                  |
| `attr.constitution`    | Thể Phách                                   |
| `attr.perception`      | Ngộ Tính                                    |
| `attr.willpower`       | Tâm Cảnh                                    |
| `attr.charisma`        | Khí Chất                                    |
| `realm.mortal`         | Phàm Nhân (凡人)                            |
| `realm.qi`             | Luyện Khí (練氣)                            |
| `realm.foundation`     | Trúc Cơ (築基)                              |
| `realm.core`           | Kết Đan (結丹)                              |
| `realm.nascent`        | Nguyên Anh (元嬰)                           |
| `rarity.common`        | Phàm Phẩm                                   |
| `rarity.uncommon`      | Hạ Phẩm                                     |
| `rarity.rare`          | Trung Phẩm                                  |
| `rarity.epic`          | Thượng Phẩm                                 |
| `rarity.legendary`     | Cực Phẩm                                    |
| `auth.signin.title`    | Tiếp Tục Tu Luyện                           |
| `auth.signup.title`    | Khởi Hành Tu Đạo                            |
| `auth.cta.signin`      | Bước Vào Tiên Lộ                            |
| `auth.cta.signup`      | Lập Danh — Đăng Ký                          |
| `creation.cta.find`    | Khẩn Cầu Linh Căn                           |
| `creation.cta.reroll`  | Bói Lại                                     |
| `creation.cta.start`   | Khởi Hành Tu Tiên                           |

Han characters in the UI are **decorative ornaments**, not localized text — they should remain the same in any language. The English locale would still show 修仙錄, 練氣, etc. alongside the English Vietnamese-equivalents (Records of Cultivation, Qi Condensation, etc.).

---

## Assets

The prototype uses **no raster image assets**. Everything is rendered with:
- Google Fonts (Cormorant Garamond, EB Garamond, Spectral, Crimson Pro, Lora, Inter, Noto Serif SC)
- Inline SVG (compass, world map, element wheel, realm orb, mountain silhouettes)
- Inline SVG noise via `data:` URI for the paper grain and seal mottle
- Chinese characters from the system / Noto Serif SC

When wiring to production: keep all Han characters as plain text — do not bake them into images.

---

## Tweaks (in-prototype controls)

The prototype's right-side panel lets reviewers toggle between three palettes (Giấy cổ / Đêm Trúc / Áng Chu Sa), two display fonts, three body fonts, two layout modes (two-pane / single column), Han watermark on/off, and the pre-game stage (login / character creation / game). **These are review aids, not features to ship.** Pick one palette + one font pairing as the production default and drop the rest.

Recommended defaults:
- Theme: Giấy cổ (parchment / light)
- Display: Cormorant Garamond
- Body: Spectral
- Layout: two-pane

---

## Files Affected

In the `xianxia-rpg/` codebase, these are the files whose presentational layer should be replaced. **Do not rewrite the logic / hook usage** — only swap markup and styles.

| Component | Map to prototype |
|---|---|
| `src/components/Login.tsx`              | `prototype/auth-screens.jsx` → `LoginScreen` |
| `src/components/CharacterCreation.tsx`  | `prototype/auth-screens.jsx` → `CharacterCreationScreen` |
| `src/components/GameScreen.tsx`         | `prototype/screens-a.jsx` → `GameScreen` + `prototype/rail.jsx` → `CultivatorRail` |
| `src/components/CharacterSheet.tsx`     | `prototype/screens-a.jsx` → `CharacterScreen` |
| `src/components/CultivatorDashboard.tsx`| Subsumed into `CultivatorRail` (rail card #4) |
| `src/components/SectView.tsx`           | `prototype/screens-b.jsx` → `SectScreen` |
| `src/components/InventoryView.tsx`      | `prototype/screens-b.jsx` → `InventoryScreen` |
| `src/components/MarketView.tsx`         | `prototype/screens-b.jsx` → `MarketScreen` |
| `src/components/WorldMap.tsx`           | `prototype/screens-b.jsx` → `WorldScreen` |
| `src/components/CombatView.tsx`         | `prototype/screens-b.jsx` → `CombatOverlay` |
| `src/components/HealthBar.tsx`          | Replace with `<Bar>` primitive |
| `src/components/Modal.tsx`              | Restyle with paper card + ink border (see CombatOverlay's shell) |
| `src/components/Toast.tsx`              | Restyle as paper card with jade/cinnabar border-left accent |
| `src/components/BreakthroughModal.tsx`  | Existing animations work; restyle the chrome to match |
| `src/components/EventModal.tsx`         | Same — restyle modal chrome |
| `src/app/globals.css`                   | Append the tokens / base styles from `prototype/styles.css` (do NOT replace globals.css — keep all existing keyframes) |
| `tailwind.config.ts`                    | Optionally extend with the new `paper/ink/jade/cinnabar/gold` tokens. The prototype uses raw CSS vars; either approach works. |

The TanStack of API routes, types, hooks under `src/hooks/`, and game logic under `src/lib/` is unchanged.

---

## Bundled Files

- `prototype/Xianxia UI.html` — entry point that loads all JSX modules via Babel-standalone
- `prototype/styles.css` — design tokens + component CSS (paper texture, seal, brush rule, bars, buttons, cards, choices, tabs, realm orb, slots, combat stage, etc.)
- `prototype/data.js` — `window.MOCK` mock state shaped like the real `GameState`
- `prototype/components.jsx` — shared primitives (Card, Bar, Pill, Seal, RealmOrb, MeridianStrip, ItemSlot, Resource, Stat, SectionHead, SmallHead)
- `prototype/rail.jsx` — `CultivatorRail` persistent left pane
- `prototype/screens-a.jsx` — `GameScreen`, `CharacterScreen`
- `prototype/screens-b.jsx` — `InventoryScreen`, `MarketScreen`, `WorldScreen`, `SectScreen`, `CombatOverlay`
- `prototype/auth-screens.jsx` — `LoginScreen`, `CharacterCreationScreen` (+ `ElementWheel` inline)
- `prototype/app.jsx` — top-level shell, tab routing, stage routing, theme/font application, Tweaks panel
- `prototype/tweaks-panel.jsx` — review-only Tweaks UI (host protocol). **Skip in production.**

Open `Xianxia UI.html` in any modern browser to preview the prototype offline.
