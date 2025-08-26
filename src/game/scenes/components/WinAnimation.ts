import { Scene } from 'phaser';
import { Events } from "./Events";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

export class WinAnimation {
    private scene: Scene;
    private spineWinAnim: SpineGameObject;
    private bombAtlas: number[] = [2,3,4,5,6,8,10,12,15,20,25,50,100];
    private bombImages: Phaser.GameObjects.Image[] = [];
    private currentBombImage: Phaser.GameObjects.Image | null = null;
    private onBombAnimationStart?: () => void;
    private onBombAnimationEnd?: () => void;

    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
        this.scene.load.spineAtlas('myWinAnim2', 'assets/Win/Default FOR WIN ANIMATION spine.atlas');
        this.scene.load.spineJson('myWinAnim2', 'assets/Win/Default FOR WIN ANIMATION spine.json');

        for(let i = 10; i < 23; i++){
            let j = i < 17 ? 0 : i < 21 ? 1 : 2;
            let k = i < 17 ? "multiplier" : i < 21 ? "BLUE ROCK" : "Green rock";
            this.scene.load.spineAtlas(`Symbol${i}_FIS`, `assets/Symbols/Bomb/Bomb_${j}/${k}.atlas`);
            this.scene.load.spineJson(`Symbol${i}_FIS`, `assets/Symbols/Bomb/Bomb_${j}/${k}.json`);
        }
        
    }

    create(): void {
        let spineObject2 = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        this.spineWinAnim = spineObject2;
        spineObject2.setPosition(0, 0);
        spineObject2.setAlpha(0);

        for(let i = 10; i < 23; i++){
            let bombSymbol = this.scene.add.spine(0, 0, `Symbol${i}_FIS`, `Symbol${i}_FIS`) as SpineGameObject;
            bombSymbol.setPosition(0, 0);
            bombSymbol.setAlpha(0);
        }
        
    }

    update(): void {
    }

    playBombAnimation(spineObject: SpineGameObject, multiplier: number, bombType: string = ''): void {
        // Notify that bomb animation is starting
        if (this.onBombAnimationStart) {
            this.onBombAnimationStart();
        }
        
        // Hide any currently displayed bomb image
        this.hideCurrentBombImage();
        //
        
        // Find and display the appropriate bomb image
        const bombIndex = this.bombAtlas.indexOf(multiplier);
        if (bombIndex !== -1 && this.bombImages[bombIndex]) {
            this.currentBombImage = this.bombImages[bombIndex];
            this.currentBombImage.setVisible(true);
            this.currentBombImage.setAlpha(1);
            this.currentBombImage.setPosition(spineObject.x, spineObject.y);
            this.currentBombImage.setScale(0.5);
            
            // Animate the bomb image appearing
            this.scene.tweens.add({
                targets: this.currentBombImage,
                alpha: 1,
                scale: 1,
                duration: 500,
                ease: 'Back.easeOut',
                delay: 200
            });
        }
        
        if(bombType == 'low'){
            spineObject.animationState.setAnimation(0, 'low-static');
        }
        else if(bombType == 'medium'){
            spineObject.animationState.setAnimation(0, 'medium-static');
        }
        else if(bombType == 'high'){
            spineObject.animationState.setAnimation(0, 'high-static');
        }
        
        // Auto-hide bomb image after animation completes
        spineObject.once('animationcomplete', () => {
            if (this.currentBombImage) {
                this.scene.tweens.add({
                    targets: this.currentBombImage,
                    alpha: 0,
                    scale: 0.5,
                    duration: 300,
                    ease: 'Power2',
                    onComplete: () => {
                        this.hideCurrentBombImage();
                        // Notify that bomb animation has ended
                        if (this.onBombAnimationEnd) {
                            this.onBombAnimationEnd();
                        }
                    }
                });
            } else {
                // Notify that bomb animation has ended (if no image was shown)
                if (this.onBombAnimationEnd) {
                    this.onBombAnimationEnd();
                }
            }
        });
    }

    private hideCurrentBombImage(): void {
        if (this.currentBombImage) {
            this.currentBombImage.setVisible(true);
            this.currentBombImage.setAlpha(1);
            this.currentBombImage = null;
        }
    }


    private currentTrack: number = 0;
    
    exitAnimation(): void {
        this.scene.tweens.add({
            targets: this.spineWinAnim,
            alpha: 0,
            duration: 1000,
            ease: 'Sine.easeInOut',
        });
        
        // Also hide bomb image when exiting
        this.hideCurrentBombImage();
    }

    destroy(): void {
        // Clean up all bomb images
        this.bombImages.forEach(image => {
            if (image && image.active) {
                image.destroy();
            }
        });
        this.bombImages = [];
        this.currentBombImage = null;
    }

    setBombAnimationCallbacks(onStart?: () => void, onEnd?: () => void): void {
        this.onBombAnimationStart = onStart;
        this.onBombAnimationEnd = onEnd;
    }
} 