import * as THREE from './vendor/three.module.js';
import { Reflector } from './vendor/Reflector.js';

const palettes = {
  earth:'#a49e87',park:'#9da17c',phase:'#b6ad95',lawn:'#87916a',
  road:'#777d7a',path:'#d1cabe',field:'#729067',court:'#849c98',
  tower:'#9aabae',brick:'#a56d5d',stone:'#c3a98b',sport:'#a4a8a4',
};
const facade = {
  tower:{bay:3.1,floor:4.8,inset:.09,cap:'#b6beb8',glass:'#718d9b',panel:'panel'},
  brick:{bay:4.25,floor:3.65,inset:.24,cap:'#bbaca0',glass:'#719194',panel:'brick'},
  stone:{bay:3.6,floor:3.25,inset:.19,cap:'#d5c4a9',glass:'#778d91',panel:'stone'},
  sport:{bay:5.8,floor:5.3,inset:.16,cap:'#c5c9bc',glass:'#697b81',panel:'metal'},
};
const entrances = {
  w1435377501:[12,-242], w1435377503:[58,-241], w1435377502:[41,-268], w1435368250:[-278,-148],
  w1435370291:[0,-452], w1435377498:[263,-249],
};
const rgb = (r,g,b) => 'rgb('+r+' '+g+' '+b+')';
const sunDirection = new THREE.Vector3(-.62,.76,.42).normalize();

function surfaceTexture(kind) {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const c=canvas.getContext('2d');
  const isGrass=kind==='grass', isBrick=kind==='brick', isPaver=kind==='paving';
  const isLeaf=kind==='leaf';
  const isWall=kind==='stone'||isBrick||kind==='metal'||kind==='panel';
  let seed=391;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  c.fillStyle=isGrass?'#ced3ba':kind==='asphalt'?'#d0d1cd':'#eeeeeb';
  c.fillRect(0,0,256,256);
  if(isLeaf){
    c.fillStyle='#a6ad85';c.fillRect(0,0,256,256);
    const colors=['#808961','#b9bd92','#d1cca4','#8d9879','#b4bd90'];
    for(let i=0;i<2200;i++){
      const x=random()*256,y=random()*256,r=1.1+random()*2.8,angle=random()*Math.PI;
      c.fillStyle=colors[i%colors.length];
      c.beginPath();c.ellipse(x,y,r,r*.42,angle,0,2*Math.PI);c.fill();
    }
  }
  if (isGrass) {
    for(let i=0;i<85;i++){
      const x=random()*256,y=random()*256,r=10+random()*39;
      const g=c.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,i%2?'#a7a7743b':'#e9e6bd48');g.addColorStop(1,'#b8bb8100');
      c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);
    }
  }
  if (isBrick || isPaver || isWall) {
    const sx=isBrick?32:isPaver?64:128, sy=isBrick?16:isPaver?64:kind==='panel'?64:128;
    c.fillStyle=isBrick?'#c9c0b9':'#b7b7b3';
    c.fillRect(0,0,256,256);
    for(let y=0;y<256;y+=sy){
      const offset=isBrick&&Math.round(y/sy)%2?sx/2:0;
      for(let x=-offset;x<256;x+=sx){
        const v=212+Math.floor(random()*31);
        c.fillStyle=rgb(v,v,v-3);c.fillRect(x+1,y+1,sx-2,sy-2);
        c.fillStyle='#fff5';c.fillRect(x+2,y+1,sx-3,1);
        c.fillStyle='#615a5020';c.fillRect(x+2,y+sy-2,sx-3,1);
      }
    }
  }
  for(let i=0;i<(isGrass?8800:5300);i++){
    const x=random()*256,y=random()*256;
    const shade=122+Math.round(random()*128);
    c.globalAlpha=isGrass?.20:.12;
    c.fillStyle=rgb(shade,shade+(isGrass?7:0),shade-(isGrass?13:0));
    c.fillRect(x,y,.6+random()*2.0,.5+random()*2.2);
  }
  c.globalAlpha=1;
  const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}

