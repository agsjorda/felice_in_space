import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';

export class Background {
    private initialLayerX: number = 0;
    private initialLayerY: number = 0;
    private isMobile: boolean = false;
    
    private main_1: GameObjects.Image;
    private main_2: GameObjects.Image;
    private main_3: GameObjects.Image;
    private main_4: GameObjects.Image;
    private main_5: GameObjects.Image;
    private main_6: GameObjects.Image;
    private main_7: GameObjects.Image;
    private main_8: GameObjects.Image;
    private main_9: GameObjects.Image;
    
    private bonus_1: GameObjects.Image;
    private bonus_2: GameObjects.Image;
    private bonus_3: GameObjects.Image;
    private bonus_4: GameObjects.Image;
    private bonus_5: GameObjects.Image;
    private bonus_6: GameObjects.Image;
    private bonus_7: GameObjects.Image;

    private floatingSpeedX: number = 0.001;
    private floatingSpeedY: number = 0.0012;

    private floatingAmplitudeX: number = 200;
    private floatingAmplitudeY: number = 250;

    private cloudParallaxSpeed: number = 0.2;
    private foregroundParallaxSpeed: number = 0.1;

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    preload(scene: Scene): void {
        this.isMobile = this.isMobileDevice();
        const prefix = 'assets/background';

        if(this.isMobile){
            //scene.load.image('mobile_main_background', `${prefix}/Main_Background.png`);
            //scene.load.image('mobile_bonus_background', `${prefix}/Bonus_Background.png`);
            scene.load.image('mobile_main_background', `${prefix}/Main_BG.png`);
            scene.load.image('mobile_bonus_background', `${prefix}/Bonus_BG.jpg`);
            scene.load.image('main_foreground', `${prefix}/Main_Foreground.png`);
        }
        else{
            scene.load.image('bonus_1', `${prefix}/Bonus/1_Bonus_BG.png`);
            scene.load.image('bonus_2', `${prefix}/Bonus/2_Bonus_BG.png`);
            scene.load.image('bonus_3', `${prefix}/Bonus/3_Bonus_BG.png`);
            scene.load.image('bonus_4', `${prefix}/Bonus/4_Bonus_BG.png`);
            scene.load.image('bonus_5', `${prefix}/Bonus/5_Bonus_BG.png`);
            scene.load.image('bonus_6', `${prefix}/Bonus/6_Bonus_BG.png`);
            scene.load.image('bonus_7', `${prefix}/Bonus/7_Bonus_BG.png`);

            scene.load.image('main_1', `${prefix}/Main/1_Default_BG.png`);
            scene.load.image('main_2', `${prefix}/Main/2_Default_BG.png`);
            scene.load.image('main_3', `${prefix}/Main/3_Default_BG.png`);
            scene.load.image('main_4', `${prefix}/Main/4_Default_BG.png`);
            scene.load.image('main_5', `${prefix}/Main/5_Default_BG.png`);
            scene.load.image('main_6', `${prefix}/Main/6_Default_BG.png`);
            scene.load.image('main_7', `${prefix}/Main/7_Default_BG.png`);
            scene.load.image('main_8', `${prefix}/Main/8_Default_BG.png`);
            scene.load.image('main_9', `${prefix}/Main/9_Default_BG.png`);
        }
    }

    create(scene: Scene): void {
        this.createBackground(scene);
        
        scene.gameData.isBonusRound = false;
        this.toggleBackground(scene);
    }

    toggleBackground(_scene: Scene): void {
        let main_status = 0;
        let bonus_status = 0;

        if(_scene.gameData.isBonusRound){
            main_status = 0;
            bonus_status = 1;
        } else {
            main_status = 1;
            bonus_status = 0;
        }

        // Only set alpha if the property exists and is not null
        if (this.main_1) this.main_1.alpha = main_status;
        if (this.main_2) this.main_2.alpha = main_status;
        if (this.main_3) this.main_3.alpha = main_status;
        if (this.main_4) this.main_4.alpha = main_status;
        if (this.main_5) this.main_5.alpha = main_status;
        if (this.main_6) this.main_6.alpha = main_status;
        if (this.main_7) this.main_7.alpha = main_status;
        if (this.main_8) this.main_8.alpha = main_status;
        if (this.main_9) this.main_9.alpha = main_status;

        if (this.bonus_1) this.bonus_1.alpha = bonus_status;
        if (this.bonus_2) this.bonus_2.alpha = bonus_status;
        if (this.bonus_3) this.bonus_3.alpha = bonus_status;
        if (this.bonus_4) this.bonus_4.alpha = bonus_status;
        if (this.bonus_5) this.bonus_5.alpha = bonus_status;
        if (this.bonus_6) this.bonus_6.alpha = bonus_status;
        if (this.bonus_7) this.bonus_7.alpha = bonus_status;

        if(this.isMobile){
            if (this.main_1) this.main_1.alpha = main_status;
        }

        Events.emitter.emit(Events.TOGGLE_BACKGROUND, main_status, bonus_status);
    }

