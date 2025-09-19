import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { Scene } from 'phaser';
import { Events } from '../scenes/components/Events';
//@ts-ignore
import { AnimationState } from '@esotericsoftware/spine-ts';

export class Character {
    private spineObject: SpineGameObject | null = null;
    private animationY: number = 0;
    private currAnim: AnimationState;
    private currWinAnim: AnimationState;
    private scene: Scene | null = null;
    private readonly ANIMATION_CHECK_INTERVAL = 5000; // Check every 5 seconds
    private readonly ANIMATION_TIMEOUT = 10000; // Consider stuck after 10 seconds
    private lastAnimationTime: number = 0;
    private isAnimating: boolean = false;

    constructor() {
    }

    preload(scene: Scene): void {
        const prefix = 'assets/Assets/Character';
        scene.load.spineAtlas('character-atlas', `${prefix}/character enhance.atlas`);
        scene.load.spineJson('character', `${prefix}/character enhance.json`);
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    private destroyCharacter(): void {
        if (this.spineObject) {
            this.spineObject.destroy();
            this.spineObject = null;
        }
    }

    private createCharacter(): void {
        if (!this.scene) return;

        let width = this.scene.scale.width;
        let height = this.scene.scale.height;
        let x = this.isMobileDevice() ? width * 0.80 : width * 0.14;
        let y = this.isMobileDevice() ? height * 0.24 : height * 0.90;

        this.spineObject = this.scene.add.spine(x, y, 'character', 'character-atlas') as SpineGameObject;
        this.spineObject.setScale(
                this.isMobileDevice() ? 0.08 : -0.25, 
                this.isMobileDevice() ? 0.08 : 0.25
            );

        this.animationY = this.spineObject.y;

        this.currAnim = this.spineObject.animationState.setAnimation(0, 'idle', true);
        this.spineObject.setDepth(0);
        this.lastAnimationTime = Date.now();
        this.isAnimating = true;

        // Set up win animation listener
        Events.emitter.on(Events.WIN, () => {
                if (this.spineObject) {
                    this.spineObject.setY(this.animationY);
                    this.lastAnimationTime = Date.now();
                    this.isAnimating = true;
                    
                    this.currAnim.listener = {
                        complete: () => {
                            this.currAnim = this.spineObject?.animationState.setAnimation(0, 'idle', false);
                            this.lastAnimationTime = Date.now();
                            this.isAnimating = true;
                            
                            // this.currAnim.listener = {
                            //     complete: () => {
                            //         this.currWinAnim = this.spineObject?.animationState.setAnimation(0, 'win', false);
                            //         this.lastAnimationTime = Date.now();
                            //         this.isAnimating = true;
                                    
                            //         this.spineObject?.setY(this.animationY+25/5);
                            //     }
                            // };
                        }
                    };
                    
                    // When win animation completes, flip back and return to idle
                    if(this.currWinAnim) {
                    this.currWinAnim.listener = {
                        complete: () => {
                            if (this.spineObject) {
                                this.spineObject.setY(this.animationY - 25/5);
                                this.spineObject.animationState.setAnimation(0, 'idle', true);
                                this.lastAnimationTime = Date.now();
                                this.isAnimating = true;
                            }
                        }
                    };
                }
            }
        });
    }

    private checkAnimationState(): void {
        if (!this.spineObject || !this.scene) return;

        const currentTime = Date.now();
        
        // Check if animation has been running for too long without completion
        if (this.isAnimating && (currentTime - this.lastAnimationTime) > this.ANIMATION_TIMEOUT) {
            //console.log('Character animation appears stuck, recreating...');
            this.recreateCharacter();
            return;
        }

        // Check if the spine object is still valid and animating
        try {
            const currentAnimation = this.spineObject.animationState.getCurrent(0);
            if (!currentAnimation || !currentAnimation.animation) {
                //console.log('Character has no active animation, recreating...');
                this.recreateCharacter();
                return;
            }
        } catch (error) {
            //console.log('Error checking character animation state, recreating...', error);
            this.recreateCharacter();
            return;
        }
    }

    private recreateCharacter(): void {
        //this.scene?.gameData.debugLog('Recreating character...');
        this.destroyCharacter();
        this.createCharacter();
    }

    create(scene: Scene): void {
        this.scene = scene;
        this.createCharacter();

        // Set up periodic animation checking
        scene.time.addEvent({
            delay: this.ANIMATION_CHECK_INTERVAL,
            callback: () => this.checkAnimationState(),
            loop: true
        });
    }
}