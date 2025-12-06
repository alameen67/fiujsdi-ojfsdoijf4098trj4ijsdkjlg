function generateId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i=0;i<length;i++) id += chars[Math.floor(Math.random()*chars.length)];
  return id;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nowMs() {
  return Date.now();
}

function broadcast(clients, data) {
  const msg = JSON.stringify(data);
  clients.forEach(c => {
    if (c.readyState === 1) c.send(msg);
  });
}

module.exports = { generateId, clamp, nowMs, broadcast };
