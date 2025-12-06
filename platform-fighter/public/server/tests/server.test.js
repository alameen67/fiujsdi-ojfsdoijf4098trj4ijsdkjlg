const assert = require("assert");
const { Room } = require("../rooms");
const { step } = require("../physics");

const room = new Room("1v1");
const player1 = { id:"p1", name:"A", x:0,y:0, vx:0, vy:0, input:{}, alive:true, onGround:true, spawnIndex:0 };
const player2 = { id:"p2", name:"B", x:50,y:0, vx:0, vy:0, input:{}, alive:true, onGround:true, spawnIndex:1 };
room.addPlayer(player1);
room.addPlayer(player2);

player1.input.right = true;
step(room, 1/20);
assert(player1.vx > 0);

player2.input.jump = true;
step(room, 1/20);
assert(player2.vy < 0);

player1.input.attack = true;
const events = step(room, 1/20);
assert(events.some(e=>e.type==="hit"));
