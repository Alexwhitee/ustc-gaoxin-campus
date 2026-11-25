import { createCollision, move } from '../gaoxin-3d/world.mjs';

export const PROTOCOL = 1;
export const STEP = .05;
export const ROOM_SIZE = 20;
export const RESUME_MS = 30_000;
export const AREA = { left:-91, right:146, south:-361, north:-163 };
export const GARAGE = { x:43, y:-332, name:'南门车库' };
export const HOTSPOTS = [
  { x:-75, y:-268, name:'永怀湖东岸' },
  { x:58, y:-247, name:'红砖广场' },
  { x:-42, y:-181, name:'北侧服务道' },
];
export const GATES = [
  { x:-43, y:-314, name:'湖岸驿站' },
  { x:128, y:-213, name:'东侧交付站' },
];
export const DELIVERY = [
  { x:32, y:-314, name:'车库发货台' },
  { x:126, y:-271, name:'东侧检查点' },
  { x:125, y:-184, name:'北侧终点' },
];
export const STALLS = [
  [26,-317],[38,-317],[48,-317],[60,-317],[64,-339],[29,-343],[47,-348],[59,-348],
];
export const COVER = [
  [51,-256,3.6,1.7,1.48],[63,-257,3.8,1.7,1.05],[72,-245,1.7,3.7,1.65],
  [36,-248,4.1,1.8,1.58],[89,-252,1.7,3.6,1.14],[-68,-253,2.7,1.5,1.12],
  [-70,-277,3.3,1.5,1.4],[-59,-268,1.7,3.4,1.3],[-77,-244,1.6,4,1.25],
  [-26,-267,3.4,1.7,1.54],[-46,-194,4.7,1.6,1.4],[-31,-177,4,1.8,1.18],
  [94,-177,6,1.6,1.25],[114,-210,1.6,4,1.2],[120,-253,1.65,3.7,1.65],
  [-34,-316,2,4,1.05],[104,-303,4.5,1.6,1.54],
];
const SOLID_PROPS = [...COVER,
  [29,-337,.68,.68,3.44],[29,-327,.68,.68,3.44],[57,-337,.68,.68,3.44],[57,-327,.68,.68,3.44],
  [35,-336.8,.48,.45,1.14],[51,-336.8,.48,.45,1.14],
  [10,-247,3.1,1.3,1.05],[22,-247,3.1,1.3,1.05],[94,-247,3.1,1.3,1.05],
  [-76.1,-260,.46,2.6,.6],[-76.1,-278,.46,2.6,.6],
];
export const WEAPONS = [
  { name:'脉冲短枪', interval:6, damage:27, range:46 },
  { name:'连发标记器', interval:3, damage:15, range:62 },
];

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export const wrap = angle => Math.atan2(Math.sin(angle),Math.cos(angle));
export const safe = p => Math.abs(p.x-GARAGE.x)<24 && Math.abs(p.y-GARAGE.y)<19;

function boxDistance(x,y,[cx,cy,w,d]) {
  return Math.hypot(Math.max(0,Math.abs(x-cx)-w/2),Math.max(0,Math.abs(y-cy)-d/2));
}

function edgeDistance(ray,ax,ay,bx,by) {
  const ex=bx-ax,ey=by-ay,det=ray.dx*ey-ray.dy*ex;
  if(Math.abs(det)<1e-8)return Infinity;
  const px=ax-ray.x,py=ay-ray.y;
  const t=(px*ey-py*ex)/det, u=(px*ray.dy-py*ray.dx)/det;
  return t>=0 && u>=0 && u<=1 ? t : Infinity;
}

function rayBox(ray,[cx,cy,w,d,h],limit) {
  let first=0,last=limit;
  for(const [p,v,lo,hi] of [[ray.x,ray.dx,cx-w/2,cx+w/2],[ray.y,ray.dy,cy-d/2,cy+d/2],[ray.z,ray.dz,0,h]]) {
    if(Math.abs(v)<1e-8){if(p<lo||p>hi)return Infinity;continue;}
    const a=(lo-p)/v,b=(hi-p)/v;
    first=Math.max(first,Math.min(a,b));last=Math.min(last,Math.max(a,b));
    if(first>last)return Infinity;
  }
  return first;
}

