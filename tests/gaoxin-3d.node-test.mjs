import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createCampusRooms } from '../scripts/campus-3d-room.mjs';
import { createCollision, move, TICK } from '../public/gaoxin-3d/world.mjs';

const map = JSON.parse(readFileSync(new URL('../public/gaoxin-3d/campus.json',import.meta.url)));
const walk = createCollision(map);

test('real campus waypoints are reachable, while towers and lake stop movement', () => {
  assert(walk(...map.starts[0]));
  const east = {x:58,y:-241,yaw:0};
  for (let i=0;i<150;i++) move(east,{yaw:0,side:0,forward:1},TICK,walk);
  assert(east.y > -233 && east.y < -231);
  assert(!walk(east.x,east.y+.4));
  const lake = {x:-80,y:-265,yaw:Math.PI/2};
  for (let i=0;i<100;i++) move(lake,{yaw:Math.PI/2,side:0,forward:1},TICK,walk);
  assert(lake.x < -83 && lake.x > -87);
  assert(!walk(lake.x-.4,lake.y));
  const [x0,y0] = map.starts[0];
  const cell=2.5, span=Math.floor(map.half/cell)*2+1;
  const index=(x,y)=>Math.round(y/cell+Math.floor(span/2))*span+Math.round(x/cell+Math.floor(span/2));
  const pending = new Set(map.places.map(p=>p.id));
  const seen=new Uint8Array(span*span);
  const queue=[[x0,y0]];
  seen[index(x0,y0)]=1;
  for(let i=0;i<queue.length&&pending.size;i++) {
    const [x,y]=queue[i];
    for(const p of map.places) {
      if(Math.hypot(x-p.x,y-p.y)<2.6)pending.delete(p.id);
    }
    for(const [dx,dy] of [[cell,0],[-cell,0],[0,cell],[0,-cell]]) {
      const to=index(x+dx,y+dy);
      if(seen[to] || !walk(x+dx,y+dy) || !walk(x+dx*.5,y+dy*.5))continue;
      seen[to]=1;queue.push([x+dx,y+dy]);
    }
  }
  assert.deepEqual([...pending],[]);
});

class Socket extends EventEmitter {
  readyState=1;
  bufferedAmount=0;
  results=[];
  send(text){ this.results.push(JSON.parse(text)); }
  push(value){ this.emit('message',Buffer.from(JSON.stringify(value)),false); }
  close(code){ this.code=code;this.readyState=3;this.emit('close'); }
  latest(type){return this.results.findLast(x=>x.type===type);}
}

test('room moves are authoritative, visits are ordered, rooms isolated and reconnect restores the session', () => {
  const fixture = {half:20, version:'unit', starts:[[0,0],[1,0]], solids:[],
    places:[{id:'library',x:0,y:1},{id:'lake',x:0,y:2}],task:['library','lake']};
  const rooms=createCampusRooms(fixture);
  const join=(room,resume,version='unit')=>{
    const s=new Socket();rooms.attach(s);
    s.push({type:'join',room,version,resume,name:'测试'});
    return s;
  };
  const a=join('A'),b=join('A'),c=join('B');
  rooms.tick();
  assert.equal(a.latest('snapshot').players.length,2);
  assert.equal(c.latest('snapshot').players.length,1);
  a.push({type:'visit',place:'lake'});rooms.tick();
  assert.equal(a.latest('snapshot').stage,0);
  a.push({type:'input',seq:1,side:0,forward:1,yaw:0,x:10000,y:10000});rooms.tick();
  const moved=a.latest('snapshot').players[0];
  assert.equal(moved.y,.29);
  a.push({type:'visit',place:'library'});b.push({type:'visit',place:'library'});
  rooms.tick();
  assert.equal(a.latest('snapshot').stage,1);
  assert.equal(b.latest('snapshot').stage,1);
  assert.equal(c.latest('snapshot').stage,0);
  const identity=a.latest('joined');
  a.close();rooms.tick();
  const returned=join('A',identity.resume).latest('joined');
  assert.equal(returned.player.id,identity.player.id);
  assert.equal(returned.player.y,moved.y);
  assert.equal(returned.stage,1);
  assert.equal(join('A',null,'old').code,4002);
});
