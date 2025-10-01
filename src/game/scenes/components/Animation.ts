import { Slot } from './GameData';  
import { SymbolContainer } from './SymbolContainer';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { Scene } from 'phaser';

export class Animation {
    private scene: Scene;
    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
       // Felice in Space, 
        // Load symbol atlases - starting from 1 to 9 (not 0)
        for (let i = 0; i <= Slot.SYMBOLS; i++) {
            this.scene.load.spineAtlas(`Symbol${i}_FIS`,`assets/Symbols/Animations/Symbol${i}/Symbol${i}_FIS.atlas`);
            this.scene.load.spineJson(`Symbol${i}_FIS`,`assets/Symbols/Animations/Symbol${i}/Symbol${i}_FIS.json`);
        }
        
    }

    create(): void {

      for(let i = 0; i <= Slot.SYMBOLS; i++){
        let symbol = this.scene.add.spine(0, 0, `Symbol${i}_FIS`, `Symbol${i}_FIS`) as SpineGameObject;
        symbol.setPosition(0, 0);
        symbol.setAlpha(0);
      }
    }

    playSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer, symbolValue: number): Promise<void> {
        return new Promise<void>((resolve) => {
            if (symbolValue >= 0 && symbolValue <= Slot.SYMBOLS) {
                // Play the animation for matched symbols
                console.error("playing animation for symbol: " + symbolValue);
                
                let actualSprite: Phaser.GameObjects.Sprite;
                
                if (symbolSprite instanceof SymbolContainer) {
                    // For SymbolContainer, get the internal sprite and play animation directly
                    actualSprite = symbolSprite.getSymbolSprite() as unknown as Phaser.GameObjects.Sprite;
                    symbolSprite.setDepth(symbolSprite.depth + 1000);
                } else {
                    // For regular sprites
                    actualSprite = symbolSprite as Phaser.GameObjects.Sprite;
                    actualSprite.setDepth(actualSprite.depth + 1000);
                }
                
                // Play the animation using sprite.play() for both cases
                const spineObject = actualSprite as unknown as SpineGameObject;
                const animationState = spineObject.animationState.setAnimation(0, `animation`, false);
                
                animationState.timeScale = 1;
                // Set up listener for animation completion
                animationState.listener = {
                    complete: () => {
                        // Remove the listener to prevent memory leaks
                        animationState.listener = null;
                        resolve();
                    }
                };
                
            } else {
                // If symbol value is invalid, resolve immediately
                resolve();
            }
        });
    }

    stopSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer): void {
        if (symbolSprite instanceof SymbolContainer) {
            // For SymbolContainer, reset to idle
            symbolSprite.getSymbolSprite().animationState.setAnimation(0, `animation`, false);
        } else {
            // For regular sprites, use the old method
            // return; // wala pa nito - commented out to avoid unreachable code
            // symbolSprite.stop();
            // const symbolNum = symbolSprite.frame.texture.key.replace('Symbol', '').replace('_FIS', '');
            // symbolSprite.setFrame(`Symbol${symbolNum}_FIS-00000.png`);
        }
    }

    /**
     * Check if a symbol sprite is currently playing an animation
     */
    isSymbolAnimating(symbolSprite: Phaser.GameObjects.Sprite | SymbolContainer): boolean {
        try {
            let actualSprite: Phaser.GameObjects.Sprite;
            
            if (symbolSprite instanceof SymbolContainer) {
                actualSprite = symbolSprite.getSymbolSprite() as unknown as Phaser.GameObjects.Sprite;
            } else {
                actualSprite = symbolSprite as Phaser.GameObjects.Sprite;
            }
            
            const spineObject = actualSprite as unknown as SpineGameObject;
            if (spineObject && spineObject.animationState) {
                const currentAnimation = spineObject.animationState.getCurrent(0);
                return !!(currentAnimation && currentAnimation.animation && currentAnimation.animation.name === 'animation');
            }
        } catch (error) {
            console.error("Error checking symbol animation state: " + error);
        }
        return false;
    }
} 