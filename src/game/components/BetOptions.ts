import { Scene } from 'phaser';
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { ensureSpineFactory } from '../../utils/SpineGuard';

export interface BetOptionsConfig {
	position?: { x: number; y: number };
	scale?: number;
	onClose?: () => void;
	onConfirm?: (betAmount: number) => void;
	/**
	 * Base bet (non-enhanced). This is what the bet selector operates on.
	 */
	currentBet?: number;
	/**
	 * The bet value to DISPLAY in the panel (e.g. base*1.25 when Enhanced Bet is ON).
	 * If omitted, display will match `currentBet` or the HUD bet text.
	 */
	currentBetDisplay?: number;
}

export class BetOptions {
	private container: Phaser.GameObjects.Container;
	private background: Phaser.GameObjects.Graphics;
	private fullScreenBlocker: Phaser.GameObjects.Graphics;
	private confirmButtonMask: Phaser.GameObjects.Graphics;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private currentBet: number = 240.00;
	// Multiplier applied to the base bet for display purposes (e.g. 1.25 for enhanced bet).
	// We derive this from `currentBetDisplay / currentBet` (or from HUD bet text when available)
	// so BetOptions does not need to know anything about Enhanced Bet directly.
	private betDisplayMultiplier: number = 1;
	private betOptions: number[] = [
		0.2, 0.4, 0.6, 0.8, 1,
		1.2, 1.6, 2, 2.4, 2.8,
		3.2, 3.6, 4, 5, 6,
		8, 10, 14, 18, 24,
		32, 40, 60, 80, 100,
		110, 120, 130, 140, 150
	];
	private betButtons: Phaser.GameObjects.Container[] = [];
	private selectedButtonIndex: number = -1;
	private closeButton: Phaser.GameObjects.Text;
	private confirmButton: Phaser.GameObjects.Text;
	private betDisplay: Phaser.GameObjects.Text;
	private minusButton: Phaser.GameObjects.Text;
	private plusButton: Phaser.GameObjects.Text;
	// Enhanced bet spine animation overlay (mirrors AutoplayOptions / SlotController)
	private enhanceBetIdleAnimation: any = null;
	private readonly DISABLED_ALPHA: number = 0.5;
	private onCloseCallback?: () => void;
	private onConfirmCallback?: (betAmount: number) => void;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	private formatBetOptionLabel(value: number): string {
		// Keep the label compact like the original `value.toString()` (no trailing zeros),
		// but stable for fractional enhanced values.
		const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
		return Number.isFinite(rounded) ? rounded.toString() : value.toString();
	}

	private getDisplayBetFromHud(): number | undefined {
		const sceneAny = this.container?.scene as any;
		const betText = sceneAny?.slotController?.getBetAmountText?.();
		const parsed = betText ? parseFloat(betText) : Number.NaN;
		return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
	}

	private setBetStepButtonEnabled(button: Phaser.GameObjects.Text | undefined, enabled: boolean): void {
		if (!button) return;

		button.setAlpha(enabled ? 1.0 : this.DISABLED_ALPHA);
		button.setData('disabled', !enabled);

		if (enabled) {
			if (!button.input || !button.input.enabled) {
				button.setInteractive();
			} else {
				button.input.enabled = true;
			}
		} else if (button.input) {
			button.input.enabled = false;
		}
	}

	private updateBetStepButtonStates(): void {
		// If bet index isn't initialized yet, keep both enabled.
		if (this.selectedButtonIndex < 0) {
			this.setBetStepButtonEnabled(this.minusButton, true);
			this.setBetStepButtonEnabled(this.plusButton, true);
			return;
		}

		const lastIndex = this.betOptions.length - 1;
		this.setBetStepButtonEnabled(this.minusButton, this.selectedButtonIndex > 0);
		this.setBetStepButtonEnabled(this.plusButton, this.selectedButtonIndex < lastIndex);
	}

