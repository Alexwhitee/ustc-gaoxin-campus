export const TICK = .05;
export const SPEED = 5.8;
export const RADIUS = .65;
export const REACH = 5;

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a,b] = ring[j], [c,d] = ring[i];
    if ((b > y) !== (d > y) && x < a + (c - a) * (y - b) / (d - b)) inside = !inside;
  }
  return inside;
}

function touchesRing(x, y, ring) {
  for (let i = 0; i < ring.length; i++) {
    const [ax,ay] = ring[i], [bx,by] = ring[(i + 1) % ring.length];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 < RADIUS ** 2) return true;
  }
  return false;
}

export function createCollision(map) {
  const colliders = map.solids.map(rings => {
    const xs = rings[0].map(p => p[0]), ys = rings[0].map(p => p[1]);
    return {rings, a: Math.min(...xs)-RADIUS, b: Math.max(...xs)+RADIUS,
      c: Math.min(...ys)-RADIUS, d: Math.max(...ys)+RADIUS};
  });
  return (x, y) => Number.isFinite(x) && Number.isFinite(y) &&
    Math.max(Math.abs(x), Math.abs(y)) <= map.half - RADIUS &&
    !colliders.some(({rings, a, b, c, d}) => {
      if (x < a || x > b || y < c || y > d) return false;
      const [outer, ...holes] = rings;
      return rings.some(ring => touchesRing(x, y, ring)) ||
        (pointInRing(x, y, outer) && !holes.some(ring => pointInRing(x, y, ring)));
    });
}

export function move(p, input, dt, canWalk) {
  p.yaw = input.yaw;
  const magnitude = Math.hypot(input.side, input.forward);
  if (magnitude < .001) return;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  const speed = SPEED * dt / Math.max(magnitude, 1);
  const dx = (input.side * cos - input.forward * sin) * speed;
  const dy = (input.side * sin + input.forward * cos) * speed;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (RADIUS / 2)));
  for (let i = 0; i < steps; i++) {
    if (canWalk(p.x + dx / steps, p.y)) p.x += dx / steps;
    if (canWalk(p.x, p.y + dy / steps)) p.y += dy / steps;
  }
}

export function canVisit(p, place, canWalk) {
  const dx = place.x - p.x, dy = place.y - p.y;
  const distance = Math.hypot(dx, dy);
  if (distance > REACH) return false;
  if (distance > 1 && (-Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dy) / distance < .1) return false;
  for (let i = .5; i < distance; i += .5) {
    if (!canWalk(p.x + dx * i / distance, p.y + dy * i / distance)) return false;
  }
  return true;
}

export function cleanName(input) {
  return typeof input === 'string' ? Array.from(input.trim().replace(/[\p{Cc}\p{Cf}]/gu, '')).slice(0, 18).join('') : '';
}
