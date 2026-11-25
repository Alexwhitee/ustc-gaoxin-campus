import { canVisit, cleanName, createCollision, move, TICK } from './world.mjs';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const room = (params.get('room') || 'GAOXIN').toUpperCase();
const entryText = $('entry-copy');
const validRoom = /^[A-Z0-9-]{1,20}$/;
let map, view, canWalk, mode, myId, socket, reconnectTimer, presenceTimer;
let stage=0, roomReady=false, joinedOnce=false, pending=[], sequence=0, yaw=2.02, pitch=-.055;
let active=false, dragging=false, closed=false;
const roomErrors = new Set([4002,4003]);
const me={x:0,y:0,yaw};
const peers=new Map();
const keys=new Set();
const resumeKey='gaoxin-3d-room:'+room;
const identity='view-'+Array.from(crypto.getRandomValues(new Uint8Array(7)),n=>n.toString(16).padStart(2,'0')).join('');
let name=cleanName(params.get('name'));
let target, routePlace, noticeTimer, taskRange;
let last=performance.now(), accum=0, frameCount=0, frameWindow=last;

function status(text) { if ($('status').textContent!==text) $('status').textContent=text; }
function notice(text) {
  $('message').textContent=text;$('message').hidden=false;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{$('message').hidden=true;},2600);
}
function setModeUI() {
  const live=mode==='room';
  $('share').hidden=$('change-room').hidden=!live;
  $('chapter').textContent=live ? '房间 '+room : '校园互见';
  $('other-mode').href=live?'?mode=campus':'?room=GAOXIN';
  $('other-mode').textContent=live?'校园互见':'实时房间';
  updateObjective();
}
function destination(id) {return map.places.find(place=>place.id===id);}
function updateObjective() {
  target=mode==='room' ? destination(map.task[stage]) : null;
  const selected=routePlace || target;
  view.mark(selected);
  $('objective-title').textContent=target?.name || (mode==='room'?'校园打卡完成':'自由探索');
  $('objective-detail').textContent=target?.hint || (mode==='room'?'所有同房同学已同步进度':'与像素校园共享实时位置');
  [...document.querySelectorAll('.progress i')].forEach((e,i)=>e.classList.toggle('done',i<stage));
  $('destination').value=routePlace?.id || '';
  const overview=new URL('./overview.html',location.href);
  if (mode==='room') overview.searchParams.set('room',room);
  else overview.searchParams.set('mode','campus');
  if (routePlace || target) overview.searchParams.set('place',(routePlace || target).id);
  $('overview').href=overview;
}
function applyStage(value) {
  if (!Number.isInteger(value) || value<0 || value>map.task.length || value===stage) return;
  stage=value;if(joinedOnce)routePlace=null;updateObjective();
  if (joinedOnce) notice(stage===map.task.length?'打卡完成，已同步给同房同学。':'已集合，下一站是永怀湖。');
}
function updatePeers(list) {
  const seen=new Set();
  for (const p of list) {
    if (p.id===myId) continue;
    seen.add(p.id);
    let peer=peers.get(p.id);
    if (!peer || Math.hypot(p.x-peer.x,p.y-peer.y)>9) {
      peer={...p};peers.set(p.id,peer);
    }
    peer.targetX=p.x;peer.targetY=p.y;peer.yaw=p.yaw;
  }
  for (const id of peers.keys()) if (!seen.has(id)) peers.delete(id);
}
function interpolate(dt) {
  for (const peer of peers.values()) {
    const dx=peer.targetX-peer.x,dy=peer.targetY-peer.y;
    peer.moving=Math.hypot(dx,dy)>.075;
    const step=Math.min(1,dt*12);
    peer.x+=dx*step;peer.y+=dy*step;
  }
}
function send(value) {
  if (socket?.readyState===WebSocket.OPEN && socket.bufferedAmount<16384) socket.send(JSON.stringify(value));
}
function roomSocket() {
  let settled=false;
  const current=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/gaoxin-3d/socket');
  socket=current;
  current.onopen=()=>send({type:'join',room,resume:sessionStorage.getItem(resumeKey),name,version:map.version});
  current.onmessage=event=>{
    let data;
    try {data=JSON.parse(event.data);} catch {return;}
    if (data.type==='error' || data.type==='notice') notice(data.message);
    if (data.type==='joined') {
      settled=true;roomReady=true;pending=[];sequence=data.player.ack;
      myId=data.player.id;
      sessionStorage.setItem(resumeKey,data.resume);
      Object.assign(me,data.player);
      if (!joinedOnce) yaw=me.yaw;
      applyStage(data.stage);
      joinedOnce=true;
      status('房间 '+room+' · 1 人');
      $('enter').disabled=false;$('enter').textContent='进入校园';
    }
    if (data.type==='snapshot' && roomReady) {
      const self=data.players.find(p=>p.id===myId);
      if (!self) return;
      pending=pending.filter(input=>input.seq>self.ack);
      const corrected={x:self.x,y:self.y,yaw:self.yaw};
      for (const input of pending) move(corrected,input,TICK,canWalk);
      if (Math.hypot(me.x-corrected.x,me.y-corrected.y)>.025) {
        me.x=corrected.x;me.y=corrected.y;
      }
      updatePeers(data.players);
      applyStage(data.stage);
      status('房间 '+room+' · '+data.players.length+' 人');
    }
  };
  current.onclose=event=>{
    if (socket!==current || closed) return;
    roomReady=false;pending=[];peers.clear();
    if (roomErrors.has(event.code)) {
      status('房间暂不可用');return;
    }
    status('连接中断 · 正在重连');
    reconnectTimer=setTimeout(roomSocket,settled?700:1100);
  };
}
async function syncPresence() {
  const [[ax,bx],[ay,by]]=map.toPixel;
  const dx=-Math.sin(yaw),dy=Math.cos(yaw);
  const dir=Math.abs(dx)>Math.abs(dy)?(dx<0?2:3):(dy>0?1:0);
  try {
    const response=await fetch('/api/presence',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({campus:'ustc-gaoxin',id:myId,name,x:Math.round(ax*me.x+bx),y:Math.round(ay*me.y+by),dir,say:''}),
      signal:AbortSignal.timeout(3000)});
    if (!response.ok) throw new Error('presence');
    const data=await response.json();
    const directions=[Math.PI,0,Math.PI/2,-Math.PI/2];
    updatePeers(data.others.flatMap(p=>{
      const x=(p.x-bx)/ax,y=(p.y-by)/ay;
      if (!Number.isFinite(x)||!Number.isFinite(y)||Math.max(Math.abs(x),Math.abs(y))>map.half || directions[p.dir]===undefined) return [];
      return [{id:p.id,name:cleanName(p.name)||'同学',x,y,yaw:directions[p.dir]}];
    }));
    status('校园互见 · '+(peers.size+1)+' 人');
  } catch {
    peers.clear();status('校园互见暂未连接');
  } finally {
    if (!closed) presenceTimer=setTimeout(syncPresence,380);
  }
}

