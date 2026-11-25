import { cleanName } from '../public/gaoxin-3d/world.mjs';
import {
  aim, avatarHit, distance, DELIVERY, GARAGE, GATES, HOTSPOTS, PROTOCOL, RESUME_MS, ROOM_SIZE,
  safe, sandboxGeometry, STALLS, stepCar, stepWalker, vehicleHit, WEAPONS,
} from '../public/gaoxin-sandbox/world.mjs';

const roomName=/^[A-Z0-9-]{1,20}$/;
const tokenFormat=/^[a-f0-9]{48}$/;
const numbers=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
const neutral={side:0,forward:0,brake:true};
const cooldown=100;
const activityDuration=1800;
const inputTypes=['interact','swap','fire'];
const randomHex=length=>Array.from(crypto.getRandomValues(new Uint8Array(length)),b=>b.toString(16).padStart(2,'0')).join('');
const send=(socket,data)=>{
  if(socket?.readyState===1 && socket.bufferedAmount<48_000)socket.send(JSON.stringify(data));
};
const solidDenial=(ws,message,code=4002)=>{send(ws,{type:'error',message});ws.close(code);};
const vehicle=(x,y,i)=>({id:'car'+i,x,y,homeX:x,homeY:y,yaw:0,vx:0,vy:0,driver:null,paint:0,hp:100,idle:0});

function newRoom(key) {
  return {key,players:new Map(),cars:STALLS.map(([x,y],i)=>vehicle(x,y,i)),
    beacons:[],bots:[],shots:[],roundTick:0,sequence:0};
}

function newBeacon(r,id) {
  const next=r.beacons.find(b=>b.id!==id && b.expires>r.roundTick)?.site;
  let site=r.sequence++%HOTSPOTS.length;
  if(site===next)site=r.sequence++%HOTSPOTS.length;
  const p=HOTSPOTS[site];
  return {id,site,x:p.x,y:p.y,expires:r.roundTick+activityDuration,cool:0,holder:null,ping:null,unlock:0};
}

function spawn(room,p,geometry) {
  const choices=Array.from({length:20},(_,i)=>({
    x:GARAGE.x-13+(i%5)*6.5,y:GARAGE.y-10+Math.floor(i/5)*5,
  }));
  const occupied=[...room.players.values()].filter(other=>other!==p&&other.hp>0&&other.ws).concat(room.cars);
  const separation=point=>occupied.reduce((min,other)=>Math.min(min,distance(point,other)),Infinity);
  choices.sort((a,b)=>separation(b)-separation(a));
  const point=choices.find(p=>geometry.walk(p.x,p.y) && !room.cars.some(car=>distance(car,p)<1.9))||GARAGE;
  Object.assign(p,{x:point.x,y:point.y,hp:100,yaw:0,pitch:0,respawn:0,joinGuard:room.roundTick+50,delivery:null});
}