function skyline(dusk) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=384;
  const ctx=canvas.getContext('2d');
  const img=ctx.createImageData(canvas.width,canvas.height);
  const sunAzimuth=Math.atan2(sunDirection.z,sunDirection.x), sunY=sunDirection.y;
  for(let y=0;y<canvas.height;y++){
    const v=Math.PI*(.5-(y+.5)/canvas.height), up=Math.sin(v), horizontal=Math.cos(v);
    const blend=Math.pow(Math.max(0,up),.64);
    for(let x=0;x<canvas.width;x++){
      const angle=((x+.5)/canvas.width-.5)*Math.PI*2;
      const facing=Math.max(0,Math.cos(angle-sunAzimuth)*horizontal*Math.sqrt(1-sunY*sunY)+up*sunY);
      const sun=Math.pow(facing,590), haze=Math.pow(facing,8)*Math.max(0,up+.12);
      const p=(y*canvas.width+x)*4;
      if(up<0){
        const d=Math.min(1,-up*5);
        img.data[p]=195-96*d;img.data[p+1]=201-100*d;img.data[p+2]=191-100*d;
      } else {
        const billow=Math.sin(angle*4.0+up*19.0)+.63*Math.sin(angle*9.0-up*27.0)+.29*Math.sin(angle*22.0+up*49.0);
        const cloud=Math.max(0,billow-.59)*.30*Math.max(0,1-Math.abs(up-.22)*2.75);
        const warm=dusk?Math.max(0,1-up*4)*(.55+.45*Math.cos(angle-sunAzimuth)):0;
        img.data[p]=206-111*blend+cloud*73+haze*46+sun*176+warm*40;
        img.data[p+1]=222-65*blend+cloud*62+haze*19+sun*154;
        img.data[p+2]=227-23*blend+cloud*52+haze*4+sun*112-warm*45;
      }
      img.data[p+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(canvas);
  t.mapping=THREE.EquirectangularReflectionMapping;t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

export function campusLighting(renderer,scene,dusk) {
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.14;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene.background=skyline(dusk);
  scene.environment=scene.background;
  scene.environmentIntensity=.69;
  scene.fog=new THREE.Fog(0xb7c7c8,139,325);
  const sky=new THREE.HemisphereLight(0xe1f2ff,0x746956,.80);
  const key=new THREE.DirectionalLight(dusk?0xffcc9d:0xffead1,2.24);
  const direction=dusk?new THREE.Vector3(-.75,.48,.42).normalize():sunDirection;
  key.castShadow=true;
  const shadow=key.shadow;
  shadow.autoUpdate=false;
  shadow.mapSize.set(2048,2048);
  shadow.camera.left=shadow.camera.bottom=-124;
  shadow.camera.right=shadow.camera.top=124;
  shadow.camera.near=3;shadow.camera.far=405;
  shadow.camera.updateProjectionMatrix();
  shadow.bias=-.00017;shadow.normalBias=.10;shadow.radius=2.2;
  scene.add(sky,key,key.target);
  return (x,north,changed)=>{
    const tx=Math.floor(x/32)*32+16,tz=Math.floor(-north/32)*32+16;
    if(!changed&&key.target.position.x===tx&&key.target.position.z===tz)return;
    key.target.position.set(tx,0,tz);
    key.position.copy(key.target.position).addScaledVector(direction,187);
    shadow.needsUpdate=true;
  };
}

export function campusMaterials() {
  const textures=Object.fromEntries(['grass','asphalt','paving','brick','panel','metal','stone','leaf'].map(k=>[k,surfaceTexture(k)]));
  const textureNames={earth:'grass',park:'grass',phase:'grass',lawn:'grass',road:'asphalt',path:'paving',
    field:'grass',court:'asphalt',tower:'panel',brick:'brick',stone:'stone',sport:'metal'};
  const surfaces=Object.fromEntries(Object.entries(palettes).map(([kind,color])=>{
    const map=textures[textureNames[kind]];
    return [kind,new THREE.MeshStandardMaterial({
      color,map,bumpMap:map,bumpScale:facade[kind]?.panel==='brick'?.068:.026,roughness:.9,
    })];
  }));
  const frames=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.73,side:THREE.DoubleSide});
  const windows=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.345,metalness:.36,envMapIntensity:1.65,side:THREE.DoubleSide});
  const roof=new THREE.MeshStandardMaterial({color:'#a9ada7',map:textures.stone,roughness:.86});
  const foliage=new THREE.MeshStandardMaterial({color:0xc1c7a0,map:textures.leaf,bumpMap:textures.leaf,bumpScale:.047,roughness:.93});
  return {surfaces,frames,windows,roof,foliage};
}

