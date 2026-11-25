import * as THREE from '../gaoxin-3d/vendor/three.module.js';
import { GLTFLoader } from '../gaoxin-3d/vendor/GLTFLoader.js';
import { createCampusRenderer } from '../gaoxin-3d/render.mjs';
import { aim,COVER,DELIVERY,GARAGE,GATES,HOTSPOTS,wrap } from './world.mjs';

const slate=new THREE.MeshStandardMaterial({color:0x243336,roughness:.84});
const snow=new THREE.MeshStandardMaterial({color:0xc7b7a1,roughness:.78});
const ranger=new THREE.MeshStandardMaterial({color:0x266969,roughness:.68});
const copper=new THREE.MeshStandardMaterial({color:0x9c5032,roughness:.75});
const gear=new THREE.MeshStandardMaterial({color:0xc18b43,roughness:.47,metalness:.23});
const light=new THREE.MeshBasicMaterial({color:0xf9c47c});
const blue=new THREE.MeshBasicMaterial({color:0x9be8db});
const shapeBox=new THREE.BoxGeometry(1,1,1);
const shapeBall=new THREE.SphereGeometry(1,10,8);
const shapeLimb=new THREE.CapsuleGeometry(.1,.39,4,8);
const shapeKnee=new THREE.CapsuleGeometry(.095,.34,4,8);
const signalShape=new THREE.OctahedronGeometry(.42);
const shadowShape=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2);
const paintColors=[0xa8b29d,0xbd6947,0x2d827e];
let shadowMaterial;

function piece(group,shape,mat,x,y,z,w=1,h=1,d=1) {
  const mesh=new THREE.Mesh(shape,mat);
  mesh.position.set(x,y,z);mesh.scale.set(w,h,d);group.add(mesh);
  return mesh;
}

function contact(group,w,d) {
  if(!shadowMaterial){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=48;
    const ctx=canvas.getContext('2d');
    const fill=ctx.createRadialGradient(24,24,0,24,24,23);
    fill.addColorStop(0,'#19221c8f');fill.addColorStop(.52,'#19221c43');fill.addColorStop(1,'#19221c00');
    ctx.fillStyle=fill;ctx.fillRect(0,0,48,48);
    shadowMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false});
  }
  return piece(group,shadowShape,shadowMaterial,0,.086,0,w,1,d);
}

function actorModel(bot,own) {
  const model=new THREE.Group();
  const shirt=bot?copper:own?ranger:snow;
  piece(model,shapeBall,shirt,0,1.23,0,.28,.37,.19);
  piece(model,shapeBox,slate,0,1.13,.105,.33,.39,.16);
  piece(model,shapeBall,slate,0,1.72,-.015,.182,.205,.182);
  piece(model,shapeBall,bot?light:blue,0,1.74,-.142,.156,.083,.055);
  piece(model,shapeBox,gear,0,1.21,.202,.12,.15,.045);
  piece(model,shapeBox,slate,0,1.01,0,.45,.115,.30);
  const limbs=[];
  for(const side of [-1,1]){
    const leg=new THREE.Group(),arm=new THREE.Group();
    leg.position.set(side*.135,.89,0);arm.position.set(side*.30,1.49,0);
    piece(leg,shapeKnee,slate,0,-.29,0,1,1.36,1);
    piece(leg,shapeBox,slate,0,-.80,-.063,.184,.17,.305);
    piece(arm,shapeLimb,shirt,0,-.25,0,1,.88,1);
    piece(arm,shapeBall,slate,0,-.515,0,.085,.10,.09);
    model.add(leg,arm);limbs.push({leg,arm,side});
  }
  const emitter=piece(limbs[1].arm,shapeBox,gear,0,-.46,-.22,.12,.15,.36);
  piece(limbs[1].arm,shapeBox,blue,0,-.47,-.42,.13,.06,.064);
  return {model,limbs,emitter,shadow:contact(model,1.55,1.1),seat:null};
}

function ring(scene,p,color,size) {
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(size,.055,5,40),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.85}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(p.x,.08,-p.y);scene.add(mesh);
  return mesh;
}

