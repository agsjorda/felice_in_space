import { NetworkManager } from "../managers/NetworkManager";
import { ScreenModeManager } from "../managers/ScreenModeManager";

export interface AssetGroup {
	images?: { [key: string]: string };
	spine?: { [key: string]: { atlas: string; json: string } };
	audio?: { [key: string]: string };
	fonts?: { [key: string]: string };
}

export class AssetConfig {
	private networkManager: NetworkManager;
	private screenModeManager: ScreenModeManager;

	constructor(networkManager: NetworkManager, screenModeManager: ScreenModeManager) {
		this.networkManager = networkManager;
		this.screenModeManager = screenModeManager;
	}

	private getAssetPrefix(): string {
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		
		const orientation = screenConfig.isPortrait ? 'portrait' : 'landscape';
		const quality = isHighSpeed ? 'high' : 'low';
		
		return `assets/${orientation}/${quality}`;
	}

	getBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'shine': `assets/portrait/high/background/shine.png`,
				'reel-container': `assets/portrait/high/background/reel-container.png`,
				'reel-container-frame': `assets/portrait/high/background/reel-container-frame.png`
			},
			spine: {
				'BG-Default': {
					atlas: `assets/portrait/high/background/BG_Default_FIS/Default_BG_FIS.atlas`,
					json: `assets/portrait/high/background/BG_Default_FIS/Default_BG_FIS.json`
				}
			}
		};
	}

	getBonusBackgroundAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {},
			spine: {
				'BG-Bonus': {
					atlas: `assets/portrait/high/bonus_background/BG_Bonus/Bonus_FIS.atlas`,
					json: `assets/portrait/high/bonus_background/BG_Bonus/Bonus_FIS.json`
				}
			}
		};
	}

	getHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'header-logo': `${prefix}/header/header_logo.png`,

			},
		spine: {
			'Character_FIS': {
				atlas: `${prefix}/header/Character_FIS/Character_FIS.atlas`,
				json: `${prefix}/header/Character_FIS/Character_FIS.json`
			}
		}
		};
	}

	getBonusHeaderAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {},
		spine: {
			'Character_FIS': {
				atlas: `${prefix}/header/Character_FIS/Character_FIS.atlas`,
				json: `${prefix}/header/Character_FIS/Character_FIS.json`
			}
		}
		};
	}

	/**
	 * Candy transition assets – currently only available in portrait/high.
	 * We intentionally avoid getAssetPrefix() to ensure correct pathing.
	 */
	getCandyTransitionAssets(): AssetGroup {
		console.log('[AssetConfig] Loading Candy Transition assets');
		return {
			spine: {
				'transition_SW': {
					atlas: `assets/portrait/high/candy_transition/transition_SW.atlas`,
					json: `assets/portrait/high/candy_transition/transition_SW.json`
				}
			}
		};
	}

	getLoadingAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		return {
			images: {
				'loading_background': `${prefix}/loading/image.png`,
				'button_bg': `${prefix}/loading/button_bg.png`,
				'button_spin': `${prefix}/loading/button_spin.png`,
				'logo_loading': `${prefix}/loading/logo-loading.png`,
				'loading_frame': `${prefix}/loading/loading-frame.png`,
				'loading_frame_2': `${prefix}/loading/loading-frame-2.png`,
				'dijoker_logo': `${prefix}/loading/DiJoker-logo.png`
			},
			spine: {
				// Studio loading spine (DI JOKER) – only available in portrait/high
				'di_joker': {
					atlas: `assets/portrait/high/dijoker_loading/DI JOKER.atlas`,
					json: `assets/portrait/high/dijoker_loading/DI JOKER.json`
				}
			}
		};
	}

	// Add more asset groups as needed
	getSymbolAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading symbol assets from: assets/symbols/high/`);
		
		const symbolSpine: { [key: string]: { atlas: string; json: string } } = {};
		const symbolImages: { [key: string]: string } = {};
		
		// Load symbol spines 0-9 from assets/symbols/high/Symbol[number]_FIS (individual spines)
		for (let i = 0; i <= 9; i++) {
			const spineKey = `symbol_${i}_spine`;
			const atlasPath = `assets/symbols/high/Symbol${i}_FIS.atlas`;
			const jsonPath = `assets/symbols/high/Symbol${i}_FIS.json`;
			
			symbolSpine[spineKey] = {
				atlas: atlasPath,
				json: jsonPath
			};
			
			console.log(`[AssetConfig] Symbol ${i}: spine=${atlasPath}`);
		}
		
		// Load multiplier symbol spines with shared mapping:
		// Symbol10_FIS for symbols 10-16
		// Symbol11_FIS for symbols 17-20
		// Symbol12_FIS for symbols 21-22
		symbolSpine['symbol_10_spine'] = {
			atlas: `assets/symbols/high/Symbol10_FIS.atlas`,
			json: `assets/symbols/high/Symbol10_FIS.json`
		};
		symbolSpine['symbol_11_spine'] = {
			atlas: `assets/symbols/high/Symbol11_FIS.atlas`,
			json: `assets/symbols/high/Symbol11_FIS.json`
		};
		symbolSpine['symbol_12_spine'] = {
			atlas: `assets/symbols/high/Symbol12_FIS.atlas`,
			json: `assets/symbols/high/Symbol12_FIS.json`
		};
		
		// Load VFX spine for symbols 1-9 win animations
		symbolSpine['vfx_fis'] = {
			atlas: `assets/symbols/high/vfx/VFX_FIS.atlas`,
			json: `assets/symbols/high/vfx/VFX_FIS.json`
		};
		
		console.log(`[AssetConfig] Multiplier spines: Symbol10_FIS (10-16), Symbol11_FIS (17-20), Symbol12_FIS (21-22)`);
		console.log(`[AssetConfig] VFX spine: VFX_FIS (for symbols 1-9 win animations)`);
		
		// Multiplier overlays (PNG numbers shown in front of the multiplier symbol)
		// Mapping: 10->2, 11->3, 12->4, 13->5, 14->6, 15->8, 16->10,
		// 17->12, 18->15, 19->20, 20->25, 21->50, 22->100
		const overlayMap: { [value: number]: string } = {
			10: '2',
			11: '3',
			12: '4',
			13: '5',
			14: '6',
			15: '8',
			16: '10',
			17: '12',
			18: '15',
			19: '20',
			20: '25',
			21: '50',
			22: '100'
		};
		Object.entries(overlayMap).forEach(([valueStr, label]) => {
			const value = Number(valueStr);
			const key = `multiplier_overlay_${value}`;
			const path = `assets/symbols/high/multiplier_symbols/${label}.png`;
			symbolImages[key] = path;
			console.log(`[AssetConfig] Multiplier overlay ${value}: ${path}`);
		});
		
		return {
			images: symbolImages,
			spine: symbolSpine
		};
	}

	getButtonAssets(): AssetGroup {
		// Controller buttons now follow portrait/landscape structure
		const screenConfig = this.screenModeManager.getScreenConfig();
		const isHighSpeed = this.networkManager.getNetworkSpeed();
		const quality = isHighSpeed ? 'high' : 'low';
		const screenMode = screenConfig.isPortrait ? 'portrait' : 'landscape';
		
		console.log(`[AssetConfig] Loading controller buttons with quality: ${quality}, screen mode: ${screenMode}`);
		
		return {
			images: {
				'autoplay_off': `assets/controller/${screenMode}/${quality}/autoplay_off.png`,
				'autoplay_on': `assets/controller/${screenMode}/${quality}/autoplay_on.png`,
				'decrease_bet': `assets/controller/${screenMode}/${quality}/decrease_bet.png`,
				'increase_bet': `assets/controller/${screenMode}/${quality}/increase_bet.png`,
				'menu': `assets/controller/${screenMode}/${quality}/menu.png`,
				'spin': `assets/controller/${screenMode}/${quality}/spin_bg.png`,
				'spin_icon': `assets/controller/${screenMode}/${quality}/spin_icon.png`,
				'autoplay_stop_icon': `assets/controller/${screenMode}/${quality}/autoplay_stop_icon.png`,
				'turbo_off': `assets/controller/${screenMode}/${quality}/turbo_off.png`,
				'turbo_on': `assets/controller/${screenMode}/${quality}/turbo_on.png`,
				'amplify': `assets/controller/${screenMode}/${quality}/amplify.png`,
				'feature': `assets/controller/${screenMode}/${quality}/feature.png`,
				'long_button': `assets/controller/${screenMode}/${quality}/long_button.png`,
				'maximize': `assets/controller/${screenMode}/${quality}/maximize.png`,
				'minimize': `assets/controller/${screenMode}/${quality}/minimize.png`,
				// Free round button background (currently only available as portrait/high asset)
				// We reference it directly so it can be used in all modes without additional variants.
				'freeround_bg': `assets/controller/portrait/high/freeround_bg.png`,
				// "Spin Now" button for free round reward panel (portrait/high only asset)
				'spin_now_button': `assets/controller/portrait/high/spin_now_button.png`,
			},
			spine: {
				'spin_button_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.atlas`,
					json: `assets/controller/${screenMode}/${quality}/spin_button_anim/spin_button_anim.json`
				},
				// Free-round specific spin button animation (portrait/high only asset)
				// Used instead of the normal spin_button_animation while in initialization
				// free-round spins mode.
				'fr_spin_button_animation': {
					atlas: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.atlas`,
					json: `assets/controller/portrait/high/Button_Bonus_Buttom/Button_Bonus_VFX.json`
				},
				'button_animation_idle': {
					atlas: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.atlas`,
					json: `assets/controller/${screenMode}/${quality}/button_animation_idle/button_animation_idle.json`
				},
				'amplify_bet': {
					atlas: `assets/portrait/high/amplify_bet/Amplify Bet.atlas`,
					json: `assets/portrait/high/amplify_bet/Amplify Bet.json`
				},
				// Enhance Bet idle loop (available only in portrait/high for now)
				'enhance_bet_idle_on': {
					atlas: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.atlas`,
					json: `assets/controller/portrait/high/enhanceBet_idle_on/Amplify Bet.json`
				},
				'turbo_animation': {
					atlas: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.atlas`,
					json: `assets/controller/${screenMode}/${quality}/turbo_animation/Turbo_Spin.json`
				}
			}
		};
	}

	getFontAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading font assets`);
		
		return {
			fonts: {
				'poppins-thin': 'assets/fonts/poppins/Poppins-Thin.ttf',
				'poppins-bold': 'assets/fonts/poppins/Poppins-Bold.ttf',
				'poppins-regular': 'assets/fonts/poppins/Poppins-Regular.ttf'
				
			}
		};
	}

	getMenuAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			images: {
				// Menu tab icons
				'menu_info': `${prefix}/menu/Info.png`,
				'menu_history': `${prefix}/menu/History.png`,
				'menu_settings': `${prefix}/menu/Settings.png`,
				// Pagination and loading
				'icon_left': `${prefix}/menu/icon_left.png`,
				'icon_most_left': `${prefix}/menu/icon_most_left.png`,
				'icon_right': `${prefix}/menu/icon_right.png`,
				'icon_most_right': `${prefix}/menu/icon_most_right.png`,
				'loading_icon': `${prefix}/menu/loading.png`,
				// Close icon (portrait/high specific path)
				'menu_close': `assets/controller/portrait/high/close.png`
			}
		};
	}

	getHelpScreenAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		return {
			images: {
				'helpscreen_0': `${prefix}/help_screen/helpscreen_0.webp`,
				'helpscreen_1': `${prefix}/help_screen/helpscreen_1.webp`,
				'helpscreen_2': `${prefix}/help_screen/helpscreen_2.webp`,
				'helpscreen_3': `${prefix}/help_screen/helpscreen_3.webp`,

				// HowToPlay images
				'howToPlay1': `${prefix}/help_screen/HowToPlay1.png`,
				'howToPlay1Mobile': `${prefix}/help_screen/HowToPlay1Mobile.png`,
				'howToPlay2': `${prefix}/help_screen/HowToPlay2.png`,
				'howToPlay2Mobile': `${prefix}/help_screen/HowToPlay2Mobile.png`,
				'howToPlay3': `${prefix}/help_screen/HowToPlay3.png`,
				'howToPlay3Mobile': `${prefix}/help_screen/HowToPlay3Mobile.png`,
				'howToPlay4': `${prefix}/help_screen/HowToPlay4.png`,
				'howToPlay4Mobile': `${prefix}/help_screen/HowToPlay4Mobile.png`,
				'howToPlay5': `${prefix}/help_screen/HowToPlay5.png`,
				'howToPlay6': `${prefix}/help_screen/HowToPlay6.png`,
				'howToPlay7': `${prefix}/help_screen/HowToPlay7.png`,
				'howToPlay8': `${prefix}/help_screen/HowToPlay8.png`,
				'howToPlay8Mobile': `${prefix}/help_screen/HowToPlay8Mobile.png`,
				'howToPlay9': `${prefix}/help_screen/HowToPlay9.png`,
				'howToPlay9Mobile': `${prefix}/help_screen/HowToPlay9Mobile.png`,
				'howToPlay10': `${prefix}/help_screen/HowToPlay10.png`,
				'howToPlay10Mobile': `${prefix}/help_screen/HowToPlay10Mobile.png`,
				// Feature help
				'BuyFeatHelp': `${prefix}/help_screen/BuyFeatHelp.png`,
				'BuyFeatMobile': `${prefix}/help_screen/BuyFeatMobile.png`,
				'DoubleHelp': `${prefix}/help_screen/DoubleHelp.png`,
				'DoubleHelpMobile': `${prefix}/help_screen/DoubleHelpMobile.png`,
				// Payline visuals
				'paylineMobileWin': `${prefix}/help_screen/paylineMobileWin.png`,
				'paylineMobileNoWin': `${prefix}/help_screen/paylineMobileNoWin.png`,
				// Scatter / Tumble / Multiplier visuals
				'scatterGame': `${prefix}/help_screen/scatterGame.png`,
				'scatterIcon': `${prefix}/help_screen/scatterIcon.png`,
				'scatterWin': `${prefix}/help_screen/scatterWin.png`,
				'ScatterLabel': `${prefix}/help_screen/ScatterSymbol.png`,
				'wheelSpin_helper': `assets/portrait/high/help_screen/wheelSpin_helper.png`,
				'freeSpin_round': `assets/portrait/high/help_screen/freeSpin_round.png`,
				'tumbleIcon': `${prefix}/help_screen/tumbleIcon.png`,
				'tumbleWin': `${prefix}/help_screen/tumbleWin.png`,
				'multiplierGame': `${prefix}/help_screen/multiplierGame.png`,
				'multiplierIcon': `${prefix}/help_screen/multiplierIcon.png`,
				// Winlines thumbnails (static, not dependent on screen prefix)
				// Keys: winlines1 .. winlines20
				...(() => {
					const map: { [key: string]: string } = {};
					for (let i = 1; i <= 20; i++) {
						map[`winlines${i}`] = `assets/winlines/winline${i}.png`;
					}
					return map;
				})()
			}
		};
	}

	getDialogAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading dialog assets with prefix: ${prefix}`);
		
		return {
			spine: {
				'BigWin_Dialog': {
					atlas: `${prefix}/win_dialog/BigW_FIS/BigW_FIS.atlas`,
					json: `${prefix}/win_dialog/BigW_FIS/BigW_FIS.json`
				},
				'MegaWin_Dialog': {
					atlas: `${prefix}/win_dialog/MegaW_FIS/MegaW_FIS.atlas`,
					json: `${prefix}/win_dialog/MegaW_FIS/MegaW_FIS.json`
				},
				'EpicWin_Dialog': {
					atlas: `${prefix}/win_dialog/EpicW_FIS/EpicW_FIS.atlas`,
					json: `${prefix}/win_dialog/EpicW_FIS/EpicW_FIS.json`
				},
				'SuperWin_Dialog': {
					atlas: `${prefix}/win_dialog/SuperW_FIS/SuperW_FIS.atlas`,
					json: `${prefix}/win_dialog/SuperW_FIS/SuperW_FIS.json`
				},
				'Congrats_Dialog': {
					atlas: `${prefix}/win_dialog/Congrats_FIS/Congrats_FIS.atlas`,
					json: `${prefix}/win_dialog/Congrats_FIS/Congrats_FIS.json`
				},
				'FreeSpin_Dialog': {
					atlas: `${prefix}/win_dialog/FreeSpin_FIS/FreeSpin_FIS.atlas`,
					json: `${prefix}/win_dialog/FreeSpin_FIS/FreeSpin_FIS.json`
				}
			}
		};
	}

	/**
	 * Scatter Anticipation assets – only available in portrait/high for now.
	 * We intentionally do not use getAssetPrefix() to avoid missing assets on low quality.
	 */
	getScatterAnticipationAssets(): AssetGroup {
		console.log('[AssetConfig] Loading Scatter Anticipation assets');
		return {
			spine: {
				// NOTE: Keep this key stable; code expects `${key}-atlas` for the atlas cache key.
				// Files live under: public/assets/portrait/high/scatter_anticipation/
				'scatter_anticipation_spine': {
					atlas: `assets/portrait/high/scatter_anticipation/skeleton.atlas`,
					json: `assets/portrait/high/scatter_anticipation/skeleton.json`,
				},
			},
		};
	}

	getNumberAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading number assets with prefix: ${prefix}`);
		
		// Generate number assets for digits 0-9, plus comma and dot
		const numberImages: { [key: string]: string } = {};
		
		// Add digit images (0-9)
		for (let i = 0; i <= 9; i++) {
			const key = `number_${i}`;
			const path = `${prefix}/numbers/Number${i}.png`;
			numberImages[key] = path;
			console.log(`[AssetConfig] Number ${key}: ${path}`);
		}
		
		// Add comma and dot
		numberImages['number_comma'] = `${prefix}/numbers/comma.png`;
		numberImages['number_dot'] = `${prefix}/numbers/dot.png`;
		
		console.log(`[AssetConfig] Number comma: ${prefix}/numbers/comma.png`);
		console.log(`[AssetConfig] Number dot: ${prefix}/numbers/dot.png`);
		
		return {
			images: numberImages
		};
	}

	getCoinAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading coin assets with prefix: ${prefix}`);
		
		return {
			images: {
				'coin': `${prefix}/coin/coin.png`
			}
		};
	}

	getBuyFeatureAssets(): AssetGroup {
		const prefix = this.getAssetPrefix();
		
		console.log(`[AssetConfig] Loading buy feature assets with prefix: ${prefix}`);
		
		return {
			images: {
				'buy_feature_logo': `${prefix}/buy_feature/buy_feature_logo.png`,
				'buy_feature_bg': `${prefix}/buy_feature/buy_feature_bg.png`
			}
		};
	}

	getAudioAssets(): AssetGroup {
		console.log(`[AssetConfig] Loading audio assets`);
		
		return {
			audio: {
				// Menu/UI clicks
				'click_sfx': 'assets/sounds/click_sw.ogg',
				'mainbg_sfx': 'assets/sounds/BG/mainbg_fis.ogg',
				'bonusbg_sfx': 'assets/sounds/BG/bonusbg_fis.ogg',
				'freeSpin_sfx': 'assets/sounds/BG/freespinbg_fis.ogg',
				// 'ambience_sfx': 'assets/sounds/SFX/ambience_sw.ogg',
				'spin_sfx': 'assets/sounds/SFX/spin_fis.ogg',
				'reeldrop_sfx': 'assets/sounds/SFX/reeldrop_fis.ogg',
				'turboDrop_sfx': 'assets/sounds/SFX/turbodrop_fis.ogg',
				// Candy explosion transition SFX (used by SymbolExplosionTransition)
				'candy_transition_sw': 'assets/sounds/SFX/planets_fis.ogg',
				//'coin_throw_ka': 'assets/sounds/SFX/coin_throw_ka.ogg',
				//'coin_drop_ka': 'assets/sounds/SFX/coin_drop_ka.ogg',
				// Multiplier trigger / bomb SFX (bonus-mode multipliers)
				'bomb_sw': 'assets/sounds/SFX/texplo_fis.ogg',
				'scatter_sw': 'assets/sounds/SFX/scatter_fis.ogg',
				// Tumble symbol-win SFX (play per tumble index)
				'twin1_sfx': 'assets/sounds/SFX/symbol_win/twin1_fis.ogg',
				'twin2_sfx': 'assets/sounds/SFX/symbol_win/twin2_fis.ogg',
				'twin3_sfx': 'assets/sounds/SFX/symbol_win/twin3_fis.ogg',
				'twin4_sfx': 'assets/sounds/SFX/symbol_win/twin4_fis.ogg',
				// Win dialog SFX
				'bigWin_sfx': 'assets/sounds/Wins/bigw_fis.ogg',
				'megaWin_sfx': 'assets/sounds/Wins/megaw_fis.ogg',
				'superWin_sfx': 'assets/sounds/Wins/superw_fis.ogg',
				'epicWin_sfx': 'assets/sounds/Wins/epicw_fis.ogg',
				'freeSpinDialog_sfx': 'assets/sounds/BG/freespinbg_fis.ogg',
				'congratsDialog_sfx': 'assets/sounds/Wins/congrats_fis.ogg',
				'megawskip_ka': 'assets/sounds/Wins/megawskip_ka.ogg',
				'superwskip_ka': 'assets/sounds/Wins/superwskip_ka.ogg',
				'epicwskip_ka': 'assets/sounds/Wins/epicwskip_ka.ogg',
				// Character shoot SFX (plays during character win animation)
				'felice_shoot_fis': 'assets/sounds/SFX/felice_shoot_fis.ogg'
			}
		};
	}

	// Helper method to get all assets for a scene
	getAllAssets(): { [key: string]: AssetGroup } {
		return {
			background: this.getBackgroundAssets(),
			header: this.getHeaderAssets(),
			bonusHeader: this.getBonusHeaderAssets(),
			candyTransition: this.getCandyTransitionAssets(),
			loading: this.getLoadingAssets(),
			symbols: this.getSymbolAssets(),
			buttons: this.getButtonAssets(),
			fonts: this.getFontAssets(),
			dialogs: this.getDialogAssets(),
			numbers: this.getNumberAssets(),
			coin: this.getCoinAssets(),
			buyFeature: this.getBuyFeatureAssets(),
			audio: this.getAudioAssets(),
		};
	}

	// Method to get debug info
	getDebugInfo(): void {
		const prefix = this.getAssetPrefix();
		console.log(`[AssetConfig] Asset prefix: ${prefix}`);
		console.log(`[AssetConfig] Available asset groups:`, Object.keys(this.getAllAssets()));
	}
} 