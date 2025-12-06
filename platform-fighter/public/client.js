class PlatformFighterClient {
    constructor() {
        this.socket = null;
        this.playerId = null;
        this.room = null;
        this.gameState = null;
        this.gameMode = null;
        this.localState = {
            x: 0,
            y: 0,
            velocityX: 0,
            velocityY: 0,
            isJumping: false,
            isAttacking: false,
            lastAttackTime: 0,
            facing: 1,
            health: 100,
            score: 0,
            isAlive: true
        };
        
        this.keys = {};
        this.inputSequence = 0;
        this.pendingInputs = [];
        this.lastProcessedInput = 0;
        
        this.canvas = null;
        this.ctx = null;
        this.lastFrameTime = 0;
        
        this.assets = {
            sounds: {},
            colors: [
                '#FF6B6B', // Red
                '#4ECDC4', // Teal
                '#FFD166', // Yellow
                '#06D6A0', // Green
                '#118AB2', // Blue
                '#EF476F', // Pink
                '#7209B7', // Purple
                '#F8961E'  // Orange
            ]
        };
        
        this.isHost = false;
        this.soundEnabled = true;
        
        this.init();
    }
    
    init() {
        // Initialize WebSocket connection
        this.connectToServer();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize canvas
        this.initCanvas();
        
        // Start game loop
        this.gameLoop();
        
        // Setup audio context
        this.initAudio();
    }
    
    connectToServer() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('Connected to server');
            this.updateConnectionStatus('Connected', 'connected');
            
            // Generate a random player name
            const playerName = `Player${Math.floor(Math.random() * 1000)}`;
            this.sendMessage('join', { name: playerName });
        };
        
        this.socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (error) {
                console.error('Error parsing server message:', error);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Disconnected from server');
            this.updateConnectionStatus('Disconnected', 'disconnected');
            
            // Try to reconnect after 3 seconds
            setTimeout(() => this.connectToServer(), 3000);
        };
        
        this.socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('Connection Error', 'disconnected');
        };
    }
    
    updateConnectionStatus(text, status) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionText = document.getElementById('connectionText');
        
        if (connectionStatus && connectionText) {
            connectionText.textContent = text;
            connectionStatus.className = `connection-status ${status}`;
        }
    }
    
    sendMessage(type, data = {}) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            const message = {
                type,
                ...data,
                playerId: this.playerId,
                timestamp: Date.now()
            };
            this.socket.send(JSON.stringify(message));
        }
    }
    
    handleServerMessage(data) {
        switch (data.type) {
            case 'welcome':
                this.playerId = data.playerId;
                this.isHost = data.isHost;
                console.log(`Joined as player ${this.playerId} (Host: ${this.isHost})`);
                break;
                
            case 'roomCreated':
                this.room = data.room;
                this.gameMode = data.gameMode;
                this.showLobby();
                break;
                
            case 'playerJoined':
                this.updatePlayerList(data.players);
                break;
                
            case 'playerLeft':
                this.updatePlayerList(data.players);
                break;
                
            case 'playerReady':
                this.updatePlayerReady(data.playerId, data.isReady);
                break;
                
            case 'gameStarting':
                this.startGameCountdown(data.countdown);
                break;
                
            case 'gameState':
                this.updateGameState(data.state);
                break;
                
            case 'playerHit':
                this.handlePlayerHit(data);
                break;
                
            case 'playerRespawn':
                this.handlePlayerRespawn(data);
                break;
                
            case 'gameOver':
                this.handleGameOver(data);
                break;
                
            case 'error':
                this.showError(data.message);
                break;
        }
    }
    
    selectMode(mode) {
        this.gameMode = mode;
        this.sendMessage('createRoom', { gameMode: mode });
    }
    
    showLobby() {
        document.getElementById('gameSelection').style.display = 'none';
        document.getElementById('lobbyScreen').style.display = 'block';
        
        const modeTitle = document.getElementById('lobbyModeTitle');
        const roomCode = document.getElementById('roomCodeDisplay');
        const modeRules = document.getElementById('modeRules');
        
        if (this.gameMode === '1v1') {
            modeTitle.textContent = '1v1 Duel';
            modeRules.innerHTML = `
                <p><strong>1v1 Mode Rules:</strong></p>
                <p>• Two players battle on a small platform</p>
                <p>• First player to fall off loses the round</p>
                <p>• Best of 3 rounds wins the match</p>
                <p>• No respawns - one life per round</p>
            `;
        } else {
            modeTitle.textContent = 'Free-For-All';
            modeRules.innerHTML = `
                <p><strong>Free-For-All Mode Rules:</strong></p>
                <p>• Up to 8 players on a large platform</p>
                <p>• Players respawn after falling</p>
                <p>• Score points by knocking others off</p>
                <p>• Game ends after 5 minutes</p>
                <p>• Player with most points wins</p>
            `;
        }
        
        if (this.room) {
            roomCode.textContent = this.room.id;
        }
        
        this.updateStartButton();
    }
    
    updatePlayerList(players) {
        const playersContainer = document.getElementById('playersContainer');
        const playerCount = document.getElementById('playerCount');
        
        if (!playersContainer) return;
        
        playersContainer.innerHTML = '';
        playerCount.textContent = `(${players.length}/${this.gameMode === '1v1' ? 2 : 8})`;
        
        players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            
            const colorIndex = index % this.assets.colors.length;
            const playerColor = this.assets.colors[colorIndex];
            
            playerCard.innerHTML = `
                <div class="player-avatar" style="background: ${playerColor}">
                    ${player.name.charAt(0).toUpperCase()}
                </div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-status ${player.isReady ? 'ready' : 'not-ready'}">
                        ${player.isReady ? 'Ready' : 'Not Ready'}
                    </div>
                </div>
                ${player.isHost ? '<div class="host-badge">HOST</div>' : ''}
            `;
            
            playersContainer.appendChild(playerCard);
        });
        
        this.updateStartButton();
    }
    
    updatePlayerReady(playerId, isReady) {
        // This would update the visual state of the player's ready status
        console.log(`Player ${playerId} is now ${isReady ? 'ready' : 'not ready'}`);
        this.updateStartButton();
    }
    
    updateStartButton() {
        const startBtn = document.getElementById('startGameBtn');
        if (!startBtn) return;
        
        // Only host can start, and only if there are enough players
        startBtn.disabled = !this.isHost;
        startBtn.innerHTML = '<i class="fas fa-play"></i> Start Game';
    }
    
    startGame() {
        if (this.isHost) {
            this.sendMessage('startGame');
        }
    }
    
    startGameCountdown(countdown) {
        const countdownOverlay = document.getElementById('countdownOverlay');
        const countdownText = document.getElementById('countdownText');
        
        if (!countdownOverlay || !countdownText) return;
        
        countdownOverlay.style.display = 'flex';
        
        const countdownInterval = setInterval(() => {
            if (countdown > 0) {
                countdownText.textContent = countdown;
                this.playSound('countdown');
                countdown--;
            } else {
                countdownText.textContent = 'GO!';
                this.playSound('go');
                setTimeout(() => {
                    countdownOverlay.style.display = 'none';
                    this.showGameScreen();
                }, 1000);
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
    
    showGameScreen() {
        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        
        this.updateGameUI();
        
        // Start game loop
        this.gameLoop();
    }
    
    updateGameState(state) {
        this.gameState = state;
        
        // Update local state with server state for this player
        if (state.players[this.playerId]) {
            Object.assign(this.localState, state.players[this.playerId]);
        }
        
        // Process pending inputs
        this.processPendingInputs();
        
        // Update UI
        this.updateGameUI();
    }
    
    updateGameUI() {
        if (!this.gameState) return;
        
        // Update scores
        const scoreDisplay = document.getElementById('scoreDisplay');
        if (scoreDisplay) {
            let scoresHTML = '';
            
            if (this.gameMode === '1v1') {
                const players = Object.values(this.gameState.players);
                if (players.length === 2) {
                    scoresHTML = `
                        <div class="player-score">
                            <div class="player-color-indicator" style="background: ${players[0].color || '#FF6B6B'}"></div>
                            <span>${players[0].score || 0}</span>
                        </div>
                        <div style="font-size: 1.5rem; color: #b0b0d0;">VS</div>
                        <div class="player-score">
                            <div class="player-color-indicator" style="background: ${players[1].color || '#4ECDC4'}"></div>
                            <span>${players[1].score || 0}</span>
                        </div>
                    `;
                }
            } else {
                // FFA score display
                const sortedPlayers = Object.values(this.gameState.players)
                    .sort((a, b) => (b.score || 0) - (a.score || 0))
                    .slice(0, 3);
                
                scoresHTML = sortedPlayers.map((player, index) => `
                    <div class="player-score">
                        <div class="player-color-indicator" style="background: ${player.color || this.assets.colors[index]}"></div>
                        <span>${player.name}: ${player.score || 0}</span>
                    </div>
                `).join('');
            }
            
            scoreDisplay.innerHTML = scoresHTML;
        }
        
        // Update timer
        const gameTimer = document.getElementById('gameTimer');
        if (gameTimer && this.gameState.timeRemaining) {
            const minutes = Math.floor(this.gameState.timeRemaining / 60);
            const seconds = this.gameState.timeRemaining % 60;
            gameTimer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update player HUD
        this.updatePlayerHUD();
    }
    
    updatePlayerHUD() {
        const playerHud = document.getElementById('playerHud');
        if (!playerHud) return;
        
        playerHud.innerHTML = `
            <div class="hud-item">
                <span class="hud-label">Health:</span>
                <span class="hud-value">${Math.max(0, Math.floor(this.localState.health))}</span>
            </div>
            <div class="hud-item">
                <span class="hud-label">Score:</span>
                <span class="hud-value">${this.localState.score || 0}</span>
            </div>
            <div class="hud-item">
                <span class="hud-label">Status:</span>
                <span class="hud-value" style="color: ${this.localState.isAlive ? '#4ECDC4' : '#FF6B6B'}">
                    ${this.localState.isAlive ? 'ALIVE' : 'ELIMINATED'}
                </span>
            </div>
        `;
    }
    
    handlePlayerHit(data) {
        if (data.victimId === this.playerId) {
            // This player was hit
            this.playSound('hit');
            this.localState.health -= data.damage || 10;
            
            // Apply knockback locally for immediate feedback
            if (data.knockback) {
                this.localState.velocityX += data.knockback.x;
                this.localState.velocityY += data.knockback.y;
            }
        }
        
        if (data.attackerId === this.playerId) {
            this.playSound('attack');
        }
    }
    
    handlePlayerRespawn(data) {
        if (data.playerId === this.playerId) {
            this.localState = {
                ...this.localState,
                x: data.x,
                y: data.y,
                velocityX: 0,
                velocityY: 0,
                health: 100,
                isAlive: true,
                isJumping: false,
                isAttacking: false
            };
            this.playSound('respawn');
        }
    }
    
    handleGameOver(data) {
        // Show game over screen
        setTimeout(() => {
            alert(`Game Over! Winner: ${data.winnerName}`);
            this.leaveGame();
        }, 2000);
    }
    
    showError(message) {
        console.error('Server error:', message);
        alert(`Error: ${message}`);
    }
    
    leaveLobby() {
        this.sendMessage('leaveRoom');
        document.getElementById('lobbyScreen').style.display = 'none';
        document.getElementById('gameSelection').style.display = 'flex';
        this.room = null;
    }
    
    leaveGame() {
        this.sendMessage('leaveGame');
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('gameSelection').style.display = 'flex';
        this.gameState = null;
    }
    
    copyRoomCode() {
        const roomCode = document.getElementById('roomCodeDisplay');
        if (roomCode) {
            navigator.clipboard.writeText(roomCode.textContent)
                .then(() => alert('Room code copied to clipboard!'))
                .catch(err => console.error('Failed to copy:', err));
        }
    }
    
    // Input handling
    setupEventListeners() {
        // Keyboard input
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Touch controls for mobile
        this.setupTouchControls();
        
        // Window focus/blur
        window.addEventListener('blur', () => this.keys = {});
        window.addEventListener('focus', () => this.keys = {});
    }
    
    handleKeyDown(e) {
        if (e.key === ' ') e.preventDefault(); // Prevent spacebar from scrolling
        
        this.keys[e.key.toLowerCase()] = true;
        
        // Handle special keys
        switch(e.key.toLowerCase()) {
            case 'escape':
                if (this.gameState) {
                    this.leaveGame();
                } else if (this.room) {
                    this.leaveLobby();
                }
                break;
        }
    }
    
    handleKeyUp(e) {
        this.keys[e.key.toLowerCase()] = false;
    }
    
    setupTouchControls() {
        // This would be extended for mobile touch controls
        // For now, we'll just log that mobile controls would go here
        if ('ontouchstart' in window) {
            console.log('Mobile touch controls would be implemented here');
        }
    }
    
    // Game loop and rendering
    initCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Set canvas size
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        
        this.ctx = this.canvas.getContext('2d');
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = this.canvas.clientWidth;
            this.canvas.height = this.canvas.clientHeight;
        });
    }
    
    gameLoop(currentTime = 0) {
        const deltaTime = (currentTime - this.lastFrameTime) / 1000;
        this.lastFrameTime = currentTime;
        
        // Process local input
        this.processInput(deltaTime);
        
        // Render game
        this.render();
        
        // Request next frame
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    processInput(deltaTime) {
        if (!this.gameState || !this.localState.isAlive) return;
        
        const input = {
            sequence: this.inputSequence++,
            left: !!(this.keys['a'] || this.keys['arrowleft']),
            right: !!(this.keys['d'] || this.keys['arrowright']),
            jump: !!(this.keys['w'] || this.keys['arrowup'] || this.keys[' ']),
            attack: !!(this.keys['j'] || this.keys['k']),
            timestamp: Date.now()
        };
        
        // Store input for reconciliation
        this.pendingInputs.push(input);
        
        // Send input to server
        this.sendMessage('input', { input });
        
        // Apply input locally for prediction
        this.applyInput(input, deltaTime);
    }
    
    applyInput(input, deltaTime) {
        const moveSpeed = 400;
        const jumpForce = 500;
        const attackCooldown = 0.5; // seconds
        
        // Movement
        if (input.left && !input.right) {
            this.localState.velocityX = -moveSpeed;
            this.localState.facing = -1;
        } else if (input.right && !input.left) {
            this.localState.velocityX = moveSpeed;
            this.localState.facing = 1;
        } else {
            this.localState.velocityX *= 0.8; // Friction
        }
        
        // Jump
        if (input.jump && !this.localState.isJumping) {
            this.localState.velocityY = -jumpForce;
            this.localState.isJumping = true;
            this.playSound('jump');
        }
        
        // Attack
        const currentTime = Date.now() / 1000;
        if (input.attack && (currentTime - this.localState.lastAttackTime) > attackCooldown) {
            this.localState.isAttacking = true;
            this.localState.lastAttackTime = currentTime;
            
            // Attack animation will be handled in render
            setTimeout(() => {
                this.localState.isAttacking = false;
            }, 200);
        }
        
        // Apply physics
        this.applyPhysics(deltaTime);
    }
    
    applyPhysics(deltaTime) {
        const gravity = 1200;
        const maxFallSpeed = 800;
        
        // Apply gravity
        this.localState.velocityY += gravity * deltaTime;
        this.localState.velocityY = Math.min(this.localState.velocityY, maxFallSpeed);
        
        // Update position
        this.localState.x += this.localState.velocityX * deltaTime;
        this.localState.y += this.localState.velocityY * deltaTime;
        
        // Simple bounds checking (will be replaced with actual platform collision)
        const canvas = this.canvas;
        const platform = this.gameState?.platform || {
            x: canvas.width / 2 - 200,
            y: canvas.height * 0.7,
            width: 400,
            height: 40
        };
        
        // Platform collision
        if (this.localState.y + 30 > platform.y && 
            this.localState.y < platform.y + platform.height &&
            this.localState.x + 15 > platform.x && 
            this.localState.x - 15 < platform.x + platform.width) {
            
            // Land on platform
            if (this.localState.velocityY > 0 && this.localState.y + 30 <= platform.y + 10) {
                this.localState.y = platform.y - 30;
                this.localState.velocityY = 0;
                this.localState.isJumping = false;
            }
        }
        
        // Screen bounds (for falling detection)
        if (this.localState.y > canvas.height + 100) {
            this.localState.isAlive = false;
            // Report fall to server
            this.sendMessage('playerFell');
        }
    }
    
    processPendingInputs() {
        if (!this.gameState) return;
        
        // Get the last processed input sequence from server
        const serverSequence = this.gameState.lastProcessedInput || 0;
        
        // Remove inputs that have been processed by server
        this.pendingInputs = this.pendingInputs.filter(input => 
            input.sequence > serverSequence
        );
        
        // Reapply remaining inputs for reconciliation
        this.pendingInputs.forEach(input => {
            this.applyInput(input, 1/60); // Assume 60fps for reconciliation
        });
    }
    
    render() {
        if (!this.ctx || !this.canvas) return;
        
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Clear canvas
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw background
        this.drawBackground();
        
        // Draw platform
        this.drawPlatform();
        
        // Draw players
        this.drawPlayers();
        
        // Draw effects
        this.drawEffects();
        
        // Draw UI overlays
        this.drawUI();
    }
    
    drawBackground() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Draw gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw stars
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 50; i++) {
            const x = (i * 47) % canvas.width;
            const y = (i * 31) % canvas.height;
            const size = (i % 3) + 1;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    drawPlatform() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        const platform = this.gameState?.platform || {
            x: canvas.width / 2 - (this.gameMode === '1v1' ? 200 : 400),
            y: canvas.height * 0.7,
            width: this.gameMode === '1v1' ? 400 : 800,
            height: 40
        };
        
        // Platform shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(platform.x + 5, platform.y + 5, platform.width, platform.height);
        
        // Platform base
        const platformGradient = ctx.createLinearGradient(0, platform.y, 0, platform.y + platform.height);
        platformGradient.addColorStop(0, '#2a2a4a');
        platformGradient.addColorStop(1, '#1a1a3a');
        ctx.fillStyle = platformGradient;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Platform edges
        ctx.fillStyle = '#4ECDC4';
        ctx.fillRect(platform.x, platform.y, platform.width, 5);
        ctx.fillRect(platform.x, platform.y + platform.height - 5, platform.width, 5);
        
        // Platform pattern
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        for (let i = 0; i < platform.width; i += 40) {
            ctx.beginPath();
            ctx.moveTo(platform.x + i, platform.y);
            ctx.lineTo(platform.x + i, platform.y + platform.height);
            ctx.stroke();
        }
    }
    
    drawPlayers() {
        if (!this.gameState || !this.gameState.players) return;
        
        const ctx = this.ctx;
        const players = this.gameState.players;
        
        Object.entries(players).forEach(([id, player]) => {
            if (!player.isAlive) return;
            
            const isLocalPlayer = id === this.playerId;
            const playerColor = player.color || this.assets.colors[parseInt(id) % this.assets.colors.length];
            
            // Draw player shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.arc(player.x + 3, player.y + 35, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw player body
            ctx.fillStyle = playerColor;
            ctx.beginPath();
            ctx.arc(player.x, player.y + 30, 20, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw player face
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(player.x + (player.facing || 1) * 8, player.y + 25, 8, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw attack effect if attacking
            if (player.isAttacking) {
                ctx.strokeStyle = '#FFD166';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(player.x + (player.facing || 1) * 40, player.y + 30, 25, 0, Math.PI * 2);
                ctx.stroke();
                
                // Attack trail
                ctx.fillStyle = 'rgba(255, 209, 102, 0.3)';
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    ctx.arc(
                        player.x + (player.facing || 1) * (40 - i * 15),
                        player.y + 30,
                        20 - i * 5,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }
            
            // Draw health bar
            const healthPercent = Math.max(0, player.health) / 100;
            ctx.fillStyle = '#333333';
            ctx.fillRect(player.x - 25, player.y - 10, 50, 6);
            ctx.fillStyle = healthPercent > 0.5 ? '#4ECDC4' : healthPercent > 0.25 ? '#FFD166' : '#FF6B6B';
            ctx.fillRect(player.x - 25, player.y - 10, 50 * healthPercent, 6);
            
            // Draw player name
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(player.name || `Player${id}`, player.x, player.y - 20);
            
            // Highlight local player
            if (isLocalPlayer) {
                ctx.strokeStyle = '#FFFFFF';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(player.x, player.y + 30, 25, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }
    
    drawEffects() {
        // Draw knockback effects, respawn animations, etc.
        // This would be expanded with particle effects
    }
    
    drawUI() {
        const ctx = this.ctx;
        const canvas = this.canvas;
        
        // Draw mode indicator
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 100, 40);
        ctx.fillStyle = '#FF6B6B';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(
            this.gameMode === '1v1' ? '1v1 DUEL' : 'FREE-FOR-ALL',
            60, 35
        );
        
        // Draw instructions
        if (!this.localState.isAlive) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#FF6B6B';
            ctx.font = 'bold 32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('ELIMINATED!', canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '16px Arial';
            ctx.fillText('Waiting for respawn...', canvas.width / 2, canvas.height / 2 + 40);
        }
    }
    
    // Audio handling
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.createSounds();
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
        }
    }
    
    createSounds() {
        // Create simple beep sounds using Web Audio API
        const createBeep = (frequency, duration) => {
            return {
                play: () => {
                    if (!this.soundEnabled || !this.audioContext) return;
                    
                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
                    
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration);
                }
            };
        };
        
        this.assets.sounds = {
            jump: createBeep(523.25, 0.1),     // C5
            attack: createBeep(659.25, 0.1),   // E5
            hit: createBeep(392.00, 0.2),      // G4
            countdown: createBeep(440.00, 0.5), // A4
            go: createBeep(880.00, 0.5),       // A5
            respawn: createBeep(659.25, 0.3)   // E5
        };
    }
    
    playSound(soundName) {
        if (this.assets.sounds[soundName]) {
            this.assets.sounds[soundName].play();
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        const soundIcon = document.getElementById('soundIcon');
        if (soundIcon) {
            soundIcon.className = this.soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
    }
    
    // UI helper functions
    showControls() {
        document.getElementById('controlsModal').style.display = 'flex';
    }
    
    showHowToPlay() {
        alert('How to Play:\n\n1. Select a game mode (1v1 or Free-For-All)\n2. Share the room code with friends\n3. Ready up and start the game\n4. Use A/D or arrow keys to move\n5. Use W/Space to jump\n6. Use J/K to attack\n7. Knock opponents off the platform!');
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.game = new PlatformFighterClient();
    
    // Expose functions to global scope for HTML onclick handlers
    window.selectMode = (mode) => window.game.selectMode(mode);
    window.startGame = () => window.game.startGame();
    window.leaveLobby = () => window.game.leaveLobby();
    window.leaveGame = () => window.game.leaveGame();
    window.copyRoomCode = () => window.game.copyRoomCode();
    window.toggleSound = () => window.game.toggleSound();
    window.showControls = () => window.game.showControls();
    window.showHowToPlay = () => window.game.showHowToPlay();
    window.closeModal = (modalId) => window.game.closeModal(modalId);
});
