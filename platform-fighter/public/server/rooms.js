const Physics = require('./physics');
const Utils = require('./utils');

class Room {
    constructor(id, gameMode, hostId) {
        this.id = id;
        this.gameMode = gameMode;
        this.hostId = hostId;
        this.players = new Map(); // playerId -> player object
        this.gameState = null;
        this.status = 'waiting'; // waiting, starting, active, finished
        this.countdown = null;
        this.startTime = null;
        this.gameTime = null;
        
        // Game mode specific settings
        const modeConfig = this.getModeConfig();
        this.maxPlayers = modeConfig.maxPlayers;
        this.matchTime = modeConfig.matchTime;
        this.roundsToWin = modeConfig.roundsToWin;
        
        // Initialize game state
        this.resetGameState();
    }
    
    getModeConfig() {
        const configs = {
            '1v1': {
                maxPlayers: 2,
                platformWidth: 400,
                platformHeight: 40,
                roundsToWin: 2,
                matchTime: 180 // 3 minutes
            },
            'ffa': {
                maxPlayers: 8,
                platformWidth: 800,
                platformHeight: 40,
                roundsToWin: null, // No round limit for FFA
                matchTime: 300 // 5 minutes
            }
        };
        
        return configs[this.gameMode] || configs['1v1'];
    }
    
    addPlayer(playerId, playerInfo) {
        if (this.players.size >= this.maxPlayers) {
            return false;
        }
        
        const player = {
            id: playerId,
            name: playerInfo.name || `Player${playerId}`,
            isReady: false,
            isHost: this.players.size === 0,
            score: 0,
            color: this.getPlayerColor(playerId),
            ...this.createPlayerState()
        };
        
        this.players.set(playerId, player);
        return true;
    }
    
    removePlayer(playerId) {
        const player = this.players.get(playerId);
        if (!player) return;
        
        // If host leaves, assign new host
        if (player.isHost && this.players.size > 1) {
            const newHostId = Array.from(this.players.keys()).find(id => id !== playerId);
            if (newHostId) {
                this.players.get(newHostId).isHost = true;
            }
        }
        
        this.players.delete(playerId);
        
        // Clean up room if empty
        if (this.players.size === 0) {
            return 'empty';
        }
        
        return 'playerRemoved';
    }
    
