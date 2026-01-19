/**
 * Game Scene - STABLE VERSION v1.0
 * 
 * This version includes:
 * - Complete asset management system with AssetConfig and AssetLoader
 * - NetworkManager and ScreenModeManager integration
 * - Background, Header, Symbols, and SlotController components
 * - BonusBackground and BonusHeader components (commented out)
 * - Proper event handling and backend integration
 * 
 * Base stable version - revert to this if future changes break functionality
 */
import { EventBus } from '../EventBus';
import { Scene } from 'phaser';
import { Background } from '../components/Background';
import { Header } from '../components/Header';
import { SlotController } from '../components/SlotController';
import { NetworkManager } from '../../managers/NetworkManager';
import { ScreenModeManager } from '../../managers/ScreenModeManager';
import { AssetConfig } from '../../config/AssetConfig';
import { PaylineData } from '../../backend/SpinData';
import { AssetLoader } from '../../utils/AssetLoader';
import { Symbols } from '../components/Symbols';
import { GameData } from '../components/GameData';
import { BonusBackground } from '../components/BonusBackground';
import { BonusHeader } from '../components/BonusHeader';
import { Dialogs } from '../components/Dialogs';
import { BetOptions } from '../components/BetOptions';
import { AutoplayOptions } from '../components/AutoplayOptions';
import { gameEventManager, GameEventType } from '../../event/EventManager';
import { gameStateManager } from '../../managers/GameStateManager';
import { SymbolExplosionTransition } from '../components/SymbolExplosionTransition';
import { CoinAnimation } from '../components/CoinAnimation';
import { GameAPI } from '../../backend/GameAPI';
import { SpinData } from '../../backend/SpinData';
import { AudioManager, MusicType, SoundEffectType } from '../../managers/AudioManager';
import { Menu } from '../components/Menu';
import { FullScreenManager } from '../../managers/FullScreenManager';
import { ScatterAnticipation } from '../components/ScatterAnticipation';
import { ClockDisplay } from '../components/ClockDisplay';
import WinTracker from '../components/WinTracker';
import { FreeRoundManager } from '../components/FreeRoundManager';

export class Game extends Scene
{
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;
	private gameStateManager: typeof gameStateManager;
	private background: Background;
	private header: Header;
	private slotController: SlotController;
	private assetConfig: AssetConfig;
	private assetLoader: AssetLoader;

	private bonusBackground: BonusBackground;
	private bonusHeader: BonusHeader;
	private dialogs: Dialogs;
	private betOptions: BetOptions;
	private autoplayOptions: AutoplayOptions;
	private candyTransition: SymbolExplosionTransition;
	private coinAnimation: CoinAnimation;
	public gameAPI: GameAPI;
	public audioManager: AudioManager;
	private menu: Menu;
	private scatterAnticipation: ScatterAnticipation;
	private clockDisplay: ClockDisplay;
	private winTracker: WinTracker;
	private freeRoundManager: FreeRoundManager | null = null;
	
	// Note: Payout data now calculated directly from paylines in WIN_STOP handler
	// Track whether this spin has winlines to animate
	private hasWinlinesThisSpin: boolean = false;
	
	// Queue for wins that occur while a dialog is already showing
	private winQueue: Array<{ payout: number; bet: number }> = [];
	private suppressWinDialogsUntilNextSpin: boolean = false;

	public gameData: GameData;
	private symbols: Symbols;

	constructor ()
	{
		super('Game');

		this.gameData = new GameData();
		this.symbols = new Symbols();
		this.menu = new Menu();
		this.scatterAnticipation = new ScatterAnticipation();
	}

	init (data: any)
	{
		// Receive managers from Preloader scene
		this.networkManager = data.networkManager;
		this.screenModeManager = data.screenModeManager;
		
		// Initialize game state manager
		this.gameStateManager = gameStateManager;
		console.log(`[Game] Initial isBonus state: ${this.gameStateManager.isBonus}`);
		
		// Initialize asset configuration
		this.assetConfig = new AssetConfig(this.networkManager, this.screenModeManager);
		
		// Initialize GameAPI
		// Prefer the instance passed from Preloader so we can reuse initialization data.
		if (data.gameAPI) {
			console.log('[Game] Using GameAPI instance from Preloader');
			this.gameAPI = data.gameAPI as GameAPI;
		} else {
			console.log('[Game] No GameAPI instance passed from Preloader, creating a new one');
			this.gameAPI = new GameAPI(this.gameData);
		}
		this.assetLoader = new AssetLoader(this.assetConfig);
		
		console.log(`[Game] Received managers from Preloader`);
	}

	public getCurrentBetAmount(): number {
		if (this.slotController) {
			const betText = this.slotController.getBetAmountText?.();
			const parsedBet = betText ? parseFloat(betText) : Number.NaN;
			if (!Number.isNaN(parsedBet) && parsedBet > 0) {
				return parsedBet;
			}

			const baseBet = this.slotController.getBaseBetAmount?.();
			if (typeof baseBet === 'number' && baseBet > 0) {
				return baseBet;
			}
		}
		return 1;
	}

	preload () 
	{
		// Assets are now loaded in Preloader scene
		console.log(`[Game] Assets already loaded in Preloader scene`);
		console.log(`[Game] Backend service initialized via GameStateManager`);

		// Preload Menu assets specific to the Game scene
		this.menu.preload(this);
	}

