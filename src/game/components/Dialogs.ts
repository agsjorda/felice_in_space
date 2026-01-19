import { Scene } from 'phaser';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { NumberDisplay, NumberDisplayConfig } from './NumberDisplay';
import { IrisTransition } from './IrisTransition';
import { SymbolExplosionTransition } from './SymbolExplosionTransition';
import { gameStateManager } from '../../managers/GameStateManager';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { SoundEffectType } from '../../managers/AudioManager';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export interface DialogConfig {
	type: 'Congrats_Dialog' | 'FreeSpin_Dialog' | 'BigWin_Dialog' | 'MegaWin_Dialog'  | 'EpicWin_Dialog' | 'SuperWin_Dialog';
	position?: { x: number; y: number };
	scale?: number;
	duration?: number;
	onComplete?: () => void;
	winAmount?: number; // Amount to display in the dialog
	freeSpins?: number; // Number of free spins won
	isRetrigger?: boolean; // For FreeSpin_Dialog: whether this is a retrigger case
	betAmount?: number; // Base bet amount for staged win animations
}

export class Dialogs {
	// Main dialog container that covers the entire screen
	private dialogOverlay: Phaser.GameObjects.Container;
	
	// Black background overlay
	private blackOverlay: Phaser.GameObjects.Graphics;
	
	// Dialog content container (the actual dialog animations)
	private dialogContentContainer: Phaser.GameObjects.Container;
	
	// Continue text
	private continueText: Phaser.GameObjects.Text | null = null;
	
	// Number display container
	private numberDisplayContainer: Phaser.GameObjects.Container | null = null;
	private numberDisplay: NumberDisplay | null = null;
	private numberTargetValue: number = 0;

	// Secondary number display for congrats dialog (e.g., free spins used)
	private congratsFreeSpinsContainer: Phaser.GameObjects.Container | null = null;
	private congratsFreeSpinsDisplay: NumberDisplay | null = null;
	
	// Click handler area
	private clickArea: Phaser.GameObjects.Rectangle | null = null;
	
	// Current dialog state
	private currentDialog: any = null; // Spine object type
	private isDialogActive: boolean = false;
	private currentDialogType: string | null = null;
	private isRetriggerFreeSpin: boolean = false; // Tracks if current FreeSpinDialog is a retrigger
	
	// Auto-close timer for win dialogs during autoplay
	private autoCloseTimer: Phaser.Time.TimerEvent | null = null;
	
	// Number display Y positions per dialog group (overrides). If null, default will be used.
	private numberYWin: number | null = 490;
	private numberYFreeSpin: number | null = null;
	private numberYCongrats: number | null = null;
	
	// Managers
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private currentScene: Scene | null = null;

	// Staged win animation state (Big -> Mega -> Epic -> Super with incremental number steps)
	private isStagedWinNumberAnimation: boolean = false;
	private stagedWinStages: Array<{ type: 'BigWin_Dialog' | 'MegaWin_Dialog' | 'EpicWin_Dialog' | 'SuperWin_Dialog'; target: number }> = [];
	private stagedWinCurrentStageIndex: number = 0;
	private stagedWinStageTimer: Phaser.Time.TimerEvent | null = null;
	
	// Iris transition for scatter animation
	private irisTransition: IrisTransition | null = null;
	// Symbol explosion transition for free spin dialog dismissal
	private candyTransition: SymbolExplosionTransition | null = null;

	// Dialog configuration
	private dialogScales: Record<string, number> = {
		'Congrats_Dialog': 0.32,
		'FreeSpin_Dialog': 0.32,
		'EpicWin_Dialog': 0.32,
		'MegaWin_Dialog':0.32,
		'BigWin_Dialog':0.32,
		'SuperWin_Dialog': 0.32
	};

	// Dialog positions (relative: 0.0 = left/top, 0.5 = center, 1.0 = right/bottom)
	private dialogPositions: Record<string, { x: number; y: number }> = {
		'Congrats_Dialog': { x: 0.48, y: 0.4 },
		'FreeSpin_Dialog': { x: 0.5, y: 0.4 },
		'EpicWin_Dialog': { x: 0.5, y: 0.43 },
		'MegaWin_Dialog': { x: 0.52, y: 0.4 },
		'BigWin_Dialog': { x: 0.5, y: 0.4 },
		'SuperWin_Dialog': { x: 0.5, y: 0.4 }
	};

	private dialogLoops: Record<string, boolean> = {
		'Congrats_Dialog': true,
		'FreeSpin_Dialog': true,
		'EpicWin_Dialog': true,
		'MegaWin_Dialog': true,
		'BigWin_Dialog': true,
		'SuperWin_Dialog': true
	};

	// Global toggle to disable intro animations for dialogs (win, free spin, congrats)
	// When true, dialogs will start directly in their idle loop.
	private disableIntroAnimations: boolean = true;

	// Remember the intended scale for the current dialog so we can tween from 0 -> target
	private lastDialogScale: number = 1;

	// Tracks whether we've already shown at least one win dialog. Used to fix an edge
	// case where the *first* win dialog could occasionally miss the scale "pop" tween.
	private hasShownAnyWinDialog: boolean = false;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	create(scene: Scene): void {
		// Store scene reference for later use
		this.currentScene = scene;
		
		// Initialize iris transition for scatter animation
		this.irisTransition = new IrisTransition(scene);
		// Initialize symbol explosion transition for free spin dialog dismissal
		this.candyTransition = new SymbolExplosionTransition(scene);
		
		// Create main dialog overlay container
		this.dialogOverlay = scene.add.container(0, 0);
		this.dialogOverlay.setDepth(1000); // Very high depth to cover everything
		this.dialogOverlay.setVisible(false); // Hidden by default
		
		// Create black overlay background first (lowest depth = behind everything)
		this.blackOverlay = scene.add.graphics();
		this.blackOverlay.fillStyle(0x000000, 0.7); // Black with 70% alpha
		this.blackOverlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		this.blackOverlay.setDepth(100); // Very low depth to be behind everything
		this.dialogOverlay.add(this.blackOverlay);
		
		// Create dialog content container (highest depth = in front of everything)
		this.dialogContentContainer = scene.add.container(0, 0);
		this.dialogContentContainer.setDepth(300); // Highest depth to be in front
		this.dialogOverlay.add(this.dialogContentContainer);
		
		console.log('[Dialogs] Dialog system created');
	}
	


