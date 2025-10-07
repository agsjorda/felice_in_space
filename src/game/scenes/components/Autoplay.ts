import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import { GameData } from './GameData';
import { SlotMachine } from './SlotMachine';
import { Buttons } from '../../ui/Buttons';
import { AudioManager } from './AudioManager';
import { BuyFeaturePopup } from './BuyFeaturePopup';

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    buttons: Buttons;
    autoplay: Autoplay; // Reference to autoplay
    buyFeaturePopup: BuyFeaturePopup;
}

export class Autoplay {
    public isAutoPlaying: boolean = false;
    public remainingSpins: number = 0;
    private scene: GameScene;
    private spinInterval: ReturnType<typeof setTimeout>;
    private remainingSpinsText?: GameObjects.Text;
    private remainingSpinsBg?: GameObjects.Graphics;
    private isMobile: boolean = false;
    private matchesDoneListener: () => void; // Store listener reference for proper cleanup
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private spinScheduled: boolean = false;
	private awaitingSpinAnimationEnd: boolean = false;
	private awaitingOverlayClose: boolean = false;
	private onSpinAnimationEnd: (() => void) | null = null;
	private onWinOverlayShow: (() => void) | null = null;
	private onWinOverlayHide: (() => void) | null = null;

    preload(scene: GameScene): void {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();
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

    create(scene: GameScene): void {
        this.scene = scene;
        
		// Create event-driven listeners to wait for animations and overlays
		this.matchesDoneListener = () => {
			// Deprecated for scheduling; kept for debugging only
        //console.log("Autoplay MATCHES_DONE received (no direct scheduling)");
		};
		this.onSpinAnimationEnd = () => {
			if (!this.isAutoPlaying) return;
			// console.log("Autoplay detected SPIN_ANIMATION_END");
			this.awaitingSpinAnimationEnd = false;
			this.scheduleSpinIfReady();
		};
		this.onWinOverlayShow = () => {
			if (!this.isAutoPlaying) return;
			// console.log("Autoplay detected WIN_OVERLAY_SHOW");
			this.awaitingOverlayClose = true;
		};
		this.onWinOverlayHide = () => {
			if (!this.isAutoPlaying) return;
			// console.log("Autoplay detected WIN_OVERLAY_HIDE");
			this.awaitingOverlayClose = false;
			this.scheduleSpinIfReady();
		};
        
		Events.emitter.on(Events.AUTOPLAY_START, (numSpins: number) => {
            this.start(scene, numSpins);
        });     
        Events.emitter.on(Events.AUTOPLAY_STOP, () => {
            this.stop();
        });
		Events.emitter.on(Events.SPIN_ANIMATION_END, this.onSpinAnimationEnd);
		Events.emitter.on(Events.WIN_OVERLAY_SHOW, this.onWinOverlayShow);
		Events.emitter.on(Events.WIN_OVERLAY_HIDE, this.onWinOverlayHide);
    }

    destroy(): void {
        // Clean up event listeners properly
        Events.emitter.off(Events.AUTOPLAY_START, this.start);
        Events.emitter.off(Events.AUTOPLAY_STOP, this.stop);
        if (this.matchesDoneListener) {
            Events.emitter.off(Events.MATCHES_DONE, this.matchesDoneListener);
        }
			if (this.onSpinAnimationEnd) {
				Events.emitter.off(Events.SPIN_ANIMATION_END, this.onSpinAnimationEnd);
			}
			if (this.onWinOverlayShow) {
				Events.emitter.off(Events.WIN_OVERLAY_SHOW, this.onWinOverlayShow);
			}
			if (this.onWinOverlayHide) {
				Events.emitter.off(Events.WIN_OVERLAY_HIDE, this.onWinOverlayHide);
			}
    }

    start(scene: GameScene, numSpins: number): void {
        // Don't start autoplay if already spinning
        if (scene.gameData.isSpinning) {
            // console.log("Cannot start autoplay: already spinning");
            return;
        }
        
        this.isAutoPlaying = true;
        this.remainingSpins = numSpins;
        this.scene = scene;
        
        // Create remaining spins display
        this.createRemainingSpinsDisplay(scene);
        // During autoplay, hide spin via alpha and show FS button under overlay
        try {
            scene.buttons.spinButton.setAlpha(0);
            scene.buttons.freeSpinBtn.setAlpha(1);
            scene.buttons.freeSpinBtn.visible = true;
        } catch (_e) {}
        
		// Add lightweight listener for debugging (no scheduling)
		Events.emitter.on(Events.MATCHES_DONE, this.matchesDoneListener);
        
		// Start first spin with a small delay to ensure state is ready
        // console.log("Starting autoplay - scheduling first spin");
        this.spinInterval = setTimeout(() => {
            // console.log("Executing first autoplay spin");
            this.spin();
        }, 50);

        // Start polling interval to ensure recovery
        if (this.pollInterval) clearInterval(this.pollInterval);
        this.pollInterval = setInterval(() => {
            if (this.isAutoPlaying && this.scene && !this.scene.gameData.isSpinning && !this.spinScheduled) {
                // console.log("[Autoplay Poll] Detected ready state, spinning...");
                this.spinScheduled = true;
                this.spin();
            }
        }, 500);
    }

    private createRemainingSpinsDisplay(scene: GameScene): void {
        // Remove existing text and background if they exist
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
        }

        // Center the text over the spin area (use the spin container if available)
        let worldX = scene.scale.width * 0.88;
        let worldY = scene.scale.height * 0.443;
        let spinContainer: GameObjects.Container | null = null;
        try {
            spinContainer = scene.children.getByName('spinContainer') as GameObjects.Container;
            if (!spinContainer && this.isMobile) {
                worldX = scene.scale.width * 0.5;
                worldY = scene.scale.height * 0.86; // approximate mobile spin Y
            } else if (spinContainer) {
                worldX = spinContainer.x;
                worldY = spinContainer.y;
            }
        } catch (_e) {}

        // Create text for remaining spins (autoplay remaining spins or FS label when in bonus)
        this.remainingSpinsText = scene.add.text(spinContainer ? 0 : worldX, spinContainer ? 0 : worldY, '', {
            fontSize: '72px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 6
        });
        this.remainingSpinsText.setOrigin(0.5, 0.5); // center align
        // On mobile, ensure this HUD renders below the autoplay popup (popup depth is 1000)
        this.remainingSpinsText.setDepth(this.isMobile ? 10 : 1000);
        this.remainingSpinsText.setScale(this.isMobile ? 0.5 : 1);
        if (spinContainer) {
            spinContainer.add(this.remainingSpinsText);
            try { (spinContainer as any).bringToTop(this.remainingSpinsText); } catch (_e) {}
        }

        // Indicator visibility policy:
        // - Keep autoplayIndicator visible during FreeSpin overlay
        // - Hide autoplayIndicator only after FreeSpin overlay is closed and bonus begins
        const overlayActive = (scene as any)?.slotMachine?.activeWinOverlay === true;
        // During bonus, only show FS button together with the Spins Left label
        const bonusLabelShouldShow = scene.gameData.isBonusRound && (scene.gameData.freeSpins ?? 0) > 0 && !overlayActive;
        // In base game, still show FS button for autoplay remaining spins
        const shouldShowFsBtn = bonusLabelShouldShow || (!scene.gameData.isBonusRound && this.isAutoPlaying && this.remainingSpins > 0 && !overlayActive);
        if (scene.gameData.isBonusRound && !overlayActive) {
            // We're in bonus (overlay closed) → hide autoplay indicator (always), obey FS button policy
            try { scene.buttons.autoplayIndicator.visible = false; } catch (_e) {}
            try { scene.buttons.freeSpinBtn.visible = shouldShowFsBtn; } catch (_e) {}
        } else {
            // Base game or overlay active → autoplay indicator only when autoplay is active
            try { scene.buttons.autoplayIndicator.visible = !!this.isAutoPlaying; } catch (_e) {}
            // Show/hide FS badge only when not in overlay
            try { scene.buttons.freeSpinBtn.visible = shouldShowFsBtn; } catch (_e) {}
            // During autoplay, keep FS button visible even if label not showing yet
            try {
                if (this.isAutoPlaying) {
                    scene.buttons.freeSpinBtn.visible = true;
                } else {
                    scene.buttons.freeSpinBtn.visible = shouldShowFsBtn;
                }
            } catch (_e) {}
            // Enforcement: when autoplay indicator is visible, ensure freeSpinBtn stays visible
            try { if (scene.buttons.autoplayIndicator?.visible) { scene.buttons.freeSpinBtn.visible = true; } } catch (_e) {}
        }

        // Update the display
        this.updateRemainingSpinsDisplay();
    }

