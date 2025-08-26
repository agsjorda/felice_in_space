import { Scene, GameObjects } from 'phaser';
import { GameData } from './GameData';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

/**
 * SymbolContainer class that manages symbol sprites (Symbol1-Symbol9)
 * Similar to BombContainer but without text overlay and using regular sprite animations
 */
export class SymbolContainer extends GameObjects.Container {
    private symbolSprite: SpineGameObject;
    private symbolValue: number;
    public scene: Scene;
    private gameData: GameData;

    constructor(scene: Scene, x: number, y: number, symbolValue: number, gameData: GameData) {
        super(scene, x, y);
        
        this.scene = scene;
        this.gameData = gameData;
        this.symbolValue = symbolValue;

        // Create the symbol sprite using regular sprite with texture atlas
        const symbolKey = `Symbol${symbolValue}_FIS`;
        //const frameKey = `Symbol${symbolValue}_FIS-00000.png`;
        this.symbolSprite = scene.add.spine(0, 0, symbolKey, symbolKey) as SpineGameObject;
        this.symbolSprite.setVisible(true);
        
        // Add the sprite to the container
        this.add(this.symbolSprite);
        
        // Debug logging
        this.gameData.debugLog('SymbolContainer created', {
            symbolValue,
            position: { x, y },
            symbolKey
            //frameKey
        });
    }

    /**
     * Set the display size for the symbol sprite
     */
    setSymbolDisplaySize(width: number, height: number): void {
        this.symbolSprite.setDisplaySize(width, height);
        
        this.gameData.debugLog('Symbol display size set', { 
            symbolValue: this.symbolValue, 
            width, 
            height 
        });
    }

    /**
     * Play the main animation for this symbol
     * Note: This method is kept for compatibility, but Animation.ts now calls the sprite directly
     */
    playSymbolAnimation(): void {
        this.gameData.debugLog('Playing symbol animation', { symbolValue: this.symbolValue });
        
        try {
            // Play the symbol animation using the animation key created in Animation.ts
            this.symbolSprite.animationState.setAnimation(0, `animation`, false);
        } catch (error) {
            this.gameData.debugError('Could not play animation for symbol', { 
                symbolValue: this.symbolValue, 
                error 
            });
        }
    }

    /**
     * Check if the symbol is currently playing an animation
     */
    isPlayingAnimation(): boolean {
        if (this.symbolSprite && this.symbolSprite.animationState) {
            return true;
        }
        return false;
    }

    /**
     * Get the symbol sprite for external animations
     */
    getSymbolSprite(): SpineGameObject {
        return this.symbolSprite;
    }

    /**
     * Get the symbol value
     */
    getSymbolValue(): number {
        return this.symbolValue;
    }

    /**
     * Reset to idle/static state
     */
    
    /**
     * Clean up the symbol container
     */
    destroy(): void {
        this.gameData.debugLog('Destroying symbol container', { symbolValue: this.symbolValue });
        
        if (this.symbolSprite) {
            this.symbolSprite.destroy();
        }
        
        super.destroy();
    }
} 