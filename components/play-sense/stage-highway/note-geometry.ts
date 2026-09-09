import * as THREE from 'three'

/** glTF emissive faces need the same instance tint as their physical base color. */
export function colorNoteEmission(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_COLOR
        totalEmissiveRadiance *= vColor.rgb;
      #endif`)
  }
  material.customProgramCacheKey = () => 'playsense-lane-emission-v1'
  material.needsUpdate = true
}

export function entranceGlow(): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: { phase: { value: 0 }, motion: { value: 1 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float phase; uniform float motion;
      void main(){
        float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);
        float mist=pow(1.-vUv.y,3.)*smoothstep(0.,.06,vUv.y);
        float rays=.7+.3*pow(.5+.5*sin(vUv.x*72.+phase*motion),6.);
        gl_FragColor=vec4(vec3(.94,.8,.57),edge*mist*rays*.16);
      }`,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10.7, .7), material)
  mesh.position.set(0, .27, -25.02)
  mesh.visible = false
  return mesh
}

/** A machined, eight-sided note chassis. The face points up the same plane as the runway. */
export function noteGemGeometry(height: number, inset = 0): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  const x = .5 - inset, z = .39 - inset, bevel = .13
  shape.moveTo(-x + bevel, -z)
  shape.lineTo(x - bevel, -z); shape.lineTo(x, -z + bevel)
  shape.lineTo(x, z - bevel); shape.lineTo(x - bevel, z)
  shape.lineTo(-x + bevel, z); shape.lineTo(-x, z - bevel)
  shape.lineTo(-x, -z + bevel); shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height, steps: 1, bevelEnabled: true, bevelSegments: 2,
    bevelSize: .025, bevelThickness: .025, curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, -height / 2, 0)
  return geometry
}

/** An inlaid arrow gives the notes a consistent leading edge, even without bloom. */
export function noteChevronGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape()
  shape.moveTo(-.28, .04); shape.lineTo(0, -.1); shape.lineTo(.28, .04)
  shape.lineTo(.28, .11); shape.lineTo(0, -.03); shape.lineTo(-.28, .11); shape.closePath()
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2)
}

export function noteTrailTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64; canvas.height = 256
  const ctx = canvas.getContext('2d')!
  const fade = ctx.createLinearGradient(0, 0, 0, 256)
  fade.addColorStop(0, 'rgba(255,255,255,0)')
  fade.addColorStop(.4, 'rgba(255,255,255,.05)')
  fade.addColorStop(1, 'rgba(255,255,255,.6)')
  ctx.fillStyle = fade; ctx.globalAlpha = .35; ctx.fillRect(0, 0, 64, 256)
  ctx.globalAlpha = 1
  ctx.fillRect(0, 0, 2, 256); ctx.fillRect(62, 0, 2, 256)
  return new THREE.CanvasTexture(canvas)
}

export function strikeAura(color: THREE.Color): THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> {
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: color.clone() }, energy: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform vec3 tint; uniform float energy;
      void main(){
        float width=pow(max(0.,1.-abs(vUv.x-.5)*2.),2.);
        float height=pow(1.-vUv.y,2.2)*smoothstep(0.,.06,vUv.y);
        float rays=.55+.45*pow(.5+.5*cos(vUv.x*62.8),8.);
        gl_FragColor=vec4(tint*1.7,width*height*rays*energy*.75);
      }`,
  })
  const geometry = new THREE.PlaneGeometry(1, 1)
  geometry.translate(0, .5, 0)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.visible = false
  return mesh
}
