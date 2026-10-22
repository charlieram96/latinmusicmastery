import * as THREE from 'three'
import type { StageCity } from '../cities'
import { SEA_Y } from './sky'

/** Camera-oriented distant environment and world-space foreground share one horizon. */
export function cityPanorama(city: StageCity, motion: boolean) {
  const ny = city === 'new-york'
  const texture = new THREE.TextureLoader().load(`/playsense/environments/${ny ? 'new-york-day' : 'los-angeles-sunset'}.png`)
  texture.colorSpace = THREE.SRGBColorSpace
  const uniforms = {
    panorama: { value: texture }, clock: { value: 0 },
    inverseProjection: { value: new THREE.Matrix4() }, cameraWorld: { value: new THREE.Matrix4() },
  }
  const sampling = `
    uniform sampler2D panorama; uniform float clock;
    vec3 environment(vec3 ray) {
      float elevation=atan(ray.y,length(ray.xz));
      vec2 p=vec2(.5+atan(ray.x,-ray.z)/2.15, ${ny ? '.415' : '.62'}+elevation/.38);
      // Slow cloud drift only in the sky; buildings and hills stay fixed.
      float sky=smoothstep(${ny ? '.78,.92' : '.8,.96'},p.y);
      p.x+=sin(clock*.018)*.006*sky;
      vec3 color=texture2D(panorama,clamp(p,vec2(.002),vec2(.998))).rgb;
      float beyond=smoothstep(.91,1.0,p.y);
      color=mix(vec3(${ny ? '.018,.13,.20' : '.16,.12,.055'}),color,smoothstep(-.04,.07,p.y));
      return mix(color,vec3(${ny ? '.24,.49,.68' : '.45,.17,.08'}),beyond);
    }`
  const material = new THREE.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false,
    vertexShader: `uniform mat4 inverseProjection;uniform mat4 cameraWorld;varying vec3 ray;
      void main(){vec4 p=inverseProjection*vec4(position.xy,1.,1.);ray=mat3(cameraWorld)*p.xyz;gl_Position=vec4(position.xy,1.,1.);}`,
    fragmentShader: `${sampling} varying vec3 ray;void main(){gl_FragColor=vec4(environment(normalize(ray)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  })
  material.addEventListener('dispose', () => texture.dispose())
  const mesh = new THREE.Group()
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material)
  backdrop.frustumCulled=false;backdrop.renderOrder=-100
  backdrop.onBeforeRender=(_renderer,_scene,camera)=>{
    if(camera instanceof THREE.PerspectiveCamera){uniforms.inverseProjection.value.copy(camera.projectionMatrixInverse);uniforms.cameraWorld.value.copy(camera.matrixWorld)}
  }
  mesh.add(backdrop)
  const groundMaterial=new THREE.ShaderMaterial({
    uniforms, side:THREE.DoubleSide,
    vertexShader:`varying vec3 world;void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`${sampling} varying vec3 world;
      void main(){
        vec3 view=normalize(world-cameraPosition);
        float distanceToEye=length(world-cameraPosition);
        ${ny ? `
        vec2 p=world.xz;
        float t=clock;
        vec2 slope=vec2(cos(p.x*.39+p.y*.17+t*1.15)*.045+cos(p.x*.85-p.y*.41+t*1.8)*.021,
          cos(p.y*.57+p.x*.13+t*1.3)*.055+cos(p.y*1.43+t*2.1)*.013);
        slope*=.45/(1.+distanceToEye*.002);
        vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
        vec3 reflected=reflect(view,normal);
        float fresnel=.06+.94*pow(1.-max(0.,dot(-view,normal)),5.);
        vec3 color=mix(vec3(.018,.13,.20),environment(reflected),fresnel*.4);
        float sparkle=pow(max(0.,dot(reflected,normalize(vec3(-.5,.65,-.5)))),220.);
        color+=vec3(.85,.9,.8)*sparkle;
        ` : `
        // A landscaped hillside supports the overlook instead of a floating stage.
        float grain=(fract(sin(dot(floor(world.xz*6.),vec2(12.9898,78.233)))*43758.5453)-.5)*.012;
        vec3 color=vec3(.16,.12,.055)+grain;
        float road=1.-smoothstep(.5,1.1,abs(world.x+18.+sin(world.z*.025)*9.));
        color=mix(color,vec3(.095,.078,.065),road);
        float car=pow(max(0.,cos(world.z*.21+clock*.8)),48.)*road;
        color+=vec3(1.,.48,.12)*car*.3;
        `}
        float haze=smoothstep(45.,${ny ? '700.' : '170.'},distanceToEye);
        color=mix(color,environment(view),${ny ? 'haze' : '.72+.28*haze'});
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(2400,1800,ny?1:48,ny?1:48).rotateX(-Math.PI/2),groundMaterial)
  ground.position.set(0,SEA_Y,-650)
  if(!ny){
    const p=ground.geometry.getAttribute('position')
    for(let i=0;i<p.count;i++) {const z=p.getZ(i)-650;p.setY(i,-Math.max(0,-z-25)*.19+Math.sin(p.getX(i)*.014)*Math.min(7,Math.max(0,-z-30)*.025))}
    ground.geometry.computeVertexNormals()
  }
  mesh.add(ground)
  return {mesh,update(dt:number){if(motion)uniforms.clock.value+=dt}}
}
