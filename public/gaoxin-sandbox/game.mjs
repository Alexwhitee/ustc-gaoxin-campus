import { AREA,DELIVERY,distance,GARAGE,GATES,HOTSPOTS,PROTOCOL,STEP,safe,sandboxGeometry,stepCar,stepWalker,WEAPONS,wrap } from './world.mjs';
import { createSandboxView } from './look.mjs';

const $=id=>document.getElementById(id);
const text=(id,value)=>{if($(id).textContent!==String(value))$(id).textContent=value;};
const params=new URLSearchParams(location.search);
const key='gaoxin-sandbox:';
const valid=/^[A-Z0-9-]{1,20}$/;
let room=(params.get('room')||'LAKESIDE').toUpperCase(),socket,geometry,map,view;
let online=false,playing=false,closing=false,seq=0,pending=[],action,fire=false,dragging=false,retry,noticeTimer;
let lastInputSignature='',lastInputAt=0;
let me={...GARAGE,id:'intro',yaw:-.18,pitch:0,hp:100,tool:0},visual={...me},yaw=.08,pitch=-.10;
let driving,muted=false,context,engine,engineGain,angle=0,nextStep=0;
let state={tick:0,cars:[],beacons:[],players:[],bots:[],shots:[],roster:[],score:0,total:0};
const keys=new Set();
const mapCanvas=$('map'),mini=mapCanvas.getContext('2d');
const staticMap=document.createElement('canvas');
staticMap.width=mapCanvas.width;staticMap.height=mapCanvas.height;
const coords=(x,y)=>[5+(x-AREA.left)/(AREA.right-AREA.left)*204,5+(AREA.north-y)/(AREA.north-AREA.south)*164];

$('room').value=valid.test(room)?room:'LAKESIDE';
$('name').value=params.get('name')||sessionStorage.getItem(key+'name')||'';

function notice(message) {
  text('notice',message);$('notice').hidden=false;
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,2800);
}

function startSound() {
  if(!context){
    context=new AudioContext();
    engine=context.createOscillator();engine.type='triangle';engine.frequency.value=51;
    engineGain=context.createGain();engineGain.gain.value=0;
    engine.connect(engineGain).connect(context.destination);engine.start();
  }
  void context.resume();
}

function sound(kind,pan=0,attenuation=1) {
  if(!context||muted||context.state!=='running')return;
  const tone=context.createOscillator(),gain=context.createGain(),direction=context.createStereoPanner();
  const [freq,end,duration,volume,type]={
    pulse:[218,58,.13,.15,'triangle'], hit:[550,750,.10,.13,'sine'],
    event:[380,680,.30,.10,'triangle'], pavement:[142,68,.062,.045,'triangle'],
    grass:[77,45,.055,.027,'triangle'], engine:[180,90,.20,.08,'triangle'],
  }[kind];
  const at=context.currentTime;
  direction.pan.value=pan;
  tone.type=type;tone.frequency.setValueAtTime(freq,at);tone.frequency.exponentialRampToValueAtTime(end,at+duration);
  gain.gain.setValueAtTime(Math.max(.001,volume*attenuation),at);
  gain.gain.exponentialRampToValueAtTime(.001,at+duration);
  tone.connect(gain).connect(direction).connect(context.destination);tone.start(at);tone.stop(at+duration);
  tone.onended=()=>{tone.disconnect();gain.disconnect();direction.disconnect();};
}

function prepareMap() {
  const ctx=staticMap.getContext('2d');
  ctx.fillStyle='#263b35';ctx.fillRect(0,0,214,174);
  function polygon(rings,color) {
    ctx.beginPath();
    for(const ring of rings){
      ring.forEach(([x,y],i)=>i?ctx.lineTo(...coords(x,y)):ctx.moveTo(...coords(x,y)));
      ctx.closePath();
    }
    ctx.fillStyle=color;ctx.fill('evenodd');
  }
  for(const chunk of map.chunks)for(const [kind,rings] of chunk.ground){
    if(kind==='road'||kind==='path'||kind==='water')polygon(rings,kind==='water'?'#29596c':'#47564e');
  }
  for(const chunk of map.chunks)for(const b of chunk.buildings)polygon(b.rings,'#718079');
  const origin=coords(GARAGE.x-24,GARAGE.y+19),end=coords(GARAGE.x+24,GARAGE.y-19);
  ctx.fillStyle='#3e7966';ctx.fillRect(...origin,end[0]-origin[0],end[1]-origin[1]);
}