    public updateRemainingSpinsDisplay(): void {
        if (!this.scene || !this.remainingSpinsText) return;

        // Choose what to display
        let displayText = '';
        if (this.isAutoPlaying) {
            // Autoplay: show remaining autoplay spins centered over the spin area
            displayText = `${Math.max(0, this.remainingSpins)}`;
            try {
                const spinContainer = this.scene.children.getByName('spinContainer') as GameObjects.Container;
                if (spinContainer && this.remainingSpinsText.parentContainer === spinContainer) {
                    this.remainingSpinsText.setPosition(0, 0);
                } else if (spinContainer) {
                    // Reparent to ensure correct layering under popup and align with spin button
                    spinContainer.add(this.remainingSpinsText);
                    this.remainingSpinsText.setPosition(0, 0);
                } else if (this.isMobile) {
                    this.remainingSpinsText.setPosition(this.scene.scale.width * 0.5, this.scene.scale.height * 0.86);
                } else {
                    this.remainingSpinsText.setPosition(this.scene.scale.width * 0.88, this.scene.scale.height * 0.443);
                }
            } catch (_e) {}
            // Maintain depth policy: keep below popup on mobile
            try { this.remainingSpinsText.setDepth(this.isMobile ? 10 : 1000); } catch (_e) {}
            // Adjust font size based on digits
            const len = displayText.length;
            if (len >= 3) {
                this.remainingSpinsText.setFontSize('48px');
            } else if (len === 2) {
                this.remainingSpinsText.setFontSize('64px');
            } else {
                this.remainingSpinsText.setFontSize('72px');
            }
        } else if (this.scene.gameData.isBonusRound) {
            // Bonus: keep the existing behavior of showing remaining free spins (desktop HUD)
            displayText = '';//'Spins Left: ' + this.scene.gameData.freeSpins;
            try {
                const spinContainer = this.scene.children.getByName('spinContainer') as GameObjects.Container;
                if (spinContainer && this.remainingSpinsText.parentContainer === spinContainer) {
                    this.remainingSpinsText.setPosition(0, 0);
                } else if (spinContainer) {
                    this.remainingSpinsText.setPosition(spinContainer.x, spinContainer.y);
                } else if (this.isMobile) {
                    this.remainingSpinsText.setPosition(this.scene.scale.width * 0.5, this.scene.scale.height * 0.86);
                } else {
                    this.remainingSpinsText.setPosition(this.scene.scale.width * 0.88, this.scene.scale.height * 0.443);
                }
            } catch (_e) {}
            const len = (this.scene.gameData.freeSpins ?? 0).toString().length;
            if (len >= 3) {
                this.remainingSpinsText.setFontSize('40px');
            } else if (len === 2) {
                this.remainingSpinsText.setFontSize('56px');
            } else {
                this.remainingSpinsText.setFontSize('72px');
            }
        } else {
            // Not autoplaying or in bonus; hide text if it exists
            this.remainingSpinsText.setText('');
            return;
        }

        this.remainingSpinsText.setText(displayText);
    }