	create ()
	{
		console.log(`[Game] Creating game scene`);
		
		// Set physics world bounds (physics is already enabled globally)
		if (this.physics && this.physics.world) {
			this.physics.world.setBounds(0, 0, this.scale.width, this.scale.height - 220);
			console.log('[Game] Physics world bounds set');
		} else {
			console.warn('[Game] Physics system not available');
		}
		
		// Create fade overlay for transition from black
		const fadeOverlay = this.add.rectangle(
			this.scale.width * 0.5,
			this.scale.height * 0.5,
			this.scale.width,
			this.scale.height,
			0x000000
		).setOrigin(0.5, 0.5).setScrollFactor(0).setAlpha(1);
		
		// Backend initialization removed - using SlotController autoplay system
		// Create header using the managers
		this.header = new Header(this.networkManager, this.screenModeManager);
		this.header.create(this);
		
		// Create background using the managers
		this.background = new Background(this.networkManager, this.screenModeManager);
		this.background.create(this);
		
		// Create header using the managers
		this.header = new Header(this.networkManager, this.screenModeManager);
		this.header.create(this);

		// Create persistent clock display (stays on screen)
		// Match positioning + formatting with Preloader scene for consistency
		const clockY = this.scale.height * 0.015;
		this.clockDisplay = new ClockDisplay(this, {
			offsetX: -140,
			offsetY: clockY,
			fontSize: 16,
			fontFamily: 'poppins-regular',
			color: '#FFFFFF',
			alpha: 0.5,
			depth: 30000,
			scale: 0.7,
			suffixText: ` | Felice in Space${this.gameAPI.getDemoState() ? ' | DEMO' : ''}`,
			additionalText: 'DiJoker',
			additionalTextOffsetX: 185,
			additionalTextOffsetY: 0,
			additionalTextScale: 0.7,
			additionalTextColor: '#FFFFFF',
			additionalTextFontSize: 16,
			additionalTextFontFamily: 'poppins-regular'
		});
		this.clockDisplay.create();

		// Create bonus background using the managers (initially hidden)
		console.log('[Game] Creating bonus background...');
		this.bonusBackground = new BonusBackground(this.networkManager, this.screenModeManager);
		this.bonusBackground.create(this);
		this.bonusBackground.getContainer().setVisible(false);
		console.log('[Game] Bonus background created and hidden');

		// Create bonus header using the managers (initially hidden)
		console.log('[Game] Creating bonus header...');
		this.bonusHeader = new BonusHeader(this.networkManager, this.screenModeManager);
		this.bonusHeader.create(this);
		this.bonusHeader.getContainer().setVisible(false);
		console.log('[Game] Bonus header created and hidden');

		// Create WinTracker (used to display per-symbol wins)
		this.winTracker = new WinTracker();
		this.winTracker.create(this);
		// Reduce symbol icon size in WinTracker
		this.winTracker.setLayout({ iconScale: 0.13 });
		(this as any).winTracker = this.winTracker;

		//Create symbols
		console.log(`[Game] Creating symbols...`);
		this.symbols.create(this);

		// Initialize AudioManager
		this.audioManager = new AudioManager(this);
		console.log('[Game] AudioManager initialized');

		// Defer audio: it may still be downloading (started in Preloader), so initialize when ready.
		this.time.delayedCall(0, () => {
			// Some browsers (especially mobile) keep AudioContext locked/suspended until a user gesture,
			// even if audio files are already downloaded. This can look like "audio loaded but silent".
			const isAudioLockedOrSuspended = (): boolean => {
				try {
					const soundMgr: any = this.sound as any;
					if (!soundMgr) return false;
					if (soundMgr.locked === true) return true;
					const ctx: any = soundMgr.context;
					if (ctx && typeof ctx.state === 'string' && ctx.state === 'suspended') return true;
				} catch {}
				return false;
			};

			const tryUnlockAudio = (): void => {
				try {
					const soundMgr: any = this.sound as any;
					if (!soundMgr) return;
					// Phaser WebAudioSoundManager has `unlock()` in many builds.
					if (typeof soundMgr.unlock === 'function') {
						try { soundMgr.unlock(); } catch {}
					}
					const ctx: any = soundMgr.context;
					if (ctx && typeof ctx.resume === 'function' && ctx.state === 'suspended') {
						try { ctx.resume(); } catch {}
					}
				} catch {}
			};

			// Last resort: if the game starts before the first user gesture reaches the sound system,
			// unlock on the first pointerdown anywhere in the Game scene.
			try {
				this.input.once('pointerdown', () => {
					tryUnlockAudio();
					// After unlocking, re-trigger the normal retry-based init (which is lock-aware and idempotent).
					try { this.time.delayedCall(0, () => ensureAudioReady(0)); } catch {}
				});
			} catch {}

			const audioCacheHas = (key: string): boolean => {
				try {
					const c: any = (this.cache.audio as any);
					if (c && typeof c.exists === 'function') return !!c.exists(key);
					if (c && typeof c.has === 'function') return !!c.has(key);
				} catch {}
				return false;
			};

			const isLoaderBusy = (): boolean => {
				try {
					const l: any = this.load as any;
					if (l && typeof l.isLoading === 'function') return !!l.isLoading();
					if (l && typeof l.isLoading === 'boolean') return !!l.isLoading;
					// Best-effort fallback for older Phaser builds
					if (l && typeof l.state === 'number') return l.state !== 0;
				} catch {}
				return false;
			};

			const tryInitAudio = (): boolean => {
				// If audio is still locked/suspended, don't spam play calls; try to unlock and retry shortly.
				if (isAudioLockedOrSuspended()) {
					tryUnlockAudio();
					return false;
				}
				try {
					this.audioManager.createMusicInstances();
					this.audioManager.playBackgroundMusic(MusicType.MAIN);
					console.log('[Game] Audio instances created and background music started');
					return true;
				} catch (_e) {
					return false;
				}
			};

			// Keep retrying for a while: on mobile, audio download/decode (or in-flight loads) can lag behind scene start.
			const maxAttempts = 40; // ~10-15s depending on backoff
			const ensureAudioReady = (attempt: number) => {
				if (tryInitAudio()) return;
				if (attempt >= maxAttempts) {
					console.warn('[Game] Audio not ready after retries; leaving muted until next user action');
					return;
				}

				// If this Scene loader is already busy, wait for it to finish then retry.
				if (isLoaderBusy()) {
					this.load.once('complete', () => ensureAudioReady(attempt + 1));
					return;
				}

				// Otherwise, background-load audio on this scene as a fallback (e.g., user clicked early).
				try {
					const audioAssets = new AssetConfig(this.networkManager, this.screenModeManager).getAudioAssets();
					const audioMap = audioAssets.audio || {};
					let queued = 0;
					for (const [key, path] of Object.entries(audioMap)) {
						if (audioCacheHas(key)) continue;
						try { this.load.audio(key, path as string); queued++; } catch {}
					}

					if (queued > 0) {
						console.log(`[Game] Background-loading ${queued} audio files (fallback)`);
						this.load.once('complete', () => ensureAudioReady(attempt + 1));
						this.load.start();
						return;
					}
				} catch (e) {
					console.warn('[Game] Failed to queue background audio load:', e);
				}

				// Nothing queued (or queue failed): retry with backoff to handle decode/in-flight timing.
				const delay = Math.min(1200, 150 + attempt * 75);
				this.time.delayedCall(delay, () => ensureAudioReady(attempt + 1));
			};

			ensureAudioReady(0);
		});

		// Make AudioManager available globally for other components
		(window as any).audioManager = this.audioManager;
		
		// Create dialogs using the managers
		this.dialogs = new Dialogs(this.networkManager, this.screenModeManager);
		this.dialogs.create(this);
		
		// Initialize scatter animation manager with containers and dialogs component
		const scatterAnimationManager = this.symbols.scatterAnimationManager;
		scatterAnimationManager.initialize(this, this.symbols.container, this.dialogs);
		
		// Create bet options using the managers
		this.betOptions = new BetOptions(this.networkManager, this.screenModeManager);
		this.betOptions.create(this);
		
		// Create autoplay options using the managers
		this.autoplayOptions = new AutoplayOptions(this.networkManager, this.screenModeManager);
		this.autoplayOptions.create(this);
		
		// Create slot controller using the managers
		this.slotController = new SlotController(this.networkManager, this.screenModeManager);
		this.slotController.setSymbols(this.symbols); // Set symbols reference for free spin data access
		this.slotController.setBuyFeatureReference(); // Set BuyFeature reference for bet access
		this.slotController.create(this);

		// Create free round manager AFTER SlotController so it can mirror the spin button.
		// It will read the backend initialization data and decide whether to show itself.
		try {
			const initData = this.gameAPI.getInitializationData();
			const initFsRemaining = this.gameAPI.getRemainingInitFreeSpins();
			const initFsBet = this.gameAPI.getInitFreeSpinBet();

			this.freeRoundManager = new FreeRoundManager();
			this.freeRoundManager.create(this, this.gameAPI, this.slotController);

			if (initData && initData.hasFreeSpinRound && initFsRemaining > 0) {
				console.log(
					`[Game] Initialization indicates free spin round available (${initFsRemaining}). Enabling FreeRoundManager UI.`
				);

				// If backend provided a bet size for the free rounds, apply it to the SlotController
				// so both the UI and the underlying base bet used for spins match the init data.
				if (this.slotController && initFsBet && initFsBet > 0) {
					console.log(
						`[Game] Applying initialization free spin bet to SlotController: ${initFsBet.toFixed(2)}`
					);
					this.slotController.updateBetAmount(initFsBet);
				}

				this.freeRoundManager.setFreeSpins(initFsRemaining);
				this.freeRoundManager.enableFreeSpinMode();
			}
		} catch (e) {
			console.warn('[Game] Failed to create FreeRoundManager from initialization data:', e);
		}
		
		// Create symbol explosion transition component and play at scene start
		this.candyTransition = new SymbolExplosionTransition(this);

		// Limit explosion symbols to the ones currently present on the grid (if available)
		let allowedSymbols: number[] | undefined;
		try {
			const grid: any = (this.symbols as any)?.currentSymbolData;
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
			// If anything goes wrong, fall back to using all available symbol spines
		}

		this.candyTransition.play(undefined, { allowedSymbols });
		
		// Create coin animation component
		this.coinAnimation = new CoinAnimation(this.networkManager, this.screenModeManager);
		this.coinAnimation.create(this);

		// Create scatter anticipation component inside Symbols container so it's clipped by the reel mask
		// (and inserted behind symbols).
		this.scatterAnticipation.create(this, this.symbols.container);
		this.scatterAnticipation.hide();
		(this as any).scatterAnticipation = this.scatterAnticipation;
		
		// Initialize balance on game start
		this.initializeGameBalance();
		
		// Emit START event AFTER SlotController is created
		console.log(`[Game] Emitting START event to initialize game...`);
		gameEventManager.emit(GameEventType.START);
		
		// Trigger initial symbol display
		console.log(`[Game] Starting game...`);
		// Game starts automatically when scene is created
		
		// Initialize winnings display
		this.header.initializeWinnings();
		
		// Setup bonus mode event listeners
		this.setupBonusModeEventListeners();
		
		EventBus.emit('current-scene-ready', this);

		// Fade in from black after all components are created
		this.tweens.add({
			targets: fadeOverlay,
			alpha: 0,
			duration: 1000,
			ease: 'Power2',
			onComplete: () => {
				console.log('[Game] Fade in from black complete');
				// Remove the fade overlay to clean up
				fadeOverlay.destroy();
			}
		});

		// Trigger layered effects when game starts
		console.log(`[Game] Triggering layered effects...`);
		

		// Show congratulations dialog (on top)
		//this.dialogs.showPaintEffect(this);
		
		// Show congratulations dialog (on top)
		//this.dialogs.showCongrats(this);

		// Show congratulations dialog (on top)
		//this.dialogs.showFreeSpinDialog(this);

		// Show large win dialog (on top)
		//this.dialogs.showLargeWin(this);

		// Show medium win dialog (on top)
		//this.dialogs.showMediumWin(this);

		// Bet options will be shown when + or - buttons are clicked

		// Show small win dialog (on top)
		//this.dialogs.showSmallWin(this, { winAmount: 123456789.00 });

		// Show medium win dialog (on top)
		//this.dialogs.showMediumWin(this, { winAmount: 2500000.50 });

		// Show large win dialog (on top)
		//this.dialogs.showLargeWin(this, { winAmount: 5000000.75 });

		// Show super win dialog (on top)
		// this.dialogs.showSuperWin(this, { winAmount: 10000000.00 });

		EventBus.on('spin', () => {
			this.spin();
		});

		// Listen for menu button click
		EventBus.on('menu', () => {
			console.log('[Game] Menu button clicked - toggling menu');
			this.menu.toggleMenu(this);
		});

		EventBus.on('show-bet-options', () => {
			console.log('[Game] Showing bet options with fade-in effect');
			
			// Get the current bet from the slot controller display
			const currentBetText = this.slotController.getBetAmountText();
			const currentBet = currentBetText ? parseFloat(currentBetText) : 0.20;
			
			this.betOptions.show({
				currentBet: currentBet,
				onClose: () => {
					console.log('[Game] Bet options closed');
				},
				onConfirm: (betAmount: number) => {
					console.log(`[Game] Bet confirmed: £${betAmount}`);
					// Update the bet display in the slot controller
					this.slotController.updateBetAmount(betAmount);
					// Update the bet amount in the backend
					gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: betAmount, previousBet: currentBet });
				}
			});
		});

		// Listen for autoplay button click
		EventBus.on('autoplay', () => {
			console.log('[Game] Autoplay button clicked - showing options');
			
			const currentBetText = this.slotController.getBetAmountText();
			const currentBet = currentBetText ? parseFloat(currentBetText) : 0.20;
			
			// Get the most current balance as a numeric value from the SlotController
			const currentBalance = this.slotController.getBalanceAmount();
			
			console.log(`[Game] Current balance for autoplay options: $${currentBalance}`);
			
			this.autoplayOptions.show({
				currentAutoplayCount: 10,
				currentBet: currentBet,
				currentBalance: currentBalance,
				onClose: () => {
					console.log('[Game] Autoplay options closed');
				},
				onConfirm: (autoplayCount: number) => {
					console.log(`[Game] Autoplay confirmed: ${autoplayCount} spins`);
					// Read the bet selected within the autoplay panel
					const selectedBet = this.autoplayOptions.getCurrentBet();
					// If bet changed, update UI and backend
					if (Math.abs(selectedBet - currentBet) > 0.0001) {
						// Use a dedicated API so amplify/enhance bet is preserved when active
						this.slotController.updateBetAmountFromAutoplay(selectedBet);
						gameEventManager.emit(GameEventType.BET_UPDATE, { newBet: selectedBet, previousBet: currentBet });
					}
					console.log(`[Game] Total cost: $${(selectedBet * autoplayCount).toFixed(2)}`);
					
					// Start autoplay using the new SlotController method
					this.slotController.startAutoplay(autoplayCount);
				}
			});
		});

		// Note: SPIN_RESPONSE event listeners removed - now using SPIN_DATA_RESPONSE

		// Coins are no longer spawned on wins; WIN_START remains for other systems

		// Listen for animations completion to show win dialogs (tumble-based)
		gameEventManager.on(GameEventType.WIN_STOP, (data: any) => {
			console.log('[Game] WIN_STOP event received (tumble-based evaluation)');
			
			// Get the current spin data from the Symbols component
			if (this.symbols && this.symbols.currentSpinData) {
				const spinData = this.symbols.currentSpinData;
				const tumbleResult = this.calculateTotalWinFromTumbles(spinData.slot?.tumbles || []);
				let totalWin = tumbleResult.totalWin;
				const hasCluster = tumbleResult.hasCluster;
				const betAmount = parseFloat(spinData.bet);

				// During free spins, prefer the totalWin coming from the matching freespin item
				// so win dialogs reflect the backend's per-spin total directly.
				if (gameStateManager.isBonus) {
					try {
						const slotAny: any = spinData.slot || {};
						const fs = slotAny.freespin || slotAny.freeSpin;
						const items = Array.isArray(fs?.items) ? fs.items : [];
						const area = slotAny.area;

						if (items.length > 0 && Array.isArray(area)) {
							// Find the freespin item whose area matches the current board
							const areaJson = JSON.stringify(area);
							const currentItem = items.find((item: any) =>
								Array.isArray(item?.area) && JSON.stringify(item.area) === areaJson
							);

							if (currentItem) {
								const itemTotalWinRaw = (currentItem as any).totalWin ?? (currentItem as any).subTotalWin ?? 0;
								const itemTotalWin = Number(itemTotalWinRaw);
								if (!isNaN(itemTotalWin) && itemTotalWin > 0) {
									console.log(`[Game] WIN_STOP: Overriding tumble totalWin with freespin item totalWin=${itemTotalWin}`);
									totalWin = itemTotalWin;
								}
							}
						}
					} catch (e) {
						console.warn('[Game] WIN_STOP: Failed to derive freespin item totalWin, falling back to tumble totalWin', e);
					}
				}

				console.log(`[Game] WIN_STOP: totalWin used for win dialog=$${totalWin}, hasCluster>=8=${hasCluster}`);
				if (hasCluster && totalWin > 0) {
					this.checkAndShowWinDialog(totalWin, betAmount);
				} else {
					console.log('[Game] WIN_STOP: No qualifying cluster wins (>=8) detected');
				}
			} else {
				console.log('[Game] WIN_STOP: No current spin data available');
			}

			// Demo mode: sync in-memory demo balance with base-game wins (no scatter/bonus)
			try {
				const isDemo =
					this.gameAPI.getDemoState() ||
					localStorage.getItem('demo') === 'true' ||
					sessionStorage.getItem('demo') === 'true';
				if (isDemo && !gameStateManager.isScatter && !gameStateManager.isBonus) {
					// If we had spin data, totalWin was computed above; otherwise treat as 0
					const symbolsAny: any = this.symbols as any;
					const spinData = symbolsAny?.currentSpinData;
					const tumbleResult = spinData ? this.calculateTotalWinFromTumbles(spinData.slot?.tumbles || []) : { totalWin: 0, hasCluster: false };
					const winForDemo = tumbleResult.totalWin || 0;
					if (winForDemo > 0) {
						this.gameAPI.updateDemoBalance(this.gameAPI.getDemoBalance() + winForDemo);
					}
				}
			} catch (e) {
				// Non-fatal: demo sync should never break the win flow
				console.warn('[Game] Demo balance sync failed:', e);
			}
			
			// Update balance from server after WIN_STOP (skip during scatter/bonus)
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceAfterWinStop();
			} else {
				console.log('[Game] Skipping balance update on WIN_STOP (scatter/bonus active)');
			}
		});

		// Listen for reel completion to handle balance updates only
		gameEventManager.on(GameEventType.REELS_STOP, () => {
			console.log('[Game] REELS_STOP event received');
			
			// Update balance from server after REELS_STOP (for no-wins scenarios)
			// Skip during scatter/bonus; balance will be finalized after bonus ends
			if (!gameStateManager.isScatter && !gameStateManager.isBonus) {
				this.updateBalanceAfterWinStop();
			} else {
				console.log('[Game] Skipping balance update on REELS_STOP (scatter/bonus active)');
			}
			
			// Request balance update to finalize the spin (add winnings to balance)
			// This is needed to complete the spin cycle and update the final state
			console.log('[Game] Reels done - requesting balance update to finalize spin');
			gameEventManager.emit(GameEventType.BALANCE_UPDATE);
			
			// Note: Win dialog logic moved to WIN_STOP handler using payline data
			// No fallback logic needed here - WinLineDrawer handles all timing
			console.log('[Game] REELS_STOP: Balance update requested, WIN_STOP handled by winline animations');
		});

		// Ensure WinTracker is cleared (with a fade-out) as soon as reels actually start for a new spin
		gameEventManager.on(GameEventType.REELS_START, () => {
			try {
				if (this.winTracker) {
					this.winTracker.hideWithFade(250);
					console.log('[Game] Fading out WinTracker on REELS_START (new spin started)');
				}
			} catch (e) {
				console.warn('[Game] Failed to clear WinTracker on REELS_START:', e);
			}
		});

		// Listen for dialog animations to complete
		this.events.on('dialogAnimationsComplete', () => {
			console.log('[Game] Dialog animations complete event received');
			// Re-allow win dialogs after transitions complete
			this.suppressWinDialogsUntilNextSpin = false;
			
			// Clear the win dialog state - autoplay can resume
			gameStateManager.isShowingWinDialog = false;
			console.log('[Game] Set isShowingWinDialog to false - autoplay can resume');
			
			// Check if there's a delayed scatter animation waiting to start
			this.checkAndStartDelayedScatterAnimation();
			
			// Note: Autoplay continuation is now handled by SlotController's WIN_DIALOG_CLOSED handler
			// No need to retry spin here as it conflicts with SlotController's autoplay logic
			
			// Process any remaining wins in the queue
			this.processWinQueue();
		});

		// Listen for any spin to start (manual or autoplay)
		gameEventManager.on(GameEventType.SPIN, (eventData: any) => {
			console.log('[Game] SPIN event received - clearing win queue for new spin');
			// Reset winlines tracking for the new spin
			this.hasWinlinesThisSpin = false;
			// Allow win dialogs again on the next spin
			this.suppressWinDialogsUntilNextSpin = false;
			
			// CRITICAL: Block autoplay spins if win dialog is showing, but allow manual spins
			// This fixes the timing issue where manual spins were blocked
			if (gameStateManager.isShowingWinDialog && this.gameData?.isAutoPlaying) {
				console.log('[Game] Autoplay SPIN event BLOCKED - win dialog is showing');
				console.log('[Game] Manual spins are still allowed to proceed');
				return;
			}

			// Clear any previously displayed WinTracker when a new spin actually starts
			try {
				if (this.winTracker) {
					this.winTracker.hideWithFade(250);
					console.log('[Game] Fading out WinTracker for new spin');
				}
			} catch (e) {
				console.warn('[Game] Failed to clear WinTracker on SPIN:', e);
			}
			
			// Only clear win queue if this is a new spin (not a retry of a paused spin)
			// Check if we're retrying a paused autoplay spin
			const isRetryingPausedSpin = this.gameData?.isAutoPlaying && this.winQueue.length > 0;
			
			if (!isRetryingPausedSpin) {
				this.clearWinQueue();
				console.log('[Game] Cleared win queue for new spin');
				
				// Only clear win dialog state for completely new spins
				gameStateManager.isShowingWinDialog = false;
				console.log('[Game] Cleared isShowingWinDialog state for new spin');
			} else {
				console.log('[Game] Not clearing win queue - retrying paused autoplay spin');
				console.log('[Game] Keeping isShowingWinDialog state for paused spin retry');
			}
		});

		// Listen for autoplay start to prevent it when win dialogs are showing
		gameEventManager.on(GameEventType.AUTO_START, (eventData: any) => {
			// When autoplay resumes, ensure win dialogs are allowed again
			this.suppressWinDialogsUntilNextSpin = false;
			if (gameStateManager.isShowingWinDialog) {
				console.log('[Game] AUTO_START blocked - win dialog is showing');
				// Don't allow autoplay to start while win dialog is showing
				return;
			}
			console.log('[Game] AUTO_START allowed - no win dialog showing');

			// Clear any previously displayed WinTracker when a new autoplay sequence starts
			try {
				if (this.winTracker) {
					this.winTracker.hideWithFade(250);
					console.log('[Game] Fading out WinTracker on AUTO_START');
				}
			} catch (e) {
				console.warn('[Game] Failed to clear WinTracker on AUTO_START:', e);
			}
		});
	}

	/**
	 * Initialize the game balance on start
	 */
	private async initializeGameBalance(): Promise<void> {
		try {
			console.log('[Game] Initializing game balance...');
			
			// Call the GameAPI to get the current balance
			const balance = await this.gameAPI.initializeBalance();
			
			// Update the SlotController balance display
			if (this.slotController) {
				this.slotController.updateBalanceAmount(balance);
				console.log(`[Game] Balance initialized and updated in SlotController: $${balance}`);
			}
			
			// Emit balance initialized event
			gameEventManager.emit(GameEventType.BALANCE_INITIALIZED, {
				newBalance: balance,
				previousBalance: 0,
				change: balance
			});
			
			console.log('[Game] Balance initialization completed successfully');
			
		} catch (error) {
			console.error('[Game] Error initializing balance:', error);
			// Use default balance if initialization fails
			const defaultBalance = 200000.00;
			if (this.slotController) {
				this.slotController.updateBalanceAmount(defaultBalance);
				console.log(`[Game] Using default balance: $${defaultBalance}`);
			}
		}
	}

	/**
	 * Update balance from server after WIN_STOP or REELS_STOP
	 */
	private async updateBalanceAfterWinStop(): Promise<void> {
		try {
			console.log('[Game] Updating balance from server after WIN_STOP/REELS_STOP...');
			
			// Call the GameAPI to get the current balance from server
			const balance = await this.gameAPI.initializeBalance();
			
			// Update the SlotController balance display
			if (this.slotController) {
				this.slotController.updateBalanceAmount(balance);
				console.log(`[Game] Balance updated after WIN_STOP/REELS_STOP: $${balance}`);
			}
			
			// Update autoplay options balance if visible
			this.updateAutoplayOptionsBalance(balance);
			
		} catch (error) {
			console.error('[Game] Error updating balance after WIN_STOP/REELS_STOP:', error);
		}
	}

	/**
	 * Update the AutoplayOptions balance display
	 */
	private updateAutoplayOptionsBalance(balance: number): void {
		if (this.autoplayOptions && this.autoplayOptions.isVisible()) {
			this.autoplayOptions.setCurrentBalance(balance);
		}
	}

	/**
	 * Calculate total win amount from paylines array
	 */
	private calculateTotalWinFromTumbles(tumbles: any[]): { totalWin: number; hasCluster: boolean } {
		if (!Array.isArray(tumbles) || tumbles.length === 0) {
			return { totalWin: 0, hasCluster: false };
		}
		let totalWin = 0;
		let hasCluster = false;
		for (const tumble of tumbles) {
			const w = Number(tumble?.win || 0);
			totalWin += isNaN(w) ? 0 : w;
			const outs = tumble?.symbols?.out || [];
			if (Array.isArray(outs)) {
				for (const out of outs) {
					const c = Number(out?.count || 0);
					if (c >= 8) { hasCluster = true; break; }
				}
			}
		}
		return { totalWin, hasCluster };
	}

	/**
	 * Check if payout reaches win dialog thresholds and show appropriate dialog
	 */
	private checkAndShowWinDialog(payout: number, bet: number): void {
		// Suppress win dialogs if we're transitioning out of bonus back to base
		if (this.suppressWinDialogsUntilNextSpin) {
			console.log('[Game] Suppressing win dialog (transitioning from bonus to base)');
			return;
		}
		console.log(`[Game] checkAndShowWinDialog called with payout: $${payout}, bet: $${bet}`);
		console.log(`[Game] Current win queue length: ${this.winQueue.length}`);
		console.log(`[Game] Current isShowingWinDialog state: ${gameStateManager.isShowingWinDialog}`);
		console.log(`[Game] Current dialog showing state: ${this.dialogs.isDialogShowing()}`);
		
		// Check if the win line animation was interrupted by a manual spin
		if (this.symbols && this.symbols.winLineDrawer && this.symbols.winLineDrawer.wasInterruptedBySpin()) {
			console.log('[Game] Win line animation was interrupted by manual spin - preventing win dialog from showing');
			return;
		}

		// If scatter is active and we're autoplaying (normal or free spin), defer win dialog
		// until after the free spin dialog finishes (dialogAnimationsComplete).
		// This ensures the sequence: scatter symbol anims -> free spin dialog -> win dialog.
		try {
			// Detect free spin autoplay via Symbols helper if available
			const symbolsAny: any = this.symbols as any;
			const isFreeSpinAutoplayActive =
				symbolsAny && typeof symbolsAny.isFreeSpinAutoplayActive === 'function'
					? !!symbolsAny.isFreeSpinAutoplayActive()
					: false;

			const isNormalAutoplayActive = !!(gameStateManager.isAutoPlaying || this.gameData?.isAutoPlaying);

			if (gameStateManager.isScatter && (isNormalAutoplayActive || isFreeSpinAutoplayActive)) {
				console.log('[Game] Scatter + autoplay detected - deferring win dialog until after free spin dialog closes');
				this.winQueue.push({ payout, bet });
				console.log(`[Game] Added to win queue due to scatter/autoplay. Queue length: ${this.winQueue.length}`);
				return;
			}
		} catch (e) {
			console.warn('[Game] Failed to evaluate scatter/autoplay deferral for win dialog:', e);
		}

		// If scatter retrigger animation is in progress, defer win dialog until retrigger dialog closes
		try {
			const symbolsAny: any = this.symbols as any;
			const isScatterRetriggerAnimationInProgress =
				symbolsAny && typeof symbolsAny.isScatterRetriggerAnimationInProgress === 'function'
					? !!symbolsAny.isScatterRetriggerAnimationInProgress()
					: false;
			
			if (isScatterRetriggerAnimationInProgress) {
				console.log('[Game] Scatter retrigger animation in progress - deferring win dialog until retrigger dialog closes');
				this.winQueue.push({ payout, bet });
				console.log(`[Game] Added to win queue due to scatter retrigger animation. Queue length: ${this.winQueue.length}`);
				// The existing dialogAnimationsComplete handler will process the queue after retrigger dialog closes
				return;
			}
		} catch (e) {
			console.warn('[Game] Failed to check scatter retrigger animation status:', e);
		}

		// If multiplier animations are in progress, defer win dialog until animations complete
		try {
			const symbolsAny: any = this.symbols as any;
			const isMultiplierAnimationsInProgress =
				symbolsAny && typeof symbolsAny.isMultiplierAnimationsInProgress === 'function'
					? !!symbolsAny.isMultiplierAnimationsInProgress()
					: false;
			
			if (isMultiplierAnimationsInProgress) {
				console.log('[Game] Multiplier animations in progress - deferring win dialog until MULTIPLIER_ANIMATIONS_COMPLETE');
				this.winQueue.push({ payout, bet });
				console.log(`[Game] Added to win queue due to multiplier animations. Queue length: ${this.winQueue.length}`);
				// Wait for multiplier animations to complete, then process the win queue
				gameEventManager.once(GameEventType.MULTIPLIER_ANIMATIONS_COMPLETE, () => {
					console.log('[Game] MULTIPLIER_ANIMATIONS_COMPLETE received - processing win queue');
					this.processWinQueue();
				});
				return;
			}
		} catch (e) {
			console.warn('[Game] Failed to check multiplier animation status:', e);
		}
		
		// Check if a dialog is already showing - prevent multiple dialogs
		if (this.dialogs.isDialogShowing()) {
			console.log('[Game] Dialog already showing, skipping win dialog for this payout');
			// Add to queue if dialog is already showing
			this.winQueue.push({ payout: payout, bet: bet });
			console.log(`[Game] Added to win queue. Queue length: ${this.winQueue.length}`);
			return;
		}
		
		const multiplier = payout / bet;
		console.log(`[Game] Win detected - Payout: $${payout}, Bet: $${bet}, Multiplier: ${multiplier}x`);
		
		// Only show dialogs for wins that are at least 20x the bet size
		if (multiplier < 20) {
			console.log(`[Game] Win below threshold (20x) - No dialog shown for ${multiplier.toFixed(2)}x multiplier`);
			// Clear the win dialog state since no dialog was shown
			gameStateManager.isShowingWinDialog = false;
			return;
		}
		
		// Determine which win dialog to show based on multiplier thresholds
		// Small win: 20x–<30x
		// Medium win: 30x–<45x
		// Large win: 45x–<60x
		// Super win: 60x+
		if (multiplier >= 60) {
			console.log(
				`[Game] Super Win! Showing SuperWin_Dialog dialog for ${multiplier.toFixed(2)}x multiplier (staged inside dialog)`
			);
			this.dialogs.showSuperWin(this, { winAmount: payout, betAmount: bet });
		} else if (multiplier >= 45) {
			console.log(
				`[Game] Large Win! Showing EpicWin_Dialog dialog for ${multiplier.toFixed(2)}x multiplier (staged inside dialog)`
			);
			this.dialogs.showLargeWin(this, { winAmount: payout, betAmount: bet });
		} else if (multiplier >= 30) {
			console.log(
				`[Game] Medium Win! Showing MegaWin_Dialog dialog for ${multiplier.toFixed(2)}x multiplier (staged inside dialog)`
			);
			this.dialogs.showMediumWin(this, { winAmount: payout, betAmount: bet });
		} else if (multiplier >= 20) {
			console.log(
				`[Game] Small Win! Showing BigWin_Dialog dialog for ${multiplier.toFixed(2)}x multiplier (no staging)`
			);
			this.dialogs.showSmallWin(this, { winAmount: payout, betAmount: bet });
		}
		
		console.log(`[Game] Win dialog should now be visible. isShowingWinDialog: ${gameStateManager.isShowingWinDialog}`);
	}
	/**
	 * Process the win queue to show the next win dialog
	 */
	private processWinQueue(): void {
		if (this.suppressWinDialogsUntilNextSpin) {
			console.log('[Game] Suppressing processing of win queue (transitioning from bonus to base)');
			return;
		}
		console.log(`[Game] processWinQueue called. Queue length: ${this.winQueue.length}`);
		console.log(`[Game] Current isShowingWinDialog state: ${gameStateManager.isShowingWinDialog}`);
		console.log(`[Game] Current dialog showing state: ${this.dialogs.isDialogShowing()}`);
		
		// Check dialog overlay visibility
		const dialogContainer = this.dialogs.getContainer();
		if (dialogContainer) {
			console.log(`[Game] Dialog overlay visible: ${dialogContainer.visible}, alpha: ${dialogContainer.alpha}`);
		}
		
		if (this.winQueue.length === 0) {
			console.log('[Game] Win queue is empty, nothing to process');
			return;
		}
		
		if (this.dialogs.isDialogShowing()) {
			console.log('[Game] Dialog still showing, cannot process win queue yet');
			return;
		}
		
		// Get the next win from the queue
		const nextWin = this.winQueue.shift();
		if (nextWin) {
			console.log(`[Game] Processing next win from queue: $${nextWin.payout} on $${nextWin.bet} bet. Queue remaining: ${this.winQueue.length}`);
			this.checkAndShowWinDialog(nextWin.payout, nextWin.bet);
		}
	}

	/**
	 * Clear the win queue (useful for resetting state)
	 */
	public clearWinQueue(): void {
		const queueLength = this.winQueue.length;
		this.winQueue = [];
		console.log(`[Game] Win queue cleared. Removed ${queueLength} pending wins`);
	}

	/**
	 * Get current win queue status for debugging
	 */
	private getWinQueueStatus(): string {
		return `Win Queue: ${this.winQueue.length} pending wins`;
	}


	/**
	 * Spawn coins manually (for testing or special events)
	 */
	public spawnCoins(count: number = 3): void {
		if (this.coinAnimation) {
			this.coinAnimation.spawnCoins(count);
			// Play coin throw SFX once when coins spawn
			try {
				const audio = (window as any).audioManager as AudioManager | undefined;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect(SoundEffectType.COIN_THROW);
				}
			} catch {}
		}
	}

	/**
	 * Spawn coins based on win amount and multiplier
	 */
	public spawnCoinsForWin(totalWin: number, betAmount: number): void {
		if (!this.coinAnimation) {
			console.warn('[Game] Coin animation not available for win');
			return;
		}

		const multiplier = totalWin / betAmount;
		let coinCount = 0;

		// Determine coin count based on win multiplier thresholds
		if (multiplier >= 60) {
			// Large win: 30 coins
			coinCount = 50;
			console.log(`[Game] Large Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 45) {
			// Super win: 20 coins
			coinCount = 30;
			console.log(`[Game] Super Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 30) {
			// Medium win: 15 coins
			coinCount = 20;
			console.log(`[Game] Medium Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else if (multiplier >= 20) {
			// Small win: 10 coins
			coinCount = 10;
			console.log(`[Game] Small Win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		} else {
			// Below threshold: 5 coins
			coinCount = 5;
			console.log(`[Game] Below threshold win! Spawning ${coinCount} coins for ${multiplier.toFixed(2)}x multiplier`);
		}
		// Delay 1 second before spawning coins and playing SFX
		this.time.delayedCall(500, () => {
			// Play coin throw SFX once at start of win-based coin spawn
			try {
				const audio = (window as any).audioManager as AudioManager | undefined;
				if (audio && typeof audio.playSoundEffect === 'function') {
					audio.playSoundEffect(SoundEffectType.COIN_THROW);
				}
			} catch {}
			// Spawn coins over 1.5 seconds
			this.spawnCoinsOverTime(coinCount, 1500);
		});
	}

	/**
	 * Spawn coins over a specified time period using the manually set position
	 */
	private spawnCoinsOverTime(totalCoins: number, durationMs: number): void {
		if (!this.coinAnimation) {
			return;
		}

		// Use the same position as the manually set position in CoinAnimation
		const centerX = this.scale.width * 0.65;
		const centerY = this.scale.height * 0.22;

		const intervalMs = durationMs / totalCoins;
		console.log(`[Game] Spawning ${totalCoins} coins over ${durationMs}ms (${intervalMs.toFixed(1)}ms per coin) at position (${centerX}, ${centerY})`);

		for (let i = 0; i < totalCoins; i++) {
			this.time.delayedCall(i * intervalMs, () => {
				this.coinAnimation.spawnSingleCoin(centerX, centerY);
			});
		}
	}

	/**
	 * Spawn a single coin at specific position
	 */
	public spawnSingleCoin(x?: number, y?: number, velocityX?: number, velocityY?: number): void {
		if (this.coinAnimation) {
			this.coinAnimation.spawnSingleCoin(x, y, velocityX, velocityY);
		}
	}

	/**
	 * Check if there's a delayed scatter animation waiting and start it
	 */
	private checkAndStartDelayedScatterAnimation(): void {
		if (this.symbols && this.symbols.scatterAnimationManager) {
			const scatterManager = this.symbols.scatterAnimationManager;
			
			// Check if there's delayed scatter data waiting
			if (scatterManager.delayedScatterData) {
				console.log('[Game] Found delayed scatter animation data - starting scatter animation after win dialogs');
				
				// Get the delayed data and clear it
				const delayedData = scatterManager.delayedScatterData;
				scatterManager.delayedScatterData = null;
				
				// Start the scatter animation with a small delay to ensure win dialogs are fully closed
				this.time.delayedCall(100, () => {
					console.log('[Game] Starting delayed scatter animation');
					scatterManager.playScatterAnimation(delayedData);
				});
			} else {
				console.log('[Game] No delayed scatter animation data found');
			}
		}
	}

	private setupBonusModeEventListeners(): void {
		// Listen for bonus mode events from dialogs
		this.events.on('setBonusMode', (isBonus: boolean) => {
			console.log(`[Game] Setting bonus mode: ${isBonus}`); 
			console.log(`[Game] Current gameStateManager.isBonus: ${this.gameStateManager.isBonus}`);
			
			// Ensure winnings display stays visible and transfers to bonus header on bonus start
			if (isBonus) {
				// Only transfer winnings if we're NOT already in bonus mode (i.e., this is the initial bonus activation)
				// During retriggers, we're already in bonus mode, so we should preserve the accumulated total
				const wasAlreadyInBonus = this.gameStateManager.isBonus;
				
				if (!wasAlreadyInBonus) {
					console.log('[Game] Bonus mode started - transferring winnings display to bonus header');
					try {
						const currentHeaderWin = this.header && typeof this.header.getCurrentWinnings === 'function'
							? Number(this.header.getCurrentWinnings()) || 0
							: 0;
						if (this.bonusHeader) {
							// Seed the bonus header with the current total shown on the main header
							if (typeof (this.bonusHeader as any).seedCumulativeWin === 'function') {
								(this.bonusHeader as any).seedCumulativeWin(currentHeaderWin);
								console.log(`[Game] Seeded BonusHeader with current header winnings: $${currentHeaderWin}`);
								
								// In bonus mode we only show per-tumble "YOU WON" values in the bonus header.
								// The seeded cumulative value is tracked internally; no immediate header UI update here.
							} else if (typeof this.bonusHeader.updateWinningsDisplay === 'function') {
								this.bonusHeader.updateWinningsDisplay(currentHeaderWin);
								console.log(`[Game] Updated BonusHeader winnings to: $${currentHeaderWin}`);
							}
						}
					} catch (e) {
						console.warn('[Game] Failed transferring winnings to BonusHeader on bonus start:', e);
					}
				} else {
					console.log('[Game] Already in bonus mode (retrigger detected) - preserving accumulated winnings total');
				}

				// Note: Bonus music is now played in showBonusBackground handler to synchronize with visual transition
			} else {
				console.log('[Game] Bonus mode ended - enabling winningsDisplay');
				// Ensure bonus-finished flag is cleared and bonus mode is turned off when leaving bonus
				this.gameStateManager.isBonus = false;
				this.gameStateManager.isBonusFinished = false;
				// Clear autoplay-related flags like on fresh spin
				this.gameStateManager.isAutoPlaying = false;
				this.gameStateManager.isAutoPlaySpinRequested = false;
				this.gameStateManager.isShowingWinlines = false;
				this.gameStateManager.isShowingWinDialog = false;
				// Suppress any win dialogs that might be triggered during the transition back to base
				this.suppressWinDialogsUntilNextSpin = true;
				// Prevent re-showing any queued base-game win dialogs after bonus ends
				this.clearWinQueue();
				// Proactively reset visuals and symbols in case the dialog didn't emit them
				this.events.emit('hideBonusBackground');
				this.events.emit('hideBonusHeader');
				this.events.emit('resetSymbolsForBase');
				// Reset free spin-related state across components
				this.events.emit('resetFreeSpinState');
				// Hide winnings displays on both headers (same as on spin start)
				try {
					if (this.header && typeof this.header.hideWinningsDisplay === 'function') {
						this.header.hideWinningsDisplay();
					}
					if (this.bonusHeader && typeof this.bonusHeader.hideWinningsDisplay === 'function') {
						this.bonusHeader.hideWinningsDisplay();
					}
					// Also fade out any lingering WinTracker entries when returning to base game
					if (this.winTracker) {
						this.winTracker.hideWithFade(250);
						console.log('[Game] Fading out WinTracker on bonus mode end (transition to base game)');
					}
				} catch (e) {
					console.warn('[Game] Failed to hide winnings displays on bonus end:', e);
				}
				// Notify other systems autoplay is fully stopped
				gameEventManager.emit(GameEventType.AUTO_STOP);
				// Switch back to main background music
				if (this.audioManager) {
					this.audioManager.playBackgroundMusic(MusicType.MAIN);
					console.log('[Game] Switched to main background music');
				}
			}
			
			// TODO: Update backend data isBonus flag if needed
		});

		this.events.on('showBonusBackground', () => {
			console.log('[Game] ===== SHOW BONUS BACKGROUND EVENT RECEIVED =====');
			console.log('[Game] Background exists:', !!this.background);
			console.log('[Game] BonusBackground exists:', !!this.bonusBackground);
			
			// Hide normal background
			if (this.background) {
				this.background.getContainer().setVisible(false);
				console.log('[Game] Normal background hidden');
			}
			
			// Show bonus background
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(true);
				console.log('[Game] Bonus background shown');
				console.log('[Game] Bonus background container visible:', this.bonusBackground.getContainer().visible);
			} else {
				console.error('[Game] BonusBackground is null!');
			}
			
			// Play bonus background music synchronized with background/header change
			if (this.audioManager && gameStateManager.isBonus) {
				const currentMusicType = this.audioManager.getCurrentMusicType();
				// Only play bonus music if we're not already playing it (or if free spin music is playing, we'll transition)
				if (currentMusicType !== MusicType.BONUS) {
					// If free spin music is playing, crossfade to bonus music
					if (currentMusicType === MusicType.FREE_SPIN) {
						this.audioManager.crossfadeTo(MusicType.BONUS, 600);
						console.log('[Game] Crossfading from free spin music to bonus background music');
					} else {
						// Otherwise, start playing bonus music
						this.audioManager.playBackgroundMusic(MusicType.BONUS);
						console.log('[Game] Started bonus background music synchronized with background/header change');
					}
				} else {
					console.log('[Game] Bonus music already playing');
				}
			}
			
			console.log('[Game] ===== BONUS BACKGROUND EVENT HANDLED =====');
		});

		this.events.on('showBonusHeader', () => {
			console.log('[Game] ===== SHOW BONUS HEADER EVENT RECEIVED =====');
			console.log('[Game] Header exists:', !!this.header);
			console.log('[Game] BonusHeader exists:', !!this.bonusHeader);
			
			// Hide normal header
			if (this.header) {
				this.header.getContainer().setVisible(false);
				console.log('[Game] Normal header hidden');
			}
			
			// Show bonus header
			if (this.bonusHeader) {
				this.bonusHeader.getContainer().setVisible(true);
				console.log('[Game] Bonus header shown');
				console.log('[Game] Bonus header container visible:', this.bonusHeader.getContainer().visible);
			} else {
				console.error('[Game] BonusHeader is null!');
			}
			console.log('[Game] ===== BONUS HEADER EVENT HANDLED =====');
		});

		this.events.on('hideBonusBackground', () => {
			console.log('[Game] Hiding bonus background');
			
			// Show normal background
			if (this.background) {
				this.background.getContainer().setVisible(true);
				console.log('[Game] Normal background shown');
			}
			
			// Hide bonus background
			if (this.bonusBackground) {
				this.bonusBackground.getContainer().setVisible(false);
				console.log('[Game] Bonus background hidden');
			}
		});

		this.events.on('hideBonusHeader', () => {
			console.log('[Game] Hiding bonus header');
			
			// Show normal header
			if (this.header) {
				this.header.getContainer().setVisible(true);
				console.log('[Game] Normal header shown');
			}
			
			// Hide bonus header
			if (this.bonusHeader) {
				this.bonusHeader.getContainer().setVisible(false);
				console.log('[Game] Bonus header hidden');
			}
		});

		// Reset symbols and winlines back to base state
		this.events.on('resetSymbolsForBase', () => {
			console.log('[Game] Resetting symbols and winlines to base state');
			try {
				if (this.symbols) {
					// Do not clear Spine tracks here; keep symbols animating by forcing Idle loops
					if ((this.symbols as any).resumeIdleAnimationsForAllSymbols) {
						(this.symbols as any).resumeIdleAnimationsForAllSymbols();
					}
					this.symbols.clearWinLines();
					// Also hide any winning overlays and restore depths/visibility
					if (typeof (this.symbols as any).hideWinningOverlay === 'function') {
						(this.symbols as any).hideWinningOverlay();
					}
					if (typeof (this.symbols as any).resetSymbolDepths === 'function') {
						(this.symbols as any).resetSymbolDepths();
					}
					if (typeof (this.symbols as any).restoreSymbolVisibility === 'function') {
						(this.symbols as any).restoreSymbolVisibility();
					}
				}
				// Reset any internal flags related to win dialogs/winlines
				this.hasWinlinesThisSpin = false;
				gameStateManager.isShowingWinDialog = false;
				console.log('[Game] Symbols and winlines reset complete');
			} catch (e) {
				console.error('[Game] Error resetting symbols for base:', e);
			}
		});

		console.log('[Game] Bonus mode event listeners setup complete');
		
		// Add fullscreen toggle button (top-right) using shared manager
		const assetScale = this.networkManager.getAssetScale();
		FullScreenManager.addToggle(this, {
			margin: 16 * assetScale,
			iconScale: 1.5 * assetScale,
			depth: 1500,
			maximizeKey: 'maximize',
			minimizeKey: 'minimize'
		});

		// Add a test method to manually trigger bonus mode (for debugging)
		(window as any).testBonusMode = () => {
			console.log('[Game] TEST: Manually triggering bonus mode');
			console.log('[Game] TEST: Current isBonus state:', this.gameStateManager.isBonus);
			this.gameStateManager.isBonus = true;
			console.log('[Game] TEST: After setting isBonus to true:', this.gameStateManager.isBonus);
			this.events.emit('showBonusBackground');
			this.events.emit('showBonusHeader');
		};
		
		// Add a test method to simulate free spin dialog close
		(window as any).testFreeSpinDialogClose = () => {
			console.log('[Game] TEST: Simulating free spin dialog close');
			this.events.emit('showBonusBackground');
			this.events.emit('showBonusHeader');
		};
		
		// Add a method to check current state
		(window as any).checkBonusState = () => {
			console.log('[Game] Current game state:');
			console.log('- isBonus:', this.gameStateManager.isBonus);
			console.log('- isScatter:', this.gameStateManager.isScatter);
			console.log('- Background exists:', !!this.background);
			console.log('- BonusBackground exists:', !!this.bonusBackground);
			console.log('- Header exists:', !!this.header);
			console.log('- BonusHeader exists:', !!this.bonusHeader);
			if (this.background) console.log('- Background visible:', this.background.getContainer().visible);
			if (this.bonusBackground) console.log('- BonusBackground visible:', this.bonusBackground.getContainer().visible);
			if (this.header) console.log('- Header visible:', this.header.getContainer().visible);
			if (this.bonusHeader) console.log('- BonusHeader visible:', this.bonusHeader.getContainer().visible);
		};
		
		(window as any).spawnSingleCoin = (x?: number, y?: number) => {
			console.log(`[Game] TEST: Spawning single coin at (${x || 'center'}, ${y || 'center'})`);
			this.spawnSingleCoin(x, y);
		};
		
		(window as any).clearCoins = () => {
			console.log('[Game] TEST: Clearing all coins');
			if (this.coinAnimation) {
				this.coinAnimation.clearAllCoins();
			}
		};
		
		(window as any).getCoinCount = () => {
			const count = this.coinAnimation ? this.coinAnimation.getCoinCount() : 0;
			console.log(`[Game] TEST: Current coin count: ${count}`);
			return count;
		};
	}

	changeScene() {
		// Scene change logic if needed
	}

	spin() {
		console.log('Game Spin');
		
		// Check if we're in bonus mode - if so, let the free spin autoplay system handle it
		if (this.gameStateManager.isBonus) {
			console.log('[Game] In bonus mode - skipping old spin system, free spin autoplay will handle it');
			return;
		}
		
		// Reset the interrupted flag for the new spin
		if (this.symbols && this.symbols.winLineDrawer) {
			this.symbols.winLineDrawer.resetInterruptedFlag();
		}
		
		// Check if win line drawer is still animating and hasn't completed first loop
		if (this.symbols && this.symbols.winLineDrawer) {
			this.symbols.winLineDrawer.forceEmitWinStopIfNeeded();
		}
		
		this.gameStateManager.startSpin();
	}

	turbo() {
		console.log('Game Turbo');
		this.gameStateManager.toggleTurbo();
	}

	autoplay() {
		// Autoplay logic handled by SlotController
	}

	info() {
		console.log('Game Info');
	}

	betAdd() {
		// Bet increase logic
	}

	betMinus() {
		// Bet decrease logic
	}

	toggleSettings() {
		// Settings toggle logic
	}

	setVolume(_level: number) {
		// Volume setting logic
	}

	setSfx(_level: number) {
		// SFX setting logic
	}

	update(time: number, delta: number) {
		// Game state manager handles its own updates through event listeners
	}

	shutdown() {
		// Called by Phaser when the Scene shuts down.
		// Make sure we don't leave looping BGM running if the game is torn down / replaced.
		try {
			const anyWindow: any = window as any;
			if (anyWindow.audioManager === this.audioManager) {
				anyWindow.audioManager = undefined;
			}
		} catch {}
		try { this.audioManager?.stopAllMusic?.(); } catch {}
		try { this.audioManager?.destroy?.(); } catch {}
		try { (this.sound as any)?.stopAll?.(); } catch {}
	}
}