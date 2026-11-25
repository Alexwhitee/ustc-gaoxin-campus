import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { setTimeout as wait } from 'node:timers/promises';
import { WebSocket, WebSocketServer } from 'ws';
import { createSandboxRooms } from '../scripts/campus-sandbox-room.mjs';
import { PROTOCOL, ROOM_SIZE, wrap } from '../public/gaoxin-sandbox/world.mjs';

const duration = Number(process.argv[2] || 1800);
assert(Number.isFinite(duration)&&duration>=5,'Specify the test duration in seconds.');
const map=JSON.parse(readFileSync(new URL('../public/gaoxin-3d/campus.json',import.meta.url),'utf8'));
const driver=createSandboxRooms(map);
const gateway=new WebSocketServer({host:'127.0.0.1',port:0,maxPayload:2048,perMessageDeflate:false});
await once(gateway,'listening');
gateway.on('connection',socket=>driver.attach(socket));
const url='ws://127.0.0.1:'+gateway.address().port;
const times=[],peers=[],maxBytes=0;
let frames=0,motion=0,shots=0,drivingFrames=0,closed=0;
const route=[[102,-332],[128,-324],[128,-276],[128,-210],[120,-176],[-63,-175],[-65,-267],[-44,-320],[40,-332]];

async function until(condition,description) {
  for(const deadline=performance.now()+10_000;performance.now()<deadline;){
    if(condition())return;
    await wait(30);
  }
  throw Error(description);
}

async function connect(index,token) {
  const client={socket:new WebSocket(url),index,routeIndex:index%3,seq:0};
  client.socket.on('message',data=>{
    const frame=JSON.parse(data);
    if(frame.type==='joined'){client.id=frame.id;client.token=frame.token;client.seq=frame.ack;}
    if(frame.type==='state'){
      const current=frame.self,old=client.frame?.self;
      if(old&&Math.hypot(current[2]-old[2],current[3]-old[3])>.04)motion++;
      if(current[6])drivingFrames++;
      shots+=frame.shots.length;frames++;client.frame=frame;
      client.max=Math.max(client.max||maxBytes,data.length);
    }
  });
  client.socket.on('error',()=>{});
  client.socket.on('close',()=>closed++);
  await once(client.socket,'open');
  client.socket.send(JSON.stringify({type:'join',protocol:PROTOCOL,version:map.version,room:'SOAK',name:'Load '+index,token}));
  return client;
}

function input(client,tick) {
  const {socket,frame,index}=client;
  if(!frame||socket.readyState!==WebSocket.OPEN)return;
  const [, ,x,y,heading,hp,car]=frame.self;
  let [targetX,targetY]=route[client.routeIndex%route.length],action;
  if(!car&&index<8&&tick<800){
    const free=frame.cars.filter(c=>!c[7]).sort((a,b)=>Math.hypot(x-a[1],y-a[2])-Math.hypot(x-b[1],y-b[2]))[0];
    if(free){
      [,targetX,targetY]=free;
      if(Math.hypot(x-targetX,y-targetY)<3)action='interact';
    }
  }
  if(Math.hypot(targetX-x,targetY-y)<7&&tick>160)client.routeIndex++;
  const aim=wrap(Math.atan2(x-targetX,targetY-y)+(tick%60>48?.6:0));
  const steer=Math.max(-1,Math.min(1,wrap(heading-aim)*2));
  socket.send(JSON.stringify({type:'input',seq:++client.seq,yaw:aim,pitch:0,forward:hp?1:0,
    side:car?steer:(tick%120>107?.6:0),brake:!!car&&Math.abs(steer)>.95,fire:index%3===1,action}));
}

const game=setInterval(()=>{
  const start=performance.now();driver.tick();times.push(performance.now()-start);
},50);
let worker;
try {
  for(let i=0;i<ROOM_SIZE;i++)peers.push(await connect(i));
  await until(()=>peers.every(p=>p.frame?.roster.length===ROOM_SIZE),'20 live clients did not reach the same room');
  assert(peers.every(p=>p.frame.beacons.length===2));
  const refused=await connect(ROOM_SIZE);
  assert.equal((await once(refused.socket,'close'))[0],4003);
  let tick=0;
  worker=setInterval(()=>{tick++;for(const p of peers)input(p,tick);},50);
  const start=performance.now();
  let nextReport=60,reconnections=0;
  while(performance.now()-start<duration*1000){
    await wait(Math.min(1000,duration*1000));
    const seconds=(performance.now()-start)/1000;
    if(seconds<nextReport)continue;
    const old=peers[0];old.socket.terminate();
    await until(()=>peers[1].frame.roster.length===ROOM_SIZE-1,'remaining clients did not see the disconnect');
    peers[0]=await connect(old.index,old.token);
    await until(()=>peers[0].id&&peers[1].frame.roster.length===ROOM_SIZE,'rejoined client did not return to the roster');
    assert.equal(peers[0].id,old.id);
    assert.equal(peers[1].frame.roster.length,ROOM_SIZE);
    reconnections++;
    console.log(JSON.stringify({elapsed:Math.round(seconds),players:ROOM_SIZE,ticks:times.length,motion,drivingFrames,reconnections}));
    nextReport+=60;
  }
  const sorted=times.slice().sort((a,b)=>a-b);
  const p95=sorted[Math.floor(sorted.length*.95)];
  assert(peers.every(p=>p.socket.readyState===WebSocket.OPEN));
  assert(frames>ROOM_SIZE*duration*16&&motion>0&&drivingFrames>0&&p95<20);
  assert.equal(closed,1+reconnections);
  console.log(JSON.stringify({seconds:Math.round((performance.now()-start)/1000),players:ROOM_SIZE,frames,motion,
    drivingFrames,shots,reconnections,p95ServerMs:p95,maxFrameBytes:Math.max(...peers.map(p=>p.max||0))}));
} finally {
  clearInterval(game);clearInterval(worker);
  for(const socket of gateway.clients)socket.terminate();
  gateway.close();
}
