import * as THREE from 'three'
import { NOISE, SKY } from './glsl'

export const SEA_Y = -3.9
/** The sun has just gone down behind the skyline, straight down the runway. */
export const SUN_DIRECTION = new THREE.Vector3(.08, Math.sin(THREE.MathUtils.degToRad(-1.6)), -1).normalize()

export interface SkyUniforms {
  psSunDir: { value: THREE.Vector3 }
  psTime: { value: number }
  psCloudMotion: { value: number }
}

export function skyUniforms(motion: boolean): SkyUniforms {
  return { psSunDir: { value: SUN_DIRECTION.clone() }, psTime: { value: 0 }, psCloudMotion: { value: motion ? 1 : 0 } }
}

const OUTPUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`

/** A camera-centred dome drawn at the far plane: one draw call, no depth cost. */
export function createSkyDome(uniforms: SkyUniforms) {
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        gl_Position = clip.xyww;
        gl_Position.z *= .99999;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDirection;
      ${SKY}
      void main() { gl_FragColor = vec4(psSky(vDirection), 1.); ${OUTPUT} }`,
  })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), material)
  dome.frustumCulled = false
  dome.renderOrder = -10
  return dome
}

/** Bake the sky once into a prefiltered environment for every physically based surface. */
export function bakeSkyEnvironment(renderer: THREE.WebGLRenderer) {
  const scene = new THREE.Scene()
  const dome = createSkyDome(skyUniforms(false))
  dome.material.side = THREE.BackSide
  scene.add(dome)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const target = pmrem.fromScene(scene, 0.012, 0.1, 400)
  pmrem.dispose(); dome.geometry.dispose(); dome.material.dispose()
  return target
}

/**
 * Open water to the horizon. Normals come from a handful of travelling swells,
 * so the sun's reflection breaks into a glittering path without any textures.
 */
export function createSea(uniforms: SkyUniforms) {
  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    fog: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vWorld;
      ${SKY}
      vec2 swell(vec2 p, vec2 direction, float frequency, float amplitude, float speed) {
        float phase = dot(p, direction) * frequency + psTime * speed * psCloudMotion;
        return direction * cos(phase) * amplitude * frequency;
      }
      void main() {
        vec3 toSurface = vWorld - cameraPosition;
        float dist = length(toSurface.xz);
        vec3 view = normalize(toSurface);
        vec2 p = vWorld.xz;
        vec2 slope = swell(p, normalize(vec2(.25, 1.)), .22, .07, 1.1)
          + swell(p, normalize(vec2(-.6, .8)), .41, .045, 1.6)
          + swell(p, normalize(vec2(.9, .45)), .83, .022, 2.3)
          + swell(p, normalize(vec2(-.2, -1.)), 1.7, .011, 3.1);
        vec2 ripple = vec2(psNoise(p * 1.9 + psTime * .35 * psCloudMotion), psNoise(p.yx * 2.3 - psTime * .3 * psCloudMotion)) - .5;
        slope += ripple * .07;
        // Cat's paws: broad patches of ruffled water between glassy calm stretches.
        float gust = smoothstep(.3, .78, psNoise(p * .016 + vec2(psTime * .012, psTime * .004) * psCloudMotion));
        slope *= mix(.35, 1.1, gust);
        // Distant water flattens into a mirror; close water keeps its chop.
        slope *= 1. / (1. + dist * .018);
        vec3 normal = normalize(vec3(-slope.x, 1., -slope.y));
        vec3 reflected = reflect(view, normal);
        reflected.y = max(reflected.y, .004);
        float facing = max(dot(normal, -view), 0.);
        float fresnel = .02 + .98 * pow(max(0., 1. - facing), 5.);
        vec3 deep = vec3(.003, .008, .024) + vec3(.012, .03, .05) * pow(max(dot(view, -psSunDir), 0.), 2.);
        vec3 color = mix(deep, psSky(reflected), fresnel);
        float glint = pow(max(dot(reflected, psSunDir), 0.), 420.);
        color += vec3(3., 1.3, .5) * glint * (.4 + .6 * psNoise(p * 6. + psTime * psCloudMotion));
        color *= mix(.7, 1., smoothstep(10., 70., dist));
        // Dissolve the far edge into the horizon haze.
        vec3 horizonDir = normalize(vec3(view.x, .002, view.z));
        color = mix(color, psSkyClear(horizonDir), smoothstep(160., 900., dist));
        gl_FragColor = vec4(color, 1.);
        ${OUTPUT}
      }`,
  })
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1400, 1, 1).rotateX(-Math.PI / 2), material)
  sea.position.set(0, SEA_Y, -700)
  sea.renderOrder = -5
  // Nothing below the waterline is drawn, so the sea skips depth and lets reflections lie on it.
  material.depthWrite = false
  return sea
}

export { NOISE }
