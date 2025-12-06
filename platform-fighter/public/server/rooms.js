const { generateId } = require("./utils");

class Room {
  constructor(mode) {
    this.id = generateId();
    this.mode = mode;
    this.players = new Set();
    this.spawnPoints = [{x:200,y:400},{x:700,y:400},{x:450,y:300},{x:300,y:350},{x:600,y:350}];
    this.platform = { x:0, y:400, width:960, height:140 };
    this.state = "lobby";
  }

  addPlayer(player) {
    player.spawnIndex = this.players.size;
    player.alive = true;
    player.vx = 0;
    player.vy = 0;
    player.x = this.spawnPoints[player.spawnIndex % this.spawnPoints.length].x;
    player.y = this.spawnPoints[player.spawnIndex % this.spawnPoints.length].y;
    player.input = { left:false, right:false, jump:false, attack:false };
    player.onGround = true;
    this.players.add(player);
  }

  removePlayer(player) {
    this.players.delete(player);
  }
}

module.exports = { Room };