function inputStep() {
  const input={type:'input',seq:++sequence,yaw,
    side:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),
    forward:Number(keys.has('KeyW'))-Number(keys.has('KeyS'))};
  if (mode==='room' && !roomReady) return;
  move(me,input,TICK,canWalk);
  if (mode==='room') {
    pending.push(input);
    if (pending.length>32) pending.shift();
    send(input);
  }
}
function interact() {
  if (mode==='room' && target && roomReady && canVisit(me,target,canWalk)) {
    send({type:'visit',place:target.id});
    return;
  }
  const look=routePlace || target || map.places.find(p=>canVisit(me,p,canWalk));
  if (look && canVisit(me,look,canWalk)) notice(look.name);
  else notice('靠近目标并面向它，再按 E。');
}

const compass = $('map').getContext('2d');
const mapCanvas = document.createElement('canvas');
mapCanvas.width=176;mapCanvas.height=176;
function prepareMiniMap() {
  const ctx=mapCanvas.getContext('2d'), k=80/map.half;
  ctx.fillStyle='#263d34';ctx.fillRect(0,0,176,176);
  const colors={park:'#4a6758',phase:'#666c52',road:'#72877a',water:'#50888d',field:'#7f9a6b'};
  const layer=(rings,style)=>{
    ctx.beginPath();
    for(const ring of rings) {
      ring.forEach(([x,y],i)=>i?ctx.lineTo(88+x*k,88-y*k):ctx.moveTo(88+x*k,88-y*k));ctx.closePath();
    }
    ctx.fillStyle=style;ctx.fill('evenodd');
  };
  for(const kind of ['park','phase','road','water','field']) {
    for(const c of map.chunks)for(const [name,rings] of c.ground)if(name===kind)layer(rings,colors[kind]);
  }
  for(const c of map.chunks)for(const b of c.buildings)layer(b.rings,'#bd9980');
  ctx.fillStyle='#ecf2ea';ctx.font='12px system-ui';ctx.fillText('N',7,14);
}
let lastMini=0;
function mini(now) {
  if (now-lastMini<100) return;lastMini=now;
  const cx=88+me.x*80/map.half,cy=88-me.y*80/map.half,place=routePlace||target;
  compass.drawImage(mapCanvas,0,0);
  if (place) {
    const px=88+place.x*80/map.half,py=88-place.y*80/map.half;
    compass.strokeStyle='#f6cf80';compass.lineWidth=1;
    compass.beginPath();compass.moveTo(cx,cy);compass.lineTo(px,py);compass.stroke();
    compass.beginPath();compass.arc(px,py,3.5,0,Math.PI*2);compass.fillStyle='#f6cf80';compass.fill();
  }
  for(const p of peers.values()) {
    compass.beginPath();compass.arc(88+p.x*80/map.half,88-p.y*80/map.half,2.1,0,Math.PI*2);
    compass.fillStyle='#a4e0e2';compass.fill();
  }
  compass.save();
  compass.translate(cx,cy);compass.rotate(-yaw);
  compass.beginPath();compass.moveTo(0,-6);compass.lineTo(4,4);compass.lineTo(0,2);compass.lineTo(-4,4);compass.closePath();
  compass.fillStyle='#fcf8de';compass.fill();compass.restore();
}
function prompt() {
  const place=routePlace||target;
  taskRange=place?Math.round(Math.hypot(place.x-me.x,place.y-me.y)):null;
  const label=target&&canVisit(me,target,canWalk)?'E  '+target.hint :
    place&&canVisit(me,place,canWalk)?'E  '+place.name:'';
  const text=place ? place.name+' · '+taskRange+' 米' : mode==='room'?'已与同房同学完成打卡':'可从小地图选择目的地';
  if ($('objective-detail').textContent!==text) $('objective-detail').textContent=text;
  $('prompt').hidden=!active||!label;
  if ($('prompt').textContent!==label) $('prompt').textContent=label;
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if (document.hidden) return;
  accum+=dt;
  while(accum>=TICK){inputStep();accum-=TICK;}
  interpolate(dt);mini(now);prompt();
  view.draw(me,peers,yaw,pitch,now/1000);
  frameCount++;
  if(now-frameWindow>=1000) {
    $('fps').textContent=' · '+Math.round(frameCount*1000/(now-frameWindow))+' FPS';
    frameWindow=now;frameCount=0;
  }
}

