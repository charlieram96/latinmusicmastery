import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/** Display-referred finishing: lens vignette and a plum-shadow / peach-highlight split tone. No animated grain: it reads as flicker. */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, psTime: { value: 0 }, psAspect: { value: 1 }, psGrain: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float psTime; uniform float psAspect; uniform float psGrain;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 centered = vUv - .5;
      vec3 color = texture2D(tDiffuse, vUv).rgb;
      float luma = dot(color, vec3(.2126, .7152, .0722));
      color = mix(color * vec3(.97, .92, 1.08), color * vec3(1.05, 1., .92), smoothstep(.12, .7, luma));
      color = mix(vec3(luma), color, 1.06);
      float vignette = 1. - smoothstep(.32, 1.2, length(centered * vec2(psAspect, 1.) * .78));
      color *= mix(.72, 1., vignette);
      gl_FragColor = vec4(color, 1.);
    }`,
}

/** Smooth the completed image without a separate multisampled framebuffer resolve.
 * Composer supplies physical pixels here, including adaptive pixel-ratio changes.
 */
class StageAntialiasPass extends ShaderPass {
  constructor() { super(FXAAShader) }
  setSize(width: number, height: number) {
    this.uniforms.resolution.value.set(1 / Math.max(1, width), 1 / Math.max(1, height))
  }
}

export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, bloomStrength: number) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bloomStrength, .42, 1.1)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)
  composer.addPass(new StageAntialiasPass())
  return { composer, bloom, grade }
}
