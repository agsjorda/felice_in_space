import { Scene, GameObjects } from 'phaser';
import { Events } from "./Events";
import { Slot } from "./GameData";
import { GameData } from "./GameData";
import { AudioManager } from "./AudioManager";
import { Animation } from './Animation';
import { WinAnimation } from './WinAnimation';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3/dist/SpineGameObject';
import { WinOverlayContainer } from './WinOverlayContainer';
import { GameAPI } from '../backend/GameAPI';
import { BombContainer } from './BombContainer';

// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameAPI: GameAPI;
    gameData: GameData;
    audioManager: AudioManager;
}

// Improved SymbolGrid interface with proper typing
interface SymbolGrid {
    [index: number]: (GameObjects.Sprite | SpineGameObject | BombContainer)[];
    length: number;
    map: <T>(callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => T[]) => T[][];
    forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => void;
}

interface SpinData {
    symbols: number[][];
    currentRow: number;
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

    private winOverlayContainers: WinOverlayContainer[] = [];
    private bombPopupContainer: GameObjects.Container | null = null;

    private animation: Animation;
    private winAnimation: WinAnimation;

    private isMobile: boolean = false;
    
    // Add tumble history support
    private tumbleHistory: any[] = [];
    private currentTumbleIndex: number = 0;

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
        this.isMobile = this.isMobileDevice();
        if(this.isMobile){
            scene.load.image('slotBackground', 'assets/Reels/Mobile_Grid.png');
            scene.load.image('bonusSlotBackground', 'assets/Reels/Mobile_Grid.png');
        }
        else{
            scene.load.image('slotBackground', 'assets/Reels/Property 1=Default.png');
            scene.load.image('bonusSlotBackground', 'assets/Reels/Property 1=Bonus.png');
        }

        // Initialize animation
        this.animation = new Animation(scene);
        this.animation.preload();

        this.winAnimation = new WinAnimation(scene);
        this.winAnimation.preload();

        this.initVariables(scene as GameScene);
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
        
        // Initialize animations
        this.animation.create();
        this.winAnimation.create();
        
        // Set up bomb animation callbacks
        this.winAnimation.setBombAnimationCallbacks(
            () => this.setBombAnimationActive(true),  // On start
            () => this.setBombAnimationActive(false)  // On end
        );
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    // sets the symbols grid , scale , x y
    private createContainer(scene: GameScene): void {
        this.container = scene.add.container(
            this.isMobile ? scene.scale.width * 0.055 : this.slotX + scene.scale.width * 0.01,
            this.isMobile ? scene.scale.height * 0.23 : this.slotY + scene.scale.height * 0.01);
        this.container.setScale(this.isMobile ? 0.39 : 0.95);

        this.totalGridWidth = this.isMobile ? this.totalGridWidth * 0.43 : this.totalGridWidth;
        this.totalGridHeight = this.isMobile ? this.totalGridHeight * 0.43 : this.totalGridHeight; 
        this.container.setDepth(4);
    }

    // background square of the symbols grid
    private createBackground(scene: GameScene): void {
        //if(this.isMobile) return;
        const background = scene.add.image(0, 0, 'slotBackground').setOrigin(0, 0);
        background.setDepth(3);

        const paddingX = 90;
        const paddingY = 75;

        background.displayWidth = this.totalGridWidth + paddingX;
        background.displayHeight = this.totalGridHeight + paddingY;

        background.x = this.isMobile ? background.displayWidth * 0.5 : this.slotX - paddingX * 0.75;
        background.y = this.isMobile ? background.displayHeight * 0.45 : this.slotY - paddingY * 0.33;

        if(this.isMobile){
            background.setScale(0.5, 0.5);
            background.setOrigin(0.61, 0.1);
        }
        else{
            background.setScale(.95 , 0.94);
            background.setOrigin(0.01, 0);
        }
    }

    private createSlot(scene: GameScene): void {
        const x = this.isMobile ? scene.scale.width * 0 : this.slotX;    
        const y = this.isMobile ? scene.scale.height * 0.21 : this.slotY - 75/5;
        const width = this.isMobile ? this.totalGridWidth * 1.01: this.totalGridWidth + 90;
        const height = this.isMobile ? this.totalGridHeight * 1.01 : this.totalGridHeight + 75*.20;
        
        const maskShape = scene.add.graphics();
        maskShape.fillRect(x, y, width, height);
        //maskShape.fillRoundedRect(x, y, width, height, 60);

        const mask = maskShape.createGeometryMask();
        this.container.setMask(mask);
        maskShape.setVisible(false);
    }