function drawMap() {
  mini.drawImage(staticMap,0,0);
  function dot(x,y,color,radius=2.4) {
    mini.fillStyle=color;mini.beginPath();mini.arc(...coords(x,y),radius,0,Math.PI*2);mini.fill();
  }
  for(const [,x,y] of state.cars)dot(x,y,'#e1dfd0',2.5);
  for(const [, ,x,y] of state.players)dot(x,y,'#ec8e70',2.7);
  const target=DELIVERY[state.delivery?.next||0];
  dot(target.x,target.y,'#82d9ee',state.delivery?4:3);
  if(state.beacons.some(b=>b.holder===me.id))for(const g of GATES)dot(g.x,g.y,'#a9e3cc',3.8);
  for(const b of state.beacons)if(!b.cool){
    if(b.holder&&b.ping)dot(...b.ping,'#f4c780',4);
    else if(!b.holder)dot(b.x,b.y,'#f4c780',4.1);
  }
  const [x,y]=coords(me.x,me.y);
  mini.save();mini.translate(x,y);mini.rotate(-(me.car?me.yaw:yaw));mini.fillStyle='#e9faf3';
  mini.beginPath();mini.moveTo(0,-7);mini.lineTo(-4,3);mini.lineTo(4,3);mini.closePath();mini.fill();mini.restore();
}

function viaInput(p,input) {
  if(p.car && driving){
    const car={...driving,x:p.x,y:p.y,yaw:p.yaw};
    const obstacles=state.cars.map(([id,x,y])=>({id,x,y}));
    stepCar(car,driving.hp<55?{...input,forward:input.forward*.58}:input,geometry,obstacles);
    Object.assign(driving,car);
    Object.assign(p,{x:car.x,y:car.y,yaw:car.yaw});
  }else if(!p.car)stepWalker(p,input,geometry);
}

function actor([id,name,x,y,yaw,hp,car,tool,hit,bot]) {
  return {id,name,x,y,yaw,hp,car,tool,hit,bot};
}

function showState() {
  text('status',room+' · '+state.roster.length+'/20 在线');
  text('zone',safe(me)?'南门车库 · 安全区':'自由交战区');
  const carrying=state.beacons.find(b=>b.holder===me.id);
  const events=state.beacons.filter(b=>!b.cool).map(b=>HOTSPOTS[b.site].name);
  if(carrying){
    text('objective','将信标带到交付站');
    text('route',GATES.map(g=>g.name+' '+Math.round(distance(g,me))+'m').join(' / '));
  }else if(state.delivery){
    const target=DELIVERY[state.delivery.next];
    text('objective','配送 · '+target.name);
    text('route',Math.round(distance(target,me))+'m · 剩余 '+Math.ceil((state.delivery.until-state.tick)*STEP)+' 秒');
  }else{
    text('objective',events.length?'湖畔信标':'等待下一个信标');
    const event=state.beacons.find(b=>!b.cool), target=event&&(event.holder&&event.ping?{x:event.ping[0],y:event.ping[1]}:event);
    text('route',events.length?events.join(' / ')+(target&&Number.isFinite(target.x)?' · '+Math.round(distance(target,me))+'m':''):'可先去车库发货台接单');
  }
  text('health',me.hp);
  $('health-bar').value=me.hp;
  $('recover').hidden=me.hp>0;
  text('score',state.score);
  text('rank',state.total>=12?'资深巡行者':'');
  text('kit-label',me.car?'载具':'装备');
  text('kit',me.car?'电动巡行车':WEAPONS[me.tool].name);
  $('speed').hidden=!me.car;
  if(driving)text('speed',Math.round(Math.hypot(driving.vx,driving.vy)*3.6)+' km/h · 车况 '+driving.hp+'%');
  $('reticle').hidden=!!me.car||!me.hp;
  $('reticle').classList.toggle('hit',performance.now()<hitUntil);
  const near=state.cars.find(([,x,y,,,,,driver])=>!driver&&distance(me,{x,y})<3.4);
  const pickup=state.beacons.some(b=>!b.cool&&!b.holder&&distance(me,b)<3.2);
  const prompt=carrying&&GATES.some(g=>distance(me,g)<5)?'E  交付信标'
    : !state.delivery&&distance(me,DELIVERY[0])<3.8?'E  接配送任务'
    : me.car?(safe(me)&&driving?.hp<100?'E  修车':'E  减速下车')
    : pickup?'E  拾取信标':near?'E  上车':safe(me)&&me.hp<100?'E  车库补给':'';
  $('action').hidden=!prompt||!me.hp;
  if(prompt)text('action',prompt);
  drawMap();
}

