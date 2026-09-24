// The painted ground of a field: one quad over the whole map. Each pixel blends the terrain of the
// four nearest tiles with noise-warped edges; water gets a crisp bank, foam and ripples; roads and
// bridges are traced between connected tiles. Terrain ids match TuTien.Core.World.Terrain.
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D terrain_tex : filter_nearest;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform vec2 map_cells = vec2(48.0, 30.0);
uniform float cell_px = 128.0;
uniform int season = 0;
uniform vec4 tint : source_color = vec4(1.0);

varying vec2 wpos;

const int PLAINS = 0;
const int ROAD = 1;
const int FOREST = 2;
const int DENSE = 3;
const int HILLS = 4;
const int MOUNTAIN = 5;
const int PEAK = 6;
const int WATER = 7;
const int BRIDGE = 8;
const int SWAMP = 9;
const int TOWN = 10;
const int SECT = 11;
const int VOID = 12;

void vertex() {
	wpos = VERTEX;
}

vec4 cell_data(ivec2 c) {
	if (c.x < 0 || c.y < 0 || c.x >= int(map_cells.x) || c.y >= int(map_cells.y)) {
		return vec4(12.0 / 255.0, 0.0, 0.0, 1.0);
	}
	return texelFetch(terrain_tex, c, 0);
}

int type_of(vec4 d) {
	return int(d.r * 255.0 + 0.5);
}

bool is_water(int t) {
	return t == WATER || t == BRIDGE;
}

bool connects(int t) {
	return t == ROAD || t == BRIDGE || t == TOWN || t == SECT;
}

vec4 nz4(vec2 p, float scale) {
	return texture(noise_tex, p / scale);
}

vec3 grass_base(float n) {
	vec3 a = vec3(0.60, 0.70, 0.47);
	vec3 b = vec3(0.51, 0.63, 0.41);
	if (season == 1) { a = vec3(0.50, 0.64, 0.41); b = vec3(0.42, 0.56, 0.35); }
	if (season == 2) { a = vec3(0.74, 0.68, 0.44); b = vec3(0.64, 0.60, 0.38); }
	if (season == 3) { a = vec3(0.88, 0.89, 0.86); b = vec3(0.76, 0.80, 0.77); }
	return mix(a, b, n);
}

