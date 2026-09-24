// Trees and reeds lean in the wind: the higher above the base, the more they sway.
shader_type canvas_item;

uniform float strength = 1.0;

void vertex() {
	vec2 origin = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xy;
	float h = clamp(-VERTEX.y / 110.0, 0.0, 1.6);
	float t = TIME * 1.2 + origin.x * 0.011 + origin.y * 0.007;
	VERTEX.x += (sin(t) * 2.4 + sin(t * 2.7) * 0.8) * h * h * strength;
}