	private updateBetOptionButtonLabels(): void {
		const multiplier = Number.isFinite(this.betDisplayMultiplier) && this.betDisplayMultiplier > 0
			? this.betDisplayMultiplier
			: 1;

		const isEnhanced = multiplier > 1.0001;
		const baseFontSize = 24;
		const minFontSizeAllowed = 12;
		const horizontalPadding = 6; // keep some breathing room inside 60px buttons

		// Pass 1: set label text; if enhanced, compute the smallest font size required across all labels.
		let smallestFontSize = baseFontSize;
		for (const button of this.betButtons) {
			const baseValue = (button as any).buttonValue as number | undefined;
			const textObj = (button as any).buttonText as Phaser.GameObjects.Text | undefined;
			if (!textObj || typeof baseValue !== 'number') continue;

			const displayValue = baseValue * multiplier;
			const label = this.formatBetOptionLabel(displayValue);
			textObj.setText(label);

			if (!isEnhanced) {
				continue;
			}

			const buttonWidth = (button as any).buttonWidth as number | undefined;
			const maxTextWidth = Math.max(0, (buttonWidth ?? 60) - horizontalPadding);

			let size = baseFontSize;
			textObj.setFontSize(size);
			while (textObj.width > maxTextWidth && size > minFontSizeAllowed) {
				size -= 1;
				textObj.setFontSize(size);
			}

			if (size < smallestFontSize) {
				smallestFontSize = size;
			}
		}

		// Pass 2: apply uniform sizing.
		const finalFontSize = isEnhanced ? smallestFontSize : baseFontSize;
		for (const button of this.betButtons) {
			const textObj = (button as any).buttonText as Phaser.GameObjects.Text | undefined;
			if (!textObj) continue;
			textObj.setFontSize(finalFontSize);
		}
	}

	/**
	 * Create the Enhance Bet idle loop spine animation near the bet display.
	 * (ported from AutoplayOptions)
	 */
	private createEnhanceBetAnimation(scene: Scene): void {
		try {
			if (!ensureSpineFactory(scene, '[BetOptions] createEnhanceBetAnimation')) {
				console.warn('[BetOptions] Spine factory unavailable. Skipping enhance bet idle animation creation.');
				return;
			}

			if (!scene.cache.json.has('enhance_bet_idle_on')) {
				console.warn('[BetOptions] enhance_bet_idle_on spine assets not loaded, skipping idle animation creation');
				return;
			}

			const screenWidth = scene.scale.width;
			const screenHeight = scene.scale.height;

			// Position near the bet display
			const betX = screenWidth * 0.5;
			const betY = screenHeight * 0.5 + 240;
			const animationOffsetX = -10; // slight left offset to match SlotController/AutoplayOptions
			const animationOffsetY = 0;

			this.enhanceBetIdleAnimation = scene.add.spine(
				betX + animationOffsetX,
				betY + animationOffsetY,
				'enhance_bet_idle_on',
				'enhance_bet_idle_on-atlas'
			);
			this.enhanceBetIdleAnimation.setOrigin(0.5, 0.5);
			this.enhanceBetIdleAnimation.setScale(2.94, 1.35);
			this.enhanceBetIdleAnimation.setDepth(2001); // Above the container depth (2000)
			this.enhanceBetIdleAnimation.setVisible(false);

			// Add to container
			this.container.add(this.enhanceBetIdleAnimation);

			console.log('[BetOptions] Enhance Bet idle spine animation created');
		} catch (error) {
			console.error('[BetOptions] Failed to create enhance bet idle animation:', error);
		}
	}

