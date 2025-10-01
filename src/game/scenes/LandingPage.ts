import { Scene } from 'phaser';
import { GameAPI } from './backend/GameAPI';
import { getFontFamily, logFontStatus } from '../utils/fonts';
import { WakeLockManager } from '../utils/wakeLock';

export class LandingPage extends Scene {
    private spinButton!: Phaser.GameObjects.Image;
    private notificationText!: Phaser.GameObjects.Text;;
    private isRotating: boolean = false;
    protected pressed: boolean = false;
    private isTransitioning: boolean = false;
    private isMobile: boolean = false;
    private fsButton: Phaser.GameObjects.Image | null = null;
    private onEnterFs?: () => void;
    private onLeaveFs?: () => void;
    
    private onDomFsChange?: () => void;
    private onResize?: () => void;

    constructor() {
        super('LandingPage');
    }

    preload(): void {
        this.load.image('logostart', 'assets/Logo/Logo.png');
        this.load.image('background_mobile', 'assets/background/preloader_mobile.png');
        this.load.image('spinButton', 'assets/Controllers/Spin.png');
        // Fullscreen toggle icons
        this.load.image('fs_max', 'assets/Controllers/Maximize.png');
        this.load.image('fs_min', 'assets/Controllers/Minimize.png');
    }

    create(): void {
        // console.log(this.cameras.main.width, this.cameras.main.height);
        
        // Log font status for debugging
        logFontStatus();
        
        // Detect if mobile
        this.isMobile = this.isMobileDevice();
        
        // Choose background based on device
        const backgroundKey = 'background_mobile';
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, backgroundKey)
        .setOrigin(0.5);
        
        // Fullscreen toggle button (above background)
        const padding = this.isMobile ? 10 : 12;
        const size = this.isMobile ? 28 : 32;
        const fsKey = this.scale.isFullscreen ? 'fs_min' : 'fs_max';
        const btn = this.add.image(this.cameras.main.width - padding, padding, fsKey);
        btn.setOrigin(1, 0);
        btn.setDisplaySize(size, size);
        btn.setDepth(1000);
        btn.setInteractive({ useHandCursor: true });
        this.fsButton = btn;
        btn.on('pointerup', () => {
            if (this.scale.isFullscreen) {
                this.scale.stopFullscreen();
            } else {
                this.scale.startFullscreen();
            }
        });
        const updateIcon = () => {
            const btn = this.fsButton;
            if (!btn || !(btn as any).scene || !(btn as any).scene.sys) return;
            const key = this.scale.isFullscreen ? 'fs_min' : 'fs_max';
            // Ensure texture exists before swapping
            if (this.textures && this.textures.exists(key)) {
                btn.setTexture(key);
            }
        };
        this.onEnterFs = updateIcon;
        this.onLeaveFs = updateIcon;
        this.scale.on('enterfullscreen', this.onEnterFs);
        this.scale.on('leavefullscreen', this.onLeaveFs);

        // Also listen to DOM fullscreen changes for desktop
        this.onDomFsChange = updateIcon;
        document.addEventListener('fullscreenchange', this.onDomFsChange);
        // @ts-ignore - Safari prefix
        document.addEventListener('webkitfullscreenchange', this.onDomFsChange);

        // Reposition on resize
        const reposition = () => {
            const p = padding;
            if (this.fsButton) this.fsButton.setPosition(this.cameras.main.width - p, p);
        };
        this.onResize = reposition;
        this.scale.on('resize', this.onResize);
        
        // Cleanup on scene shutdown/remove
        this.events.once('shutdown', () => this.cleanupFullscreenHandlers());
        this.events.once('destroy', () => this.cleanupFullscreenHandlers());
        
        // Adjust logo position and scale based on device
        const logoScale = 0.75;
        const logoX = this.cameras.main.width / 2;
        const logoY = this.cameras.main.height * 0.1;
        
        this.add.image(logoX, logoY, 'logostart')
        .setScale(logoScale);