	/**
	 * Show a dialog with the specified configuration
	 */
	public showDialog(scene: Scene, config: DialogConfig): void {
		// Reset staged win state for each new dialog
		this.isStagedWinNumberAnimation = false;
		this.stagedWinStages = [];
		this.stagedWinCurrentStageIndex = 0;

		if (this.isDialogActive) {
			this.hideDialog();
		}

		console.log(`[Dialogs] Showing dialog: ${config.type}`);
		
		// Track current dialog type for bonus mode detection
		this.currentDialogType = config.type;
		// Track retrigger state only for Free Spin dialog
		this.isRetriggerFreeSpin = (config.type === 'FreeSpin_Dialog') ? !!config.isRetrigger : false;
		
		// If this is a win dialog, mark global state so autoplay systems can wait
		try {
			if (this.isWinDialog()) {
				gameStateManager.isShowingWinDialog = true;
			}
		} catch {}
		
		// Debug dialog type detection
		console.log(`[Dialogs] Dialog type: ${config.type}, isWinDialog(): ${this.isWinDialog()}`);
		if (this.currentDialogType === 'FreeSpin_Dialog') {
			console.log('[Dialogs] FreeSpinDialog retrigger state:', this.isRetriggerFreeSpin);
		}
		
		// If congrats dialog is appearing, suppress the SlotController's spins-left display
		if (config.type === 'Congrats_Dialog') {
			try {
				const gameSceneAny = scene as any;
				const slotController = gameSceneAny?.slotController;
				if (slotController && typeof slotController.suppressFreeSpinDisplay === 'function') {
					slotController.suppressFreeSpinDisplay();
					console.log('[Dialogs] Congrats dialog shown - suppressing SlotController free spin display');
				}
			} catch {}
		}

		// If free spin dialog is appearing, clear any prior suppression to allow showing again
		if (config.type === 'FreeSpin_Dialog') {
			try {
				const gameSceneAny = scene as any;
				const slotController = gameSceneAny?.slotController;
				if (slotController && typeof slotController.clearFreeSpinDisplaySuppression === 'function') {
					slotController.clearFreeSpinDisplaySuppression();
					console.log('[Dialogs] FreeSpinDialog shown - cleared suppression for SlotController free spin display');
				}
			} catch {}
		}
		
		// Ensure dialog overlay is visible and reset alpha for new dialog
		this.dialogOverlay.setVisible(true);
		this.dialogOverlay.setAlpha(1);
		this.isDialogActive = true;
		
		console.log(`[Dialogs] Dialog overlay set to visible: ${this.dialogOverlay.visible}, alpha: ${this.dialogOverlay.alpha}`);
		
		// Always ensure black overlay is properly set up for new dialog
		console.log('[Dialogs] Setting up black overlay for dialog type:', config.type);
		console.log('[Dialogs] Black overlay current state:', {
			visible: this.blackOverlay.visible,
			alpha: this.blackOverlay.alpha,
			exists: !!this.blackOverlay
		});
		
		// Handle black overlay based on dialog type
		if (!this.isWinDialog()) {
			console.log('[Dialogs] Non-win dialog detected - setting up black overlay');
			
			// Ensure black overlay is visible and reset to transparent for fade-in
			this.blackOverlay.setVisible(true);
			this.blackOverlay.setAlpha(0);
			console.log('[Dialogs] Non-win dialog - black overlay will fade in');
			console.log('[Dialogs] Black overlay reset to visible=true, alpha=0 for fade-in');
		
			// Fade in the black overlay
			scene.tweens.add({
				targets: this.blackOverlay,
				alpha: 1,
				duration: 500,
				ease: 'Power2',
				onComplete: () => {
					console.log('[Dialogs] Black overlay fade-in complete');
				}
			});
		} else {
			console.log('[Dialogs] Win dialog - setting black overlay to semi-transparent background');
			// For win dialogs, ensure black overlay is visible and set to semi-transparent background
			this.blackOverlay.setVisible(true);
			this.blackOverlay.setAlpha(0.7); // Semi-transparent background
		}
		
		// Log final black overlay state for debugging
		console.log('[Dialogs] Final black overlay state:', {
			visible: this.blackOverlay.visible,
			alpha: this.blackOverlay.alpha,
			exists: !!this.blackOverlay
		});
		
		// Create the dialog content
		this.createDialogContent(scene, config);

		// Ensure the very first win dialog always gets the scale pop animation.
		// On some devices the initial tween applied during createDialogContent can
		// be skipped when the Win spine is created for the first time, so we force
		// a second pop once the dialog is fully initialized.
		if (!this.hasShownAnyWinDialog && this.isWinDialogType(config.type)) {
			this.hasShownAnyWinDialog = true;
			try {
				const sceneRef = scene;
				sceneRef.time.delayedCall(0, () => {
					if (!this.currentDialog || !this.isDialogActive) {
						return;
					}
					this.applyDialogScalePop(sceneRef);
				});
			} catch {}
		}

		// Notify the scene that a dialog has been shown (type included)
		try {
			scene.events.emit('dialogShown', this.currentDialogType);
		} catch {}

        // Play dialog-specific SFX (FreeSpin/ Congrats) when shown
		try {
			const audioManager = (window as any).audioManager;
			if (audioManager && typeof audioManager.playSoundEffect === 'function') {
				const type = (this.currentDialogType || '').toLowerCase();
                if (type === 'freespin_dialog') {
                    // Use freeSpinDialog_sfx for the FreeSpin dialog
                    audioManager.playSoundEffect(SoundEffectType.DIALOG_FREESPIN);
                    // Duck background music similar to win dialogs
                    if (typeof audioManager.duckBackground === 'function') {
                        audioManager.duckBackground(0.3);
                    }
                } else if (type === 'congrats_dialog') {
					audioManager.playSoundEffect(SoundEffectType.DIALOG_CONGRATS);
                    if (typeof audioManager.duckBackground === 'function') {
                        audioManager.duckBackground(0.3);
                    }
				}
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to play dialog SFX:', e);
		}
		
		// Fade dialog content in (scale pop is applied whenever idle starts)
		if (this.currentDialog) {
			this.currentDialog.setAlpha(0);

			// Adjust timing based on dialog type
			const contentDelay = this.isWinDialog() ? 0 : 200; // No delay for win dialogs
			
			scene.tweens.add({
				targets: this.currentDialog,
				alpha: 1,
				duration: 800,
				ease: 'Power2',
				delay: contentDelay,
				onComplete: () => {
					console.log('[Dialogs] Dialog content fade-in complete');
				}
			});
		}
		
		// Create number display(s) if win amount or free spins are provided
		if (config.winAmount !== undefined || config.freeSpins !== undefined) {
			if (config.type === 'Congrats_Dialog') {
				// Congrats dialog: primary total win only (spin count removed)
				if (config.winAmount !== undefined) {
					this.createNumberDisplay(scene, config.winAmount || 0, undefined);
				}
			} else {
				// Other dialogs: existing single number behavior
				this.createNumberDisplay(scene, config.winAmount || 0, config.freeSpins);

				// Configure staged win number animation (Big -> Mega -> Epic -> Super)
				if (config.winAmount !== undefined && config.betAmount !== undefined && this.isWinDialogType(config.type)) {
					this.setupStagedWinNumberAnimation(config);
				}
			}

			// Fade in number display(s) after a short delay (replacing paint effect trigger)
			scene.time.delayedCall(500, () => {
				console.log('[Dialogs] Fading in number display(s)');
				this.fadeInNumberDisplay(scene);
			});
		}

		// Play win dialog SFX at the correct time (after staged setup decides the first tier)
		try {
			if (this.isWinDialog()) {
				const audioManager = (window as any).audioManager;
				// Always duck background while a win dialog is visible
				if (audioManager && typeof audioManager.duckBackground === 'function') {
					audioManager.duckBackground(0.3);
				}
				// If we're doing staged tiers, let the staged runner trigger SFX per tier.
				// Otherwise, play the SFX for the current (single) dialog type now.
				if (!this.isStagedWinNumberAnimation && audioManager && typeof audioManager.playWinDialogSfx === 'function') {
					audioManager.playWinDialogSfx(this.currentDialogType);
				}
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to play win dialog SFX (post-setup):', e);
		}
		
		// Create continue text (delayed)
		this.createContinueText(scene);
		
		// Create click handler
		this.createClickHandler(scene);
		
		// Set up auto-close timer for win dialogs during autoplay
		this.setupAutoCloseTimer(scene);
	}

	/**
	 * Map dialog types to their spine keynames
	 */
	private getSpineKeynameForDialogType(dialogType: string): string {
		const keynameMap: Record<string, string> = {
			'BigWin_Dialog': 'BigW_FIS',
			'MegaWin_Dialog': 'MegaW_FIS',
			'EpicWin_Dialog': 'EpicW_FIS',
			'SuperWin_Dialog': 'SuperW_FIS',
			'Congrats_Dialog': 'Congrats_FIS',
			'FreeSpin_Dialog': 'FreeSpin_FIS'
		};
		
		return keynameMap[dialogType] || dialogType;
	}

	/**
	 * Get animation names for dialog type
	 * Based on actual animations in spine files: {spine-keyname}_Idle and {spine-keyname}_Idle2
	 */
	private getAnimationNameForDialogType(dialogType: string): { intro: string; idle: string; idleFallback: string; outro?: string } | null {
		const spineKeyname = this.getSpineKeynameForDialogType(dialogType);
		
		// Actual animations in spine files:
		// - {spine-keyname}_Idle2 (used as intro/transition)
		// - {spine-keyname}_Idle (used as idle/loop)
		return {
			intro: `${spineKeyname}_Idle2`,  // Idle2 is typically the intro/transition animation
			idle: `${spineKeyname}_Idle`,     // Idle is the looping animation
			idleFallback: `${spineKeyname}_Idle`, // Fallback to same as idle
			outro: undefined // No outro animations found in the spine files
		};
	}

	/**
	 * Try to set an animation with fallback options
	 */
	private trySetAnimation(animationState: any, trackIndex: number, primaryName: string, fallbackName: string, loop: boolean): boolean {
		try {
			animationState.setAnimation(trackIndex, primaryName, loop);
			return true;
		} catch (error) {
			try {
				console.log(`[Dialogs] Animation '${primaryName}' not found, trying fallback '${fallbackName}'`);
				animationState.setAnimation(trackIndex, fallbackName, loop);
				return true;
			} catch (fallbackError) {
				console.warn(`[Dialogs] Both animation names failed: '${primaryName}' and '${fallbackName}'`);
				return false;
			}
		}
	}

	/**
	 * Check if dialog type should use the shared Win.json asset (now returns false since we use separate assets)
	 */
	private shouldUseWinAsset(dialogType: string): boolean {
		// All dialogs now use separate spine assets, so this always returns false
		return false;
	}

	/**
	 * Create the main dialog content (FreeSpin_Dialog, EpicWin_Dialog, etc.)
	 */
	private createDialogContent(scene: Scene, config: DialogConfig): void {
		// Clean up existing dialog
		if (this.currentDialog) {
			this.currentDialog.destroy();
			this.currentDialog = null;
		}

		const position = config.position || this.getDialogPosition(config.type, scene);
		const scale = config.scale || this.getDialogScale(config.type);
		this.lastDialogScale = scale;
		
		// Create Spine animation for the dialog
		try {
			if (!ensureSpineFactory(scene, `[Dialogs] createDialogContent(${config.type})`)) {
				console.warn('[Dialogs] Spine factory not available; cannot create dialog spine:', config.type);
				return;
			}

			// Use dialog type as asset key (each dialog has its own separate spine asset)
			const assetKey = config.type;
			const atlasKey = `${config.type}-atlas`;
			
			console.log(`[Dialogs] Creating Spine animation for dialog: ${config.type}`);
			console.log(`[Dialogs] Using asset: ${assetKey}, atlas: ${atlasKey}`);
			
			this.currentDialog = (scene.add as any).spine?.(position.x, position.y, assetKey, atlasKey);
			if (!this.currentDialog) {
				console.warn('[Dialogs] add.spine returned null/undefined for dialog:', config.type);
				return;
			}
			this.currentDialog.setOrigin(0.5, 0.5);
			// Set the base scale *before* we trigger any pop tweens.
			// If we do this after applyDialogScalePop, it overrides the tween's
			// starting scale of 0 and the pop animation can appear to be skipped.
			this.currentDialog.setScale(scale);
			
			// Get animation names based on dialog type using spine keyname convention
			const shouldLoop = this.getDialogLoop(config.type);
			const animations = this.getAnimationNameForDialogType(config.type);
			
			if (animations) {
				try {
					if (this.disableIntroAnimations) {
						console.log(`[Dialogs] Intro disabled for dialog ${config.type}, starting idle with pop: ${animations.idle}`);
						// Try _idle first, fallback to _Idle
						if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
							console.error(`[Dialogs] Failed to set idle animation for ${config.type}`);
							return;
						}
						this.applyDialogScalePop(scene);
					} else {
						console.log(`[Dialogs] Playing intro animation: ${animations.intro}`);
						this.currentDialog.animationState.setAnimation(0, animations.intro, false);
						// Queue idle animation after intro - try _idle first, fallback to _Idle
						try {
							this.currentDialog.animationState.addAnimation(0, animations.idle, shouldLoop, 0);
						} catch {
							try {
								console.log(`[Dialogs] Animation '${animations.idle}' not found, trying fallback '${animations.idleFallback}'`);
								this.currentDialog.animationState.addAnimation(0, animations.idleFallback, shouldLoop, 0);
							} catch (fallbackError) {
								console.warn(`[Dialogs] Failed to queue idle animation for ${config.type}`);
							}
						}
						this.applyDialogScalePop(scene);
					}
				} catch (error) {
					console.log(`[Dialogs] Intro/idle animation failed, falling back to idle with pop: ${animations.idle}`);
					// Fallback to idle animation if something goes wrong - try both variants
					if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
						console.error(`[Dialogs] Failed to set fallback idle animation for ${config.type}`);
						return;
					}
					this.applyDialogScalePop(scene);
				}
			} else {
				console.error(`[Dialogs] No animation mapping found for dialog type: ${config.type}`);
				return;
			}
		} catch (error) {
			console.error(`[Dialogs] Error creating dialog content: ${config.type}`, error);
			console.error(`[Dialogs] This might be due to missing assets for ${config.type}`);
			return;
		}
		
		this.currentDialog.setDepth(101);
		
		// Add to dialog content container
		this.dialogContentContainer.add(this.currentDialog);
		
		console.log(`[Dialogs] Created dialog content: ${config.type}`);
	}

	/**
	 * Set up auto-close timer for win dialogs during autoplay or when scatter is hit
	 */
	private setupAutoCloseTimer(scene: Scene): void {
		// Clear any existing timer
		if (this.autoCloseTimer) {
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
		}
		
		// Set up auto-close for win dialogs during autoplay OR when scatter is hit
		console.log('[Dialogs] Auto-close timer setup check:', {
			isWinDialog: this.isWinDialog(),
			isAutoPlaying: gameStateManager.isAutoPlaying,
			isScatter: gameStateManager.isScatter,
			currentDialogType: this.currentDialogType
		});
		
		// Detect free spin autoplay (bonus autoplay) via Symbols component on the scene
		let isFreeSpinAutoplay = false;
		try {
			const gameScene: any = scene as any;
			const symbolsComponent = gameScene?.symbols;
			if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function') {
				isFreeSpinAutoplay = !!symbolsComponent.isFreeSpinAutoplayActive();
			}
		} catch {}

		// If a win dialog appears exactly when bonus spins are exhausted, we still need the
		// flow to continue reliably to the Congrats dialog. Relying on a manual click here
		// can deadlock the bonus end (stuck at 0 spins), so we auto-close with a slightly
		// longer dwell time than normal autoplay.
		const isEndOfBonusWinDialog = this.isWinDialog() && gameStateManager.isBonusFinished;
		if (isEndOfBonusWinDialog) {
			console.log('[Dialogs] End-of-bonus win dialog detected - will auto-close with extended dwell to allow congrats flow');
		}

		// Also auto-close FreeSpinDialog when it's a retrigger during bonus mode
		const isRetriggerFreeSpinDialog = (this.currentDialogType === 'FreeSpin_Dialog') && this.isRetriggerFreeSpin;
		const shouldAutoClose = (this.isWinDialog() && (gameStateManager.isAutoPlaying || isFreeSpinAutoplay || gameStateManager.isScatter))
			|| isEndOfBonusWinDialog
			|| isRetriggerFreeSpinDialog;
		
