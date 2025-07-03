import { Scene } from 'phaser';
import { Slot } from './GameData';

export class Animation {
    private scene: Scene;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
       // Felice in Space, 
       /*
       for(let i = 0 ; i < Slot.SYMBOLS; i++) {
        this.scene.load.atlas(
            `Symbol${i}_FIS`,
            `assets/Symbols/Animations/Symbol${i}_FIS.png`,
            `assets/Symbols/Animations/Symbol${i}_FIS.json`
        );
       }
        */
       for(let i = 0 ; i <= Slot.SYMBOLS; i++) {
        this.scene.load.image(
            `Symbol${i}_FIS`,
            `assets/Symbols/Symbol${i}_FIS.png`
        );
       }
       
       // Load explosion atlas
        this.scene.load.atlas(
            'Explosion_FIS',
            'assets/Symbols/Animations/Explosion_FIS.png',
            'assets/Symbols/Animations/Explosion_FIS.json'
        );
    }

    create(): void {
        // Create animations for each symbol
      //  for (let i = 0; i <= Slot.SYMBOLS; i++) {
      //      const frames = this.scene.anims.generateFrameNames(`Symbol${i}_FIS`, {
      //          start: 0,
      //          end: 29,
      //          zeroPad: 5,
      //          prefix: `Symbol${i}_FIS-`,
      //          suffix: '.png'
      //      });
//
      //      this.scene.anims.create({
      //          key: `symbol${i}_anim`,
      //          frames: frames,
      //          frameRate: 30,
      //          repeat: 0 // Don't repeat
      //      });
      //  }

        // Create explosion animation
        const explosionFrames = this.scene.anims.generateFrameNames('Explosion_FIS', {
            start: 0,
            end: 11,
            zeroPad: 5,
            prefix: 'Explosion_FIS-',
            suffix: '.png'
        });

        this.scene.anims.create({
            key: 'explosion_anim',
            frames: explosionFrames,
            frameRate: 30,
            repeat: 0 // Don't repeat
        });
    }

    playSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite, symbolValue: number): void {
        return; // wala pa nito

        if (symbolValue >= 0 && symbolValue <= Slot.SYMBOLS) {
            // Play the animation for matched symbols
            this.scene.gameData.debugLog("playing animation for symbol: " + symbolValue);
            symbolSprite.play(`symbol${symbolValue}_anim`);
            symbolSprite.setDepth(symbolSprite.depth + 1000);
            // Create and play explosion with delay
            const explosion = this.scene.add.sprite(0, 0, 'Explosion_FIS');
            explosion.setScale(0.7); // Match symbol scale
            explosion.setDepth(symbolSprite.depth + 10); // Ensure explosion appears above symbol
            
            // Add explosion to the same container as the symbol
            if (symbolSprite.parentContainer) {
                symbolSprite.parentContainer.add(explosion);
                // Position explosion at the same local coordinates as the symbol
                explosion.x = symbolSprite.x;
                explosion.y = symbolSprite.y;
            }
            
            // Add delay before playing explosion
            this.scene.time.delayedCall(420, () => {
                try {
                    explosion.play('explosion_anim');
                    // Listen for animation complete to destroy the explosion sprite
                    explosion.once('animationcomplete', () => {
                        explosion.destroy();
                    });
                } catch (error) {
                    this.scene.gameData.debugError("error playing explosion animation: " + error);
                }
                
            });
        }
    }

    stopSymbolAnimation(symbolSprite: Phaser.GameObjects.Sprite): void {
        return; // wala pa nito
        symbolSprite.stop();
        const symbolNum = symbolSprite.frame.texture.key.replace('Symbol', '').replace('_FIS', '');
        symbolSprite.setFrame(`Symbol${symbolNum}_FIS-00000.png`);
    }
} 