        // Adjust win text position and size
        const winTextX = this.isMobile ? this.cameras.main.width / 2 : this.cameras.main.width / 4;
        const winTextY = this.isMobile ? this.cameras.main.height * 0.7 : this.cameras.main.height * 0.8;
        const winTextSize = this.isMobile ? '32px' : '48px';
        
        this.add.text(winTextX, winTextY, 'Win up to 21,000x', {
            fontSize: winTextSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: getFontFamily(),
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
        const notifX = this.isMobile ? this.cameras.main.width * 0.5: this.cameras.main.width * 0.72;
        const notifY = this.isMobile ? this.cameras.main.height * 0.88 : this.cameras.main.height * 0.6;
        const notifSize = this.isMobile ? '18px' : '24px';
        
        this.notificationText = this.add.text(notifX, notifY, 'Press Play To Continue', {
            fontSize: notifSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: getFontFamily(),
            stroke: '#379557',
        }).setAlpha(0).setOrigin(0.5,0);

        // Adjust spin button position and scale
        const buttonX = this.isMobile ? this.cameras.main.width / 2 : this.cameras.main.width * 0.8;
        const buttonY = this.isMobile ? this.cameras.main.height * 0.8 : this.cameras.main.height * 0.425;
        const buttonScale = this.isMobile ? 0.4 : 1;
        
        this.spinButton = this.add.image(buttonX, buttonY, 'spinButton').setScale(buttonScale);
        this.spinButton.setAlpha(0.5);

        this.startIdleRotation();

        this.spinButton.setInteractive({useHandCursor: true});
        this.spinButton.on('pointerdown', async () => {
            if(this.spinButton.alpha == 1) {
                //@ts-ignore
                this.scene.get('LoadingPage').hideLoadingBar();
                
                if (this.isTransitioning) return;
                this.isTransitioning = true;

                // Request wake lock on user gesture
                try { await WakeLockManager.request(); } catch (_e) {}

                // Fade out the current scene
                this.cameras.main.fadeOut(500, 0, 0, 0);

                // When fade out is complete, start the Game scene
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.start('Game');
                    this.scene.remove('LoadingPage');
                });
            }
        });

        // Version label bottom-right
        const cfgVersion = (typeof window !== 'undefined' && window.APP_CONFIG) ? window.APP_CONFIG.version : undefined;
        let versionText = cfgVersion ?? (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');
        if (versionText && !versionText.startsWith('v')) {
            versionText = `v${versionText}`;
        }
        const versionLabel = this.add.text(this.cameras.main.width - 10, this.cameras.main.height - 10, versionText, {
            fontSize: this.isMobile ? '12px' : '14px',
            color: '#ffffff',
            fontFamily: getFontFamily(),
            stroke: '#000000',
            strokeThickness: 2
        });
        versionLabel.setOrigin(1, 1).setAlpha(0.85);

        this.scene.launch('LoadingPage');
    }

    private cleanupFullscreenHandlers(): void {
        if (this.onEnterFs) this.scale.off('enterfullscreen', this.onEnterFs);
        if (this.onLeaveFs) this.scale.off('leavefullscreen', this.onLeaveFs);
        if (this.onResize) this.scale.off('resize', this.onResize);
        if (this.onDomFsChange) {
            document.removeEventListener('fullscreenchange', this.onDomFsChange as any);
            // @ts-ignore
            document.removeEventListener('webkitfullscreenchange', this.onDomFsChange);
        }
        this.onEnterFs = undefined;
        this.onLeaveFs = undefined;
        this.onResize = undefined;
        this.onDomFsChange = undefined;
        if (this.fsButton) {
            this.fsButton.destroy();
            this.fsButton = null;
        }
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('device') == 'mobile'){
            return true;
        }else if(urlParams.get('device') == 'desktop'){
            return false;
        }
            
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

        // // Fade out the current scene UNCOMMENT FOR TESTING
        // this.cameras.main.fadeOut(250, 0, 0, 0);

        // // When fade out is complete, start the Game scene
        // this.cameras.main.once('camerafadeoutcomplete', () => {
        //     this.scene.start('Game');
        //     this.scene.remove('LoadingPage');
        // });
    }
}                                                                                           