function addQuads(positions,colors,points,tint) {
  for(const i of [0,1,2,0,2,3]){
    positions.push(...points[i]);colors.push(tint.r,tint.g,tint.b);
  }
}

export function addFacade(group, building, styles) {
  const spec=facade[building.material]||facade.brick;
  const framePosition=[],frameColor=[],windowPosition=[],windowColor=[];
  const concrete=new THREE.Color(spec.cap);
  const vinyl=new THREE.Color('#585c57'),stone=new THREE.Color('#777b74');
  const blue=new THREE.Color(spec.glass),lit=new THREE.Color('#aaa18f');
  const tower=building.material==='tower';
  const entrance=entrances[building.id];
  let access;
  if(entrance){
    const ring=building.rings[0];
    for(let i=0;i<ring.length;i++){
      const [ax,ay]=ring[i], [bx,by]=ring[(i+1)%ring.length],len=Math.hypot(bx-ax,by-ay);
      if(len<9)continue;
      const ux=(bx-ax)/len,uy=(by-ay)/len;
      const mid=Math.max(4,Math.min(len-4,(entrance[0]-ax)*ux+(entrance[1]-ay)*uy));
      const distance=Math.hypot(ax+ux*mid-entrance[0],ay+uy*mid-entrance[1]);
      if(!access||distance<access.distance)access={edge:i,mid,distance};
    }
  }
  for(const ring of building.rings){
    const cross=ring.reduce((sum,[x,y],i)=>{
      const [a,b]=ring[(i+1)%ring.length];return sum+x*b-a*y;
    },0);
    const sign=(Math.sign(cross)||1)*(ring===building.rings[0]?1:-1);
    for(let edge=0;edge<ring.length;edge++){
      const [ax,ay]=ring[edge],[bx,by]=ring[(edge+1)%ring.length];
      const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
      if(length<1)continue;
      const ux=dx/length,uy=dy/length,nx=uy*sign,ny=-ux*sign;
      const vertex=(u,h,p)=>[ax+ux*u+nx*p,h,-(ay+uy*u+ny*p)];
      const quad=(a,b,low,high,p)=>[vertex(a,low,p),vertex(b,low,p),vertex(b,high,p),vertex(a,high,p)];
      const frame=(a,b,lo,hi,p,tint)=>addQuads(framePosition,frameColor,quad(a,b,lo,hi,p),tint);
      const slab=(a,b,h,deep)=>addQuads(framePosition,frameColor,[
        vertex(a,h,.035),vertex(b,h,.035),vertex(b,h,deep),vertex(a,h,deep),
      ],concrete);
      frame(0,length,.05,.92,.064,stone);
      frame(0,length,building.height-.65,building.height+.21,.10,concrete);
      if(length<3.5)continue;
      const cols=Math.max(1,Math.floor((length-.75)/spec.bay)),bay=(length-.75)/cols;
      const rows=Math.max(1,Math.round(building.height/spec.floor)),floor=building.height/rows;
      const entry=edge===access?.edge && ring===building.rings[0]?access.mid:null;
      if(entry!==null){
        const y=Math.min(4.15,floor*.93), a=entry-3.4,b=entry+3.4;
        frame(a,b,.10,y,.13,vinyl);
        addQuads(windowPosition,windowColor,quad(a+.2,b-.2,.32,y-.23,.17),blue.clone().multiplyScalar(.78));
        for(let j=-3;j<=3;j++)frame(entry+j*.98-.043,entry+j*.98+.043,.13,y,.25,concrete);
        frame(a-.38,b+.38,y-.18,y+.21,2.2,concrete);
        slab(a-.38,b+.38,y+.21,2.2);slab(a-.38,b+.38,y-.18,2.2);
        frame(a-.50,b+.50,.015,.18,1.76,concrete);
        slab(a-.50,b+.50,.18,1.76);
      }
      for(let row=0;row<rows;row++){
        const y=row*floor;
        const low=y+floor*(tower?.135:.22),high=y+floor*.86;
        if(row===0||row%2===0||tower)frame(0,length,y+.045,y+.205,.081,concrete);
        for(let col=0;col<cols;col++){
          const a=.375+col*bay+bay*spec.inset,b=.375+(col+1)*bay-bay*spec.inset;
          if(b-a<.3 || (row===0 && entry!==null && a<entry+3.6 && b>entry-3.6))continue;
          const mid=(a+b)/2;
          const jitter=((col*23+row*43+edge*61)%31)/30;
          frame(a,b,low,high,.053,vinyl);
          const tint=blue.clone().lerp(lit,jitter>.88?.49:.09*jitter).multiplyScalar(.76+jitter*.24);
          addQuads(windowPosition,windowColor,quad(a+.09,b-.09,low+.10,high-.095,.079),tint);
          frame(mid-.037,mid+.037,low,high,.111,concrete);
          frame(a,b,high-.07,high+.028,.112,concrete);
          addQuads(framePosition,frameColor,[vertex(a-.09,low,.07),vertex(b+.09,low,.07),
            vertex(b+.09,low,.29),vertex(a-.09,low,.29)],concrete);
          frame(a-.09,b+.09,low-.105,low,.29,concrete);
        }
      }
    }
  }
  for(const [positions,colors,material] of [[framePosition,frameColor,styles.frames],[windowPosition,windowColor,styles.windows]]){
    if(!positions.length)continue;
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.computeVertexNormals();
    const mesh=new THREE.Mesh(g,material);
    mesh.receiveShadow=true;group.add(mesh);
  }
}

