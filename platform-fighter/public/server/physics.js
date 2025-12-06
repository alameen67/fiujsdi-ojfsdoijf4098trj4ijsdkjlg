class Physics {
    static updatePlayer(player, deltaTime) {
        // Apply gravity
        const gravity = 1200;
        const maxFallSpeed = 800;
        
        player.velocityY += gravity * deltaTime;
        player.velocityY = Math.min(player.velocityY, maxFallSpeed);
        
        // Apply friction
        player.velocityX *= 0.8;
        
        // Update position
        player.x += player.velocityX * deltaTime;
        player.y += player.velocityY * deltaTime;
        
        // Update attack cooldown
        if (player.isAttacking) {
            player.lastAttackTime += deltaTime;
            if (player.lastAttackTime > 0.2) { // Attack animation duration
                player.isAttacking = false;
            }
        }
    }
    
    static checkCollision(player1, player2) {
        if (!player1.isAlive || !player2.isAlive) return null;
        if (player1.isAttacking === false && player2.isAttacking === false) return null;
        
        const dx = player1.x - player2.x;
        const dy = player1.y - player2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const collisionDistance = 50; // Sum of player radii + attack range
        
        if (distance < collisionDistance) {
            // Determine who attacked whom
            if (player1.isAttacking && !player2.isAttacking) {
                return {
                    attacker: player1,
                    victim: player2,
                    direction: { x: dx / distance, y: dy / distance }
                };
            } else if (player2.isAttacking && !player1.isAttacking) {
                return {
                    attacker: player2,
                    victim: player1,
                    direction: { x: -dx / distance, y: -dy / distance }
                };
            }
        }
        
        return null;
    }
    
    static applyKnockback(victim, direction, power = 1.0) {
        const baseKnockback = 300;
        const knockback = baseKnockback * power;
        
        victim.velocityX += direction.x * knockback;
        victim.velocityY += direction.y * knockback;
        
        // Apply damage based on knockback power
        const damage = 10 * power;
        victim.health = Math.max(0, victim.health - damage);
        
        return {
            knockback: { x: direction.x * knockback, y: direction.y * knockback },
            damage: damage
        };
    }
    
    static checkPlatformCollision(player, platform) {
        if (!player.isAlive) return false;
        
        const playerBottom = player.y + 30; // Player radius
        const playerLeft = player.x - 20;
        const playerRight = player.x + 20;
        
        const platformTop = platform.y;
        const platformBottom = platform.y + platform.height;
        const platformLeft = platform.x;
        const platformRight = platform.x + platform.width;
        
        // Check if player is above platform and falling
        if (player.velocityY > 0 &&
            playerBottom <= platformBottom &&
            playerBottom >= platformTop - 10 &&
            playerRight > platformLeft &&
            playerLeft < platformRight) {
            
            // Land on platform
            player.y = platformTop - 30;
            player.velocityY = 0;
            player.isJumping = false;
            return true;
        }
        
        return false;
    }
    
    static constrainToPlatform(player, platform) {
        const playerRadius = 20;
        const platformLeft = platform.x + playerRadius;
        const platformRight = platform.x + platform.width - playerRadius;
        
        // Constrain horizontal movement to platform edges
        if (player.x < platformLeft) {
            player.x = platformLeft;
            player.velocityX = Math.max(0, player.velocityX);
        } else if (player.x > platformRight) {
            player.x = platformRight;
            player.velocityX = Math.min(0, player.velocityX);
        }
    }
    
    static canJump(player, platform) {
        if (!player.isAlive) return false;
        
        const playerBottom = player.y + 30;
        const platformTop = platform.y;
        
        // Can jump if on platform or very close to it
        return Math.abs(playerBottom - platformTop) < 5 && !player.isJumping;
    }
}

module.exports = Physics;
