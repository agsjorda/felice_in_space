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
import { GameAPI } from './backend/GameAPI';
import { BuyFeaturePopup } from './components/BuyFeaturePopup';
import { SessionTimeoutPopup } from './components/SessionTimeoutPopup';
import { InsufficientBalancePopup } from './components/InsufficientBalancePopup';
import { WakeLockManager } from '../utils/wakeLock';



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
    public gameAPI: GameAPI;
    public buyFeaturePopup: BuyFeaturePopup;
    public sessionTimeoutPopup: SessionTimeoutPopup;
    public insufficientBalancePopup: InsufficientBalancePopup;

    private components: GameComponent[];

    constructor() {
        super('Game');
        
        // Initialize all components
        this.stateMachine = new StateMachine();
        
        // Create a temporary gameAPI for gameData initialization
        this.gameAPI = {} as GameAPI; // Temporary placeholder
        this.gameData = new GameData(this.gameAPI);
        // Now create the real gameAPI with gameData
        this.gameAPI = new GameAPI(this.gameData);
        
        this.background = new Background();
        this.slotMachine = new SlotMachine();
        this.character = new Character();
        this.buttons = new Buttons();
        this.audioManager = new AudioManager();
        this.autoplay = new Autoplay();
        this.buyFeaturePopup = new BuyFeaturePopup();
        this.sessionTimeoutPopup = new SessionTimeoutPopup();
        this.insufficientBalancePopup = new InsufficientBalancePopup();
        
        // Inject the single autoplay instance into buttons
        this.buttons.autoplay = this.autoplay;
        // Store components for lifecycle management
        this.components = [
            this.background,
            this.slotMachine,
            this.character,
            this.buttons,
            this.audioManager,
            this.autoplay,
            this.buyFeaturePopup,
            this.sessionTimeoutPopup,
            this.insufficientBalancePopup,
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
            // Try to acquire wake lock when gameplay scene starts
            void WakeLockManager.request();

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
            if (this.gameData.debugged > 0 && time % 1000 < 16) { // ~60fps
                console.log('Game update - isSpinning:', this.gameData.isSpinning);
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
            // Release wake lock when leaving gameplay scene
            void WakeLockManager.release();
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
} 