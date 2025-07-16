import { Scene } from 'phaser';
import { GameAPI } from './backend/GameAPI';

export class LandingPage extends Scene {
    private spinButton!: Phaser.GameObjects.Image;
    private notificationText!: Phaser.GameObjects.Text;;
    private DIJOKERText!: Phaser.GameObjects.Text;;
    private isRotating: boolean = false;
    protected pressed: boolean = false;
    private isTransitioning: boolean = false;
    private isMobile: boolean = false;

    constructor() {
        super('LandingPage');
    }

    preload(): void {
        this.load.image('logostart', 'assets/Logo/Logo.png');
        this.load.image('background_desktop', 'assets/background/preloader_desktop.png');
        this.load.image('background_mobile', 'assets/background/preloader_mobile.png');
        this.load.image('spinButton', 'assets/Controllers/Spin.png');
        this.load.image('gameTemplateBackground', 'assets/background/Main_Background.png')
    }

    create(): void {
        console.log(this.cameras.main.width, this.cameras.main.height);
        // Detect if mobile
        this.isMobile = this.isMobileDevice();
        
        // Choose background based on device
        const backgroundKey = this.isMobile ? 'background_mobile' : 'background_desktop';
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, backgroundKey)
        .setOrigin(0.5);
        
        // Adjust logo position and scale based on device
        const logoX = this.isMobile ? this.cameras.main.width / 2 : 600;
        const logoY = this.isMobile ? this.cameras.main.height * 0.125 : 150;
        
        this.add.image(logoX, logoY, 'logostart').setScale(1);

        // Adjust win text position and size
        const winTextX = this.isMobile ? this.cameras.main.width * 0.475 : this.cameras.main.width / 4;
        const winTextY = this.isMobile ? this.cameras.main.height * 0.65 : this.cameras.main.height * 0.8;
        const winTextSize = this.isMobile ? '32px' : '48px';
        
        this.add.text(winTextX, winTextY, 'Win up to 21,000x', {
            fontSize: winTextSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Poppins',
            stroke: '#379557',
            strokeThickness: this.isMobile ? 4 : 8,
            shadow: {
                offsetX: this.isMobile ? 1 : 2,
                offsetY: this.isMobile ? 4 : 8,
                color: '#000000',
                blur: 0,
                fill: true
            }
        }).setOrigin(0.5);

        // Adjust notification text position and size
        const notifX = this.isMobile ? this.cameras.main.width *  0.25: this.cameras.main.width * 0.72;
        const notifY = this.isMobile ? this.cameras.main.height * 0.93 : this.cameras.main.height * 0.6;
        const notifSize = this.isMobile ? '18px' : '24px';
        
        this.notificationText = this.add.text(notifX, notifY, 'PLAY LOUD. WIN.WILD. DIJOKER STYLE', {
            fontSize: notifSize,
            color: '#ffffff',
            fontFamily: 'Inter',
        }).setAlpha(0);

        const notifX2 = this.isMobile ? this.cameras.main.width *  0.25: this.cameras.main.width * 0.72;
        const notifY2 = this.isMobile ? this.cameras.main.height * 0.88 : this.cameras.main.height * 0.6;
        const notifSize2 = this.isMobile ? '36px' : '24px';
        
        this.DIJOKERText = this.add.text(notifX2, notifY2, 'DIJOKER', {
            fontSize: notifSize2,
            color: '#ffffff',
            fontFamily: 'Inter',
        }).setAlpha(0);

        // Adjust spin button position and scale
        const buttonX = this.isMobile ? this.cameras.main.width / 2 : this.cameras.main.width * 0.8;
        const buttonY = this.isMobile ? this.cameras.main.height * 0.79 : this.cameras.main.height * 0.425;
        const buttonScale = this.isMobile ? 0.4 : 1;
        
        this.spinButton = this.add.image(buttonX, buttonY, 'spinButton').setScale(buttonScale);
        this.spinButton.setAlpha(0.5);

        this.startIdleRotation();

        this.spinButton.setInteractive({useHandCursor: true});
        this.spinButton.on('pointerdown', () => {
            if(this.spinButton.alpha == 1) {
                //@ts-ignore
                this.scene.get('LoadingPage').hideLoadingBar();
                
                if (this.isTransitioning) return;
                this.isTransitioning = true;

                // Fade out the current scene
                this.cameras.main.fadeOut(1000, 0, 0, 0);

                // When fade out is complete, start the Game scene
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('Game');
                    this.scene.remove('LoadingPage');
                });
            }
        });

        this.scene.launch('LoadingPage');
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    private startIdleRotation(): void {
        if (!this.isRotating) {
            this.isRotating = true;
            this.tweens.add({
                targets: this.spinButton,
                angle: 360,
                duration: 12000,
                ease: 'Linear',
                repeat: -1
            });
        }
    }

    public doneLoading(): void {
        this.spinButton.setAlpha(1);
        this.notificationText.setAlpha(1);
        this.DIJOKERText.setAlpha(1);
        
           // Initialize and run the game launcher with retries
           const gameAPI = new GameAPI(this.gameData);
           const maxRetries = 50;
           let retryCount = 0;
           
           const tryLaunchGame = async () => {
               try {
                   await gameAPI.gameLauncher();
                   this.spinButton.setAlpha(1);
               } catch (error) {
                   console.error(`Failed to launch game (attempt ${retryCount + 1}):`, error);
                   if (retryCount < maxRetries) {
                       retryCount++;
                       await tryLaunchGame();
                   } else {
                       console.error('Max retries reached, game launch failed');
                       this.spinButton.setAlpha(0.75);
                   }
               }
           };

           tryLaunchGame();
//
                // Fade out the current scene
             //  this.cameras.main.fadeOut(1000, 0, 0, 0);
//
             //  // When fade out is complete, start the Game scene
             //  this.cameras.main.once('camerafadeoutcomplete', () => {
             //      this.scene.start('Game');
             //      this.scene.remove('LoadingPage');
             //  });
            
    }
} 