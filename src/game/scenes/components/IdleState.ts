import { Scene } from 'phaser';
import { State } from '../../fsm/state';
import { Events } from './Events';
import { GameData, Slot } from './GameData';
import { AudioManager } from './AudioManager';
import { Background } from './Background';
import { SlotMachine } from './SlotMachine';
import { Buttons } from '../../ui/Buttons';

// Event data interfaces
interface SpinEventData {
    symbols: number[][];
    currentRow: number;
    newRandomValues?: number[][];
    isBuyFeature?: boolean;
}

interface GameScene extends Scene { 
    gameData: GameData;
    background: Background;
    audioManager: AudioManager;
    buttons: Buttons;
    slotMachine: SlotMachine;
    autoplay: any;
}

export class IdleState extends State {
    private spinEventListener?: (data: SpinEventData) => void;
    private changeLineListener?: () => void;

    start(scene: Scene): void {
        const gameScene = scene as GameScene;
        gameScene.gameData.currentRow = 0;
        gameScene.gameData.isSpinning = false;

        Events.emitter.emit(Events.START, {
            symbols: gameScene.gameData.slot.values,
            currentRow: gameScene.gameData.currentRow
        });
        this.initEventListeners(gameScene);
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        // Empty implementation
    }

    end(_scene: Scene): void {
        if (this.spinEventListener) {
            Events.emitter.off(Events.SPIN, this.spinEventListener);
            this.spinEventListener = undefined;
        }

        if (this.changeLineListener) {
            Events.emitter.off(Events.CHANGE_LINE, this.changeLineListener);
            this.changeLineListener = undefined;
        }
    }

    private spin(scene: GameScene, data?: SpinEventData): void {
        if (scene.gameData.isSpinning) { return; }
        scene.gameData.isSpinning = true;

        if(data?.isBuyFeature) {
            scene.gameData.balance -= scene.gameData.getBuyFeaturePrice();
            
            scene.gameData.minScatter = 4;
        }

        if (scene.gameData.freeSpins > 0) 
        {
            if(scene.autoplay.remainingSpins > 0) {
                scene.autoplay.remainingSpins = 0; // stop autoplay if doing free spins
            }
            scene.gameData.freeSpins--;
            if (scene.gameData.freeSpins === 0) {
                // End of bonus round
                scene.gameData.isBonusRound = false;
                scene.background.toggleBackground(scene);
                scene.audioManager.changeBackgroundMusic(scene);
                
                // Stop autoplay when free spins are done
                if (scene.autoplay.isAutoPlaying) {
                    scene.autoplay.stop();
                }
                // Show bonus end summary after the last spin completes
                const bonusWin = scene.gameData.totalBonusWin;
                Events.emitter.once(Events.SPIN_ANIMATION_END, () => {
                    scene.slotMachine.showBonusWin(scene, bonusWin);
                    // Ensure spin button is enabled
                    scene.gameData.isSpinning = false;
                });
            }
        } else {
            reduceBalance(scene);
        }

        const slot = scene.gameData.slot;
        const newRandomValues: number[][] = Array(Slot.ROWS).fill(null).map(() => Array(Slot.COLUMNS).fill(null));
        for (let i = 0; i < Slot.ROWS; i++) {
            newRandomValues[i] = getRandomRows();
        }
        for (let i = 0; i < Slot.ROWS; i++) {
            slot.setRows(newRandomValues[i], i);
        }
        // Place scatters after the grid is built
        slot.placeScatters(scene.gameData.minScatter, scene.gameData.maxScatter, scene.gameData.scatterChance);
        scene.gameData.minScatter = 0;

            slot.placeBombs(scene.gameData.minBomb, scene.gameData.maxBomb, scene.gameData.bombChance, scene.gameData.isBonusRound);
            scene.gameData.minBomb = 0;

            // Add listener to reset isSpinning when animation ends
            Events.emitter.once(Events.SPIN_ANIMATION_END, () => {
                scene.gameData.isSpinning = false;
            });
    
            Events.emitter.emit(Events.SPIN_ANIMATION_START, {
                symbols: slot.values,
                currentRow: scene.gameData.currentRow,
                newRandomValues: newRandomValues
            });
                
    }

    private initEventListeners(scene: GameScene): void {
        this.spinEventListener = (data: SpinEventData) => {
            this.spin(scene, data);
        };

        Events.emitter.on(Events.SPIN, this.spinEventListener);

        this.changeLineListener = () => {
            this.initSpin();
        };
        Events.emitter.on(Events.CHANGE_LINE, this.changeLineListener);
    }

    private initSpin(): void {
        // Empty implementation
    }
}


export function getRandomRows(): number[] {
    const symbolPool: number[] = Array(Slot.SYMBOLS).fill(null);
    const poolSize = Slot.TOGGLE_DIFFICULTY ? Slot.DIFFICULTY_SYMBOLS : Slot.SYMBOLS;
    let poolIndex = 0;
    
    while (poolIndex < poolSize) {
        const symbol = Math.floor(Math.random() * Slot.SYMBOLS) + 1;
        if (!symbolPool.includes(symbol)) {
            symbolPool[poolIndex] = symbol;
            poolIndex++;
        }
    }

    const columns: number[] = Array(Slot.COLUMNS).fill(null);
    for (let col = 0; col < Slot.COLUMNS; col++) {
        const randomIndex = Math.floor(Math.random() * poolSize);
        columns[col] = symbolPool[randomIndex];
    }
    return columns;
}

function reduceBalance(scene: GameScene): void {
    if (scene.gameData.doubleChanceEnabled) {
        scene.gameData.balance -= scene.gameData.getDoubleFeaturePrice();
    } else {
        scene.gameData.balance -= scene.gameData.bet;
    }
} 