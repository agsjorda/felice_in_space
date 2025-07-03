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
        this.scene.load.spineAtlas('myWinAnim2', 'assets/Win/Win.atlas');
        this.scene.load.spineJson('myWinAnim2', 'assets/Win/Win.json');

        this.scene.load.spineAtlas('Symbol10_SW', 'assets/Symbols/Bomb/Symbol10_SW.atlas');
        this.scene.load.spineJson('Symbol10_SW', 'assets/Symbols/Bomb/Symbol10_SW.json');
        
    }

    create(): void {
        let spineObject2 = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        this.spineWinAnim = spineObject2;
        spineObject2.setPosition(0, 0);
        spineObject2.setAlpha(0);

        let bombSymbol = this.scene.add.spine(0, 0, 'Symbol10_SW', 'Symbol10_SW') as SpineGameObject;
        bombSymbol.setPosition(0, 0);
        bombSymbol.setAlpha(0);
        
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

    playWinAnimation(spineObject: SpineGameObject, totalwin: number, winType:string = ''): void {
        spineObject.alpha = 1;
        this.spineWinAnim = spineObject;
        let animationName = '';
        let animationName2 = '';
        
        const sampleDuration = 500;
        const intervalWin = (totalwin/sampleDuration * 100)/ 100;
        let runningWin = 0;
        let runningChar : string[] = [];

        // Get the AmountWin bone
        // const amountWinBone = spineObject.skeleton.findBone('AmountWin');
        // if (!amountWinBone) {
        //     console.error(`${amountWinBone} bone not found`);
        //     return;
        // }
// 
        // // Position the AmountWin bone at the center of the screen
        // const screenWidth = this.scene.cameras.main.width;
        // amountWinBone.x = screenWidth / 2;
        // amountWinBone.y = 0; // Adjust this if you need vertical positioning

        for(let i = 0 ; i < sampleDuration; i++){
            setTimeout(() => {
                // increment
                if(runningWin >= totalwin){
                    runningWin = totalwin;
                }
                else{
                    runningWin += intervalWin;
                }
                
                Events.emitter.emit(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN,
                     runningWin,
                     winType
                    );

                // Convert running win to character array
                runningChar = [];
                const numStr = runningWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                for (let i = 0; i < numStr.length; i++) {
                    if (numStr[i] === '.') {
                        runningChar.push('dot');
                    } else if (numStr[i] === ',') {
                        runningChar.push('coma');
                    } else {
                        runningChar.push(numStr[i]);
                    }
                }
            }, 3000 * i / sampleDuration);
        }
    
        switch (winType) {
            case 'BigWin':
                animationName = 'BigWin-Intro';
                animationName2 = 'BigWin-Idle'; 
                break;

            case 'EpicWin':
                animationName = 'EpicWin-Intro';
                animationName2 = 'EpicWin-Idle';
                break;

            case 'MegaWin':
                animationName = 'MegaWin-Intro';
                animationName2 = 'MegaWin-Idle';
                break;

            case 'SuperWin':
                animationName = 'SuperWin-Intro';
                animationName2 = 'SuperWin-Idle';
                break;
                
            case 'FreeSpin':
                animationName = 'FreeSpin-Intro';
                animationName2 = 'FreeSpin-Idle';
                break;

            case 'Congrats':
                animationName = 'Congrats-Intro';
                animationName2 = 'Congrats-Idle'; 
                break;
            default:
                spineObject.destroy();
                console.error("Win type not found: " + winType);
                return;
        }
        if(animationName != '' && animationName2 != ''){
            // Check if there's an ongoing animation
            if (spineObject.animationState.tracks.length > 0) {
                spineObject.animationState.addAnimation(this.currentTrack, animationName, false);
                spineObject.animationState.addAnimation(this.currentTrack + 1, animationName2, true);
                this.currentTrack += 2;
            }
            else{
                spineObject.animationState.setAnimation(this.currentTrack, animationName, false);
                spineObject.animationState.addAnimation(this.currentTrack + 1, animationName2, true);
                this.currentTrack += 2;
            }
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