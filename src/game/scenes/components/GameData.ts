import { GameAPI } from "../backend/GameAPI";

/**
 * Function to parse URL query parameters
 * @param name - The name of the parameter to retrieve
 * @returns The value of the parameter or null if not found
 */
function getUrlParameter(name: string): string | null {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Function to log all URL parameters for debugging
 * Only logs if there are any parameters present
 */
function logUrlParameters(): void {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
        console.log('🔍 URL Parameters:', Object.fromEntries(urlParams.entries()));
    }
}

/**
 * GameData class that manages all game state and configuration
 * 
 * Debug Mode Usage:
 * - Add ?debug=1 to the URL to enable debug mode
 * - Example: http://localhost:3000/?debug=1
 * - When debug=1, the debugged property will be true
 * - When debug=0 or not present, the debugged property will be false
 * 
 * Debug Methods:
 * - isDebugMode(): Returns true if debug mode is enabled
 * - debugLog(message, ...args): Logs messages only when debug mode is enabled
 */
export class GameData {
    gameAPI: GameAPI;

    constructor(gameAPI: GameAPI) {
        this.gameAPI = gameAPI;
        
        // Log URL parameters for debugging
        logUrlParameters();
        
        // Log debug mode status
        if (this.debugged > 0) {
            console.log('🔧 Debug mode enabled');
        }
    }

    winamounts: number[][] = [
            [100, 50, 25, 15, 12, 10, 8, 5, 4, 2, 100],
            [5, 25, 10, 5, 2, 1.5, 1.2, 1, 0.9, 0.75, 5],
            [3, 10, 2.5, 2, 1, 1, 0.8, 0.5, 0.4, 0.25, 3]
    ];
    
    currency: string = '$';
    slot: Slot = new Slot();
    line: number = 0;
    currentRow: number = 0;
    bet: number = 10;

    maxBet: number = 150;
    minBet: number = 0.2;

    balance: number = 0;
    
    totalBet: number = 0;
    totalWin: number = 0;

    totalWinFreeSpin: number[] = [];
    totalWinFreeSpinPerTumble: number[] = [];
    totalBonusWin: number = 0; // Track bonus round wins separately
    doubleChanceEnabled: boolean = false;
    buyFeatureEnabled: boolean = false;
    isSpinning: boolean = false;
    turbo: boolean = false;
    isBonusRound: boolean = false;

    scatterCount: number = 0;
    scatterChance: number = 0.025;
    maxScatter: number = 6;
    minScatter: number = 0;

    minBomb: number = 0;
    maxBomb: number = 3;
    bombMultiplier: number[] = [2, 3, 4, 5, 6, 8, 10,  // Low
                                12, 15, 20, 25, // Medium
                                50, 100]; // High
    bombChance: number = 10; // Base chance for bomb to spawn
    bombTypeChances: { low: number, medium: number, high: number } = {
        low: 0.6,    // 60% chance for low multiplier
        medium: 0.3, // 30% chance for medium multiplier
        high: 0.1    // 10% chance for high multiplier
    };

    isHelpScreenVisible: boolean = false;

    isMain : boolean = true;

    defaultMinScatter: number = 0;

    currentMatchingSymbols: number[] = [];
    doubleChanceMultiplier: number = 2;
    
    winRank : number[] = [1, 20, 30, 45, 60, 21000];

    public gameUrl: string = '';
    public gameToken: string = '';

    freeSpins: number = 0;
    totalFreeSpins: number = 0;

    // API-driven free spins
    public apiBet : number = 1;
    public apiFreeSpins: any[] = [];
    public apiFreeSpinsIndex: number = 0;
    public useApiFreeSpins: boolean = false;
    public totalBombWin: number = 0;

    // Current free spin progress (1-based when in use)
    public currentFreeSpinIndex: number = 0;

    // Base-game autoplay state (separate from bonus/free spins)
    public autoplayRemainingSpins: number = 0; // persists when bonus starts
    public autoplayWasPaused: boolean = false; // true when autoplay was paused due to bonus

    // Debug mode property - initialized from URL parameter
    public debugged: number = (() => {
        const debugParam = getUrlParameter('debug');
        console.log('debugParam', debugParam, parseInt(debugParam || '0'));
        return debugParam ? parseInt(debugParam) : 0;
    })();

    public demoMode: boolean = false;

    getDoubleFeaturePrice(): number {
        const doubleMultiplier = 1.25; // temporary multiplier
        return Math.round(this.bet * doubleMultiplier * 100) / 100;
    }

    getBuyFeaturePrice(): number {
        const featureMultiplier = 100; // temporary multiplier
        return Math.round(this.bet * featureMultiplier);
    }

    // Utility method to check if debug mode is enabled
    isDebugMode(): boolean {
        return this.debugged > 0;
    }

