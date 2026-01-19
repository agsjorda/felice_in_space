import { Scene } from "phaser";
import { NetworkManager } from "../../managers/NetworkManager";
import { ScreenModeManager } from "../../managers/ScreenModeManager";
import { AssetConfig } from "../../config/AssetConfig";
import { gameStateManager } from "../../managers/GameStateManager";
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { ensureSpineFactory } from "../../utils/SpineGuard";

export class Background {
	private bgContainer: Phaser.GameObjects.Container;
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private scene: Scene | null = null;
	private shineInstances: Phaser.GameObjects.Image[] = [];
	private activeShineCount: number = 0;
	private readonly MAX_SHINES: number = 5;
	private shineTimer: Phaser.Time.TimerEvent | null = null;
	private bgDefaultSpine: SpineGameObject | null = null;
	private reelContainerImage: Phaser.GameObjects.Image | null = null;
	private reelContainerFrameImage: Phaser.GameObjects.Image | null = null;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	preload(scene: Scene): void {
		// Assets are now loaded centrally through AssetConfig in Preloader
		console.log(`[Background] Assets loaded centrally through AssetConfig`);
	}

	create(scene: Scene): void {
		console.log("[Background] Creating background elements");
		
		// Store scene reference
		this.scene = scene;
		
		// Create main container for all background elements
		this.bgContainer = scene.add.container(0, 0);
		
		const screenConfig = this.screenModeManager.getScreenConfig();
		const assetScale = this.networkManager.getAssetScale();
		
		console.log(`[Background] Creating background with scale: ${assetScale}x`);

		// Add background layers
		this.createBackgroundLayers(scene, assetScale);
		
		// Add decorative elements
		//this.createDecorativeElements(scene, assetScale);
		
		// Add UI elements
		//this.createUIElements(scene, assetScale);
	}

	private createBackgroundLayers(scene: Scene, assetScale: number): void {
		// Add main background as spine animation
		try {
			if (!ensureSpineFactory(scene, '[Background] createBackgroundLayers')) {
				console.warn('[Background] Spine factory not available yet; will retry BG-Default spine later');
				scene.time.delayedCall(250, () => {
					this.createBackgroundLayers(scene, assetScale);
				});
				return;
			}

			// Check if the spine assets are loaded
			if (!scene.cache.json.has('BG-Default')) {
				console.warn('[Background] BG-Default spine assets not loaded yet, will retry later');
				// Set up a retry mechanism
				scene.time.delayedCall(1000, () => {
					this.createBackgroundLayers(scene, assetScale);
				});
				return;
			}

			this.bgDefaultSpine = (scene.add as any).spine?.(
				scene.scale.width * 0.5 - 3.5,
				scene.scale.height * 0.5 + 93,
				'BG-Default',
				'BG-Default-atlas'
			) as SpineGameObject;
			if (!this.bgDefaultSpine) {
				throw new Error('scene.add.spine returned null/undefined for BG-Default');
			}
			this.bgDefaultSpine.setOrigin(0.5, 0.5);
			this.bgDefaultSpine.setScale(assetScale);
			
			// Play Default_BG_FIS animation (loop it)
			this.bgDefaultSpine.animationState.setAnimation(0, 'Default_BG_FIS', true);
			
			this.bgContainer.add(this.bgDefaultSpine);
			console.log('[Background] Created BG-Default spine animation');
		} catch (error) {
			console.error('[Background] Failed to create BG-Default spine animation:', error);
		}

		// Add shine effect
		this.createShineEffect(scene, assetScale);

		// Add reel-container image at center of symbols grid
		this.createReelContainer(scene, assetScale);

    /*
    
    	// Add bulbs
		const bulb1 = scene.add.image(
			scene.scale.width * 0.21,
			scene.scale.height * 0.40,
			'bulb-01'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb1);

		const bulb2 = scene.add.image(
			scene.scale.width * 0.521,
			scene.scale.height * 0.40,
			'bulb-02'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb2);

		const bulb3 = scene.add.image(
			scene.scale.width * 0.818,
			scene.scale.height * 0.40,
			'bulb-03'
		).setOrigin(0.5, 0.5).setScale(0.43);
		this.bgContainer.add(bulb3);
    */

    // Tent moved to Header component
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
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.5).setDepth(1); // Behind symbols but above background spine

		this.bgContainer.add(this.reelContainerImage);
		console.log('[Background] Created reel-container image at symbols grid center');

		// Create reel-container frame on top of symbols grid and reel-container
		// Add directly to scene (not bgContainer) to ensure proper depth layering above symbols
		this.reelContainerFrameImage = scene.add.image(
			centerX,
			centerY,
			'reel-container-frame'
		).setOrigin(0.5, 0.5).setScale(assetScale * 0.5).setDepth(750); // Above symbols (max 600) but below dialogs (1000)