let hitUntil=0,beaconNames='';
function update(data) {
  const previous=me;
  state=data;
  me=actor(data.self);
  if(previous.car!==me.car)sound('engine');
  const car=data.cars.find(([id])=>id===me.car);
  driving=car?{id:car[0],vx:car[4],vy:car[5],hp:car[6]}:null;
  pending=pending.filter(i=>i.seq>data.ack);
  if(me.hp&&previous.car===me.car)for(const input of pending)viaInput(me,input);
  me.moving=keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD');
  for(const [id,x,y,,,,hit] of data.shots){
    const offset=Math.atan2(me.x-x,y-me.y);
    const other=id!==me.id,range=distance(me,{x,y});
    sound(!other&&hit?'hit':'pulse',other?Math.sin(offset-yaw)*.85:0,other?1/(1+range*range/460):1);
    if(id===me.id&&hit)hitUntil=performance.now()+160;
  }
  const signature=state.beacons.filter(b=>!b.cool).map(b=>b.id+':'+b.site).join(',');
  if(signature&&signature!==beaconNames){
    const {site}=state.beacons.find(b=>!b.cool),target=HOTSPOTS[site];
    sound('event',Math.sin(Math.atan2(me.x-target.x,target.y-me.y)-yaw)*.75);
  }
  beaconNames=signature;
  showState();
}

function lock() {
  try{view.canvas.requestPointerLock?.()?.catch(()=>{});}catch{}
  startSound();
}

function connect() {
  const protocol=location.protocol==='https:'?'wss:':'ws:';
  const ws=new WebSocket(protocol+'//'+location.host+'/gaoxin-sandbox/socket?room='+encodeURIComponent(room));
  socket=ws;
  ws.onopen=()=>ws.send(JSON.stringify({type:'join',protocol:PROTOCOL,version:map.version,room,
    token:sessionStorage.getItem(key+room),name:$('name').value}));
  ws.onmessage=({data:raw})=>{
    const data=JSON.parse(raw);
    if(data.type==='error'){
      if(data.message.includes('已满')||data.message.includes('刷新')){
        closing=true;showEntry(data.message);
      }else notice(data.message);
    }
    if(data.type==='notice'){notice(data.message);sound('event');}
    if(data.type==='joined'){
      seq=data.ack;pending=[];lastInputSignature='';online=true;playing=true;
      sessionStorage.setItem(key+room,data.token);
      $('front').hidden=true;$('hud').hidden=false;
      $('focus').hidden=!!document.pointerLockElement;
    }
    if(data.type==='state')update(data);
  };
  ws.onclose=()=>{
    if(ws!==socket)return;
    online=false;keys.clear();fire=false;action=null;
    if(closing||document.visibilityState==='hidden'&&!playing)return;
    if(!playing){
      showEntry('无法连到房间服务。请从游戏网关地址进入。');return;
    }
    text('status','连接中断 · 正在恢复');
    retry=setTimeout(connect,750);
  };
}

function showEntry(message) {
  playing=false;online=false;$('front').hidden=false;$('hud').hidden=true;
  $('enter').disabled=false;text('enter','进入沙盒');text('entry-status',message);
  document.exitPointerLock?.();
}

function sendInput() {
  if(!online||socket?.readyState!==WebSocket.OPEN||socket.bufferedAmount>12_000)return;
  const side=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));
  const forward=Number(keys.has('KeyW'))-Number(keys.has('KeyS'));
  const signature=[side,forward,yaw,pitch,keys.has('Space'),fire].join(',');
  const now=performance.now();
  const rolling=driving&&Math.hypot(driving.vx,driving.vy)>.05;
  if(!side&&!forward&&!fire&&!action&&!rolling&&signature===lastInputSignature&&now-lastInputAt<1000)return;
  lastInputSignature=signature;lastInputAt=now;
  const input={type:'input',seq:++seq,side,forward,yaw,pitch,brake:keys.has('Space'),fire,action};
  action=null;
  socket.send(JSON.stringify(input));
  pending.push(input);if(pending.length>90)pending.shift();
  if(me.hp)viaInput(me,input);
  me.moving=!!(side||forward);
}

$('join').onsubmit=event=>{
  event.preventDefault();
  const value=$('room').value.trim().toUpperCase();
  if(!valid.test(value)||!view)return;
  room=value;closing=false;clearTimeout(retry);
  const href=new URL(location.href);
  href.searchParams.set('room',room);href.searchParams.delete('name');
  history.replaceState(null,'',href);
  sessionStorage.setItem(key+'name',$('name').value);
  $('enter').disabled=true;text('enter','正在加入…');lock();connect();
};
$('quality').onchange=()=>view.quality($('quality').value);
$('sound').onclick=()=>{
  muted=!muted;$('sound').setAttribute('aria-pressed',String(muted));
  text('sound',muted?'恢复声音':'静音');if(!muted)startSound();
};
$('invite').onclick=async()=>{
  try{
    const url=new URL(location.href);url.search='';url.searchParams.set('room',room);
    await navigator.clipboard.writeText(url.href);notice('已复制房间链接。');
  }catch{notice('请复制地址栏里的房间链接。');}
};
$('leave').onclick=()=>{
  closing=true;clearTimeout(retry);
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'leave'}));
  sessionStorage.removeItem(key+room);
  socket?.close();
  state={tick:0,cars:[],beacons:[],players:[],bots:[],shots:[],roster:[],score:0,total:0};
  me={...GARAGE,id:'intro',yaw:0,pitch:0,hp:100,tool:0};
  showEntry('已退出房间，其他玩家可以继续。');
};
$('focus').onclick=lock;

