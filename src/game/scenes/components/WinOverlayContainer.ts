import { Scene, GameObjects, Sound } from 'phaser';
import { Events } from './Events';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { WinAnimation } from './WinAnimation';
import { GameData } from './GameData';
import { Buttons } from '../../ui/Buttons';
import { AudioManager } from './AudioManager';

// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    buttons: Buttons;
}

export class WinOverlayContainer {
    private scene: GameScene;
    private container: GameObjects.Container;
    private winAnimation: WinAnimation;
    private winText: GameObjects.Text;
    private freeSpinsText: GameObjects.Text;
    private buttonText: GameObjects.Text;
    private winAnim: SpineGameObject;
    private isActive: boolean = false;
    private isAnimating: boolean = false;
    private multiplier: number = 0;
    private isMobile: boolean = false;

    constructor(scene: GameScene, winAnimation: WinAnimation) {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();
        this.winAnimation = winAnimation;
        this.container = scene.add.container(0, 0);
        this.container.setDepth(10000);
        this.container.setScale(this.isMobile ? 0.5 : 1);
        this.createOverlay();
    }

    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    private createOverlay(): void {
        // Create semi-transparent background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRect(0, 0, this.scene.scale.width, this.scene.scale.height * 2);
        if(this.isMobile) {
            bg.setScale(2, 2);
        }
        this.container.add(bg);

        // Create container for content
        const contentContainer = this.scene.add.container(
            this.isMobile ? this.scene.scale.width : this.scene.scale.width / 2,
            this.isMobile ? this.scene.scale.height : this.scene.scale.height / 2);
        this.container.add(contentContainer);

        // Add win animation
        this.winAnim = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        this.winAnim.setScale(1);
        this.winAnim.setPosition(0, 0);
        contentContainer.add(this.winAnim);

        // Add win amount text
        this.winText = this.scene.add.text(0, 120, '0.00', {
            fontSize: '128px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#FF0000',
            strokeThickness: 10,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#FFFFFF',
                blur: 20,
                stroke: true,
                fill: false
            }
        });
        this.winText.setOrigin(0.5);
        this.winText.alpha = 1;
        contentContainer.add(this.winText);

        // Add free spins text
        this.freeSpinsText = this.scene.add.text(0, 0, '0.00', {
            fontSize: '84px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#FF0000',
            strokeThickness: 6,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#FFFFFF',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        this.freeSpinsText.setOrigin(0.5);
        this.freeSpinsText.visible = false;
        this.freeSpinsText.setPosition(-110, 95);
        contentContainer.add(this.freeSpinsText);

        // Add continue button
        this.buttonText = this.scene.add.text(0, 250, 'Press anywhere to continue', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#379557',
            strokeThickness: 6,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#000000',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        this.buttonText.setOrigin(0.5);
        contentContainer.add(this.buttonText);

        // Make entire screen interactive
        const buttonZone = this.scene.add.zone(0, 0, this.scene.scale.width, this.scene.scale.height);

        buttonZone.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width* 2 , this.scene.scale.height * 2),
            Phaser.Geom.Rectangle.Contains
        );
        contentContainer.add(buttonZone);

        // Set up event listeners
        this.setupEventListeners(buttonZone);
    }

    private setupEventListeners(buttonZone: GameObjects.Zone): void {
        Events.emitter.on(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN, (totalWin: number, winType: string) => {
            if (winType === 'Congrats') {
                this.winText.setPosition(0, -60);
                this.winText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                this.freeSpinsText.visible = true;
                this.freeSpinsText.setText(`${this.scene.gameData.totalFreeSpins.toFixed(0)}`);
            } else if (winType === 'FreeSpin') {
                this.winText.setPosition(0, -60);
                this.winText.setText(`${totalWin.toFixed(0)}`);
                this.freeSpinsText.visible = false;

            } else {
                this.winText.setPosition(0, 120);
                this.winText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                this.freeSpinsText.visible = false;
            }
            
        });


        buttonZone.on('pointerdown', () => {
            if (this.multiplier === -1) {
                // Handle free spins case                
                this.scene.tweens.add({
                    targets: this.container,
                    alpha: 0,
                    y: -this.scene.scale.height,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => {
                        // Start free spins autoplay without stopping existing autoplay
                        if (!this.scene.buttons.autoplay.isAutoPlaying) {
                            Events.emitter.emit(Events.AUTOPLAY_START, this.scene.gameData.freeSpins);
                        }
                        this.destroy();
                    }
                });
            } else {
                // Handle regular win case
                this.scene.audioManager.WinSkip.play();
                this.scene.tweens.add({
                    targets: this.container,
                    alpha: 0,
                    y: -this.scene.scale.height,
                    duration: 1000,
                    ease: 'Power2',
                    onComplete: () => {
                        this.destroy();
                    }
                });
            }
        });
    }

