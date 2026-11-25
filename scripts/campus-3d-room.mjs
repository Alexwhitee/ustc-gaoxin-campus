import { randomBytes } from 'node:crypto';
import { WebSocket } from 'ws';
import { canVisit, cleanName, createCollision, move, TICK } from '../public/gaoxin-3d/world.mjs';

const roomKey = /^[A-Z0-9-]{1,20}$/;
const tokenKey = /^[0-9a-f]{48}$/;
const CAPACITY = 6;
const RESUME_MS = 90000;
const snapshotPlayer = ({id, name, x, y, yaw, ack}) => ({id, name, x, y, yaw, ack});

export function createCampusRooms(map) {
  const rooms = new Map();
  const collision = createCollision(map);
  const places = new Map(map.places.map(p => [p.id, p]));
  const send = (socket, value) => {
    if (socket.readyState === WebSocket.OPEN && socket.bufferedAmount < 65536) socket.send(JSON.stringify(value));
  };

  function attach(socket, accountName = '') {
    let room, player;
    let sentAt = Date.now(), allowance = 38;
    const timeout = setTimeout(() => { if (!player) socket.close(4001, 'join timeout'); }, 5000);
    socket.on('error', () => {});
    socket.on('close', () => {
      clearTimeout(timeout);
      if (player?.socket === socket) {
        player.socket = null;
        player.until = Date.now() + RESUME_MS;
        player.inputs.length = 0;
      }
    });
    socket.on('message', (raw, binary) => {
      const now = Date.now();
      allowance = Math.min(38, allowance + (now - sentAt) * .048);
      sentAt = now;
      if (--allowance < 0 || binary) return;
      let message;
      try { message = JSON.parse(raw); } catch { return; }
      if (!message || typeof message !== 'object') return;
      if (!player) {
        if (message.type !== 'join' || typeof message.room !== 'string' || !roomKey.test(message.room)) return;
        if (message.version !== map.version) {
          send(socket, {type:'error', message:'地图版本已更新，请刷新网页。'});
          socket.close(4002, 'map version');
          return;
        }
        room = rooms.get(message.room);
        if (!room) {
          if (rooms.size >= 64) { send(socket, {type:'error',message:'服务器房间已满。'}); socket.close(4003); return; }
          room = {key:message.room, players:new Map(), stage:0};
          rooms.set(message.room, room);
        }
        const existing = typeof message.resume === 'string' && tokenKey.test(message.resume) ? room.players.get(message.resume) : null;
        if (existing && !existing.socket && existing.until >= now) {
          player = existing;
        } else {
          if (room.players.size >= CAPACITY) {
            send(socket, {type:'error', message:'房间已满，最多 6 人。'});
            socket.close(4003);
            return;
          }
          const start = map.starts.find(([x,y]) => [...room.players.values()].every(p => Math.hypot(p.x-x,p.y-y)>2)) ||
            map.starts[room.players.size % map.starts.length];
          const id = randomBytes(5).toString('hex');
          const token = randomBytes(24).toString('hex');
          player = {id, token, name:cleanName(accountName || message.name) || '同学 ' + id.slice(-4).toUpperCase(),
            x:start[0], y:start[1], yaw:2.02, ack:0, inputs:[], socket:null, until:0};
          room.players.set(token,player);
        }
        player.socket = socket;
        clearTimeout(timeout);
        send(socket, {type:'joined', player:snapshotPlayer(player), resume:player.token, stage:room.stage});
      } else if (player.socket === socket && message.type === 'input') {
        const {seq,yaw,side,forward} = message;
        const last = player.inputs.at(-1)?.seq ?? player.ack;
        if (!Number.isSafeInteger(seq) || seq <= last || seq > last + 128 ||
            !Number.isFinite(yaw) || Math.abs(yaw) > Math.PI + .01 ||
            !Number.isFinite(side) || Math.abs(side) > 1 ||
            !Number.isFinite(forward) || Math.abs(forward) > 1) return;
        if (player.inputs.length >= 6) player.inputs.shift();
        player.inputs.push({seq,yaw,side,forward});
      } else if (player.socket === socket && message.type === 'visit') {
        const place = places.get(map.task[room.stage]);
        if (place && message.place === place.id && canVisit(player, place, collision)) room.stage++;
        else send(socket, {type:'notice', message:'请靠近当前目标，面朝地点再按 E。'});
      }
    });
  }

  function tick() {
    const now = Date.now();
    for (const [key,room] of rooms) {
      const online = [];
      for (const [token,p] of room.players) {
        if (!p.socket) {
          if (p.until < now) room.players.delete(token);
          continue;
        }
        const input = p.inputs.shift();
        if (input) {
          move(p,input,TICK,collision);
          p.ack = input.seq;
        }
        online.push(p);
      }
      if (!room.players.size) rooms.delete(key);
      else if (online.length) {
        const data = JSON.stringify({type:'snapshot',stage:room.stage, players:online.map(snapshotPlayer)});
        for (const p of online) {
          if (p.socket.readyState === WebSocket.OPEN && p.socket.bufferedAmount < 65536) p.socket.send(data);
        }
      }
    }
  }
  return {attach,tick};
}
