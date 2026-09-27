import * as THREE from 'three'
import type { HitGrade } from '@/lib/play-sense/types'

const GRAVITY = 14

/** One irregular, bevelled glass fragment; per-instance scale turns it into many shapes. */
function shardGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-.5, -.42); shape.lineTo(.38, -.5); shape.lineTo(.5, .12); shape.lineTo(-.05, .5); shape.lineTo(-.46, .18); shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .5, bevelEnabled: true, bevelThickness: .12, bevelSize: .08, bevelSegments: 1, curveSegments: 1 })
  geometry.center()
  geometry.rotateX(Math.PI / 2)
  return geometry
}

/**
 * Struck notes break into physical glass shards. Everything after the spawn runs
 * on the GPU in closed form: launch, tumble, gravity, a damped bounce on the
 * dock, a short slide, then the pieces shrink away. Shards are real PBR glass
 * (clearcoat, sky reflections) and the pieces of the light insert keep glowing.
 */
export function createShatter(floorY: number, capacity = 640) {
  const time = { value: 0 }
  const base = shardGeometry()
  const geometry = new THREE.InstancedBufferGeometry()
  geometry.index = base.index
  for (const name of ['position', 'normal', 'uv']) geometry.setAttribute(name, base.getAttribute(name))
  const layout: Record<string, number> = { psOrigin: 3, psVelocity: 3, psSpin: 4, psScale: 3, psBirth: 1, psLife: 1, psTint: 3, psGlow: 1 }
  const arrays: Record<string, Float32Array> = {}
  for (const [name, size] of Object.entries(layout)) {
    arrays[name] = new Float32Array(capacity * size)
    if (name === 'psBirth') arrays[name].fill(-1e5)
    geometry.setAttribute(name, new THREE.InstancedBufferAttribute(arrays[name], size).setUsage(THREE.DynamicDrawUsage))
  }
  geometry.instanceCount = capacity

  const material = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: .1, roughness: .12, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.1 })
  material.onBeforeCompile = shader => {
    shader.uniforms.psTime = time
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 psOrigin; attribute vec3 psVelocity; attribute vec4 psSpin; attribute vec3 psScale;
        attribute float psBirth; attribute float psLife; attribute vec3 psTint; attribute float psGlow;
        uniform float psTime;
        varying vec3 vShardTint; varying float vShardGlow;
        vec3 psRotate(vec3 v, vec3 axis, float a) { return v * cos(a) + cross(axis, v) * sin(a) + axis * dot(axis, v) * (1. - cos(a)); }`)
      .replace('#include <beginnormal_vertex>', `
        float psAge = psTime - psBirth;
        float psAlive = step(0., psAge) * step(psAge, psLife);
        // Flight until the shard meets the deck, one damped bounce, then a short slide.
        float g = ${GRAVITY.toFixed(1)};
        float drop = max(0., psOrigin.y - ${floorY.toFixed(3)});
        float t1 = (psVelocity.y + sqrt(psVelocity.y * psVelocity.y + 2. * g * drop)) / g;
        float bounceUp = (g * t1 - psVelocity.y) * .15;
        float t2 = 2. * bounceUp / g;
        vec3 psPos;
        float spinTime;
        if (psAge < t1) {
          psPos = psOrigin + psVelocity * psAge - vec3(0., .5 * g * psAge * psAge, 0.);
          spinTime = psAge;
        } else {
          vec3 landing = psOrigin + psVelocity * t1 - vec3(0., .5 * g * t1 * t1, 0.);
          landing.y = ${floorY.toFixed(3)};
          vec2 skid = psVelocity.xz * .45;
          float tb = psAge - t1;
          if (tb < t2) {
            psPos = landing + vec3(skid.x * tb, bounceUp * tb - .5 * g * tb * tb, skid.y * tb);
            spinTime = t1 + tb * .6;
          } else {
            float slide = (1. - exp(-(tb - t2) * 5.)) / 5.;
            psPos = landing + vec3(skid.x * (t2 + slide * .5), 0., skid.y * (t2 + slide * .5));
            spinTime = t1 + t2 * .6;
          }
        }
        float psShrink = psAlive * (1. - smoothstep(.35, 1., psAge / max(psLife, .001)));
        vec3 psAxis = normalize(psSpin.xyz + 1e-4);
        float psAngle = psSpin.w * spinTime;
        vShardTint = psTint; vShardGlow = psGlow * (1. - smoothstep(.0, .75, psAge / max(psLife, .001)));
        vec3 objectNormal = psRotate(normal, psAxis, psAngle);
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = psRotate(position * psScale * psShrink, psAxis, psAngle) + psPos;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vShardTint; varying float vShardGlow;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vShardTint;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += normalize(vShardTint + 1e-4) * vShardGlow * 1.6;')
  }
  material.customProgramCacheKey = () => 'playsense-shatter-v1'
  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = 3

  let cursor = 0, seed = 11
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const glass = new THREE.Color(), light = new THREE.Color()
  const flagAll = () => { for (const name of Object.keys(layout)) geometry.getAttribute(name).needsUpdate = true }

  return {
    mesh,
    /** Break a note of the given footprint where it was struck. */
    burst(x: number, y: number, z: number, width: number, depth: number, color: THREE.Color, grade: HitGrade) {
      if (grade === 'miss') return
      const power = grade === 'perfect' ? 1 : grade === 'good' ? .75 : .5
      glass.copy(color).multiplyScalar(.45).addScalar(.08)
      light.copy(color).multiplyScalar(1.1)
      const columns = 4, rows = 2
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const fromLight = column > 0 && column < columns - 1 && row === 0
        const u = (column + .5) / columns - .5, v = (row + .5) / rows - .5
        const i = cursor++ % capacity
        const px = x + u * width + (random() - .5) * .08, pz = z + v * depth
        const outward = (u * 2) * (.8 + random() * .9) * power
        arrays.psOrigin.set([px, y + (fromLight ? .08 : 0), pz], i * 3)
        arrays.psVelocity.set([outward + (random() - .5) * .3, (.9 + random() * 1.1) * (.6 + power * .4), v * .6 - .5 - random() * .8 * power], i * 3)
        arrays.psSpin.set([random() - .5, random() - .5, random() - .5, (2.5 + random() * 4) * (random() < .5 ? -1 : 1)], i * 4)
        const size = width / columns
        arrays.psScale.set([size * (.6 + random() * .4), .09 + random() * .04, depth / rows * (.6 + random() * .4)], i * 3)
        arrays.psBirth[i] = time.value
        arrays.psLife[i] = .45 + random() * .2
        const tint = fromLight ? light : glass
        arrays.psTint.set([tint.r, tint.g, tint.b], i * 3)
        arrays.psGlow[i] = fromLight ? .45 + power * .25 : .06
      }
      flagAll()
    },
    update(dt: number) { time.value += dt },
    reset() { arrays.psBirth.fill(-1e5); geometry.getAttribute('psBirth').needsUpdate = true },
  }
}
