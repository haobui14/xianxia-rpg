// Mây mù: drifting cloud over tiles the player hasn't explored, with a soft ink rim.
shader_type canvas_item;
render_mode unshaded;

uniform sampler2D fog_tex : filter_linear;
uniform sampler2D noise_tex : repeat_enable, filter_linear;
uniform vec2 map_cells = vec2(48.0, 30.0);
uniform float cell_px = 128.0;
uniform float strength = 1.0;

varying vec2 wpos;

void vertex() {
	wpos = VERTEX;
}

void fragment() {
	vec2 uv = wpos / (map_cells * cell_px);
	float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
	float explored = texture(fog_tex, uv).r * inside;
	float n1 = texture(noise_tex, wpos / 760.0 + vec2(TIME * 0.006, TIME * 0.003)).r;
	float n2 = texture(noise_tex, wpos / 240.0 - vec2(TIME * 0.010, TIME * 0.004)).g;
	float cover = smoothstep(0.3, 0.7, (1.0 - explored) * 1.15 + (n1 - 0.5) * 0.55 + (n2 - 0.5) * 0.25);
	vec3 cloud = mix(vec3(0.95, 0.93, 0.88), vec3(0.83, 0.81, 0.77), n2 * 0.8 + n1 * 0.2);
	float rim = smoothstep(0.05, 0.25, cover) * (1.0 - smoothstep(0.3, 0.6, cover));
	cloud = mix(cloud, vec3(0.42, 0.44, 0.47), rim * 0.22);
	COLOR = vec4(cloud, cover * strength);
}
