// Open the local or public sandbox, then pass this expression to playwright-cli run-code.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI evaluates this function.
async page=>{
  const another=await page.context().browser().newContext({viewport:{width:1440,height:900}});
  const second=await another.newPage();
  const name='QA'+Date.now().toString(36).toUpperCase();
  const url=new URL('/gaoxin-sandbox/index.html?room='+name,page.url()).href;
  const states=new Map(),errors=[];
  function monitor(tab) {
    const model={};states.set(tab,model);
    tab.on('pageerror',e=>errors.push(e.message));
    tab.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    tab.on('websocket',s=>s.on('framereceived',({payload})=>{
      try{
        const d=JSON.parse(payload);
        if(d.type==='joined')model.id=d.id;
        if(d.type==='state')Object.assign(model,d);
      }catch{}
    }));
  }
  const assert=(ok,message)=>{if(!ok)throw Error(message);};
  const wait=async(tab,test,description,limit=11000)=>{
    for(const end=Date.now()+limit;Date.now()<end;){
      if(await test())return;await tab.waitForTimeout(70);
    }
    throw Error(description+' '+JSON.stringify(states.get(tab)?.self));
  };
  const turn=async(tab,heading)=>{
    const model=states.get(tab);
    const yaw=model.self[4];
    const delta=-Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))/.0027;
    await tab.evaluate(dx=>{
      const canvas=document.querySelector('#scene canvas');
      canvas.dispatchEvent(new PointerEvent('pointerdown',{button:2,bubbles:true}));
      window.dispatchEvent(new MouseEvent('mousemove',{movementX:dx,bubbles:true}));
      window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    },delta);
    await wait(tab,()=>Math.abs(states.get(tab).self[4]-heading)<.04,'camera follows mouse input',4000);
  };
  const enter=async(tab,n)=>{
    await tab.goto(url+'&name='+encodeURIComponent(n));
    await tab.getByRole('button',{name:'进入沙盒'}).click();
    await tab.locator('#hud').waitFor();
    await wait(tab,()=>states.get(tab).self,'initial state');
  };
  const approach=async(tab,point,threshold)=>{
    const m=states.get(tab);
    const [, ,x,y]=m.self;
    const yaw=Math.atan2(x-point[0],point[1]-y);
    await turn(tab,yaw);
    await tab.keyboard.down('w');
    try{await wait(tab,()=>Math.hypot(m.self[2]-point[0],m.self[3]-point[1])<threshold,'walk to vehicle');}
    finally{await tab.keyboard.up('w');}
  };
  try{
    await page.setViewportSize({width:1920,height:1080});
    monitor(page);monitor(second);
    await enter(page,'同学甲');
    const first=states.get(page),other=states.get(second);
    assert(first.roster.length===1,'single player auto started');
    assert(first.beacons.length===1,'single player event');
    await enter(second,'同学乙');
    await wait(page,()=>first.players.some(p=>p[0]===other.id),'first browser sees second');
    await wait(second,()=>other.players.some(p=>p[0]===first.id),'second browser sees first');
    const nearest=[...first.cars].sort((a,b)=>Math.hypot(a[1]-first.self[2],a[2]-first.self[3])-
      Math.hypot(b[1]-first.self[2],b[2]-first.self[3]))[0];
    await page.bringToFront();
    await approach(page,[nearest[1],nearest[2]],3.0);
    await page.keyboard.press('e');
    await wait(page,()=>first.self[6]===nearest[0],'vehicle seat accepted');
    await wait(second,()=>other.cars.some(c=>c[0]===nearest[0]&&c[7]===first.id),'second window sees the driver');
    const origin=[first.self[2],first.self[3]];
    await page.keyboard.down('w');
    try{await wait(page,()=>Math.hypot(first.self[2]-origin[0],first.self[3]-origin[1])>4,'drive with real keys');}
    finally{await page.keyboard.up('w');}
    await page.screenshot({path:'sandbox-driving.png'});
    await page.keyboard.down('Space');await page.waitForTimeout(900);await page.keyboard.up('Space');
    await page.keyboard.press('e');
    await wait(page,()=>!first.self[6],'player exits vehicle after braking');
    await page.keyboard.press('q');
    await wait(page,()=>first.self[7]===1,'switch equipment');
    const id=first.id;
    await page.reload();
    await page.getByRole('button',{name:'进入沙盒'}).click();
    await wait(page,()=>first.id===id&&first.roster?.length===2,'same player after reload');
    assert(!errors.length,errors.join('\n'));
    return {room:name,first: first.self[1],second:other.self[1],joinedLate:true,driving:true,reconnected:true,errors};
  }finally{await another.close();}
}
