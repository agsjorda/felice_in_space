import { Scene } from 'phaser';
import { StateMachine } from '../fsm/statemachine';
import { Background } from './components/Background';
import { SlotMachine } from './components/SlotMachine';
import { GameData } from './components/GameData';
import { StartState } from './components/StartState';
import { Character } from '../ui/Character';
import { Buttons } from '../ui/Buttons';
import { AudioManager } from './components/AudioManager';    
import { Autoplay } from './components/Autoplay';
import { HelpScreen } from './components/HelpScreen';
import { GameAPI } from './backend/GameAPI';

// Interface for component lifecycle management
interface GameComponent {
    preload?: (scene: Game) => void;
    create?: (scene: Game) => void;
    update?: (scene: Game, time: number, delta: number) => void;
    destroy?: () => void;
}

export class Game extends Scene {
    public stateMachine: StateMachine;
    public gameData: GameData;
    public background: Background;
    public slotMachine: SlotMachine;
    public character: Character;
    public buttons: Buttons;
    public audioManager: AudioManager;
    public autoplay: Autoplay;
    public helpScreen: HelpScreen;
    public gameAPI: GameAPI;

    private components: GameComponent[];

    constructor() {
        super('Game');
        
        // Initialize all components
        this.stateMachine = new StateMachine();
        this.gameData = new GameData(this.gameAPI);
        this.background = new Background();
        this.slotMachine = new SlotMachine();
        this.character = new Character();
        this.buttons = new Buttons();
        this.audioManager = new AudioManager();
        this.autoplay = new Autoplay();
        this.helpScreen = new HelpScreen();
        this.gameAPI = new GameAPI(this.gameData);
        // Store components for lifecycle management
        this.components = [
            this.background,
            this.slotMachine,
            this.character,
            this.buttons,
            this.audioManager,
            this.autoplay,
            this.helpScreen,
        ];
    }

    preload(): void {
        try {
            // Preload all components
            for (const component of this.components) {
                if (component.preload) {
                    component.preload(this);
                }
            }
        } catch (error) {
            console.error('Error during preload:', error);
            // Handle preload error appropriately
        }
    }
    
    create(): void {
        try {
            // Debug logging example
            this.gameData.debugLog('Game scene created');
            this.gameData.debugLog('Current bet:', this.gameData.bet);
            this.gameData.debugLog('Current balance:', this.gameData.balance);
            
            // Set initial state
            this.stateMachine.setState(new StartState(), this);

            // Create all components
            for (const component of this.components) {
                if (component.create) {
                    component.create(this);
                }
            }

            // Initialize fade-in
            this.initFadeIn();

            // Add keyboard input handling
        } catch (error) {
            console.error('Error during create:', error);
            // Handle creation error appropriately
        }
    }

    private initFadeIn(): void {
        // Create a black rectangle to cover the screen
        const fadeRect = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            this.cameras.main.width,
            this.cameras.main.height,
            0x000000
        );
        fadeRect.setDepth(9999);

        // Fade in the scene
        this.tweens.add({
            targets: fadeRect,
            alpha: 0,
            duration: 1000,
            ease: 'Circ.easeInOut',
            onComplete: () => {
                fadeRect.destroy();
            }
        });
    }


    update(time: number, delta: number): void {
        try {
            // Debug logging example (only logs every 60 frames to avoid spam)
            if (this.gameData.debugged && time % 1000 < 16) { // ~60fps
                this.gameData.debugLog('Game update - isSpinning:', this.gameData.isSpinning);
            }
            
            // Update state machine
            this.stateMachine.update(this, time, delta);

            // Update all components
            for (const component of this.components) {
                if (component.update) {
                    component.update(this, time, delta);
                }
            }
        } catch (error) {
            console.error('Error during update:', error);
            // Handle update error appropriately
        }
    }

    shutdown(): void {
        try {
            // Clean up all components
            for (const component of this.components) {
                if (component.destroy) {
                    component.destroy();
                }
            }

            // Stop autoplay if active
            if (this.autoplay.isAutoPlaying) {
                this.autoplay.stop();
            }

            // Clear component references
            this.components = [];
        } catch (error) {
            console.error('Error during shutdown:', error);
            // Handle shutdown error appropriately
        }
    }

    showHelpScreen(): void {
        this.helpScreen.show();
    }

    hideHelpScreen(): void {
        this.helpScreen.hide();
    }
} 