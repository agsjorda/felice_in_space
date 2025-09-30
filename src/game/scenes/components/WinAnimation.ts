import { Scene } from 'phaser';
import { Events } from "./Events";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';

export class WinAnimation {
    private scene: Scene;
    private spineWinAnim: SpineGameObject;
    private bombImages: Phaser.GameObjects.Image[] = [];

    constructor(scene: Scene) {
        this.scene = scene;
    }

    preload(): void {
        this.scene.load.spineAtlas('myWinAnim2', 'assets/Win/Default FOR WIN ANIMATION spine.atlas');
        this.scene.load.spineJson('myWinAnim2', 'assets/Win/Default FOR WIN ANIMATION spine.json');

        this.scene.load.spineAtlas('Symbol10_FIS', 'assets/Symbols/Bomb/Symbol10_FIS.atlas');
        this.scene.load.spineJson('Symbol10_FIS', 'assets/Symbols/Bomb/Symbol10_FIS.json');

    }

    create(): void {
        let spineObject2 = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        this.spineWinAnim = spineObject2;
        spineObject2.setPosition(0, 0);
        spineObject2.setAlpha(0);

        let bombSymbol10 = this.scene.add.spine(0, 0, 'Symbol10_FIS', 'Symbol10_FIS') as SpineGameObject;
        bombSymbol10.setPosition(0, 0);
        bombSymbol10.setAlpha(0);
        
    }

    update(): void {
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
                
                if(winType === 'FreeSpin'){
                    runningWin = totalwin;
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
                animationName = 'bigwin_intro_fis';
                animationName2 = 'bigwin_idle_fis'; 
                break;

            case 'EpicWin':
                animationName = 'epicwin_intro_fis';
                animationName2 = 'epicwin_idle_fis';
                break;

            case 'MegaWin':
                animationName = 'megawin_intro_fis';
                animationName2 = 'megawin_idle_fis';
                break;

            case 'SuperWin':
                animationName = 'superwin_intro_fis';
                animationName2 = 'superwin_idle_fis';
                break;
                
            case 'FreeSpin':
                animationName = 'youwon_intro_fis';
                animationName2 = 'youwon_idle_fis';
                break;

            case 'Congrats':
                animationName = 'congratsyouwon_intro_fis';
                animationName2 = 'congratsyouwon_idle_fis'; 
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
    }

} 