function lakeShore(polygons) {
  const points=polygons.flat(1).flat(1);
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const min=new THREE.Vector2(Math.min(...xs),Math.min(...ys));
  const size=new THREE.Vector2(Math.max(...xs)-min.x,Math.max(...ys)-min.y);
  const width=128,height=256, bytes=new Uint8Array(width*height);
  const segments=[];
  for(const rings of polygons)for(const ring of rings){
    for(let i=0;i<ring.length;i++){
      const [ax,ay]=ring[i],[bx,by]=ring[(i+1)%ring.length];
      const dx=bx-ax,dy=by-ay;
      segments.push([ax,ay,dx,dy,1/(dx*dx+dy*dy||1)]);
    }
  }
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const px=min.x+size.x*(x+.5)/width,py=min.y+size.y*(y+.5)/height;
      let nearest=24*24;
      for(const [ax,ay,dx,dy,inv] of segments){
        const u=px-ax,v=py-ay,t=Math.max(0,Math.min(1,(u*dx+v*dy)*inv));
        nearest=Math.min(nearest,(u-dx*t)**2+(v-dy*t)**2);
      }
      bytes[y*width+x]=Math.round(Math.sqrt(nearest)*(255/24));
    }
  }
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RedFormat);
  texture.magFilter=texture.minFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  return {min,size,texture};
}

