import * as THREE from 'three'

const rand = (seed: number) => { const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }

/** Camera-facing glows with optional water reflections below them; one draw per layer. */
export type GlowMode = 'glow' | 'reflection' | 'blink'

export function billboards(points: THREE.Vector3[], color: THREE.Color, size: number, stretch: number, time: { value: number }, mode: GlowMode) {
  const reflection = mode === 'reflection'
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.setAttribute('psCenter', new THREE.InstancedBufferAttribute(new Float32Array(points.flatMap(p => [p.x, p.y, p.z])), 3))
  geometry.setAttribute('psSeed', new THREE.InstancedBufferAttribute(new Float32Array(points.map((_, i) => rand(i + 3))), 1))
  geometry.instanceCount = points.length
  const material = new THREE.ShaderMaterial({
    uniforms: { psColor: { value: color }, psSize: { value: size }, psStretch: { value: stretch }, psTime: time },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: /* glsl */ `
      attribute vec3 psCenter; attribute float psSeed;
      uniform float psSize; uniform float psStretch;
      varying vec2 vUv; varying float vSeed; varying float vDist;
      void main() {
        vec4 center = modelViewMatrix * vec4(psCenter, 1.);
        vDist = -center.z;
        float grow = psSize * (1. + vDist * .004);
        vec2 corner = position.xy * vec2(grow, grow * psStretch);
        ${reflection ? 'corner.y -= grow * psStretch;' : ''}
        center.xy += corner;
        vUv = position.xy; vSeed = psSeed;
        gl_Position = projectionMatrix * center;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 psColor; uniform float psTime;
      varying vec2 vUv; varying float vSeed; varying float vDist;
      void main() {
        ${reflection ? `
          float fall = (1. - vUv.y) * .5;
          float shimmer = .8 + .2 * sin(vUv.y * 16. + psTime * (.5 + vSeed * .4) + vSeed * 20.);
          float a = exp(-vUv.x * vUv.x * 9.) * (1. - fall) * shimmer * .38;` : `
          float r = length(vUv);
          float a = exp(-r * r * 7.) + exp(-r * 2.6) * .25;${mode === 'blink' ? ' a *= step(.55, fract(psTime * .55 + vSeed * 7.));' : ''}`}
        gl_FragColor = vec4(psColor * a * (.75 + .5 * vSeed), 1.);
      }`,
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  return mesh
}