function stopInput() {keys.clear();dragging=false;}
function moveLook(dx,dy) {
  yaw=Math.atan2(Math.sin(yaw-dx*.0025),Math.cos(yaw-dx*.0025));
  pitch=Math.max(-1.36,Math.min(1.36,pitch-dy*.0023));
}
function enter() {
  active=true;$('entry').hidden=true;
  const canvas=view.renderer.domElement;
  try {
    const lock=canvas.requestPointerLock?.();
    lock?.catch(()=>{notice('拖动画面可转头。');});
  } catch {notice('拖动画面可转头。');}
}
function bind() {
  const canvas=view.renderer.domElement;
  canvas.addEventListener('pointerdown',()=>{if(active)dragging=true;});
  addEventListener('pointerup',()=>{dragging=false;});
  addEventListener('mousemove',e=>{if(active&&(document.pointerLockElement===canvas||dragging))moveLook(e.movementX,e.movementY);});
  addEventListener('keydown',e=>{
    if(e.code==='Escape'&&active) {
      stopInput();active=false;$('entry').hidden=false;
      return;
    }
    if (!active || e.target.closest?.('input,select,button,dialog') && e.target!==$('enter') || e.metaKey || e.ctrlKey || e.altKey)return;
    if(['KeyW','KeyA','KeyS','KeyD'].includes(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='KeyE'&&!e.repeat){e.preventDefault();interact();}
    if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();moveLook(e.code==='ArrowLeft'?-32:32,0);}
  });
  addEventListener('keyup',e=>keys.delete(e.code));
  addEventListener('blur',stopInput);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopInput();});
  document.addEventListener('pointerlockchange',()=>{
    if(!document.pointerLockElement&&active){stopInput();active=false;$('entry').hidden=false;$('enter').textContent='继续漫游';}
  });
  $('enter').onclick=enter;
  $('destination').onchange=()=>{routePlace=destination($('destination').value);updateObjective();};
  $('share').onclick=async()=>{
    const url=new URL(location.href);url.search='';url.searchParams.set('room',room);
    try {await navigator.clipboard.writeText(url.toString());notice('已复制房间链接。');}
    catch {notice('请复制地址栏链接。');}
  };
  $('change-room').onclick=()=>{
    stopInput();$('room-input').value=room;$('name-input').value=name;$('rooms').showModal();
  };
  $('cancel-room').onclick=()=>$('rooms').close();
  $('room-form').onsubmit=event=>{
    event.preventDefault();
    const url=new URL(location.href);
    const next=$('room-input').value.trim().toUpperCase();
    if (!validRoom.test(next)) return;
    url.searchParams.set('room',next);
    url.searchParams.set('name',cleanName($('name-input').value));
    location.assign(url);
  };
  addEventListener('pagehide',()=>{
    closed=true;clearTimeout(reconnectTimer);clearTimeout(presenceTimer);socket?.close();
  });
  addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
}

