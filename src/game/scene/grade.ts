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
  c = (c + vec3(brightness - 0.5)) / (1.0 - contrast) + vec3(0.5);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
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