    /**
     * Ensures the remaining spins HUD (text near the spin button) exists and is updated.
     * Useful for showing Free Spins count in desktop even when autoplay is not running.
     */
    public ensureRemainingSpinsDisplay(scene: GameScene): void {
        this.scene = scene;
        // Create the display if it does not exist yet
        if (!this.remainingSpinsText) {
            this.createRemainingSpinsDisplay(scene);
        }
        // Ensure correct button visibility for FS HUD (do not hide autoplayIndicator while overlay is active)
        const overlayActive = (scene as any)?.slotMachine?.activeWinOverlay === true;
        const bonusLabelShouldShow = scene.gameData.isBonusRound && (scene.gameData.freeSpins ?? 0) > 0 && !overlayActive;
        const shouldShowFsBtn = bonusLabelShouldShow || (!scene.gameData.isBonusRound && this.isAutoPlaying && this.remainingSpins > 0 && !overlayActive);
        if (shouldShowFsBtn) {
            try { scene.buttons.freeSpinBtn.visible = true; } catch (_e) {}
            try { scene.buttons.autoplayIndicator.visible = false; } catch (_e) {}
        }
        // Global enforcement: if autoplay indicator is visible, freeSpinBtn must be visible too
        try { if (scene.buttons.autoplayIndicator?.visible) { scene.buttons.freeSpinBtn.visible = true; } } catch (_e) {}
        // this.updateRemainingSpinsDisplay();
    }

