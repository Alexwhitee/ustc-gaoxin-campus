import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { WebSocketServer } from 'ws';
import { createCampusRooms } from './campus-3d-room.mjs';
import { createSandboxRooms } from './campus-sandbox-room.mjs';
import { PROTOCOL } from '../public/gaoxin-sandbox/world.mjs';

const upstream = new URL(process.env.GAOXIN_UPSTREAM || 'http://127.0.0.1:3107');
const host = process.env.GAOXIN_HOST || '127.0.0.1';
const port = Number(process.env.GAOXIN_PORT || 3108);
const map = JSON.parse(await readFile(new URL('../public/gaoxin-3d/campus.json',import.meta.url),'utf8'));
const rooms = createCampusRooms(map);
const sandboxPath = '/gaoxin-sandbox';
let progress;
function scores() {
  if (progress) return progress;
  const path = process.env.GAOXIN_SANDBOX_DB || 'data/campus-sandbox.db';
  mkdirSync(dirname(path), { recursive:true });
  const db = new Database(path);
  db.pragma('journal_mode=WAL');
  db.exec('CREATE TABLE IF NOT EXISTS progress (account TEXT PRIMARY KEY, score INTEGER NOT NULL)');
  progress = {
    get: db.prepare('SELECT score FROM progress WHERE account=?'),
    add: db.prepare('INSERT INTO progress(account,score) VALUES (?,?) ON CONFLICT(account) DO UPDATE SET score=score+excluded.score'),
  };
  return progress;
}
const sandbox = createSandboxRooms(map, {
  readProgress: id => scores().get.get(id)?.score ?? 0,
  writeProgress: (id,score) => scores().add.run(id,score),
});
const wss = new WebSocketServer({noServer:true, maxPayload:2048, perMessageDeflate:false});
const health = '/gaoxin-3d/room-health';

const server = http.createServer((req,res) => {
  if (req.url === health) {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({version:map.version}));
  }
  if (req.url === sandboxPath+'/room-health') {
    res.writeHead(200, {'Content-Type':'application/json','Cache-Control':'no-store'});
    return res.end(JSON.stringify({version:map.version,protocol:PROTOCOL}));
  }
  const [pathname, search] = req.url.split("?", 2);
  if (pathname === sandboxPath || pathname === sandboxPath+'/') {
    res.writeHead(307, {Location:sandboxPath+'/index.html' + (search ? '?' + search : '')});
    return res.end();
  }
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
  if (!req.headers.cookie) return null;
  try {
    const result = await fetch(new URL('/api/auth/me',upstream), {
      headers:{cookie:req.headers.cookie}, signal:AbortSignal.timeout(1500),
    });
    if (result.ok) return (await result.json()).user ?? null;
  } catch {}
  return null;
}

server.on('upgrade', (req,socket,head) => {
  let origin;
  try { origin = new URL(req.headers.origin); } catch {}
  const isSandbox=req.url.split('?',1)[0]===sandboxPath+'/socket';
  if ((!isSandbox && req.url !== '/gaoxin-3d/socket') || origin?.host !== req.headers.host ||
      !['http:','https:'].includes(origin?.protocol) || wss.clients.size >= 256) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  let alive = true;
  const closed = () => { alive = false; };
  socket.on('error',closed);
  socket.on('close',closed);
  void account(req).then(profile => {
    if (!alive) return;
    socket.off('error',closed);
    socket.off('close',closed);
    wss.handleUpgrade(req,socket,head,ws => {
      ws.alive = true;
      ws.on('pong',() => { ws.alive = true; });
      if(isSandbox)sandbox.attach(ws,profile);
      else rooms.attach(ws,profile?.name);
    });
  });
});

const tick = setInterval(() => {rooms.tick();sandbox.tick();},50);
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) ws.terminate();
    else { ws.alive = false; ws.ping(); }
  }
},15000);
server.on('close',() => { clearInterval(tick); clearInterval(heartbeat); });
server.listen(port,host,() => console.log(`校园 3D 房间 http://${host}:${port}/gaoxin-3d/index.html → ${upstream.origin}`));