async function boot() {
  const [world,health,user,{createCampusRenderer}]=await Promise.all([
    fetch('./campus.json').then(r=>{if(!r.ok)throw new Error('找不到校园数据');return r.json();}),
    params.get('mode')==='campus'?null:fetch('./room-health',{cache:'no-store',signal:AbortSignal.timeout(2500)})
      .then(r=>r.ok?r.json():null).catch(()=>null),
    name?null:fetch('/api/auth/me',{signal:AbortSignal.timeout(1500)}).then(r=>r.ok?r.json():null).catch(()=>null),
    import('./render.mjs'),
  ]);
  map=world;mode=health?'room':'campus';
  if(mode==='room'&&!validRoom.test(room))throw new Error('房间号只接受 1–20 位字母、数字和连字符。');
  if(health&&health.version!==map.version)throw new Error('服务器地图已更新，请刷新页面。');
  name=cleanName(name||user?.user?.name)||'同学 '+identity.slice(-4).toUpperCase();
  canWalk=createCollision(map);
  view=createCampusRenderer($('game'),map);
  [me.x,me.y]=map.starts[mode==='room'?0:parseInt(identity.slice(-2),16)%map.starts.length];
  if(!canWalk(me.x,me.y))throw new Error('出生点被地图阻挡。');
  for(const place of map.places) $('destination').append(new Option(place.name,place.id));
  routePlace=destination(params.get('place'));
  prepareMiniMap();bind();setModeUI();
  if (mode==='room') {status('正在进入房间');roomSocket();}
  else {
    myId=identity;entryText.textContent='从图教中心出发，和像素校园里的同学一起走走。';
    $('enter').disabled=false;$('enter').textContent='进入校园';void syncPresence();
  }
  requestAnimationFrame(tick);
}
boot().catch(error=>{
  status('校园未能加载');
  entryText.textContent=error.message;
  $('enter').textContent='刷新页面';$('enter').disabled=false;$('enter').onclick=()=>location.reload();
});
