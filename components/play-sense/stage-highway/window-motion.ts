import * as THREE from 'three'

const curtainBreeze = `
  float drop = clamp((6.15 - p.y) / 6.05, 0., 1.);
  float weight = pow(drop, 1.35);
  float side = sign(p.x);
  float breeze = sin(psWindowTime * .85 - p.y * .4 + side * 1.4);
  p.x += weight * (.2 * breeze + .055 * sin(psWindowTime * 1.7 + p.y));
  p.z += weight * (.16 + .22 * breeze + .035 * sin(p.y * 3. + psWindowTime * 1.2));
  p.y += weight * .025 * sin(psWindowTime * .85 + side);
`

const palmBreeze = `
  vec3 crown = p.x < 0. ? vec3(-4.49, 3.65, -28.58) : vec3(4.41, 2.95, -28.88);
  // The material also contains rooftop aerials; only fronds around a crown move.
  float crownMask = step(2.25, p.y) * (1. - smoothstep(1.45, 1.65, distance(p, crown)));
  float tip = smoothstep(0., 1.1, length(p.xz - crown.xz)) * crownMask;
  float breeze = sin(psWindowTime * 1.05 + crown.x * .4);
  p.x += tip * (.18 * breeze + .045 * sin(psWindowTime * 1.9 + p.z * 3.));
  p.y += tip * .09 * sin(psWindowTime * 1.05 + p.x * .8);
  p.z += tip * .12 * breeze;
`

const cloudShader = `
  uniform float psWindowTime;
  float psHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float psNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    return mix(mix(psHash(cell), psHash(cell + vec2(1., 0.)), f.x),
      mix(psHash(cell + vec2(0., 1.)), psHash(cell + vec2(1., 1.)), f.x), f.y);
  }
  float psCloud(vec2 uv) {
    vec2 p = uv * vec2(3.2, 12.) + vec2(psWindowTime * .024, 1.3);
    float wisps = psNoise(p) * .65 + psNoise(p * 2.1 + 4.) * .25 + psNoise(p * 4.2) * .1;
    float sky = smoothstep(.4, .57, uv.y) * (1. - smoothstep(.9, 1., uv.y));
    return smoothstep(.49, .76, wisps) * sky * .26;
  }
`

/** Animate the existing Blender surfaces without rebuilding or uploading vertices each frame. */
export function animateStudioWindow(entrance: THREE.Object3D) {
  const time = { value: 0 }
  const configured = new Set<THREE.Material>()
  entrance.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      const kind = material.name.includes('Window linen') ? 'curtain' :
        material.name.includes('Evening foliage') ? 'palm' : material.name.includes('Window dusk sky') ? 'sky' : null
      if (!kind) continue
      if (kind !== 'sky') {
        // Keep the expensive room shadow bake static; moving fabric/fronds cast no frozen shadow.
        object.castShadow = false
        object.geometry.computeBoundingSphere()
        if (object.geometry.boundingSphere) object.geometry.boundingSphere.radius += .5
      }
      if (configured.has(material)) continue
      configured.add(material)
      material.onBeforeCompile = shader => {
        shader.uniforms.psWindowTime = time
        if (kind === 'sky') {
          shader.fragmentShader = cloudShader + shader.fragmentShader
          shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.55, .57, .52), psCloud(vMapUv));`)
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
            totalEmissiveRadiance = mix(totalEmissiveRadiance, vec3(.44, .46, .42), psCloud(vEmissiveMapUv));`)
        } else {
          shader.vertexShader = `uniform float psWindowTime;
            vec3 psDisplace(vec3 p) { ${kind === 'curtain' ? curtainBreeze : palmBreeze} return p; }
            ` + shader.vertexShader
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = psDisplace(position);')
          // Match the lit surface normal to the bending geometry, including the linen normal map.
          shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
            vec3 psN = normalize(objectNormal);
            vec3 psT = normalize(cross(psN, abs(psN.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));
            vec3 psB = cross(psN, psT);
            vec3 psOrigin = psDisplace(position);
            vec3 psBentT = psDisplace(position + psT * .01) - psOrigin;
            vec3 psBentB = psDisplace(position + psB * .01) - psOrigin;
            objectNormal = normalize(cross(psBentT, psBentB));
            #ifdef USE_TANGENT
              objectTangent = normalize(psDisplace(position + objectTangent * .01) - psOrigin);
            #endif`)
        }
      }
      material.customProgramCacheKey = () => `playsense-window-${kind}-v1`
      material.needsUpdate = true
    }
  })
  return { update(dt: number) { time.value += dt } }
}
