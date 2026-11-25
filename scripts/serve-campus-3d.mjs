import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { createCampusRooms } from './campus-3d-room.mjs';

const upstream = new URL(process.env.GAOXIN_UPSTREAM || 'http://127.0.0.1:3107');
const host = process.env.GAOXIN_HOST || '127.0.0.1';
const port = Number(process.env.GAOXIN_PORT || 3108);
const map = JSON.parse(await readFile(new URL('../public/gaoxin-3d/campus.json',import.meta.url),'utf8'));
const rooms = createCampusRooms(map);
const wss = new WebSocketServer({noServer:true, maxPayload:2048, perMessageDeflate:false});
const health = '/gaoxin-3d/room-health';

const server = http.createServer((req,res) => {
  if (req.url === health) {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({version:map.version}));
  }
  const [pathname, search] = req.url.split("?", 2);
  if (pathname === '/gaoxin-3d' || pathname === '/gaoxin-3d/') {
    res.writeHead(307, {Location:'/gaoxin-3d/index.html' + (search ? '?' + search : '')});
    return res.end();
  }
  const proxy = http.request({
    hostname:upstream.hostname, port:upstream.port, method:req.method,
    path:req.url, headers:{...req.headers,host:upstream.host},
  }, response => {
    res.writeHead(response.statusCode,response.headers);
    response.pipe(res);
  });
  proxy.on('error', () => {
    if (!res.headersSent) res.writeHead(502, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('jluai 服务未就绪');
  });
  req.pipe(proxy);
});

async function account(req) {
  if (!req.headers.cookie) return '';
  try {
    const result = await fetch(new URL('/api/auth/me',upstream), {
      headers:{cookie:req.headers.cookie}, signal:AbortSignal.timeout(1500),
    });
    if (result.ok) return (await result.json()).user?.name || '';
  } catch {}
  return '';
}

server.on('upgrade', (req,socket,head) => {
  let origin;
  try { origin = new URL(req.headers.origin); } catch {}
  if (req.url !== '/gaoxin-3d/socket' || origin?.host !== req.headers.host ||
      !['http:','https:'].includes(origin?.protocol) || wss.clients.size >= 256) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  let alive = true;
  const closed = () => { alive = false; };
  socket.on('error',closed);
  socket.on('close',closed);
  void account(req).then(name => {
    if (!alive) return;
    socket.off('error',closed);
    socket.off('close',closed);
    wss.handleUpgrade(req,socket,head,ws => {
      ws.alive = true;
      ws.on('pong',() => { ws.alive = true; });
      rooms.attach(ws,name);
    });
  });
});

const tick = setInterval(rooms.tick,50);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    else { ws.alive = false; ws.ping(); }
  }
},15000);
server.on('close',() => { clearInterval(tick); clearInterval(heartbeat); });
server.listen(port,host,() => console.log(`校园 3D 房间 http://${host}:${port}/gaoxin-3d/index.html → ${upstream.origin}`));
