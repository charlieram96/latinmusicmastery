import { ShaderMaterial, Engine, Scene, FreeCamera, Vector3, Color3, Color4, MeshBuilder, Mesh, TransformNode, PBRMaterial, StandardMaterial, DynamicTexture, Texture, CubeTexture, HemisphericLight, DirectionalLight, PointLight, ShadowGenerator, DefaultRenderingPipeline, GlowLayer, VertexData } from '@babylonjs/core'
import { observeFrameResize, stagePageZoom } from './frame-resize'
import { STAGE_THEMES } from './themes'
import type { ExerciseDefinition } from '@/lib/play-sense/types'
import { PERCUSSION_GLYPHS } from '@/lib/playsense-studio/percussion-noteheads'
import { createStageModel, firstVisibleNote, APPROACH_SECONDS, HIT_Z, type StageNote } from './model'
import { beatLinePositions, type StageRendererOptions } from './StageRenderer'

// Shorter visual runway; musical arrival times still come from the shared model.
const FAR_Z = -10
const c=(hex:string)=>Color3.FromHexString(hex)
const random=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v)}
/** Presentation-only adapter. Musical time and judgments remain owned by PlaySense. */
export class BabylonMiamiRenderer {
  private engine:Engine
  private scene:Scene
  private camera:FreeCamera
  private canvas:HTMLCanvasElement
  private observer:ReturnType<typeof observeFrameResize>
  private disposed=false
  private notes:StageNote[]=[]
  private noteMeshes:Mesh[]=[]
  private noteMaterials=new Map<string,StandardMaterial>()
  private beatLines:Mesh[]=[]
  private tails:Mesh[]=[]
  private labels:Mesh[]=[]
  private instruments:TransformNode[]=[]
  private judgment=new Map<number,string>()
  private attempt=-1
  private pulse:number[]=[]
  private slow=0
  private fast=0
  private scale=1
  private maxRatio=1
  private pipeline:DefaultRenderingPipeline
  private shadow:ShadowGenerator
  private chrome:PBRMaterial
  private dark:PBRMaterial
  private width=16.8
  private bases:Mesh[]=[]
  private impactRings:Mesh[]=[]
  private sparks:Mesh[][]=[]
  private boats:TransformNode[]=[]
  private water:ShaderMaterial|undefined
  private visualTime=0
  private telemetryTime=0
  private telemetryFrames=0
  private lastElapsed:number|undefined
  private lanes:ReturnType<typeof createStageModel>['lanes']
  constructor(private host:HTMLElement,private exercise:ExerciseDefinition,private options:StageRendererOptions){
    this.canvas=document.createElement('canvas');this.canvas.style.cssText='width:100%;height:100%;display:block;outline:none';this.canvas.setAttribute('role','img');this.canvas.setAttribute('aria-label',`${exercise.title}: Babylon.js ${options.city ?? 'miami'} 3D note runway`);host.appendChild(this.canvas)
    this.engine=new Engine(this.canvas,options.quality!=='low',{preserveDrawingBuffer:false,stencil:true,powerPreference:'high-performance'},false)
    this.maxRatio=Math.min(window.devicePixelRatio||1,options.quality==='low'?1:2);this.scale=1/this.maxRatio;this.engine.setHardwareScalingLevel(this.scale)
    this.scene=new Scene(this.engine);this.scene.useRightHandedSystem=true;this.scene.clearColor=new Color4(.24,.32,.43,1)
    this.scene.environmentTexture=CubeTexture.CreateFromPrefilteredData('/playsense/environments/studio.env',this.scene);this.scene.environmentIntensity=.7
    this.scene.fogMode=Scene.FOGMODE_EXP2;this.scene.fogDensity=.0002;this.scene.fogColor=c('#8498a7')
    this.camera=new FreeCamera('performance-camera',new Vector3(0,5,20),this.scene);this.camera.minZ=.2;this.camera.maxZ=1500;this.camera.fov=52*Math.PI/180
    const fill=new HemisphericLight('sky-fill',new Vector3(0,1,0),this.scene);fill.intensity=.22;fill.diffuse=c('#d4e7ff');fill.groundColor=c('#465160')
    const sun=new DirectionalLight('late-sun',new Vector3(-.6,-1,.4),this.scene);sun.position.set(35,65,-55);sun.diffuse=c('#ffd3a1');sun.intensity=.32
    const front=new DirectionalLight('instrument-softbox',new Vector3(.1,-.35,-1),this.scene);front.intensity=1.1;front.diffuse=c('#ead8ff')
    const rim=new DirectionalLight('warm-metal-rim',new Vector3(-.8,-.5,.7),this.scene);rim.diffuse=c('#ffad42');rim.intensity=1.4
    if(options.city==='new-york'){fill.intensity=.55;sun.intensity=1.1;sun.diffuse=c('#fff5e5');front.diffuse=c('#eff5ff');rim.intensity=.75}
    if(options.city==='los-angeles'){fill.intensity=.32;sun.intensity=.75;sun.diffuse=c('#ffb568');front.diffuse=c('#ffe2c4')}
    this.shadow=new ShadowGenerator(options.quality==='low'?512:2048,sun);this.shadow.useBlurExponentialShadowMap=true;this.shadow.blurKernel=16;this.shadow.bias=.001
    this.chrome=this.pbr('polished-nickel','#d7dfe5',1,.19);this.dark=this.pbr('rubber','#151a20',.05,.76)
    this.pipeline=new DefaultRenderingPipeline('camera-finish',true,this.scene,[this.camera]);this.pipeline.fxaaEnabled=true;this.pipeline.samples=options.quality==='low'?1:2;this.pipeline.bloomEnabled=options.quality!=='low';this.pipeline.bloomThreshold=.8;this.pipeline.bloomWeight=.18
    this.scene.imageProcessingConfiguration.toneMappingEnabled=true;this.scene.imageProcessingConfiguration.toneMappingType=1;this.scene.imageProcessingConfiguration.exposure=1.0;this.scene.imageProcessingConfiguration.contrast=1.12
    const glow=new GlowLayer('soft-practical-lights',this.scene,{mainTextureRatio:.25});glow.intensity=.45
    this.environment()
    const model=createStageModel(exercise,options.laneOrder,options.locale,this.width,options.hiddenInstruments);this.lanes=model.lanes;this.notes=model.notes
    const floor=this.pbr('stage-wood','#584334',.1,.42);floor.albedoTexture=new Texture('/playsense/textures/dock.jpg',this.scene);(floor.albedoTexture as Texture).uScale=5;(floor.albedoTexture as Texture).vScale=12
    this.box('practice-deck',this.width+1,.5,14,0,-.45,-3.5,floor)
    const brass=this.pbr('brushed-bronze','#b49054',.8,.29)
    this.box('hit-line',this.width,.045,.11,0,.025,HIT_Z,this.emissive('warm-hit-line','#ffd28a',1.5))
    this.lanes.forEach((lane,i)=>{
      if(i>0)this.box('lane-inlay',.012,.015,13,(this.lanes[i-1].x+lane.x)/2,-.18,-3,brass)
      const instrument=this.instrument(lane.id);instrument.position.set(lane.x,.1,HIT_Z+1.1);const s=Math.min(1.72,lane.width/1.03);instrument.scaling.set(s,s*.8,s);this.instruments.push(instrument);this.pulse.push(0)
      const label=this.text(lane.label,640,192,'#fff2d5',84);label.position.set(lane.x,-1.05,HIT_Z+2.2);label.scaling.set(lane.width*1.38,1.0,1);this.labels.push(label);glow.addExcludedMesh(label)
      const color='#'+STAGE_THEMES[options.theme].colors[i%STAGE_THEMES[options.theme].colors.length].toString(16).padStart(6,'0')
      const fx=this.emissive('impact-light',color,3)
      const ring=MeshBuilder.CreateTorus('arrival-ring',{diameter:1.1,thickness:.045,tessellation:48},this.scene);ring.material=fx;ring.position.set(lane.x,.22,HIT_Z+1.1);ring.setEnabled(false);this.impactRings.push(ring)
      this.sparks.push(Array.from({length:8},()=>{const spark=MeshBuilder.CreateSphere('arrival-spark',{diameter:.075,segments:6},this.scene);spark.material=fx;spark.setEnabled(false);return spark}))

    })
    // Size the pool from the actual densest time window; never truncate a dense score.
    let first=0,capacity=1
    for(let i=0;i<this.notes.length;i++){while(this.notes[i].time-this.notes[first].time>APPROACH_SECONDS+1.5)first++;capacity=Math.max(capacity,i-first+1)}
    for(let i=0;i<capacity;i++){const m=MeshBuilder.CreatePlane('authored-note',{size:1},this.scene);m.billboardMode=Mesh.BILLBOARDMODE_ALL;m.setEnabled(false);this.noteMeshes.push(m)
      const base=this.box('luminous-note-base',1,.08,.7,0,.16,0,this.emissive('note-plinth','#174354',.5));base.setEnabled(false);this.bases.push(base)
    }
    const guide=this.emissive('beat-guides','#e7c591',.4);guide.alpha=.2
    for(let i=0;i<64;i++)this.beatLines.push(this.box('beat-guide',this.width,.012,.025,0,-.15,0,guide))
    const tailMaterial=this.emissive('duration-trail','#f9bc69',.7);tailMaterial.alpha=.35
    for(let i=0;i<capacity;i++){const tail=this.box('note-duration',.13,.02,1,0,.06,0,tailMaterial);tail.setEnabled(false);this.tails.push(tail)}
    this.observer=observeFrameResize(host,()=>this.resize());this.observer.flush()
    this.engine.runRenderLoop(this.render)
    this.engine.onContextLostObservable.add(()=>options.onError('The 3D graphics context was interrupted.'))
  }
  private pbr(name:string,hex:string,metallic:number,roughness:number){const m=new PBRMaterial(name,this.scene);m.albedoColor=c(hex);m.metallic=metallic;m.roughness=roughness;return m}
  private emissive(name:string,hex:string,power=1){const m=new StandardMaterial(name,this.scene);m.diffuseColor=c(hex);m.emissiveColor=c(hex).scale(power);m.disableLighting=true;return m}
  private box(name:string,w:number,h:number,d:number,x:number,y:number,z:number,material:PBRMaterial|StandardMaterial,parent?:TransformNode){const m=MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},this.scene);m.position.set(x,y,z);m.material=material;m.parent=parent??null;m.receiveShadows=true;return m}
  private cylinder(name:string,r:number,h:number,x:number,y:number,z:number,material:PBRMaterial|StandardMaterial,parent?:TransformNode,tessellation=48){const m=MeshBuilder.CreateCylinder(name,{diameter:r*2,height:h,tessellation},this.scene);m.position.set(x,y,z);m.material=material;m.parent=parent??null;return m}
  private ring(name:string,r:number,t:number,y:number,material:PBRMaterial,parent:TransformNode){const m=MeshBuilder.CreateTorus(name,{diameter:2*r,thickness:t,tessellation:80},this.scene);m.position.y=y;m.material=material;m.parent=parent;return m}
  private rod(name:string,a:Vector3,b:Vector3,r:number,material:PBRMaterial,parent?:TransformNode){const m=MeshBuilder.CreateTube(name,{path:[a,b],radius:r,tessellation:8,cap:Mesh.CAP_ALL},this.scene);m.material=material;m.parent=parent??null;return m}
  private text(value:string,w:number,h:number,color:string,fontSize:number){
    // Supersample the transparent nameplate; keep the world-space label size.
    const resolution=2
    const t=new DynamicTexture('label-text',{width:w*resolution,height:h*resolution},this.scene,true)
    t.hasAlpha=true
    const ctx=t.getContext()
    ctx.scale(resolution,resolution)
    ctx.clearRect(0,0,w,h)
    ctx.font=`700 ${fontSize}px system-ui`
    const size=fontSize*Math.min(1,(w-24)/Math.max(1,ctx.measureText(value).width))
    ctx.font=`700 ${size}px system-ui`
    const x=(w-ctx.measureText(value).width)/2,y=h*.68
    // A fine contour follows the letters only, keeping them readable over
    // reflections without a rectangular background or a blurred glow.
    ctx.lineJoin='round';ctx.lineWidth=3;ctx.strokeStyle='rgba(15,18,28,.85)'
    ctx.strokeText(value,x,y)
    ctx.fillStyle=color;ctx.fillText(value,x,y)
    t.update();t.anisotropicFilteringLevel=8
    const mat=new StandardMaterial('label',this.scene)
    mat.diffuseTexture=t;mat.emissiveTexture=t;mat.emissiveColor=Color3.White()
    mat.useAlphaFromDiffuseTexture=true;mat.disableLighting=true;mat.backFaceCulling=false
    const mesh=MeshBuilder.CreatePlane('label',{size:1},this.scene)
    mesh.material=mat;mesh.billboardMode=Mesh.BILLBOARDMODE_ALL
    return mesh
  }
  private instrument(id:string){
    const root=new TransformNode(id,this.scene)
    const chrome=this.chrome,dark=this.dark
    const edge=this.pbr('warm-polished-edge','#fff0cd',1,.1);edge.emissiveColor=c('#ffbd65').scale(.18)
    const stand=()=>{this.cylinder('telescopic-stand',.033,2.25,0,-1.3,0,chrome,root);this.cylinder('clamp',.073,.12,0,-1.2,0,dark,root);for(let i=0;i<3;i++){const a=i*Math.PI*2/3;this.rod('tripod-leg',new Vector3(0,-1.9,0),new Vector3(Math.cos(a)*.58,-2.4,Math.sin(a)*.58),.027,chrome,root);this.cylinder('rubber-foot',.057,.07,Math.cos(a)*.58,-2.4,Math.sin(a)*.58,dark,root)}}
    if(id==='reserved-snare'||id==='reserved-kick'||id==='reserved-tom'){
      const kick=id==='reserved-kick',snare=id==='reserved-snare'
      const drum=new TransformNode('drum-body',this.scene);drum.parent=root
      const radius=kick?.76:snare?.65:.6,depth=kick?.78:snare?.32:.62
      const shell=this.pbr('lacquered-drum-shell',snare?'#bac4ce':kick?'#642b24':'#74382a',snare?.88:.3,snare?.18:.22)
      const head=this.pbr('drumhead',kick?'#ddd9d0':'#d4d6d5',.04,.5)
      this.cylinder('drum-shell',radius,depth,0,-depth/2,0,shell,drum,80)
      for(const y of [0,-depth]){
        this.cylinder('drum-skin',radius-.022,.018,0,y,0,head,drum,80)
        this.ring('drum-hoop',radius,.046,y,edge,drum)
      }
      for(let i=0;i<10;i++){
        const a=i*Math.PI/5,x=Math.cos(a)*(radius+.025),z=Math.sin(a)*(radius+.025)
        this.cylinder('drum-tension-rod',.016,depth+.04,x,-depth/2,z,chrome,drum,10)
        this.box('drum-lug',.065,.12,.065,x,-depth/2,z,chrome,drum)
      }
      if(kick){
        drum.rotation.x=Math.PI/2;drum.position.set(0,-.6,.3)
        for(const side of [-1,1])this.rod('kick-spur',new Vector3(side*.55,-.8,0),new Vector3(side*.8,-1.45,.45),.035,chrome,root)
        this.box('kick-pedal',.22,.04,.46,0,-1.4,.85,dark,root)
        this.rod('kick-beater',new Vector3(0,-1.36,.63),new Vector3(0,-.55,.58),.018,chrome,root)
        this.cylinder('beater-felt',.065,.1,0,-.55,.58,head,root)
      }else{
        if(snare){
          for(let i=0;i<10;i++)this.rod('snare-wire',new Vector3(-.43,-depth-.018,(i-4.5)*.018),new Vector3(.43,-depth-.018,(i-4.5)*.018),.003,chrome,drum)
          this.box('snare-strainer',.09,.2,.07,radius+.04,-.17,0,chrome,drum)
        }
        stand()
      }
    }else if(id.startsWith('paila-')){
      const r=id==='paila-low'?.73:.64
      const shell=this.pbr('rolled-stainless-steel','#9990b4',.93,.19)
      this.cylinder('steel-shell',r,.63,0,-.31,0,shell,root,96)
      const skin=this.pbr('coated-drumhead','#a5a0b6',.05,.5)
      const texture=new DynamicTexture('skin-grain',256,this.scene,false);const ctx=texture.getContext();ctx.fillStyle='#e9e5dc';ctx.fillRect(0,0,256,256);for(let i=0;i<5000;i++){ctx.fillStyle=`rgba(76,68,57,${random(i)*.06})`;ctx.fillRect(random(i+1)*256,random(i+2)*256,1,1)}texture.update();skin.albedoTexture=texture
      this.cylinder('head',r-.023,.026,0,.015,0,skin,root);this.ring('upper-hoop',r,.048,.026,edge,root);this.ring('lower-hoop',r,.035,-.61,chrome,root)
      for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*(r+.036),z=Math.sin(a)*(r+.036);this.cylinder('tension-rod',.014,.42,x,-.19,z,chrome,root,12);this.cylinder('hex-bolt',.036,.028,x,.032,z,chrome,root,6);this.box('tension-lug',.075,.17,.075,x,-.31,z,chrome,root)}
      stand()
    }else if(id==='cymbal'){
      const bronze=this.pbr('lathed-cymbal-bronze','#d37a20',.92,.2)
      const shape=[new Vector3(0,.14,0),new Vector3(.09,.14,0),new Vector3(.2,.035,0),new Vector3(.35,-.015,0),new Vector3(.75,-.07,0),new Vector3(.98,-.1,0)]
      const m=MeshBuilder.CreateLathe('spun-bronze',{shape,tessellation:96,sideOrientation:Mesh.DOUBLESIDE},this.scene);m.parent=root;m.material=bronze
      for(let r=.29;r<.96;r+=.035)this.ring('concentric-lathing',r,.0025,-.015-r*.09,bronze,root)
      this.cylinder('felt-washer',.065,.055,0,.17,0,dark,root);this.box('wing-nut',.15,.025,.025,0,.22,0,chrome,root);stand()
    }else if(id==='jamblock'){
      const red=this.pbr('red-moulded-plastic','#db0012',.02,.24)
      this.box('jam-block',.82,.25,.51,0,0,0,red,root);this.box('resonator-opening',.66,.08,.01,0,-.028,.261,dark,root)
      this.box('mount-bracket',.19,.13,.18,0,-.17,-.15,chrome,root);stand()
    }else{
      const size=id==='chacha-bell'?.95:id==='bongo-bell'?1.12:1.02
      const bell=new TransformNode('hollow-nickel-bell',this.scene);bell.parent=root;bell.scaling.setAll(size);bell.rotation.x=-.28;bell.rotation.y=Math.PI
      const positions=[-.2,-.1,-.48,.2,-.1,-.48,.2,.1,-.48,-.2,.1,-.48,-.46,-.19,.48,.46,-.19,.48,.46,.19,.48,-.46,.19,.48]
      const indices=[0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7,0,3,2,0,2,1]
      const mesh=new Mesh('folded-steel-shell',this.scene);const data=new VertexData();data.positions=positions;data.indices=indices;const normals:number[]=[];VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;data.applyToMesh(mesh);mesh.material=chrome;mesh.parent=bell;chrome.backFaceCulling=false
      this.box('dark-interior',.76,.28,.01,0,0,.4,dark,bell)
      for(const y of [-.19,.19])this.rod('rolled-mouth-edge',new Vector3(-.46,y,.48),new Vector3(.46,y,.48),.016,chrome,bell)
      for(const side of [-1,1])this.rod('polished-top-fold',new Vector3(side*.2,.103,-.48),new Vector3(side*.46,.193,.48),.012,edge,bell)
      this.cylinder('mounting-screw',.035,.08,0,.14,-.36,chrome,bell,6);stand()
    }
    root.getChildMeshes().forEach(m=>this.shadow.addShadowCaster(m))
    return root
  }
  private environment(){
    const city=this.options.city ?? 'miami'
    const hasWater=city!=='los-angeles'
    const asset=city==='new-york'?'new-york-day.png':city==='los-angeles'?'los-angeles-sunset.png':'miami-night.png'

    // Photorealistic panorama behind a physically lit, interactive 3D foreground.
    const panorama=MeshBuilder.CreatePlane('night-bay',{size:2},this.scene)
    panorama.alwaysSelectAsActiveMesh=true
    const water=new ShaderMaterial('night-water',this.scene,{
      vertexSource:'precision highp float; attribute vec3 position; attribute vec2 uv; varying vec2 vUV; void main(){vUV=uv;gl_Position=vec4(position.xy,0.999999,1.0);}',
      fragmentSource:`precision highp float; varying vec2 vUV; uniform sampler2D panorama; uniform float time; uniform float waterEnabled; uniform float viewportAspect;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      void main(){vec2 p=vUV;vec2 crop=vec2(min(1.0,viewportAspect/3.0),min(1.0,3.0/viewportAspect));p=(p-.5)*crop+.5;p.y=max(0.0,p.y-${city==='new-york'?'.14':'0.0'});float waterMask=waterEnabled*(1.0-smoothstep(${city==='miami'?'.49,.54':'.36,.40'},p.y));
      p.x+=waterMask*(sin(p.y*190.0+time*.7)+sin(p.y*310.0-time*.9))*.0006;
      p.y+=waterMask*sin(p.x*60.0+p.y*150.0+time*.5)*.0007;
      vec4 color=texture2D(panorama,p);
      vec2 cloudUV=vUV*vec2(7.,14.)+vec2(time*.006,0.);
      float cloud=noise(cloudUV)*.55+noise(cloudUV*2.)*.3+noise(cloudUV*4.)*.15;
      float mask=smoothstep(.48,.75,cloud)*smoothstep(.79,.94,vUV.y)*${city==='miami'?'.65':'0.0'};
      color.rgb=mix(color.rgb,vec3(.14,.18,.27),mask);color.rgb=pow(color.rgb,vec3(2.2));gl_FragColor=color;}`
    },{attributes:['position','uv'],uniforms:['time','waterEnabled','viewportAspect'],samplers:['panorama']})
    water.backFaceCulling=false;water.disableDepthWrite=true
    water.setTexture('panorama',new Texture(`/playsense/environments/${asset}`,this.scene));water.setFloat('time',0);water.setFloat('waterEnabled',hasWater?1:0);water.setFloat('viewportAspect',3)
    panorama.material=water;this.water=water
    if(hasWater){this.boat(-14,-10,.85);this.boat(17,-22,1.1)}

    const stone=this.pbr('limestone-terrace','#27202a',.12,.62);stone.albedoTexture=new Texture('/playsense/textures/pavers.jpg',this.scene);(stone.albedoTexture as Texture).uScale=10;(stone.albedoTexture as Texture).vScale=4
    this.box('bayfront-terrace',90,.6,23,0,-3,1,stone)
    const railing=this.pbr('railing','#626c70',.85,.3),light=this.emissive('deck-lights','#ffd3a0',2)
    for(const side of [-1,1]){
      for(let z=3;z>-11;z-=4){this.cylinder('pier-post',.085,1.1,side*9.2,-.1,z,railing);this.cylinder('post-lamp',.105,.1,side*9.2,.48,z,light)}
      this.rod('handrail',new Vector3(side*9.2,.2,3),new Vector3(side*9.2,.2,-11),.028,railing)
      if(city==='miami'){
        this.palm(side*13.5,1,10,side*7);this.planter(side*13.5,1)
        this.palm(side*11.8,-5,8.4,side*11);this.planter(side*11.8,-5)
        this.palm(side*17,4,11,side*17);this.planter(side*17,4)
      }else{
        // Clear sightlines to Liberty and Hollywood; these are independent
        // harbor/overlook environments, not landmarks over Miami palms.
        this.planter(side*13.5,1);this.planter(side*11.8,-5)
      }
      for(const z of [-6,1]){
        const x=side*10.4
        this.cylinder('promenade-lamp-pole',.065,3.6,x,-.85,z,railing)
        const orb=MeshBuilder.CreateSphere('warm-lantern',{diameter:.46,segments:16},this.scene);orb.position.set(x,1.05,z);orb.material=light
        const lamp=new PointLight('promenade-warm-light',new Vector3(x,1.05,z),this.scene);lamp.diffuse=c('#ffbd6d');lamp.intensity=4;lamp.range=9
      }
      this.rod('lower-safety-rail',new Vector3(side*9.2,-.25,3),new Vector3(side*9.2,-.25,-11),.025,railing)

    }
    // Restrained movement only; musical time is never used to animate the environment.

  }
  private planter(x:number,z:number){
    const stone=this.pbr('planter-stone','#aaa08e',.05,.8),soil=this.pbr('planter-soil','#141b10',0,1),green=this.pbr('planter-green','#26492b',0,.85)
    this.box('rectangular-planter',2.7,.32,2,x,-2.62,z,stone)
    this.box('planted-bed',2.4,.04,1.7,x,-2.44,z,soil)
    const positions:number[]=[],indices:number[]=[]
    for(let i=0;i<90;i++){
      const px=x+(random(i+13)-.5)*2.3,pz=z+(random(i+25)-.5)*1.6,a=i*2.4,len=.3+random(i+36)*.65,w=.035
      const q=positions.length/3
      positions.push(px-w,-2.4,pz,px+w,-2.4,pz,px+Math.cos(a)*len*.6,-2.4+len,pz+Math.sin(a)*len*.6)
      indices.push(q,q+1,q+2)
    }
    const grass=new Mesh('planter-grass',this.scene),data=new VertexData(),normals:number[]=[];data.positions=positions;data.indices=indices;VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;data.applyToMesh(grass);green.backFaceCulling=false;grass.material=green;this.shadow.addShadowCaster(grass)
  }
  private boat(x:number,z:number,scale:number){
    const root=new TransformNode('motor-yacht',this.scene);root.position.set(x,-1.9,z);root.scaling.setAll(scale);root.rotation.y=.3
    const hull=this.pbr('yacht-gelcoat','#d9dfe3',.25,.24),glass=this.pbr('yacht-glass','#102b42',.6,.13)
    const body=MeshBuilder.CreateSphere('yacht-hull',{diameter:1,segments:32},this.scene);body.scaling.set(3.8,.6,1.25);body.material=hull;body.parent=root
    this.box('yacht-deck',2.9,.18,1.05,0,.18,0,hull,root);this.box('yacht-cabin',1.4,.55,.78,-.3,.5,0,glass,root);this.box('cabin-roof',1.7,.08,.93,-.3,.81,0,hull,root)
    const lamp=this.emissive('boat-lights','#ffe0a0',3);this.box('cabin-light',1.1,.04,.82,-.3,.34,0,lamp,root)
    for(const side of [-1,1])this.rod('yacht-rail',new Vector3(-1.4,.47,side*.5),new Vector3(1.4,.47,side*.5),.015,this.chrome,root)
    this.boats.push(root)
  }
  private palm(x:number,z:number,h:number,seed:number){
    const bark=this.pbr('palm-bark','#70604b',0,.9);bark.albedoTexture=new Texture('/playsense/textures/bark.jpg',this.scene)
    const foliage=this.pbr('waxed-palm-fronds','#436b39',0,.48);foliage.backFaceCulling=false;foliage.environmentIntensity=.7
    const spineMat=this.pbr('palm-frond-spine','#64783c',0,.7)
    const path=Array.from({length:18},(_,i)=>new Vector3(x+Math.sin(i/17*1.4)*.85,-2.7+h*i/17,z))
    const trunk=MeshBuilder.CreateTube('curved-ringed-palm-trunk',{path,radiusFunction:i=>.32-i*.008,tessellation:24},this.scene);trunk.material=bark;this.shadow.addShadowCaster(trunk)
    for(let i=1;i<27;i++){const t=i/27;const ring=MeshBuilder.CreateTorus('palm-growth-ring',{diameter:.64-t*.23,thickness:.021,tessellation:24},this.scene);ring.position.set(x+Math.sin(t*1.4)*.85,-2.7+h*t,z);ring.material=bark}
    const top=path[path.length-1]
    for(let j=0;j<15;j++){
      const a=j*Math.PI*2/15+seed,length=4.3+random(j+seed)*1.5,lift=j%3===0?2.3:1.1
      const point=(t:number)=>new Vector3(top.x+Math.cos(a)*length*t,top.y+Math.sin(t*Math.PI)*lift-t*t*2.5,top.z+Math.sin(a)*length*t)
      const stem=MeshBuilder.CreateTube('arched-frond-spine',{path:Array.from({length:14},(_,i)=>point(i/13)),radius:.019,tessellation:5},this.scene);stem.material=spineMat
      const positions:number[]=[],indices:number[]=[]
      for(let k=2;k<25;k++)for(const side of [-1,1]){
        const t=k/26,base=point(t),reach=Math.sin(t*Math.PI)*1.15*(.8+random(k+j)*.2)
        const lateral=new Vector3(-Math.sin(a)*side,0,Math.cos(a)*side)
        const mid=base.add(lateral.scale(reach*.57)).add(new Vector3(Math.cos(a)*.13,-reach*.08,Math.sin(a)*.13))
        const tip=base.add(lateral.scale(reach)).add(new Vector3(Math.cos(a)*.3,-reach*.55,Math.sin(a)*.3))
        const w=.085;const q=positions.length/3
        positions.push(base.x,base.y,base.z,mid.x-Math.cos(a)*w,mid.y,mid.z-Math.sin(a)*w,mid.x,mid.y+.045,mid.z,mid.x+Math.cos(a)*w,mid.y,mid.z+Math.sin(a)*w,tip.x,tip.y,tip.z)
        indices.push(q,q+1,q+2,q,q+2,q+3,q+1,q+4,q+2,q+2,q+4,q+3)
      }
      const leaf=new Mesh('folded-3d-palm-leaflets',this.scene),data=new VertexData(),normals:number[]=[];data.positions=positions;data.indices=indices;VertexData.ComputeNormals(positions,indices,normals);data.normals=normals;data.applyToMesh(leaf);leaf.material=foliage;this.shadow.addShadowCaster(leaf)
    }
  }
  private resize(){if(this.disposed)return;this.engine.resize();const aspect=Math.max(.3,this.host.clientWidth/Math.max(1,this.host.clientHeight));const distance=Math.max(15.5,6+20/(2*Math.tan(26*Math.PI/180)*aspect*stagePageZoom()));this.camera.position.set(0,1+(distance+7)*4/22.5,distance);this.water?.setFloat('viewportAspect',aspect);this.camera.setTarget(new Vector3(0,1.0,-7))}
  private noteMaterial(note:StageNote){
    const key=`${note.notehead}:${note.strokeId}:${note.lane}`;const previous=this.noteMaterials.get(key);if(previous)return previous
    const tex=new DynamicTexture(key,256,this.scene,true);tex.hasAlpha=true;const ctx=tex.getContext();ctx.clearRect(0,0,256,256);const colors=STAGE_THEMES[this.options.theme].colors;const color='#'+(colors[note.lane%colors.length]??0xffe0a6).toString(16).padStart(6,'0');ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=10;ctx.font='160px LMMStageNotation';const glyph=note.notehead&&note.notehead!=='normal'?PERCUSSION_GLYPHS[note.notehead]:'\uE0A4';const w=ctx.measureText(glyph).width;ctx.fillText(glyph,(256-w)/2,178);ctx.shadowBlur=0;ctx.fillRect((256+w)/2-3,22,5,145);tex.update()
    const m=new StandardMaterial(key,this.scene);m.diffuseTexture=tex;m.emissiveTexture=tex;m.useAlphaFromDiffuseTexture=true;m.emissiveColor=Color3.White().scale(1.35);m.disableLighting=true;m.backFaceCulling=false;this.noteMaterials.set(key,m);return m
  }
  private render=()=>{
    if(this.disposed||document.hidden)return
    this.observer.flush()
    const frame=this.options.readFrame()
    if(frame.attempt!==this.attempt){this.attempt=frame.attempt;this.judgment.clear();this.pulse.fill(0);this.lastElapsed=undefined}
    for(const result of frame.results){if(this.judgment.get(result.eventIndex)===result.grade)continue;this.judgment.set(result.eventIndex,result.grade);const note=this.notes.find(n=>n.index===result.eventIndex);if(note&&result.grade!=='miss')this.pulse[note.lane]=1}
    // Arrival animation follows the musical clock; it is not a performance judgment.
    if(frame.playing&&this.lastElapsed!==undefined&&frame.elapsed>=this.lastElapsed&&frame.elapsed-this.lastElapsed<.25){
      for(let i=firstVisibleNote(this.notes,this.lastElapsed);i<this.notes.length&&this.notes[i].time<=frame.elapsed;i++){
        if(this.notes[i].time>this.lastElapsed)this.pulse[this.notes[i].lane]=1
      }
    }
    this.lastElapsed=frame.elapsed
    this.bases.forEach(m=>m.setEnabled(false));
    this.noteMeshes.forEach(m=>m.setEnabled(false));this.tails.forEach(m=>m.setEnabled(false))
    const speed=(HIT_Z-FAR_Z)/APPROACH_SECONDS;let count=0
    if(frame.showNotes)for(let i=firstVisibleNote(this.notes,frame.elapsed-1);i<this.notes.length&&count<this.noteMeshes.length;i++){
      const note=this.notes[i],delta=note.time-frame.elapsed;if(delta>APPROACH_SECONDS)break;if(this.judgment.has(note.index))continue
      const z=HIT_Z-delta*speed;if(z>HIT_Z+1.25)continue
      const mesh=this.noteMeshes[count++],lane=this.lanes[note.lane];mesh.material=this.noteMaterial(note);mesh.position.set(lane.x,1.05,z);mesh.scaling.setAll(Math.max(1.5,Math.min(3.2,lane.width*1.65)));mesh.setEnabled(true)
      const base=this.bases[count-1];base.position.set(lane.x,.22,z);base.scaling.x=Math.min(1.5,lane.width*.86);const baseMat=base.material as StandardMaterial;baseMat.emissiveColor=c('#225c70').scale(.65);base.setEnabled(true)
      if(note.duration>.12){const tail=this.tails[count-1],length=Math.min(note.duration*speed,z-FAR_Z);if(length>0){tail.position.set(lane.x,.06,z-length/2);tail.scaling.z=length;tail.setEnabled(true)}}
    }
    const beatSeconds=60/this.exercise.bpm
    const beats=this.exercise.grid?beatLinePositions(this.exercise.grid,frame.elapsed,frame.elapsed+APPROACH_SECONDS):Array.from({length:32},(_,i)=>({seconds:(Math.ceil(frame.elapsed/beatSeconds)+i)*beatSeconds,downbeat:false}))
    this.beatLines.forEach((mesh,i)=>{const beat=beats[i];const delta=beat?beat.seconds-frame.elapsed:Infinity;mesh.setEnabled(delta>=0&&delta<=APPROACH_SECONDS);if(beat)mesh.position.z=HIT_Z-delta*speed})
    const dt=Math.min(.05,this.engine.getDeltaTime()/1000)
    this.visualTime+=this.options.reducedMotion?0:dt
    this.water?.setFloat('time',this.visualTime)
    this.boats.forEach((boat,i)=>{boat.position.y=-1.9+Math.sin(this.visualTime*.8+i)*.07;boat.rotation.z=Math.sin(this.visualTime*.55+i)*.025})
    this.instruments.forEach((root,i)=>{
      this.pulse[i]=Math.max(0,this.pulse[i]-dt*2.8);const p=this.pulse[i],progress=1-p
      root.position.y=.1+(this.options.reducedMotion?0:Math.sin(p*Math.PI)*.08)
      const ring=this.impactRings[i];ring.setEnabled(p>0);ring.scaling.setAll(this.options.reducedMotion?1:1+progress*1.7);(ring.material as StandardMaterial).alpha=p
      this.sparks[i].forEach((spark,j)=>{spark.setEnabled(p>0&&!this.options.reducedMotion);const a=j*Math.PI/4;spark.position.set(root.position.x+Math.cos(a)*progress*1.25,.3+Math.sin(progress*Math.PI)*1.15,HIT_Z+1.1+Math.sin(a)*progress*.7);spark.scaling.setAll(p*1.6)})
    })
    this.telemetryTime+=Math.max(.001,this.engine.getDeltaTime()/1000);this.telemetryFrames++;if(this.telemetryTime>=1){this.canvas.dataset.renderFps=String(Math.round(this.telemetryFrames/this.telemetryTime));this.telemetryTime=0;this.telemetryFrames=0}
    const ms=this.engine.getDeltaTime();if(ms>28&&ms<200){this.slow++;this.fast=0}else{this.slow=Math.max(0,this.slow-1);if(ms<18)this.fast++}
    if(this.slow>90){this.slow=0;if(this.pipeline.bloomEnabled){this.pipeline.bloomEnabled=false}else if(this.scale<1){this.scale=Math.min(1,this.scale+.1);this.engine.setHardwareScalingLevel(this.scale)}else this.scene.shadowsEnabled=false}
    if(this.fast>900&&this.scale>1/this.maxRatio){this.fast=0;this.scale=Math.max(1/this.maxRatio,this.scale-.1);this.engine.setHardwareScalingLevel(this.scale)}
    this.scene.render()
  }
  destroy(){if(this.disposed)return;this.disposed=true;this.observer.disconnect();this.engine.stopRenderLoop(this.render);this.scene.dispose();this.engine.dispose();this.canvas.remove()}
}
