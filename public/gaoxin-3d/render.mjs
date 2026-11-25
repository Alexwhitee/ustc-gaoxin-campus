import * as THREE from './vendor/three.module.js';

import { addFacade, campusLighting, campusMaterials, createLake, lakeEdging } from './campus-look.mjs';

const level = {park:.012, phase:.013, lawn:.016, field:.018, court:.019, path:.025, road:.029};
const shades = [0x516f9a,0xab5e4c,0x2e7667,0x8d66a2,0xbc9056,0x445366];

function tileUV(geometry, width, height=width) {
  const uv=geometry.getAttribute('uv');
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*width,uv.getY(i)*height);
  return geometry;
}

function shapeOf(rings) {
  const vectors = ring => ring.map(([x,y])=>new THREE.Vector2(x,y));
  const shape = new THREE.Shape(vectors(rings[0]));
  shape.holes = rings.slice(1).map(ring=>new THREE.Path(vectors(ring)));
  return shape;
}

function crownGeometry() {
  const geometry=new THREE.IcosahedronGeometry(1,4);
  const p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const radius=1+.12*Math.sin(5*x+8*z)*Math.cos(8*y-3*z)+.075*Math.sin(15*z-8*x+7*y);
    p.setXYZ(i,x*radius,y*radius,z*radius);
  }
  return tileUV(geometry,2,1);
}

function paintedLabel(name, accent = '#e2f0e0') {
  const canvas = document.createElement('canvas');
  canvas.width = 384; canvas.height = 82;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b302be9';
  ctx.beginPath();
  ctx.roundRect(4,8,376,66,18);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '600 32px system-ui,sans-serif';
  ctx.fillStyle = accent;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name,192,42,346);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthTest:true,depthWrite:false}));
  sprite.scale.set(3.3,.71,1);
  return sprite;
}

