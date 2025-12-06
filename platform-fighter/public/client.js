const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const lobby = document.getElementById("lobby");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("name");
const modeSelect = document.getElementById("mode");

let assets = null;
fetch("assets.json").then(res => res.json()).then(json => assets = json);

let ws;
let clientId = null;
let players = {};
let self = null;
let inputs = {};
let countdown = 0;
let lastTimestamp = performance.now();
let mode = "1v1";

const keys = {};

joinBtn.onclick = () => {
  const name = nameInput.value || "Player";
  mode = modeSelect.value;
  connect(name, mode);
};

window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

function connect(name, mode) {
  lobby.style.display = "none";
  canvas.style.display = "block";
  ws = new WebSocket("ws://localhost:8080/ws");
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "join", payload: { name, mode } }));
    ws.send(JSON.stringify({ type: "ready" }));
  };
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    handleMessage(msg);
  };
  ws.onclose = () => {
    alert("Disconnected from server");
  };
  requestAnimationFrame(gameLoop);
}

function handleMessage(msg) {
  switch (msg.type) {
    case "welcome":
      clientId = msg.payload.clientId;
      break;
    case "snapshot":
      players = {};
      msg.payload.players.forEach(p => players[p.id] = p);
      self = players[clientId];
      break;
    case "countdown":
      countdown = msg.payload.seconds;
      break;
    case "roundEnd":
      alert(`Winner: ${msg.payload.winnerId}`);
      break;
    case "error":
      console.error(msg.payload.message);
      break;
  }
}

function sendInput() {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({
    type: "input",
    payload: {
      left: keys['a'] || keys['arrowleft'],
      right: keys['d'] || keys['arrowright'],
      jump: keys['w'] || keys[' '],
      attack: keys['j'] || false
    }
  }));
}

function gameLoop(timestamp) {
  const delta = timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  sendInput();
  render();
  requestAnimationFrame(gameLoop);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (countdown > 0) {
    ctx.fillStyle = "#fff";
    ctx.font = "50px Arial";
    ctx.fillText(countdown, canvas.width/2-15, canvas.height/2);
  }
  for (const id in players) {
    const p = players[id];
    ctx.fillStyle = assets.colors[p.colorIndex % assets.colors.length];
    ctx.fillRect(p.x - 20, p.y - 40, 40, 40);
    ctx.fillStyle = "#fff";
    ctx.font = "14px Arial";
    ctx.fillText(p.name, p.x - ctx.measureText(p.name).width/2, p.y - 45);
  }
}
