import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import { getFontFamily } from '../../utils/fonts';

export class Background {
    private isMobile: boolean = false;
    
    private main_1: GameObjects.Image;
    private main_2: GameObjects.Image;
    
    private bonus_1: GameObjects.Image;


    // Fullscreen button and handlers
    private fsButton: Phaser.GameObjects.Image | null = null;
    private onEnterFs?: () => void;
    private onLeaveFs?: () => void;
  
    private onDomFsChange?: () => void;
    private onResize?: () => void;

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
    }

    create(scene: Scene): void {
        this.createBackground(scene);
        
        scene.gameData.isBonusRound = false;
        this.toggleBackground(scene);

        // Version label bottom-right
        const cfgVersion = (typeof window !== 'undefined' && (window as any).APP_CONFIG) ? (window as any).APP_CONFIG.version : undefined;
        let versionText = cfgVersion ?? (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev');
        if (versionText && !versionText.startsWith('v')) {
            versionText = `v${versionText}`;
        }
        const width = scene.scale.width;
        const height = scene.scale.height;
        const isMobileish = width <= 500;
        const versionLabel = scene.add.text(
            width - 10,
            height - 10,
            versionText,
            {
                fontSize: isMobileish ? '12px' : '14px',
                color: '#ffffff',
                fontFamily: getFontFamily(),
                stroke: '#000000',
                strokeThickness: 2,
            }
        );
        versionLabel.setOrigin(1, 1).setAlpha(0.8);
        // Ensure above background/foreground but below UI; backgrounds use depths 0-2
        versionLabel.setDepth(3);

        // Add fullscreen toggle button above backgrounds
        this.createFullscreenToggle(scene);
    }

    private createFullscreenToggle(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;
        const padding = this.isMobile ? 10 : 12;

        // Create button
        const key = scene.scale.isFullscreen ? 'fs_min' : 'fs_max';
        const btn = scene.add.image(width - padding, padding, key);
        btn.setOrigin(1, 0);
        const size = this.isMobile ? 28 : 32;
        btn.setDisplaySize(size, size);
        btn.setInteractive({ useHandCursor: true });
        btn.setDepth(4); // Above backgrounds and version label
        this.fsButton = btn;

        // Toggle on click
        btn.on('pointerup', () => {
            if (scene.scale.isFullscreen) {
                scene.scale.stopFullscreen();
            } else {
                scene.scale.startFullscreen();
            }
        });

        // Update icon on fs change
        const updateIcon = () => {
            if (!this.fsButton) return;
            this.fsButton.setTexture(scene.scale.isFullscreen ? 'fs_min' : 'fs_max');
        };
        this.onEnterFs = updateIcon;
        this.onLeaveFs = updateIcon;
        scene.scale.on('enterfullscreen', this.onEnterFs);
        scene.scale.on('leavefullscreen', this.onLeaveFs);

        // Also listen to DOM fullscreen changes for desktop browsers
        this.onDomFsChange = updateIcon;
        document.addEventListener('fullscreenchange', this.onDomFsChange);
        // @ts-ignore - Safari prefix
        document.addEventListener('webkitfullscreenchange', this.onDomFsChange);

        // Reposition on resize (enter/exit fullscreen changes size)
        const reposition = () => {
            const w = scene.scale.width;
            const p = padding;
            if (this.fsButton) this.fsButton.setPosition(w - p, p);
        };
        this.onResize = reposition;
        scene.scale.on('resize', this.onResize);

        // Cleanup on shutdown
        (scene as any).events?.once && (scene as any).events.once('shutdown', () => {
            if (this.onEnterFs) scene.scale.off('enterfullscreen', this.onEnterFs);
            if (this.onLeaveFs) scene.scale.off('leavefullscreen', this.onLeaveFs);
          
            if (this.onResize) scene.scale.off('resize', this.onResize);
            if (this.onDomFsChange) {
                document.removeEventListener('fullscreenchange', this.onDomFsChange);
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
        });
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

        if(this.isMobile){
            if (this.main_1) this.main_1.alpha = main_status;
            if(this.main_2) this.main_2.alpha = 1;
        }

        Events.emitter.emit(Events.TOGGLE_BACKGROUND, main_status, bonus_status);
    }

    private createBackground(scene: Scene): void {
        const width = scene.scale.width;
        const height = scene.scale.height;

        const centerX = width * 0.5;
        const centerY = height * 0.5;

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
        }
    }

} 