	/** Show the enhance bet idle loop animation */
	private showEnhanceBetIdleLoop(): void {
		if (!this.enhanceBetIdleAnimation) {
			return;
		}
		this.enhanceBetIdleAnimation.setVisible(true);
		const idleName = 'animation'; // single animation in JSON is named 'animation'
		if (this.enhanceBetIdleAnimation.skeleton?.data.findAnimation(idleName)) {
			this.enhanceBetIdleAnimation.animationState.setAnimation(0, idleName, true);
		} else {
			const animations = this.enhanceBetIdleAnimation.skeleton?.data.animations || [];
			if (animations.length > 0) {
				this.enhanceBetIdleAnimation.animationState.setAnimation(0, animations[0].name, true);
			}
		}
	}

	/** Hide the enhance bet idle loop animation */
	private hideEnhanceBetIdleLoop(): void {
		if (!this.enhanceBetIdleAnimation) {
			return;
		}
		this.enhanceBetIdleAnimation.animationState.clearTracks();
		this.enhanceBetIdleAnimation.setVisible(false);
	}

	create(scene: Scene): void {
		console.log("[BetOptions] Creating bet options component");
		
		// Create main container
		this.container = scene.add.container(0, 0);
		this.container.setDepth(2000); // Very high depth to appear above everything including winlines and symbols
		
		// Create full-screen interaction blocker
		this.createFullScreenBlocker(scene);
		
		// Create background
		this.createBackground(scene);
		
		// Create header
		this.createHeader(scene);
		
		// Create bet options grid
		this.createBetOptionsGrid(scene);
		
		// Create bet input section
		this.createBetInput(scene);

		// Create enhanced bet animation overlay (shown when betDisplayMultiplier > 1)
		this.createEnhanceBetAnimation(scene);
		
		// Create confirm button
		this.createConfirmButton(scene);
		
		// Initially hide the component
		this.container.setVisible(false);
		if (this.fullScreenBlocker) {
			this.fullScreenBlocker.setVisible(false);
		}
	}

	private createFullScreenBlocker(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		
		// Create full-screen blocker behind the menu
		this.fullScreenBlocker = scene.add.graphics();
		this.fullScreenBlocker.fillStyle(0x000000, 0.01); // Nearly transparent, just to block interactions
		this.fullScreenBlocker.fillRect(0, 0, screenWidth, screenHeight);
		this.fullScreenBlocker.setInteractive(new Phaser.Geom.Rectangle(0, 0, screenWidth, screenHeight), Phaser.Geom.Rectangle.Contains);
		this.fullScreenBlocker.setDepth(1999); // Just below the menu container (2000)
		this.fullScreenBlocker.setVisible(false);
	}

	private createBackground(scene: Scene): void {
		const screenWidth = scene.scale.width;
		const screenHeight = scene.scale.height;
		const backgroundHeight = 860;
		const backgroundTop = screenHeight - backgroundHeight;
		
		// Background overlay with rounded corners
		this.background = scene.add.graphics();
		this.background.fillStyle(0x000000, 0.80); // Semi-transparent black overlay
		this.background.fillRoundedRect(0, backgroundTop, screenWidth, backgroundHeight, 20);
		this.background.setInteractive(new Phaser.Geom.Rectangle(0, backgroundTop, screenWidth, backgroundHeight), Phaser.Geom.Rectangle.Contains);
		this.container.add(this.background);
	}

