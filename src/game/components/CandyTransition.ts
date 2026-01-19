import { Scene } from 'phaser';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from '../../utils/SpineGuard';

export class CandyTransition {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private spineObject: SpineGameObject | null = null;
	private isPlaying: boolean = false;
	private depth: number = 20000;

	constructor(scene: Scene) {
		this.scene = scene;
		this.container = scene.add.container(0, 0);
		this.container.setDepth(this.depth);
		this.container.setVisible(false);
	}

	public show(): void {
		this.container.setVisible(true);
	}

	public hide(): void {
		this.container.setVisible(false);
		this.destroySpine();
	}

	public play(onComplete?: () => void, startOffsetSeconds: number = 0): void {
		if (this.isPlaying) {
			return;
		}
		this.isPlaying = true;
		this.show();

		this.destroySpine();

		const centerX = this.scene.cameras.main.centerX;
		const centerY = this.scene.cameras.main.centerY;

		if (!ensureSpineFactory(this.scene, '[CandyTransition] play')) {
			console.warn('[CandyTransition] Spine factory not available; skipping transition spine');
			this.isPlaying = false;
			if (onComplete) onComplete();
			this.hide();
			return;
		}

		const spine = (this.scene.add as any).spine?.(centerX, centerY, 'transition_SW', 'transition_SW-atlas') as SpineGameObject;
		if (!spine) {
			console.warn('[CandyTransition] Failed to create transition spine (add.spine returned null/undefined)');
			this.isPlaying = false;
			if (onComplete) onComplete();
			this.hide();
			return;
		}
		spine.setOrigin(0.5, 0.5);
		spine.setDepth(this.depth + 1);

		this.spineObject = spine;
		this.container.add(spine);

		try {
			// Play the actual animation name from JSON: "transition_SW"
			const entry = spine.animationState.setAnimation(0, 'transition_SW', false);
            spine.animationState.timeScale = 0.5;
			// Optionally skip a few frames at the start
			if (entry && startOffsetSeconds > 0) {
				entry.trackTime = startOffsetSeconds;
			}
			spine.animationState.addListener({
				complete: () => {
					this.isPlaying = false;
					if (onComplete) onComplete();
					this.hide();
				}
			} as any);
		} catch {
			this.isPlaying = false;
			if (onComplete) onComplete();
			this.hide();
		}
	}

	private destroySpine(): void {
		if (this.spineObject) {
			this.spineObject.destroy();
			this.spineObject = null;
		}
	}
}