const clear=()=>{keys.clear();fire=dragging=false;};
addEventListener('blur',clear);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
document.addEventListener('pointerlockchange',()=>{
  if(!document.pointerLockElement)clear();
  $('focus').hidden=!playing||!!document.pointerLockElement;
});
addEventListener('pagehide',()=>{closing=true;clearTimeout(retry);socket?.close();});
addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
addEventListener('keydown',e=>{
  if(!playing||e.target.closest?.('input,select')||e.metaKey||e.ctrlKey||e.altKey)return;
  if(['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)){keys.add(e.code);e.preventDefault();}
  if(e.code==='KeyE'&&!e.repeat)action='interact';
  if(e.code==='KeyQ'&&!e.repeat)action='swap';
  if(e.code==='Tab'&&document.pointerLockElement){
    e.preventDefault();
    const rows=[...state.roster].sort((a,b)=>b[2]-a[2]).map(([,name,score])=>{
      const item=document.createElement('li');item.textContent=name+' · '+score;return item;
    });
    $('roster').replaceChildren(...rows);$('roster').hidden=false;
  }
});
addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='Tab')$('roster').hidden=true;});
addEventListener('mousemove',e=>{
  if(!playing||me.car||(!document.pointerLockElement&&!dragging))return;
  yaw=wrap(yaw-e.movementX*.0027);
  pitch=Math.max(-.71,Math.min(.71,pitch-e.movementY*.0025));
});
addEventListener('pointerup',()=>{fire=dragging=false;});

let last=performance.now(),accumulator=0;
function animate(now) {
  requestAnimationFrame(animate);
  const dt=Math.min(.1,(now-last)/1000);last=now;
  if(document.hidden)return;
  accumulator+=dt;
  while(accumulator>=STEP){sendInput();accumulator-=STEP;}
  const lerp=visual.id!==me.id||distance(visual,me)>6?1:Math.min(1,dt*17);
  visual={...me,x:visual.x+(me.x-visual.x)*lerp,y:visual.y+(me.y-visual.y)*lerp};
  angle=me.car?angle+wrap(me.yaw-angle)*lerp:yaw;
  if(me.car)visual.yaw=angle;
  else visual.yaw=yaw;
  if(context){
    const speed=driving?Math.hypot(driving.vx,driving.vy):0;
    engine.frequency.setTargetAtTime(45+speed*8,context.currentTime,.09);
    engineGain.gain.setTargetAtTime(!muted&&me.car&&playing?.08+speed*.006:0,context.currentTime,.08);
    if(now>nextStep&&playing&&me.moving&&!me.car&&me.hp){
      nextStep=now+330;
      sound(me.x>105||Math.abs(me.y+264)<5||safe(me)?'pavement':'grass');
    }
  }
  view.draw(visual,[...state.players,...state.bots].map(actor),state,yaw,pitch,now/1000);
}

async function boot() {
  const [world,health]=await Promise.all([
    fetch('/gaoxin-3d/campus.json').then(r=>r.ok?r.json():Promise.reject(Error('校园数据未找到。'))),
    fetch('/gaoxin-sandbox/room-health',{cache:'no-store'}).then(r=>r.ok?r.json():null),
  ]);
  if(health?.protocol!==PROTOCOL||health.version!==world.version)throw Error('请从实时房间网关进入沙盒。');
  if(health.guestOnly){
    $('campus-link').href='https://ustc-gaoxin-campus.pages.dev/';
    text('campus-link','返回项目官网');
  }
  map=world;geometry=sandboxGeometry(map);prepareMap();
  view=await createSandboxView($('scene'),map,geometry);
  view.quality($('quality').value);
  view.canvas.addEventListener('pointerdown',event=>{
    if(!playing)return;
    if(event.button===0){fire=true;action='fire';}
    dragging=true;
  });
  view.canvas.addEventListener('contextmenu',event=>event.preventDefault());
  $('enter').disabled=false;text('enter','进入沙盒');requestAnimationFrame(animate);
}

boot().catch(error=>{
  text('entry-status',error.message);text('enter','加载失败');
  console.error(error);
});