		console.log('[Background] Created reel-container-frame image on top of symbols grid');
	}

	private createShineEffect(scene: Scene, assetScale: number): void {
		// Create pool of shine images (max 5)
		for (let i = 0; i < this.MAX_SHINES; i++) {
			const shine = scene.add.image(0, 0, 'shine')
				.setOrigin(0.5, 0.5)
				.setScale(0)
				.setAlpha(1)
				.setDepth(0) // Behind reel-container (depth 1)
				.setVisible(false);
			this.bgContainer.add(shine); // Add to bgContainer for proper layering with reel-container
			this.shineInstances.push(shine);
		}
		
		// Start the random shine animation cycle
		this.scheduleNextShine(scene, assetScale);
	}

	private scheduleNextShine(scene: Scene, assetScale: number): void {
		// Random delay between 2-5 seconds before next shine appears
		const delay = Phaser.Math.Between(400, 700);
		
		this.shineTimer = scene.time.delayedCall(delay, () => {
			// Only create new shine if we haven't reached the max
			if (this.activeShineCount < this.MAX_SHINES) {
				this.playShineAnimation(scene, assetScale);
			}
			// Always schedule the next attempt
			this.scheduleNextShine(scene, assetScale);
		});
	}

	private playShineAnimation(scene: Scene, assetScale: number): void {
		// Find an available shine instance
		const shine = this.shineInstances.find(s => !s.visible);
		if (!shine) return; // All shines are active

		// Increment active count
		this.activeShineCount++;

		// Define the area where shine can appear (from top until 1/4 of the screen)
		// Adjust these values to control the range
		const minX = scene.scale.width * 0;
		const maxX = scene.scale.width * 1;
		const minY = scene.scale.height * 0;
		const maxY = scene.scale.height * 0.6;

		// Random position within the defined area
		const randomX = Phaser.Math.Between(minX, maxX);
		const randomY = Phaser.Math.Between(minY, maxY);

		// Set position and initial state
		shine.setPosition(randomX, randomY);
		shine.setScale(0);
		shine.setAlpha(1);
		shine.setVisible(true);

		// Scale up animation
		const scaleUpDuration = 400;
		const scaleDownDuration = 400;
		const holdDuration = 200;
		const maxScale = assetScale * Phaser.Math.FloatBetween(0.8, 1.2); // Random scale variation

		scene.tweens.add({
			targets: shine,
			scale: maxScale,
			duration: scaleUpDuration,
			ease: 'Sine.easeOut',
			onComplete: () => {
				// Hold at max scale briefly
				scene.time.delayedCall(holdDuration, () => {
					if (shine && shine.visible) {
						// Scale down animation
						scene.tweens.add({
							targets: shine,
							scale: 0,
							duration: scaleDownDuration,
							ease: 'Sine.easeIn',
							onComplete: () => {
								if (shine) {
									shine.setVisible(false);
								}
								// Decrement active count
								this.activeShineCount = Math.max(0, this.activeShineCount - 1);
							}
						});
					}
				});
			}
		});
	}

	private createDecorativeElements(scene: Scene, assetScale: number): void {
		// Add balloons
		const balloon1 = scene.add.image(
			scene.scale.width * 0.04,
			scene.scale.height * 0.5,
			'balloon-01'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon1);

		const balloon2 = scene.add.image(
			scene.scale.width * 0.06,
			scene.scale.height * 0.3,
			'balloon-02'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon2);

		const balloon3 = scene.add.image(
			scene.scale.width * 0.95,
			scene.scale.height * 0.6,
			'balloon-03'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon3);

		const balloon4 = scene.add.image(
			scene.scale.width * 0.92,
			scene.scale.height * 0.35,
			'balloon-04'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(balloon4);

		// Add Christmas lights
		const xmasLights = scene.add.image(
			scene.scale.width * 0.495,
			scene.scale.height * 0.40,
			'reel-xmaslight-default'
		).setOrigin(0.5, 0.5).setScale(assetScale);
		this.bgContainer.add(xmasLights);

	
	}

	private createUIElements(scene: Scene, assetScale: number): void {
		// Add logo
		const logo = scene.add.image(
			scene.scale.width * 0.5,
			scene.scale.height * 0.05,
			'header-logo'
		).setOrigin(0.5, 0.5).setScale(assetScale).setDepth(1);
		this.bgContainer.add(logo);
	}

	resize(scene: Scene): void {
		if (this.bgContainer) {
			this.bgContainer.setSize(scene.scale.width, scene.scale.height);
		}
	}

	getContainer(): Phaser.GameObjects.Container {
		return this.bgContainer;
	}

	/**
	 * Clean up when component is destroyed
	 */
	destroy(): void {
		if (this.shineTimer) {
			this.shineTimer.destroy();
			this.shineTimer = null;
		}
		// Destroy all shine instances
		this.shineInstances.forEach(shine => {
			if (shine) {
				shine.destroy();
			}
		});
		this.shineInstances = [];
		this.activeShineCount = 0;
		
		// Destroy background spine animation
		if (this.bgDefaultSpine) {
			this.bgDefaultSpine.destroy();
			this.bgDefaultSpine = null;
		}

		// Destroy reel-container image
		if (this.reelContainerImage) {
			this.reelContainerImage.destroy();
			this.reelContainerImage = null;
		}

		// Destroy reel-container frame image
		if (this.reelContainerFrameImage) {
			this.reelContainerFrameImage.destroy();
			this.reelContainerFrameImage = null;
		}
	}
}