    // Debug error logging method - only logs when debug mode is enabled
    debugError(message: string, ...args: any[]): void {
        if (this.debugged > 0) {
            console.error(`%c[DEBUG ERROR] ${message}`, 'color: #ff0000', ...args);
        }
    }

    // Debug logging method - only logs when debug mode is enabled
    debugLog(message: string, ...args: any[]): void {
        if (this.debugged > 0) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }
}

export class Slot {
    static TOGGLE_DIFFICULTY: boolean = true;
    static readonly TOGGLE_WIN_EFFECT: boolean = false;

    static DIFFICULTY_SYMBOLS: number = 1;
    static readonly SYMBOLS: number = 9;
    static readonly ROWS: number = 5;
    static readonly COLUMNS: number = 6;
    static readonly SCATTER_SYMBOL: number = 0;
    static readonly SCATTER_SIZE: number = 1.125;
    static readonly SYMBOL_SIZE: number = 0.9;
    static readonly BOMB_SIZE_X: number = 1.125;
    static readonly BOMB_SIZE_Y: number = 0.9;
    static readonly BOMBS_MAX_COUNT: number = 3;

    static readonly BOMB_SCALE: number = 1.5;
    static readonly SYMBOL_SIZE_ADJUSTMENT: number = 0.1;

    values: number[][] = [];
    scatterCount: number = 0;
    bombCount: number = 0;

    constructor() {
        // 5 x 6
        for (let x = 0; x < Slot.ROWS; x++) {
            const cols: number[] = [];
            for (let y = 0; y < Slot.COLUMNS; y++) {
                const symbolIndex = Math.floor(Math.random() * Slot.SYMBOLS);
                cols.push(symbolIndex);
            }
            this.values.push(cols);
        }
    }

    setRows(rowValues: number[], index: number): void {
        for (let y = 0; y < Slot.COLUMNS; y++) {
            this.values[index][y] = rowValues[y];
        }
    }

    placeBombs(minBomb: number = 0, maxBomb: number, bombChance: number, isBonusRound: boolean): void {
        this.bombCount = 0;

        if(!isBonusRound){
            return;
        }
        // Flatten all cell positions
        interface Cell {
            row: number;
            col: number;
        }

        const allCells: Cell[] = [];
        for (let r = 0; r < Slot.ROWS; r++) {
            for (let c = 0; c < Slot.COLUMNS; c++) {
                allCells.push({ row: r, col: c });
            }
        }

        // Shuffle
        for (let i = allCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
        }

        // Place bombs
        for (let i = 0; i < allCells.length && this.bombCount < maxBomb; i++) {
            if (this.bombCount < minBomb) {
                const { row, col } = allCells[i];
                // Determine bomb type based on probabilities
                const rand = Math.random();
                let bombType;
                if (rand < 0.6) { // Low (60%)
                    bombType = Math.floor(Math.random() * 7) + 10; // 10-16
                } else if (rand < 0.9) { // Medium (30%)
                    bombType = Math.floor(Math.random() * 4) + 17; // 17-20
                } else { // High (10%)
                    bombType = Math.floor(Math.random() * 2) + 21; // 21-22
                }
                this.values[row][col] = bombType;
                this.bombCount++; 
            } else {
                if (Math.random() < bombChance) {
                    const { row, col } = allCells[i];
                    // Determine bomb type based on probabilities
                    const rand = Math.random();
                    let bombType;
                    if (rand < 0.6) { // Low (60%)
                        bombType = Math.floor(Math.random() * 7) + 10; // 10-16
                    } else if (rand < 0.9) { // Medium (30%)
                        bombType = Math.floor(Math.random() * 4) + 17; // 17-20
                    } else { // High (10%)
                        bombType = Math.floor(Math.random() * 2) + 21; // 21-22
                    }
                    this.values[row][col] = bombType;
                    this.bombCount++;
                }
            }
        }
    }

    placeScatters(minScatter: number = 0, maxScatter: number, scatterChance: number): void {
        this.scatterCount = 0; // Reset before placing
        
        // Flatten all cell positions
        interface Cell {
            row: number;
            col: number;
        }

        const allCells: Cell[] = [];
        for (let r = 0; r < Slot.ROWS; r++) {
            for (let c = 0; c < Slot.COLUMNS; c++) {
                allCells.push({ row: r, col: c });
            }
        }

        // Shuffle
        for (let i = allCells.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCells[i], allCells[j]] = [allCells[j], allCells[i]];
        }

        // Place scatters
        for (let i = 0; i < allCells.length && this.scatterCount < maxScatter; i++) {
            if (this.scatterCount < minScatter) {
                const { row, col } = allCells[i];
                this.values[row][col] = Slot.SCATTER_SYMBOL;
                this.scatterCount++;
            } else {
                if (Math.random() < scatterChance) {
                    const { row, col } = allCells[i];
                    this.values[row][col] = Slot.SCATTER_SYMBOL;
                    this.scatterCount++;
                }
            }
        }
    }
} 