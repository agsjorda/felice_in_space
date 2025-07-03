import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { Scene } from 'phaser';
import { Events } from '../scenes/components/Events';
//@ts-ignore
import { AnimationState } from '@esotericsoftware/spine-ts';

export class Character {
    private spineObject: SpineGameObject | null = null;
    private animationX: number = 0;
    private animationY: number = 0;
    private currAnim: AnimationState;
    private currWinAnim: AnimationState;
    constructor() {
    }

    preload(scene: Scene): void {
        const prefix = 'assets/Assets/Character';
        scene.load.spineAtlas('character-atlas', `${prefix}/character enhance.atlas`);
        scene.load.spineJson('character', `${prefix}/character enhance.json`);
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    create(scene: Scene): void {
        let width = scene.scale.width;
        let height = scene.scale.height;
        let x = this.isMobileDevice() ? width * 0.80 : width * 0.14;
        let y = this.isMobileDevice() ? height * 0.19 : height * 0.90;

        this.spineObject = scene.add.spine(x, y, 'character', 'character-atlas') as SpineGameObject;
        this.spineObject.setScale(
                this.isMobileDevice() ? 0.06 : -0.25, 
                this.isMobileDevice() ? 0.06 : 0.25
            );

        this.animationX = this.spineObject.x;
        this.animationY = this.spineObject.y;

        this.currAnim = this.spineObject.animationState.setAnimation(0, 'idle', true); // felice animations: 'idle' , 'win'
        this.spineObject.setDepth(10);

        console.log(this.spineObject.animationState.data.skeletonData.animations);

        Events.emitter.on(Events.WIN, () => {
                console.log('win');
                if (this.spineObject) {
                    this.spineObject.setY(this.animationY);
                    
                    this.currAnim.listener = {
                        complete: () => {
                            this.currAnim = this.spineObject?.animationState.setAnimation(0, 'idle', false);
                            this.currAnim.listener = {
                                complete: () => {
                                    this.currWinAnim = this.spineObject?.animationState.setAnimation(0, 'win', false);
                                    
                                    this.spineObject?.setY(this.animationY+25/5);
                                }
                            };
                        }
                    };
                    
                    // When win animation completes, flip back and return to idle
                    if(this.currWinAnim) {
                    this.currWinAnim.listener = {
                        complete: () => {
                            if (this.spineObject) {
                                this.spineObject.setY(this.animationY - 25/5);
                                this.spineObject.animationState.setAnimation(0, 'idle', true);
                            }
                        }
                    };
                }
            }
        });
    }
} 