    // Hide/destroy the remaining spins HUD (used when bonus ends on desktop)
    public hideRemainingSpinsDisplay(): void {
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
            this.remainingSpinsText = undefined;
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
            this.remainingSpinsBg = undefined;
        }
    }

    stop(): void {
        if (this.spinInterval) {
            clearTimeout(this.spinInterval);
            this.spinInterval = 0;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.spinScheduled = false;
        this.scene.buttons.resetAutoplayButtons();
        this.isAutoPlaying = false;
        this.remainingSpins = 0;
        // Restore button alphas on stop
        try {
            this.scene.buttons.spinButton.setAlpha(1);
            this.scene.buttons.freeSpinBtn.setAlpha(0);
            this.scene.buttons.autoplayIndicator.visible = false;
        } catch (_e) {}
        
        // Remove only our specific listener
        if (this.matchesDoneListener) {
            Events.emitter.off(Events.MATCHES_DONE, this.matchesDoneListener);
        }
		if (this.onSpinAnimationEnd) {
			Events.emitter.off(Events.SPIN_ANIMATION_END, this.onSpinAnimationEnd);
		}
		if (this.onWinOverlayShow) {
			Events.emitter.off(Events.WIN_OVERLAY_SHOW, this.onWinOverlayShow);
		}

        // Clear any manual lock if autoplay stopped
        try { (this.scene as any).gameData.freeSpinLockUntilMs = Math.min((this.scene as any).gameData.freeSpinLockUntilMs || 0, Date.now()); } catch (_e) {}
		if (this.onWinOverlayHide) {
			Events.emitter.off(Events.WIN_OVERLAY_HIDE, this.onWinOverlayHide);
		}
        
        // Remove both text and background
        if (this.remainingSpinsText) {
            this.remainingSpinsText.destroy();
            this.remainingSpinsText = undefined;
        }
        if (this.remainingSpinsBg) {
            this.remainingSpinsBg.destroy();
            this.remainingSpinsBg = undefined;
        }
        
        // Update button states after stopping autoplay
        if (this.scene && this.scene.buttons) {
            this.scene.buttons.updateButtonStates(this.scene);
        }
    }

    /**
     * Pause autoplay due to bonus/free spins trigger.
     * - Persists remaining base-game autoplay spins in GameData
     * - Stops the current autoplay loop without losing the saved count
     */
    public pauseForBonus(): void {
        if (!this.scene) return;
        try {
            // Save remaining base-game spins for resumption after bonus
            this.scene.gameData.autoplayRemainingSpins = Math.max(
                0,
                (this.scene.gameData.autoplayRemainingSpins || 0) + (this.remainingSpins || 0)
            );
            this.scene.gameData.autoplayWasPaused = this.scene.gameData.autoplayRemainingSpins > 0;
        } catch (_e) { /* no-op */ }
        // Pause timers and scheduling without clearing UI or counters
        if (this.spinInterval) {
            clearTimeout(this.spinInterval);
            this.spinInterval = 0 as any;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        this.spinScheduled = false;
        this.isAutoPlaying = false; // prevent any further spins
        // Keep remainingSpins and its text visible until FreeSpin overlay is closed
        if (this.scene && this.scene.buttons && this.scene.buttons.updateButtonStates) {
            this.scene.buttons.updateButtonStates(this.scene);
        }
    }

    private spin(): void {
        this.spinScheduled = false;
        // console.log("=== AUTOPLAY SPIN ATTEMPT ===");
        // console.log(`autoplay: ${this.isAutoPlaying}, bonus: ${this.scene.gameData.isBonusRound}, spins: ${this.remainingSpins}, free: ${this.scene.gameData.freeSpins}, isSpinning: ${this.scene.gameData.isSpinning}`);

        // Check if we should stop autoplay
        if (!this.isAutoPlaying || 
            (!this.scene.gameData.isBonusRound && this.remainingSpins <= 0) ||
            (this.scene.gameData.isBonusRound && this.scene.gameData.freeSpins <= 0)) {
            this.stop();
            // console.log("Autoplay stopped - no more spins"); 
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

		// Don't spin if already spinning or if there's an active win overlay
		if (this.scene.gameData.isSpinning || this.scene.slotMachine.activeWinOverlay) {
            // console.log("Skipping autoplay spin - game busy");
            // Retry after a short delay
            this.spinInterval = setTimeout(() => {
                this.spin();
            }, 500);
            return;
        }

        // For free spins, don't check balance
        if (!this.scene.gameData.isBonusRound) {
            // console.log("Regular autoplay spin");
            // Check if player has enough balance for the bet
            if (this.scene.gameData.balance < this.scene.gameData.bet) {
                this.stop();
                // console.log("Autoplay stopped - insufficient balance");
                Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
                return;
            }
            // Decrement remaining spins for regular play
            this.remainingSpins--;
            // Play generic UI animation on each decrement
            try { this.scene.buttons.playGenericUIAnimationOnce(); } catch (_e) {}
            // Update overlay count immediately after decrement
            this.updateRemainingSpinsDisplay();
        } else {
            // console.log("Free spin autoplay");
        }

		// Reset total win for new spin
        this.scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});

        // Ensure we have valid slot data
        if (!this.scene.gameData.slot?.values?.length) {
            // console.error('Invalid slot data in autoplay spin');
            this.stop();
            Events.emitter.emit(Events.AUTOPLAY_COMPLETE);
            return;
        }

        // console.log("Triggering autoplay spin via Events.SPIN");

		// Mark expectations for gating next autoplay spin
		this.awaitingSpinAnimationEnd = true;
		this.awaitingOverlayClose = false;
		// Trigger spin
        Events.emitter.emit(Events.SPIN, {
            currentRow: this.scene.gameData.currentRow,
            symbols: this.scene.gameData.slot.values
        });
        
        // console.log("Events.SPIN emitted successfully");

        // Update remaining spins display
        // this.updateRemainingSpinsDisplay();

        // If bonus was triggered during autoplay, maintain button/indicator states until overlay
        try {
            if (this.scene.gameData.isBonusRound) {
                this.scene.buttons.spinButton.setAlpha(0);
                this.scene.buttons.freeSpinBtn.setAlpha(1);
                this.scene.buttons.freeSpinBtn.visible = true;
                // Keep autoplay indicator reflecting active autoplay pre-overlay
                this.scene.buttons.autoplayIndicator.visible = true;
            }
        } catch (_e) {}
    }

	private scheduleSpinIfReady(): void {
		if (!this.isAutoPlaying) return;
		if (!this.scene) return;
		if (this.scene.gameData.isSpinning) return;
		if (this.scene.slotMachine.activeWinOverlay) return;
		if (this.awaitingSpinAnimationEnd) return;
		if (this.awaitingOverlayClose) return;
		if (this.spinInterval) {
			clearTimeout(this.spinInterval);
		}
		// console.log("All conditions met. Scheduling next autoplay spin");
		this.spinInterval = setTimeout(() => this.spin(), 50);
	}

    update(_scene: GameScene, _time: number, _delta: number): void {
        // Empty implementation - can be used for future animations or updates
    }
} 