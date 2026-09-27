import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import { CopyShader } from 'three/addons/shaders/CopyShader.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'

/** Display-referred finishing: lens vignette, plum-shadow / peach-highlight split tone and fine grain. */
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
      color += (hash(vUv * 1024. + fract(psTime) * 91.) - .5) * .022 * psGrain;
      gl_FragColor = vec4(color, 1.);
    }`,
}

/**
 * Renders the scene into its own multisampled target, then copies the resolved
 * image into the composer chain. Bloom composites additively into the chain's
 * buffer; doing that into a multisampled buffer fails once three.js invalidates
 * it after resolving, so the MSAA buffer is never written twice.
 */
class MultisampleRenderPass extends Pass {
  private target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
  private copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), depthTest: false, depthWrite: false }))
  constructor(private scene: THREE.Scene, private camera: THREE.Camera) { super(); this.needsSwap = false }
  setSize(width: number, height: number) { this.target.setSize(width, height) }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    renderer.setRenderTarget(this.target)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    ;(this.copy.material as THREE.ShaderMaterial).uniforms.tDiffuse.value = this.target.texture
    renderer.setRenderTarget(this.renderToScreen ? null : read)
    this.copy.render(renderer)
  }
  dispose() { this.target.dispose(); this.copy.material.dispose(); this.copy.dispose() }
}

export function createComposer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, bloomStrength: number) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2())
  const composer = new EffectComposer(renderer)
  composer.addPass(new MultisampleRenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), bloomStrength, .42, 1.1)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)
  return { composer, bloom, grade }
}
