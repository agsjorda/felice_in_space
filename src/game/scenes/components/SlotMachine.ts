import { Scene, GameObjects } from 'phaser';
import { Events } from "./Events";
import { Slot } from "./GameData";
import { GameData } from "./GameData";
import { AudioManager } from "./AudioManager";
import { Animation } from './Animation';
import { WinAnimation } from './WinAnimation';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { WinOverlayContainer } from './WinOverlayContainer';
import { RetriggerOverlayContainer } from './RetriggerOverlayContainer';
import { GameAPI } from '../backend/GameAPI';
import { BombContainer } from './BombContainer';
import { SymbolContainer } from './SymbolContainer';
import { getRandomRows } from './IdleState';
import chalk from 'chalk';
import { MaxWinClaimPopup } from './MaxWinClaimPopup';
import { layoutContainersRow } from '../../utils/layoutRow';

// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameAPI: GameAPI;
    gameData: GameData;
    audioManager: AudioManager;
    buttons: any; // Reference to buttons for immediate state updates
    slotMachine: any; // Reference to slot machine for win overlay checks
    background: any; // Reference to background for bonus round changes
    autoplay: any;
}

// Improved SymbolGrid interface with proper typing
interface SymbolGrid {
    [index: number]: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[];
    length: number;
    map: <T>(callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => T[]) => T[][];
    forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => void) => void;
}

interface DisplaySymbol {
    symbol: number;
    count: number;
    win: number;
}

interface SpinData {
    symbols: number[][];
    currentRow: number;
    isBuyFeature: boolean;
    isEnhancedBet: boolean;
    betAmount: number;
}

interface Tumble {
    symbols: {in: number[][], out: DisplaySymbol[]};
    win: number;
}

function transpose(matrix: number[][]): number[][] {
    return matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]));
}

export class SlotMachine {
    private container: GameObjects.Container;
    private symbolGrid: SymbolGrid;
    private symbolDisplayWidth: number;
    private symbolDisplayHeight: number;
    private horizontalSpacing: number;
    private verticalSpacing: number;
    private width: number;
    private centerX: number;
    private totalGridWidth: number;
    private totalGridHeight: number;
    private slotX: number;
    private slotY: number;
    public activeWinOverlay: boolean = false;
    public tweensToComplete: number = 0;
    private bombAnimationActive: boolean = false;
    private lastSpinTimestamp: number = 0;
    private readonly MIN_SPIN_INTERVAL = 200; // Minimum 200ms between spins

    public winOverlayContainers: WinOverlayContainer[] = [];
    private bombPopupContainer: GameObjects.Container | null = null;
    private winOverlayQueue: { totalWin: number; overlayType: string }[] = [];
    private onOverlayHide?: () => void;
    private onSpinListener?: (data: SpinData) => Promise<void>;
    private onStartListener?: (data: SpinData) => void;

    private animation: Animation;
    private winAnimation: WinAnimation;

    private isMobile: boolean = false;
    private symbolCountWinContainer: GameObjects.Container | null = null;
    private symbolCountWinTexts: GameObjects.Text[] = [];
    private hadMatchThisSpin: boolean = false;
    private deferredScatterCount: number = 0;
    private bonusTriggeredThisSpin: boolean = false;
    private maxWinClaim?: MaxWinClaimPopup;
    private scatterAnticipations: SpineGameObject[] = [];
    private droppingScatters: Set<SymbolContainer> = new Set();

    constructor() {
        this.symbolDisplayWidth = 153.17;
        this.symbolDisplayHeight = 147.2;
        this.horizontalSpacing = 10;
        this.verticalSpacing = 10;

        this.symbolGrid = {
            length: 0,
            map: () => [],
            forEach: () => {}
        };
    }

    preload(scene: Scene): void {
        scene.load.image('slotBackground', 'assets/Reels/Mobile_Grid.png');
        scene.load.spineAtlas(`scatterAnticipation`,`assets/Controllers/Animation/ScatterAnticipation/skeleton.atlas`);
        scene.load.spineJson(`scatterAnticipation`,`assets/Controllers/Animation/ScatterAnticipation/skeleton.json`);

        scene.load.image('bottom_masking', 'assets/Reels/Bottom_Masking.png');

        // Initialize animation
        this.animation = new Animation(scene);
        this.animation.preload();

        this.winAnimation = new WinAnimation(scene);
        this.winAnimation.preload();

        this.initVariables(scene as GameScene);
        this.isMobile = this.isMobileDevice();
    }

    private initVariables(scene: GameScene): void {
        this.width = scene.scale.width;

        this.centerX = this.width * 0.5;

        this.totalGridWidth = 1000;
        this.totalGridHeight = 775;

        this.slotX = this.centerX - this.totalGridWidth * 0.475;
        this.slotY = 85;
    }

    create(scene: Scene): void {
        this.createContainer(scene as GameScene);
        this.createBackground(scene as GameScene);
        this.createSlot(scene as GameScene);
        this.eventListeners(scene as GameScene);
        this.maxWinClaim = new MaxWinClaimPopup();
        
        // Initialize animations
        this.animation.create();
        this.winAnimation.create();
        
        // Process queued overlays whenever one closes
        this.onOverlayHide = () => this.tryShowNextOverlay(scene as GameScene);
        Events.emitter.on(Events.WIN_OVERLAY_HIDE, this.onOverlayHide);
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    private createContainer(scene: GameScene): void {
        this.container = scene.add.container(scene.scale.width * 0.05, scene.scale.height * 0.23)
        this.container.setScale(0.4);

        this.totalGridWidth = this.totalGridWidth * 0.43;
        this.totalGridHeight = this.totalGridHeight * 0.43; 
        this.container.setDepth(4);
        
        // Create SymbolCountWin display container
        this.createSymbolCountWinDisplay(scene);
    }

    private createSymbolCountWinDisplay(scene: GameScene): void {
        // Position the container below the symbol grid
        const x = scene.scale.width * 0.5;
        const y = scene.scale.height * 0.64;
        
        this.symbolCountWinContainer = scene.add.container(x, y);
        this.symbolCountWinContainer.setDepth(5);
        this.symbolCountWinContainer.setVisible(false);
    }

    private showSymbolCountWinDisplay(scene: GameScene, symbols: DisplaySymbol[]): void {
        if (!this.symbolCountWinContainer || symbols.length === 0) return;
        
        // Clear previous texts
        this.clearSymbolCountWinTexts();
        
		// Filter symbols with count >= 8
		const validSymbols = symbols.filter((symbol) => symbol.count >= 8);
		if (validSymbols.length === 0) {
			console.log("No valid symbols with count >= 8");
			return;
		}
        
        // Build up to 3 entry containers and lay them out in a row
        const entryContainers: Phaser.GameObjects.Container[] = [];
        
        validSymbols.slice(0, 3).forEach((symbol) => {
            const entry = scene.add.container(0, 0);

            // Count text
            const countText = scene.add.text(0, 0, `${symbol.count}  `, {
                fontSize: '20px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
            });
            countText.setOrigin(0.5, 0.5);

			// Symbol sprite
			let symbolSprite: (GameObjects.Sprite | SpineGameObject | SymbolContainer) | null = null;
			if (symbol.symbol >= 1 && symbol.symbol <= 9) {
				symbolSprite = new SymbolContainer(scene, 0, 0, symbol.symbol, scene.gameData);
				(symbolSprite as SymbolContainer).setSymbolDisplaySize(40, 40);
			}

            // Win text
            const winToText = symbol.win.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2});
            const winText = scene.add.text(0, 0, `   = ${scene.gameData.currency}${winToText}`, {
                fontSize: '20px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
            });
            winText.setOrigin(0.5, 0.5);

            // Add to entry container before measuring
            entry.add(countText);
            if (symbolSprite) entry.add(symbolSprite);
            entry.add(winText);

            // Inline layout inside the entry: [count] [icon] [= $win]
            const innerGap = 4;
            const countW = countText.getBounds().width * 2;
            const iconW = symbolSprite ? symbolSprite.getBounds().width : 0;
            const winW = winText.getBounds().width;
            const totalW = countW + (symbolSprite ? innerGap + iconW : 0) + innerGap + winW;
            let left = -totalW / 2;
            countText.setPosition(left + countW / 2, 0);
            left += countW;
            if (symbolSprite) {
                left += innerGap;
                symbolSprite.setPosition(left + iconW / 2, 0);
                left += iconW ;
            }
            left += innerGap;
            winText.setPosition(left + winW / 2, 0);

            // Add entry to parent container
            this.symbolCountWinContainer!.add(entry);
            entryContainers.push(entry);

            if(validSymbols.length === 3){
                entry.setScale(3);
            }
            else if(validSymbols.length === 2){
                entry.setScale(2);
            }
            else{
                entry.setScale(0.75);
            }

            // Track for cleanup
            this.symbolCountWinTexts.push(countText, winText);
            if (symbolSprite) this.symbolCountWinTexts.push(symbolSprite as any);
        });

        // Lay out the entries within available width
        const maxWidth = scene.scale.width * 0.6;
        layoutContainersRow(scene, entryContainers, {
            x: 0,
            y: 0,
            maxWidth,
            gap: 18,
            align: 'center'
        });
        
