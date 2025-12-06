class Protocol {
    constructor(server) {
        this.server = server;
        this.rooms = server.rooms;
        this.clients = server.clients;
    }
    
    handleJoin(ws, data) {
        const playerId = this.server.nextPlayerId++;
        const playerName = data.name || `Player${playerId}`;
        
        // Store client connection
        this.clients.set(playerId, {
            ws,
            playerInfo: { name: playerName }
        });
        
        // Send welcome message
        ws.send(JSON.stringify({
            type: 'welcome',
            playerId,
            isHost: false // Will be set when creating/joining room
        }));
        
        console.log(`Player ${playerId} (${playerName}) joined`);
    }
    
    handleCreateRoom(ws, data) {
        const playerId = data.playerId;
        const gameMode = data.gameMode || '1v1';
        
        // Get client
        const client = this.clients.get(playerId);
        if (!client) {
            ws.send(JSON.stringify({ type: 'error', message: 'Player not found' }));
            return;
        }
        
        // Create room
        const room = this.rooms.createRoom(gameMode, playerId);
        
        // Add player to room
        const success = room.addPlayer(playerId, client.playerInfo);
        if (!success) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
            return;
        }
        
        // Set player as host
        room.players.get(playerId).isHost = true;
        
        // Notify player
        ws.send(JSON.stringify({
            type: 'roomCreated',
            room: {
                id: room.id,
                gameMode: room.gameMode,
                players: room.getPlayerList()
            },
            isHost: true
        }));
        
        console.log(`Room ${room.id} created by player ${playerId} (${gameMode} mode)`);
    }
    
    handleJoinRoom(ws, data) {
        // Implementation for joining existing rooms
        // This would be used if we had room codes to share
    }
    
    handleLeaveRoom(ws, data) {
        const playerId = data.playerId;
        const player = this.rooms.getPlayer(playerId);
        
        if (player && player.roomId) {
            const room = this.rooms.getRoom(player.roomId);
            if (room) {
                const result = room.removePlayer(playerId);
                
                // Notify remaining players
                this.server.broadcastToRoom(room.id, {
                    type: 'playerLeft',
                    players: room.getPlayerList()
                });
                
                // Notify leaving player
                ws.send(JSON.stringify({
                    type: 'leftRoom',
                    success: true
                }));
                
                // Clean up empty room
                if (result === 'empty') {
                    this.rooms.removeRoom(room.id);
                }
            }
        }
    }
    
    handleReady(ws, data) {
        const playerId = data.playerId;
        const isReady = data.isReady !== false;
        
        const player = this.rooms.getPlayer(playerId);
        if (!player || !player.roomId) return;
        
        const room = this.rooms.getRoom(player.roomId);
        if (!room) return;
        
        room.setPlayerReady(playerId, isReady);
        
        // Notify all players in room
        this.server.broadcastToRoom(room.id, {
            type: 'playerReady',
            playerId,
            isReady,
            players: room.getPlayerList()
        });
    }
    
    handleStartGame(ws, data) {
        const playerId = data.playerId;
        const player = this.rooms.getPlayer(playerId);
        
        if (!player || !player.roomId) {
            ws.send(JSON.stringify({ type: 'error', message: 'Not in a room' }));
            return;
        }
        
        const room = this.rooms.getRoom(player.roomId);
        if (!room) {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
            return;
        }
        
        // Check if player is host
        if (!player.isHost) {
            ws.send(JSON.stringify({ type: 'error', message: 'Only host can start the game' }));
            return;
        }
        
        // Check if game can start
        if (!room.canStartGame()) {
            ws.send(JSON.stringify({ 
                type: 'error', 
                message: room.gameMode === '1v1' 
                    ? 'Both players must be ready' 
                    : 'Not enough players ready' 
            }));
            return;
        }
        
        // Start the game
        room.startGame();
        
        // Send game starting countdown to all players
        this.server.broadcastToRoom(room.id, {
            type: 'gameStarting',
            countdown: 3
        });
        
        // After countdown, start sending game state
        setTimeout(() => {
            this.server.broadcastToRoom(room.id, {
                type: 'gameState',
                state: room.getStateForPlayer()
            });
        }, 3000);
    }
    
    handleInput(ws, data) {
        const playerId = data.playerId;
        const input = data.input;
        
        if (!input || !input.sequence) return;
        
        const player = this.rooms.getPlayer(playerId);
        if (!player || !player.roomId) return;
        
        const room = this.rooms.getRoom(player.roomId);
        if (!room || room.status !== 'active') return;
        
        // Update player state based on input
        const playerState = room.gameState.players[playerId];
        if (!playerState || !playerState.isAlive) return;
        
        // Apply input to player state
        this.applyInputToPlayer(playerState, input);
        
        // Update last processed input
        room.gameState.lastProcessedInput = input.sequence;
        
        // Check for collisions/attacks
        this.checkPlayerAttacks(room, playerId);
        
        // Send updated game state to all players
        this.server.broadcastToRoom(room.id, {
            type: 'gameState',
            state: room.getStateForPlayer()
        });
    }
    
    applyInputToPlayer(player, input) {
        const moveSpeed = 400;
        const jumpForce = 500;
        
        // Movement
        if (input.left && !input.right) {
            player.velocityX = -moveSpeed;
            player.facing = -1;
        } else if (input.right && !input.left) {
            player.velocityX = moveSpeed;
            player.facing = 1;
        }
        
        // Jump
        if (input.jump && !player.isJumping) {
            player.velocityY = -jumpForce;
            player.isJumping = true;
        }
        
        // Attack
        const attackCooldown = 0.5; // seconds
        const currentTime = Date.now() / 1000;
        if (input.attack && (currentTime - player.lastAttackTime) > attackCooldown) {
            player.isAttacking = true;
            player.lastAttackTime = currentTime;
        }
    }
    
    checkPlayerAttacks(room, attackingPlayerId) {
        const attacker = room.gameState.players[attackingPlayerId];
        if (!attacker || !attacker.isAttacking) return;
        
        // Check collisions with other players
        Object.entries(room.gameState.players).forEach(([playerId, player]) => {
            if (playerId === attackingPlayerId) return;
            
            const collision = require('./physics').checkCollision(attacker, player);
            if (collision) {
                // Apply knockback
                const result = require('./physics').applyKnockback(
                    collision.victim,
                    collision.direction,
                    1.0 + (100 - collision.victim.health) / 100
                );
                
                // Notify players about the hit
                this.server.broadcastToRoom(room.id, {
                    type: 'playerHit',
                    attackerId: attackingPlayerId,
                    victimId: playerId,
                    damage: result.damage,
                    knockback: result.knockback
                });
            }
        });
    }
    
    handlePlayerFell(ws, data) {
        const playerId = data.playerId;
        const player = this.rooms.getPlayer(playerId);
        
        if (!player || !player.roomId) return;
        
        const room = this.rooms.getRoom(player.roomId);
        if (!room || room.status !== 'active') return;
        
        // Handle player falling off
        room.handlePlayerFall(playerId);
    }
    
    handleLeaveGame(ws, data) {
        const playerId = data.playerId;
        const player = this.rooms.getPlayer(playerId);
        
        if (!player || !player.roomId) return;
        
        const room = this.rooms.getRoom(player.roomId);
        if (!room) return;
        
        // Remove player from room
        room.removePlayer(playerId);
        
        // Notify other players
        this.server.broadcastToRoom(room.id, {
            type: 'playerLeft',
            players: room.getPlayerList()
        });
        
        // Clean up if room is empty
        if (room.players.size === 0) {
            this.rooms.removeRoom(room.id);
        }
    }
}

module.exports = Protocol;
