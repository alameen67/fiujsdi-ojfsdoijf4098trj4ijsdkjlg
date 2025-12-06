const http = require("http");
const WebSocket = require("ws");
const { Room } = require("./rooms");
const { step } = require("./physics");
const { MESSAGE_TYPES } = require("./protocol");
const { generateId, broadcast } = require("./utils");

const server = http.createServer();
const wss = new WebSocket.Server({ server, path:"/ws" });

const rooms = {};

function getRoom(mode) {
  for (const id in rooms) {
    if (rooms[id].mode===mode) return rooms[id];
  }
  const room = new Room(mode);
  rooms[room.id] = room;
  return room;
}

wss.on("connection", ws => {
  const player = { id:generateId(), ws };
  let room = null;

  ws.on("message", message => {
    const msg = JSON.parse(message);
    switch(msg.type){
      case MESSAGE_TYPES.JOIN:
        room = getRoom(msg.payload.mode);
        player.name = msg.payload.name;
        player.colorIndex = room.players.size;
        room.addPlayer(player);
        ws.send(JSON.stringify({ type: MESSAGE_TYPES.WELCOME, payload:{ clientId:player.id, tickRate:20 }}));
        break;
      case MESSAGE_TYPES.INPUT:
        if(player.input) player.input = msg.payload;
        break;
      case MESSAGE_TYPES.READY:
        break;
    }
  });

  ws.on("close", () => {
    if(room) room.removePlayer(player);
  });
});

setInterval(()=>{
  for(const id in rooms){
    const room = rooms[id];
    const events = step(room, 1/20);
    const snapshot = {
      type: MESSAGE_TYPES.SNAPSHOT,
      payload: { tick:Date.now(), players:Array.from(room.players).map(p=>({ id:p.id,name:p.name,x:p.x,y:p.y,alive:p.alive,colorIndex:p.colorIndex })) , events }
    };
    room.players.forEach(p=>{
      if(p.ws.readyState===1) p.ws.send(JSON.stringify(snapshot));
    });
  }
},50);

server.listen(8080);
