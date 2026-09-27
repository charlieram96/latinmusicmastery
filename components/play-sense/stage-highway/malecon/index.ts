import * as THREE from 'three'
import { bakeSkyEnvironment, createSea, createSkyDome, createSunStreak, skyUniforms, SUN_DIRECTION } from './sky'
import { createCity } from './city'
import { createPalms } from './palms'
import { ARCH_Z, createSet, DECK_TOP, TERRACE_Y, type BeatUniforms } from './set'
import { createFireworks } from './fireworks'

export { laneLightTexture, NOTE_LAYOUT, noteCore, noteHead, notePool, tunnelTexture } from './notes'
export { createComposer } from './post'
export { ARCH_Z, DECK_TOP, TERRACE_Y }

export interface MaleconFrame { elapsed: number; beatSeconds: number; speed: number; hitZ: number; playing: boolean; energy: number; dt: number }

/**
 * Open-air stage on Havana's seawall at dusk. Owns its lights, sky, sea, skyline,
 * palms, pier set and fireworks; all resources are parented to the scene so the
 * renderer's normal teardown releases them.
 */
export function buildMalecon(renderer: THREE.WebGLRenderer, scene: THREE.Scene, options: { farZ: number; quality: 'standard' | 'low'; reducedMotion: boolean }) {
  const motion = !options.reducedMotion
  const low = options.quality === 'low'
  const sky = skyUniforms(motion)
  const environment = bakeSkyEnvironment(renderer)
  scene.environment = environment.texture
  scene.environmentIntensity = .75
  scene.background = new THREE.Color(0x120d22)
  scene.fog = new THREE.Fog(0x3a2340, 40, 180)

  const dome = createSkyDome(sky)
  scene.add(dome)
  scene.add(createSea(sky))
  const streak = createSunStreak()
  if (!low) scene.add(streak.mesh)
  const city = createCity(sky, motion)
  scene.add(city.group)

  // Dusk light: violet sky fill, the low sun behind the arch, a warm stage wash from the front.
  scene.add(new THREE.HemisphereLight(0x8c86d6, 0x3b2418, .9))
  const sun = new THREE.DirectionalLight(0xff9a55, 1.1)
  sun.position.copy(SUN_DIRECTION).multiplyScalar(60); scene.add(sun)
  const wash = new THREE.DirectionalLight(0xffe0bd, 1.55)
  wash.position.set(5, 16, 17); wash.target.position.set(0, -1, -6)
  scene.add(wash, wash.target)
  if (!low) {
    wash.castShadow = true
    wash.shadow.mapSize.set(2048, 2048)
    Object.assign(wash.shadow.camera, { left: -16, right: 16, top: 20, bottom: -16, near: 2, far: 70 })
    wash.shadow.camera.updateProjectionMatrix()
    wash.shadow.bias = -.0003; wash.shadow.normalBias = .04
  }
  const archLight = new THREE.PointLight(0xff8f5c, 60, 26, 1.8)
  archLight.position.set(0, 3.5, ARCH_Z + 2.5); scene.add(archLight)

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
    { x: -11.6, z: 1.4, ground: TERRACE_Y, height: 11.8, lean: .13, heading: Math.PI * .96, seed: 1 },
    { x: -16.8, z: -.5, ground: TERRACE_Y, height: 13.8, lean: .09, heading: Math.PI * .82, seed: 2 },
    { x: 12, z: 1.1, ground: TERRACE_Y, height: 12.6, lean: .14, heading: .06, seed: 3 },
    { x: 17.2, z: -.3, ground: TERRACE_Y, height: 10.9, lean: .1, heading: -.3, seed: 4 },
    { x: -25, z: .5, ground: TERRACE_Y, height: 15, lean: .07, heading: Math.PI, seed: 5 },
    { x: 26, z: .8, ground: TERRACE_Y, height: 13.4, lean: .09, heading: .25, seed: 6 },
  ], motion)
  scene.add(palms.group)

  const fireworks = createFireworks()
  scene.add(fireworks.points)

  let clock = 0, pulse = 0
  return {
    environment,
    fireworks,
    update(frame: MaleconFrame, camera: THREE.Camera) {
      clock += frame.dt
      dome.position.copy(camera.position)
      streak.update(camera)
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
      archLight.intensity = 55 + pulse * 18 + frame.energy * 40
      for (const light of lampLights) light.intensity = 16 + frame.energy * 6
      city.update(frame.dt, camera)
      palms.update(frame.dt)
      if (motion) fireworks.update(frame.dt)
    },
  }
}
