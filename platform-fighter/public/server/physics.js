const GRAVITY = 1400;
const MOVE_ACCEL = 2000;
const MAX_RUN_SPEED = 300;
const FRICTION = 0.85;
const JUMP_VELOCITY = -500;
const ATTACK_RANGE = 40;
const ATTACK_COOLDOWN = 400;
const BASE_KNOCKBACK = 200;
const RESPAWN_DELAY = 1500;

function step(room, dt) {
  const events = [];
  room.players.forEach(p => {
    if (!p.alive) {
      if (p.respawnTime && Date.now() >= p.respawnTime) {
        p.alive = true;
        p.x = room.spawnPoints[p.spawnIndex % room.spawnPoints.length].x;
        p.y = room.spawnPoints[p.spawnIndex % room.spawnPoints.length].y;
        p.vx = 0;
        p.vy = 0;
        p.respawnTime = null;
      }
      return;
    }
    if (p.input.left) p.vx -= MOVE_ACCEL*dt;
    if (p.input.right) p.vx += MOVE_ACCEL*dt;
    if (p.input.jump && p.onGround) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
    }
    p.vx *= FRICTION;
    p.vx = Math.max(-MAX_RUN_SPEED, Math.min(MAX_RUN_SPEED, p.vx));
    p.vy += GRAVITY*dt;
    p.x += p.vx*dt;
    p.y += p.vy*dt;
    if (p.y >= room.platform.y - 20) {
      p.y = room.platform.y - 20;
      p.vy = 0;
      p.onGround = true;
    }
  });
  const arr = Array.from(room.players);
  for (let i=0;i<arr.length;i++){
    for (let j=0;j<arr.length;j++){
      if (i===j) continue;
      const a = arr[i];
      const b = arr[j];
      if (!a.alive || !b.alive) continue;
      if (a.input.attack && (!a.lastAttack || Date.now()-a.lastAttack>ATTACK_COOLDOWN)) {
        if (Math.abs(a.x - b.x)<ATTACK_RANGE && Math.abs(a.y - b.y)<50) {
          const dir = a.x < b.x ? 1 : -1;
          b.vx += dir*BASE_KNOCKBACK;
          b.vy += -BASE_KNOCKBACK*0.5;
          a.lastAttack = Date.now();
          events.push({ type:"hit", attackerId:a.id, victimId:b.id });
        }
      }
    }
  }
  room.players.forEach(p => {
    if (p.y > room.platform.y + room.platform.height) {
      p.alive = false;
      p.respawnTime = Date.now() + RESPAWN_DELAY;
      events.push({ type:"fall", playerId:p.id });
    }
  });
  return events;
}

module.exports = { step };
