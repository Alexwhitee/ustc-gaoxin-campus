import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSandboxRooms } from '../scripts/campus-sandbox-room.mjs';
import { AREA, COVER, DELIVERY,GARAGE,GATES,HOTSPOTS,PROTOCOL,RESUME_MS,STALLS,
  avatarHit,distance,safe,sandboxGeometry,stepCar,wrap } from '../public/gaoxin-sandbox/world.mjs';

const map=JSON.parse(readFileSync(new URL('../public/gaoxin-3d/campus.json',import.meta.url),'utf8'));
const geometry=sandboxGeometry(map);
const neutral={forward:0,side:0,yaw:0,pitch:0};
class Client extends EventEmitter {
  readyState=1;
  bufferedAmount=0;
  seq=0;
  data=new Map();
  send(text){const msg=JSON.parse(text);this.data.set(msg.type,msg);}
  push(message){this.emit('message',Buffer.from(JSON.stringify(message)),false);}
  close(code){this.code=code;this.readyState=3;this.emit('close');}
  input(values={}){this.push({type:'input',seq:++this.seq,...neutral,...values});}
  get joined(){return this.data.get('joined');}
  get state(){return this.data.get('state');}
  get player(){const [, ,x,y,yaw,hp,car]=this.state.self;return {x,y,yaw,hp,car};}
}

function fixture(options={}) {
  let now=0;
  const world=createSandboxRooms(map,{clock:()=>now,...options});
  const advance=(n=1)=>{for(let i=0;i<n;i++){now+=50;world.tick();}};
  const join=(room='TEST',token,profile)=>{
    const client=new Client();
    world.attach(client,profile);client.push({type:'join',room,protocol:PROTOCOL,version:map.version,token,name:'试玩'});
    client.seq=client.joined?.ack||0;
    advance();
    return client;
  };
  return {advance,join,world};
}

function walk(client,advance,p,epsilon=1.2) {
  for(let i=0;i<620;i++){
    const from=client.player;
    if(distance(from,p)<epsilon)return;
    const yaw=Math.atan2(from.x-p.x,p.y-from.y);
    client.input({yaw,forward:1});advance();
  }
  throw Error('walk blocked: '+JSON.stringify({from:client.player,to:p}));
}

function clearGuards(client,advance) {
  for(let i=0;i<30;i++){
    const from=client.player;
    const target=client.state.bots.find(([, ,x,y,,hp])=>{
      const range=distance(from,{x,y});
      return hp&&range>1&&range<46&&geometry.trace({x:from.x,y:from.y,z:1.48,
        dx:(x-from.x)/range,dy:(y-from.y)/range,dz:0},range)>=range-.02;
    });
    if(!target)return;
    const yaw=Math.atan2(from.x-target[2],target[3]-from.y);
    client.input({yaw,fire:true});advance();
  }
}

function drive(client,advance,p,epsilon=4.8) {
  for(let i=0;i<460;i++){
    const from=client.player;
    if(distance(from,p)<epsilon)return;
    const car=client.state.cars.find(c=>c[0]===from.car);
    assert(car,'no longer in the car');
    const desired=Math.atan2(from.x-p.x,p.y-from.y);
    const turn=wrap(car[3]-desired);
    const side=Math.max(-1,Math.min(1,turn*2.2));
    client.input({side,forward:Math.abs(turn)>.48?.55:1});advance();
  }
  throw Error('drive blocked: '+JSON.stringify({from:client.player,to:p}));
}

test('the arena points support a continuous walking and driving loop',()=>{
  for(const car of [false,true]){
    const all=[GARAGE,...HOTSPOTS,...GATES,...DELIVERY,...STALLS.map(([x,y])=>({x,y}))];
    for(const p of all)assert.ok(geometry.walk(p.x,p.y,car),p.name||JSON.stringify(p));
    const queue=[{x:43,y:-332}],seen=new Set(['43,-332']);
    for(let i=0;i<queue.length;i++){
      const {x,y}=queue[i];
      for(const [dx,dy] of [[-2,0],[2,0],[0,2],[0,-2]]){
        const nx=x+dx,ny=y+dy,tag=nx+','+ny;
        if(seen.has(tag)||!geometry.walk(nx,ny,car)||!geometry.walk(x+dx/2,y+dy/2,car))continue;
        seen.add(tag);queue.push({x:nx,y:ny});
      }
    }
    for(const p of all)assert.ok(queue.some(q=>distance(q,p)<3.5),'unreachable '+JSON.stringify(p));
  }
  assert.equal(geometry.walk(AREA.left,AREA.south),false);
});

test('ray height, terrain collision and vehicle braking use consistent geometry',()=>{
  const [x,y,w,,h]=COVER[0];
  const ray={x:x-w/2-3,y,z:h-.07,dx:1,dy:0,dz:0};
  assert.equal(geometry.trace(ray,12),3);
  assert.equal(geometry.trace({...ray,z:h+.1},8),8);
  assert.equal(avatarHit({...ray,z:1},{x:x+4,y},3),Infinity);
  const car={x:43,y:-331,yaw:0,vx:0,vy:0};
  for(let i=0;i<26;i++)stepCar(car,{...neutral,forward:1},geometry);
  const speed=Math.hypot(car.vx,car.vy);
  assert(speed>5);
  for(let i=0;i<30;i++)stepCar(car,{...neutral,brake:true},geometry);
  assert(Math.hypot(car.vx,car.vy)<.05);
  const wallcar={x:58,y:-239,yaw:0,vx:0,vy:12};
  for(let i=0;i<30;i++)stepCar(wallcar,{...neutral,forward:1},geometry);
  assert(wallcar.y < -233);
});