	private createHeader(scene: Scene): void {
		const x = scene.scale.width * 0.5;
		const y = scene.scale.height * 0.5 - 200;
		
		// BET title
		const betTitle = scene.add.text(x - 180, y - 150, 'BET', {
			fontSize: '24px',
			color: '#00ff00',
			fontFamily: 'Poppins-Bold'
		});
		betTitle.setOrigin(0, 0.5);
		this.container.add(betTitle);
		
		// Close button (X)
		this.closeButton = scene.add.text(x + 180, y - 150, '×', {
			fontSize: '30px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.closeButton.setOrigin(0.5, 0.5);
		this.closeButton.setInteractive();
		this.closeButton.on('pointerdown', () => {
			// Create slide-down animation
			if (this.container.scene) {
				this.container.scene.tweens.add({
					targets: this.container,
					y: this.container.scene.scale.height,
					duration: 400,
					ease: 'Power2.in',
					onComplete: () => {
						this.hide();
						if (this.onCloseCallback) this.onCloseCallback();
					}
				});
			} else {
				this.hide();
				if (this.onCloseCallback) this.onCloseCallback();
			}
		});
		this.container.add(this.closeButton);
	}

	private createBetOptionsGrid(scene: Scene): void {
		const startX = scene.scale.width * 0.5 - 180;
		const startY = scene.scale.height * 0.5 - 250;
		const buttonWidth = 60;
		const buttonHeight = 50;
		const spacing = 15;
		
		// "Select size" label
		const selectSizeLabel = scene.add.text(startX, startY - 30, 'Select size', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		selectSizeLabel.setOrigin(0, 0.5);
		this.container.add(selectSizeLabel);
		
		// Create grid of bet option buttons
		for (let i = 0; i < this.betOptions.length; i++) {
			const row = Math.floor(i / 5);
			const col = i % 5;
			const x = startX + col * (buttonWidth + spacing);
			const y = startY + row * (buttonHeight + spacing);
			
			const buttonContainer = this.createBetOptionButton(scene, x, y, buttonWidth, buttonHeight, this.betOptions[i], i);
			this.betButtons.push(buttonContainer);
			this.container.add(buttonContainer);
		}
	}

	private createBetOptionButton(scene: Scene, x: number, y: number, width: number, height: number, value: number, index: number): Phaser.GameObjects.Container {
		const container = scene.add.container(x, y);
		
		// Button background
		const buttonBg = scene.add.graphics();
		buttonBg.fillStyle(0x000000, 1);
		buttonBg.fillRoundedRect(0, 0, width, height, 5);
		buttonBg.lineStyle(0.5, 0xffffff, 1);
		buttonBg.strokeRoundedRect(0, 0, width, height, 5);
		container.add(buttonBg);
		
		// Store reference to background for selection state
		(container as any).buttonBg = buttonBg;
		(container as any).buttonValue = value;
		(container as any).buttonIndex = index;
		(container as any).buttonWidth = width;
		
		// Button text
		const buttonText = scene.add.text(width/2, height/2, this.formatBetOptionLabel(value), {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Bold'
		});
		buttonText.setOrigin(0.5, 0.5);
		container.add(buttonText);
		(container as any).buttonText = buttonText;
		
		// Make interactive
		container.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
		container.on('pointerdown', () => {
			this.selectButton(index, value);
		});
		
		return container;
	}

	private createBetInput(scene: Scene): void {
		const x = scene.scale.width * 0.5;
		const y = scene.scale.height * 0.5 + 240;
		
		// "Bet" label
		const betLabel = scene.add.text(x - 180, y - 70, 'Bet', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		betLabel.setOrigin(0, 0.5);
		this.container.add(betLabel);
		
		// Bet input background
		const inputBg = scene.add.graphics();
		inputBg.fillStyle(0x000000, 1);
		inputBg.fillRoundedRect(-182, -37, 364, 74, 10);
		inputBg.lineStyle(0.5, 0xffffff, 1);
		inputBg.strokeRoundedRect(-182, -37, 364, 74, 10);
		inputBg.setPosition(x, y);
		this.container.add(inputBg);
		
		// Minus button
		this.minusButton = scene.add.text(x - 150, y, '-', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.minusButton.setOrigin(0.5, 0.5);
		this.minusButton.setInteractive();
		this.minusButton.on('pointerdown', () => {
			this.selectPreviousBet();
		});
		this.container.add(this.minusButton);
		
		// Bet display
		// Check if demo mode is active - if so, use blank currency symbol
		const isDemoInitial = (scene as any).gameAPI?.getDemoState();
		const currencySymbolInitial = isDemoInitial ? '' : '$';
		this.betDisplay = scene.add.text(x, y, `${currencySymbolInitial}${this.currentBet.toFixed(2)}`, {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.betDisplay.setOrigin(0.5, 0.5);
		this.container.add(this.betDisplay);
		
		// Plus button
		this.plusButton = scene.add.text(x + 150, y, '+', {
			fontSize: '24px',
			color: '#ffffff',
			fontFamily: 'Poppins-Regular'
		});
		this.plusButton.setOrigin(0.5, 0.5);
		this.plusButton.setInteractive();
		this.plusButton.on('pointerdown', () => {
			this.selectNextBet();
		});
		this.container.add(this.plusButton);

		// Initial state (will be corrected once bet index is selected in show())
		this.updateBetStepButtonStates();
	}

	private createConfirmButton(scene: Scene): void {
		const x = scene.scale.width * 0.5;
		const y = scene.scale.height * 0.5 + 330;
		
		// Use long_button image instead of gradient/mask
		const buttonImage = scene.add.image(x, y, 'long_button');
		buttonImage.setOrigin(0.5, 0.5);
		buttonImage.setDisplaySize(364, 62);
		this.container.add(buttonImage);
		
		// Button text
		this.confirmButton = scene.add.text(x, y, 'CONFIRM', {
			fontSize: '24px',
			color: '#000000',
			fontFamily: 'Poppins-Bold'
		});
		this.confirmButton.setOrigin(0.5, 0.5);
		this.container.add(this.confirmButton);
		
		buttonImage.setInteractive();
		buttonImage.on('pointerdown', () => {
			// Create slide-down animation
			if (this.container.scene) {
				this.container.scene.tweens.add({
					targets: this.container,
					y: this.container.scene.scale.height,
					duration: 400,
					ease: 'Power2.in',
					onComplete: () => {
						if (this.onConfirmCallback) this.onConfirmCallback(this.currentBet);
						this.hide();
					}
				});
			} else {
				if (this.onConfirmCallback) this.onConfirmCallback(this.currentBet);
				this.hide();
			}
		});
	}

	private selectButton(index: number, value: number): void {
		// Deselect previous button
		if (this.selectedButtonIndex >= 0 && this.selectedButtonIndex < this.betButtons.length) {
			const prevButton = this.betButtons[this.selectedButtonIndex];
			const prevBg = (prevButton as any).buttonBg;
			prevBg.clear();
			prevBg.fillStyle(0x000000, 1);
			prevBg.fillRoundedRect(0, 0, 60, 50, 5);
			prevBg.lineStyle(0.5, 0xffffff, 1);
			prevBg.strokeRoundedRect(0, 0, 60, 50, 5);
		}
		
		// Select new button
		this.selectedButtonIndex = index;
		this.currentBet = value;
		
		// Update selected button background to solid neon green
		const selectedButton = this.betButtons[index];
		const selectedBg = (selectedButton as any).buttonBg;
		selectedBg.clear();
		selectedBg.fillStyle(0x66D449, 1);
		selectedBg.fillRoundedRect(0, 0, 60, 50, 5);
		selectedBg.lineStyle(0.5, 0xffffff, 1);
		selectedBg.strokeRoundedRect(0, 0, 60, 50, 5);
		
		this.updateBetDisplay();
		this.updateBetStepButtonStates();
	}

	private updateBetDisplay(): void {
		if (this.betDisplay) {
			const multiplier = Number.isFinite(this.betDisplayMultiplier) && this.betDisplayMultiplier > 0 ? this.betDisplayMultiplier : 1;
			const displayBet = this.currentBet * multiplier;
			const isDemo = (this.container?.scene as any)?.gameAPI?.getDemoState?.();
			const currencySymbol = isDemo ? '' : '$';
			this.betDisplay.setText(`${currencySymbol}${displayBet.toFixed(2)}`);
		}
	}

	private selectPreviousBet(): void {
		if (this.selectedButtonIndex > 0) {
			this.selectButton(this.selectedButtonIndex - 1, this.betOptions[this.selectedButtonIndex - 1]);
		}
	}

	private selectNextBet(): void {
		if (this.selectedButtonIndex < this.betOptions.length - 1) {
			this.selectButton(this.selectedButtonIndex + 1, this.betOptions[this.selectedButtonIndex + 1]);
		}
	}

	show(config?: BetOptionsConfig): void {
		if (config) {
			if (config.currentBet !== undefined) {
				this.currentBet = config.currentBet;
			}
			// Derive display multiplier (defaults to 1 when display bet isn't provided)
			if (config.currentBetDisplay !== undefined && this.currentBet > 0) {
				this.betDisplayMultiplier = config.currentBetDisplay / this.currentBet;
			} else {
				this.betDisplayMultiplier = 1;
			}
			this.onCloseCallback = config.onClose;
			this.onConfirmCallback = config.onConfirm;
		}

		// If caller didn't provide a display bet, try to infer it from the HUD (includes enhanced bet if active).
		if (this.betDisplayMultiplier === 1 && this.currentBet > 0) {
			const hudDisplayBet = this.getDisplayBetFromHud();
			if (hudDisplayBet !== undefined) {
				this.betDisplayMultiplier = hudDisplayBet / this.currentBet;
			}
		}
		
		// Apply labels for the current display multiplier (base vs enhanced)
		this.updateBetOptionButtonLabels();

		// Find and select the button that matches the current bet
		const matchingIndex = this.betOptions.findIndex(option => Math.abs(option - this.currentBet) < 0.01);
		if (matchingIndex !== -1) {
			this.selectButton(matchingIndex, this.betOptions[matchingIndex]);
		} else {
			// If no exact match, select the closest option
			let closestIndex = 0;
			let closestDifference = Math.abs(this.betOptions[0] - this.currentBet);
			
			for (let i = 1; i < this.betOptions.length; i++) {
				const difference = Math.abs(this.betOptions[i] - this.currentBet);
				if (difference < closestDifference) {
					closestDifference = difference;
					closestIndex = i;
				}
			}
			this.selectButton(closestIndex, this.betOptions[closestIndex]);
		}
		
		this.updateBetDisplay();

		// Show/hide enhanced bet animation based on display multiplier
		if (this.betDisplayMultiplier > 1.0001) {
			this.showEnhanceBetIdleLoop();
		} else {
			this.hideEnhanceBetIdleLoop();
		}
		
		// Show full-screen blocker
		if (this.fullScreenBlocker) {
			this.fullScreenBlocker.setVisible(true);
		}
		
		// Start positioned below the screen for slide-up effect
		this.container.setY(this.container.scene.scale.height);
		this.container.setVisible(true);
		
		// Show the mask when the panel is shown
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(true);
			this.confirmButtonMask.setAlpha(1);
		}
		
		// Create slide-up animation
		if (this.container.scene) {
			this.container.scene.tweens.add({
				targets: this.container,
				y: 0,
				duration: 400,
				ease: 'Power2.out'
			});
		}
	}

	hide(): void {
		this.container.setVisible(false);

		// Hide full-screen blocker
		if (this.fullScreenBlocker) {
			this.fullScreenBlocker.setVisible(false);
		}

		// Hide enhanced bet animation when panel is hidden
		this.hideEnhanceBetIdleLoop();
		
		// Hide the mask when the panel is hidden
		if (this.confirmButtonMask) {
			this.confirmButtonMask.setVisible(false);
			this.confirmButtonMask.setAlpha(0);
		}
	}

	isVisible(): boolean {
		return this.container.visible;
	}

	setCurrentBet(bet: number): void {
		this.currentBet = bet;
		this.updateBetDisplay();
	}

	getCurrentBet(): number {
		return this.currentBet;
	}

	destroy(): void {
		if (this.fullScreenBlocker) {
			this.fullScreenBlocker.destroy();
		}
		if (this.container) {
			this.container.destroy();
		}
	}
} 