    private createReel(scene: GameScene, data: SpinData): void {
        
        Events.emitter.emit(Events.UPDATE_BALANCE);

        scene.gameAPI.getBalance().then((data) => {
            scene.gameData.debugLog(data);
            Events.emitter.emit(Events.UPDATE_BALANCE, data);
        });

        this.cleanupAloneSymbols();
        const numRows = Slot.ROWS;
        const numCols = Slot.COLUMNS;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;
        let newValues: number[][] = [];
        
        scene.gameAPI.doSpin(scene.gameData.bet).then(result => {
            scene.gameData.debugLog("result",result);
            scene.gameData.debugLog("slotArea",result.data.slotArea);

            newValues = transpose(result.data.slotArea.SlotArea);

          for(let i = 0; i < newValues.length; i++){
              for(let j = 0; j < newValues[i].length; j++){
                  if(newValues[i][j] == 0){
                      //newValues[i][j] = 1;
                      // currently disable scatter 
                  }
              }
          }

            // Store tumble history data if available
            if (result.data.tumblehistory && result.data.tumblehistory.length > 0) {
                this.tumbleHistory = result.data.tumblehistory;
                this.currentTumbleIndex = 0;
                console.log("=== TUMBLE HISTORY RECEIVED ===");
                console.log("tumbleHistory:", this.tumbleHistory);
                
                // Log each tumble's data
                this.tumbleHistory.forEach((tumble, index) => {
                    console.log(`Tumble ${index}:`, tumble);
                    if (tumble.newslotarea) {
                        console.log(`  newslotarea:`, tumble.newslotarea);
                    }
                    if (tumble.slotarea) {
                        console.log(`  slotarea:`, tumble.slotarea);
                    }
                    if (tumble.win) {
                        console.log(`  win:`, tumble.win);
                        if (tumble.win.symbol) {
                            console.log(`  win symbol:`, tumble.win.symbol);
                        }
                    }
                });
                
                scene.gameData.debugLog("tumbleHistory", this.tumbleHistory);
            } else {
                this.tumbleHistory = [];
                this.currentTumbleIndex = 0;
                console.log("No tumble history received");
            }

            if(scene.gameData.debugged){
                newValues = data.symbols;
            }


            let completedSymbols = 0;
            const totalSymbols = numCols * numRows;

            // Initialize newSymbolGrid with proper nested arrays
            let newSymbolGrid = Array(numRows).fill(null).map(() => Array(numCols).fill(null)) as unknown as SymbolGrid;
            Object.assign(newSymbolGrid, {
                length: numRows,
                map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => any[]) => 
                    Array(numRows).fill(null).map((_, row) => callback(newSymbolGrid[row], row)),
                forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => 
                    Array(numRows).fill(null).forEach((_, index) => callback(newSymbolGrid[index], index))
            });

            const rowInterval = 150; // ms between each row's arrival in a column
            let turboSpeed = scene.gameData.turbo ? 0.2 : 1;
            let offsetDelay = 1100;
            

            if(scene.gameData.turbo){
                scene.audioManager.TurboDrop.play();
            }
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
                    
                    let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer | null = null;
                    let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                    let frameKey = 'Symbol0_FIS-00000.png';
                    const startY = symbolY - height * (numRows + 1);

                    if (symbolValue >= 1 && symbolValue <= 9) {
                        symbolKey = `Symbol${symbolValue}_FIS`;
                        frameKey = `Symbol${symbolValue}_FIS-00000.png`;
                        newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey) as GameObjects.Sprite;
                    } else if (symbolValue >= 10 && symbolValue <= 22) {
                        // Create BombContainer for bomb
                        newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                        newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                        scene.gameData.debugLog('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                    } else {
                        newSymbol = scene.add.sprite(symbolX, startY, symbolKey, frameKey) as GameObjects.Sprite;
                    }

                    // Set the display size based on the symbol type
                    if (symbolValue === 0) {
                        newSymbol?.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                    } else if (symbolValue >= 10 && symbolValue <= 22) {
                        // Handle BombContainer display size
                        if (newSymbol instanceof BombContainer) {
                            newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                        } else if (newSymbol) {
                            newSymbol.setDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                        }
                        scene.gameData.debugLog("symbolValue", symbolValue);
                    } else {
                        newSymbol?.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
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
                    if(newSymbol)
                    scene.tweens.add({
                        targets: newSymbol,
                        y: symbolY,
                        duration: duration,
                        ease: 'Quart.easeInOut',
                        delay: tweenDelay,
                       onComplete: () => {
                           completedSymbols++;
                           if (completedSymbols === totalSymbols) {
                               // console.log(newValues); debug symbols
                               Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                                   symbols: newValues,
                                   currentRow: data.currentRow
                               });
                               const result = this.checkMatch(newValues, scene);
                               scene.gameData.debugLog(result);
                               if(result === "No more matches" ) {
                                   scene.gameData.isSpinning = false;
                               }
                           }
                           
                           if(row === 4){
                               if(!scene.gameData.turbo){
                                   scene.audioManager.ReelDrop.play();
                               }
                           }
                       }
                    });

                    if(newSymbol)
                            this.container.add(newSymbol);
                    newSymbolGrid[row][col] = newSymbol;
                }
            }

            this.symbolGrid = newSymbolGrid;
        });
    }

    private eventListeners(scene: GameScene): void {
        Events.emitter.on(Events.SPIN, (data: SpinData) => {
            // scene.audioManager.ReelStart.play();
            this.createReel(scene, data);
        });

        Events.emitter.on(Events.START, (data: SpinData) => {
            this.createSampleSymbols(scene, data.symbols);
        });
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
            map: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => any[]) => 
                Array(numRows).fill(null).map((_, row) => callback(this.symbolGrid[row], row)),
            forEach: (callback: (row: (GameObjects.Sprite | SpineGameObject | BombContainer)[], index: number) => void) => 
                Array(numRows).fill(null).forEach((_, index) => callback(this.symbolGrid[index], index))
        });

        for (let row = 0; row < numRows; row++) {
            let sampleScatterCount = 0;
            for (let col = 0; col < numCols; col++) {
                const symbolValue = symbols[row][col];
                let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                //let frameKey = 'Symbol0_FIS-00000.png';
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_FIS`;
                    //frameKey = `Symbol${symbolValue}_FIS-00000.png`;
                }
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const symbolY = centerY + row * (height + verticalSpacing);

                const symbol = scene.add.sprite(symbolX, symbolY, symbolKey//, frameKey
                ) as GameObjects.Sprite;

                if (symbolValue === 0 && sampleScatterCount < 3){
                    sampleScatterCount++;
                    symbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                } else {
                    symbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                }

                this.container.add(symbol);
                this.symbolGrid[row][col] = symbol;
            }
        }
    }


    public async spin(scene: Scene, data: any): Promise<void> {
        // Clear previous bomb animations and reset tumble history
        this.tumbleHistory = [];
        this.currentTumbleIndex = 0;
        
        const gameScene = scene as GameScene;
        gameScene.gameData.isSpinning = true;
        


        // Create new spin data
        const spinData: SpinData = {
            symbols: data.symbols,
            currentRow: 0
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
        const winAnim = scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        winAnim.setScale(1);
        winAnim.setPosition(0, 0);
        
        const winOverlay = new WinOverlayContainer(scene, this.winAnimation);
        this.winOverlayContainers.push(winOverlay);
        this.activeWinOverlay = true;

        winOverlay.show(totalWin, -2);

        scene.buttons.freeSpinBtn.visible = false;
    }

    public update(): void {
        // Empty implementation - can be used for future animations or updates
    }

    private showFreeSpinsPopup(scene: GameScene, freeSpins: number): void {
        // Check if there's an active win overlay
        if (this.activeWinOverlay) {
            // Wait for the win overlay to be removed before proceeding
            const checkOverlay = () => {
                if (this.activeWinOverlay) {
                    // Still active, check again in a short delay
                    scene.time.delayedCall(1000, checkOverlay);
                    scene.gameData.debugLog("overlay active, waiting to show free spins popup");
                } else {
                    // Overlay removed, proceed with free spins popup
                    scene.gameData.debugLog("overlay removed, showing free spins popup");
                    this.showWinOverlay(scene, freeSpins, -1);
                }
            };
            checkOverlay();
        } else {
            scene.gameData.debugLog("no overlay active, showing free spins popup immediately");
            // No overlay active, proceed immediately
            this.showWinOverlay(scene, freeSpins, -1);
        }
    }


    private showWinOverlay(scene: GameScene, totalWin: number, bet: number): void {
        // Calculate multiplier for win type
        let multiplier = 1;
        if(bet > 0)
             multiplier = totalWin / bet;
        else
            multiplier = bet;

        // Create new win overlay container
        const winOverlay = new WinOverlayContainer(scene, this.winAnimation);
        this.winOverlayContainers.push(winOverlay);
        this.activeWinOverlay = true;

        // Show the win overlay
        if(multiplier != 0)
            winOverlay.show(totalWin, multiplier);
    }

    public destroyWinOverlay(scene: GameScene): void {
        // Destroy all win overlay containers
        this.winOverlayContainers.forEach(container => container.destroy());
        this.winOverlayContainers = [];
        this.activeWinOverlay = false;
        scene.audioManager.stopWinSFX(scene);
        Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
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

    private checkMatch(symbolGrid: number[][], scene: GameScene): string {
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

        // 2. Find symbols with >=8 matches
        let foundMatch = false;
        let matchedSymbol: number | null = null;
        for (const symbol in symbolCount) {
            if (symbolCount[symbol] >= 8) {
                foundMatch = true;
                matchedSymbol = parseInt(symbol);
                break;
            }
        }

        if (!foundMatch) {
            // --- SCATTER CHECK ---
            const scatterCount = symbolCount[0] || 0;
            if (scatterCount >= 4 || (scene.gameData.isBonusRound && scatterCount >= 3)) {
                // Only stop autoplay if this is the initial bonus trigger and we're not already in bonus round
                if (!scene.gameData.isBonusRound) {
                    Events.emitter.emit(Events.AUTOPLAY_STOP, {});
                }

                // Prevent new spins during scatter sequence
                scene.gameData.isSpinning = true;
                
                // Play animation for all scatter symbols
                let scatterSprites: GameObjects.Sprite[] = [];
                for (let row = 0; row < rows; row++) {
                    for (let col = 0; col < cols; col++) {
                        if (symbolGrid[row][col] === 0 && this.symbolGrid[row][col]) {
                            scatterSprites.push(this.symbolGrid[row][col] as GameObjects.Sprite);
                        }
                    }
                }
                let animationsToComplete = scatterSprites.length;
                
                const onAllAnimationsComplete = () => {
                    // Award free spins based on scatterCount
                    let freeSpins = scene.gameData.freeSpins || 0;

                    if (scene.gameData.isBonusRound) {
                        // During bonus round, add 5 spins for 3+ scatters
                        let addFreeSpins = 0;
                        if (scatterCount === 3) addFreeSpins = 3;
                        else if (scatterCount === 4) addFreeSpins = 5;
                        else if (scatterCount === 5) addFreeSpins = 10;
                        else if (scatterCount === 6) addFreeSpins = 15;

                        scene.gameData.totalFreeSpins += addFreeSpins;
                        scene.gameData.freeSpins += addFreeSpins;
                        scene.buttons.autoplay.addSpins(addFreeSpins);
                        
                        // Update the remaining spins display
                        if (scene.buttons.autoplay.isAutoPlaying) {
                            scene.buttons.autoplay.updateRemainingSpinsDisplay();
                        }

                        // Show popup with retrigger info
                        const popupContainer = scene.add.container(
                            this.isMobile ? scene.scale.width * 0.5: scene.scale.width/2,
                            this.isMobile ? scene.scale.height * 0.5 : scene.scale.height/2);
                        popupContainer.setDepth(1000);
                    
                        const bg = scene.add.image(0, 0, 'buyFeatBG');
                        bg.setOrigin(0.5, 0.5);
                        popupContainer.add(bg);
                        if ((scene.sys.game.renderer as any).pipelines) {
                            bg.setPipeline('BlurPostFX');
                        }
                        const text = scene.add.text(0, 0, `You won\n\n\nmore free spins`, {
                            fontSize: '48px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins', 
                            fontStyle: 'bold',
                            align: 'center', 
                        });
                        text.setOrigin(0.5, 0.5);

                        const freeSpinsCount = scene.add.text(0, 0, `${addFreeSpins}`, {
                            fontSize: '88px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins', 
                            fontStyle: 'bold',
                            align: 'center'
                        });
                        freeSpinsCount.setOrigin(0.5, 0.5);
                        
                        const gradient = freeSpinsCount.context.createLinearGradient(0,0,0,freeSpinsCount.height);
                        gradient.addColorStop(0, '#FFF15A');
                        gradient.addColorStop(0.5, '#FFD000');
                        gradient.addColorStop(1, '#FFB400');
                        freeSpinsCount.setFill(gradient);

                        popupContainer.add(text);
                        popupContainer.add(freeSpinsCount);
                        popupContainer.setScale(this.isMobile ? 0.5 : 1);

                        // Make container interactive
                        popupContainer.setInteractive(new Phaser.Geom.Rectangle(-popupContainer.width/2, -popupContainer.height/2, popupContainer.width, popupContainer.height), Phaser.Geom.Rectangle.Contains);
                        
                        // Auto-hide popup after 1 second
                        scene.time.delayedCall(1000, () => {
                            scene.tweens.add({
                                targets: popupContainer,
                                alpha: 0,
                                duration: 500,
                                ease: 'Power2',
                                onComplete: () => {
                                    popupContainer.destroy();
                                    
                                    // Continue with next spin since we're already in bonus
                                    scene.gameData.isSpinning = false;
                                    Events.emitter.emit(Events.SPIN, {
                                        currentRow: scene.gameData.currentRow,
                                        symbols: scene.gameData.slot.values
                                    });
                                }
                            });
                        });

                        // Also allow manual click to dismiss
                        popupContainer.once('pointerdown', () => {
                            scene.tweens.add({
                                targets: popupContainer,
                                alpha: 0,
                                duration: 500,
                                ease: 'Power2',
                                onComplete: () => {
                                    popupContainer.destroy();
                                    
                                    // Continue with next spin since we're already in bonus
                                    scene.gameData.isSpinning = false;
                                    Events.emitter.emit(Events.SPIN, {
                                        currentRow: scene.gameData.currentRow,
                                        symbols: scene.gameData.slot.values
                                    });
                                }
                            });
                        });
                    } else {
                        // Initial bonus trigger
                        if (scatterCount === 4) freeSpins += 10;
                        else if (scatterCount === 5) freeSpins += 12;
                        else if (scatterCount === 6) freeSpins += 15;

                        // Enable bonus round state
                        scene.gameData.totalFreeSpins = 0 + freeSpins;
                        scene.gameData.freeSpins = freeSpins;
                        scene.gameData.totalBonusWin = 0; // Reset bonus win counter at start
                        
                        scene.gameData.isBonusRound = true;
                        scene.background.toggleBackground(scene);
                        scene.audioManager.changeBackgroundMusic(scene);

                        // If in autoplay, stop it before showing free spins popup
                        if (scene.buttons.autoplay.isAutoPlaying) {
                            scene.buttons.autoplay.stop();
                        }

                        // Start autoplay with the number of free spins gained
                        Events.emitter.emit(Events.AUTOPLAY_START, freeSpins);

                        // Show the popup for initial trigger
                        this.showFreeSpinsPopup(scene, freeSpins);
                    }
                };

                if (animationsToComplete === 0) {
                    onAllAnimationsComplete();
                } else {
                    scene.audioManager.ScatterSFX.play();
                    
                    // Mark scatter cells for removal and animate them out
                    const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
                    let scatterAnimationsComplete = 0;
                    
                    scatterSprites.forEach((sprite) => {
                        // Find the grid position of this scatter sprite
                        for (let row = 0; row < rows; row++) {
                            for (let col = 0; col < cols; col++) {
                                if (this.symbolGrid[row][col] === sprite) {
                                    toRemove[row][col] = true;
                                    break;
                                }
                            }
                        }
                        
                        // Create particles for scatter explosion
                        this.createWinParticles(scene, sprite.x, sprite.y, 0xFF0000);
                        
                        // Play scatter symbol animation
                        this.animation.playSymbolAnimation(sprite, 0);
                        
                        return; // wala pa nito
                        sprite.once('animationcomplete', () => {
                            sprite.alpha = 0;
                            scatterAnimationsComplete++;
                            animationsToComplete--;
                            
                            if (animationsToComplete === 0) {
                                onAllAnimationsComplete();
                                scene.gameData.debugLog("scatter animations complete");
                                
                                // Only trigger drop and refill after all scatter animations are done
                                if (scatterAnimationsComplete === scatterSprites.length) {
                                    this.dropAndRefillWithOverlayCheck(symbolGrid, toRemove, scene);
                                }
                            }
                        });
                    });
                }

                Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
                return "free spins";
            }

            // At the end, emit WIN to update totalWin text
            Events.emitter.emit(Events.WIN, {});
            scene.gameData.isSpinning = false;
            Events.emitter.emit(Events.SPIN_ANIMATION_END, {
                symbols: symbolGrid,
                newRandomValues: symbolGrid
            });

            Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
            return "No more matches";
        }
        {
            // 3. Get all matched indices for the symbol
            const matchedCells = matchIndices[matchedSymbol!];

            // 4. Add to totalWin and balance
            const bet = scene.gameData.bet || 1;
            // WIN AMOUNT SHOULD BE IN BACKEND 
            // TEMPORARY ONLY FOR TESTING
            let winAmount = 0;
            if (matchedSymbol !== null) {
                if (matchedCells.length === 8 || matchedCells.length === 9) {
                    winAmount = matchedSymbol === 0 ? 100 * bet :
                            scene.gameData.winamounts[0][matchedSymbol] * bet;

                } else if (matchedCells.length === 10 || matchedCells.length === 11) {
                    winAmount = matchedSymbol === 0 ? 5 * bet :
                            scene.gameData.winamounts[1][matchedSymbol] * bet;

                } else if (matchedCells.length >= 12) {
                    winAmount = matchedSymbol === 0 ? 3 * bet :
                            scene.gameData.winamounts[2][matchedSymbol] * bet;
                }
            }

            // TEMPORARY ONLY FOR TESTING


            scene.gameData.totalWin += winAmount; // win amount should already be calculated in backend
            scene.gameData.balance += winAmount; // balance should already be updated in backend
            
            // Track bonus wins separately
            if (scene.gameData.isBonusRound) {
                scene.gameData.totalBonusWin += winAmount; // bonus win amount should already be calculated in backend
            }
            
            Events.emitter.emit(Events.WIN, {});
   
            if(this.isMobile) {
                Events.emitter.emit(Events.UPDATE_TOTAL_WIN, winAmount);
            }
            else
            {
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
                        color: '#FFD700',
                        fontStyle: 'bold',
                        stroke: '#000',
                        strokeThickness: 6,
                        fontFamily: 'Poppins'
                    }
                );

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
            // 5. Mark matched cells for removal
            const toRemove = Array.from({ length: rows }, () => Array(cols).fill(false));
            matchedCells.forEach(({ row, col }) => {
                toRemove[row][col] = true;
            });

            // 6. Animate matched symbols out with particles
            this.tweensToComplete = 0;
            
            // scene.audioManager.playRandomQuickWin();

            matchedCells.forEach(({ row, col }) => {
                const symbolSprite = this.symbolGrid[row][col];
                if (symbolSprite) {
                    this.tweensToComplete++;
                    
                    // Create particles for each matched symbol
                    this.createWinParticles(scene, symbolSprite.x, symbolSprite.y, 0xFFD700);
                    
                    scene.tweens.add({
                        targets: symbolSprite,
                        alpha: 0,
                        scale: 0.5,
                        duration: 1000,
                        ease: 'Circ.easeInOut',
                        onStart: () => {
                            // Add blur effect when starting the removal animation
                            if ((scene.sys.game.renderer as any).pipelines && 'setPipeline' in symbolSprite) {
                                symbolSprite.setPipeline('BlurPostFX');
                                (symbolSprite as any).blurStrength = 0.8;
                            }
                        
                        },
                        onComplete: () => {
                            symbolSprite.destroy();
                            this.tweensToComplete--;
                            if (this.tweensToComplete === 0) {
                                scene.gameData.debugLog("tweens complete");
                                this.dropAndRefillWithOverlayCheck(symbolGrid, toRemove, scene);
                            }
                        }
                    });
                }
            });

            // Store matched cells for reference
            scene.gameData.currentMatchingSymbols = matchedCells.map(() => 
                matchedSymbol !== null ? matchedSymbol : 0
            );

            // After finding matches of 8 or more symbols
            if (matchedCells.length >= 8 && matchedSymbol !== null && matchedSymbol >= 1 && matchedSymbol <= 9) {
                matchedCells.forEach(({ row, col }) => {
                    const symbolSprite = this.symbolGrid[row][col];
                    if (symbolSprite) {
                        this.animation.playSymbolAnimation(symbolSprite as GameObjects.Sprite, matchedSymbol);
                    }
                });
            }

            return "continue match";
        }
    }

    private dropAndRefillWithOverlayCheck(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene): void {
        // Check if there's an active win overlay or bomb animations
        if (this.activeWinOverlay || this.hasActiveBombAnimations()) {
            // Wait for the win overlay and bomb animations to complete before proceeding
            const checkAnimations = () => {
                if (this.activeWinOverlay) {
                    scene.gameData.debugLog("overlay active, waiting");
                    scene.time.delayedCall(500, checkAnimations);
                    return;
                }
                
                if (this.hasActiveBombAnimations()) {
                    scene.gameData.debugLog("bomb animations active, waiting");
                    scene.time.delayedCall(500, checkAnimations);
                    return;
                }
                
                // All animations and overlays are complete, proceed with drop and refill
                this.dropAndRefill(symbolGrid, toRemove, scene);
            };
            checkAnimations();
        } else {
            scene.gameData.debugLog("no overlay or bomb animations active, proceeding immediately");
            // No overlay or bomb animations active, proceed immediately
            this.dropAndRefill(symbolGrid, toRemove, scene);
        }
    }

    private hasActiveBombAnimations(): boolean {
        // Check if bomb animation is active through WinAnimation system
        if (this.bombAnimationActive) {
            return true;
        }
        
        // Check if any BombContainer is playing animation
        for (let row = 0; row < this.symbolGrid.length; row++) {
            for (let col = 0; col < this.symbolGrid[row].length; col++) {
                const symbol = this.symbolGrid[row][col];
                if (symbol instanceof BombContainer) {
                    if (symbol.isPlayingAnimation()) {
                        return true;
                    }
                }
            }
        }
        return false;
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
    
    private ongoingDropAndRefill: boolean = false;
    private dropAndRefillQueue: Array<{symbolGrid: number[][], toRemove: boolean[][], scene: GameScene}> = [];

    private dropAndRefill(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene): void {
        scene.gameData.debugLog("drop and refill requested");
        
        // If already processing, queue this request
        if(this.ongoingDropAndRefill) {
            scene.gameData.debugLog("drop and refill already in progress, queuing request");
            this.dropAndRefillQueue.push({symbolGrid, toRemove, scene});
            return;
        }
        
        this.ongoingDropAndRefill = true;
        this.processDropAndRefill(symbolGrid, toRemove, scene);
    }

    private processDropAndRefill(symbolGrid: number[][], toRemove: boolean[][], scene: GameScene): void {
        scene.gameData.debugLog("processing drop and refill");

        const rows = symbolGrid.length;
        const cols = symbolGrid[0].length;
        const width = this.symbolDisplayWidth;
        const height = this.symbolDisplayHeight;
        const horizontalSpacing = this.horizontalSpacing;
        const verticalSpacing = this.verticalSpacing;
        const dropTweens: Promise<void>[] = [];
        const newSymbols: (GameObjects.Sprite | SpineGameObject | BombContainer)[] = [];

        // Clean up any Alone symbols that might be left on screen
        this.cleanupAloneSymbols();

        // For each column, drop down and fill new randoms
        for (let col = 0; col < cols; col++) {
            // Build new column after removals
            const newCol: number[] = [];
            let dropMap: number[] = [];
            for (let row = rows - 1; row >= 0; row--) {
                if (!toRemove[row][col]) {
                    newCol.unshift(symbolGrid[row][col]);
                    dropMap.unshift(row);
                }
            }

            // Fill the rest with new symbols from tumble history or random
            const numNew = rows - newCol.length;
            for (let i = 0; i < numNew; i++) {
                let newSymbol: number;
                
                // Use tumble history data if available
                if (this.tumbleHistory.length > 0 && this.currentTumbleIndex < this.tumbleHistory.length) {
                    const currentTumble = this.tumbleHistory[this.currentTumbleIndex];
                    
                    console.log(`=== PROCESSING TUMBLE ${this.currentTumbleIndex} for col ${col}, row ${i} ===`);
                    console.log("currentTumble:", currentTumble);
                    
                    if (currentTumble && currentTumble.newslotarea && currentTumble.slotarea) {
                        console.log("newslotarea (raw):", currentTumble.newslotarea);
                        console.log("slotarea (raw):", currentTumble.slotarea);
                        
                        // Calculate which symbols need to be added based on the difference
                        const newSlotArea = transpose(currentTumble.newslotarea);
                        const oldSlotArea = transpose(currentTumble.slotarea);
                        
                        console.log("newslotarea (transposed):", newSlotArea);
                        console.log("slotarea (transposed):", oldSlotArea);
                        
                        // Find the new symbol for this position by comparing arrays
                        const newSymbolAtPosition = newSlotArea[i] && newSlotArea[i][col] !== undefined ? newSlotArea[i][col] : null;
                        const oldSymbolAtPosition = oldSlotArea[i] && oldSlotArea[i][col] !== undefined ? oldSlotArea[i][col] : null;
                        
                        console.log(`Position [${i}][${col}] - new: ${newSymbolAtPosition}, old: ${oldSymbolAtPosition}`);
                        
                        // If there's a new symbol at this position, use it
                        if (newSymbolAtPosition !== null && newSymbolAtPosition !== oldSymbolAtPosition) {
                            newSymbol = newSymbolAtPosition;
                            console.log(`Using new symbol from position: ${newSymbol}`);
                        } else {
                            // Fallback to finding added symbols in the tumble
                            const addedSymbols = this.getAddedSymbolsFromTumble(currentTumble, col, i);
                            newSymbol = addedSymbols.length > 0 ? addedSymbols[0] : Math.floor(Math.random() * 9) + 1;
                            console.log(`Using added symbols or random: ${newSymbol}, addedSymbols:`, addedSymbols);
                        }
                        
                        if (currentTumble.win && currentTumble.win.symbol) {
                            console.log(`Win symbol for this tumble: ${currentTumble.win.symbol}`);
                        }
                    } else {
                        newSymbol = Math.floor(Math.random() * 9) + 1;
                        console.log(`Missing tumble data, using random: ${newSymbol}`);
                    }
                } else {
                    // Fallback to random if no tumble history available
                    newSymbol = Math.floor(Math.random() * 9) + 1;
                    console.log(`No tumble history available, using random: ${newSymbol}`);
                }
                
                console.log(`=== FINAL SYMBOL ASSIGNMENT ===`);
                console.log(`Final newSymbol for col ${col}, row ${i}: ${newSymbol}`);
                
                newCol.unshift(newSymbol);
                scene.gameData.debugLog("newCol " + i + " " + col, newCol);
            }
                

            // Create a temporary grid to track the new positions
            const tempSymbolGrid: (GameObjects.Sprite | SpineGameObject | BombContainer)[] = [];
            
            // Animate drop for each cell in this column
            let targetRow = rows - 1;
            for (let i = dropMap.length - 1; i >= 0; i--) {
                const fromRow = dropMap[i];
                const symbolSprite = this.symbolGrid[fromRow][col];
                if (symbolSprite && symbolSprite.active) {
                    const newY = (height * 0.5) + targetRow * (height + verticalSpacing);
                    dropTweens.push(new Promise(resolve => {
                        scene.tweens.add({
                            targets: symbolSprite,
                            y: newY,
                            duration: 300,
                            ease: 'Cubic.easeIn',
                            onComplete: () => resolve()
                        });
                    }));
                    tempSymbolGrid[targetRow] = symbolSprite;
                    symbolGrid[targetRow][col] = symbolGrid[fromRow][col];
                }
                targetRow--;
            }

            // Create and animate new symbols at the top
            for (let i = 0; i < numNew; i++) {
                const symbolValue = newCol[i];
                let symbolKey = 'Symbol0_FIS'; // Default to scatter symbol
                //let frameKey = 'Symbol0_FIS-00000.png';
                
                if (symbolValue >= 1 && symbolValue <= 9) {
                    symbolKey = `Symbol${symbolValue}_FIS`;
                    //frameKey = `Symbol${symbolValue}_FIS-00000.png`;
                }
                
                const centerX = width * 0.5;
                const centerY = height * 0.5;
                const symbolX = centerX + col * (width + horizontalSpacing);
                const startY = centerY + (i - numNew) * (height + verticalSpacing);
                const endY = centerY + i * (height + verticalSpacing);
                
                let newSymbol: GameObjects.Sprite | SpineGameObject | BombContainer;
                
                if (symbolValue >= 10 && symbolValue <= 22) {
                    // Create BombContainer for bomb
                    newSymbol = new BombContainer(scene, symbolX, startY, symbolValue, scene.gameData);
                    newSymbol.setBombDisplaySize(width * Slot.BOMB_SIZE_X, height * Slot.BOMB_SIZE_Y);
                    scene.gameData.debugLog('Created BombContainer for dropAndRefill', { symbolValue, position: { x: symbolX, y: startY } });
                } else {
                    newSymbol = scene.add.sprite(symbolX, startY, symbolKey//, frameKey
                    ) as GameObjects.Sprite;
                    if (symbolValue === 0) {
                        newSymbol.setDisplaySize(width * Slot.SCATTER_SIZE, height * Slot.SCATTER_SIZE);
                    } else {
                        newSymbol.setDisplaySize(width * Slot.SYMBOL_SIZE, height * Slot.SYMBOL_SIZE);
                    }
                }

                this.container.add(newSymbol);
                newSymbols.push(newSymbol);
                tempSymbolGrid[i] = newSymbol;
                symbolGrid[i][col] = symbolValue;

                dropTweens.push(new Promise(resolve => {
                    scene.tweens.add({
                        targets: newSymbol,
                        y: endY,
                        duration: 300,
                        ease: 'Cubic.easeIn',
                        onComplete: () => resolve()
                    });
                }));
            }
            
            // Update the symbol grid for this column after all tweens are set up
            for (let row = 0; row < rows; row++) {
                if (tempSymbolGrid[row]) {
                    this.symbolGrid[row][col] = tempSymbolGrid[row];
                }
            }
        }

        // After all drops complete, check for new matches
        Promise.all(dropTweens).then(async () => {
            // Increment tumble index after processing this tumble
            if (this.tumbleHistory.length > 0 && this.currentTumbleIndex < this.tumbleHistory.length) {
                this.currentTumbleIndex++;
                scene.gameData.debugLog("Tumble index incremented to:", this.currentTumbleIndex);
            }
            
            const result = this.checkMatch(symbolGrid, scene);
            if (result === "No more matches" || result === "free spins") {
                // Wait 1.5 seconds before showing win animation
                await new Promise(res => {
                    scene.time.delayedCall(1500, res);
                    
                    // Play win audio and show overlay based on totalWin/bet multiplier
                    const bet = scene.gameData.bet || 1;
                    const totalWin = scene.gameData.totalWin || 0;
                    const multiplierWin = totalWin / bet;
                    
                    if (multiplierWin >= 10 ) {//|| scene.gameData.isBonusRound) {
                        this.showWinOverlay(scene, totalWin, bet);
                    }
                    scene.audioManager.playWinSFX(multiplierWin, scene);
                });
                Events.emitter.emit(Events.MATCHES_DONE, { symbolGrid });
                scene.gameData.isSpinning = false;
            }
            
            // Wait for any active bomb animations and win overlays before processing next queued drop and refill
            this.waitForAnimationsAndOverlays(scene);
        });
    }

    private waitForAnimationsAndOverlays(scene: GameScene): void {
        // Check if there are any active bomb animations or win overlays
        const checkForCompletion = () => {
            // Check if there's an active win overlay
            if (this.activeWinOverlay) {
                scene.gameData.debugLog("Waiting for win overlay to complete");
                scene.time.delayedCall(500, checkForCompletion);
                return;
            }

            // Check if there are any ongoing bomb animations
            if (this.hasActiveBombAnimations()) {
                scene.gameData.debugLog("Waiting for bomb animations to complete");
                scene.time.delayedCall(500, checkForCompletion);
                return;
            }

            // All animations and overlays are complete, process next queued drop and refill
            this.processNextQueuedDropAndRefill(scene);
        };

        checkForCompletion();
    }

    private getAddedSymbolsFromTumble(tumbleData: any, col: number, row: number): number[] {
        const addedSymbols: number[] = [];
        
        console.log(`=== getAddedSymbolsFromTumble for col ${col}, row ${row} ===`);
        
        try {
            if (tumbleData && tumbleData.newslotarea && tumbleData.slotarea) {
                const newSlotArea = transpose(tumbleData.newslotarea);
                const oldSlotArea = transpose(tumbleData.slotarea);
                
                console.log("newSlotArea in getAddedSymbols:", newSlotArea);
                console.log("oldSlotArea in getAddedSymbols:", oldSlotArea);
                
                // Compare the arrays to find new symbols
                if (newSlotArea[row] && oldSlotArea[row]) {
                    const newSymbol = newSlotArea[row][col];
                    const oldSymbol = oldSlotArea[row][col];
                    
                    console.log(`Comparing [${row}][${col}] - new: ${newSymbol}, old: ${oldSymbol}`);
                    
                    // If the symbol is different or new, add it
                    if (newSymbol !== oldSymbol && newSymbol !== undefined) {
                        addedSymbols.push(newSymbol);
                        console.log(`Added symbol ${newSymbol} to addedSymbols`);
                    }
                } else if (newSlotArea[row]) {
                    // If there's no old symbol but there's a new one, it's added
                    const newSymbol = newSlotArea[row][col];
                    if (newSymbol !== undefined) {
                        addedSymbols.push(newSymbol);
                        console.log(`Added new symbol ${newSymbol} (no old symbol)`);
                    }
                }
                
                console.log(`Final addedSymbols for [${row}][${col}]:`, addedSymbols);
            } else {
                console.log("Missing tumbleData, newslotarea, or slotarea");
            }
        } catch (error) {
            console.error("Error getting added symbols from tumble:", error);
        }
        
        return addedSymbols;
    }

    private processNextQueuedDropAndRefill(scene: GameScene): void {
        this.ongoingDropAndRefill = false;
        scene.gameData.debugLog("drop and refill complete");
        
        if (this.dropAndRefillQueue.length > 0) {
            const next = this.dropAndRefillQueue.shift();
            if (next) {
                scene.gameData.debugLog("processing next queued drop and refill");
                this.dropAndRefill(next.symbolGrid, next.toRemove, next.scene);
            }
        }
    }

    private cleanupAloneSymbols(): void {
        // Clean up any symbols that might be left on screen but not in the grid
        this.container.each((child: any) => {
            if ((child instanceof Phaser.GameObjects.Sprite || child instanceof SpineGameObject) && child.active) {
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
                    console.log("cleaning up Alone symbol");
                    child.destroy();
                }
            }
        });
    }

    public destroy(): void {
        // Clean up win animation
        if (this.winAnimation) {
            this.winAnimation.destroy();
        }
        
        // Clean up win overlay containers
        this.winOverlayContainers.forEach(container => container.destroy());
        this.winOverlayContainers = [];
        
        // Clean up bomb popup container
        if (this.bombPopupContainer) {
            this.bombPopupContainer.destroy();
            this.bombPopupContainer = null;
        }
        
        // Clean up container
        if (this.container) {
            this.container.destroy();
        }
        
        // Reset state
        this.activeWinOverlay = false;
        this.ongoingDropAndRefill = false;
        this.dropAndRefillQueue = [];
        this.tweensToComplete = 0;
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
} 