    private createBackground(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        const centerX = width * 0.5;
        const centerY = height * 0.5;
        this.initialLayerX = centerX;
        this.initialLayerY = centerY;

        if (this.isMobile) {
            // Mobile: Only create main and bonus backgrounds
            this.main_1 = scene.add.image(centerX, centerY, 'mobile_main_background');
            this.main_1.setScale(0.70);
            this.main_1.setOrigin(0.25, 0.75);
            this.bonus_1 = scene.add.image(centerX, centerY, 'mobile_bonus_background');
            this.bonus_1.setScale(0.70);
            this.bonus_1.setOrigin(0.25, 0.75);
            this.main_2 = scene.add.image(centerX, centerY * 1.2, 'main_foreground');
            this.main_2.setScale(1);
            this.main_2.setOrigin(0.5, 0);
            
            // Set depth for mobile
            this.main_1.setDepth(0);
            this.bonus_1.setDepth(0);
            this.main_2.setDepth(0);
            
            // Initialize other properties to avoid errors
            this.main_3 = null as any;
            this.main_4 = null as any;
            this.main_5 = null as any;
            this.main_6 = null as any;
            this.main_7 = null as any;
            this.main_8 = null as any;
            this.main_9 = null as any;


            this.bonus_2 = null as any;
            this.bonus_3 = null as any;
            this.bonus_4 = null as any;
            this.bonus_5 = null as any;
            this.bonus_6 = null as any;
            this.bonus_7 = null as any;
        } else {
            // Desktop: Full experience with all elements
            this.main_1 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_1');
            this.main_2 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_2');
            this.main_3 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_3');
            this.main_4 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_4');
            this.main_5 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_5');
            this.main_6 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_6');
            this.main_7 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_7');
            this.main_8 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_8');        
            this.main_9 = scene.add.image(this.initialLayerX, this.initialLayerY, 'main_9');

            this.bonus_1 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_1');
            this.bonus_2 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_2');
            this.bonus_3 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_3');
            this.bonus_4 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_4');
            this.bonus_5 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_5');
            this.bonus_6 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_6');
            this.bonus_7 = scene.add.image(this.initialLayerX, this.initialLayerY, 'bonus_7');

            this.main_1.setDepth(8-10);
            this.main_2.setDepth(3-10);
            this.main_3.setDepth(6-10);
            this.main_4.setDepth(5-10);
            this.main_5.setDepth(4-10);
            this.main_6.setDepth(3-10);
            this.main_7.setDepth(2-10);
            this.main_8.setDepth(1-10);    
            this.main_9.setDepth(0-10);

            this.bonus_1.setDepth(6-10);
            this.bonus_2.setDepth(5-10);
            this.bonus_3.setDepth(4-10);
            this.bonus_4.setDepth(3-10);
            this.bonus_5.setDepth(2-10);
            this.bonus_6.setDepth(1-10);
            this.bonus_7.setDepth(0-10);
        }
    }

    private prevOffsetX = 0;
    update(_scene: Scene, _time: number, _delta: number): void {
        // Only update animations for desktop
        if (this.isMobile) {
            return;
        }
        

        const floatingOffsetY = Math.sin(_time * this.floatingSpeedY) * this.floatingAmplitudeY;
        const floatingOffsetY2 = Math.sin(_time * this.floatingSpeedY * 2) * this.floatingAmplitudeY;
        const floatingOffsetY3 = Math.sin(_time * this.floatingSpeedY * 3) * this.floatingAmplitudeY;
        const floatingOffsetX = Math.sin(_time/2 * this.floatingSpeedX) * this.floatingAmplitudeX;

        
        if(_scene.gameData.isBonusRound){
            if(this.bonus_2){
                this.bonus_2.y = this.initialLayerY + floatingOffsetY/1.5 * this.cloudParallaxSpeed;
            }
        }
        else
        {
            if (this.main_1) { // moon
                this.main_1.y = this.initialLayerY + -(floatingOffsetY/1.5 * this.cloudParallaxSpeed);
            }

            if (this.main_2) { // plane
                if(this.prevOffsetX < floatingOffsetX){
                    this.main_2.setAlpha(1);
                } else {
                    this.main_2.setAlpha(0);
                }

                const planeX = floatingOffsetX * this.cloudParallaxSpeed * 15;  
                this.main_2.x =  this.initialLayerX - planeX;
                this.main_2.y = this.initialLayerY + floatingOffsetY2 * this.cloudParallaxSpeed/2 - 50;
                
                this.prevOffsetX = floatingOffsetX; 
            }

            if (this.main_3) {
                this.main_3.y = this.initialLayerY + floatingOffsetY3 * this.foregroundParallaxSpeed / 5;
            }

            if (this.main_5) {
                this.main_5.y = this.initialLayerY + -floatingOffsetY2/4 * this.foregroundParallaxSpeed;
            }

            if (this.main_7) {
                this.main_7.y = this.initialLayerY  + floatingOffsetY/2 * this.foregroundParallaxSpeed;
                
            }

            if (this.main_8) {
                this.main_8.y = this.initialLayerY + floatingOffsetY/3 * this.foregroundParallaxSpeed;
            }
        }
    }

} 