function landmarkLabel(scene,point,title) {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=56;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#132420ed';ctx.fillRect(4,4,248,48);
  ctx.strokeStyle='#91b7a5';ctx.strokeRect(4,4,248,48);
  ctx.fillStyle='#fcf1d9';ctx.font='600 25px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(title,128,28,226);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,toneMapped:false}));
  label.scale.set(6,1.31,1);label.position.set(point.x,2.85,-point.y);scene.add(label);
  return label;
}

function showLabel(label,me,enabled,radius) {
  const d=Math.hypot(label.position.x-me.x,label.position.z+me.y);
  label.visible=enabled&&d>3&&d<radius;
  if(label.visible){
    const width=Math.max(.85,Math.min(4.3,d*.16));
    label.scale.set(width,width*.22,1);
  }
}

function streetDetails(scene) {
  const body=new THREE.MeshStandardMaterial({color:0x555b54,roughness:.82});
  const trim=new THREE.MeshStandardMaterial({color:0xe1a957,roughness:.72});
  for(const [index,[x,y,w,d,h]] of COVER.entries()){
    const pivot=new THREE.Group();
    pivot.position.set(x,0,-y);scene.add(pivot);
    const block=piece(pivot,shapeBox,index%3===0?slate:body,0,h*.5,0,w,h,d);
    block.castShadow=block.receiveShadow=true;
    piece(pivot,shapeBox,trim,0,h*.84,0,w+.025,.13,d+.025);
    if(w>2.5)for(const s of [-1,1])piece(pivot,shapeBox,slate,s*w*.34,h*.46,d/2+.02,.08,h*.72,.044);
  }
  const lines=new THREE.MeshStandardMaterial({color:0x777570,roughness:.94});
  const amber=new THREE.MeshStandardMaterial({color:0xc0a67b,roughness:.8});
  for(const [x1,y1,x2,y2,width] of [[43,-317,125,-320,8],[125,-320,125,-181,8],[-76,-267,110,-263,5],[-58,-319,36,-320,5]]){
    const length=Math.hypot(x2-x1,y2-y1);
    const track=new THREE.Group();track.position.set(x1,.049,-y1);
    track.rotation.y=Math.atan2(x2-x1,y1-y2);
    piece(track,shapeBox,lines,0,0,length/2,width,.023,length).receiveShadow=true;
    for(let s=4;s<length-3;s+=7)piece(track,shapeBox,amber,0,.015,s,.105,.012,2.1).receiveShadow=true;
    scene.add(track);
  }
}