export function createLake(shapes,polygons) {
  const bounds=lakeShore(polygons);
  const shader={
    name:'CampusLake',
    uniforms:{
      color:{value:null},tDiffuse:{value:null},textureMatrix:{value:null},
      clock:{value:0},shoreMap:{value:bounds.texture},shoreMin:{value:bounds.min},
      shoreSize:{value:bounds.size},sun:{value:sunDirection},reflectWeight:{value:1},
      algae:{value:new THREE.Color('#428b7f')},depthTint:{value:new THREE.Color('#21525c')},
      horizon:{value:new THREE.Color('#bdcdd0')},glint:{value:new THREE.Color('#ffe4b1')},
    },
    vertexShader:`
      uniform mat4 textureMatrix;
      varying vec4 rCoord;
      varying vec2 lakeXY;
      varying vec3 world;
      void main(){
        vec4 p=vec4(position,1.);
        rCoord=textureMatrix*p;
        lakeXY=position.xy;
        world=(modelMatrix*p).xyz;
        gl_Position=projectionMatrix*modelViewMatrix*p;
      }`,
    fragmentShader:`
      uniform sampler2D tDiffuse,shoreMap;
      uniform vec2 shoreMin,shoreSize;
      uniform vec3 sun,algae,depthTint,horizon,glint;
      uniform float clock,reflectWeight;
      varying vec4 rCoord;
      varying vec2 lakeXY;
      varying vec3 world;
      void main(){
        vec3 toEye=cameraPosition-world;
        vec3 v=normalize(toEye);
        float dist=length(toEye);
        float a=dot(lakeXY,vec2(.94,.46))+clock*1.17;
        float b=dot(lakeXY,vec2(-1.72,1.28))+clock*1.93;
        float c=dot(lakeXY,vec2(3.6,.17))-clock*2.36;
        vec2 bend=vec2(cos(a)*.047+sin(b)*.029, cos(b)*.032+sin(c)*.016);
        vec3 n=normalize(vec3(bend.x,1.,bend.y));
        float fresnel=.18+.74*pow(1.-max(.0,dot(v,n)),4.);
        vec2 uv=clamp(rCoord.xy/max(.001,rCoord.w)+bend*.073,vec2(.006),vec2(.994));
        vec3 reflection=mix(horizon,texture2D(tDiffuse,uv).rgb,reflectWeight);
        float edge=texture2D(shoreMap,(lakeXY-shoreMin)/shoreSize).r*24.;
        vec3 base=mix(algae,depthTint,smoothstep(.7,12.,edge));
        float softStrip=(1.-smoothstep(.05,1.25,edge))*(.12+.04*sin(a));
        float speckle=sin(a*1.9)*cos(b*1.7)*.035;
        float highlight=pow(max(0.,dot(reflect(-sun,n),v)),120.)*.60;
        vec3 result=mix(base*(1.+speckle),reflection,fresnel*.86)*.87+softStrip*algae+highlight*glint;
        gl_FragColor=vec4(mix(result,horizon,smoothstep(139.,325.,dist)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  // shortcut: one planar pass for the mapped lake, extend the budget only if another lake is playable.
  const lake=new Reflector(new THREE.ShapeGeometry(shapes),{
    shader,textureWidth:640,textureHeight:384,multisample:0,clipBias:.001
  });
  lake.rotation.x=-Math.PI/2;lake.position.y=.038;
  const uniforms=lake.material.uniforms;
  const reflect=lake.onBeforeRender;
  const previous=new THREE.Vector3(Infinity,Infinity,Infinity);
  const heading=new THREE.Quaternion();
  let last=-1e6;
  lake.onBeforeRender=function(renderer,scene,camera,...other){
    const x=camera.position.x,y=-camera.position.z;
    const dx=Math.max(0,bounds.min.x-x,x-bounds.min.x-bounds.size.x);
    const dy=Math.max(0,bounds.min.y-y,y-bounds.min.y-bounds.size.y);
    const near=lake.userData.reflection!==false && Math.hypot(dx,dy)<95;
    uniforms.reflectWeight.value=near?1:0;
    const now=uniforms.clock.value;
    if(!near||now-last<.065)return;
    if(now-last<.48 && previous.distanceToSquared(camera.position)<.014 &&
       Math.abs(heading.dot(camera.quaternion))>.99993)return;
    previous.copy(camera.position);heading.copy(camera.quaternion);last=now;
    return reflect.call(this,renderer,scene,camera,...other);
  };
  return lake;
}

export function lakeEdging(polygons) {
  const positions=[],color=[];
  const cap=new THREE.Color('#a6a59a'),bed=new THREE.Color('#76786e');
  for(const rings of polygons)for(const ring of rings){
    const sign=Math.sign(ring.reduce((sum,[x,y],i)=>{
      const [nx,ny]=ring[(i+1)%ring.length];return sum+x*ny-nx*y;
    },0))*(ring===rings[0]?1:-1);
    const miters=ring.map(([x,y],i)=>{
      const [px,py]=ring[(i+ring.length-1)%ring.length], [nx,ny]=ring[(i+1)%ring.length];
      const a=new THREE.Vector2(y-py,px-x).normalize().multiplyScalar(sign);
      const b=new THREE.Vector2(ny-y,x-nx).normalize().multiplyScalar(sign);
      const m=a.clone().add(b).normalize();
      return m.divideScalar(Math.max(.48,m.dot(a)));
    });
    const ground=(i,dist,height)=>[ring[i][0]+miters[i].x*dist,height,-(ring[i][1]+miters[i].y*dist)];
    for(let i=0;i<ring.length;i++){
      const j=(i+1)%ring.length;
      addQuads(positions,color,[ground(j,0,.035),ground(i,0,.035),ground(i,.27,.13),ground(j,.27,.13)],bed);
      addQuads(positions,color,[ground(j,.27,.13),ground(i,.27,.13),ground(i,.72,.046),ground(j,.72,.046)],cap);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(color,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,side:THREE.DoubleSide}));
  mesh.receiveShadow=true;
  return mesh;
}