        if(this.isMobile){
            this.symbolCountWinContainer.setVisible(true);
        }
        else{
            this.symbolCountWinContainer.setVisible(false);
        }

    }

    private hideSymbolCountWinDisplay(): void {
        if (this.symbolCountWinContainer) {
            this.symbolCountWinContainer.setVisible(false);
            this.clearSymbolCountWinTexts();
            // Note: We can't access scene here, so we'll just log to console
            // console.log("SymbolCountWin display hidden");
        }
    }

    private clearSymbolCountWinTexts(): void {
        // Clear previous texts
        this.symbolCountWinTexts.forEach(text => {
            if (text && text.active) {
                text.destroy();
            }
        });
        this.symbolCountWinTexts = [];
        
        // Clear container children
        if (this.symbolCountWinContainer) {
			this.symbolCountWinContainer.removeAll(true);
        }
    }

    private createBackground(scene: GameScene): void {
        const background = scene.add.image(0, 0, 'slotBackground');
        background.setDepth(3);
        background.setPosition(this.slotX, this.slotY);
        background.setScale(0.49, 0.525);
        background.setOrigin(-0.63, -0.15);

        const bottomMasking = scene.add.image(0, 0, 'bottom_masking');
        bottomMasking.setDepth(16);
        bottomMasking.setPosition(this.slotX, this.slotY + this.totalGridHeight * 1.325);
        bottomMasking.setScale(0.49, 0.525);
        bottomMasking.setOrigin(-0.63, -0.15);
    }

    private createSlot(scene: GameScene): void {
        const x = scene.scale.width * 0;
        const y = scene.scale.height * 0.22;
        const width = this.totalGridWidth * 1.01;
        const height = this.totalGridHeight * 1.05;
        
        const maskShape = scene.add.graphics();
        maskShape.fillRect(x, y, width, height);

        const mask = maskShape.createGeometryMask();
        this.container.setMask(mask);
        maskShape.setVisible(false);
        
        // Create 5 ScatterAnticipation spines centered on the screen and log their sizes
		const centerX = scene.scale.width * 0.495;
		const centerY = scene.scale.height * 0.4;
        
		this.scatterAnticipations = new Array(6);

		// Create a temporary instance to determine native bounds for spacing and scaling
		const temp = scene.add.spine(centerX, centerY, `scatterAnticipation`, `scatterAnticipation`) as SpineGameObject;
		temp.animationState.setAnimation(0, `animation`, true);
		const rawBounds: any = (temp as any).getBounds ? (temp as any).getBounds() : undefined;
		const nativeW = rawBounds?.size?.x ?? 0;
		const nativeH = rawBounds?.size?.y ?? 0;
		// console.log(`[ScatterAnticipation] native size: ${nativeW} x ${nativeH}`);

		// Compute a scale to fit 5 items within ~80% of screen width
		const targetTotalWidth = scene.scale.width * 0.8;
		let scaleFactor = 1;
		const baseW = nativeW > 0 ? nativeW : scene.scale.width * 0.12; // robust fallback width
		{
			// Gap equals one width per item, so total is 5 widths + 4 gaps of 1 width = 9 widths
			const totalNative = baseW * 9;
			scaleFactor = Math.min(1, targetTotalWidth / totalNative);
		}
		// Reduce horizontal scale (scaleX) by 20%, increase vertical scale (height) by 1.5x
		temp.setScale(scaleFactor * 0.8, scaleFactor * 1.5);

		// Recalculate width/height after scaling for accurate spacing
		const scaledBounds: any = (temp as any).getBounds ? (temp as any).getBounds() : undefined;
		const scaledW = (scaledBounds?.size?.x ?? baseW * scaleFactor) * 1; // already includes 0.8 in temp scale
		const scaledH = scaledBounds?.size?.y ?? (nativeH > 0 ? nativeH * scaleFactor : baseW * scaleFactor);
		// console.log(`[ScatterAnticipation] scaled size: ${scaledW} x ${scaledH}`);

		// Position calculation for 6 items, each centered on their respective columns, with parabolic distance from centerX
		const spacing = (scaledW || 0) * 1.66;

		// Parabolic offset: offset = (i - 2.5) * spacing * (1 + parabolaStrength * Math.pow(i - 2.5, 2))
		const parabolaStrength = 0.01; // tweak this for more/less curve
		const getScatterX = (i: number) => {
			const linear = (i - 2.5) * spacing;
			const parabola = 1 + parabolaStrength * Math.pow(i - 2.5, 2);
			return centerX + linear * parabola;
		};
		temp.setDepth(2);
		temp.setPosition(getScatterX(2), centerY);
		temp.setVisible(false);
		this.scatterAnticipations[2] = temp;

		for (let i = 0; i < 6; i++) {
			//if (i === 2) continue; // index 2 already created as temp (center)
			const spineObj = scene.add.spine(centerX, centerY, `scatterAnticipation`, `scatterAnticipation`) as SpineGameObject;
			spineObj.animationState.setAnimation(0, `animation`, true);
			// Apply reduced horizontal scale (scaleX -5%) and 1.6x vertical scale
			spineObj.setScale(scaleFactor * 0.95, scaleFactor * 1.675);
			spineObj.setDepth(15);
			spineObj.setPosition(getScatterX(i), centerY + 10);
			spineObj.setVisible(false);
            
			this.scatterAnticipations[i] = spineObj;
            const b: any = (spineObj as any).getBounds ? (spineObj as any).getBounds() : undefined;
			const w = b?.size?.x ?? 0;
			const h = b?.size?.y ?? 0;
			// console.log(`[ScatterAnticipation] instance ${i} size: ${w} x ${h}`);
		}
    }

    public setScatterAnticipationVisible(index: number, visible: boolean, scene: GameScene): void {
        const obj = this.scatterAnticipations[index];
        if (obj) {
            obj.setVisible(visible);
        }
        if(visible){
            scene.audioManager.anticipationSFX.play();
        }
        else{
            scene.audioManager.anticipationSFX.stop();
        }
    }

    public setAllScatterAnticipationsVisible(visible: boolean): void {
        this.scatterAnticipations.forEach((obj) => obj.setVisible(visible));
    }

    private getLandedScatterCount(): number {
        let count = 0;
        try {
            for (let r = 0; r < (this.symbolGrid?.length || 0); r++) {
                const rowArr = (this.symbolGrid as any)[r] as Array<any>;
                if (!rowArr) continue;
                for (let c = 0; c < rowArr.length; c++) {
                    const sym = rowArr[c];
                    if (sym instanceof SymbolContainer) {
                        const val = (sym as any).getSymbolValue ? (sym as any).getSymbolValue() : undefined;
                        if (val === 0 && (sym as any).visible && !this.droppingScatters.has(sym)) {
                            count++;
                        }
                    }
                }
            }
        } catch (_e) {}
        return count;
    }

    private logVisibleScatterCount(): void {
        try {
            // Count only landed, visible scatter containers (symbol 0) that are NOT currently dropping
            const count = this.getLandedScatterCount();
            // console.log(`[SCATTER DROP] Visible scatter (symbol0) count (landed): ${count}`);

        } catch (_e) { /* ignore log errors */ }
    }
    
    private async createReel(scene: GameScene, data: SpinData): Promise<void> {
        // If we're in bonus and using API-provided free spins, do not call backend spin
        if (scene.gameData.isBonusRound && scene.gameData.useApiFreeSpins) {
            // console.log(`[BONUS] createReel: Already in API-driven bonus. isBonusRound=${scene.gameData.isBonusRound}, freeSpins=${scene.gameData.freeSpins}`);
            //await this.playApiFreeSpin(scene);
            return;
        }

        //Events.emitter.emit(Events.UPDATE_BALANCE);
        Events.emitter.emit(Events.GET_BALANCE);

        this.cleanupAloneSymbols();
        let newValues: number[][] = [];
        
        // Wait for doSpin to complete
        const isBuyFeature = data.isBuyFeature ?? scene.gameData.buyFeatureEnabled;
        const betAmount =  scene.gameData.bet;
        const isEnhancedBet = data.isEnhancedBet ?? scene.gameData.doubleChanceEnabled;
        
        // if(isBuyFeature || isEnhancedBet)
        //     console.log('[BUY FEATURE] isBuyFeature:', isBuyFeature, 'betAmount sent:', betAmount, 'isEnhancedBet:', isEnhancedBet);;
        
        const result = await scene.gameAPI.doSpin(betAmount, isBuyFeature, isEnhancedBet);

        scene.buttons.bonusMultiplier = 1;
        
        if(result == "error"){
            console.log('[BUY FEATURE] doSpin error', result);
            return;
        }
        
        console.log("result", result);
        // console.log("Tumbles", result.slot.tumbles);

        let toBet = result.bet;
        if(data.isBuyFeature){
            toBet *= 100;
        }
         else if(data.isEnhancedBet){
            toBet *= 1.25;
        }

        Events.emitter.emit(Events.UPDATE_FAKE_BALANCE, toBet, 0); // ( reduce , increase )
        
        // if(result.slot.freeSpin?.items?.length > 0){
        //     console.log(chalk.bgGreenBright.black.bold(' [BUY FEATURE] triggered freeSpin '), result.slot.freeSpin);
        // }
        
        // If backend returned free spin sequence, store it to drive the bonus round from API data
        const apiFs = result?.slot?.freeSpin?.items || result?.slot?.freeSpins?.items || [];
        scene.gameData.totalBonusWin = result.slot.totalWin;

        if (Array.isArray(apiFs) && apiFs.length > 0) {
            // Suppress regular total-win overlay for this spin; show only FreeSpin overlay
            this.bonusTriggeredThisSpin = true;
            // Mark UI that free spins are now triggered (used to disable autoplay stop button only now)
            try {
                (scene as any).buttons.freeSpinTriggered = true;
                // Disable autoplay buttons only when FS is actually triggered
                scene.buttons.updateButtonStates(scene as GameScene);
            } catch (_e) {}
            // As soon as we know free spins will trigger during this spin (tumbling state),
            // keep the spin button present and hide the FreeSpin button until bonus actually starts
            try {
                scene.buttons.autoplayIndicator.visible = !!scene.buttons?.autoplay?.isAutoPlaying;
                // Do not hide FS button during autoplay; preserve if autoplay is active
                if (!scene.buttons?.autoplay?.isAutoPlaying) {
                    scene.buttons.freeSpinBtn.visible = false;
                }
                scene.buttons.updateButtonStates(scene as GameScene);
            } catch (_e) {}
            scene.gameData.apiFreeSpins =  [];
            scene.gameData.apiFreeSpins = apiFs;
            scene.gameData.apiFreeSpinsIndex = 0;
            scene.gameData.useApiFreeSpins = true;
            // Reset per-sequence FS totals to avoid leaking values across bonus rounds
            scene.gameData.totalWinFreeSpin = [];
            // Rely on spinsLeft from the first API entry
            const currentSpinsLeft = apiFs[0]?.spinsLeft;
            scene.gameData.freeSpins = currentSpinsLeft;
            scene.gameData.totalFreeSpins = apiFs.length;
            scene.gameData.totalWinFreeSpinPerTumble = [];
            apiFs.forEach((v)=>{
                scene.gameData.totalWinFreeSpin.push(v.totalWin);
                let totalWinFreeSpinPerTumble = 0;
                v.tumbles?.forEach((t: any)=>{
                    totalWinFreeSpinPerTumble += t?.win;
                });

                scene.gameData.totalWinFreeSpinPerTumble.push(totalWinFreeSpinPerTumble);
            })

            // If autoplay is running, pause it to hand control to API-driven free spins
            try {
                if (scene.buttons?.autoplay?.isAutoPlaying) {
                    scene.buttons.autoplay.pauseForBonus();
                    if (scene.buttons?.updateButtonStates) {
                        scene.buttons.updateButtonStates(scene as GameScene);
                    }
                }
            } catch (_e) { /* no-op */ }

            // Apply a manual spin lockout for 5 seconds after free spins are triggered
            try {
                (scene as any).gameData.freeSpinLockUntilMs = Date.now() + 5000;
                (scene as any).time?.delayedCall?.(5000, () => {
                    try { (scene as any).buttons?.updateButtonStates?.(scene as any); } catch (_e) {}
                });
            } catch (_e) {}

            // After current spin concludes (entire tumble sequence done), animate scatters then enter bonus and show the free spins popup
            Events.emitter.once(Events.TUMBLE_SEQUENCE_DONE, async (e: any) => {
                // If any scatter symbols (value 0) are present on the final grid, animate them
                try {
                    const finalGrid: number[][] = (e && e.symbolGrid) ? e.symbolGrid : [];
                    const scatterObjs: (Phaser.GameObjects.Sprite | SpineGameObject)[] = [];
                    for (let row = 0; row < finalGrid.length; row++) {
                        for (let col = 0; col < (finalGrid[row]?.length || 0); col++) {
                            if (finalGrid[row][col] === 0 && this.symbolGrid?.[row]?.[col]) {
                                scatterObjs.push(this.symbolGrid[row][col] as any);
                            }
                        }
                    }
                    if (scatterObjs.length >= 3) {
                        await this.animateScatterSymbolsForApi(scene, scatterObjs);
                    }
                } catch (_e) { /* no-op */ }

                scene.gameData.isBonusRound = true;
                scene.background.toggleBackground(scene);
                scene.audioManager.changeBackgroundMusic(scene);
                // Show remaining FS label immediately and hide bottom controls
                if (scene.buttons?.showRemainingFreeSpinsLabel) {
                    scene.buttons.showRemainingFreeSpinsLabel(scene);
                }
                if (scene.buttons?.hideBottomControlsForBonus) {
                    scene.buttons.hideBottomControlsForBonus(scene, true);
                }
                // console.error(`[BONUS] API FS: animations done, setting isBonusRound=true and showing popup (FS=${currentSpinsLeft})`);
                this.showFreeSpinsPopup(scene, currentSpinsLeft);
            });
        }

        newValues = transpose(result.slot.area);
        try { (scene.gameData as any).lastSpinGrid = newValues.map(col => [...col]); } catch (_e) {}
        
        let randtest = Math.floor(Math.random() * 9) + 1;
        
        for(let i = 0; i < newValues.length; i++){
            for(let j = 0; j < newValues[i].length; j++){   
                if(scene.gameData.debugged > 0){
                    newValues[i][j] = randtest;
                }
                if(newValues[i][j] == 0){
                    // currently disable scatter 
                    // if(scene.gameData.debugged > 0){
                    //     newValues[i][j] = Math.floor(Math.random() * 9) + 1;
                    // }
                }
            }
        }

        scene.gameData.totalWin = result.slot.totalWin;
        try { (scene.gameData as any).lastTotalWin = result.slot.totalWin; } catch (_e) {}
        // Flag for max win based on API, pass to scene for later use
        try { (scene as any).lastSpinHadMaxWin = !!(result?.slot?.maxWin); } catch (_e) {}
        this.currentIndex = 0;

    await this.playSpinAnimations(scene, newValues, data)
    {
    }
    
        if (Array.isArray(result.slot.tumbles) && result.slot.tumbles.length > 0) {
            try { (scene.gameData as any).lastTumbles = result.slot.tumbles; } catch (_e) {}
            await this.processMatchesSequentially(scene, newValues, result.slot.tumbles);
        } else {
            // No tumbles; emit end events and reset spin state so autoplay won't advance early
            Events.emitter.emit(Events.WIN, {});
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: newValues,
                currentRow: 0
            });
            Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid: newValues });
            // Ensure tumble completion event also fires in the no-tumbles path
            Events.emitter.emit(Events.TUMBLE_SEQUENCE_DONE, { symbolGrid: newValues });
            scene.gameData.isSpinning = false;
            if (scene.buttons && scene.buttons.enableButtonsVisually) {
                scene.buttons.enableButtonsVisually(scene);
            }
            // Ensure lone symbols are cleaned even when there are no tumbles
            this.cleanupAloneSymbols();
        }

        scene.gameData.buyFeatureEnabled = false;
    }

    // API-driven free spin playback
    public async startApiFreeSpins(scene: GameScene): Promise<void> {
        await this.playApiFreeSpin(scene);
    }

    private async playApiFreeSpin(scene: GameScene): Promise<void> {
        const idx = scene.gameData.apiFreeSpinsIndex || 0;
        const fsList: any[] = scene.gameData.apiFreeSpins || [];
        const fs = fsList[idx];
        if (!fs) {
            // No more API free spins, end bonus
            await this.endApiBonus(scene);
            return;
        }

        // Prevent normal spins while processing
        if (scene.gameData.isSpinning) return;
        scene.gameData.isSpinning = true;
        // Reset suppression flag for regular overlays for API-driven FS spins
        this.bonusTriggeredThisSpin = false;

        // Reset tumble index for this spin to ensure animations and match checks start fresh
        this.currentIndex = 0;
        scene.buttons.bonusMultiplier = 0;

        // Use API-provided area and tumbles
        const newValues = transpose(fs.area);
        const tumbles: Tumble[] = fs.tumbles || [];

        // Set per-spin total win from tumbles sum for UI and aggregate bonus
        const spinTotalWin = Array.isArray(tumbles) ? tumbles.reduce((sum, t: any) => sum + (t?.win || 0), 0) : 0;
        // console.log("spinTotalWin", spinTotalWin.toFixed(2));
        // Sum total multiplier values for this free spin
        const multiplierSymbols: number[] = Array.isArray((fs as any)?.multipliers) ? (fs as any).multipliers as number[] : [];
        if (multiplierSymbols.length === 0) {
            scene.buttons.bonusMultiplier = 1;
        } else {
            const totalMultiplier = multiplierSymbols.reduce((total, symbolValue) => {
                const idx = typeof symbolValue === 'number' ? symbolValue - 10 : -1;
                const mapped = (idx >= 0 && idx < scene.gameData.bombMultiplier.length)
                    ? scene.gameData.bombMultiplier[idx]
                    : 0;
                return total + mapped;
            }, 0);
            scene.buttons.bonusMultiplier = totalMultiplier > 0 ? totalMultiplier : 1;
        }

        // scene.gameData.totalWin = spinTotalWin;
        // scene.gameData.totalBonusWin += spinTotalWin;

        // Play arrival animation and then process tumbles from API
        await this.playSpinAnimations(scene, newValues, { symbols: newValues, currentRow: 0, isBuyFeature: false, isEnhancedBet: false, betAmount: scene.gameData.bet });
        if (tumbles.length > 0) {
            await this.processMatchesSequentially(scene, newValues, tumbles);
        } else {
            // No tumbles; still emit end events to keep flow consistent
            Events.emitter.emit(Events.WIN, {});
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: newValues,
                currentRow: 0
            });
            Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid: newValues });
            // Ensure tumble completion event also fires in the no-tumbles path (API-driven FS)
            Events.emitter.emit(Events.TUMBLE_SEQUENCE_DONE, { symbolGrid: newValues });
            scene.gameData.isSpinning = false;
            if (scene.buttons && scene.buttons.enableButtonsVisually) {
                scene.buttons.enableButtonsVisually(scene);
            }
            // Clean up lone symbols even when there are no tumbles in API-driven spins
            this.cleanupAloneSymbols();
        }

        // After tumbles are fully processed, play visual-only scatter animation (if retrigger present)
        try {
            const scatterCount = newValues.flat().filter(v => v === 0).length;
            const threshold = scene.gameData.isBonusRound ? 3 : 4;
            if (scatterCount >= threshold) {
                const scatterSprites: (Phaser.GameObjects.Sprite | SpineGameObject | SymbolContainer)[] = [];
                for (let row = 0; row < newValues.length; row++) {
                    for (let col = 0; col < newValues[row].length; col++) {
                        if (newValues[row][col] === 0 && this.symbolGrid[row][col]) {
                            const obj = this.symbolGrid[row][col];
                            // Accept SymbolContainer, Sprite, or SpineGameObject
                            scatterSprites.push(obj as any);
                        }
                    }
                }
                if (scatterSprites.length > 0) {
                    await this.animateScatterSymbolsForApi(scene, scatterSprites);
                    // Visual retrigger popup with brief pause (do not modify spinsLeft; API controls it)
                    if (scene.gameData.isBonusRound && scatterCount >= 3) {
                        this.showRetriggerPopup(scene, 5);
                    }
                }
            }
        } catch (e) {
            console.error('Scatter animation (API) failed', e);
        }

        // After all animations for this free spin, show Big/Mega/Epic/Super overlay
        // based on this free spin's total win, if it meets the threshold
        const betForFs = scene.gameData.bet || 1;
        const fsReportedTotal : number = fs?.totalWin;
        const thisFreeSpinTotal = typeof fsReportedTotal === 'number' ? fsReportedTotal : spinTotalWin;

        const fsMultiplier = betForFs > 0 ? (thisFreeSpinTotal / betForFs) : 0;
        if (fsMultiplier >= scene.gameData.winRank[1]) {
            // Queue the overlay; the scheduler below will wait for it to close before proceeding
            this.showWinOverlay(scene, thisFreeSpinTotal, betForFs);
        }

        // Advance to next API free spin
        scene.gameData.apiFreeSpinsIndex = idx + 1;
        
        Events.emitter.emit(Events.HIDE_BOMB_WIN);
        
        
        const next = fsList[idx + 1];
        const spinsLeft = Math.max(0, next?.spinsLeft ?? (fsList.length - (idx + 1)));
        scene.gameData.freeSpins = spinsLeft;
        if (scene.buttons?.updateRemainingFreeSpinsCount) {
            scene.buttons.updateRemainingFreeSpinsCount(scene);
        }
        // Update current free spin index for display (1-based)
        scene.gameData.currentFreeSpinIndex = idx + 1;

        const scheduleNext = async () => {
            if (spinsLeft > 0) {
                // Small delay to ensure any overlay animations finish
                scene.time.delayedCall(300, () => this.playApiFreeSpin(scene));
            } else {
                // End of bonus per API — after the last FS overlay closes, show Congrats
                await this.endApiBonus(scene);
            }
        };

        // If a win overlay is still active, wait for it to close before proceeding
        if (this.activeWinOverlay) {
            Events.emitter.once(Events.WIN_OVERLAY_HIDE, () => {
                scheduleNext();
            });
        } else {
            await scheduleNext();
        }
    }

    // Visual-only scatter animation for API-driven spins (no rewards handling)
    private async animateScatterSymbolsForApi(scene: GameScene, scatterSprites: (Phaser.GameObjects.Sprite | SpineGameObject | SymbolContainer)[]): Promise<void> {
        if (scatterSprites.length === 0) return;
        if (scatterSprites.length < 3) return;
        // console.log(`[SCATTER] (API) Preparing to animate ${scatterSprites.length} scatter symbol(s)`);
        scene.audioManager.ScatterSFX.play();
        const animationPromises: Promise<void>[] = [];
        scatterSprites.forEach((sprite, index) => {
            const animationPromise = new Promise<void>((resolve) => {
                // console.log(chalk.grey(`[SCATTER] (API) Animating scatter symbol idx = `) + chalk.white.bold(index));
                this.createWinParticles(scene, sprite.x, sprite.y, 0xFF0000);
                try {
                    if (sprite instanceof SymbolContainer) {
                        sprite.playSymbolAnimation().then(() => resolve()).catch(() => resolve());
                    } else {
                        // Fallback to Animation service for non-Container sprites
                        this.animation.playSymbolAnimation(sprite as any, 0).then(() => resolve()).catch(() => resolve());
                    }
                } catch (_e) { resolve(); }
            });
            animationPromises.push(animationPromise);
        });
        await Promise.all(animationPromises);
    }

    private async endApiBonus(scene: GameScene): Promise<void> {
        Events.emitter.emit(Events.FINAL_WIN_SHOW, {});
        // Toggle back to base game and show summary
        scene.gameData.isBonusRound = false;
        // Ensure totalBonusWin reflects the sum of the API-provided free spins if available
        try {
            const fsList: any[] = Array.isArray(scene.gameData.apiFreeSpins) ? scene.gameData.apiFreeSpins : [];
            if (fsList.length > 0) {
                const apiFsSum = fsList.reduce((sum, fs: any) => sum + (Number(fs?.totalWin) || 0), 0);
                if (apiFsSum > 0) {
                    scene.gameData.totalBonusWin = apiFsSum;
                } else if (Array.isArray(scene.gameData.totalWinFreeSpin) && scene.gameData.totalWinFreeSpin.length > 0) {
                    const arrSum = scene.gameData.totalWinFreeSpin.reduce((sum, v) => sum + (Number(v) || 0), 0);
                    if (arrSum > 0) scene.gameData.totalBonusWin = arrSum;
                }
            }
        } catch (_e) { /* ignore recompute errors */ }

        
        const bonusWin = scene.gameData.totalWin;
        // console.log("endiAPIBonus", bonusWin);

        this.showBonusWin(scene, bonusWin);
        scene.gameData.useApiFreeSpins = false;
        scene.gameData.apiFreeSpins = [];
        scene.gameData.apiFreeSpinsIndex = 0;
        // Clear FS totals at the end of the bonus to prevent reuse next spins
        scene.gameData.totalWinFreeSpin = [];
        scene.buttons.freeSpinBtn.visible = false;
        // Show bottom controls again
        if (scene.buttons?.hideBottomControlsForBonus) {
            scene.buttons.hideBottomControlsForBonus(scene, false);
        }
        if (scene.buttons?.hideRemainingFreeSpinsLabel) {
            scene.buttons.hideRemainingFreeSpinsLabel();
        }
        // On desktop, remove the HUD near spin button as FS ended
        try {
            if (!scene.buttons?.autoplay?.isMobile && scene.buttons?.autoplay?.hideRemainingSpinsDisplay) {
                scene.buttons.autoplay.hideRemainingSpinsDisplay();
            }
        } catch (_e) { /* no-op */ }
        
        Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
        Events.emitter.emit(Events.UPDATE_BALANCE);
    }

    private async playSpinAnimations(scene: GameScene, newValues: number[][], data: SpinData): Promise<void> {
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        // Initialize newSymbolGrid with proper nested arrays
        let newSymbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as unknown as SymbolGrid;
        Object.assign(newSymbolGrid, {
            length: numRows,
            map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(newSymbolGrid[row], row)),
            forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(newSymbolGrid[index], index))
        });

        const rowInterval = 150; // ms between each row's arrival in a column
        let turboSpeed = scene.gameData.turbo ? 0.2 : 1;
        let offsetDelay = 1100;
        
        if(scene.gameData.turbo){
            scene.audioManager.TurboDrop.play();
        }

        const animationPromises: Promise<void>[] = [];

        for (let col = 0; col < numCols; col++) {
            for (let row = numRows - 1; row >= 0; row--) {
                const symbol = this.symbolGrid[row][col];
                const centerX = width * 0.5 + col * (width + horizontalSpacing);
                const centerY = height * 0.5;
                const symbolX = centerX;
                const symbolY = centerY + row * (height + verticalSpacing);
                const delay = (col * 250 + (numRows - 1 - row) * rowInterval) * turboSpeed;

                // Modify the symbol creation part
                const symbolValue = newValues[row][col];
                
                let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer | null = null;
                let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                const startY = symbolY - height * (numRows + 1);
                if (symbolValue >= 0 && symbolValue <= 9) {
                    // Create SymbolContainer for symbols 0-9 (including scatter)
                    newSymbol = new SymbolContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    if (symbolValue === 0) {
                        // Scatter symbol (Symbol 0)
                        newSymbol.setSymbolDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                        // newSymbol.setScale(0.33);
                        // console.log('Created SymbolContainer for scatter symbol', { symbolValue, position: { x: symbolX, y: startY } });
                    } else {
                        // Regular symbols 1-9 with specific adjustments for symbols 2 and 4
                        if (symbolValue === 2 || symbolValue === 4 || symbolValue === 6) {
                            // Adjust ratio for symbols 2 and 4 to match other symbols
                            newSymbol.setSymbolDisplaySize(width * Slot.SYMBOL_SIZE * (1 + Slot.SYMBOL_SIZE_ADJUSTMENT), height * Slot.SYMBOL_SIZE * (1 - Slot.SYMBOL_SIZE_ADJUSTMENT));
                            // console.log('Created SymbolContainer for symbol with adjusted ratio', { symbolValue, position: { x: symbolX, y: startY } });
                        } else {
                            // Regular symbols 1-9
                            newSymbol.setSymbolDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                            // console.log('Created SymbolContainer for symbol', { symbolValue, position: { x: symbolX, y: startY } });
                        }
                    }
                }
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_FIS`;
                    const sc = new SymbolContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    sc.setSymbolDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                    try { sc.getSymbolSprite().animationState.setAnimation(0, `animation`, false); } catch (_e) {}
                    try { sc.getSymbolSprite().animationState.timeScale = 0; } catch (_e) {}
                    newSymbol = sc;
                } else if (symbolValue >= 10 && symbolValue <= 22) {
                    // Create BombContainer for bomb
                    newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    // Size bombs similar to regular symbols so they visually align with the grid
                    newSymbol.setBombDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                    // console.log('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                } else {
                    const sc = new SymbolContainer(scene, symbolX, startY, 0, scene.gameData);
                    sc.setSymbolDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                    try { sc.getSymbolSprite().animationState.setAnimation(0, `animation`, false); } catch (_e) {}
                    try { sc.getSymbolSprite().animationState.timeScale = 0; } catch (_e) {}
                    newSymbol = sc;
                }

                // Sizing for symbols and bombs is already handled above using
                // setSymbolDisplaySize and setBombDisplaySize on the appropriate
                // container types. Avoid calling setDisplaySize on containers.

                // Ensure bombs render above other symbols
                if (newSymbol && symbolValue >= 10 && symbolValue <= 22) {
                    newSymbol.setDepth(10);
                }

                // Calculate duration based on distance to maintain consistent speed
                const distance = symbolY - startY;
                const baseSpeed = 2; // pixels per millisecond
                let duration = (distance / baseSpeed) * turboSpeed;
                if (scene.gameData.turbo) {
                    duration = Math.min(duration, 1250 * turboSpeed);
                }

                // Add extra delay for turbo mode to prevent overlap
                let tweenDelay = (delay + offsetDelay) * turboSpeed;
                if (scene.gameData.turbo) {
                    tweenDelay += duration / turboSpeed;
                }

                // Tween out the old symbol
                if (symbol) {
                    const endY = symbol.y + height * (numRows + 1);
                    const distance = endY - symbol.y;
                    const baseSpeed = 2;
                    const durationOld = (distance / baseSpeed) * turboSpeed;

                    // Create multiple motion trails
                    const trails: Phaser.GameObjects.Sprite[] = [];
                    const numTrails = 10;
                    const trailSpacing = -100; // Space between trails

                    for (let i = 0; i < numTrails; i++) {
                        if(scene.gameData.turbo == false && 'texture' in symbol) {
                            const trail = scene.add.sprite(symbol.x, symbol.y, symbol.texture.key, symbol.frame.name);
                            trail.setDisplaySize(symbol.displayWidth, symbol.displayHeight);
                            trail.setAlpha(0.7 - (i * 0.15)); // Decreasing alpha for each trail
                            trail.setPipeline('BlurPostFX');

                            (trail as any).blurStrength = 0.8 + (i * 0.1); // Increasing blur for each trail
                            trail.setDepth(symbol.depth - (i + 1)); // Place trails behind the symbol
                            this.container.add(trail);
                            trails.push(trail);
                        }
                    }

                    scene.tweens.add({
                        targets: symbol,
                        y: endY,
                        alpha: 0.1,
                        scale: 0.5,
                        duration: durationOld,
                        delay: delay,
                        ease: 'Quart.easeInOut',
                        onUpdate: () => {
                            // Update trail positions and fade
                            if(scene.gameData.turbo == false) {
                                setTimeout(() => {
                                    trails.forEach((trail, index) => {
                                        trail.y = symbol.y - (trailSpacing * (index + 1));
                                        trail.alpha = symbol.alpha * (0.7 - (index * 0.15));
                                    });
                                }, 100);
                            }
                        },
                        onComplete: () => {
                            trails.forEach(trail => trail.destroy());
                            symbol.destroy();
                        }
                    });
                }

                // Move new symbol down
                if(newSymbol) {
                    const animationPromise = new Promise<void>((resolve) => {
                        // Track only scatter containers during arrival tween
                        const isScatterContainer = (newSymbol instanceof SymbolContainer) && (newSymbol as any).getSymbolValue?.() === 0;
                        if (isScatterContainer) {
                            this.droppingScatters.add(newSymbol as SymbolContainer);
                        }
                        scene.tweens.add({
                            targets: newSymbol,
                            y: symbolY,
                            duration: duration,
                            ease: 'Quart.easeInOut',
                            delay: tweenDelay,
                            onComplete: () => {
                                if(row === 4){
                                    if(!scene.gameData.turbo){
                                        scene.audioManager.ReelDrop.play();
                                    }
                                }
                                if (isScatterContainer) {
                                    this.droppingScatters.delete(newSymbol as SymbolContainer);
                                }
                                try { this.logVisibleScatterCount(); } catch (_e) {}
                                resolve();
                            }
                        });
                    });
                    animationPromises.push(animationPromise);
                    
                    this.container.add(newSymbol);
                    newSymbolGrid[row][col] = newSymbol;
                }
            }
        }


        this.symbolGrid = newSymbolGrid;
        
        // Wait for all animations to complete
        await Promise.all(animationPromises);
        
        Events.emitter.emit(Events.SPIN_ANIMATION_END, {
            symbols: newValues,
            currentRow: data.currentRow
        });
    }
    private currentIndex = 0;

    private async processMatchesSequentially(scene: GameScene, symbolGrid: number[][], SymbolsIn : Tumble[]): Promise<void> {
        let continueMatching = true;
        let lastResult: string | undefined = undefined;
        // console.log("SymbolsIn", SymbolsIn);
        try {
            while (continueMatching) {
                const result = await this.checkMatchAsync(symbolGrid, scene, SymbolsIn[this.currentIndex]);
                lastResult = result;
                // During API-driven Free Spins, emit per-tumble total-win update like reference
                // try {
                //     if (scene.gameData.useApiFreeSpins) {
                //         Events.emitter.emit(Events.FREE_SPIN_TOTAL_WIN);
                //     }
                // } catch (_e) {}
                if (result === "No more matches" || result === "free spins") {
                    continueMatching = false;
                }
                else if (result === "continue match"){
                    this.hadMatchThisSpin = true;
                    if(this.currentIndex < SymbolsIn.length){
                        this.currentIndex++;
                    }
                    else{
                        console.log("No more tumbles, stopping match");
                        continueMatching = false;
                    }
                }
                // If result is "continue match", the loop will continue
            }
        } catch (error) {
            console.error("Error in match processing: " + error);
        } finally {
            // Only handle deferred scatter at the end of all matches
            // console.log(chalk.green.bold('totalWin: ' + scene.gameData.totalWin.toFixed(2)));
            // Big/Mega/Epic/Super overlays will be handled per-tumble during FreeSpins only
            // Ensure bomb animations complete before showing win overlay
            if (this.hadMatchThisSpin) {
                // If there are bombs on the grid, explode them first
                let hadBombs = false;
                for (let r = 0; r < (this.symbolGrid?.length || 0); r++) {
                    const rowArr = (this.symbolGrid as any)[r] as Array<any>;
                    if (!rowArr) continue;
                    for (let c = 0; c < rowArr.length; c++) {
                        const symbol = rowArr[c];
                        if (symbol instanceof BombContainer) {
                            hadBombs = true;
                            break;
                        }
                    }
                    if (hadBombs) break;
                }
                await this.explodeAndRemoveAllBombs(scene as GameScene);
                // Inform UI to apply multiplier once after bombs
                try { Events.emitter.emit(Events.WIN, { applyMultiplier: true }); } catch (_e) {}
                this.hadMatchThisSpin = false;
                // After bomb animations complete, wait ~1 second before proceeding to WinOverlay
                if (hadBombs) {
                    await new Promise<void>((resolve) => {
                        scene.time.delayedCall(1000, () => resolve());
                    });
                }
            }
            // After all match/bomb animations, handle deferred scatter animations and rewards
            if (!scene.gameData.useApiFreeSpins && this.deferredScatterCount > 0) {
                const deferredCount = this.deferredScatterCount;
                this.deferredScatterCount = 0;
                // Collect existing scatter sprites still on grid (they may be present visually)
                const rows = symbolGrid.length;
                const cols = symbolGrid[0].length;
                const scatterSprites: GameObjects.Sprite[] = [];
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        if (symbolGrid[row][col] === 0 && this.symbolGrid[row][col]) {
                            const spr = this.symbolGrid[row][col];
                            if (spr instanceof Phaser.GameObjects.Sprite) {
                                scatterSprites.push(spr);
                            }
                        }
                    }
                }
                await this.animateScatterSymbols(scene, scatterSprites, deferredCount);
                // animateScatterSymbols will emit MATCHES_DONE and call handleScatterRewards
            }

            // Emit tumble sequence completion event so UI can clear interim displays
            Events.emitter.emit(Events.TUMBLE_SEQUENCE_DONE, { symbolGrid });
            // Always ensure spinning state is reset
            scene.gameData.isSpinning = false;

            let totalWin = 0;
            SymbolsIn.forEach(v=>{
                totalWin += v.win;
            })
            if(!scene.gameData.isBonusRound){
                Events.emitter.emit(Events.UPDATE_BALANCE, totalWin);
            }

            if (scene.gameData.useApiFreeSpins) {
                Events.emitter.emit(Events.FREE_SPIN_TOTAL_WIN);
            }

            // console.log("Spin sequence completed, isSpinning reset to false");
            // Immediately re-enable buttons when spinning completes
            if (scene.buttons && scene.buttons.enableButtonsVisually) {
                scene.buttons.enableButtonsVisually(scene);
            }
        }
    }

    private eventListeners(scene: GameScene): void {
        this.onSpinListener = async (data: SpinData) => {
            const currentTime = Date.now();
            // Enforce manual spin lockout after free spin trigger
            if (currentTime < (((scene as any).gameData.freeSpinLockUntilMs) || 0)) {
                console.log(`Spin blocked: free spin lockout active for ${((scene as any).gameData.freeSpinLockUntilMs) - currentTime}ms`);
                return;
            }
            // Immediate check to prevent overlapping spins
            if (scene.gameData.isSpinning) {
                console.log("Spin already in progress, ignoring new spin request");
                return;
            }
            // Reset per-spin match flag
            this.hadMatchThisSpin = false;
            // Reset bonus trigger flag for this spin
            this.bonusTriggeredThisSpin = false;
            // Always reset tumble index at the start of every spin
            this.currentIndex = 0;
            // Rate limiting: prevent spins that are too close together
            if (currentTime - this.lastSpinTimestamp < this.MIN_SPIN_INTERVAL) {
                console.log(`Spin rate limited, ${this.MIN_SPIN_INTERVAL}ms cooldown active`);
                return;
            }
            // Set spinning state immediately to block further spin attempts
            scene.gameData.isSpinning = true;
            this.lastSpinTimestamp = currentTime;
            
            // Hide SymbolCountWin display when spinning starts
            this.hideSymbolCountWinDisplay();
            // Cleanup any orphaned symbols in the slot container before starting a new spin
            this.cleanupAloneSymbols();
            try {
                if (scene.gameData.useApiFreeSpins) {
                    Events.emitter.emit(Events.FREE_SPIN_TOTAL_WIN);
                }
            } catch (_e) {}
            // Ensure buttons stay disabled during actual spin processing
            if (scene.buttons && scene.buttons.updateButtonStates) {
                scene.buttons.updateButtonStates(scene);
            }
            try {
                if(scene.gameData.debugged > 0){
                    scene.gameData.demoMode = true;
                }

                scene.audioManager.ReelDrop.play();
                // Fire spin start event so UI (e.g., total win text) can reset immediately
                try { Events.emitter.emit(Events.SPIN_ANIMATION_START, { currentRow: scene.gameData.currentRow }); } catch (_e) {}
                if (scene.gameData.demoMode) {
                    
                    // DEMO/IDLE: Generate new random symbols every spin
                    Slot.TOGGLE_DIFFICULTY = true;
                    Slot.DIFFICULTY_SYMBOLS = scene.gameData.debugged;
                    const newSymbols = Array(Slot.ROWS).fill(null).map(() => getRandomRows());
                    await this.playSpinAnimations(scene, newSymbols, { symbols: newSymbols, currentRow: 0, 
                        isBuyFeature: false, isEnhancedBet: false, betAmount: scene.gameData.bet });
                    const tumble : Tumble = { symbols : {in: newSymbols, out: []}, win: 0 };
                    await this.processMatchesSequentially(scene, newSymbols, [tumble]);
                } else {
                    // REAL: Use backend API
                    Slot.TOGGLE_DIFFICULTY = false;
                    Slot.DIFFICULTY_SYMBOLS = 4;
                    await this.createReel(scene, data);
                }
            } catch (error) {
                console.error("Error during spin: " + error);
                scene.gameData.isSpinning = false; // Reset state on error
                // Re-enable buttons on error
                if (scene.buttons && scene.buttons.enableButtonsVisually) {
                    scene.buttons.enableButtonsVisually(scene);
                }
            }
        };
        Events.emitter.on(Events.SPIN, this.onSpinListener);

        this.onStartListener = (data: SpinData) => {
            this.createSampleSymbols(scene, data.symbols);
        };
        Events.emitter.on(Events.START, this.onStartListener);
    }

    private createSampleSymbols(scene: GameScene, symbols: number[][]): void {
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        // Initialize the symbolGrid with proper nested arrays
        this.symbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as SymbolGrid;
        Object.assign(this.symbolGrid, {
            map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(this.symbolGrid[row], row)),
            forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(this.symbolGrid[index], index))
        });

        for (let row = 0; row < numRows; row++) {
            let sampleScatterCount = 0;
            for (let col = 0; col < numCols; col++) {
                const symbolValue = symbols[row][col];
                let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_FIS`;
                }
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const symbolY = centerY + row * (height + verticalSpacing);

                let symbolObj: SymbolContainer;
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolObj = new SymbolContainer(scene, symbolX, symbolY, symbolValue, scene.gameData);
                } else {
                    symbolObj = new SymbolContainer(scene, symbolX, symbolY, 0, scene.gameData);
                }
                try { symbolObj.getSymbolSprite().animationState.setAnimation(0, `animation`, false); } catch (_e) {}

                if (symbolValue === 0 && sampleScatterCount < 3){
                    sampleScatterCount++;
                    symbolObj.setSymbolDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else {
                    symbolObj.setSymbolDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                }
                symbolObj.getSymbolSprite().animationState.timeScale = 0;

                this.container.add(symbolObj);
                this.symbolGrid[row][col] = symbolObj as any;
            }
        }
    }


    public async spin(scene: Scene, data: any): Promise<void> {
        // Clear previous bomb animations
        
        const gameScene = scene as GameScene;
        


        // Create new spin data
        const spinData: SpinData = {
            symbols: data.symbols,
            currentRow: 0,
            isBuyFeature: scene.gameData.buyFeatureEnabled,
            isEnhancedBet: scene.gameData.doubleChanceEnabled,
            betAmount: scene.gameData.bet
        };

        // Place scatters if needed
        if (gameScene.gameData.scatterCount > 0) {
            gameScene.gameData.slot.placeScatters(
                gameScene.gameData.minScatter,
                gameScene.gameData.maxScatter,
                gameScene.gameData.scatterChance
            );
        }

        // Place bombs during bonus round
        if (gameScene.gameData.isBonusRound) {
            // Create a copy of the symbols array to modify
            const symbols: number[][] = data.symbols.map((row: number[]) => [...row]);
            
            // Place bombs in the grid
            for (let row = 0; row < Slot.ROWS; row++) {
                for (let col = 0; col < Slot.COLUMNS; col++) {
                    // Only replace regular symbols (1-9)
                    if (symbols[row][col] >= 1 && symbols[row][col] <= 9) {
                        // Determine if we should place a bomb
                        if (Math.random() < gameScene.gameData.bombChance / 100) { // Convert percentage to decimal
                            // Determine bomb type based on probabilities
                            const rand = Math.random();
                            let bombType: number;
                            if (rand < 0.6) { // Low (60%)
                                bombType = Math.floor(Math.random() * 7) + 10; // 10-16
                            } else if (rand < 0.9) { // Medium (30%)
                                bombType = Math.floor(Math.random() * 4) + 17; // 17-20
                            } else { // High (10%)
                                bombType = Math.floor(Math.random() * 2) + 21; // 21-22
                            }
                            symbols[row][col] = bombType;
                            gameScene.gameData.slot.bombCount++;
                        }
                    }
                }
            }
            
            // Update the spin data with the modified symbols
            spinData.symbols = symbols;
        }
        // Create the reel
        this.createReel(gameScene, spinData);
    }


    public showBonusWin(scene: GameScene, totalWin: number): void {    
        // If max win cap reached, show claim FIRST then proceed to congrats on claim
        try {
            const betAmt = scene.gameData.bet || 1;
            const maxCap = (scene.gameData.winRank?.[5]) || 21000;
            const reached = betAmt > 0 ? (totalWin / betAmt) >= maxCap : false;
            if (reached && this.maxWinClaim) {
                this.maxWinClaim.show(scene as any, maxCap, () => {
                    this.enqueueWinOverlay(scene, totalWin, 'Congrats');
                });
                scene.buttons.freeSpinBtn.visible = false;
                return;
            }
        } catch (_e) {}

        // Otherwise, show congrats normally
        this.enqueueWinOverlay(scene, totalWin, 'Congrats');
        //this.showWinOverlay(scene, scene.gameData.totalWin, scene.gameData.bet);
        scene.buttons.freeSpinBtn.visible = false;
    }

    public update(): void {
        // Empty implementation - can be used for future animations or updates
    }

    private showFreeSpinsPopup(scene: GameScene, freeSpins: number): void {
        // Check if there's an active win overlay
        if (this.activeWinOverlay) {
            // Wait for the win overlay to be removed before proceeding
            Events.emitter.once(Events.WIN_OVERLAY_HIDE, () => {
                // Small delay to ensure prior overlay exit animation fully completes
                scene.time.delayedCall(200, () => {
                    this.showWinOverlay(scene, freeSpins, -1);
                });
            });
            console.log(`[BONUS] Overlay active, waiting to show congrats popup (FS=${freeSpins})`);
        } else {
            // No overlay active, proceed with a tiny delay for stability
            scene.time.delayedCall(100, () => {
                this.showWinOverlay(scene, freeSpins, -1);
            });
        }
    }


    private showWinOverlay(scene: GameScene, totalWin: number, bet: number): void {
        // Map sentinel bet values to explicit overlay types
        let overlayType: string | undefined;
        if (bet === -1) {
            overlayType = 'FreeSpin';
        } else if (bet === -2) {
            overlayType = 'Congrats';
        }

        if (!overlayType) {
            // Calculate multiplier for regular win type
            let multiplier = 1;
            if (bet > 0) {
                multiplier = totalWin / bet;
            } else {
                multiplier = bet;
            }
            if (multiplier === 0) return; // Skip zero case
            overlayType = multiplier.toString();
        }

        // Enqueue and let the queue handler display it safely
        this.enqueueWinOverlay(scene, totalWin, overlayType);
    }

    public destroyWinOverlay(scene: GameScene): void {
        // Destroy all win overlay containers
        // Note: Each container will remove itself from the array when destroyed
        const overlays = [...this.winOverlayContainers]; // Create a copy to avoid mutation issues
        overlays.forEach(container => container.destroy());
        
        // Ensure array is cleared and state is reset
        this.winOverlayContainers = [];
        this.activeWinOverlay = false;
        scene.audioManager.stopWinSFX(scene);
        Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
    }

    private enqueueWinOverlay(scene: GameScene, totalWin: number, overlayType: string): void {
        this.winOverlayQueue.push({ totalWin, overlayType });
        this.tryShowNextOverlay(scene);
    }

    private tryShowNextOverlay(scene: GameScene): void {
        if (this.activeWinOverlay) return;
        if (this.winOverlayQueue.length === 0) return;
        const next = this.winOverlayQueue.shift();
        if (!next) return;
        const winOverlay = new WinOverlayContainer(scene, this.winAnimation);
        this.winOverlayContainers.push(winOverlay);
        this.activeWinOverlay = true;
        winOverlay.show(next.totalWin, next.overlayType);
    }

    private createWinParticles(scene: GameScene, x: number, y: number, color: number = 0xFFD700): void {
        // Create a particle emitter for sparks
        const sparks = scene.add.particles(x, y, 'star', {
            speed: { min: 200, max: 400 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            blendMode: 'ADD',
            lifespan: 1000,
            gravityY: 300,
            quantity: 1,
            frequency: 50,
            tint: color,
            emitting: false
        });

        // Create a particle emitter for glowing effect
        const glow = scene.add.particles(x, y, 'star', {
            speed: { min: 50, max: 100 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.2, end: 0.4, ease: 'Quad.easeOut' },
            alpha: { start: 0.5, end: 0 },
            blendMode: 'ADD',
            lifespan: 1500,
            quantity: 1,
            frequency: 50,
            tint: color,
            emitting: false
        });

        // Emit particles in a burst
        sparks.explode(15);
        glow.explode(10);

        // Create expanding ring effect
        const ring = scene.add.graphics();
        ring.lineStyle(2, color, 1);
        ring.strokeCircle(0, 0, 10);
        ring.setPosition(x, y);

        // Animate the ring
        scene.tweens.add({
            targets: ring,
            scaleX: 2,
            scaleY: 2,
            alpha: 0,
            duration: 1000,
            ease: 'Quad.easeOut',
            onComplete: () => {
                ring.destroy();
            }
        });

        // Cleanup particles after animation
        scene.time.delayedCall(1500, () => {
            sparks.destroy();
            glow.destroy();
        });
    }

    private async checkMatchAsync(symbolGrid: number[][], scene: GameScene, SymbolsIn : Tumble): Promise<string> {
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const symbolCount: { [key: number]: number } = {};
        const matchIndices: { [key: number]: { row: number; col: number; }[] } = {};

        // 1. Count occurrences and collect indices
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const symbol = symbolGrid[row][col];
                symbolCount[symbol] = (symbolCount[symbol] || 0) + 1;
                if (!matchIndices[symbol]) matchIndices[symbol] = [];
                matchIndices[symbol].push({ row, col });
            }
        }

        // 2. Find all symbols with >=8 matches
        const matchedSymbols: number[] = [];
        for (const symbol in symbolCount) {
            if (symbolCount[symbol] >= 8) {
                matchedSymbols.push(parseInt(symbol));
            }
        }

        if (matchedSymbols.length === 0) {
            // --- SCATTER CHECK (deferred to end of match-8s flow) ---
            if (!scene.gameData.useApiFreeSpins) {
                const scatterCount = symbolCount[0] || 0;
                // console.log(chalk.yellow(`[SCATTER] No matches. scatterCount = ${scatterCount}, isBonus = ${scene.gameData.isBonusRound}, threshold = ${scene.gameData.isBonusRound ? 3 : 4}`));
                if (scatterCount >= 4 || (scene.gameData.isBonusRound && scatterCount >= 3)) {
                    // Defer scatter handling until after all match-8s/bomb animations
                    this.deferredScatterCount = scatterCount;
                    // console.log(chalk.blueBright.bold('[SCATTER] Threshold met, deferring scatter handling until end of tumble sequence'));
                } else {
                    // console.log(chalk.white.bold('[SCATTER] Threshold not met, continuing normal flow'));
                }
            }

            // At the end, emit WIN to update totalWin text
            Events.emitter.emit(Events.WIN, {});
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: symbolGrid,
                newRandomValues: symbolGrid
            });

            // Only emit MATCHES_DONE immediately if there is no deferred scatter
            if (this.deferredScatterCount === 0) {
                Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
            }
            // Ensure lone symbols are cleaned even when there are no matches
            this.cleanupAloneSymbols();
            return "No more matches";
        }

        // 3. Collect all matched cells for all matched symbols
        const allMatchedCells: { row: number; col: number; symbol: number }[] = [];
        matchedSymbols.forEach(symbol => {
            matchIndices[symbol].forEach(cell => {
                allMatchedCells.push({ ...cell, symbol });
            });
        });

        // 4. Calculate win amount for each symbol and update game data
        const bet = scene.gameData.bet || 1;
        let totalWinAmount = 0;
        
        // Prepare display symbols data
        const displaySymbols: DisplaySymbol[] = [];
        
        matchedSymbols.forEach(symbol => {
            const matchedCells = matchIndices[symbol];
           // let winAmount = 0;
           // if (matchedCells.length === 8 || matchedCells.length === 9) {
           //     winAmount = symbol === 0 ? 100 * bet :
           //             scene.gameData.winamounts[0][symbol] * bet;
           // } else if (matchedCells.length === 10 || matchedCells.length === 11) {
           //     winAmount = symbol === 0 ? 5 * bet :
           //             scene.gameData.winamounts[1][symbol] * bet;
           // } else if (matchedCells.length >= 12) {
           //     winAmount = symbol === 0 ? 3 * bet :
           //             scene.gameData.winamounts[2][symbol] * bet;
           // }
            // In API-driven mode, SymbolsIn.win already represents the tumble win.
            // Avoid multiplying it by number of matched symbols. Sum once per tumble.
                totalWinAmount += SymbolsIn.symbols.out.find(s => s.symbol === symbol)?.win || 0;
                Events.emitter.emit(Events.WIN, {win: totalWinAmount});

            // Add to display symbols
            displaySymbols.push({
                symbol: symbol,
                count: matchedCells.length,
                win: SymbolsIn.symbols.out.find(s => s.symbol === symbol)?.win || 0
            });
        });
        // In API-driven mode, total wins are aggregated per spin elsewhere
        if (scene.gameData.isBonusRound && !scene.gameData.useApiFreeSpins) {
            //scene.gameData.totalBonusWin += totalWinAmount;
        }
        Events.emitter.emit(Events.WIN, {});

        // 5. Show SymbolCountWin display
        this.showSymbolCountWinDisplay(scene, displaySymbols);

        // 6. UI updates: per-tumble increment and optional desktop popups
        Events.emitter.emit(Events.UPDATE_TOTAL_WIN, totalWinAmount);
        if(!this.isMobile) {
            // Show popup text for each symbol
            matchedSymbols.forEach(symbol => {
                this.showWinPopup(scene, matchIndices[symbol], (function() {
                    let winAmount = 0;
                        winAmount = SymbolsIn.symbols.out.find(s => s.symbol === symbol)?.win || 0;
                    return winAmount;
                })());
            });
        }

        // 7. Mark all matched cells for removal
        const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
        allMatchedCells.forEach(({ row, col }) => {
            toRemove[row][col] = true;
        });

        // 8. Animate all matched symbols together
        await this.animateMatchedSymbols(scene, allMatchedCells.map(({row, col, symbol}) => ({row, col, symbol}))); // null means mixed symbols

        // 9. Drop and refill
        await this.dropAndRefillAsync(symbolGrid, toRemove, scene, SymbolsIn);

        return "continue match";
    }

    private async handleScatterMatch(scene: GameScene, symbolGrid: number[][], scatterCount: number): Promise<string> {
        // Prevent new spins during scatter sequence
        scene.gameData.isSpinning = true;
        console.log(`[SCATTER] handleScatterMatch start, scatterCount=${scatterCount}`);
        // Play animation for all scatter symbols
        let scatterSprites: GameObjects.Sprite[] = [];
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (symbolGrid[row][col] === 0 && this.symbolGrid[row][col]) {
                    scatterSprites.push(this.symbolGrid[row][col] as GameObjects.Sprite);
                }
            }
        }

        console.log(`[SCATTER] Found ${scatterSprites.length} scatter sprites to animate`);
        // Wait for scatter animations to complete
        await this.animateScatterSymbols(scene, scatterSprites, scatterCount);
        console.log('[SCATTER] Scatter animations complete, emitting MATCHES_DONE');
        Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
        return "free spins";
    }

    private async animateScatterSymbols(scene: GameScene, scatterSprites: (GameObjects.Sprite | SpineGameObject | SymbolContainer)[], scatterCount: number): Promise<void> {
        if (scatterSprites.length === 0) {
            console.log('[SCATTER] No scatter sprites found, proceeding to handleScatterRewards');
            this.handleScatterRewards(scene, scatterCount);
            return;
        }

        console.log(`[SCATTER] Animating ${scatterSprites.length} scatter sprites`);
        scene.audioManager.ScatterSFX.play();
        
        const animationPromises: Promise<void>[] = [];
        
        scatterSprites.forEach((sprite, index) => {
            const animationPromise = new Promise<void>((resolve) => {
                // Create particles for scatter explosion
                this.createWinParticles(scene, sprite.x, sprite.y, 0xFF0000);
                // Play animation and resolve on completion
                try {
                    // console.log(`[SCATTER] Animating scatter symbol idx=${index}`);
                    if (sprite instanceof SymbolContainer) {
                        sprite.playSymbolAnimation().then(() => {
                            (sprite as any).alpha = 0;
                            resolve();
                        }).catch(() => { (sprite as any).alpha = 0; resolve(); });
                    } else {
                        // Fallback to Animation service for non-Container sprites
                        this.animation.playSymbolAnimation(sprite as any, 0).then(() => {
                            (sprite as any).alpha = 0;
                            resolve();
                        }).catch(() => { (sprite as any).alpha = 0; resolve(); });
                    }
                } catch (_e) { (sprite as any).alpha = 0; resolve(); }
            });
            animationPromises.push(animationPromise);
        });

        await Promise.all(animationPromises);
        // console.log('[SCATTER] All scatter animations finished, calling handleScatterRewards');
        
        // Handle scatter rewards after animations complete
        this.handleScatterRewards(scene, scatterCount);
    }

    private handleScatterRewards(scene: GameScene, scatterCount: number): void {
        // Award free spins based on scatterCount
        let freeSpins = scene.gameData.freeSpins || 0;
        // console.log(`[BONUS] handleScatterRewards start, scatterCount=${scatterCount}, isBonus=${scene.gameData.isBonusRound}`);

		if (scene.gameData.isBonusRound) {
            // During bonus round, add spins for 3+ scatters
            let addFreeSpins = 0;
            if (scatterCount >= 3) addFreeSpins = 5;

            //scene.gameData.totalFreeSpins += addFreeSpins;
            scene.gameData.freeSpins += addFreeSpins;
            // scene.buttons.autoplay.addSpins(addFreeSpins);
            // console.log(`[BONUS] Retrigger: +${addFreeSpins} FS → totalFS=${scene.gameData.totalFreeSpins}, remainingFS=${scene.gameData.freeSpins}`);
            
            // Update the remaining spins display
            if (scene.buttons.autoplay.isAutoPlaying) {
                scene.buttons.autoplay.updateRemainingSpinsDisplay();
            }

            // Show retrigger popup
            console.log('[BONUS] Showing retrigger popup');
            this.showRetriggerPopup(scene, addFreeSpins);
		} else {
            // Initial bonus trigger
            this.bonusTriggeredThisSpin = true;
            // As soon as free spins are known to trigger via scatter count, keep indicators visible
            try {
                (scene as any).buttons.autoplayIndicator.visible = !!(scene as any).buttons?.autoplay?.isAutoPlaying;
                (scene as any).buttons.freeSpinBtn.visible = true;
                (scene as any).buttons.updateButtonStates(scene as any);
            } catch (_e) {}
            if (scatterCount === 4) freeSpins += 10;
            else if (scatterCount === 5) freeSpins += 10;
            else if (scatterCount === 6) freeSpins += 10;

			// Prepare bonus round state (set counters now; defer isBonusRound and visuals until after animations)
			//scene.gameData.totalFreeSpins = freeSpins;
			scene.gameData.freeSpins = freeSpins;
			scene.gameData.totalBonusWin = 0;

            // Pause autoplay if active; sequence begins after Congrats overlay
            if (scene.buttons.autoplay.isAutoPlaying) {
                scene.buttons.autoplay.pauseForBonus();
            }

            // Apply a manual spin lockout for 5 seconds after free spins are triggered (local flow)
            try {
                (scene as any).gameData.freeSpinLockUntilMs = Date.now() + 5000;
                (scene as any).time?.delayedCall?.(5000, () => {
                    try { (scene as any).buttons?.updateButtonStates?.(scene as any); } catch (_e) {}
                });
            } catch (_e) {}

			// After scatter animations complete (MATCHES_DONE), flip to bonus and show Congrats overlay
            Events.emitter.once(Events.MATCHES_DONE, () => {
                try { (scene as any).buttons.freeSpinTriggered = true; (scene as any).buttons.updateButtonStates(scene as any); } catch (_e) {}
                scene.gameData.isBonusRound = true;
                console.log(`[BONUS] Initial trigger: animations done → set isBonusRound=true; showing Congrats overlay for FS=${freeSpins}`);
                this.showFreeSpinsPopup(scene, freeSpins);
            });
        }
    }

    private showRetriggerPopup(scene: GameScene, addFreeSpins: number): void {
        // Use overlay-style popup with brief pause similar to WinOverlayContainer
        const overlay = new RetriggerOverlayContainer(scene as any);
        overlay.show(addFreeSpins, () => {
            // In API-driven FS, allow the API scheduler to advance after overlay hide
            if (scene.gameData.useApiFreeSpins) {
                return;
            }
            // Continue with next spin since we're already in bonus (local FS flow)
            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values
            });
        });
    }


    private showWinPopup(scene: GameScene, matchedCells: { row: number; col: number; }[], winAmount: number): void {
        const rows = Slot.ROWS;
        const cols = Slot.COLUMNS;
        
        // Popup text at the matched symbol closest to the center
        const gridCenter = { row: (rows - 1) / 2, col: (cols - 1) / 2 };
        let minDist = Infinity;
        let popupPos = { x: scene.scale.width / 2, y: scene.scale.height / 2 };
        matchedCells.forEach(({ row, col }) => {
            const dist = Math.abs(row - gridCenter.row) + Math.abs(col - gridCenter.col);
            if (dist < minDist && this.symbolGrid[row][col]) {
                minDist = dist;
                const symbolSprite = this.symbolGrid[row][col];
                popupPos = { x: symbolSprite.x, y: symbolSprite.y };
            }
        });

        const popupText = scene.add.text(
            popupPos.x,
            popupPos.y,
            `+$${winAmount.toFixed(2)}`,
            {
                fontSize: '64px',
                color: '#111111',
                fontStyle: 'bold',
                stroke: '#000',
                strokeThickness: 6,
                fontFamily: 'Poppins'
            }
        );

        const gradient = popupText.context.createLinearGradient(0,0,0,popupText.height);
        gradient.addColorStop(0, '#00FF88');
        gradient.addColorStop(0.5, '#00DD55');
        gradient.addColorStop(1, '#00AA33');
        popupText.setFill(gradient);

        popupText.setOrigin(0.5, 0.5);
        popupText.setDepth(100);

        // Animate the popup text with scale and float effect
        scene.tweens.add({
            targets: popupText,
            y: popupPos.y - 80,
            alpha: 0,
            scale: 1.5,
            duration: 2000,
            ease: 'Back.easeOut',
            onComplete: () => {
                popupText.destroy();
            }
        });
    }

    private async animateMatchedSymbols(scene: GameScene, matchedCells: { row: number; col: number; symbol: number }[]): Promise<void> {
        scene.audioManager.playRandomQuickWin();

        const animationPromises: Promise<void>[] = [];
        
        matchedCells.forEach(({ row, col, symbol }) => {
            const symbolSprite = this.symbolGrid[row][col];
            if (symbolSprite) {
                // If it's a bomb, keep the old tween logic
                if (symbolSprite instanceof BombContainer) {
                    const animationPromise = new Promise<void>((resolve) => {
                        scene.tweens.add({
                            targets: symbolSprite,
                            alpha: 0,
                            scale: 0.5,
                            duration: 1000,
                            ease: 'Circ.easeInOut',
                            onComplete: () => {
                                symbolSprite.destroy();
                                resolve();
                            }
                        });
                    });
                    animationPromises.push(animationPromise);
                } else {
                    // Use SymbolContainer.playSymbolAnimation when available; else fallback
                    const symbolValue = symbol;
                    const animationPromise = new Promise<void>((resolve) => {
                        try {
                            if (symbolSprite instanceof SymbolContainer) {
                                symbolSprite.playSymbolAnimation().then(() => {
                                    (symbolSprite as any).destroy();
                                    resolve();
                                }).catch(() => { (symbolSprite as any).destroy(); resolve(); });
                            } else {
                                this.animation.playSymbolAnimation(symbolSprite as any, symbolValue).then(() => {
                                    (symbolSprite as any).destroy();
                                    resolve();
                                }).catch(() => { (symbolSprite as any).destroy(); resolve(); });
                            }
                        } catch (_e) { (symbolSprite as any).destroy(); resolve(); }
                    });
                    animationPromises.push(animationPromise);
                }
            }
        });

        // Store matched cells for reference
        scene.gameData.currentMatchingSymbols = matchedCells.map(({symbol}) => symbol);

        await Promise.all(animationPromises);
    }

    private async dropAndRefillAsync(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene, SymbolsIn : Tumble): Promise<void> {
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;

        // Clean up any Alone symbols that might be left on screen
        this.cleanupAloneSymbols();

        const dropPromises: Promise<void>[] = [];
        // console.log(`[DROP] dropAndRefillAsync start rows=${rows} cols=${cols}`);

        // For each column, drop down and fill new randoms
		for (let col = 0; col < cols; col++) {
			// Predictive anticipation: show when landed + incoming scatters in this column > 3
			const landedCount = this.getLandedScatterCount();
			// Estimate how many new symbols will enter this column using toRemove
			let numIncoming = 0;
			for (let r = 0; r < rows; r++) { if (toRemove[r][col]) numIncoming++; }
			const incomingCol = (SymbolsIn?.symbols?.in && SymbolsIn.symbols.in[col]) ? SymbolsIn.symbols.in[col] : [];
			let upcomingScatters = 0;
			for (let i = 0; i < numIncoming && i < incomingCol.length; i++) {
				const v = incomingCol[i];
				if (v === Slot.SCATTER_SYMBOL || v === 0) upcomingScatters++;
			}
			const predictedTotal = landedCount + upcomingScatters;
			// console.log(`[DROP] preparing col=${col} landed=${landedCount} upcomingInCol=${upcomingScatters} predicted=${predictedTotal}`);
			if (numIncoming > 0 && (landedCount === 2 || predictedTotal >= 3)) {
				// console.log(`[SCATTER ANTICIPATION] Trigger for column ${col} (landed=${landedCount}, predicted=${predictedTotal})`);
				this.setScatterAnticipationVisible(col, true, scene);
				await new Promise<void>((resolve) => { scene.time.delayedCall(scene.gameData.turbo ? 500 : 1500, () => resolve()); });
				this.setScatterAnticipationVisible(col, false, scene);
			}
            // Build new column after removals
            const newCol: number[] = [];
            let dropMap: number[] = [];
            for (let row = 0; row < rows; row++) {
                if (!toRemove[row][col]) {
                    newCol.push(symbolGrid[row][col]);
                    dropMap.push(row);
                }
            }

            // Fill the rest with new random symbols at the top
            
            const numNew = rows - newCol.length;
			for (let i = 0; i < numNew; i++) {
                //const newSymbol = Math.floor(Math.random() * Slot.SYMBOLS) + 1; // symbol will come from API, not random
                //const newSymbol = col + 1;
                const newSymbol = SymbolsIn.symbols.in[col][i];
                newCol.unshift(newSymbol);
            }

            // Create a temporary grid to track the new positions
            const tempSymbolGrid: (GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer)[] = [];
            
            // Animate drop for each cell in this column
            let targetRow = rows - 1;
            for (let i = dropMap.length - 1; i >= 0; i--) {
                const fromRow = dropMap[i];
                const symbolSprite = this.symbolGrid[fromRow][col];
                if (symbolSprite && symbolSprite.active) {
                    const newY = (height * 0.5) + targetRow * (height + verticalSpacing);
                    const dropPromise = new Promise<void>((resolve) => {
                        scene.tweens.add({
                            targets: symbolSprite,
                            y: newY,
                            duration: 300,
                            ease: 'Cubic.easeIn',
                            onComplete: () => resolve()
                        });
                    });
                    dropPromises.push(dropPromise);
                    tempSymbolGrid[targetRow] = symbolSprite;
                    symbolGrid[targetRow][col] = symbolGrid[fromRow][col];
                }
                targetRow--;
            }

            // Create and animate new symbols at the top
            for (let i = 0; i < numNew; i++) {
                const symbolValue = newCol[i];
                let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_FIS`;
                }
                
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const startY = centerY + (i - numNew) * (height + verticalSpacing);
                const endY = centerY + i * (height + verticalSpacing);
                
                let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer | SymbolContainer;
                
                if (symbolValue >= 10 && symbolValue <= 22) {
                    // Create BombContainer for bomb
                    newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    // Match the size of normal symbols
                    newSymbol.setBombDisplaySize(width * Slot.SYMBOL_SIZE * Slot.BOMB_SCALE, height * Slot.SYMBOL_SIZE * Slot.BOMB_SCALE);
                    // console.log('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                } else {
                    const sc = new SymbolContainer(scene, symbolX, startY, symbolValue === 0 ? 0 : symbolValue, scene.gameData);
                    try { sc.getSymbolSprite().animationState.setAnimation(0, `animation`, false); } catch (_e) {}
                    if (symbolValue === 0) {
                        sc.setSymbolDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                    } else {
                        sc.setSymbolDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                    }
                    newSymbol = sc;
                }

                // Ensure bombs render above other symbols
                if (newSymbol && symbolValue >= 10 && symbolValue <= 22) {
                    newSymbol.setDepth(1000);
                }

                this.container.add(newSymbol);
                tempSymbolGrid[i] = newSymbol;
                symbolGrid[i][col] = symbolValue;

            const dropPromise = new Promise<void>((resolve) => {
                // Track only newly dropping scatter containers
                const isScatterContainer = (newSymbol instanceof SymbolContainer) && (newSymbol as any).getSymbolValue?.() === 0;
                if (isScatterContainer) {
                    this.droppingScatters.add(newSymbol as SymbolContainer);
                }
                scene.tweens.add({
                    targets: newSymbol,
                    y: endY,
                    duration: 300,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        if (isScatterContainer) {
                            this.droppingScatters.delete(newSymbol as SymbolContainer);
                        }
                        try { this.logVisibleScatterCount(); } catch (_e) {}
                        resolve();
                    }
                });
                // console.log("dropPromise: i: " + i + " col: " + col + " symbolValue: " + symbolValue);
            });
                dropPromises.push(dropPromise);
            }
            
            // Update the symbol grid for this column after all tweens are set up
            for (let row = 0; row < rows; row++) {
                if (tempSymbolGrid[row]) {
                    this.symbolGrid[row][col] = tempSymbolGrid[row];
                }
            }
        }

        // Wait for all drop animations to complete
        await Promise.all(dropPromises);

        // Handle win effects after drop completes
        const bet = scene.gameData.bet || 1;
        const totalWin = scene.gameData.totalWin || 0;
        
        const multiplierWin = totalWin / bet;
        
        // For autoplay, use shorter delays to keep the flow moving
        // const delay = scene.buttons.autoplay.isAutoPlaying ? 10 : 50;
        
        await new Promise<void>((resolve) => {
            scene.time.delayedCall(1, () => {
                // Play win audio (but do NOT show overlay here)
                scene.audioManager.playWinSFX(multiplierWin.toString());
                resolve();
            });
        });
        
        // Hide SymbolCountWin display after drop and refill completes
        this.hideSymbolCountWinDisplay();
        
        Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
    }

    private async explodeAndRemoveAllBombs(scene: GameScene): Promise<void> {
        // Collect all bombs first
        const bombs: { bomb: BombContainer; row: number; col: number }[] = [];
        for (let row = 0; row < this.symbolGrid.length; row++) {
            for (let col = 0; col < this.symbolGrid[row].length; col++) {
                const symbol = this.symbolGrid[row][col];
                if (symbol instanceof BombContainer) {
                    bombs.push({ bomb: symbol as BombContainer, row, col });
                }
            }
        }

        // Chain reaction order: left-to-right, top-to-bottom
        bombs.sort((a, b) => (a.col - b.col) || (a.row - b.row));

        const explosionDurationMs = 600; // time to let one bomb animation play
        const interBombDelayMs = 200;    // small gap between consecutive bombs

        for (const { bomb, row, col } of bombs) {
            try {
                bomb.showExplosion();
            } catch (_e) {
                // continue even if one bomb fails to animate
            }

            // Wait for this bomb's explosion to finish
            await new Promise<void>((resolve) => {
                scene.time.delayedCall(explosionDurationMs, () => {
                    if (bomb && bomb.active) {
                        // bomb.destroy();
                    }
                    (this.symbolGrid[row][col] as any) = null;
                    resolve();
                });
            });

            // Small delay before triggering the next bomb for a chain effect
            await new Promise<void>((resolve) => {
                scene.time.delayedCall(interBombDelayMs, () => resolve());
            });
        }
    }

    private cleanupAloneSymbols(): void {
        // Clean up any symbols that might be left on screen but not in the grid
        this.container.each((child: any) => {
            if ((child instanceof Phaser.GameObjects.Sprite || child instanceof SpineGameObject || child instanceof BombContainer) && child.active) {
                let foundInGrid = false;
                for (let row = 0; row < this.symbolGrid.length; row++) {
                    for (let col = 0; col < this.symbolGrid[row].length; col++) {
                        if (this.symbolGrid[row][col] === child) {
                            foundInGrid = true;
                            break;
                        }
                    }
                    if (foundInGrid) break;
                }
                
                if (!foundInGrid && child.parentContainer === this.container) {
                    // console.log("cleaning up Alone symbol");
                    child.destroy();
                }
            }
        });
    }

    public destroy(): void {
        // Clean up win animation
        
        // Clean up win overlay containers
        const overlays = [...this.winOverlayContainers]; // Create a copy to avoid mutation issues
        overlays.forEach(container => container.destroy());
        this.winOverlayContainers = [];
        
        // Clean up bomb popup container
        if (this.bombPopupContainer) {
            this.bombPopupContainer.destroy();
            this.bombPopupContainer = null;
        }
        
        // Clean up SymbolCountWin display
        this.clearSymbolCountWinTexts();
        if (this.symbolCountWinContainer) {
            this.symbolCountWinContainer.destroy();
            this.symbolCountWinContainer = null;
        }
        
        // Clean up container
        if (this.container) {
            this.container.destroy();
        }
        
        // Reset state
        this.activeWinOverlay = false;
        this.tweensToComplete = 0;

        // Remove listeners
        if (this.onOverlayHide) {
            Events.emitter.off(Events.WIN_OVERLAY_HIDE, this.onOverlayHide);
            this.onOverlayHide = undefined;
        }
        if (this.onSpinListener) {
            Events.emitter.off(Events.SPIN, this.onSpinListener);
            this.onSpinListener = undefined;
        }
        if (this.onStartListener) {
            Events.emitter.off(Events.START, this.onStartListener);
            this.onStartListener = undefined;
        }
    }

    /**
     * Fetches the latest balance from the backend and updates GameData.
     * @param scene The current game scene (must have gameAPI and gameData)
     */
    public async getBalance(scene: Scene): Promise<void> {
        const gameScene = scene as GameScene;
        try {
            await gameScene.gameAPI.getBalance();
            // Optionally, emit an event to update UI or notify listeners
            Events.emitter.emit(Events.UPDATE_CURRENCY, {
                balance: gameScene.gameData.balance,
                currency: gameScene.gameData.currency
            });
        } catch (error) {
            console.error('Failed to fetch balance:', error);
        }
    }

    public setBombAnimationActive(active: boolean): void {
        this.bombAnimationActive = active;
        
        // If setting to active, add a timeout to reset it after a reasonable time
        if (active) {
            // Reset after 5 seconds as a fallback (bomb animations typically last 2-3 seconds)
            setTimeout(() => {
                this.bombAnimationActive = false;
            }, 5000);
        }
    }
    
    private async checkMatchForSymbolAsync(symbolGrid: number[][], scene: GameScene, symbolToRemove: number, SymbolsIn : Tumble): Promise<string> {
        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        // Find all cells with symbolToRemove
        const matchedCells: { row: number; col: number; symbol: number }[] = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (symbolGrid[row][col] === symbolToRemove) {
                    matchedCells.push({ row, col, symbol: symbolToRemove });
                }
            }
        }
        if (matchedCells.length === 0) {
            return "No matches for symbol";
        }
        // Animate and remove matched symbols
        await this.animateMatchedSymbols(scene, matchedCells);
        // Build toRemove mask
        const toRemove = symbolGrid.map((row: number[]) => row.map((value: number) => value === symbolToRemove));
        // Call dropAndRefillAsync (will refill with randoms)
        await this.dropAndRefillAsync(symbolGrid, toRemove, scene, SymbolsIn);
        return "continue match";
    }


    private SymbolCountWin(symbols: DisplaySymbol[]): void {
        if(symbols.length === 0) return;
        else{
            symbols.forEach(symbol => {
                if(symbol.count > 1){
                    symbol.win = symbol.count * symbol.symbol;
                }
            });
        }
    }
}