export function createSandboxRooms(map,{clock=Date.now,readProgress=()=>0,writeProgress=()=>{}}={}) {
  const rooms=new Map(),geometry=sandboxGeometry(map);
  const visible=(actor,target,max)=>geometry.trace({...aim(actor),dx:(target.x-actor.x)/max,
    dy:(target.y-actor.y)/max,dz:0},max)>=max-.03;
  const notify=(p,message)=>send(p.ws,{type:'notice',message});
  const gain=(p,amount)=>{
    p.score+=amount;p.total+=amount;
    if(p.account)try{writeProgress(p.account,amount);}catch{notify(p,'存档暂不可写，本次积分留在房间内。');}
  };

  function release(r,p) {
    const car=r.cars.find(c=>c.driver===p.id);
    if(car){car.driver=null;car.idle=r.roundTick;car.vx=car.vy=0;}
    p.car=null;
  }

  function drop(r,p) {
    for(const beacon of r.beacons)if(beacon.holder===p.id){
      Object.assign(beacon,{holder:null,ping:null,x:p.x,y:p.y,unlock:r.roundTick+20,
        expires:Math.max(beacon.expires,r.roundTick+160)});
    }
  }

  function abandon(r,p,permanent) {
    release(r,p);drop(r,p);p.ws=null;p.input=null;p.actions.length=0;
    p.until=clock()+RESUME_MS;
    if(permanent)r.players.delete(p.token);
    if(!r.players.size)rooms.delete(r.key);
  }

  function defeat(r,p,attacker) {
    p.hp=0;release(r,p);drop(r,p);p.delivery=null;
    p.respawn=r.roundTick+(p.bot?140:46);
    if(attacker&&!attacker.bot&&attacker!==p)gain(attacker,1);
    notify(p,'标记出局，即将回到安全车库。');
  }

  function fire(r,p) {
    if(!p.hp||p.car||safe(p)||r.roundTick<p.joinGuard||r.roundTick<p.nextShot)return;
    const spec=p.bot?{interval:27,damage:11,range:26}:WEAPONS[p.tool];
    p.nextShot=r.roundTick+spec.interval;
    const ray=aim(p);
    let end=geometry.trace(ray,spec.range),target,vehicle;
    for(const car of r.cars){
      const impact=vehicleHit(ray,car,end);
      if(impact<end){end=impact;vehicle=car;}
    }
    for(const other of [...r.players.values(),...r.bots]){
      if(other===p||!other.hp||(!other.bot&&!other.ws)||safe(other)||r.roundTick<other.joinGuard||(p.bot&&other.bot))continue;
      const hit=avatarHit(ray,other,end);
      if(hit<end){end=hit;target=other;vehicle=null;}
    }
    r.shots.push([p.id,ray.x,ray.y,ray.dx*end,ray.dy*end,ray.dz*end,Boolean(target)]);
    if(vehicle&&!safe(vehicle))vehicle.hp=Math.max(25,vehicle.hp-8);
    if(!target)return;
    target.hp=Math.max(0,target.hp-spec.damage);
    target.hitAt=r.roundTick;
    if(!target.hp)defeat(r,target,p);
  }

  function updateBots(r,count) {
    const active=r.beacons.filter(b=>!b.cool);
    const want=count<=3?2:1;
    r.bots=r.bots.filter(p=>active.some(b=>b.id===p.beacon&&b.site===p.site)&&p.role<want);
    for(const b of active)for(let j=0;j<want;j++){
      if(r.bots.some(p=>p.beacon===b.id&&p.role===j))continue;
      const base=HOTSPOTS[b.site];
      const points=[[0,8],[-7,4],[8,-3],[0,-8]].map(([x,y])=>({x:base.x+x,y:base.y+y}))
        .filter(p=>geometry.walk(p.x,p.y));
      if(points.length<2)continue;
      const p=points[j%points.length];
      r.bots.push({...p,points,role:j,site:b.site,beacon:b.id,id:'bot'+b.id+j,
        name:'巡场机 '+(j+1),bot:true,hp:70,yaw:0,pitch:0,tool:0,nextShot:0,joinGuard:0,respawn:0,state:'巡逻'});
    }
    for(const p of r.bots){
      if(!p.hp){
        if(r.roundTick>=p.respawn)Object.assign(p,{...p.points[0],hp:70,nextShot:r.roundTick+25});
        continue;
      }
      const lim=HOTSPOTS[p.site];
      const target=[...r.players.values()].find(u=>{
        const d=distance(p,u);
        return u.ws&&u.hp&&!safe(u)&&distance(lim,p)<18&&d<24&&d>.1&&visible(p,u,d);
      });
      const returning=distance(p,lim)>15;
      const go=target||p.points[returning?0:(Math.floor(r.roundTick/80)+p.role)%p.points.length];
      p.state=target?'响应':returning?'退回':'巡逻';
      const d=distance(p,go),yaw=Math.atan2(p.x-go.x,go.y-p.y);
      stepWalker(p,{yaw,pitch:0,side:0,forward:d>(target?8:1.3)?(target?.43:.35):0},geometry);
      if(target)fire(r,p);
    }
  }

  function park(r,p,car) {
    if(Math.hypot(car.vx,car.vy)>2.8){notify(p,'减速后再下车。');return;}
    const options=[1.9,-1.9,2.8,-2.8].map(s=>({x:car.x+Math.cos(car.yaw)*s,y:car.y+Math.sin(car.yaw)*s}));
    const point=options.find(({x,y})=>geometry.walk(x,y)&&!r.cars.some(c=>c!==car&&distance(c,{x,y})<1.65));
    if(!point){notify(p,'这里没有下车空间。');return;}
    release(r,p);Object.assign(p,point);p.yaw=car.yaw;
  }

  function interact(r,p) {
    if(!p.hp)return;
    const own=r.beacons.find(b=>b.holder===p.id);
    if(own&&GATES.some(g=>distance(g,p)<5)){
      own.holder=null;own.cool=r.roundTick+cooldown;own.ping=null;
      gain(p,4);notify(p,'信标已交付 · +4 积分');return;
    }
    const available=r.beacons.find(b=>!b.cool&&!b.holder&&r.roundTick>=b.unlock&&distance(p,b)<3.2);
    if(available&&!own&&!p.car&&!safe(p)){
      available.holder=p.id;available.ping=[Math.round(p.x/12)*12,Math.round(p.y/12)*12];
      notify(p,'已拿到信标，去任一交付站。');return;
    }
    if(distance(p,DELIVERY[0])<3.8&&!p.delivery){
      p.delivery={next:1,until:r.roundTick+1500};
      notify(p,'配送已开始，驾车通过两个检查点。');return;
    }
    const car=r.cars.find(c=>c.driver===p.id);
    if(car){
      if(safe(p)&&car.hp<100){
        car.hp=100;p.hp=100;
        notify(p,'车辆已修复。再次互动可下车。');return;
      }
      park(r,p,car);return;
    }
    const near=[...r.cars].sort((a,b)=>distance(a,p)-distance(b,p))[0];
    if(near&&!near.driver&&distance(near,p)<3.4){
      p.car=near.id;near.driver=p.id;near.paint=p.total>=12?p.paint:0;
      Object.assign(p,{x:near.x,y:near.y,yaw:near.yaw,pitch:0});return;
    }
    if(safe(p)){p.hp=100;notify(p,'车库补给已就绪。');}
  }

  function snapshot(r,p,online) {
    const character=q=>[q.id,q.name,q.x,q.y,q.yaw,q.hp,q.car??null,q.tool,q.hitAt??0,q.bot?q.state:null];
    const close=q=>distance(p,q)<110;
    return {type:'state',tick:r.roundTick,ack:p.ack,self:character(p),score:p.score,total:p.total,
      players:online.filter(u=>u!==p&&close(u)).map(character),
      bots:r.bots.filter(close).map(character),
      cars:r.cars.filter(c=>close(c)||c.driver===p.id).map(c=>[c.id,c.x,c.y,c.yaw,c.vx,c.vy,c.hp,c.driver,c.paint]),
      shots:r.shots.filter(([,x,y])=>distance({x,y},p)<100),
      delivery:p.delivery,roster:online.map(q=>[q.id,q.name,q.score]),
      beacons:r.beacons.map(b=>({id:b.id,site:b.site,holder:b.holder,
        ...(b.holder?{ping:b.ping}:{x:b.x,y:b.y}),left:Math.max(0,(b.cool||b.expires)-r.roundTick),cool:Boolean(b.cool)}))};
  }

  function attach(ws,profile) {
    let r,p;
    let budget=36,updated=clock();
    const idle=setTimeout(()=>ws.close(4001,'join timeout'),5000);
    ws.on('error',()=>{});
    ws.on('close',()=>{
      clearTimeout(idle);
      if(p?.ws===ws)abandon(r,p,false);
    });
    ws.on('message',(raw,binary)=>{
      const now=clock();
      budget=Math.min(36,budget+(now-updated)*.065);updated=now;
      if(--budget<0||binary)return;
      let m;try{m=JSON.parse(raw);}catch{return;}
      if(!m||typeof m!=='object')return;
      if(!p){
        if(m.type!=='join'||typeof m.room!=='string'||!roomName.test(m.room))return;
        if(m.protocol!==PROTOCOL||m.version!==map.version){solidDenial(ws,'游戏版本有更新，请刷新。');return;}
        r=rooms.get(m.room);
        if(!r){
          if(rooms.size>=32){solidDenial(ws,'服务器房间已满。',4003);return;}
          r=newRoom(m.room);rooms.set(r.key,r);
        }
        const existing=typeof m.token==='string'&&tokenFormat.test(m.token)?r.players.get(m.token):null;
        if(existing&&!existing.ws&&existing.until>=now&&existing.account===(profile?.id??null))p=existing;
        if(!p){
          if(r.players.size>=ROOM_SIZE){solidDenial(ws,'这个房间已满，请另建房间。',4003);return;}
          const id=randomHex(5),token=randomHex(24);
          let total=0;
          if(profile?.id)try{total=readProgress(profile.id);}catch{}
          p={id,token,name:cleanName(profile?.name||m.name)||'漫游者 '+id.slice(-4).toUpperCase(),
            score:0,total,input:null,ack:0,queued:0,actions:[],nextShot:0,tool:0,car:null,
            account:profile?.id??null,paint:0};
          spawn(r,p,geometry);r.players.set(token,p);
        }
        clearTimeout(idle);p.ws=ws;
        send(ws,{type:'joined',token:p.token,id:p.id,ack:p.ack});
        return;
      }
      if(p.ws!==ws)return;
      if(m.type==='leave'){abandon(r,p,true);ws.close(1000,'left');return;}
      if(m.type!=='input'||!Number.isSafeInteger(m.seq)||m.seq<=p.queued||m.seq>p.ack+180||
        !numbers(m.side,-1,1)||!numbers(m.forward,-1,1)||!numbers(m.yaw,-Math.PI,Math.PI)||!numbers(m.pitch,-.72,.72))return;
      p.queued=m.seq;
      p.input={seq:m.seq,side:m.side,forward:m.forward,yaw:m.yaw,pitch:m.pitch,brake:m.brake===true,
        fire:m.fire===true};
      p.lastInput=r.roundTick;
      if(inputTypes.includes(m.action)&&p.actions.length<4)p.actions.push(m.action);
    });
  }

  function tick() {
    for(const [key,r] of rooms){
      const online=[];
      for(const [token,p] of r.players){
        if(p.ws)online.push(p);
        else if(p.until<=clock())r.players.delete(token);
      }
      if(!r.players.size){rooms.delete(key);continue;}
      if(!online.length)continue;
      r.roundTick++;
      r.shots.length=0;
      const count=online.length>=7?2:1;
      r.beacons=r.beacons.filter(b=>b.id<count||b.holder);
      for(let i=0;i<count;i++){
        const previous=r.beacons.find(b=>b.id===i);
        if(!previous)r.beacons.push(newBeacon(r,i));
        else if(r.roundTick>=(previous.cool||previous.expires)){
          if(previous.holder)notify(online.find(p=>p.id===previous.holder)||{},'信标通道关闭，新的活动即将出现。');
          r.beacons[r.beacons.indexOf(previous)]=newBeacon(r,i);
        }
      }
      for(const b of r.beacons)if(b.id>=count&&b.holder&&b.expires<=r.roundTick){
        notify(online.find(p=>p.id===b.holder)||{},'信标通道关闭。');
        b.holder=null;
      }
      for(const p of online){
        if(!p.hp&&r.roundTick>=p.respawn)spawn(r,p,geometry);
        const input=p.input;
        if(input)p.ack=input.seq;
        if(!p.hp){p.actions.length=0;continue;}
        const fresh=input&&r.roundTick-p.lastInput<5;
        const car=r.cars.find(c=>c.driver===p.id);
        if(car){
          const control=fresh&&car.hp<55?{...input,forward:input.forward*.58}:fresh?input:neutral;
          const hard=stepCar(car,control,geometry,r.cars);
          if(hard)car.hp=Math.max(25,car.hp-7);
          Object.assign(p,{x:car.x,y:car.y,yaw:car.yaw,pitch:0});
        }else if(fresh)stepWalker(p,input,geometry);
        const actions=p.actions.splice(0);
        for(const action of actions){
          if(action==='interact')interact(r,p);
          if(action==='swap'){
            if(safe(p)&&p.total>=12)p.paint=(p.paint+1)%3;
            p.tool=(p.tool+1)%WEAPONS.length;
          }
        }
        if((fresh&&input.fire)||actions.includes('fire'))fire(r,p);
        if(p.delivery){
          const point=DELIVERY[p.delivery.next];
          if(r.roundTick>=p.delivery.until){p.delivery=null;notify(p,'配送超时，可回车库重试。');}
          else if(p.car&&distance(p,point)<7&&++p.delivery.next===DELIVERY.length){
            p.delivery=null;gain(p,3);notify(p,'配送完成 · +3 积分');
          }
        }
      }
      for(const car of r.cars)if(!car.driver&&r.roundTick-car.idle>1200&&!safe(car)&&
        online.every(p=>distance(p,car)>17)&&r.cars.every(c=>c===car||distance(c,{x:car.homeX,y:car.homeY})>3)){
        Object.assign(car,{x:car.homeX,y:car.homeY,yaw:0,vx:0,vy:0,hp:100});
      }
      updateBots(r,online.length);
      if(r.roundTick%60===0)for(const b of r.beacons)if(b.holder){
        const p=online.find(q=>q.id===b.holder);
        if(p)b.ping=[Math.round(p.x/12)*12,Math.round(p.y/12)*12];
      }
      for(const p of online){
        if(p.ws.bufferedAmount>128_000){p.ws.close(1013,'slow connection');continue;}
        send(p.ws,snapshot(r,p,online));
      }
    }
  }
  return {attach,tick,get size(){return rooms.size;}};
}