test('supports 1, 2, 6, 12 and 20 players with a second hotspot and isolated rooms',()=>{
  const {join,world,advance}=fixture();
  const clients=[];
  for(let i=1;i<=20;i++){
    clients.push(join());
    const s=clients[0].state;
    assert.equal(s.roster.length,i);
    assert.equal(s.beacons.length,i>=7?2:1);
  }
  assert.equal(join().code,4003);
  assert.equal(join('OTHER').state.roster.length,1);
  clients[19].push({type:'leave'});advance();
  assert.equal(clients[0].state.roster.length,19);
  assert(join().joined);
  const original=clients[0].joined;
  clients[0].close();advance();
  const back=join('TEST',original.token);
  assert.equal(back.joined.id,original.id);
  assert.equal(world.size,2);
  back.close();advance(Math.ceil(RESUME_MS/50)+1);
  assert.notEqual(join('OTHER').joined.id,original.id);
});

test('a chair is exclusive, driving follows input and a dropped connection frees the vehicle',()=>{
  const {join,advance}=fixture();
  const a=join(),b=join();
  const [,x,y]=a.state.cars.at(-1);
  walk(a,advance,{x,y},2.9);
  walk(b,advance,{x,y},2.9);
  a.input({action:'interact'});b.input({action:'interact'});advance();
  assert(a.player.car);
  assert.equal(b.player.car,null);
  const prior=a.player;
  for(let i=0;i<28;i++){a.input({forward:-1});advance();}
  assert(distance(a.player,prior)>1.4);
  const token=a.joined.token,id=a.joined.id;
  a.close();advance();
  assert.equal(b.state.cars.find(c=>c[0]===prior.car)[7],null);
  const resumed=join('TEST',token);
  assert.equal(resumed.joined.id,id);assert.equal(resumed.player.car,null);
});

test('safe garage denies fire and an untrusted position is ignored',()=>{
  const {join,advance}=fixture();
  const a=join(),b=join();
  assert(safe(a.player));assert(safe(b.player));
  const old=a.player;
  for(let i=0;i<100;i++){a.input({fire:true,x:-75,y:-268});advance();}
  assert.equal(b.player.hp,100);
  assert.equal(a.state.shots.length,0);
  assert.equal(distance(a.player,old),0);
});

test('free-area combat uses server hit checks and respawns at the garage',()=>{
  const {join,advance}=fixture();
  const a=join(),b=join();
  walk(a,advance,{x:12,y:-323});a.input();advance();
  walk(b,advance,{x:10,y:-329});b.input();advance();
  assert(!safe(a.player)&&!safe(b.player));
  const yaw=Math.atan2(a.player.x-b.player.x,b.player.y-a.player.y);
  for(let shot=0;shot<4;shot++){
    a.input({action:'fire',yaw});advance(6);
  }
  assert.equal(b.player.hp,0);
  assert.equal(a.state.score,1);
  advance(50);
  assert.equal(b.player.hp,100);
  assert(safe(b.player));
});

test('a solo player finds guards, wins a beacon, delivers once and restores rewards from saved progress',()=>{
  const saved=new Map();
  const profile={id:'fixture-user',name:'巡行员'};
  const {join,advance}=fixture({
    readProgress:id=>saved.get(id)||0,
    writeProgress:(id,value)=>saved.set(id,(saved.get(id)||0)+value),
  });
  const a=join('SOLO',null,profile);
  for(const [x,y] of [[12,-328],[-40,-318],[-55,-301],[-63,-286],[-65,-271],[-73,-268]]){
    walk(a,advance,{x,y});
    clearGuards(a,advance);
  }
  assert(a.state.bots.length>=1);
  a.input({action:'interact'});advance();
  assert.equal(a.state.beacons[0].holder,a.joined.id);
  for(const [x,y] of [[-64,-273],[-62,-286],[-53,-302],[-44,-314]]){
    walk(a,advance,{x,y});clearGuards(a,advance);
  }
  const before=a.state.score;
  a.input({action:'interact'});advance();
  assert.equal(a.state.score,before+4,JSON.stringify({player:a.player,beacon:a.state.beacons[0]}));
  assert.equal(a.state.beacons[0].cool,true);
  for(let attempt=0;attempt<4;attempt++){a.input({action:'interact'});advance();}
  assert.equal(saved.get(profile.id),before+4);
  a.push({type:'leave'});
  assert.equal(join('SECOND',null,profile).state.total,before+4);
});

test('a driver starts and completes an ordered delivery in the sandbox',()=>{
  const {join,advance}=fixture();
  const a=join('DELIVERY');
  for(const [x,y] of [[32,-324],[32,-314]])walk(a,advance,{x,y});
  a.input({action:'interact'});advance();
  assert.equal(a.state.delivery.next,1);
  walk(a,advance,{x:38,y:-317},2.9);
  a.input({action:'interact'});advance();
  assert(a.player.car);
  for(const [x,y] of [[87,-311],[126,-306],[126,-271],[125,-209],[125,-184]]){
    drive(a,advance,{x,y});
  }
  assert.equal(a.state.delivery,null);
  assert.equal(a.state.score,3);
});