		if (shouldAutoClose) {
			const reason = isRetriggerFreeSpinDialog
				? 'retrigger'
				: (isEndOfBonusWinDialog ? 'end-of-bonus' : (gameStateManager.isAutoPlaying || isFreeSpinAutoplay ? 'autoplay' : 'scatter hit'));
			// Base auto-close delay (ms). Previously ~2.5s. Extend by +1s when autoplaying (normal or free spin).
			let baseDelayMs = 2500;

			// End-of-bonus: give the win dialog a little extra dwell, then proceed to Congrats automatically.
			if (isEndOfBonusWinDialog) {
				baseDelayMs = 3500;
			}

			// If we're running a staged win sequence (Big -> Mega -> Epic -> Super),
			// align the auto-close timing with the per-stage dwell timing used in
			// startStagedWinNumberSequence so that the FINAL tier gets a full dwell
			// window as well, instead of closing early.
			//
			// Each stage starts every ~3s (perStageDwellMs), so we want the overall
			// auto-close delay to be: stages * perStageDwellMs. That way, the time
			// between the last stage starting and the dialog auto-closing is also
			// ~perStageDwellMs, matching the earlier tiers.
			if (this.isStagedWinNumberAnimation && this.stagedWinStages.length > 1) {
				const perStageDwellMs = 2950; // Keep in sync with runStagedWinStage
				// Give the final staged win tier extra dwell time before auto-close.
				baseDelayMs = perStageDwellMs * this.stagedWinStages.length + 3000;
			}

			const extraAutoplayDelayMs = 0;
			// For retrigger FreeSpinDialog, use the same timing as win dialogs in autoplay for consistency
			const delayMs = (reason === 'autoplay' || reason === 'retrigger') ? (baseDelayMs + extraAutoplayDelayMs) : baseDelayMs;
			console.log(`[Dialogs] Setting up auto-close timer during ${reason} (${Math.round(delayMs/2000)} seconds)`);
			console.log(`[Dialogs] Dialog will automatically close in ${Math.round(delayMs/2000)} seconds due to ${reason}`);
			
			this.autoCloseTimer = scene.time.delayedCall(delayMs, () => {
				console.log(`[Dialogs] Auto-close timer triggered during ${reason} - closing dialog`);
				// Auto-close should immediately close the dialog rather than advancing
				// staged tiers one by one, so pass fromAutoClose = true.
				this.handleDialogClick(scene, true);
			});
		} else {
			console.log('[Dialogs] No auto-close timer needed:', {
				isWinDialog: this.isWinDialog(),
				isAutoPlaying: gameStateManager.isAutoPlaying || isFreeSpinAutoplay,
				isScatter: gameStateManager.isScatter
			});
		}
	}


	/**
	 * Create the "Press anywhere to continue" text
	 */
	private createContinueText(scene: Scene): void {
		console.log('[Dialogs] Creating continue text for dialog type:', this.currentDialogType);
		
		// Clean up existing text
		if (this.continueText) {
			this.continueText.destroy();
			this.continueText = null;
		}
		
		// Create the text with your original styling
		this.continueText = scene.add.text(
			scene.scale.width / 2,
			scene.scale.height / 2 + 300,
			'Press anywhere to continue',
			{
				fontFamily: 'Poppins-Bold',
				fontSize: '20px',
				color: '#FFFFFF',
				stroke: '#379557',
				strokeThickness: 5,
				shadow: {
					offsetX: 2,
					offsetY: 2,
					color: '#000000',
					blur: 4,
					fill: true
				}
			}
		);
		
		this.continueText.setOrigin(0.5, 0.5);
		this.continueText.setDepth(104);
		this.continueText.setAlpha(0); // Start invisible
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.continueText);
		
		// Fade in the text after 1.5 seconds (reduced from 4.5 seconds)
		scene.tweens.add({
			targets: this.continueText,
			alpha: 1,
			duration: 500,
			delay: 1500,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Dialogs] Continue text fade-in complete');
			}
		});
		
		console.log('[Dialogs] Created continue text with original styling');
	}

	/**
	 * Create number display for win amounts
	 */
	private createNumberDisplay(scene: Scene, winAmount: number, freeSpins?: number): void {
		// Clean up existing number display
		if (this.numberDisplayContainer) {
			this.numberDisplayContainer.destroy();
			this.numberDisplayContainer = null;
		}
		
		// Determine if this is the Congrats dialog showing a total win amount
		const isCongratsTotalWin = this.currentDialogType === 'Congrats_Dialog' && freeSpins === undefined;

		// Create number display configuration
		const numberConfig: NumberDisplayConfig = {
			x: scene.scale.width / 2,
			y: this.getNumberDisplayY(scene, this.currentDialogType) - 18,
			scale: 0.65,
			spacing: 0,
			alignment: 'center',
			decimalPlaces: freeSpins !== undefined ? 0 : 2, // No decimals for free spins
			showCommas: freeSpins !== undefined ? false : true, // No commas for free spins
			// For Congrats dialog totals, show a dollar sign prefix.
			// Other dialogs remain unchanged.
			prefix: isCongratsTotalWin ? '$ ' : '',
			suffix: '', // No suffix - only display numbers
			commaYOffset: 12,
			dotYOffset: 10
		};

		// Create the number display (primary win amount / free spins, depending on dialog)
		const numberDisplay = new NumberDisplay(this.networkManager, this.screenModeManager, numberConfig);
		numberDisplay.create(scene);
		// Display free spins if provided, otherwise display win amount
		const displayValue = freeSpins !== undefined ? freeSpins : winAmount;
		// Start from 0 (or current) and animate on fade-in
		numberDisplay.displayValue(0);
		this.numberDisplay = numberDisplay;
		this.numberTargetValue = displayValue;

		// Create container for number display
		this.numberDisplayContainer = scene.add.container(0, 0);
		this.numberDisplayContainer.setDepth(103);
		this.numberDisplayContainer.add(numberDisplay.getContainer());
		
		// Start with alpha 0 (invisible) - will be faded in after delay
		this.numberDisplayContainer.setAlpha(0);
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.numberDisplayContainer);
		
		console.log('[Dialogs] Created number display');
	}

	/**
	 * Create secondary number display for congrats dialog (free spins used)
	 */
	private createCongratsFreeSpinsDisplay(scene: Scene, freeSpins: number): void {
		// Clean up existing secondary display
		if (this.congratsFreeSpinsContainer) {
			this.congratsFreeSpinsContainer.destroy();
			this.congratsFreeSpinsContainer = null;
		}

		// Only applicable to Congrats dialog
		if (this.currentDialogType !== 'Congrats_Dialog') {
			return;
		}

		const numberConfig: NumberDisplayConfig = {
			x: scene.scale.width / 2 - 50,
			// Place slightly below the main total win display
			y: this.getNumberDisplayY(scene, this.currentDialogType) + 70,
			scale: 0.3,
			spacing: 0,
			alignment: 'center',
			decimalPlaces: 0,
			showCommas: false,
			prefix: '',
			suffix: '',
			commaYOffset: 12,
			dotYOffset: 10
		};

		const fsDisplay = new NumberDisplay(this.networkManager, this.screenModeManager, numberConfig);
		fsDisplay.create(scene);
		fsDisplay.displayValue(freeSpins);

		this.congratsFreeSpinsDisplay = fsDisplay;

		this.congratsFreeSpinsContainer = scene.add.container(0, 0);
		this.congratsFreeSpinsContainer.setDepth(103);
		this.congratsFreeSpinsContainer.add(fsDisplay.getContainer());

		// Start hidden; will be revealed alongside primary number
		this.congratsFreeSpinsContainer.setAlpha(0);
		this.dialogOverlay.add(this.congratsFreeSpinsContainer);

		console.log('[Dialogs] Created congrats free spins display:', freeSpins);
	}
	
	/**
	 * Compute number display Y based on dialog type with per-group overrides.
	 */
	private getNumberDisplayY(scene: Scene, dialogType: string | null): number {
		const defaultY = scene.scale.height / 2 - 50;
		if (!dialogType) return defaultY;
		
		if (dialogType === 'FreeSpin_Dialog') {
			// Add offset to move free spin number display down a bit
			const freeSpinY = this.numberYFreeSpin ?? (defaultY + 30);
			return freeSpinY;
		}
		
		if (dialogType === 'Congrats_Dialog') {
			// Move number display downward for congrats dialog
			return this.numberYCongrats ?? (defaultY + 40);
		}
		
		if (this.isWinDialogType(dialogType)) {
			return this.numberYWin ?? defaultY;
		}
		
		return defaultY;
	}
	
	/**
	 * Helper: determine if a type is one of the win dialogs.
	 */
	private isWinDialogType(type: string): boolean {
		return type === 'BigWin_Dialog' || type === 'MegaWin_Dialog' || type === 'EpicWin_Dialog' || type === 'SuperWin_Dialog';
	}
	
	/**
	 * Public setters to configure number display Y positions per group at runtime.
	 */
	setNumberDisplayYForWin(y: number): void { this.numberYWin = y; }
	setNumberDisplayYForFreeSpin(y: number): void { this.numberYFreeSpin = y; }
	setNumberDisplayYForCongrats(y: number): void { this.numberYCongrats = y; }
	setNumberDisplayYPositions(opts: { win?: number; freeSpin?: number; congrats?: number }): void {
		if (opts.win !== undefined) this.numberYWin = opts.win;
		if (opts.freeSpin !== undefined) this.numberYFreeSpin = opts.freeSpin;
		if (opts.congrats !== undefined) this.numberYCongrats = opts.congrats;
	}
	
	/**
	 * Fade in the number display with animation
	 */
	private fadeInNumberDisplay(scene: Scene): void {
		console.log('[Dialogs] fadeInNumberDisplay called');
		
		if (this.numberDisplayContainer) {
			console.log('[Dialogs] Popping in primary number display');
			
			// Make container visible immediately (no fade)
			this.numberDisplayContainer.setAlpha(1);
			
			// Pop the inner number container so position remains anchored
			const inner = this.numberDisplay?.getContainer();
			if (inner) {
				inner.setScale(0);
				
				// Start counting up as the pop begins
				if (this.isStagedWinNumberAnimation && this.stagedWinStages.length > 0) {
					this.startStagedWinNumberSequence(scene);
				} else if (this.numberDisplay) {
					this.numberDisplay.animateToValue(this.numberTargetValue, {
						duration: 1500,
						ease: 'Power2',
						startFromCurrent: false
					});
				}
				
				scene.tweens.add({
					targets: inner,
					scale: 1.08,
					duration: 400,
					ease: 'Back.Out',
					onComplete: () => {
						scene.tweens.add({
							targets: inner,
							scale: 1.0,
							duration: 180,
							ease: 'Power2',
							onComplete: () => {
								console.log('[Dialogs] Primary number display pop-in complete');
							}
						});
					}
				});
			} else {
				console.warn('[Dialogs] No inner primary number container found for pop animation');
			}
		} else {
			console.error('[Dialogs] numberDisplayContainer is null, cannot fade in');
		}

		// If a secondary congrats free spins display exists, pop it in too (no counting animation)
		if (this.congratsFreeSpinsContainer && this.congratsFreeSpinsDisplay) {
			console.log('[Dialogs] Popping in congrats free spins display');
			this.congratsFreeSpinsContainer.setAlpha(1);
			const innerFs = this.congratsFreeSpinsDisplay.getContainer();
			if (innerFs) {
				innerFs.setScale(0);
				scene.tweens.add({
					targets: innerFs,
					scale: 1.0,
					duration: 350,
					ease: 'Back.Out'
				});
			}
		}
	}

	/**
	 * Handle dialog click event.
	 *
	 * fromAutoClose:
	 *  - false: user clicked "press anywhere to continue"
	 *  - true:  internal auto-close timer fired (autoplay / scatter / retrigger)
	 */
	private handleDialogClick(scene: Scene, fromAutoClose: boolean = false): void {
		console.log('[Dialogs] Dialog clicked, starting fade-out sequence. fromAutoClose =', fromAutoClose);
		
		// Clear auto-close timer if it exists (prevents double-triggering)
		if (this.autoCloseTimer) {
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
			console.log('[Dialogs] Auto-close timer cleared due to manual/auto close');
		}

		// When a staged win sequence is running (Big -> Mega -> Epic -> Super),
		// a MANUAL click should behave like "skip to next win animation":
		//  - Stop the current staged tier
		//  - Immediately jump to the next tier's animation (if any)
		//  - Start the number display from the previous tier's threshold (we use
		//    startFromCurrent in the NumberDisplay to preserve continuity)
		//
		// If there is NO next staged tier, we fall through to the normal
		// "close dialog" behavior so the win dialog ends.
		if (!fromAutoClose && this.isWinDialog() && this.stagedWinStages.length > 0) {
			const lastIndex = this.stagedWinStages.length - 1;
			const nextIndex = Math.min(this.stagedWinCurrentStageIndex + 1, lastIndex);
			const hasNextStage = nextIndex > this.stagedWinCurrentStageIndex;
			
			if (hasNextStage) {
				console.log('[Dialogs] Manual click during staged win - skipping to next staged tier index:', nextIndex);
				this.skipToStagedWinStage(scene, nextIndex);
				// Do NOT close the dialog here; the player now sees the next tier.
				return;
			}

			console.log('[Dialogs] Manual click during staged win - already at final tier, closing dialog normally');
		}
		
		// Start the fade-out sequence first (while isDialogActive is still true)
		this.startFadeOutSequence(scene);
		
		// Apply the same reset logic that happens when a new spin is triggered,
		// but ONLY for win dialogs. For non-win dialogs (e.g. FreeSpin / Congrats),
		// we must preserve the win queue so that any deferred win dialogs (such as
		// those queued during scatter + autoplay) can still be processed once the
		// non-win dialog finishes.
		if (this.isWinDialog()) {
			this.resetGameStateForNewSpin(scene);
		}
		
		// Note: WIN_DIALOG_CLOSED event will be emitted when fade-out completes
		// This prevents double emission of the event
	}

	/**
	 * Immediately disable all win dialog elements when clicked
	 */
	private disableAllWinDialogElements(): void {
		console.log('[Dialogs] Disabling all win dialog elements immediately');
		
		// Disable click area to prevent multiple clicks
		if (this.clickArea) {
			this.clickArea.disableInteractive();
			console.log('[Dialogs] Click area disabled');
		}
		
		// Hide black overlay immediately
		if (this.blackOverlay) {
			this.blackOverlay.setVisible(false);
			this.blackOverlay.setAlpha(0);
			console.log('[Dialogs] Black overlay hidden and alpha set to 0');
		}
		
		// Hide current dialog immediately
		if (this.currentDialog) {
			this.currentDialog.setVisible(false);
			this.currentDialog.setAlpha(0);
			console.log('[Dialogs] Current dialog hidden and alpha set to 0');
			
			// Stop Spine animation if it exists
			if (this.currentDialog.animationState) {
				this.currentDialog.animationState.clearTracks();
				console.log('[Dialogs] Current dialog Spine animation cleared');
			}
		}
		
		// Hide continue text immediately
		if (this.continueText) {
			this.continueText.setVisible(false);
			console.log('[Dialogs] Continue text hidden');
		}
		
		// Hide number display immediately
		if (this.numberDisplayContainer) {
			this.numberDisplayContainer.setVisible(false);
			console.log('[Dialogs] Number display hidden');
		}

		// Hide secondary congrats free spins display immediately
		if (this.congratsFreeSpinsContainer) {
			this.congratsFreeSpinsContainer.setVisible(false);
			console.log('[Dialogs] Congrats free spins display hidden');
		}
		
		// Hide the entire dialog overlay container
		if (this.dialogOverlay) {
			this.dialogOverlay.setVisible(false);
			this.dialogOverlay.setAlpha(0);
			console.log('[Dialogs] Dialog overlay container hidden and alpha set to 0');
		}
		
		// Set dialog as inactive immediately
		this.isDialogActive = false;
		console.log('[Dialogs] Dialog marked as inactive');
		
		console.log('[Dialogs] All win dialog elements disabled successfully');
	}

	/**
	 * Reset game state for new spin (same logic as when spin is triggered)
	 */
	private resetGameStateForNewSpin(scene: Scene): void {
		console.log('[Dialogs] Resetting game state for new spin (manual dialog close)');
		
		// Get the Game scene to access its methods
		const gameScene = scene as any; // Cast to access Game scene methods
		
		// Clear win queue if the method exists
		if (gameScene.clearWinQueue && typeof gameScene.clearWinQueue === 'function') {
			gameScene.clearWinQueue();
			console.log('[Dialogs] Cleared win queue for manual dialog close');
		}
		
		// Reset win dialog state
		gameStateManager.isShowingWinDialog = false;
		console.log('[Dialogs] Reset isShowingWinDialog to false for manual dialog close');
		
		// Reset winlines tracking if the property exists
		if (gameScene.hasWinlinesThisSpin !== undefined) {
			gameScene.hasWinlinesThisSpin = false;
			console.log('[Dialogs] Reset hasWinlinesThisSpin to false for manual dialog close');
		}
		
		// Reset win line drawer interrupted flag if symbols exist
		if (gameScene.symbols && gameScene.symbols.winLineDrawer && 
			gameScene.symbols.winLineDrawer.resetInterruptedFlag) {
			gameScene.symbols.winLineDrawer.resetInterruptedFlag();
			console.log('[Dialogs] Reset win line drawer interrupted flag for manual dialog close');
		}
		
		// NOTE: Do NOT call ensureCleanSymbolState() here as it immediately clears winning symbols
		// The winning symbols should remain visible until the next spin starts
		// The actual symbol reset will happen when the next spin is triggered
		console.log('[Dialogs] Preserving winning symbols visibility until next spin starts');
		
		console.log('[Dialogs] Game state reset complete for manual dialog close');
	}

	/**
	 * Create the click handler for the dialog
	 */
	private createClickHandler(scene: Scene): void {
		// Create a clickable area that covers the entire dialog
		this.clickArea = scene.add.rectangle(
			scene.cameras.main.centerX,
			scene.cameras.main.centerY,
			scene.cameras.main.width,
			scene.cameras.main.height,
			0x000000,
			0
		);
		
		this.clickArea.setOrigin(0.5);
		this.clickArea.setDepth(105);
		this.clickArea.setInteractive();
		
		// Add to dialog overlay
		this.dialogOverlay.add(this.clickArea);
		
		// For win dialogs, enable clicking after continue text appears (1.5s delay)
		// For free spin dialogs, delay clicking to allow animations to complete
		if (this.isWinDialog()) {
			console.log('[Dialogs] Win dialog - enabling clicking after 1.5s delay for continue text visibility');
			// Delay to ensure continue text appears before allowing clicks
			scene.time.delayedCall(1500, () => {
				if (this.clickArea) {
					this.clickArea.on('pointerdown', () => {
						this.handleDialogClick(scene);
					});
					console.log('[Dialogs] Click handler enabled for win dialog');
				}
			});
		} else {
			console.log('[Dialogs] Free spin dialog - delaying click enablement for 2.2 seconds');
			// Delay for free spin dialogs to allow animations to complete
		scene.time.delayedCall(2200, () => {
				if (this.clickArea) {
					this.clickArea.on('pointerdown', () => {
						console.log('[Dialogs] Free spin dialog clicked!');
						this.handleDialogClick(scene);
					});
					console.log('[Dialogs] Click handler enabled for free spin dialog');
				}
			});
		}
		
		console.log('[Dialogs] Click handler created for dialog');
	}


	/**
	 * Start the centralized transition when dialog is clicked
	 */
	private startFadeOutSequence(scene: Scene): void {
		console.log('[Dialogs] startFadeOutSequence called, isDialogActive:', this.isDialogActive, 'currentDialogType:', this.currentDialogType);
		
		if (!this.isDialogActive) {
			console.log('[Dialogs] Dialog not active, skipping fade-out sequence');
			return;
		}
		
		// Check if this is a win dialog - handle differently than free spin dialog
		if (this.isWinDialog()) {
			console.log('[Dialogs] Win dialog clicked - starting direct fade-out sequence');
			// Disable dialog elements for win dialogs
			this.disableAllWinDialogElements();
			this.startWinDialogFadeOut(scene);
			return;
		}
		
		// Check if this is a free spin dialog - use candy transition
		if (this.currentDialogType === 'FreeSpin_Dialog') {
			// Stop looping the free spin dialog background sound
			try {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.stopLoopingFreeSpinDialogSfx === 'function') {
					audioManager.stopLoopingFreeSpinDialogSfx();
					console.log('[Dialogs] Stopped looping free spin dialog SFX');
				}
			} catch (e) {
				console.warn('[Dialogs] Failed to stop looping free spin dialog SFX:', e);
			}
			
			// On retrigger, skip candy transition, use normal transition to avoid extra animation
			if (this.isRetriggerFreeSpin) {
				console.log('[Dialogs] Free spin dialog (retrigger) clicked - skipping all transitions and disabling immediately');
				// Immediately disable/hide everything similar to win dialog handling
				this.disableAllWinDialogElements();
				// Fully cleanup dialog elements
				this.cleanupDialog();
				// Clear scatter state BEFORE dialog completion so that any queued
				// win dialogs from the retrigger spin are not indefinitely deferred
				// by the "scatter + autoplay" check inside Game.checkAndShowWinDialog.
				try {
					gameStateManager.isScatter = false;
					console.log('[Dialogs] Retrigger FreeSpinDialog - cleared isScatter before dialogAnimationsComplete');
				} catch {}
				// Re-enable symbols immediately (match win dialog behavior)
				try {
					scene.events.emit('enableSymbols');
				} catch {}
				// Notify listeners that dialog animations are complete so retrigger flow can continue
				try {
					scene.events.emit('dialogAnimationsComplete');
				} catch {}
				// Restore background music volume if it was ducked
				try {
					const audioManager = (window as any).audioManager;
					if (audioManager && typeof audioManager.restoreBackground === 'function') {
						audioManager.restoreBackground();
					}
				} catch {}
				return;
			}
			console.log('[Dialogs] Free spin dialog clicked - starting candy transition');
			// Don't disable dialog elements yet for free spin dialogs - let candy transition handle it
			this.startCandyTransition(scene);
			return;
		}
		
		// Use normal transition for other dialogs
		console.log('[Dialogs] Other dialog type - starting normal transition');
		// Disable dialog elements for other dialogs
		this.disableAllWinDialogElements();
		this.startNormalTransition(scene);
	}

	/**
	 * Check if the current dialog is a win dialog
	 */
	private isWinDialog(): boolean {
		return this.currentDialogType === 'BigWin_Dialog' || 
			   this.currentDialogType === 'MegaWin_Dialog' || 
			   this.currentDialogType === 'EpicWin_Dialog' || 
			   this.currentDialogType === 'SuperWin_Dialog';
	}
	
	/**
	 * Start candy transition for free spin dialog
	 */
	private startCandyTransition(scene: Scene): void {
		if (!this.candyTransition) {
			console.warn('[Dialogs] Candy transition not available, falling back to normal transition');
			this.startNormalTransition(scene);
			return;
		}

		console.log('[Dialogs] Starting candy transition for free spin dialog');

		// Disable spinner immediately when transition starts
		scene.events.emit('disableSpinner');

		// Start transition animation
		this.candyTransition.show();

		// Hide dialog content and switch to bonus visuals after a short delay,
		// giving the symbol explosion time to cover the screen first.
		scene.time.delayedCall(900, () => {
			try {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.fadeOutSfx === 'function') {
					audioManager.fadeOutSfx(SoundEffectType.DIALOG_CONGRATS, 400);
				}
			} catch (e) {
				console.warn('[Dialogs] Failed to fade out congrats dialog SFX:', e);
			}
			this.disableAllWinDialogElements();
			this.cleanupDialog();
			
			// Apply bonus mode visuals once the dialog is closed, slightly after
			// the explosion has covered the screen for a smoother transition
			this.triggerBonusMode(scene);
		});

		// Attempt to restrict explosion symbols to those currently visible on the grid
		let allowedSymbols: number[] | undefined;
		try {
			const gameSceneAny: any = scene as any;
			const symbolsComponent = gameSceneAny?.symbols;
			const grid: any = symbolsComponent?.currentSymbolData;
			if (Array.isArray(grid)) {
				const set = new Set<number>();
				for (const col of grid) {
					if (!Array.isArray(col)) continue;
					for (const val of col) {
						const num = Number(val);
						if (!isNaN(num)) {
							set.add(num);
						}
					}
				}
				if (set.size > 0) {
					allowedSymbols = Array.from(set);
				}
			}
		} catch {
			// If anything goes wrong, simply fall back to all available symbols.
		}

		this.candyTransition.play(() => {
			// Emit dialog animations complete event after transition
			scene.events.emit('dialogAnimationsComplete');

			// Restore background music volume
			try {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.restoreBackground === 'function') {
					audioManager.restoreBackground();
				}
			} catch {}
		}, { allowedSymbols });
	}

	/**
	 * Start iris transition for free spin dialog
	 */
	private startIrisTransition(scene: Scene): void {
		if (!this.irisTransition) {
			console.warn('[Dialogs] Iris transition not available, falling back to normal transition');
			this.startNormalTransition(scene);
			return;
		}
		
		console.log('[Dialogs] Starting iris transition for free spin dialog');
		
		// Store the dialog type before cleanup for bonus mode check
		const dialogTypeBeforeCleanup = this.currentDialogType;
		
		// Disable spinner immediately when iris transition starts
		scene.events.emit('disableSpinner');
		console.log('[Dialogs] Spinner disabled during iris transition');
		
		// Show iris transition overlay
		this.irisTransition.show();
		
		// Start iris transition - zoom in to small radius (closing iris effect)
		this.irisTransition.zoomInToRadius(28, 1500); // Fast transition to 28px radius
		
		// Hide dialog content quickly after iris starts closing (200ms delay)
		scene.time.delayedCall(200, () => {
			console.log('[Dialogs] Hiding dialog content quickly for better iris visibility');
			// Fade out FreeSpin dialog SFX if playing
			try {
				const audioManager = (window as any).audioManager;
				if (audioManager && typeof audioManager.fadeOutSfx === 'function') {
					audioManager.fadeOutSfx(SoundEffectType.DIALOG_CONGRATS, 400);
				}
			} catch (e) {
				console.warn('[Dialogs] Failed to fade out congrats dialog SFX:', e);
			}
			// Disable dialog elements before cleanup
			this.disableAllWinDialogElements();
			this.cleanupDialog();
		});
		
		// Wait for iris transition to complete, then proceed
		scene.time.delayedCall(1500, () => {
			console.log('[Dialogs] Iris closed - triggering bonus mode');
			
			// Trigger bonus mode during closed iris
			console.log('[Dialogs] Triggering bonus mode during closed iris');
			this.triggerBonusMode(scene);
			
			// Wait 0.5 seconds, then open iris (zoom out) - faster for better flow
			scene.time.delayedCall(500, () => {
				console.log('[Dialogs] Opening iris transition');
				this.irisTransition!.zoomInToRadius(1000, 1500); // Open iris to full size
				
				// Clean up after iris opens
				scene.time.delayedCall(1500, () => {
					console.log('[Dialogs] Iris transition complete');
					// Hide the iris transition overlay
					this.irisTransition!.hide();
					
					// Emit dialog animations complete event AFTER the full iris transition completes
					scene.events.emit('dialogAnimationsComplete');
					console.log('[Dialogs] Dialog animations complete event emitted after full iris transition');
					// Restore background music volume after dialog completes
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				});
			});
		});
	}
	
	/**
	 * Start normal black screen transition for non-free spin dialogs
	 */
	private startNormalTransition(scene: Scene): void {
		console.log('[Dialogs] Starting normal black screen transition');
		
		
		// Store the dialog type before cleanup for bonus mode check
		const dialogTypeBeforeCleanup = this.currentDialogType;
		
		// Create centralized black screen overlay
		const blackScreen = scene.add.graphics();
		blackScreen.setDepth(10000); // Very high depth to cover everything
		blackScreen.fillStyle(0x000000, 1);
		blackScreen.fillRect(0, 0, scene.scale.width, scene.scale.height);
		blackScreen.setAlpha(0); // Start transparent
		
		// Disable spinner immediately when black screen starts fading in
		scene.events.emit('disableSpinner');
		console.log('[Dialogs] Spinner disabled during transition');
		
		// Fade in black screen
		scene.tweens.add({
			targets: blackScreen,
			alpha: 1,
			duration: 300,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Dialogs] Black screen fade-in complete');
				
				// Hide dialog immediately while screen is black
				this.cleanupDialog();

				// Check if we need to trigger bonus mode while screen is black
				if (dialogTypeBeforeCleanup === 'FreeSpin_Dialog') {
					console.log('[Dialogs] Triggering bonus mode during black screen');
					this.triggerBonusMode(scene);

					// If this FreeSpinDialog was a retrigger, remove black screen immediately
					// so that the next win dialog can appear without delay
					if (this.isRetriggerFreeSpin) {
						console.log('[Dialogs] Retrigger FreeSpinDialog - removing black screen immediately for successive win dialog');
						try {
							const audioManager = (window as any).audioManager;
							if (audioManager && typeof audioManager.restoreBackground === 'function') {
								audioManager.restoreBackground();
							}
						} catch {}
						blackScreen.destroy();
						console.log('[Dialogs] Black screen removed immediately for retrigger flow');
						return;
					}
				} else {
					// If congrats closed while in bonus mode, revert to base visuals and reset symbols
					if (dialogTypeBeforeCleanup === 'Congrats_Dialog') {
						console.log('[Dialogs] Congrats dialog closed - reverting from bonus visuals to base');
						// Switch off bonus mode visuals and music
						scene.events.emit('setBonusMode', false);
						scene.events.emit('hideBonusBackground');
						scene.events.emit('hideBonusHeader');
						// Reset symbols/winlines state for base game
						scene.events.emit('resetSymbolsForBase');

						// Ensure win sequence finalization when starting normal transition
					try {
						gameEventManager.emit(GameEventType.WIN_STOP);
						console.log('[Dialogs] Emitted WIN_STOP at start of normal transition');
					} catch {}

					}
					// Re-enable symbols after transition completes (normal flow)
					scene.events.emit('enableSymbols');
					console.log('[Dialogs] Symbols re-enabled after transition');
				}
				
					// Emit dialog animations complete event for scatter bonus reset
					scene.events.emit('dialogAnimationsComplete');
				console.log('[Dialogs] Dialog animations complete event emitted');
					// Restore background music volume after dialog completes
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				
				// Wait 0.7 seconds, then fade out
				scene.time.delayedCall(700, () => {
					scene.tweens.add({
						targets: blackScreen,
						alpha: 0,
						duration: 300,
						ease: 'Power2',
						onComplete: () => {
							// Clean up black screen
							blackScreen.destroy();
							
							// Ensure UI is back to normal only when congrats dialog closes
							if (dialogTypeBeforeCleanup === 'Congrats_Dialog') {
								console.log('[Dialogs] Black screen faded out after congrats - restoring normal background and header');
								scene.events.emit('hideBonusBackground');
								scene.events.emit('hideBonusHeader');
							}
							
							console.log('[Dialogs] Black screen transition complete');
						}
					});
				});
			}
		});
	}

	/**
	 * Start direct fade-out sequence for win dialogs (no black overlay)
	 */
	private startWinDialogFadeOut(scene: Scene): void {
		console.log('[Dialogs] Starting win dialog direct fade-out');

		// Check if we should play outro animation before fading out
		const animations = this.currentDialogType ? this.getAnimationNameForDialogType(this.currentDialogType) : null;
		const hasOutro = animations && animations.outro;
		
		if (hasOutro && this.currentDialog && this.currentDialog.animationState) {
			console.log(`[Dialogs] Playing outro animation: ${animations.outro}`);
			try {
				// Play outro animation, then fade out after it completes
				this.currentDialog.animationState.setAnimation(0, animations.outro!, false);
				
				// Get animation duration (estimate 1 second if we can't get it)
				const outroTrack = this.currentDialog.animationState.getCurrent(0);
				const outroDuration = outroTrack?.animation?.duration ? outroTrack.animation.duration * 1000 : 0;
				
				// Wait for outro to complete, then start fade-out
				scene.time.delayedCall(outroDuration, () => {
					this.performWinDialogFadeOut(scene);
				});
				return; // Exit early, fade-out will happen after outro
			} catch (error) {
				console.warn(`[Dialogs] Failed to play outro animation, proceeding with fade-out:`, error);
				// Fall through to normal fade-out
			}
		}
		
		// No outro or outro failed, proceed with normal fade-out
		this.performWinDialogFadeOut(scene);
	}

	/**
	 * Perform the actual fade-out sequence for win dialogs
	 */
	private performWinDialogFadeOut(scene: Scene): void {
		// Fade out any currently playing win SFX
		try {
			const audioManager = (window as any).audioManager;
			if (audioManager && typeof audioManager.fadeOutCurrentWinSfx === 'function') {
				audioManager.fadeOutCurrentWinSfx(450);
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to fade out win dialog SFX:', e);
		}
		
		// Keep the black overlay visible as background - don't hide it
		// The black overlay provides the dialog background for readability
		console.log('[Dialogs] Keeping black overlay visible as background for win dialog fade-out');
		
		// Re-enable symbols immediately for win dialays
		scene.events.emit('enableSymbols');
		console.log('[Dialogs] Symbols re-enabled for win dialog');
		
		// Collect all elements that need to fade out
		const fadeOutTargets: any[] = [];
		
		// Don't fade out the dialog overlay container - only fade out its contents
		// This prevents conflicts between container and child element fade-outs
		
		// Add black overlay if visible
		if (this.blackOverlay && this.blackOverlay.visible) {
			fadeOutTargets.push(this.blackOverlay);
			console.log('[Dialogs] Adding black overlay to fade-out targets');
		}
		
		// Add current dialog if it exists
		if (this.currentDialog) {
			// Don't add Spine animation to main fade-out targets - we'll control it manually
			// fadeOutTargets.push(this.currentDialog);
			console.log('[Dialogs] Current dialog found - will be controlled manually during fade-out');
			
			// Debug Spine animation properties
			if (this.currentDialog.animationState) {
				console.log('[Dialogs] Current dialog is Spine animation');
				console.log('[Dialogs] Current dialog alpha before fade-out:', this.currentDialog.alpha);
				console.log('[Dialogs] Current dialog visible:', this.currentDialog.visible);
				console.log('[Dialogs] Current dialog active animations:', this.currentDialog.animationState.getCurrent(0)?.animation?.name);
				console.log('[Dialogs] Current dialog type:', typeof this.currentDialog);
				console.log('[Dialogs] Current dialog has alpha property:', 'alpha' in this.currentDialog);
				console.log('[Dialogs] Current dialog alpha property type:', typeof this.currentDialog.alpha);
			}
		}
		
		// Add number display if it exists
		if (this.numberDisplayContainer) {
			fadeOutTargets.push(this.numberDisplayContainer);
			console.log('[Dialogs] Adding number display to fade-out targets');
		}
		
		// Add continue text if it exists
		if (this.continueText) {
			fadeOutTargets.push(this.continueText);
			console.log('[Dialogs] Adding continue text to fade-out targets');
		}
		
		console.log(`[Dialogs] Total fade-out targets: ${fadeOutTargets.length}`);
		
		// Fade out all elements together
		scene.tweens.add({
			targets: fadeOutTargets,
			alpha: 0,
			duration: 500,
			ease: 'Power2',
			onStart: () => {
				console.log('[Dialogs] Win dialog fade-out animation started');
				console.log('[Dialogs] Fade-out targets:', fadeOutTargets);
				
				// Log the current alpha values of all targets
				fadeOutTargets.forEach((target, index) => {
					if (target && typeof target.alpha === 'number') {
						console.log(`[Dialogs] Target ${index} alpha before fade-out:`, target.alpha);
					}
				});
				
				// Specifically check the Spine animation
				if (this.currentDialog && this.currentDialog.animationState) {
					console.log('[Dialogs] Spine animation alpha at fade-out start:', this.currentDialog.alpha);
					console.log('[Dialogs] Spine animation visible at fade-out start:', this.currentDialog.visible);
				}
			},
			onUpdate: (tween) => {
				// Log progress every 100ms
				const progress = Math.floor(tween.progress * 100);
				if (progress % 20 === 0) { // Log every 20%
					console.log(`[Dialogs] Fade-out progress: ${progress}%`);
					
					// Check Spine animation during fade-out
					if (this.currentDialog && this.currentDialog.animationState) {
						console.log(`[Dialogs] Spine animation alpha at ${progress}%:`, this.currentDialog.alpha);
					}
				}
				
				// Manually control Spine animation alpha during fade-out
				if (this.currentDialog && this.currentDialog.animationState) {
					const targetAlpha = 1 - tween.progress; // Calculate target alpha based on progress
					this.currentDialog.setAlpha(targetAlpha);
					console.log(`[Dialogs] Manual Spine alpha update: ${targetAlpha.toFixed(2)}`);
				}
			},
			onComplete: () => {
				console.log('[Dialogs] Win dialog fade-out complete');
				
				// Log final alpha values
				fadeOutTargets.forEach((target, index) => {
					if (target && typeof target.alpha === 'number') {
						console.log(`[Dialogs] Target ${index} alpha after fade-out:`, target.alpha);
					}
				});
				
				// Check Spine animation after fade-out
				if (this.currentDialog && this.currentDialog.animationState) {
					console.log('[Dialogs] Spine animation alpha after fade-out:', this.currentDialog.alpha);
					console.log('[Dialogs] Spine animation visible after fade-out:', this.currentDialog.visible);
				}
				
				// Wait a moment to ensure fade-out is completely visible before cleanup
				scene.time.delayedCall(100, () => {
					console.log('[Dialogs] Starting cleanup after fade-out completion');
					
					// Clean up dialog content after fade-out
					this.cleanupDialogContent();
					
					// Now perform the actual cleanup of destroyed elements
					this.performDialogCleanup();
					console.log('[Dialogs] Dialog elements cleaned up after fade-out');
					
					// Reset alpha to 1 for next dialog
					this.dialogOverlay.setAlpha(1);
					
					// Ensure black overlay is completely hidden after win dialog closes
					if (this.blackOverlay) {
						this.blackOverlay.setVisible(false);
						this.blackOverlay.setAlpha(0);
						console.log('[Dialogs] Black overlay completely hidden after win dialog fade-out');
					}
					
					// Emit dialog animations complete event
					scene.events.emit('dialogAnimationsComplete');
					console.log('[Dialogs] Win dialog animations complete event emitted');
					
					// Emit win dialog closed event for autoplay
					gameEventManager.emit(GameEventType.WIN_DIALOG_CLOSED);
					console.log('[Dialogs] WIN_DIALOG_CLOSED event emitted after fade-out');
					// Restore background music volume
					try {
						const audioManager = (window as any).audioManager;
						if (audioManager && typeof audioManager.restoreBackground === 'function') {
							audioManager.restoreBackground();
						}
					} catch {}
				});
			}
		});
		
		// Remove the separate Spine tween to avoid timing conflicts
		// The main tween should handle all elements including the Spine animation
	}

	/**
	 * Clean up dialog content without hiding the overlay (for win dialogs)
	 */
	private cleanupDialogContent(): void {
		console.log('[Dialogs] Cleaning up dialog content (keeping overlay visible)');
		
		// Don't hide the dialog overlay - keep it visible for next dialog
		// this.dialogOverlay.setVisible(false);
		// Don't set isDialogActive to false yet - keep it true until cleanup is complete
		// this.isDialogActive = false;
		
		// Reset current dialog type
		this.currentDialogType = null;

		// Reset staged win state
		this.isStagedWinNumberAnimation = false;
		if (this.stagedWinStageTimer) {
			(this.stagedWinStageTimer as Phaser.Time.TimerEvent).destroy();
			this.stagedWinStageTimer = null;
		}
		this.stagedWinStages = [];
		this.stagedWinCurrentStageIndex = 0;
		
		// Don't call performDialogCleanup here - it destroys elements that are still fading out
		// Instead, just reset the state and let the fade-out animation complete naturally
		// The actual cleanup will happen after the fade-out completes
		
		// Don't hide the black overlay when win dialog closes - let the next dialog handle it
		// This ensures that if a free spin dialog appears next, it will have the black overlay available
		console.log('[Dialogs] Keeping black overlay visible for potential next dialog');
		
		console.log('[Dialogs] Dialog content cleanup complete (overlay remains visible)');
	}

	/**
	 * Check if we should trigger bonus mode based on current dialog type
	 */
	private shouldTriggerBonusMode(): boolean {
		return this.currentDialogType === 'FreeSpin_Dialog';
	}

	/**
	 * Trigger bonus mode by enabling bonus background and header
	 */
	private triggerBonusMode(scene: Scene): void {
		console.log('[Dialogs] ===== TRIGGERING BONUS MODE TRANSITION =====');
		console.log('[Dialogs] Scene exists:', !!scene);
		console.log('[Dialogs] Scene events exists:', !!scene.events);
		
		// Set bonus mode in backend data
		scene.events.emit('setBonusMode', true);
		console.log('[Dialogs] Emitted setBonusMode event');
		
		// Clear scatter state so win dialogs are not deferred or auto-closed after retrigger
		try {
			gameStateManager.isScatter = false;
			console.log('[Dialogs] Cleared isScatter state on bonus mode trigger');
		} catch {}
		
		// Switch to bonus background
		scene.events.emit('showBonusBackground');
		console.log('[Dialogs] Emitted showBonusBackground event');
		
		// Switch to bonus header
		scene.events.emit('showBonusHeader');
		console.log('[Dialogs] Emitted showBonusHeader event');
		
		// Re-enable symbols after bonus mode setup
		scene.events.emit('enableSymbols');
		console.log('[Dialogs] Emitted enableSymbols event');
		
		console.log('[Dialogs] ===== BONUS MODE ACTIVATED - BACKGROUND AND HEADER SWITCHED =====');
	}

	/**
	 * Clean up dialog without any transition effects
	 */
	private cleanupDialog(): void {
		if (!this.isDialogActive) return;
		
		console.log('[Dialogs] Cleaning up dialog');
		
		// Hide the dialog overlay
		this.dialogOverlay.setVisible(false);
		this.isDialogActive = false;
		
		// Reset current dialog type
		this.currentDialogType = null;

		// Reset staged win state
		this.isStagedWinNumberAnimation = false;
		if (this.stagedWinStageTimer) {
			(this.stagedWinStageTimer as Phaser.Time.TimerEvent).destroy();
			this.stagedWinStageTimer = null;
		}
		this.stagedWinStages = [];
		this.stagedWinCurrentStageIndex = 0;
		
		// Clean up all dialog elements
		this.performDialogCleanup();
		
		console.log('[Dialogs] Dialog cleanup complete');
	}

	/**
	 * Perform the actual cleanup of dialog elements
	 */
	private performDialogCleanup(): void {
		console.log('[Dialogs] Starting dialog cleanup');
		
		// Clean up current dialog
		if (this.currentDialog) {
			console.log('[Dialogs] Destroying current dialog');
			this.currentDialog.destroy();
			this.currentDialog = null;
		}
		
		// Clean up continue text
		if (this.continueText) {
			console.log('[Dialogs] Destroying continue text');
			this.continueText.destroy();
			this.continueText = null;
		}
		
		// Clean up number display
		if (this.numberDisplayContainer) {
			console.log('[Dialogs] Destroying number display');
			this.numberDisplayContainer.destroy();
			this.numberDisplayContainer = null;
		}
		
		// Clean up click area
		if (this.clickArea) {
			console.log('[Dialogs] Destroying click area');
			// Properly disable interactivity before destroying
			if (this.clickArea.input && this.clickArea.input.enabled) {
				this.clickArea.disableInteractive();
			}
			this.clickArea.destroy();
			this.clickArea = null;
		}
		
		// Clean up congrats secondary free spins display if present
		if (this.congratsFreeSpinsContainer) {
			console.log('[Dialogs] Destroying congrats free spins display');
			this.congratsFreeSpinsContainer.destroy();
			this.congratsFreeSpinsContainer = null;
			this.congratsFreeSpinsDisplay = null;
		}

		// Clear auto-close timer if it exists
		if (this.autoCloseTimer) {
			console.log('[Dialogs] Destroying auto-close timer during cleanup');
			this.autoCloseTimer.destroy();
			this.autoCloseTimer = null;
		}
		
		// Now that all elements are destroyed, set dialog as inactive
		this.isDialogActive = false;
		console.log('[Dialogs] Dialog cleanup complete - isDialogActive set to false');
	}

	/**
	 * Hide the dialog with a simple black overlay transition
	 */
	hideDialog(): void {
		if (!this.isDialogActive) return;
		
		console.log('[Dialogs] Hiding dialog with black overlay transition');
		
		if (this.currentScene) {
			// Create a black overlay for transition
			const transitionOverlay = this.currentScene.add.graphics();
			transitionOverlay.setDepth(10000); // Very high depth to cover everything
			transitionOverlay.fillStyle(0x000000, 1);
			transitionOverlay.fillRect(0, 0, this.currentScene.scale.width, this.currentScene.scale.height);
			transitionOverlay.setAlpha(0); // Start transparent
			
			// Fade in black overlay over 0.75 seconds
			this.currentScene.tweens.add({
				targets: transitionOverlay,
				alpha: 1,
				duration: 750,
				ease: 'Power2',
				onComplete: () => {
					console.log('[Dialogs] Transition overlay fade-in complete');
					
					// Hide dialog immediately while screen is black
					this.dialogOverlay.setVisible(false);
					this.isDialogActive = false;
					
					// Fade out black overlay over 0.75 seconds
					this.currentScene!.tweens.add({
						targets: transitionOverlay,
						alpha: 0,
						duration: 750,
						ease: 'Power2',
						onComplete: () => {
							// Clean up transition overlay
							transitionOverlay.destroy();
							console.log('[Dialogs] Black overlay transition complete, dialog hidden');
						}
					});
				}
			});
		} else {
			// Fallback if no scene reference
			this.dialogOverlay.setVisible(false);
			this.isDialogActive = false;
		}
		
		// Perform cleanup after transition
		this.performDialogCleanup();
		
		console.log('[Dialogs] Dialog hidden and cleaned up');
	}

	/**
	 * Check if dialog is currently showing
	 */
	isDialogShowing(): boolean {
		return this.isDialogActive;
	}

	/**
	 * Get the current dialog type
	 */
	getCurrentDialogType(): string | null {
		return this.currentDialog ? this.currentDialog.texture.key : null;
	}

	/**
	 * Resize the dialog overlay when screen size changes
	 */
	resize(scene: Scene): void {
		// Update stored scene reference
		this.currentScene = scene;
		
		if (this.blackOverlay) {
			this.blackOverlay.clear();
			this.blackOverlay.fillStyle(0x000000, 0.7);
			this.blackOverlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
		}
	}

	/**
	 * Get the dialog overlay container
	 */
	getContainer(): Phaser.GameObjects.Container {
		return this.dialogOverlay;
	}

	/**
	 * Destroy the dialog system
	 */
	destroy(): void {
		this.hideDialog();
		if (this.dialogOverlay) {
			this.dialogOverlay.destroy();
		}
	}

	/**
	 * Configure staged win number and animation thresholds based on bet and total win.
	 * Example (bet=0.20, win=0.60, final type=SuperWin_Dialog):
	 *  - BigWin_Dialog (BigWin)   -> 0.16 (0.8x)
	 *  - MegaWin_Dialog (MegaWin) -> 0.20 (1x)
	 *  - EpicWin_Dialog (EpicWin)  -> 0.40 (2x)
	 *  - SuperWin_Dialog (SuperWin) -> 0.60 (final win)
	 */
	private setupStagedWinNumberAnimation(config: DialogConfig): void {
		const winAmount = config.winAmount ?? 0;
		const betAmount = config.betAmount ?? 0;

		if (winAmount <= 0 || betAmount <= 0) {
			console.log('[Dialogs] Staged win: invalid bet/win, skipping staged animation');
			this.isStagedWinNumberAnimation = false;
			this.stagedWinStages = [];
			this.stagedWinCurrentStageIndex = 0;
			this.numberTargetValue = winAmount;
			return;
		}

		// Order of tiers and their multiplier thresholds
		const orderedTypes: Array<'BigWin_Dialog' | 'MegaWin_Dialog' | 'EpicWin_Dialog' | 'SuperWin_Dialog'> = [
			'BigWin_Dialog',
			'MegaWin_Dialog',
			'EpicWin_Dialog',
			'SuperWin_Dialog'
		];
		const thresholds = [20, 30, 45, 60]; // multipliers relative to bet

		const finalIndex = orderedTypes.indexOf(config.type as any);
		if (finalIndex <= 0) {
			// Only apply staged behavior when final tier is at least Medium (MegaWin) or higher
			console.log('[Dialogs] Staged win: final tier is BigWin_Dialog or unknown - using simple animation');
			this.isStagedWinNumberAnimation = false;
			this.stagedWinStages = [];
			this.stagedWinCurrentStageIndex = 0;
			this.numberTargetValue = winAmount;
			return;
		}

		let stages: Array<{ type: 'BigWin_Dialog' | 'MegaWin_Dialog' | 'EpicWin_Dialog' | 'SuperWin_Dialog'; target: number }> = [];
		let lastTarget = 0;

		// Add intermediate tiers (below the final tier) only at their threshold values,
		// but only if the win actually reaches those thresholds.
		for (let i = 0; i < finalIndex && i < thresholds.length; i++) {
			const type = orderedTypes[i];
			const multiplier = thresholds[i];
			const thresholdValue = betAmount * multiplier;

			if (winAmount >= thresholdValue && thresholdValue > lastTarget) {
				stages.push({ type, target: thresholdValue });
				lastTarget = thresholdValue;
			}
		}

		// Always add exactly one stage for the final tier, targeting the actual win amount.
		// This prevents showing the same tier twice (once at its threshold and once at the final win).
		stages.push({ type: config.type as any, target: winAmount });
		lastTarget = winAmount;

		// If we ended up with only a single stage (no intermediate thresholds crossed),
		// just use the normal single-number animation on the final tier.
		if (stages.length <= 1) {
			console.log('[Dialogs] Staged win: no stages produced, falling back to simple animation');
			this.isStagedWinNumberAnimation = false;
			this.stagedWinStages = [];
			this.stagedWinCurrentStageIndex = 0;
			this.numberTargetValue = winAmount;
			return;
		}

		this.isStagedWinNumberAnimation = true;
		this.stagedWinStages = stages;
		this.stagedWinCurrentStageIndex = 0;
		// For staged animation, the numberTargetValue is only used as a fallback.
		this.numberTargetValue = winAmount;

		console.log('[Dialogs] Staged win configured. Stages:', stages);

		// Ensure the visual sequence starts from the first tier (e.g. BigWin),
		// not from the final tier that was passed into showDialog.
		// Since each dialog type now has its own separate spine file, we need to
		// recreate the spine object for the first stage to use the correct asset.
		try {
			const firstStage = this.stagedWinStages[0];
			this.currentDialogType = firstStage.type;

			if (this.currentDialog && this.currentScene) {
				if (!ensureSpineFactory(this.currentScene, `[Dialogs] setupStagedWinNumberAnimation(${firstStage.type})`)) {
					console.warn('[Dialogs] Spine factory not available; cannot recreate staged win first stage spine:', firstStage.type);
					return;
				}

				// Get scale from the existing dialog before destroying it
				const currentScale = this.currentDialog.scaleX;
				// Get the correct position for this dialog type (don't preserve old position)
				const position = this.getDialogPosition(firstStage.type, this.currentScene);
				
				// Destroy the old spine object (which was created with the final dialog type)
				this.currentDialog.destroy();
				this.currentDialog = null;
				
				// Create new spine object with the correct asset for the first stage
				const assetKey = firstStage.type;
				const atlasKey = `${firstStage.type}-atlas`;
				
				console.log(`[Dialogs] Staged win: recreating spine for first stage (${firstStage.type})`);
				console.log(`[Dialogs] Using asset: ${assetKey}, atlas: ${atlasKey}`);
				
				this.currentDialog = (this.currentScene.add as any).spine?.(position.x, position.y, assetKey, atlasKey);
				if (!this.currentDialog) {
					console.warn('[Dialogs] add.spine returned null/undefined recreating staged win first stage:', firstStage.type);
					return;
				}
				this.currentDialog.setOrigin(0.5, 0.5);
				this.currentDialog.setScale(currentScale);
				
				// Add to dialog content container if it exists
				if (this.dialogContentContainer) {
					this.dialogContentContainer.add(this.currentDialog);
				}
				
				// Play the correct animation for the first stage
				const animations = this.getAnimationNameForDialogType(firstStage.type);
				if (animations && this.currentDialog.animationState) {
					const shouldLoop = this.getDialogLoop(firstStage.type);
					console.log('[Dialogs] Staged win: playing spine animation for first stage', animations);
					try {
						if (this.disableIntroAnimations) {
							// Try _idle first, fallback to _Idle
							if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
								console.warn('[Dialogs] Staged win: failed to set idle animation for first stage');
							}
						} else {
							this.currentDialog.animationState.setAnimation(0, animations.intro, false);
							// Queue idle animation - try _idle first, fallback to _Idle
							try {
								this.currentDialog.animationState.addAnimation(0, animations.idle, shouldLoop, 0);
							} catch {
								try {
									this.currentDialog.animationState.addAnimation(0, animations.idleFallback, shouldLoop, 0);
								} catch {
									console.warn('[Dialogs] Staged win: failed to queue idle animation for first stage');
								}
							}
						}
						// Apply scale pop whenever we transition into idle
						this.applyDialogScalePop(this.currentScene);
					} catch (err) {
						console.warn('[Dialogs] Staged win: intro/idle animation failed for first stage, using idle only', err);
						// Try _idle first, fallback to _Idle
						if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
							console.warn('[Dialogs] Staged win: failed to set fallback idle animation for first stage');
						}
						this.applyDialogScalePop(this.currentScene);
					}
				}
			}
		} catch (e) {
			console.warn('[Dialogs] Staged win: failed to initialize first stage animation sequence', e);
		}
	}

	/**
	 * Run staged win number sequence and switch spine animations per stage.
	 */
	private startStagedWinNumberSequence(scene: Scene): void {
		if (!this.numberDisplay || !this.currentDialog) {
			console.warn('[Dialogs] Cannot start staged win sequence - missing numberDisplay or currentDialog');
			this.isStagedWinNumberAnimation = false;
			return;
		}

		// Clear any previous staged win timer before starting
		if (this.stagedWinStageTimer) {
			(this.stagedWinStageTimer as Phaser.Time.TimerEvent).destroy();
			this.stagedWinStageTimer = null;
		}

		this.runStagedWinStage(scene, 0, false);
	}

	/**
	 * Execute a single staged win tier and schedule the next one if applicable.
	 * When fastFromSkip is true, we use a shorter number animation for manual skips.
	 */
	private runStagedWinStage(scene: Scene, index: number, fastFromSkip: boolean): void {
		// Abort if staged sequencing has been disabled (e.g., user manually
		// closed the dialog).
		if (!this.isStagedWinNumberAnimation) {
			console.log('[Dialogs] Staged win: staging disabled, aborting stage run');
			return;
		}

		// Abort if dialog has been deactivated (e.g., user clicked to close)
		if (!this.isDialogActive) {
			console.log('[Dialogs] Staged win: dialog inactive, aborting stage run');
			this.isStagedWinNumberAnimation = false;
			return;
		}

		if (!this.numberDisplay || !this.currentDialog) {
			console.warn('[Dialogs] Staged win: display or dialog missing during stage run');
			this.isStagedWinNumberAnimation = false;
			return;
		}

		if (index >= this.stagedWinStages.length) {
			console.log('[Dialogs] Staged win: all stages complete');
			this.isStagedWinNumberAnimation = false;
			return;
		}

		this.stagedWinCurrentStageIndex = index;
		const stage = this.stagedWinStages[index];

		console.log('[Dialogs] Staged win: running stage', {
			index,
			type: stage.type,
			target: stage.target,
			fastFromSkip
		});

		// Play correct audio for the current tier and fade out any previous tier SFX
		try {
			if (!this.isDialogActive) {
				console.log('[Dialogs] Staged win: dialog inactive before SFX, skipping audio');
				this.isStagedWinNumberAnimation = false;
				return;
			}
			const audioManager = (window as any).audioManager;
			if (audioManager) {
				if (typeof audioManager.fadeOutCurrentWinSfx === 'function') {
					audioManager.fadeOutCurrentWinSfx(200);
				}
				if (typeof audioManager.playWinDialogSfx === 'function') {
					audioManager.playWinDialogSfx(stage.type);
				}
				if (typeof audioManager.duckBackground === 'function') {
					audioManager.duckBackground(0.3);
				}
			}
		} catch (e) {
			console.warn('[Dialogs] Failed to trigger staged tier SFX:', e);
		}

		// Switch the spine asset and animation to match the current tier.
		// Since each dialog type now has its own separate spine file, we need to recreate
		// the spine object for each stage instead of just switching animations.
		// For the first stage, the animation was already initialized in setupStagedWinNumberAnimation,
		// so avoid resetting it here to prevent the "first tier plays twice" effect.
		if (index > 0 || fastFromSkip) {
			try {
				// Get scale from the existing dialog before destroying it
				const currentScale = this.currentDialog.scaleX;
				// Get the correct position for this dialog type (don't preserve old position)
				const sceneRef = this.currentScene || scene;
				if (!ensureSpineFactory(sceneRef, `[Dialogs] runStagedWinStage(${index}:${stage.type})`)) {
					console.warn('[Dialogs] Spine factory not available; cannot recreate staged win spine for stage', index, stage.type);
					return;
				}
				const position = this.getDialogPosition(stage.type, sceneRef);
				
				// Destroy the old spine object
				if (this.currentDialog) {
					this.currentDialog.destroy();
					this.currentDialog = null;
				}
				
				// Create new spine object with the correct asset for this stage
				const assetKey = stage.type;
				const atlasKey = `${stage.type}-atlas`;
				
				console.log(`[Dialogs] Staged win: recreating spine for stage ${index} (${stage.type})`);
				console.log(`[Dialogs] Using asset: ${assetKey}, atlas: ${atlasKey}`);
				
				this.currentDialog = (sceneRef.add as any).spine?.(position.x, position.y, assetKey, atlasKey);
				if (!this.currentDialog) {
					console.warn('[Dialogs] add.spine returned null/undefined recreating staged win stage:', index, stage.type);
					return;
				}
				this.currentDialog.setOrigin(0.5, 0.5);
				this.currentDialog.setScale(currentScale);
				
				// Add to dialog content container if it exists
				if (this.dialogContentContainer) {
					this.dialogContentContainer.add(this.currentDialog);
				}
				
				// Play the correct animation for this stage
				const animations = this.getAnimationNameForDialogType(stage.type);
				if (animations && this.currentDialog.animationState) {
					const shouldLoop = this.getDialogLoop(stage.type);
					console.log('[Dialogs] Staged win: playing spine animation for stage', animations);
					try {
						if (this.disableIntroAnimations) {
							// Try _idle first, fallback to _Idle
							if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
								console.warn('[Dialogs] Staged win: failed to set idle animation for stage', stage.type);
							}
						} else {
							this.currentDialog.animationState.setAnimation(0, animations.intro, false);
							// Queue idle animation - try _idle first, fallback to _Idle
							try {
								this.currentDialog.animationState.addAnimation(0, animations.idle, shouldLoop, 0);
							} catch {
								try {
									this.currentDialog.animationState.addAnimation(0, animations.idleFallback, shouldLoop, 0);
								} catch {
									console.warn('[Dialogs] Staged win: failed to queue idle animation for stage', stage.type);
								}
							}
						}
						// Apply scale pop whenever we transition into idle
						if (sceneRef) {
							this.applyDialogScalePop(sceneRef);
						}
					} catch (err) {
						console.warn('[Dialogs] Staged win: intro/idle animation failed, using idle only', err);
						// Try _idle first, fallback to _Idle
						if (!this.trySetAnimation(this.currentDialog.animationState, 0, animations.idle, animations.idleFallback, shouldLoop)) {
							console.warn('[Dialogs] Staged win: failed to set fallback idle animation for stage', stage.type);
						}
						if (sceneRef) {
							this.applyDialogScalePop(sceneRef);
						}
					}
				}
			} catch (e) {
				console.warn('[Dialogs] Staged win: failed to recreate spine for stage', stage.type, e);
			}
		}

		// Animate the number to this stage target
		const isFirstStage = index === 0;
		const defaultDurationMs = 2500; // time for the counter animation
		const fastDurationMs = 2500; // shorter animation when skipping
		const numberAnimDurationMs = fastFromSkip ? fastDurationMs : defaultDurationMs;
		const perStageDwellMs = 2950; // approximate dwell time per tier (matches original auto-close)

		this.numberDisplay!.animateToValue(stage.target, {
			duration: numberAnimDurationMs,
			ease: 'Power2',
			startFromCurrent: !isFirstStage || fastFromSkip
		});

		const lastIndex = this.stagedWinStages.length - 1;

		// Schedule next stage after the per-stage dwell time so that, visually,
		// each tier behaves like its own win dialog before the next one appears.
		if (index + 1 < this.stagedWinStages.length) {
			// Cancel any previous stage timer before scheduling the next one
			const timer = this.stagedWinStageTimer;
			if (timer) {
				timer.destroy();
				this.stagedWinStageTimer = null;
			}

			this.stagedWinStageTimer = scene.time.delayedCall(perStageDwellMs, () => {
				// Guard again in case dialog was closed during the dwell
				if (!this.isDialogActive || !this.isStagedWinNumberAnimation) {
					console.log('[Dialogs] Staged win: dialog inactive during dwell, stopping sequence');
					this.isStagedWinNumberAnimation = false;
					this.stagedWinStageTimer = null;
					return;
				}
				this.stagedWinStageTimer = null;
				this.runStagedWinStage(scene, index + 1, false);
			});
		} else {
			console.log('[Dialogs] Staged win: last stage scheduled, will end at full win amount');

			// When we reach the final stage, clear any existing auto-close timer and create
			// a new one with the correct timing to ensure the final stage has enough time to display.
			try {
				if (this.isWinDialog()) {
					// Clear any existing auto-close timer (from setupAutoCloseTimer) to prevent
					// it from firing too early and cutting off the final stage.
					if (this.autoCloseTimer) {
						this.autoCloseTimer.destroy();
						this.autoCloseTimer = null;
						console.log('[Dialogs] Cleared initial auto-close timer for final staged tier');
					}

					// Detect free spin autoplay (bonus autoplay) via Symbols component on the scene
					let isFreeSpinAutoplay = false;
					try {
						const gameScene: any = scene as any;
						const symbolsComponent = gameScene?.symbols;
						if (symbolsComponent && typeof symbolsComponent.isFreeSpinAutoplayActive === 'function') {
							isFreeSpinAutoplay = !!symbolsComponent.isFreeSpinAutoplayActive();
						}
					} catch {}

					const isAutoplaying = gameStateManager.isAutoPlaying || isFreeSpinAutoplay;
					if (isAutoplaying) {
						const perStageDwellMs = 2950; // Keep in sync with runStagedWinStage
						const finalStageDwellMs = perStageDwellMs + 3500;

						console.log('[Dialogs] Creating auto-close timer for final staged tier during autoplay', {
							delayMs: finalStageDwellMs,
							currentStageIndex: this.stagedWinCurrentStageIndex,
							totalStages: this.stagedWinStages.length
						});

						this.autoCloseTimer = scene.time.delayedCall(finalStageDwellMs, () => {
							console.log('[Dialogs] Auto-close after final staged tier during autoplay - closing dialog');
							this.handleDialogClick(scene, true);
						});
					}
				}
			} catch (e) {
				console.warn('[Dialogs] Failed to create auto-close timer for final staged tier:', e);
			}
		}
	}

	/**
	 * Skip directly to a specific staged win tier (used for manual "press anywhere"
	 * skips while a staged win dialog is playing).
	 */
	private skipToStagedWinStage(scene: Scene, nextIndex: number): void {
		if (!this.numberDisplay || !this.currentDialog) {
			console.warn('[Dialogs] skipToStagedWinStage: missing numberDisplay or currentDialog - closing dialog instead');
			// Fallback: behave like a normal close
			this.startFadeOutSequence(scene);
			this.resetGameStateForNewSpin(scene);
			return;
		}

		if (nextIndex < 0 || nextIndex >= this.stagedWinStages.length) {
			console.warn('[Dialogs] skipToStagedWinStage: invalid staged index', nextIndex);
			this.isStagedWinNumberAnimation = false;
			// Fallback: close dialog normally
			this.startFadeOutSequence(scene);
			this.resetGameStateForNewSpin(scene);
			return;
		}

		// Cancel any pending staged win timer from the previous stage so we can
		// take over progression from this skipped-to tier.
		if (this.stagedWinStageTimer) {
			this.stagedWinStageTimer.destroy();
			this.stagedWinStageTimer = null;
		}

		console.log('[Dialogs] Skipping to staged win tier', {
			index: nextIndex,
			type: this.stagedWinStages[nextIndex].type,
			target: this.stagedWinStages[nextIndex].target
		});

		// Ensure staged sequencing remains active for this dialog and run the
		// requested tier with a faster number animation.
		this.isStagedWinNumberAnimation = true;
		this.runStagedWinStage(scene, nextIndex, true);
	}

	/**
	 * Apply a scale "pop-in" from 0 -> lastDialogScale on the current dialog.
	 * Called whenever we transition into an idle animation so it also applies
	 * to subsequent dialogs / staged win tiers.
	 */
	private applyDialogScalePop(scene: Scene): void {
		if (!this.currentDialog) {
			return;
		}

		const targetScale = this.lastDialogScale || 1;
		try {
			(this.currentDialog as any).setScale?.(0);
		} catch {}

		scene.tweens.add({
			targets: this.currentDialog,
			scaleX: targetScale,
			scaleY: targetScale,
			duration: 800,
			ease: 'Back.Out'
		});
	}

	// Helper methods for dialog configuration
	private getDialogScale(dialogType: string): number {
		return this.dialogScales[dialogType] || 1.0;
	}

	private getDialogPosition(dialogType: string, scene: Scene): { x: number; y: number } {
		const position = this.dialogPositions[dialogType];
		if (position) {
			// Convert relative positions (0.0 to 1.0) to absolute screen coordinates
			return {
				x: position.x * scene.scale.width,
				y: position.y * scene.scale.height
			};
		}
		// Default to center of screen
		return { x: scene.scale.width / 2, y: scene.scale.height / 2 };
	}

	private getDialogLoop(dialogType: string): boolean {
		return this.dialogLoops[dialogType] || false;
		}
		
	// Convenience methods for specific dialog types
	showCongrats(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'Congrats_Dialog', ...config });
	}

	showFreeSpinDialog(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'FreeSpin_Dialog', ...config });
	}

	showLargeWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'EpicWin_Dialog', ...config });
		}
		
	showMediumWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'MegaWin_Dialog', ...config });
		}

	showSmallWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'BigWin_Dialog', ...config });
		}

	showSuperWin(scene: Scene, config?: Partial<DialogConfig>): void {
		this.showDialog(scene, { type: 'SuperWin_Dialog', ...config });
	}
}
