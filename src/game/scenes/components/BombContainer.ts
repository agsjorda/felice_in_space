import { Scene, GameObjects } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { GameData } from './GameData';

/**
 * BombContainer class that manages bomb sprites with text overlays
 * The container handles traversal during drop and refill operations
 */
export class BombContainer extends GameObjects.Container {
    private bombSprite: SpineGameObject;
    private textOverlay: GameObjects.Text;
    private multiplier: number;
    private bombType: string;
    public scene: Scene;
    private gameData: GameData;

    constructor(scene: Scene, x: number, y: number, bombValue: number, gameData: GameData) {
        super(scene, x, y);
        
        this.scene = scene;
        this.gameData = gameData;
        this.multiplier = this.getMultiplierFromBombValue(bombValue);
        this.bombType = this.getBombTypeFromMultiplier(this.multiplier);


        // Set the animation based on the bomb type
        // Create the bomb sprite
        this.bombSprite = scene.add.spine(0, 0, 'Symbol10_FIS', 'Symbol10_FIS');
        this.bombSprite.setVisible(true);
        
        // Set the animation time scale to 1
        this.bombSprite.animationState.timeScale = 1;
        // Set the animation based on the bomb type

        this.bombSprite.animationState.setAnimation(0, '');
        
        // Create the text overlay
        this.textOverlay = scene.add.text(0, 0, `${this.multiplier}X`, {
            fontSize: '32px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#FF0000',
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#FFFFFF',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        
        // Apply gradient to text
        const gradient = this.textOverlay.context.createLinearGradient(0, 0, 0, this.textOverlay.height);
        gradient.addColorStop(0, '#FFF15A');
        gradient.addColorStop(0.5, '#FFD000');
        gradient.addColorStop(1, '#FFB400');
        this.textOverlay.setFill(gradient);
        
        // Add both elements to the container
        this.add([this.bombSprite, this.textOverlay]);
        
        // Set initial visibility
        this.textOverlay.setAlpha(0.8);
        
        // Debug logging
        this.gameData.debugLog('BombContainer created', {
            bombValue,
            multiplier: this.multiplier,
            bombType: this.bombType,
            position: { x, y }
        });
    }

    /**
     * Get multiplier value from bomb symbol value (10-22)
     */
    private getMultiplierFromBombValue(bombValue: number): number {
        if (bombValue < 10 || bombValue > 22) {
            this.gameData.debugError('Invalid bomb value:', bombValue);
            return 2; // Default fallback
        }
        
        const multiplierIndex = bombValue - 10;
        const multipliers = this.gameData.bombMultiplier;
        
        if (multiplierIndex >= 0 && multiplierIndex < multipliers.length) {
            return multipliers[multiplierIndex];
        }
        
        this.gameData.debugError('Multiplier index out of range:', multiplierIndex);
        return 2; // Default fallback
    }

    /**
     * Get bomb type (low/medium/high) based on multiplier value
     */
    private getBombTypeFromMultiplier(multiplier: number): string {
        if (multiplier > 25) {
            return 'high';
        } else if (multiplier > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Set the display size for both bomb sprite and text overlay
     */
    setBombDisplaySize(width: number, height: number): void {
        this.bombSprite.setDisplaySize(width, height);
        
        // Scale text overlay proportionally
        const textScale = Math.min(width, height) / 100; // Adjust based on your needs
        this.textOverlay.setScale(textScale);
        
        this.gameData.debugLog('Bomb display size set', { width, height, textScale });
    }

    /**
     * Play bomb animation based on type
     */
    playBombAnimation(): void {
        this.gameData.debugLog('Playing bomb animation', { bombType: this.bombType });
        
        // Set the appropriate animation based on bomb type
        this.bombSprite.animationState.setAnimation(0, 'animation');
        
        // Animate text overlay appearance
        this.scene.tweens.add({
            targets: this.textOverlay,
            alpha: 1,
            scale: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            yoyo: true,
            yoyoDelay: 200
        });
    }

    /**
     * Check if the bomb is currently playing an animation
     */
    isPlayingAnimation(): boolean {
        if (this.bombSprite && this.bombSprite.animationState.tracks.length > 0) {
            const currentAnimation = this.bombSprite.animationState.getCurrent(0);
            if (currentAnimation && currentAnimation.animation) {
                const animationName = currentAnimation.animation.name;
                // Check for both animation types: 'low-animation', 'medium-animation', 'high-animation'
                // and also 'low-static', 'medium-static', 'high-static' (used by WinAnimation)
                return animationName.includes('animation') || animationName.includes('static');
            }
        }
        return false;
    }

    /**
     * Get the bomb sprite for external animations
     */
    getBombSprite(): SpineGameObject {
        return this.bombSprite;
    }

    /**
     * Get the text overlay for external modifications
     */
    getTextOverlay(): GameObjects.Text {
        return this.textOverlay;
    }

    /**
     * Get the multiplier value
     */
    getMultiplier(): number {
        return this.multiplier;
    }

    /**
     * Get the bomb type
     */
    getBombType(): string {
        return this.bombType;
    }

    /**
     * Update text overlay content
     */
    updateText(text: string): void {
        this.textOverlay.setText(text);
        this.gameData.debugLog('Bomb text updated', { text });
    }

    /**
     * Show explosion effect
     */
    showExplosion(): void {
        this.gameData.debugLog('Showing bomb explosion');
        
        // Play explosion animation
        this.bombSprite.animationState.setAnimation(0, 'explosion');
        
        // Animate text overlay
        this.scene.tweens.add({
            targets: this.textOverlay,
            alpha: 0,
            scale: 0.5,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.textOverlay.setAlpha(0.8);
                this.textOverlay.setScale(1);
            }
        });
    }

    /**
     * Clean up the bomb container
     */
    destroy(): void {
        this.gameData.debugLog('Destroying bomb container');
        
        if (this.bombSprite) {
            this.bombSprite.destroy();
        }
        
        if (this.textOverlay) {
            this.textOverlay.destroy();
        }
        
        super.destroy();
    }
} 