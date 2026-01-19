import { Scene } from 'phaser';

/**
 * LoadingSpinner Component
 * 
 * A simple graphic spinner that spins in the center of the symbols grid
 * when fetching spin data takes more than 2 seconds (after symbols clear).
 */
export class LoadingSpinner {
	private scene: Scene;
	private container: Phaser.GameObjects.Container | null = null;
	private spinnerGraphics: Phaser.GameObjects.Graphics | null = null;
	private spinnerTween: Phaser.Tweens.Tween | null = null;
	private showTimeout: any | null = null;
	private isVisible: boolean = false;
	
	// Position where the spinner should appear (center of symbols grid)
	private centerX: number = 0;
	private centerY: number = 0;
	
	// Spinner properties
	private readonly spinnerRadius: number = 30;
	private readonly spinnerLineCount: number = 8;
	private readonly spinnerLineWidth: number = 4;

	constructor(scene: Scene, centerX: number, centerY: number) {
		this.scene = scene;
		this.centerX = centerX + 10;
		this.centerY = centerY -5;
		this.createSpinner();
	}

	/**
	 * Create the graphic spinner
	 */
	private createSpinner(): void {
		// Create container for the spinner
		this.container = this.scene.add.container(this.centerX, this.centerY);
		this.container.setDepth(10000); // High depth to appear above symbols
		this.container.setVisible(false);
		this.container.setAlpha(0);

		// Create the spinner graphics
		this.spinnerGraphics = this.scene.add.graphics();
		this.drawSpinner();
		this.container.add(this.spinnerGraphics);

		console.log('[LoadingSpinner] Graphic spinner created at position:', this.centerX, this.centerY);
	}

	/**
	 * Draw the spinner with radial lines
	 */
	private drawSpinner(): void {
		if (!this.spinnerGraphics) return;

		this.spinnerGraphics.clear();
		
		const centerX = 0;
		const centerY = 0;
		const radius = this.spinnerRadius;
		const lineCount = this.spinnerLineCount;
		const lineWidth = this.spinnerLineWidth;
		
		// Draw 8 lines radiating from center
		// Each line has varying opacity to create spinning effect
		for (let i = 0; i < lineCount; i++) {
			const angle = (i / lineCount) * Math.PI * 2 - Math.PI / 2; // Start from top
			const opacity = 0.2 + (i / lineCount) * 0.8; // Gradient opacity
			
			const x1 = centerX + Math.cos(angle) * radius * 0.3;
			const y1 = centerY + Math.sin(angle) * radius * 0.3;
			const x2 = centerX + Math.cos(angle) * radius;
			const y2 = centerY + Math.sin(angle) * radius;
			
			this.spinnerGraphics.lineStyle(lineWidth, 0x00ced1, opacity); // Blue-green color (dark turquoise)
			this.spinnerGraphics.beginPath();
			this.spinnerGraphics.moveTo(x1, y1);
			this.spinnerGraphics.lineTo(x2, y2);
			this.spinnerGraphics.strokePath();
		}
	}

	/**
	 * Start showing the spinner after a 2-second delay
	 * This should be called when the API request starts
	 * Delayed to allow previous symbols to clear first
	 */
	public startDelayedShow(): void {
		console.log('[LoadingSpinner] Starting delayed show (2 seconds)');
		
		// Clear any existing timeout
		this.cancelDelayedShow();
		
		// Set timeout to show spinner after 2 seconds (allows symbols to clear)
		this.showTimeout = setTimeout(() => {
			this.show();
		}, 2000);
	}

	/**
	 * Cancel the delayed show (call this if data arrives within 1 second)
	 */
	public cancelDelayedShow(): void {
		if (this.showTimeout) {
			clearTimeout(this.showTimeout);
			this.showTimeout = null;
			console.log('[LoadingSpinner] Cancelled delayed show');
		}
	}

	/**
	 * Show the spinner immediately with fade-in animation
	 */
	private show(): void {
		if (!this.container || this.isVisible) {
			return;
		}

		console.log('[LoadingSpinner] Showing spinner');
		this.isVisible = true;
		this.container.setVisible(true);

		// Reset spinner angle to 0 before starting
		if (this.spinnerGraphics) {
			this.spinnerGraphics.setAngle(0);
		}

		// Fade in animation
		this.scene.tweens.add({
			targets: this.container,
			alpha: 1,
			duration: 200,
			ease: 'Power2'
		});

		// Rotate the spinner continuously with smooth linear motion (counter-clockwise)
		this.spinnerTween = this.scene.tweens.add({
			targets: this.spinnerGraphics,
			angle: -360,
			duration: 1200, // Slightly slower for smoother rotation
			ease: 'Linear',
			repeat: -1,
			yoyo: false
		});
	}

	/**
	 * Hide the spinner with fade-out animation
	 * This should be called when spin data is received, before symbols drop
	 * Includes a small delay to keep spinner visible until symbols are about to drop
	 */
	public hide(): void {
		if (!this.container) {
			return;
		}

		console.log('[LoadingSpinner] Hiding spinner with delay');
		
		// Cancel any pending show
		this.cancelDelayedShow();

		// Add a delay before hiding to keep spinner visible longer
		// This prevents an awkward empty moment before new symbols drop
		setTimeout(() => {
			// Stop rotation smoothly at the nearest complete rotation (0 or -360 degrees)
			if (this.spinnerTween && this.spinnerGraphics) {
				const currentAngle = this.spinnerGraphics.angle % 360;
				// For counter-clockwise, rotate to 0 or -360
				const targetAngle = currentAngle > -180 ? 0 : -360;
				const angleToRotate = targetAngle - currentAngle;
				
				// Stop the infinite loop
				this.spinnerTween.stop();
				this.spinnerTween = null;
				
				// Smoothly rotate to 0 or 360 degrees
				this.scene.tweens.add({
					targets: this.spinnerGraphics,
					angle: `+=${angleToRotate}`,
					duration: Math.abs(angleToRotate) * 2, // Proportional duration
					ease: 'Linear',
					onComplete: () => {
						// Reset to 0 degrees after completing rotation
						if (this.spinnerGraphics) {
							this.spinnerGraphics.setAngle(0);
						}
					}
				});
			}

			// Only fade out if visible
			if (this.isVisible && this.container) {
				this.scene.tweens.add({
					targets: this.container,
					alpha: 0,
					duration: 150,
					ease: 'Power2',
					onComplete: () => {
						if (this.container) {
							this.container.setVisible(false);
							this.isVisible = false;
						}
					}
				});
			} else if (this.container) {
				this.container.setVisible(false);
				this.isVisible = false;
			}
		}, 1100); // 1100ms delay before hiding
	}

	/**
	 * Update the spinner position (useful if screen is resized)
	 */
	public updatePosition(centerX: number, centerY: number): void {
		this.centerX = centerX;
		this.centerY = centerY;
		
		if (this.container) {
			this.container.setPosition(centerX, centerY);
			console.log('[LoadingSpinner] Position updated to:', centerX, centerY);
		}
	}

	/**
	 * Check if spinner is currently visible
	 */
	public isShowing(): boolean {
		return this.isVisible;
	}

	/**
	 * Clean up and destroy the spinner
	 */
	public destroy(): void {
		console.log('[LoadingSpinner] Destroying spinner');
		
		this.cancelDelayedShow();
		
		if (this.spinnerTween) {
			this.spinnerTween.stop();
			this.spinnerTween = null;
		}

		if (this.container) {
			this.container.destroy();
			this.container = null;
		}

		this.spinnerGraphics = null;
		this.isVisible = false;
	}
}
