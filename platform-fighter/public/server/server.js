const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const RoomManager = require('./rooms');
const Protocol = require('./protocol');

class GameServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.rooms = new RoomManager();
        this.clients = new Map(); // playerId -> {ws, playerInfo}
        this.nextPlayerId = 1;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupMiddleware() {
        this.app.use(express.static(path.join(__dirname, '../public')));
        this.app.use(express.json());
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', players: this.clients.size, rooms: this.rooms.getRoomCount() });
        });
        
        // API endpoint to get server status
        this.app.get('/api/status', (req, res) => {
            res.json({
                online: true,
                players: this.clients.size,
                rooms: this.rooms.getRoomCount(),
                uptime: process.uptime()
            });
        });
        
        // Handle 404
        this.app.use((req, res) => {
            res.status(404).sendFile(path.join(__dirname, '../public/index.html'));
        });
    }
    
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('New client connected');
            
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('Error parsing message:', error);
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
                }
            });
            
            ws.on('close', () => {
                this.handleDisconnection(ws);
            });
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.handleDisconnection(ws);
            });
        });
        
        // Start game loop
        this.startGameLoop();
    }
    
    handleMessage(ws, data) {
        const protocol = new Protocol(this);
        
        switch (data.type) {
            case 'join':
                protocol.handleJoin(ws, data);
                break;
                
            case 'createRoom':
                protocol.handleCreateRoom(ws, data);
                break;
                
            case 'joinRoom':
                protocol.handleJoinRoom(ws, data);
                break;
                
            case 'leaveRoom':
                protocol.handleLeaveRoom(ws, data);
                break;
                
            case 'ready':
                protocol.handleReady(ws, data);
                break;
                
            case 'startGame':
                protocol.handleStartGame(ws, data);
                break;
                
            case 'input':
                protocol.handleInput(ws, data);
                break;
                
            case 'playerFell':
                protocol.handlePlayerFell(ws, data);
                break;
                
            case 'leaveGame':
                protocol.handleLeaveGame(ws, data);
                break;
                
            default:
                console.warn('Unknown message type:', data.type);
                ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
        }
    }
    
    handleDisconnection(ws) {
        // Find the player associated with this WebSocket
        let disconnectedPlayerId = null;
        
        for (const [playerId, client] of this.clients.entries()) {
            if (client.ws === ws) {
                disconnectedPlayerId = playerId;
                break;
            }
        }
        
        if (disconnectedPlayerId) {
            console.log(`Player ${disconnectedPlayerId} disconnected`);
            
            // Remove from clients map
            this.clients.delete(disconnectedPlayerId);
            
            // Handle leaving room/game
            const player = this.rooms.getPlayer(disconnectedPlayerId);
            if (player && player.roomId) {
                this.rooms.handlePlayerDisconnect(disconnectedPlayerId);
            }
        }
    }
    
    startGameLoop() {
        const GAME_TICK_RATE = 60; // 60 updates per second
        const TICK_INTERVAL = 1000 / GAME_TICK_RATE;
        
        setInterval(() => {
            this.rooms.updateAllRooms(TICK_INTERVAL / 1000);
        }, TICK_INTERVAL);
    }
    
    broadcastToRoom(roomId, message) {
        const room = this.rooms.getRoom(roomId);
        if (!room) return;
        
        room.players.forEach(playerId => {
            const client = this.clients.get(playerId);
            if (client && client.ws.readyState === WebSocket.OPEN) {
                client.ws.send(JSON.stringify(message));
            }
        });
    }
    
    sendToPlayer(playerId, message) {
        const client = this.clients.get(playerId);
        if (client && client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify(message));
        }
    }
    
    start(port = process.env.PORT || 3000) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
            console.log(`WebSocket server ready`);
        });
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new GameServer();
    server.start();
}

module.exports = GameServer;