export async function createSandboxView(host,map,geometry) {
  const view=createCampusRenderer(host,map,{dusk:true});
  const {scene}=view;
  view.mark(null);
  streetDetails(scene);
  const loader=new GLTFLoader();
  const [landmarks,vehicle]=await Promise.all(['landmarks.glb','utility.ev.glb'].map(path=>loader.loadAsync(path)));
  landmarks.scene.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});
  scene.add(landmarks.scene);
  const garageLight=new THREE.PointLight(0xffc57a,28,15,1.8);
  garageLight.position.set(GARAGE.x,2.9,-GARAGE.y);garageLight.intensity=11;scene.add(garageLight);
  const garageRing=ring(scene,GARAGE,0x88d9be,4.2);
  garageRing.material.opacity=.42;
  const gateRings=GATES.map(g=>ring(scene,g,0x87efd6,2.65));
  const gateSigns=GATES.map(g=>landmarkLabel(scene,g,g.name));
  const deliveryRing=ring(scene,DELIVERY[0],0x80cbe3,2);
  const deliverySigns=DELIVERY.map(d=>landmarkLabel(scene,d,d.name));
  const garageSign=landmarkLabel(scene,{x:GARAGE.x,y:GARAGE.y+8},GARAGE.name);
  garageSign.position.y=3.56;
  const events=[0,1].map(()=>({ring:ring(scene,GARAGE,0xffcf77,2.45),
    gem:piece(scene,signalShape,light,0,1.1,0)}));
  const cars=new Map(),players=new Map(),bursts=[];
  const carColors=paintColors.map(color=>new THREE.MeshStandardMaterial({color,roughness:.38,metalness:.25}));
  const cameraFocus=new THREE.Vector3();
  let lastTime=0,viewer,lastShotTick=0;

  function shotsOf(state,now) {
    if(state.tick<=lastShotTick)return;
    lastShotTick=state.tick;
    for(const [id,x,y,dx,dy,dz,hit] of state.shots){
      const actor=players.get(id);
      if(actor)actor.recoilUntil=now+.12;
      const verts=new Float32Array([x,1.48,-y,x+dx,1.48+dz,-y-dy]);
      const geo=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(verts,3));
      const trace=new THREE.Line(geo,new THREE.LineBasicMaterial({color:hit?0x9df0dd:0xffd19b,
        transparent:true,opacity:.93,depthWrite:false}));
      scene.add(trace);bursts.push({trace,end:now+.115});
    }
  }

  function syncCars(list,dt,me) {
    const present=new Set();
    for(const data of list){
      const [id,x,y,yaw,vx,vy,,,paint]=data;
      present.add(id);
      let car=cars.get(id);
      if(!car){
        const mesh=vehicle.scene.clone();
        const wheels=[];
        mesh.traverse(o=>{
          if(!o.isMesh)return;
          if(o.name.startsWith('Wheel_'))wheels.push(o);
          o.receiveShadow=true;
        });
        contact(mesh,2.6,4.9);
        mesh.position.set(x,0,-y);mesh.rotation.y=yaw;scene.add(mesh);
        car={mesh,wheels,paint:-1};cars.set(id,car);
      }
      const {mesh,wheels}=car;
      const factor=me.car===id?1:Math.min(1,dt*12);
      const tx=me.car===id?me.x:x,ty=me.car===id?me.y:y,turn=me.car===id?me.yaw:yaw;
      mesh.position.x+=(tx-mesh.position.x)*factor;
      mesh.position.z+=(-ty-mesh.position.z)*factor;
      mesh.rotation.y+=wrap(turn-mesh.rotation.y)*factor;
      for(const wheel of wheels)wheel.rotation.x-=Math.hypot(vx,vy)*dt*3;
      if(car.paint!==paint){
        mesh.traverse(o=>{if(o.isMesh&&o.name.startsWith('Paint'))o.material=carColors[paint]||carColors[0];});
        car.paint=paint;
      }
    }
    for(const [id,c] of cars)if(!present.has(id)){scene.remove(c.mesh);cars.delete(id);}
  }

  function syncActors(list,dt,t,me) {
    const present=new Set();
    for(const p of list) {
      present.add(p.id);
      let b=players.get(p.id);
      if(!b){
        b=actorModel(Boolean(p.bot),p.id===me.id);players.set(p.id,b);
        b.seat=p.car;
        if(p.id!==me.id){
          b.label=landmarkLabel(b.model,{x:0,y:0},p.bot?'NPC · '+p.name:p.name);
          b.label.position.y=2.18;
        }
        b.model.position.set(p.x,0,-p.y);b.model.rotation.y=p.yaw;scene.add(b.model);
      }
      const {model,limbs}=b,d=Math.hypot(p.x-model.position.x,p.y+model.position.z);
      if(p.car!==b.seat){b.seat=p.car;b.seatChange=t;}
      const change=Math.max(0,1-(t-(b.seatChange??-1))/.26);
      const onFoot=p.id!=='intro'&&(!p.car||change>0)&&p.hp>0;
      model.visible=onFoot;
      if(!onFoot)continue;
      const factor=change&&p.car?Math.min(1,dt*20):p.id===me.id||d>14?1:Math.min(1,dt*14);
      model.position.x+=(p.x-model.position.x)*factor;
      model.position.z+=(-p.y-model.position.z)*factor;
      model.rotation.y+=wrap(p.yaw-model.rotation.y)*factor;
      const speed=p.id===me.id?(me.moving?1:0):Math.min(1,d*1.7);
      const impulse=p.hit>0&&p.hit!==b.hit;
      if(impulse)b.hitUntil=t+.22;
      b.hit=p.hit;
      const bend=p.car?1-change:change;
      model.rotation.z=t<(b.hitUntil||0)?Math.sin((b.hitUntil-t)*12)*.12:bend*.28;
      model.position.y=-bend*.42+Math.sin(t*13)**2*.035*speed;
      b.shadow.position.y=.086-model.position.y;
      if(b.label){
        const range=Math.hypot(me.x-p.x,me.y-p.y);
        b.label.visible=range>2&&range<(p.bot?31:23);
        const width=Math.max(.74,range*.11);
        b.label.scale.set(width,width*.22,1);
      }
      for(const {leg,arm,side} of limbs) {
        const stride=Math.sin(t*13)*speed;
        leg.rotation.x=stride*.55*side-bend*.46;
        const recoil=t<(b.recoilUntil||0)?(b.recoilUntil-t)*3:0;
        arm.rotation.x=side>0?-1.25+stride*.20-recoil:-.48-stride*.46;
      }
      b.emitter.scale.z=p.tool===1?.50:.31;
    }
    for(const [id,p] of players)if(!present.has(id)){
      scene.remove(p.model);
      p.label?.material.map.dispose();p.label?.material.dispose();
      players.delete(id);
    }
  }

  function draw(me,actors,state,yaw,pitch,t) {
    const dt=Math.min(.1,t-lastTime);lastTime=t;
    if(viewer!==me.id){viewer=me.id;lastShotTick=0;}
    syncActors([me,...actors],dt,t,me);syncCars(state.cars,dt,me);
    for(const [i,{ring:halo,gem}] of events.entries()){
      const event=state.beacons.find(b=>b.id===i);
      const shown=!!event&&!event.holder&&!event.cool;
      halo.visible=gem.visible=shown;
      if(shown){
        halo.position.set(event.x,.085,-event.y);
        gem.position.set(event.x,1.27+Math.sin(t*2)*.17,-event.y);gem.rotation.y=t*.9;
      }
    }
    const holding=state.beacons.some(b=>b.holder===me.id);
    for(const [i,gate] of gateRings.entries()){
      gate.visible=holding;
      showLabel(gateSigns[i],me,holding,50);
    }
    const deliveryIndex=state.delivery?.next||0;
    const target=DELIVERY[deliveryIndex];
    for(const [i,sign] of deliverySigns.entries())showLabel(sign,me,i===deliveryIndex,36);
    showLabel(garageSign,me,true,41);
    deliveryRing.position.set(target.x,.090,-target.y);
    shotsOf(state,t);
    while(bursts.length&&bursts[0].end<t){
      const {trace}=bursts.shift();scene.remove(trace);trace.geometry.dispose();trace.material.dispose();
    }
    const facing=me.car?me.yaw:yaw;
    view.draw(me,new Map(),facing,pitch,t,camera=>{
      if(me.id==='intro'){
        camera.position.set(-153,3.1,258);
        camera.lookAt(-28,21,218);
        return;
      }
      const follow=me.car?6.8:3.65;
      const offset=me.car?0:.87;
      const dx=Math.sin(facing)*follow+Math.cos(facing)*offset;
      const dy=-Math.cos(facing)*follow+Math.sin(facing)*offset;
      const beneathRoof=Math.abs(me.x-GARAGE.x)<17&&Math.abs(me.y-GARAGE.y)<8;
      const lift=me.car?(beneathRoof?1.05:2.1):1.15;
      const length=Math.hypot(dx,dy,lift);
      const ray={x:me.x,y:me.y,z:1.58,dx:dx/length,dy:dy/length,dz:lift/length};
      const a=Math.max(.16,geometry.trace(ray,length)-.14)/length;
      camera.position.set(me.x+dx*a,1.58+lift*a,-(me.y+dy*a));
      const targeting=aim({...me,yaw:facing,pitch:me.car?-.15:pitch});
      const lengthToAim=me.car?22:Math.max(3,geometry.trace(targeting,38));
      cameraFocus.set(me.x+targeting.dx*lengthToAim,1.48+targeting.dz*lengthToAim,-(me.y+targeting.dy*lengthToAim));
      camera.lookAt(cameraFocus);
    });
  }

  return {draw,canvas:view.renderer.domElement,quality:view.setQuality};
}

export { HOTSPOTS };
