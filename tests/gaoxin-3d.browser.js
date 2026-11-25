// Pass this expression to playwright-cli run-code after opening the local 3D campus.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this function.
async (page) => {
  const context = await page.context().browser().newContext({viewport:{width:1280,height:800}});
  const second = await context.newPage(), isolated=await context.newPage();
  const stamp='QA'+Date.now().toString(36).toUpperCase();
  const base='http://127.0.0.1:3108/gaoxin-3d/index.html';
  const errors=[];
  const states=new Map();
  const assert=(ok,msg)=>{if(!ok)throw new Error(msg)};
  function monitor(p) {
    let data={};states.set(p,data);
    p.on('pageerror',e=>errors.push(e.message));
    p.on('websocket',ws=>ws.on('framereceived',({payload})=>{
      try {
        const d=JSON.parse(payload);
        if(d.type==='joined'){data.self=d.player;data.joined=d;data.stage=d.stage;data.players=[];}
        if(d.type==='snapshot'){data.players=d.players;data.stage=d.stage;data.self=d.players.find(x=>x.id===data.self?.id);}
      } catch {}
    }));
  }
  const wait=async(p,pred,label,time=12000)=>{
    const end=Date.now()+time;
    do {if(await pred())return;await p.waitForTimeout(60);} while(Date.now()<end);
    throw new Error(label+' '+JSON.stringify(states.get(p)));
  };
  const state=p=>states.get(p);
  const open=(p,room,name)=>p.goto(base+'?room='+room+'&name='+encodeURIComponent(name));
  const move=async(p,ok,label,time=12000)=>{
    await p.keyboard.down('w');
    try{await wait(p,()=>ok(state(p).self),label,time);}finally{await p.keyboard.up('w');}
    await p.waitForTimeout(150);
  };
  async function look(p,target) {
    const current=state(p).self.yaw;
    const dx=-Math.atan2(Math.sin(target-current),Math.cos(target-current))/.0025;
    await p.evaluate(x=>{
      const canvas=document.querySelector('#game canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
      window.dispatchEvent(new MouseEvent('mousemove',{movementX:x,bubbles:true}));
      window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    },dx);
    await wait(p,()=>Math.abs(state(p).self.yaw-target)<.02,'turn to '+target,8000);
  }
  try {
    for(const p of [page,second,isolated])monitor(p);
    await page.setViewportSize({width:1280,height:800});
    await open(page,stamp,'同行甲');
    await wait(page,()=>state(page).self&&state(page).players.length===1,'first room');
    await open(second,stamp,'同行乙');
    await wait(page,()=>state(page).players?.length===2,'two players');
    await wait(second,()=>state(second).players?.length===2,'two players in second');
    await open(isolated,stamp+'B','其他房间');
    await wait(isolated,()=>state(isolated).players?.length===1,'rooms isolated');
    await isolated.close();
    await page.getByRole('button',{name:'进入校园'}).click();
    await wait(page,()=>page.locator('#entry').isHidden(),'enter first person');
    await look(page,-Math.PI/2);
    await page.waitForTimeout(300);
    await page.screenshot({path:'gaoxin-3d-two.png'});
    await look(page,0);
    await move(page,p=>p.y>-245,'approach first sign');
    await page.keyboard.press('e');
    await wait(page,()=>state(page).stage===1,'player completed first sign');
    await wait(second,()=>state(second).stage===1,'peer saw shared first sign');
    await move(page,p=>p.y>-233,'approach wall');
    await page.keyboard.down('w');await page.waitForTimeout(1000);await page.keyboard.up('w');
    const wall=state(page).self.y;
    assert(wall < -231,'wall collision failed '+wall);
    await look(page,Math.PI-.002);
    await move(page,p=>p.y < -262.8,'back along courtyard',16000);
    await look(page,Math.PI/2);
    await move(page,p=>p.x < -76.5,'walk to lake across chunks',42000);
    await page.keyboard.press('e');
    await wait(page,()=>state(page).stage===2,'complete lake visit');
    await wait(second,()=>state(second).stage===2,'peer saw completed task');
    await page.waitForTimeout(250);
    await page.screenshot({path:'gaoxin-3d-lake.png'});
    const before={...state(page).self};
    await page.reload();
    await wait(page,()=>state(page).self?.id===before.id && state(page).stage===2 && state(page).players?.length===2,'reconnect',12000);
    assert(Math.hypot(state(page).self.x-before.x,state(page).self.y-before.y)<1,'position after reconnect');
    assert(!errors.length,errors.join(';'));
    return {players:state(page).players.map(p=>p.name),wall,final:state(page).self,shared:state(second).stage,reconnected:true,isolated:true,errors};
  } finally { await context.close();}
}