export function createCampusRenderer(host, map, {dusk=false}={}) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(69,1,.12,470);
  camera.rotation.order = 'YXZ';
  const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);
  const moveLight=campusLighting(renderer,scene,dusk);
  const look=campusMaterials();
  const ground=new THREE.PlaneGeometry(map.half*2,map.half*2);
  const base = new THREE.Mesh(tileUV(ground,map.half/3),look.surfaces.earth);
  base.rotation.x=-Math.PI/2;base.receiveShadow=true;scene.add(base);
  const trunk = new THREE.MeshStandardMaterial({color:0x7c6652,roughness:.95});
  // shortcut: visual courtyard paving follows the mapped entrances, replace with surveyed edges when available.
  const plazaGeometry=new THREE.ShapeGeometry(shapeOf([[[17,-266],[104,-266],[104,-241],[76,-241],[76,-235],[17,-235]]])).rotateX(-Math.PI/2);
  const plaza=new THREE.Mesh(tileUV(plazaGeometry,.27),look.surfaces.path);
  plaza.position.y=level.path;plaza.receiveShadow=true;scene.add(plaza);
  const water=map.chunks.flatMap(c=>c.ground.filter(([kind])=>kind==='water').map(([,rings])=>shapeOf(rings)));
  const buildingCount=map.chunks.reduce((sum,c)=>sum+c.buildings.length,0);
  const waterSolids=map.solids.slice(buildingCount);
  const lake=water.length?createLake(water,waterSolids):null;
  if(lake)scene.add(lake,lakeEdging(waterSolids));
  const marker = new THREE.Mesh(new THREE.TorusGeometry(1.5,.075,7,30),new THREE.MeshBasicMaterial({color:0xffdc86}));
  marker.rotation.x = -Math.PI/2;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(.07,.075,1.4,8),new THREE.MeshStandardMaterial({color:0x625747}));
  scene.add(marker,post);
  let markerLabel;

  function mark(place) {
    if (markerLabel) {
      scene.remove(markerLabel);
      markerLabel.material.map.dispose();
      markerLabel.material.dispose();
      markerLabel = null;
    }
    marker.visible = post.visible = !!place;
    if (!place) return;
    marker.position.set(place.x,.10,-place.y);
    post.position.set(place.x,.8,-place.y);
    markerLabel = paintedLabel(place.name,'#f2d49d');
    markerLabel.position.set(place.x,1.95,-place.y);
    scene.add(markerLabel);
  }

  const mounted = new Map();
  function addBuilding(group, building) {
    const shape=shapeOf(building.rings);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:building.height,bevelEnabled:false}).rotateX(-Math.PI/2);
    const mesh=new THREE.Mesh(tileUV(geometry,.34,.52),[look.roof,look.surfaces[building.material]]);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    addFacade(group,building,look);
  }
  function makeChunk(chunk) {
    const group = new THREE.Group();
    for (const [kind,rings] of chunk.ground) {
      if(kind==='water')continue;
      const geometry = new THREE.ShapeGeometry(shapeOf(rings)).rotateX(-Math.PI/2);
      const mesh = new THREE.Mesh(tileUV(geometry,1/(kind==='path'?4.8:8)),look.surfaces[kind]);
      mesh.position.y=level[kind];mesh.receiveShadow=true;
      group.add(mesh);
    }
    for (const b of chunk.buildings) {
      if(b.material==='tower'){
        const podium=9.5,footprint=b.rings[0];
        const centerX=footprint.reduce((sum,[x])=>sum+x,0)/footprint.length;
        const centerY=footprint.reduce((sum,[,y])=>sum+y,0)/footprint.length;
        const rings=b.rings.map(ring=>ring.map(([x,y])=>[centerX+(x-centerX)*.93,centerY+(y-centerY)*.93]));
        addBuilding(group,{...b,material:'brick',height:podium});
        const shaft=new THREE.Group();
        shaft.position.y=podium;
        addBuilding(shaft,{...b,id:null,rings,height:b.height-podium});
        group.add(shaft);
      } else {
        addBuilding(group,b);
      }
    }
    if (chunk.trees.length) {
      const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.17,1,8),trunk,chunk.trees.length*4);
      const crowns = new THREE.InstancedMesh(crownGeometry(),look.foliage,chunk.trees.length*8);
      const dummy = new THREE.Object3D();
      const treeColor=new THREE.Color();
      const up=new THREE.Vector3(0,1,0), branch=new THREE.Vector3();
      chunk.trees.forEach(([x,y,h],i) => {
        dummy.position.set(x,h*.34,-y);dummy.scale.set(h*.19,h*.68,h*.19);dummy.quaternion.identity();
        dummy.updateMatrix();stems.setMatrixAt(i*4,dummy.matrix);
        for(let j=0;j<8;j++){
          const azimuth=i*.91+j*2.399;
          const spread=j===7?0:h*(.16+(j%3)*.042);
          const dx=Math.cos(azimuth)*spread,dz=Math.sin(azimuth)*spread;
          const height=h*(j===7?.87:.62+((i+j*3)%5)*.044);
          if(j<3){
            branch.set(dx,height-h*.35,dz);
            dummy.position.set(x+dx*.5,(h*.35+height)*.5,-y+dz*.5);
            dummy.scale.set(h*.092,branch.length(),h*.092);
            dummy.quaternion.setFromUnitVectors(up,branch.normalize());
            dummy.updateMatrix();stems.setMatrixAt(i*4+j+1,dummy.matrix);
          }
          const radius=h*(.181+((i+j*3)%7)*.014);
          dummy.position.set(x+dx,height,-y+dz);
          dummy.scale.set(radius,radius*(.86+(j%3)*.15),radius*.95);
          dummy.rotation.set(0,azimuth,0);dummy.updateMatrix();crowns.setMatrixAt(i*8+j,dummy.matrix);
          crowns.setColorAt(i*8+j,treeColor.setHSL(.20+(i%7)*.014,.29+(j%2)*.11,.44+(j%5)*.037));
        }
      });
      stems.castShadow=stems.receiveShadow=crowns.castShadow=crowns.receiveShadow=true;
      group.add(stems,crowns);
    }
    scene.add(group);
    return group;
  }

  let lastChunkX=Infinity,lastChunkY=Infinity;
  function updateChunks(x,y) {
    if (Math.hypot(x-lastChunkX,y-lastChunkY)<12) return false;
    lastChunkX=x;lastChunkY=y;
    let changed=false;
    for (const chunk of map.chunks) {
      const key=chunk.x+','+chunk.y, cached=mounted.get(key), size=map.chunkSize;
      const dx=Math.max(0,chunk.x*size-x,x-(chunk.x+1)*size);
      const dy=Math.max(0,chunk.y*size-y,y-(chunk.y+1)*size);
      const distance=Math.hypot(dx,dy);
      if (!cached && distance<285) {mounted.set(key,makeChunk(chunk));changed=true;}
      if (cached && distance>345) {
        scene.remove(cached);
        cached.traverse(o=>{o.geometry?.dispose();if(o.isInstancedMesh)o.dispose();});
        mounted.delete(key);changed=true;
      }
    }
    return changed;
  }

  const players = new Map();
  const head = new THREE.SphereGeometry(.20,12,9);
  const body = new THREE.CapsuleGeometry(.23,.43,3,9);
  const limb = new THREE.CapsuleGeometry(.076,.38,3,7);
  const skin = new THREE.MeshStandardMaterial({color:0xe1ae86,roughness:.82});
  const dark = new THREE.MeshStandardMaterial({color:0x343e43});
  function makePlayer(peer) {
    const group = new THREE.Group();
    const hash = [...peer.id].reduce((h,c)=>(Math.imul(h,31)+c.charCodeAt(0))>>>0,0);
    const shirt = new THREE.MeshStandardMaterial({color:shades[hash%shades.length]});
    const torso=new THREE.Mesh(body,shirt);torso.position.y=1.0;
    const face=new THREE.Mesh(head,skin);face.position.y=1.62;
    const hair=new THREE.Mesh(head,dark);hair.position.set(0,1.70,.035);hair.scale.set(1.07,.59,.98);
    const legs=[],arms=[];
    for(const side of [-1,1]) {
      const leg=new THREE.Mesh(limb,dark);leg.position.set(side*.12,.275,0);legs.push(leg);
      const arm=new THREE.Mesh(limb,shirt);arm.position.set(side*.29,1.01,0);arms.push(arm);
    }
    const label = paintedLabel(peer.name);
    label.position.y=2.10;
    group.add(torso,face,hair,label,...legs,...arms);
    scene.add(group);
    return {group,legs,arms,label,shirt};
  }
  function updatePlayers(me,peers,now) {
    for(const peer of peers.values()) {
      const p=players.get(peer.id)||makePlayer(peer);
      players.set(peer.id,p);
      p.group.position.set(peer.x,0,-peer.y);
      p.group.rotation.y=peer.yaw;
      const width=Math.max(.55,Math.min(2.4,Math.hypot(me.x-peer.x,me.y-peer.y)*.105));
      p.label.scale.set(width,width*.215,1);
      const motion=peer.moving?Math.sin(now*11.5)*.60:0;
      p.legs.forEach((leg,i)=>{leg.rotation.x=motion*(i?1:-1);});
      p.arms.forEach((arm,i)=>{arm.rotation.x=motion*(i?-1:1);});
    }
    for(const [id,p] of players) {
      if(peers.has(id))continue;
      scene.remove(p.group);
      p.label.material.map.dispose();p.label.material.dispose();p.shirt.dispose();
      players.delete(id);
    }
  }

  let pixelRatio = 0;
  let qualityLevel = 'default';
  const ratioLimit = { low:.75, medium:1, high:1.4 };
  function resize() {
    const quality= Math.min(devicePixelRatio||1,ratioLimit[qualityLevel]??(innerWidth>1450?1:1.3));
    if (pixelRatio!==quality) {pixelRatio=quality;renderer.setPixelRatio(quality);}
    renderer.setSize(innerWidth,innerHeight,false);
    camera.aspect=innerWidth/Math.max(1,innerHeight);camera.updateProjectionMatrix();
  }
  addEventListener('resize',resize);resize();
  return {scene,camera,renderer,mark,setQuality(value) {
    qualityLevel=value;
    if(lake){lake.userData.reflection=value!=='low';lake.getRenderTarget().setSize(value==='high'?896:640,value==='high'?512:384);}
    const light=scene.children.find(o=>o.isDirectionalLight);
    if(light){
      light.shadow.mapSize.setScalar(value==='high'?2048:value==='low'?768:1536);
      light.shadow.map?.dispose();light.shadow.map=null;light.shadow.needsUpdate=true;
    }
    resize();
  },draw(p,peers,yaw,pitch,now,pose) {
    moveLight(p.x,p.y,updateChunks(p.x,p.y));
    updatePlayers(p,peers,now);
    camera.position.set(p.x,1.66,-p.y);camera.rotation.set(pitch,yaw,0,'YXZ');
    pose?.(camera);
    if(lake)lake.material.uniforms.clock.value=now;
    renderer.render(scene,camera);
  },get mounted(){return mounted.size;}};
}
