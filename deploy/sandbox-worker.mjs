import { DurableObject } from 'cloudflare:workers';
import campus from '../public/gaoxin-3d/campus.json';
import { PROTOCOL,ROOM_SIZE,STEP } from '../public/gaoxin-sandbox/world.mjs';
import { createSandboxRooms } from '../scripts/campus-sandbox-room.mjs';

const path='/gaoxin-sandbox';
const validRoom=/^[A-Z0-9-]{1,20}$/;

const worker = {
  fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname===path+'/room-health'){
      return Response.json({version:campus.version,protocol:PROTOCOL,guestOnly:true},
        {headers:{'Cache-Control':'no-store'}});
    }
    if(url.pathname===path+'/socket'){
      const room=url.searchParams.get('room')||'';
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return new Response('Expected WebSocket',{status:426});
      if(request.headers.get('Origin')!==url.origin)return new Response('Forbidden',{status:403});
      if(!validRoom.test(room))return new Response('Invalid room',{status:400});
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }
    if(url.pathname==='/'||url.pathname===path||url.pathname===path+'/'){
      url.pathname=path+'/index.html';
      if(!url.searchParams.has('room'))url.searchParams.set('room','LAKESIDE');
      return Response.redirect(url,302);
    }
    return new Response('Not found',{status:404});
  },
};
export default worker;

export class SandboxRoom extends DurableObject {
  #rooms=createSandboxRooms(campus);
  #sockets=new Set();
  #timer;

  fetch(request) {
    if(this.#sockets.size>=ROOM_SIZE*2)return new Response('Room busy',{status:503});
    const room=new URL(request.url).searchParams.get('room');
    const [client,socket]=Object.values(new WebSocketPair());
    socket.accept();
    this.#sockets.add(socket);
    socket.addEventListener('close',()=>this.#sockets.delete(socket));
    let awaitingJoin=true;
    this.#rooms.attach({
      get readyState(){return socket.readyState;},
      get bufferedAmount(){return socket.bufferedAmount??0;},
      send:msg=>socket.send(msg),
      close:(code,reason)=>socket.close(code,reason),
      on(event,listen){
        if(event!=='message'){socket.addEventListener(event,listen);return;}
        socket.addEventListener('message',({data})=>{
          if(typeof data!=='string'||data.length>2048){socket.close(1009,'invalid message');return;}
          if(awaitingJoin){
            let join;
            try{join=JSON.parse(data);}catch{}
            if(join?.type!=='join'||join.room!==room){socket.close(4002,'room mismatch');return;}
            awaitingJoin=false;
          }
          listen(data,false);
        });
      },
    });
    if(!this.#timer)this.#timer=setInterval(()=>{
      this.#rooms.tick();
      if(!this.#sockets.size&&!this.#rooms.size){clearInterval(this.#timer);this.#timer=undefined;}
    },STEP*1000);
    return new Response(null,{status:101,webSocket:client});
  }
}
