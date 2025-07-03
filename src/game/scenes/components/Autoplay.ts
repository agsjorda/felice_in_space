import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import { GameData } from './GameData';
import { SlotMachine } from './SlotMachine';
import { Buttons } from '../../ui/Buttons';
import { AudioManager } from './AudioManager';

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    buttons: Buttons;
}

export class Autoplay {
    public isAutoPlaying: boolean = false;
    public remainingSpins: number = 0;
    private scene: GameScene;
    private spinInterval: ReturnType<typeof setTimeout>;
    private remainingSpinsText?: GameObjects.Text;
    private spinsText_Y: number = 0;
    private remainingSpinsBg?: GameObjects.Graphics;
    private isMobile: boolean = false;

    preload(scene: GameScene): void {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();
    }
    
    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    create(scene: GameScene): void {
        this.scene = scene;
        
        Events.emitter.on(Events.AUTOPLAY_START, (numSpins: number) => {
            this.start(scene, numSpins);
        });     
        Events.emitter.on(Events.AUTOPLAY_STOP, () => {
            this.stop();
        });
    }

    destroy(): void {
        Events.emitter.off(Events.AUTOPLAY_START, this.start);
        Events.emitter.off(Events.AUTOPLAY_STOP, this.stop);
    }

    addSpins(numSpins: number): void {
        this.remainingSpins += numSpins;
        this.updateRemainingSpinsDisplay();
    }

    start(scene: GameScene, numSpins: number): void {
        
        this.isAutoPlaying = true;
        this.remainingSpins = numSpins;
        this.scene = scene;
        
        // Create remaining spins display
        this.createRemainingSpinsDisplay(scene);
        
            this.spin();
        

        // Remove any existing event listener to avoid duplicates
        Events.emitter.removeListener(Events.MATCHES_DONE);

        // Listen for matches completion
        Events.emitter.on(Events.MATCHES_DONE, () => {
            if (this.isAutoPlaying && this.scene && !this.scene.gameData.isSpinning) {
                // Clear any existing interval
                if (this.spinInterval) {
                    clearTimeout(this.spinInterval);
                }
                
                // Add a small delay before next spin
                this.spinInterval = setTimeout(() => {
                    this.spin();
                }, 10);
            }
        });
    }

    private createRemainingSpinsDisplay(scene: GameScene): void {
        // Remove existing text and background if they exist
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
        }

        // Position it near the autoplay button
        const x = this.isMobile ? scene.buttons.freeSpinBtn.x : scene.scale.width * 0.88;
        const y = this.isMobile ? scene.buttons.freeSpinBtn.y : scene.scale.height * 0.443;


        // Create text for remaining spins
        this.remainingSpinsText = scene.add.text(x, y, 'Spins Left', {
            fontSize: '28px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        this.remainingSpinsText.setOrigin(0.5, 0.5);
        this.remainingSpinsText.setDepth(1000);
        this.remainingSpinsText.setScale(this.isMobile ? 0.5 : 1);
        this.spinsText_Y = this.remainingSpinsText.y;

        // Update button visibility
        if (scene.gameData.freeSpins > 0) {
            scene.buttons.freeSpinBtn.visible = true;
            scene.buttons.autoplayIndicator.visible = false;
        } else {
            scene.buttons.freeSpinBtn.visible = false;
            scene.buttons.autoplayIndicator.visible = true;
        }

        // Update the display
        this.updateRemainingSpinsDisplay();
    }

    public updateRemainingSpinsDisplay(): void {
        if (!this.scene || !this.remainingSpinsText) return;

        this.scene.buttons.freeSpinBtn.visible = true;
        
        // Determine which count to display
        const displayCount = this.scene.gameData.isBonusRound ? 
            this.scene.gameData.freeSpins : this.remainingSpins;

        // Update text position based on number of digits
        if (displayCount.toString().length === 3) {
            this.remainingSpinsText.setFontSize('50px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 20);
        } else if (displayCount.toString().length === 2) {
            this.remainingSpinsText.setFontSize('80px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 15);
        } else {
            this.remainingSpinsText.setFontSize('110px');
            this.remainingSpinsText.setPosition(this.remainingSpinsText.x, this.isMobile ? this.spinsText_Y : this.spinsText_Y + 10);
        }

        // Update the text
        this.remainingSpinsText.setText(displayCount.toString());
    }

    stop(): void {
        if (this.spinInterval) {
            clearTimeout(this.spinInterval);
            this.spinInterval = 0;
        }

        this.scene.buttons.resetAutoplayButtons();
        this.isAutoPlaying = false;
        this.remainingSpins = 0;
        
        Events.emitter.removeListener(Events.MATCHES_DONE);
        
        // Remove both text and background
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
            this.remainingSpinsText = undefined;
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
            this.remainingSpinsBg = undefined;
        }
    }

    private spin(): void {
            this.scene.gameData.debugError("A spin");
            this.scene.gameData.debugLog("autoplay: " + this.isAutoPlaying + "\nbonus: " + this.scene.gameData.isBonusRound + "\nspins: " + this.remainingSpins + "\nfree: " + this.scene.gameData.freeSpins);

        // Check if we should stop autoplay
        if (!this.isAutoPlaying || 
            (!this.scene.gameData.isBonusRound && this.remainingSpins <= 0) ||
            (this.scene.gameData.isBonusRound && this.scene.gameData.freeSpins <= 0)) {
            this.stop();
            this.scene.gameData.debugLog("a1 stop"); 
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        // If music has resumed, destroy any active win overlay
        if (this.scene.slotMachine.activeWinOverlay) {
            if(!this.scene.audioManager.BGChecker?.isPlaying) {
                this.scene.slotMachine.destroyWinOverlay(this.scene);
                this.scene.gameData.debugLog("b1 destroy win overlay");
            }
        }

        // For free spins, don't check balance
        if (!this.scene.gameData.isBonusRound) {
            this.scene.gameData.debugLog("c2 not Bonus Round");
            // Check if player has enough balance for the bet
            if (this.scene.gameData.balance < this.scene.gameData.bet) {
                this.stop();
                this.scene.gameData.debugLog("c3 not enough balance");
                Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
                return;
            }
            // Decrement remaining spins for regular play
            this.remainingSpins--;
        }
        this.scene.gameData.debugLog("d1");

        // Reset total win for new spin
        this.scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});

        // Ensure we have valid slot data
        if (!this.scene.gameData.slot?.values?.length) {
            this.scene.gameData.debugError('Invalid slot data in autoplay spin');
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }
        this.scene.gameData.debugLog("e1");

        // Trigger spin
        Events.emitter.emit(Events.SPIN, {
            currentRow: this.scene.gameData.currentRow,
            symbols: this.scene.gameData.slot.values
        });

        // Update remaining spins display
        this.updateRemainingSpinsDisplay();
    }

    update(_scene: GameScene, _time: number, _delta: number): void {
        // Empty implementation - can be used for future animations or updates
    }
} 