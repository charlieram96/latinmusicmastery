import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { DECK_TOP } from './set'

/** Heights of each note layer above the runway, so the render loop places them consistently. */
export const NOTE_LAYOUT = { head: DECK_TOP + .13, core: DECK_TOP + .245, pool: DECK_TOP + .006, poolLength: 1.9 }

/** Smoked glass capsule under a clearcoat with a faint pearlescent sheen; carries a lane-coloured light on top. */
export function noteHead() {
  return {
    geometry: new RoundedBoxGeometry(1, .22, .58, 4, .1),
    material: new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: .15, roughness: .32, envMapIntensity: .45, clearcoat: 1, clearcoatRoughness: .08, iridescence: .55, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 420] }),
  }
}

/** The light insert. Emission follows the instance colour and burns white along its spine. */
export function noteCore() {
  const material = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveIntensity: 1, roughness: .3 })
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 psLocal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\npsLocal = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 psLocal;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          float psSpine = pow(max(0., 1. - abs(psLocal.z) / .24), 3.) * pow(max(0., 1. - abs(psLocal.x) / .45), .5);
          // Bevelled rim: the insert's outline burns brighter, like cut glass catching light.
          float psEdge = max(smoothstep(.36, .45, abs(psLocal.x)), smoothstep(.17, .24, abs(psLocal.z)));
          totalEmissiveRadiance = vColor.rgb * (.95 + psEdge * .9) + mix(vColor.rgb, vec3(1., .97, .9), .45) * psSpine * 1.9;
        #endif`)
  }
  material.customProgramCacheKey = () => 'playsense-miami-core-v2'
  return { geometry: new RoundedBoxGeometry(.9, .07, .48, 3, .03), material }
}

function poolTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,255,255,.9)')
  gradient.addColorStop(.25, 'rgba(255,255,255,.45)')
  gradient.addColorStop(.6, 'rgba(255,255,255,.1)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

/** An additive pool of light cast onto the lacquer around each travelling note. */
export function notePool() {
  return {
    geometry: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    material: new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, opacity: .6, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  }
}

/** Lane light: brightest at the strike line and fading up the runway (or symmetric for the halo). */
export function laneLightTexture(symmetric = false) {
  const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const along = ctx.createLinearGradient(0, 0, 0, 256)
  if (symmetric) {
    along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(.5, 'rgba(255,255,255,1)'); along.addColorStop(1, 'rgba(255,255,255,0)')
  } else {
    along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(.75, 'rgba(255,255,255,.35)'); along.addColorStop(1, 'rgba(255,255,255,1)')
  }
  ctx.fillStyle = along; ctx.fillRect(0, 0, 64, 256)
  ctx.globalCompositeOperation = 'destination-in'
  const across = ctx.createLinearGradient(0, 0, 64, 0)
  across.addColorStop(0, 'rgba(0,0,0,0)'); across.addColorStop(.5, 'rgba(0,0,0,1)'); across.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = across; ctx.fillRect(0, 0, 64, 256)
  return new THREE.CanvasTexture(canvas)
}

/** Alpha ramp for the lane's darkening tunnel: strong at the archway, clear at the strike line. */
export function tunnelTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 4; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const ramp = ctx.createLinearGradient(0, 0, 0, 256)
  ramp.addColorStop(0, '#fff'); ramp.addColorStop(.45, '#9a9a9a'); ramp.addColorStop(.85, '#1a1a1a'); ramp.addColorStop(1, '#000')
  ctx.fillStyle = ramp; ctx.fillRect(0, 0, 4, 256)
  return new THREE.CanvasTexture(canvas)
}