float seg(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a;
	vec2 ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

vec3 land(int t, vec2 p) {
	vec4 lo = nz4(p, 900.0);
	vec4 mid = nz4(p, 240.0);
	vec4 hi = nz4(p, 38.0);
	vec3 g = grass_base(lo.r);
	g *= 0.94 + 0.12 * mid.g;
	g += (hi.b - 0.5) * 0.05;
	float tuft = smoothstep(0.74, 0.80, nz4(p + vec2(31.0, 17.0), 9.0).a);
	g = mix(g, g * 0.8, tuft * 0.5);

	if (t == PLAINS || t == ROAD) {
		float fl = smoothstep(0.90, 0.93, nz4(p + vec2(7.0), 23.0).r) * step(0.45, mid.g);
		vec3 flower = lo.r > 0.5 ? vec3(0.96, 0.92, 0.72) : vec3(0.93, 0.70, 0.78);
		if (season == 2) flower = vec3(0.90, 0.62, 0.32);
		if (season != 3) g = mix(g, flower, fl * 0.85);
		return g;
	}
	if (t == TOWN) {
		vec3 earth = vec3(0.80, 0.72, 0.56) * (0.93 + 0.10 * mid.g) + (hi.a - 0.5) * 0.04;
		vec2 f = fract(p / vec2(46.0, 34.0) + vec2(floor(p.y / 34.0) * 0.5, 0.0));
		float seam = smoothstep(0.035, 0.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
		earth = mix(earth, earth * 0.86, seam * 0.55 * step(0.3, mid.b));
		if (season == 3) earth = mix(earth, vec3(0.9, 0.9, 0.88), 0.35);
		return earth;
	}
	if (t == SECT) {
		vec3 stone = vec3(0.80, 0.78, 0.72) * (0.95 + 0.08 * mid.g);
		vec2 f = fract(p / 52.0);
		float seam = smoothstep(0.035, 0.0, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
		stone = mix(stone, stone * 0.8, seam * 0.7);
		stone = mix(stone, vec3(0.45, 0.55, 0.38), smoothstep(0.7, 0.8, hi.b) * seam);
		if (season == 3) stone = mix(stone, vec3(0.92, 0.92, 0.9), 0.3);
		return stone;
	}
	if (t == FOREST || t == DENSE) {
		vec3 fl = mix(g * vec3(0.82, 0.86, 0.78), vec3(0.42, 0.40, 0.30), t == DENSE ? 0.38 : 0.2);
		float litter = smoothstep(0.6, 0.75, nz4(p, 17.0).g);
		fl = mix(fl, fl * vec3(1.08, 0.95, 0.8), litter * 0.4);
		return fl * (0.95 + 0.1 * hi.b);
	}
	if (t == HILLS) {
		float band = sin((lo.r * 6.0 + mid.g * 2.0) * 6.2831);
		return g * (0.93 + 0.07 * band) + vec3(0.03, 0.02, 0.0);
	}
	if (t == SWAMP) {
		vec3 mud = mix(vec3(0.42, 0.46, 0.33), vec3(0.34, 0.40, 0.30), mid.g);
		float algae = smoothstep(0.55, 0.62, nz4(p, 45.0).r);
		mud = mix(mud, vec3(0.46, 0.56, 0.32), algae * 0.6);
		float puddle = smoothstep(0.62, 0.66, nz4(p, 120.0).b);
		mud = mix(mud, vec3(0.38, 0.47, 0.44), puddle * 0.8);
		return mud;
	}
	// Mountain, peak and the world beyond: rock with grass pockets and snow up high.
	vec3 rock = mix(vec3(0.66, 0.63, 0.56), vec3(0.55, 0.52, 0.46), mid.g);
	float c = nz4(p, 70.0).a;
	float crack = smoothstep(0.47, 0.5, c) * smoothstep(0.53, 0.5, c);
	rock = mix(rock, rock * 0.72, crack * 0.6);
	rock = mix(rock, g * 0.9, smoothstep(0.55, 0.8, lo.r) * 0.45);
	if (season == 3 || t == PEAK) rock = mix(rock, vec3(0.93, 0.94, 0.93), smoothstep(0.45, 0.7, mid.g) * (t == PEAK ? 0.7 : 0.5));
	return rock;
}

vec3 water(vec2 p, float depth) {
	vec3 w = mix(vec3(0.55, 0.72, 0.74), vec3(0.30, 0.48, 0.58), clamp(depth, 0.0, 1.0));
	float r = nz4(p + vec2(TIME * 9.0, TIME * 4.0), 90.0).g + nz4(p - vec2(TIME * 6.0, -TIME * 3.0), 55.0).b;
	w += (r - 1.0) * 0.06;
	float glint = smoothstep(0.86, 0.9, nz4(p + vec2(TIME * 14.0, 0.0), 31.0).a);
	w = mix(w, vec3(0.92, 0.96, 0.95), glint * 0.5);
	if (season == 3) w = mix(w, vec3(0.80, 0.87, 0.90), 0.45);
	return w;
}

vec3 road_color(vec2 p) {
	vec3 dirt = mix(vec3(0.82, 0.73, 0.55), vec3(0.74, 0.65, 0.48), nz4(p, 40.0).g);
	float pebble = smoothstep(0.82, 0.86, nz4(p, 7.0).a);
	dirt = mix(dirt, vec3(0.62, 0.58, 0.50), pebble * 0.7);
	if (season == 3) dirt = mix(dirt, vec3(0.88, 0.88, 0.86), 0.35);
	return dirt;
}

void fragment() {
	vec2 p = wpos;
	vec2 cp = p / cell_px - 0.5;
	ivec2 b = ivec2(floor(cp));
	vec2 f = fract(cp);
	vec2 warp = vec2(nz4(p, 330.0).r, nz4(p + vec2(97.0, 13.0), 330.0).g) - 0.5;
	vec2 g = clamp(f + warp * 0.55, 0.0, 1.0);
	vec2 w = smoothstep(0.3, 0.7, g);

	vec4 d00 = cell_data(b);
	vec4 d10 = cell_data(b + ivec2(1, 0));
	vec4 d01 = cell_data(b + ivec2(0, 1));
	vec4 d11 = cell_data(b + ivec2(1, 1));
	int t00 = type_of(d00);
	int t10 = type_of(d10);
	int t01 = type_of(d01);
	int t11 = type_of(d11);
	float w00 = (1.0 - w.x) * (1.0 - w.y);
	float w10 = w.x * (1.0 - w.y);
	float w01 = (1.0 - w.x) * w.y;
	float w11 = w.x * w.y;

	// Land and water are blended separately so shores stay crisp.
	float wet = (is_water(t00) ? w00 : 0.0) + (is_water(t10) ? w10 : 0.0) + (is_water(t01) ? w01 : 0.0) + (is_water(t11) ? w11 : 0.0);
	float lw = 1.0 - wet;
	vec3 col = vec3(0.0);
	if (lw > 0.001) {
		if (t00 == t10 && t00 == t01 && t00 == t11) {
			col = land(t00, p);
		} else {
			vec3 acc = vec3(0.0);
			if (!is_water(t00)) acc += land(t00, p) * w00;
			if (!is_water(t10)) acc += land(t10, p) * w10;
			if (!is_water(t01)) acc += land(t01, p) * w01;
			if (!is_water(t11)) acc += land(t11, p) * w11;
			col = acc / lw;
		}
	}
	if (wet > 0.001) {
		float depth = (d00.g * w00 + d10.g * w10 + d01.g * w01 + d11.g * w11) / max(wet, 0.001);
		float m = smoothstep(0.44, 0.56, wet);
		col = mix(col, water(p, depth), m);
		float bank = smoothstep(0.12, 0.40, wet) * (1.0 - smoothstep(0.40, 0.47, wet));
		col = mix(col, vec3(0.84, 0.79, 0.64), bank * 0.7);
		float foam = smoothstep(0.52, 0.56, wet) * (1.0 - smoothstep(0.58, 0.68, wet));
		col = mix(col, vec3(0.93, 0.95, 0.92), foam * (0.45 + 0.4 * nz4(p + vec2(TIME * 5.0, 0.0), 24.0).a));
		float line = smoothstep(0.43, 0.46, wet) * (1.0 - smoothstep(0.46, 0.49, wet));
		col = mix(col, vec3(0.2, 0.25, 0.3), line * 0.4);
	}

	// Roads and bridges run from the tile centre to each connected neighbour.
	ivec2 cc = ivec2(floor(p / cell_px));
	int ct = type_of(cell_data(cc));
	if (ct == ROAD || ct == BRIDGE) {
		vec2 local = p - (vec2(cc) + 0.5) * cell_px;
		float hw = cell_px * 0.5;
		float dist = length(local);
		bool horiz = false;
		if (connects(type_of(cell_data(cc + ivec2(1, 0))))) { dist = min(dist, seg(local, vec2(0.0), vec2(hw, 0.0))); horiz = true; }
		if (connects(type_of(cell_data(cc - ivec2(1, 0))))) { dist = min(dist, seg(local, vec2(0.0), vec2(-hw, 0.0))); horiz = true; }
		if (connects(type_of(cell_data(cc + ivec2(0, 1))))) { dist = min(dist, seg(local, vec2(0.0), vec2(0.0, hw))); }
		if (connects(type_of(cell_data(cc - ivec2(0, 1))))) { dist = min(dist, seg(local, vec2(0.0), vec2(0.0, -hw))); }
		if (ct == ROAD) {
			float width = 24.0 + (nz4(p, 120.0).r - 0.5) * 12.0;
			float m = 1.0 - smoothstep(width - 2.5, width + 2.5, dist);
			float edge = smoothstep(width - 5.0, width, dist) * m;
			col = mix(col, road_color(p), m);
			col = mix(col, col * 0.84, edge * 0.5);
		} else {
			float width = 30.0;
			float m = 1.0 - smoothstep(width - 1.5, width + 1.5, dist);
			float along = horiz ? p.x : p.y;
			float across = horiz ? local.y : local.x;
			float plank = smoothstep(0.08, 0.0, abs(fract(along / 14.0) - 0.5) - 0.42);
			vec3 wood = mix(vec3(0.62, 0.45, 0.30), vec3(0.54, 0.38, 0.25), nz4(p, 30.0).g);
			wood = mix(wood, wood * 0.7, plank);
			wood = mix(wood, vec3(0.30, 0.22, 0.16), smoothstep(width - 6.0, width - 2.0, abs(across)));
			float sh = (1.0 - smoothstep(width, width + 12.0, dist)) * (1.0 - m);
			col = mix(col, col * 0.7, sh * 0.6);
			col = mix(col, wood, m);
		}
	}

	col *= 0.965 + 0.05 * nz4(p, 3.0).b;
	COLOR = vec4(col * tint.rgb, 1.0);
}