    public async show(totalWin: number, multiplier: number): Promise<void> {
        if (this.isAnimating) {
            return;
        }

        this.isActive = true;
        this.isAnimating = true;
        this.multiplier = multiplier;

        // Determine win type and colors
        let winType = this.determineWinType(multiplier);
        if(winType == '') {
            this.isAnimating = false;
            return;
        }
        let colorGradient = ['#FFF15A', '#FFD000', '#FFB400'];
        let colorMid = 0.5;

        // Apply gradient to win text
        const gradient = this.winText.context.createLinearGradient(0, 0, 0, this.winText.height);
        gradient.addColorStop(0, colorGradient[0]);
        gradient.addColorStop(colorMid, colorGradient[1]);
        gradient.addColorStop(1, colorGradient[2]);
        this.winText.setFill(gradient);

        // Play win animation and wait for it to complete
        await this.winAnimation.playWinAnimation(this.winAnim, totalWin, winType);

        // Play appropriate win sound
        await this.playWinSound(multiplier);

        // Emit show event
        Events.emitter.emit(Events.WIN_OVERLAY_SHOW);
        this.isAnimating = false;
    }

    private determineWinType(multiplier: number): string {
        if (multiplier >= this.scene.gameData.winRank[4]) return 'SuperWin';
        if (multiplier >= this.scene.gameData.winRank[3]) return 'EpicWin';
        if (multiplier >= this.scene.gameData.winRank[2]) return 'MegaWin';
        if (multiplier >= this.scene.gameData.winRank[1]) return 'BigWin';
        if (multiplier === -1) return 'FreeSpin';
        if (multiplier === -2) return 'Congrats';
        return '';
    }

    private playWinSound(multiplier: number): Promise<void> {
        return new Promise((resolve) => {
            let winSound: Sound.WebAudioSound | undefined;
            if (multiplier >= this.scene.gameData.winRank[1] && multiplier < this.scene.gameData.winRank[2]) {
                winSound = this.scene.audioManager.BigW;
            } else if (multiplier >= this.scene.gameData.winRank[2] && multiplier < this.scene.gameData.winRank[3]) {
                winSound = this.scene.audioManager.MegaW;
            } else if (multiplier >= this.scene.gameData.winRank[3] && multiplier < this.scene.gameData.winRank[4]) {
                winSound = this.scene.audioManager.EpicW;
            } else if (multiplier >= this.scene.gameData.winRank[4]) {
                winSound = this.scene.audioManager.SuperW;
            } else if (multiplier === -1) {
                winSound = this.scene.audioManager.FreeSpinW;
            } else if (multiplier === -2) {
                winSound = this.scene.audioManager.CongratsW;
            } else {
                winSound = this.scene.audioManager.FreeSpinW;
            }

            if (winSound) {
                winSound.once('complete', () => {
                    if (this.isActive) {
                        resolve();
                    }
                });
                winSound.play();
            } else {
                resolve();
            }
        });
    }

    public destroy(): void {
        if (this.isActive) {
            this.scene.slotMachine.activeWinOverlay = false;
            this.winAnimation.exitAnimation();
            Events.emitter.off(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN);
            this.container.destroy();
            this.isActive = false;
            this.isAnimating = false;
            this.scene.audioManager.stopWinSFX(this.scene);
            
            Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
        }
    }
} 