import { Effect } from 'postprocessing'
import * as THREE from 'three'

/**
 * The warm colour grade (design.md §7.2): +saturation, a touch of contrast and brightness.
 * Same maths as postprocessing's HueSaturation + BrightnessContrast, but clamped to
 * [0, 1]: their unclamped output dips below zero in dark, saturated pixels, and the
 * final sRGB pow() of a negative turns black on Apple GPUs.
 */
export class Grade extends Effect {
  constructor({ saturation = 0.1, brightness = 0.01, contrast = 0.05 } = {}) {
    super(
      'Grade',
      `
uniform float saturation;
uniform float brightness;
uniform float contrast;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  vec3 diff = vec3((c.r + c.g + c.b) / 3.0) - c;
  c += diff * (1.0 - 1.0 / (1.001 - saturation));
  // brightness / contrast on perceived values (≈ gamma 2), not linear light: in linear, the contrast
  // step subtracts the same amount from every channel, which zeroes red and green in dark pixels and
  // turned every night shadow pure navy
  vec3 g = sqrt(max(c, 0.0));
  g = (g + vec3(brightness - 0.5)) / (1.0 - contrast) + vec3(0.5);
  g = clamp(g, 0.0, 1.0);
  outputColor = vec4(g * g, inputColor.a);
}`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ['saturation', new THREE.Uniform(saturation)],
          ['brightness', new THREE.Uniform(brightness)],
          ['contrast', new THREE.Uniform(contrast)],
        ]),
      },
    )
  }
}
