import { Effect } from 'postprocessing'

// Debug-only effects (?debug panel) for hunting GPU-specific breakage on phones.

const BITS = `
bool isNaN_(float x) { uint b = floatBitsToUint(x); return (b & 0x7f800000u) == 0x7f800000u && (b & 0x007fffffu) != 0u; }
bool isInf_(float x) { uint b = floatBitsToUint(x); return (b & 0x7fffffffu) == 0x7f800000u; }
`

/** Paints invalid scene pixels: NaN magenta, Inf / huge cyan, negative green. */
export class MarkBadPixels extends Effect {
  constructor() {
    super(
      'MarkBadPixels',
      BITS +
        `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  if (isNaN_(c.r) || isNaN_(c.g) || isNaN_(c.b)) { outputColor = vec4(1.0, 0.0, 1.0, 1.0); return; }
  if (isInf_(c.r) || isInf_(c.g) || isInf_(c.b) || max(c.r, max(c.g, c.b)) > 1000.0) { outputColor = vec4(0.0, 1.0, 1.0, 1.0); return; }
  if (min(c.r, min(c.g, c.b)) < 0.0) { outputColor = vec4(0.0, 1.0, 0.0, 1.0); return; }
  outputColor = inputColor;
}`,
    )
  }
}

/** Repairs invalid scene pixels before the rest of the chain sees them. */
export class ClampPixels extends Effect {
  constructor() {
    super(
      'ClampPixels',
      BITS +
        `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  if (isNaN_(c.r) || isNaN_(c.g) || isNaN_(c.b)) c = vec3(0.0);
  outputColor = vec4(clamp(c, 0.0, 64.0), inputColor.a);
}`,
    )
  }
}
