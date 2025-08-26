import { Scene } from 'phaser';
import { StateMachine } from '../fsm/statemachine';
import { GameData } from './components/GameData';
import { Background } from './components/Background';
import { SlotMachine } from './components/SlotMachine';
import { Character } from '../ui/Character';
import { Buttons } from '../ui/Buttons';
import { AudioManager } from './components/AudioManager';
import { Autoplay } from './components/Autoplay';
import { HelpScreen } from './components/HelpScreen';
export class LoadingPage extends Scene {
    private loadingBar!: Phaser.GameObjects.Graphics;
    private progressText!: Phaser.GameObjects.Text;
    private width = 310;
    private barX: number = 0;
    private barY: number = 0;
    private isMobile: boolean = false;

    public stateMachine: StateMachine;
    public gameData: GameData;
    public background: Background;
    public slotMachine: SlotMachine;
    public character: Character;
    public buttons: Buttons;
    public audioManager: AudioManager;
    public autoplay: Autoplay;
    public helpScreen: HelpScreen;

    private components: any[];

    constructor() {
        super('LoadingPage');
        
        // Initialize all components
        this.stateMachine = new StateMachine();
        this.background = new Background();
        this.slotMachine = new SlotMachine();
        this.character = new Character();
        this.buttons = new Buttons();
        this.audioManager = new AudioManager();
        this.autoplay = new Autoplay();
        this.helpScreen = new HelpScreen();

        // Store components for lifecycle management
        this.components = [
            this.background,
            this.slotMachine,
            this.character,
            this.buttons,
            this.audioManager,
            this.autoplay,
            this.helpScreen
        ];
    }

    preload(): void {
        // Detect if mobile
        this.isMobile = this.isMobileDevice();
        
        // Create loading bar
        this.createLoadingBar();
        
        // Preload all components
        try {
            for (const component of this.components) {
                if (component.preload) {
                    component.preload(this);
                }
            }
        } catch (error) {
            console.error('Error during preload:', error);
        }
    }

    create(): void {
        // @ts-ignore
        this.scene.get('LandingPage').doneLoading();
    }

    public hideLoadingBar(): void {
        this.loadingBar.destroy();
        this.progressText.destroy();
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    private createLoadingBar(): void {  
        const height = this.isMobile ? 30 : 40;
        const innerHeight = this.isMobile ? 22 : 30;
        const borderRadius = this.isMobile ? 12 : 16;
        const barWidth = this.isMobile ? 200 : 300;
        const fontSize = this.isMobile ? '18px' : '24px';
        
        // Adjust positioning based on device
        if (this.isMobile) {
            this.barX = this.cameras.main.centerX - barWidth / 2;
            this.barY = this.cameras.main.centerY + barWidth * 1.6
        } else {
            this.barX = this.cameras.main.centerX + this.width + 100;
            this.barY = this.cameras.main.centerY + 160;
        }
        

        // Create loading bar background
        this.loadingBar = this.add.graphics();
        this.loadingBar.fillStyle(0x222222, 0.8);
        this.loadingBar.fillRoundedRect(this.barX, this.barY, barWidth, height, borderRadius);

        // Create progress bar
        this.loadingBar.fillStyle(0x4CAF50, 1);
        this.loadingBar.fillRoundedRect(this.barX, this.barY, 0, innerHeight, borderRadius);

        // Create progress text
        this.progressText = this.add.text(this.barX + barWidth / 2, this.barY + height / 2 - 3, '0%', {
            fontSize: fontSize,
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }).setOrigin(0.5);

        // Set up loading events
        this.load.on('progress', (value: number) => {
            this.loadingBar.clear();
            this.loadingBar.fillStyle(0x222222, 0.8);
            this.loadingBar.fillRoundedRect(this.barX - 5, this.barY - 5, barWidth + 10, height, borderRadius);
            this.loadingBar.fillStyle(0x4CAF50, 1);
            this.loadingBar.fillRoundedRect(this.barX, this.barY, barWidth * value, innerHeight, borderRadius);
            this.progressText.setText(`${Math.floor(value * 100)}%`);
        });

        this.load.on('complete', () => {
            this.loadingBar.clear();
            this.loadingBar.fillStyle(0x222222, 0.8);
            this.loadingBar.fillRoundedRect(this.barX - 5, this.barY - 5, barWidth + 10, height, borderRadius);
            this.loadingBar.fillStyle(0x4CAF50, 1);
            this.loadingBar.fillRoundedRect(this.barX, this.barY, barWidth, innerHeight, borderRadius);
            this.progressText.setText('100%');
            this.loadingBar.destroy();
            this.progressText.destroy();
        });
    }
} 