// Writes the game's app icon: a cultivator riding a flying sword across a cinnabar sun, over ink mountains in mist.
// - game/godot/art/icon/icon_{background,foreground,monochrome}.svg: the Android adaptive layers (432×432; the
//   launcher shows the middle 288 and the middle 264 is always safe) and the themed-icon silhouette.
// - game/godot/icon.svg: the whole picture in a rounded square (window, editor, older launchers).
// Usage: node scripts/make-game-icons.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "game", "godot");
const dir = path.join(out, "art", "icon");
fs.mkdirSync(dir, { recursive: true });

// ---------------------------------------------------------------- palette (the game's ink & jade)
const ink = "#1c2230";

// ---------------------------------------------------------------- the background: sky, sun, mountains, mist
const backgroundDefs = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3e3bd"/>
      <stop offset="0.5" stop-color="#f1e0b6"/>
      <stop offset="1" stop-color="#e2cfa2"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0.6" stop-color="#e79a6c" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#f3e3bd" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sun" cx="0.42" cy="0.38" r="0.62">
      <stop offset="0" stop-color="#d4523f"/>
      <stop offset="0.7" stop-color="#b3362c"/>
      <stop offset="1" stop-color="#962823"/>
    </radialGradient>
    <linearGradient id="far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8fa39b"/>
      <stop offset="1" stop-color="#c9cfbf"/>
    </linearGradient>
    <linearGradient id="near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3a3f"/>
      <stop offset="0.6" stop-color="#34494a"/>
      <stop offset="1" stop-color="#4e6a62"/>
    </linearGradient>
    <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6ecd2" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#f6ecd2" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#f6ecd2" stop-opacity="0.95"/>
    </linearGradient>`;

const background = `
  <rect width="432" height="432" fill="url(#sky)"/>
  <circle cx="216" cy="200" r="148" fill="url(#halo)"/>
  <circle cx="216" cy="200" r="100" fill="url(#sun)"/>
  <!-- A thin cloud across the sun. -->
  <path d="M96 214 C140 206 170 212 206 208 C236 205 262 199 300 202 C322 204 338 208 352 206 L352 214 C318 218 296 212 262 214 C226 217 198 222 160 222 C132 222 112 220 96 222 Z" fill="#f6ecd2" opacity="0.55"/>
  <!-- Far peaks, pale in the haze. -->
  <path d="M0 292 C22 284 36 268 52 250 C62 240 70 244 80 256 C92 270 100 262 112 244 C124 226 134 222 146 238 C160 258 170 266 186 262 C200 258 206 250 218 252 C232 254 238 266 252 262 C266 258 276 236 290 228 C302 222 310 232 322 246 C334 260 346 254 360 244 C374 234 390 240 404 256 C414 268 424 276 432 280 L432 432 L0 432 Z" fill="url(#far)" opacity="0.9"/>
  <rect x="0" y="262" width="432" height="60" fill="url(#mist)"/>
  <!-- Near ridges in ink: tall at the sides, low in the middle, so the sun stays clear. -->
  <path d="M0 300 C12 290 24 262 38 240 C48 224 56 214 66 218 C76 222 80 238 90 252 C100 266 110 262 118 272 C130 288 148 300 170 308 C192 316 214 318 236 314 C260 310 280 300 298 290 C312 282 320 262 332 250 C344 238 352 232 362 240 C372 248 378 262 390 268 C404 276 418 272 432 266 L432 432 L0 432 Z" fill="url(#near)"/>
  <!-- Ink strokes on the ridges. -->
  <path d="M38 240 C44 262 42 282 52 300" stroke="#f1e0b6" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.35"/>
  <path d="M332 250 C338 270 336 286 346 302" stroke="#f1e0b6" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.35"/>
  <!-- Pines on the left ridge. -->
  <g fill="#1f2c30">
    <path d="M60 222 L52 240 L57 239 L48 256 L55 255 L46 272 L74 272 L65 255 L72 256 L63 239 L68 240 Z"/>
    <path d="M86 244 L80 258 L84 257 L77 270 L95 270 L88 257 L92 258 Z"/>
    <path d="M366 238 L359 254 L364 253 L356 268 L378 268 L370 253 L375 254 Z"/>
  </g>
  <!-- Mist rolling over the ridges. -->
  <path d="M0 332 C40 320 70 330 108 326 C150 322 176 336 220 334 C262 332 296 320 336 324 C378 328 404 322 432 318 L432 432 L0 432 Z" fill="#f6ecd2" opacity="0.92"/>
  <path d="M0 356 C54 346 96 356 150 352 C210 348 250 360 310 356 C360 352 400 346 432 350 L432 432 L0 432 Z" fill="#fbf4e2"/>`;

// ---------------------------------------------------------------- the foreground: a cultivator riding a flying sword
// Fits the 264 px safe circle round (216, 216).
const figure = ({ fill, sash, sashLight, belt, blade, bladeEdge, hilt, tassel, glow }) => `
  <g transform="translate(216 218) scale(1.08) translate(-216 -218)">
  <!-- The sword's wake. -->
  ${glow ? `<path d="M158 298 C130 305 104 312 80 318 C104 306 130 297 156 290 Z" fill="${glow}" opacity="0.6"/>
  <path d="M152 303 C126 313 102 322 80 330 C102 316 126 305 150 297 Z" fill="${glow}" opacity="0.32"/>` : ""}
  <!-- The flying sword: blade, a line of sword qi along it, guard, hilt, tassel. -->
  <path d="M164 294 L318 259 L330 259 L321 267 L166 304 Z" fill="${blade}"/>
  ${bladeEdge ? `<path d="M172 296 L316 263 L319 264 L174 299 Z" fill="${bladeEdge}" opacity="0.95"/>` : ""}
  <path d="M158 283 L164 282 L172 312 L166 314 Z" fill="${hilt}"/>
  <path d="M162 297 L130 305 L131 312 L164 304 Z" fill="${hilt}"/>
  <circle cx="128" cy="309" r="5" fill="${hilt}"/>
  <path d="M125 312 C117 320 108 321 96 328 C106 316 113 312 121 305 Z" fill="${tassel}"/>
  <!-- The sash, streaming back from the belt. -->
  <path d="M206 216 C186 210 168 218 148 210 C132 203 120 193 104 196 C118 184 136 194 152 198 C172 204 190 198 210 208 Z" fill="${sash}"/>
  <path d="M206 224 C184 228 166 238 144 234 C128 231 118 222 104 226 C118 212 134 222 150 223 C170 225 188 216 206 216 Z" fill="${sashLight}"/>
  <!-- The robe, leaning into the flight, its hem blown back in two points. -->
  <path d="M210 176 C203 188 202 200 206 212 C198 230 186 246 164 262 C176 264 186 262 194 258 C188 270 180 278 166 288 C186 290 202 286 214 281 L247 283 C244 264 241 244 238 226 C242 210 244 194 241 178 C232 169 218 169 210 176 Z" fill="${fill}"/>
  <!-- A jade belt. -->
  <path d="M205 209 L239 212 L238 220 L204 217 Z" fill="${belt}"/>
  <!-- The forward arm in "sword fingers", its wide sleeve hanging back. -->
  <path d="M236 182 C248 184 258 188 270 190 L281 186 L283 189 L273 195 C258 196 246 194 234 192 Z" fill="${fill}"/>
  <path d="M238 188 C244 202 251 214 256 228 C246 226 239 219 234 206 Z" fill="${fill}"/>
  <!-- The back arm, hand behind. -->
  <path d="M211 182 C202 192 196 202 191 213 L197 216 C202 207 208 199 215 190 Z" fill="${fill}"/>
  <!-- Feet on the blade. -->
  <path d="M209 282 L226 284 L225 289 L207 288 Z" fill="${fill}"/>
  <path d="M231 281 L248 278 L249 283 L232 286 Z" fill="${fill}"/>
  <!-- Head, topknot and pin, a ribbon from the knot. -->
  <path d="M216 168 L234 170 L233 179 L215 178 Z" fill="${fill}"/>
  <circle cx="226" cy="158" r="13" fill="${fill}"/>
  <circle cx="228" cy="142" r="7" fill="${fill}"/>
  <path d="M216 140 L242 145" stroke="${fill}" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M222 142 C210 140 198 146 186 144 C194 137 206 135 220 138 Z" fill="${sash}"/>
  </g>`;

const foreground = figure({
  fill: ink, sash: "#3f7d68", sashLight: "#7fb49c", belt: "#4e7f6c", blade: "#efe8d6", bladeEdge: "#ffffff",
  hilt: "#c9a54a", tassel: "#b3362c", glow: "#bfe3d2",
});
const white = "#ffffff";
const monochrome = figure({ fill: white, sash: white, sashLight: white, belt: white, blade: white, bladeEdge: null, hilt: white, tassel: white, glow: null });

const svg = (defs, body, attrs = 'width="432" height="432" viewBox="0 0 432 432"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>\n  <defs>${defs}\n  </defs>${body}\n</svg>\n`;

const header = (what) => `<!-- Tu Tien Luc app icon, ${what}. Written by scripts/make-game-icons.mjs; the layers are 432 px, the launcher shows the middle 288 and the middle 264 is always safe. -->\n`;

fs.writeFileSync(path.join(dir, "icon_background.svg"), header("adaptive background") + svg(backgroundDefs, background));
fs.writeFileSync(path.join(dir, "icon_foreground.svg"), header("adaptive foreground") + svg("", foreground));
fs.writeFileSync(path.join(dir, "icon_monochrome.svg"), header("themed-icon silhouette") + svg("", monochrome));

// The project icon (desktop window, the editor, older launchers): the full picture in a rounded square, 192 px.
const project = `
    ${backgroundDefs}
    <clipPath id="round"><rect x="60" y="60" width="312" height="312" rx="68"/></clipPath>`;
fs.writeFileSync(
  path.join(out, "icon.svg"),
  header("the whole picture") +
    svg(project, `\n  <g clip-path="url(#round)">${background}${foreground}\n  </g>`, 'width="192" height="192" viewBox="60 60 312 312"'),
);
console.log("icons written to " + dir);