    getPlayerColor(playerId) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
            '#118AB2', '#EF476F', '#7209B7', '#F8961E'
        ];
        const index = Array.from(this.players.keys()).indexOf(playerId);
        return colors[index % colors.length];
    }
    
    createPlayerState() {
        const config = this.getModeConfig();
        return {
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            isJumping: false,
            isAttacking: false,
            lastAttackTime: 0,
            facing: 1,
            health: 100,
            isAlive: true,
            respawnTimer: 0
        };
    }
    
    setPlayerReady(playerId, isReady) {
        const player = this.players.get(playerId);
        if (player) {
            player.isReady = isReady;
            return true;
        }
        return false;
    }
    
    canStartGame() {
        if (this.players.size < (this.gameMode === '1v1' ? 2 : 1)) {
            return false;
        }
        
        // In 1v1 mode, both players must be ready
        if (this.gameMode === '1v1') {
            return Array.from(this.players.values()).every(player => player.isReady);
        }
        
        // In FFA mode, at least one player must be ready (host can start)
        return Array.from(this.players.values()).some(player => player.isReady);
    }
    
    startGame() {
        if (this.status !== 'waiting') return false;
        
        this.status = 'starting';
        this.countdown = 3; // 3 second countdown
        
        // Reset all player states
        this.resetGameState();
        
        // Position players
        this.positionPlayers();
        
        return true;
    }
    
    positionPlayers() {
        const config = this.getModeConfig();
        const playerIds = Array.from(this.players.keys());
        
        if (this.gameMode === '1v1') {
            // Position players on opposite sides
            playerIds.forEach((playerId, index) => {
                const player = this.players.get(playerId);
                player.x = config.platformWidth / 2 + (index === 0 ? -100 : 100);
                player.y = 200;
                player.health = 100;
                player.isAlive = true;
                player.respawnTimer = 0;
            });
        } else {
            // Position FFA players in a circle around platform
            const centerX = config.platformWidth / 2;
            const radius = Math.min(300, config.platformWidth / 2 - 50);
            
            playerIds.forEach((playerId, index) => {
                const player = this.players.get(playerId);
                const angle = (index / playerIds.length) * Math.PI * 2;
                player.x = centerX + Math.cos(angle) * radius;
                player.y = 200 + Math.sin(angle) * radius;
                player.health = 100;
                player.isAlive = true;
                player.respawnTimer = 0;
            });
        }
    }
    
    resetGameState() {
        const config = this.getModeConfig();
        
        this.gameState = {
            players: {},
            platform: {
                x: 400 - config.platformWidth / 2,
                y: 300,
                width: config.platformWidth,
                height: config.platformHeight
            },
            timeRemaining: this.matchTime,
            round: 1,
            winner: null,
            lastProcessedInput: 0
        };
        
        // Initialize player states in game state
        this.players.forEach((player, playerId) => {
            this.gameState.players[playerId] = {
                ...this.createPlayerState(),
                name: player.name,
                color: player.color,
                score: player.score
            };
        });
    }
    
    update(deltaTime) {
        switch (this.status) {
            case 'starting':
                this.updateCountdown(deltaTime);
                break;
                
            case 'active':
                this.updateGame(deltaTime);
                break;
        }
    }
    
    updateCountdown(deltaTime) {
        this.countdown -= deltaTime;
        
        if (this.countdown <= 0) {
            this.status = 'active';
            this.startTime = Date.now();
            this.gameTime = this.matchTime;
        }
    }
    
    updateGame(deltaTime) {
        if (this.gameTime !== null) {
            this.gameTime -= deltaTime;
            this.gameState.timeRemaining = Math.max(0, Math.floor(this.gameTime));
            
            // Check for match timeout
            if (this.gameTime <= 0) {
                this.endGame();
                return;
            }
        }
        
        // Update all players
        this.players.forEach((player, playerId) => {
            if (this.gameState.players[playerId]) {
                // Handle respawn timer
                if (!this.gameState.players[playerId].isAlive) {
                    this.gameState.players[playerId].respawnTimer -= deltaTime;
                    if (this.gameState.players[playerId].respawnTimer <= 0) {
                        this.respawnPlayer(playerId);
                    }
                }
                
                // Apply physics to alive players
                if (this.gameState.players[playerId].isAlive) {
                    Physics.updatePlayer(this.gameState.players[playerId], deltaTime);
                    
                    // Check for falling
                    if (this.gameState.players[playerId].y > 800) {
                        this.handlePlayerFall(playerId);
                    }
                }
            }
        });
        
        // Check for round/game end conditions
        if (this.gameMode === '1v1') {
            this.check1v1RoundEnd();
        }
    }
    
    handlePlayerFall(playerId) {
        const player = this.gameState.players[playerId];
        if (!player || !player.isAlive) return;
        
        player.isAlive = false;
        
        if (this.gameMode === '1v1') {
            // In 1v1, round ends immediately
            const alivePlayers = Object.values(this.gameState.players).filter(p => p.isAlive);
            if (alivePlayers.length === 1) {
                const winnerId = Object.keys(this.gameState.players).find(id => 
                    this.gameState.players[id].isAlive
                );
                if (winnerId) {
                    this.gameState.players[winnerId].score++;
                    
                    // Check if someone won the match
                    if (this.gameState.players[winnerId].score >= this.roundsToWin) {
                        this.endGame(winnerId);
                    } else {
                        // Start new round
                        setTimeout(() => this.startNewRound(), 3000);
                    }
                }
            }
        } else {
            // In FFA, player respawns after delay
            player.respawnTimer = 3; // 3 second respawn delay
            
            // Award point to whoever knocked them off (would need attacker tracking)
            // For now, just handle respawn
        }
    }
    
    respawnPlayer(playerId) {
        const player = this.gameState.players[playerId];
        if (!player) return;
        
        const config = this.getModeConfig();
        player.x = Math.random() * (config.platformWidth - 100) + 50;
        player.y = 200;
        player.velocityX = 0;
        player.velocityY = 0;
        player.health = 100;
        player.isAlive = true;
        player.isJumping = false;
        player.isAttacking = false;
        player.respawnTimer = 0;
    }
    
    check1v1RoundEnd() {
        const alivePlayers = Object.values(this.gameState.players).filter(p => p.isAlive);
        
        if (alivePlayers.length === 1) {
            const winnerId = Object.keys(this.gameState.players).find(id => 
                this.gameState.players[id].isAlive
            );
            
            if (winnerId) {
                this.gameState.players[winnerId].score++;
                
                if (this.gameState.players[winnerId].score >= this.roundsToWin) {
                    this.endGame(winnerId);
                } else {
                    setTimeout(() => this.startNewRound(), 3000);
                }
            }
        }
    }
    
    startNewRound() {
        this.positionPlayers();
        this.status = 'starting';
        this.countdown = 3;
        this.gameState.round++;
    }
    
    endGame(winnerId = null) {
        this.status = 'finished';
        this.gameState.winner = winnerId;
        
        // Announce game over to all players
        setTimeout(() => {
            this.resetGameState();
            this.status = 'waiting';
            
            // Reset player ready states
            this.players.forEach(player => {
                player.isReady = false;
            });
        }, 5000);
    }
    
    getStateForPlayer(playerId) {
        return {
            ...this.gameState,
            players: { ...this.gameState.players }
        };
    }
    
    getPlayerList() {
        return Array.from(this.players.values()).map(player => ({
            id: player.id,
            name: player.name,
            isReady: player.isReady,
            isHost: player.isHost,
            score: player.score,
            color: player.color
        }));
    }
}

class RoomManager {
    constructor() {
        this.rooms = new Map(); // roomId -> Room object
        this.roomCounter = 0;
    }
    
    createRoom(gameMode, hostId) {
        const roomId = Utils.generateRoomCode();
        const room = new Room(roomId, gameMode, hostId);
        this.rooms.set(roomId, room);
        return room;
    }
    
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }
    
    removeRoom(roomId) {
        this.rooms.delete(roomId);
    }
    
    getPlayer(playerId) {
        for (const room of this.rooms.values()) {
            if (room.players.has(playerId)) {
                return {
                    ...room.players.get(playerId),
                    roomId: room.id
                };
            }
        }
        return null;
    }
    
    getRoomCount() {
        return this.rooms.size;
    }
    
    updateAllRooms(deltaTime) {
        this.rooms.forEach(room => {
            room.update(deltaTime);
            
            // Clean up empty rooms
            if (room.players.size === 0) {
                this.rooms.delete(room.id);
            }
        });
    }
    
    handlePlayerDisconnect(playerId) {
        for (const room of this.rooms.values()) {
            if (room.players.has(playerId)) {
                const result = room.removePlayer(playerId);
                if (result === 'empty') {
                    this.rooms.delete(room.id);
                }
                break;
            }
        }
    }
}

module.exports = RoomManager;