export function sandboxGeometry(map) {
  const feet=createCollision(map), tires=createCollision(map,1.05);
  const buildings=map.chunks.flatMap(chunk=>chunk.buildings).map(b=>{
    const xs=b.rings[0].map(([x])=>x),ys=b.rings[0].map(([,y])=>y);
    return {...b,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
  });
  function walk(x,y,car=false) {
    const radius=car?1.05:.65;
    return x>AREA.left+radius && x<AREA.right-radius && y>AREA.south+radius && y<AREA.north-radius &&
      (car?tires:feet)(x,y) && !SOLID_PROPS.some(box=>boxDistance(x,y,box)<radius);
  }

  function trace(ray,limit) {
    let nearest=limit;
    for(const box of SOLID_PROPS)nearest=Math.min(nearest,rayBox(ray,box,nearest));
    const endX=ray.x+ray.dx*nearest,endY=ray.y+ray.dy*nearest;
    for(const {rings,height,bounds:[ax,ay,bx,by]} of buildings) {
      if(Math.max(ray.x,endX)<ax || Math.min(ray.x,endX)>bx || Math.max(ray.y,endY)<ay || Math.min(ray.y,endY)>by)continue;
      for(const ring of rings)for(let i=0;i<ring.length;i++){
        const [x1,y1]=ring[i],[x2,y2]=ring[(i+1)%ring.length];
        const hit=edgeDistance(ray,x1,y1,x2,y2);
        if(hit>=nearest)continue;
        const z=ray.z+ray.dz*hit;
        if(z>=0 && z<=height)nearest=hit;
      }
    }
    return nearest;
  }
  return {walk,trace};
}

export function aim(p) {
  const scale=Math.cos(p.pitch);
  return {x:p.x,y:p.y,z:1.48,dx:-Math.sin(p.yaw)*scale,dy:Math.cos(p.yaw)*scale,dz:Math.sin(p.pitch)};
}

export function avatarHit(ray,p,limit) {
  const horizontal=ray.dx*ray.dx+ray.dy*ray.dy;
  const dx=p.x-ray.x,dy=p.y-ray.y;
  const center=(dx*ray.dx+dy*ray.dy)/horizontal;
  const chord=.57**2-(dx-ray.dx*center)**2-(dy-ray.dy*center)**2;
  if(chord<0)return Infinity;
  const hit=center-Math.sqrt(chord/horizontal),z=ray.z+ray.dz*hit;
  return hit>=0 && hit<limit && z>.15 && z<1.92 ? hit : Infinity;
}

export function vehicleHit(ray,car,limit) {
  const dx=ray.x-car.x,dy=ray.y-car.y;
  const cos=Math.cos(car.yaw),sin=Math.sin(car.yaw);
  return rayBox({...ray,x:dx*cos+dy*sin,y:dy*cos-dx*sin,
    dx:ray.dx*cos+ray.dy*sin,dy:ray.dy*cos-ray.dx*sin},[0,0,1.8,3.6,1.42],limit);
}

export function stepWalker(player,input,geometry) {
  move(player,input,STEP,geometry.walk);
  player.pitch=input.pitch;
}

// Adapted from Chris Sparks' MIT VehicleModel.ts (bd5ee61). See THIRD_PARTY_NOTICES.md.
export function stepCar(car,input,geometry,obstacles=[]) {
  const fx=-Math.sin(car.yaw),fy=Math.cos(car.yaw);
  const oldForward=car.vx*fx+car.vy*fy;
  const accel=oldForward*input.forward<0 ? 22 : 9;
  let vx=car.vx+fx*input.forward*accel*STEP,vy=car.vy+fy*input.forward*accel*STEP;
  const velocity=Math.hypot(vx,vy);
  const friction=input.brake?8:1.5;
  const drag=velocity?Math.max(0,1-friction*STEP/velocity)*(1-.10*STEP):0;
  vx*=drag;vy*=drag;
  const yaw=wrap(car.yaw-input.side*2*clamp(velocity/5,0,1)*(oldForward<-.05?-1:1)*STEP);
  const dx=-Math.sin(yaw),dy=Math.cos(yaw);
  const forward=clamp(vx*dx+vy*dy,-4.2,14.5);
  const side=(vx*dy-vy*dx)*Math.exp(-(input.brake?2.2:10)*STEP);
  vx=dx*forward+dy*side;vy=dy*forward-dx*side;
  const x=car.x+vx*STEP,y=car.y+vy*STEP;
  const clear=[-.9,.9].every(offset=>geometry.walk(x+dx*offset,y+dy*offset,true)) &&
    !obstacles.some(other=>other.id!==car.id && Math.hypot(other.x-x,other.y-y)<2.5);
  if(clear)Object.assign(car,{x,y,yaw,vx,vy});
  else Object.assign(car,{vx:0,vy:0});
  return !clear && velocity>3.2;
}
