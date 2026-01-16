import { Scene } from 'phaser';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class ScatterAnticipation {
	private scene: Scene;
	private container: Phaser.GameObjects.Container | null = null;
	private spineObject: any | null = null;
	private ownsContainer: boolean = false;
	private targetX: number = 0;
	private targetY: number = 0;

	private readonly spineKey: string = 'scatter_anticipation_spine';

	private stopShowTweens(): void {
		try {
			if (this.scene && this.container) {
				// Kill any in-flight entrance tweens immediately (show() can be called frequently).
				this.scene.tweens.killTweensOf(this.container);
			}
		} catch {}
	}

	private playDefaultLoop(): void {
		if (!this.spineObject) return;
		try {
			// Ensure track is clean and running
			this.spineObject.animationState.clearTracks();
			this.spineObject.animationState.timeScale = Math.max(0.0001, this.spineObject.animationState.timeScale || 1);
			// Try required default name first
			this.spineObject.animationState.setAnimation(0, 'default', true);
			console.log('[ScatterAnticipation] Playing animation: default (loop)');
			return;
		} catch {}

		// Fallback to first available animation if default missing
		try {
			const animations = this.spineObject?.skeleton?.data?.animations || [];
			const first = animations[0]?.name;
			if (first) {
				this.spineObject.animationState.setAnimation(0, first, true);
				console.log(`[ScatterAnticipation] 'default' not found. Playing first animation: ${first} (loop)`);
			}
		} catch {}
	}

	constructor() {}

	public create(scene: Scene, parentContainer?: Phaser.GameObjects.Container): void {
		this.scene = scene;

		// Guard against missing spine factory
		if (!ensureSpineFactory(scene, '[ScatterAnticipation] create')) {
			console.warn('[ScatterAnticipation] Spine factory unavailable. Skipping creation.');
			return;
		}

		// Always create our own container so we can safely show/hide and position without
		// affecting the parent container.
		this.container = scene.add.container(0, 0);
		this.ownsContainer = true;
		this.targetX = 0;
		this.targetY = 0;

		try {
			// Put it above the background art but (typically) behind symbols (symbols live in their own container).
			this.container.setDepth(5);
		} catch {}

		// If a parent container is provided, attach under it so it inherits that container's mask
		// (e.g. Symbols' reel window mask).
		if (parentContainer) {
			try {
				// Render behind symbols by default (insert at the start of the Symbols container).
				if (typeof (parentContainer as any).addAt === 'function') {
					(parentContainer as any).addAt(this.container, 0);
				} else {
					parentContainer.add(this.container);
				}
			} catch {}
		}

		// Create spine
		try {
			const atlasKey = `${this.spineKey}-atlas`;
			this.spineObject = (scene.add as any).spine(0, 0, this.spineKey, atlasKey);
			if (this.spineObject && typeof this.spineObject.setOrigin === 'function') {
				this.spineObject.setOrigin(0.5, 0.5);
			}
			if (this.container && this.spineObject) {
				this.container.add(this.spineObject);
			}
		} catch (e) {
			console.warn('[ScatterAnticipation] Failed to create spine object:', e);
			this.spineObject = null;
		}

		// Start hidden by default
		this.hide();
	}

	public setPosition(x: number, y: number): void {
		if (!this.container) return;
		this.targetX = x;
		this.targetY = y;
		try {
			this.container.setPosition(x, y);
		} catch {}
	}

	/**
	 * Best-effort sizing: scale the spine to match a desired display height.
	 */
	public setDesiredHeight(desiredHeight: number): void {
		if (!this.spineObject || !desiredHeight || desiredHeight <= 0) return;
		try {
			const h = Number(this.spineObject.height || this.spineObject.displayHeight || 0);
			if (!h || h <= 0) return;
			const s = desiredHeight / h;
			// Slightly stretch vertically to make the anticipation feel longer.
			const yStretch = 1.2;
			const xStretch = 0.7
			if (typeof this.spineObject.setScale === 'function') {
				// Phaser's setScale supports (x, y). Keep X fitted, increase Y by 10%.
				this.spineObject.setScale(s * xStretch, s * yStretch);
			} else {
				// Fallback for non-standard spine objects
				this.spineObject.scaleY = s * yStretch;
				this.spineObject.scaleX = s * xStretch;
			}
		} catch {}
	}

	public show(): void {
		if (!this.container) return;

		// show() can be called more than once during the same anticipation phase (e.g. column changes).
		// If it's already visible, do NOT restart the spine loop / SFX (that looks like "playing twice").
		let wasVisible = false;
		try { wasVisible = !!this.container.visible; } catch {}

		// If it's already visible, avoid killing/resetting the in-flight entrance/expand tweens.
		// Just move it to the latest requested position and keep the current animation smooth.
		if (wasVisible) {
			try { this.container.setPosition(this.targetX, this.targetY); } catch {}
			return;
		}

		// Cancel any previous entrance animation (and snap to a clean state).
		this.stopShowTweens();

		this.container.setVisible(true);
		try {
			this.container.setPosition(this.targetX, this.targetY);
		} catch {}

		// Ensure animation is playing when shown (first time in this visibility window only)
		this.playDefaultLoop();

		// Entrance: start above the reel window, narrow in X, then drop + expand from center.
		try {
			const finalY = this.targetY;
			const dropDistance = Math.max(180, Math.round((this.scene?.scale?.height || 720) * 0.65));
			const startY = finalY - dropDistance;
			const dropDurationMs = 220;
			// User request: stay thin, then expand after ~0.5s total from the moment it shoots in.
			const expandDelayMs = Math.max(0, 500 - dropDurationMs);

			this.container.setY(startY);
			this.container.setScale(0.06, 1);
			this.container.setAlpha(1);

			this.scene.tweens.add({
				targets: this.container,
				y: finalY,
				// Keep it thin while it shoots down.
				scaleX: 0.4,
				duration: dropDurationMs,
				ease: 'Cubic.Out',
				onComplete: () => {
					try {
						if (!this.container) return;
						this.scene.tweens.add({
							targets: this.container,
							delay: expandDelayMs,
							scaleX: 1.08,
							duration: 140,
							ease: 'Sine.Out',
							onComplete: () => {
								try {
									if (!this.container) return;
									this.scene.tweens.add({
										targets: this.container,
										scaleX: 1,
										duration: 70,
										ease: 'Sine.Out',
									});
								} catch {}
							},
						});
					} catch {}
				},
			});
		} catch {
			// Best effort; if tween creation fails, just show it as-is.
			try {
				this.container.setAlpha(1);
				this.container.setScale(1, 1);
				this.container.setY(this.targetY);
			} catch {}
		}

		// Play anticipation loop SFX (first time only)
		try {
			const audio = (window as any)?.audioManager;
			if (audio && typeof audio.playSoundEffect === 'function') {
				audio.playSoundEffect('anticipation');
			}
		} catch {}
	}

	public hide(): void {
		if (!this.container) return;
		// Stop entrance tween and reset transform so the next show() always starts cleanly.
		this.stopShowTweens();
		try {
			this.container.setAlpha(1);
			this.container.setScale(1, 1);
			this.container.setPosition(this.targetX, this.targetY);
		} catch {}
		this.container.setVisible(false);
		// Fade out anticipation SFX
		try {
			const audio = (window as any)?.audioManager;
			if (audio && typeof audio.fadeOutSfx === 'function') {
				audio.fadeOutSfx('anticipation', 300);
			}
		} catch {}
	}

	public destroy(): void {
		this.stopShowTweens();
		if (this.spineObject) {
			this.spineObject.destroy();
			this.spineObject = null;
		}
		if (this.container && this.ownsContainer) {
			this.container.destroy();
			this.container = null;
		}
	}
}


