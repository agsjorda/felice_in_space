import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { gameStateManager } from "../../managers/GameStateManager";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class BonusBackground {
	private bonusContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private scene: Scene | null = null;
	private reelContainerImage: Phaser.GameObjects.Image | null = null;
	private reelContainerFrameImage: Phaser.GameObjects.Image | null = null;
	private bgBonusSpine: SpineGameObject | null = null;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are loaded centrally through AssetConfig in Preloader
		console.log(`[BonusBackground] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[BonusBackground] Creating bonus background elements");
		
		// Store scene reference
		this.scene = scene;
		
		// Create main container for all bonus background elements
		this.bonusContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[BonusBackground] Creating bonus background with scale: ${assetScale}x`);

		// Add bonus background elements
		this.createBonusElements(scene, assetScale);
	}

	private createBonusElements(scene: Scene, assetScale: number): void {
		const screenConfig = this.screenModeManager.getScreenConfig();
		
		if (screenConfig.isPortrait) {
			this.createPortraitBonusBackground(scene, assetScale);
		} else {
			this.createLandscapeBonusBackground(scene, assetScale);
		}
	}


	private createPortraitBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating portrait bonus background layout");
		
		// Add main bonus background as spine animation
		try {
			if (!ensureSpineFactory(scene, '[BonusBackground] createPortraitBonusBackground')) {
				console.warn('[BonusBackground] Spine factory not available yet; will retry BG-Bonus spine later');
				scene.time.delayedCall(250, () => {
					this.createPortraitBonusBackground(scene, assetScale);
				});
				return;
			}

			// Check if the spine assets are loaded
			if (!scene.cache.json.has('BG-Bonus')) {
				console.warn('[BonusBackground] BG-Bonus spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createPortraitBonusBackground(scene, assetScale);
				});
				return;
			}

			this.bgBonusSpine = (scene.add as any).spine?.(
				scene.scale.width * 0.5,
				scene.scale.height * 0.5,
				'BG-Bonus',
				'BG-Bonus-atlas'
			) as SpineGameObject;
			if (!this.bgBonusSpine) {
				throw new Error('scene.add.spine returned null/undefined for BG-Bonus');
			}
			this.bgBonusSpine.setOrigin(0.5, 0.5);
			this.bgBonusSpine.setScale(assetScale);
			
			// Play Bonus_Mode_FIS animation (loop it)
			this.bgBonusSpine.animationState.setAnimation(0, 'Bonus_Mode_FIS', true);
			
			this.bonusContainer.add(this.bgBonusSpine);
			console.log('[BonusBackground] Created BG-Bonus spine animation');
		} catch (error) {
			console.error('[BonusBackground] Failed to create BG-Bonus spine animation:', error);
		}

		// Add reel-container image at center of symbols grid
		this.createReelContainer(scene, assetScale);
	}

	private createLandscapeBonusBackground(scene: Scene, assetScale: number): void {
		console.log("[BonusBackground] Creating landscape bonus background layout");
		
		// Add main bonus background as spine animation
		try {
			if (!ensureSpineFactory(scene, '[BonusBackground] createLandscapeBonusBackground')) {
				console.warn('[BonusBackground] Spine factory not available yet; will retry BG-Bonus spine later');
				scene.time.delayedCall(250, () => {
					this.createLandscapeBonusBackground(scene, assetScale);
				});
				return;
			}

			// Check if the spine assets are loaded
			if (!scene.cache.json.has('BG-Bonus')) {
				console.warn('[BonusBackground] BG-Bonus spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createLandscapeBonusBackground(scene, assetScale);
				});
				return;
			}

			this.bgBonusSpine = (scene.add as any).spine?.(
				scene.scale.width * 0.5,
				scene.scale.height * 0.5,
				'BG-Bonus',
				'BG-Bonus-atlas'
			) as SpineGameObject;
			if (!this.bgBonusSpine) {
				throw new Error('scene.add.spine returned null/undefined for BG-Bonus');
			}
			this.bgBonusSpine.setOrigin(0.5, 0.5);
			this.bgBonusSpine.setScale(assetScale);
			
			// Play Bonus_Mode_FIS animation (loop it)
			this.bgBonusSpine.animationState.setAnimation(0, 'Bonus_Mode_FIS', true);
			
			this.bonusContainer.add(this.bgBonusSpine);
			console.log('[BonusBackground] Created BG-Bonus spine animation');
		} catch (error) {
			console.error('[BonusBackground] Failed to create BG-Bonus spine animation:', error);
		}

		// Add reel-container image at center of symbols grid
		this.createReelContainer(scene, assetScale);
	}

	private createReelContainer(scene: Scene, assetScale: number): void {
		// Position at the center of symbols grid (same positioning as Symbols component)
		const centerX = scene.scale.width * 0.5;
		const centerY = scene.scale.height * 0.39;

		// Create reel-container background
		this.reelContainerImage = scene.add.image(
			centerX,
			centerY,
			'reel-container'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.5).setDepth(1); // Behind symbols but above background

		this.bonusContainer.add(this.reelContainerImage);
		console.log('[BonusBackground] Created reel-container image at symbols grid center');

		// Create reel-container frame on top of symbols grid and reel-container
		// Add directly to scene (not bonusContainer) to ensure proper depth layering above symbols
		this.reelContainerFrameImage = scene.add.image(
			centerX,
			centerY,
			'reel-container-frame'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.5).setDepth(750); // Above symbols (max 600) but below dialogs (1000)

		console.log('[BonusBackground] Created reel-container-frame image on top of symbols grid');
	}

	resize(scene: Scene): void {
		if (this.bonusContainer) {
			this.bonusContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bonusContainer;
	}

	destroy(): void {
		// Destroy bonus background spine animation
		if (this.bgBonusSpine) {
			this.bgBonusSpine.destroy();
			this.bgBonusSpine = null;
		}

		// Destroy reel-container frame image (added directly to scene, not container)
		if (this.reelContainerFrameImage) {
			this.reelContainerFrameImage.destroy();
			this.reelContainerFrameImage = null;
		}

		// Destroy bonus container (will also destroy reel-container image inside it)
		if (this.bonusContainer) {
			this.bonusContainer.destroy();
		}

		// Clear references
		this.reelContainerImage = null;
	}

}
