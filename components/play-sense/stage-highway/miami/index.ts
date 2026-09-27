import * as THREE from 'three'
import { bakeSkyEnvironment, createSea, createSkyDome, skyUniforms, SUN_DIRECTION } from './sky'
import { createSkyline } from './skyline'
import { createPalms } from './palms'
import { GATE_Z, createSet, DECK_TOP, TERRACE_Y, type BeatUniforms } from './set'
import { createFireworks } from './fireworks'

export { laneLightTexture, NOTE_LAYOUT, noteCore, noteHead, notePool, tunnelTexture } from './notes'
export { createComposer } from './post'
export { createHitFx } from './fx'
export { GATE_Z, DECK_TOP, TERRACE_Y }

export interface StageAmbience { elapsed: number; beatSeconds: number; speed: number; hitZ: number; playing: boolean; energy: number; dt: number }

/**
 * Open-air stage on Miami's bayfront just after sunset. Owns its lights, sky, sea, skyline,
 * palms, pier set and fireworks; all resources are parented to the scene so the
 * renderer's normal teardown releases them.
 */
export function buildMiami(renderer: THREE.WebGLRenderer, scene: THREE.Scene, options: { farZ: number; quality: 'standard' | 'low'; reducedMotion: boolean }) {
  const motion = !options.reducedMotion
  const low = options.quality === 'low'
  const sky = skyUniforms(motion)
  const environment = bakeSkyEnvironment(renderer)
  scene.environment = environment.texture
  scene.environmentIntensity = .75
  scene.background = new THREE.Color(0x120d22)
  scene.fog = new THREE.Fog(0x3b1f45, 40, 180)

  const dome = createSkyDome(sky)
  scene.add(dome)
  scene.add(createSea(sky))
  const skyline = createSkyline(sky, motion)
  scene.add(skyline.group)

  // Dusk light: violet sky fill, the low sun behind the arch, a warm stage wash from the front.
  scene.add(new THREE.HemisphereLight(0x9d86e0, 0x3a2030, .95))
  const sun = new THREE.DirectionalLight(0xff8a6a, .7)
  sun.position.copy(SUN_DIRECTION).multiplyScalar(60); scene.add(sun)
  const wash = new THREE.DirectionalLight(0xffd9c4, 1.25)
  wash.position.set(5, 16, 17); wash.target.position.set(0, -1, -6)
  scene.add(wash, wash.target)
  if (!low) {
    wash.castShadow = true
    wash.shadow.mapSize.set(2048, 2048)
    Object.assign(wash.shadow.camera, { left: -16, right: 16, top: 20, bottom: -16, near: 2, far: 70 })
    wash.shadow.camera.updateProjectionMatrix()
    wash.shadow.bias = -.0003; wash.shadow.normalBias = .04
  }
  const gateLight = new THREE.PointLight(0xff7fb0, 26, 20, 1.8)
  gateLight.position.set(0, 1.6, GATE_Z + 2.5); scene.add(gateLight)

  const beat: BeatUniforms = {
    psElapsed: { value: 0 }, psBeat: { value: .6 }, psSpeed: { value: 8 }, psHitZ: { value: 3.6 },
    psLive: { value: 0 }, psEnergy: { value: 0 }, psClock: { value: 0 },
  }
  const set = createSet(beat, options.farZ, options.quality)
  scene.add(set.group)
  const lampLights = set.lampGlobes.filter(p => Math.abs(p.x) < 10).map(p => {
    const light = new THREE.PointLight(0xffb36b, 16, 15, 1.6)
    light.position.copy(p).add(new THREE.Vector3(0, -.3, .4)); scene.add(light)
    return light
  })

  const palms = createPalms([
    { x: -13.2, z: -.1, ground: TERRACE_Y, height: 16, kind: 'royal', seed: 1 },
    { x: -18.2, z: 1.2, ground: TERRACE_Y, height: 12, kind: 'coconut', lean: .2, heading: -.15, seed: 3 },
    { x: -22.5, z: -.2, ground: TERRACE_Y, height: 18.5, kind: 'royal', seed: 2 },
    { x: 13.6, z: -.1, ground: TERRACE_Y, height: 17, kind: 'royal', seed: 4 },
    { x: 18.6, z: 1, ground: TERRACE_Y, height: 12.5, kind: 'coconut', lean: .2, heading: Math.PI + .2, seed: 5 },
    { x: 23, z: -.3, ground: TERRACE_Y, height: 15, kind: 'royal', seed: 6 },
  ], motion)
  scene.add(palms.group)

  const fireworks = createFireworks()
  for (const mesh of fireworks.meshes) scene.add(mesh)

  let clock = 0, pulse = 0
  return {
    environment,
    fireworks,
    update(frame: StageAmbience, camera: THREE.Camera) {
      clock += frame.dt
      dome.position.copy(camera.position)
      if (motion) sky.psTime.value = clock
      beat.psClock.value = clock
      beat.psElapsed.value = frame.elapsed
      beat.psBeat.value = frame.beatSeconds
      beat.psSpeed.value = frame.speed
      beat.psHitZ.value = frame.hitZ
      beat.psLive.value = motion && frame.playing ? 1 : 0
      beat.psEnergy.value = frame.energy
      const phase = Math.max(0, frame.elapsed) / frame.beatSeconds
      pulse = motion && frame.playing && frame.elapsed >= 0 ? Math.pow(1 - phase % 1, 3) : 0
      set.update(pulse, frame.energy)
      gateLight.intensity = 22 + pulse * 10 + frame.energy * 22
      for (const light of lampLights) light.intensity = 16 + frame.energy * 6
      skyline.update(frame.dt)
      palms.update(frame.dt)
      if (motion) fireworks.update(frame.dt)
    },
  }
}
