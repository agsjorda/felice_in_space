import { Scene, GameObjects, Tweens, Geom, Scale } from 'phaser';
import { Events } from '../scenes/components/Events';
import { GameData } from '../scenes/components/GameData';
import { Autoplay } from '../scenes/components/Autoplay';
import { AudioManager } from '../scenes/components/AudioManager';
import { SlotMachine } from '../scenes/components/SlotMachine';
import { Menu } from './Menu';
import { BuyFeaturePopup } from '../scenes/components/BuyFeaturePopup';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
// Custom button interfaces with proper type safety
interface ButtonBase {
    isButton: boolean;
}

// Use type assertion to avoid complex type issues
type ButtonContainer = GameObjects.Container & ButtonBase;
type ButtonImage = GameObjects.Image & ButtonBase;
type ButtonText = GameObjects.Text & ButtonBase;
type ButtonZone = GameObjects.Zone & ButtonBase;

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    autoplay: Autoplay;
    buyFeaturePopup: BuyFeaturePopup;
}

export class Buttons {

    public spinButton: ButtonImage;
    public freeSpinBtn: ButtonImage;
    public autoplayIndicator: ButtonImage;
    private turboButton: ButtonImage;
    private turboOnButton: ButtonImage;
    public buttonContainer: ButtonContainer;
    private bombWinContainer: Phaser.GameObjects.Container;
    private bombMarqueeContainer : Phaser.GameObjects.Container;
    private bombWin: Phaser.GameObjects.Graphics;

    private width: number;
    private height: number;
    private isVisuallyDisabled: boolean = false; // Separate visual state for immediate feedback
    private buyFeaturePriceText: ButtonText;
    private amplifyBetButton : ButtonImage;
    private buyFeatureButton: GameObjects.Image | GameObjects.Graphics | null = null;
    private buyFeatureButtonText: ButtonText | null = null;
    private buyFeatureStarLeft: GameObjects.Image | null = null;
    private buyFeatureStarRight: GameObjects.Image | null = null;
    private autoplayPopup: GameObjects.Container | null = null;
    private buyFeaturePopup: GameObjects.Container | null = null;
    private balance: Phaser.GameObjects.Graphics;
    private totalWin: Phaser.GameObjects.Graphics;
    private totalBet: Phaser.GameObjects.Graphics;
    private balanceContainer: Phaser.GameObjects.Container;
    private totalWinContainer: Phaser.GameObjects.Container;
    private betContainer: Phaser.GameObjects.Container; 
    private betContainer_Y: number = 0;
    public autoplay: Autoplay;
    private menu: Menu;
    private idleTween: Tweens.Tween | null = null;
    private static PANEL_WIDTH = 250;
    private static PANEL_HEIGHT = 120;
    private autoplayButton: ButtonImage;
    private autoplayOnButton: ButtonImage;
    private isMobile: boolean = false;

    private mobile_buttons_x: number = 0;
    private mobile_buttons_y: number = 0;
    private spinInProgress: boolean = false; // Add this flag to prevent spam
	// Track previous enabled state to trigger "ready" visuals only on transitions
	private wasSpinEnabled: boolean = false;
	private wasBuyFeatureEnabled: boolean = false;
    private remainingFsLabel: GameObjects.Text | null = null;
    private remainingFsLabel_Count: GameObjects.Text | null = null;
    private forceSpinsLeftOverlay: boolean = false;
    // Base Y positions for Y-axis toggle events
    private baseYPositions: { [key: string]: number } = {};
    
    constructor() {
        // Autoplay will be injected from the Game scene to ensure single instance
        this.autoplay = null as any; // Temporary until injected
        this.isMobile = this.isMobileDevice();
    }

    // Returns true if local balance is sufficient for initiating a paid spin
    private hasSufficientBalance(scene: GameScene): boolean {
        // Free spins do not require balance
        if (scene.gameData.freeSpins > 0) {
            //console.log('[CHECK] Free spin active, skipping balance check');
            return true;
        }
        const required = scene.gameData.doubleChanceEnabled
            ? scene.gameData.getDoubleFeaturePrice()
            : scene.gameData.bet;
        const ok = scene.gameData.balance >= required;
        //console.log(`[CHECK] Balance check before spin -> balance=${scene.gameData.balance}, required=${required}, ok=${ok}`);
        return ok;
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    preload(scene: GameScene): void {
        this.width = scene.scale.width;
        this.height = scene.scale.height;
    
        const prefix = 'assets/Controllers';
        scene.load.image('spinButton', `${prefix}/Spin.png`);
        scene.load.image('turboButton', `${prefix}/Turbo.png`);
        scene.load.image('turboOn', `${prefix}/Turbo_ON.png`);
        scene.load.image('autoplayButton', `${prefix}/Autoplay.png`);
        scene.load.image('autoplayOn', `${prefix}/Autoplay_ON.png`);
        scene.load.image('info', `${prefix}/Info.png`);
        scene.load.image('infoOn', `${prefix}/Info_ON.png`);
        scene.load.image('plus', `${prefix}/Plus.png`);
        scene.load.image('minus', `${prefix}/Minus.png`);
        scene.load.image('logo', 'assets/Logo/Logo.png');
        scene.load.image('volume', `${prefix}/Volume.png`);
        scene.load.image('settings', `${prefix}/Settings.png`);
        scene.load.image('star', `${prefix}/star.png`);
        scene.load.image('buyFeatBG', 'assets/Reels/BuyFeatureBG.png');
        scene.load.image('freeSpinDisplay', `${prefix}/FreeSpinDisplay.png`);
        scene.load.image('autoplayIndicator', `${prefix}/AutoplayIndicator.png`);
        scene.load.image('amplifyBet', `${prefix}/AmplifyBet.png`);

        scene.load.image('greenBtn', 'assets/Buttons/greenBtn.png');
        scene.load.image('greenLongBtn', 'assets/Buttons/greenLongBtn.png');
        scene.load.image('greenRectBtn', 'assets/Buttons/greenRectBtn.png');
        scene.load.image('greenCircBtn', 'assets/Buttons/greenCircBtn.png');

        scene.load.image('hamburger', 'assets/Mobile/Hamburger.png');
        scene.load.image('buyFeature','assets/Mobile/BuyFeature.png');
        scene.load.image('doubleFeature', `${prefix}/AmplifyBet.png`);
        scene.load.image('marquee', 'assets/Reels/Marquee.png');


        // Preload Spine animation for the spin button idle effect
        scene.load.spineAtlas('button_animation_idle', 'assets/Controllers/Animation/Spin/button_animation_idle.atlas');
        scene.load.spineJson('button_animation_idle', 'assets/Controllers/Animation/Spin/button_animation_idle.json');

        // Preload Spine animation for the spin button idle effect
        scene.load.spineAtlas('Amplify_Bet', 'assets/Controllers/Animation/AmplifyBet/Amplify Bet.atlas');
        scene.load.spineJson( 'Amplify_Bet', 'assets/Controllers/Animation/AmplifyBet/Amplify Bet.json');

        // Preload help screen assets
        const menu = new Menu(false);
        menu.preload(scene);
        const buyFeaturePopup = new BuyFeaturePopup();
        buyFeaturePopup.preload(scene);
    }

    create(scene: GameScene): void {
        // Initialize autoplay if it wasn't injected properly
        if (!this.autoplay || !this.autoplay.create) {
            this.autoplay = scene.autoplay;
        }
        if(this.isMobile){
            this.mobile_buttons_x = scene.scale.width * 0.05;
            this.mobile_buttons_y = scene.scale.height * 0.86;
        }
        
        this.createContainer(scene);
        this.createTurboButton(scene);
        this.createSpinButton(scene);
        this.createAutoplay(scene);
        this.createInfo(scene);
        this.createBalance(scene);
        this.createTotalWin(scene);
        this.createBombWin(scene);

        this.createBet(scene);
        this.createBuyFeature(scene);
        this.createDoubleFeature(scene);
        this.createLogo(scene);

        this.createMarquee(scene);
        this.createMarqueeBonus(scene);
        
        Events.emitter.emit(Events.HIDE_BOMB_WIN);
        // Initialize buy feature popup
        if (!scene.buyFeaturePopup) {
            scene.buyFeaturePopup = new BuyFeaturePopup();
            scene.buyFeaturePopup.create(scene);
        }
        //this.createSettingsButton(scene);
        
        this.createSettings(scene);
        
        this.setupKeyboardInput(scene);

        this.createRemainingFreeSpinsLabel(scene);

        // Listen for bomb float text event and animate a floating text illusion from bomb to target
        Events.emitter.on(Events.BOMB_FLOAT_TEXT, (data: { x: number; y: number; valueText?: string }) => {
            try {
                const startX = data?.x ?? scene.scale.width * 0.5;
                const startY = data?.y ?? scene.scale.height * 0.5;
                const isMobile = this.isMobile;

                // Resolve destination: Total Win center on desktop, Marquee center on mobile
                let destX = scene.scale.width * 0.5;
                let destY = this.isMobile ? this.height * 0.175 : this.height * 0.83;

                if (!isMobile) {
                    const bounds = this.totalWinContainer?.getBounds ? this.totalWinContainer.getBounds() : null;
                    if (bounds) {
                        destX = bounds.centerX;
                        destY = bounds.centerY;
                    }
                } else {
                    // Find marquee image bounds
                    const marqueeContainer: any = this.buttonContainer?.list?.find?.((child: any) => child?.list?.some?.((c: any) => c?.texture?.key === 'marquee'));
                    let marqueeImage: any = null;
                    if (marqueeContainer && marqueeContainer.list) {
                        marqueeImage = marqueeContainer.list.find((c: any) => c?.texture?.key === 'marquee');
                    }
                    const bounds = marqueeImage?.getBounds ? marqueeImage.getBounds() : null;
                    if (bounds) {
                        destX = bounds.centerX;
                        destY = bounds.centerY;
                    } else {
                        destX = scene.scale.width * 0.5;
                        destY = scene.scale.height * 0.175;
                    }
                }

                // Create floating text on scene root
                const floating = scene.add.text(startX, startY, data?.valueText ?? '', {
                    fontSize: '32px',
                    color: '#FFD700',
                    fontFamily: 'Poppins',
                    fontStyle: 'bold',
                    align: 'center',
                    stroke: '#FF0000',
                    strokeThickness: 4
                });
                floating.setOrigin(0.5, 0.5);
                floating.setDepth(10000);
                try {
                    const grad = (floating as any).context?.createLinearGradient(0, 0, 0, floating.height);
                    if (grad) {
                        grad.addColorStop(0, '#FFF15A');
                        grad.addColorStop(0.5, '#FFD000');
                        grad.addColorStop(1, '#FFB400');
                        (floating as any).setFill(grad);
                    }
                } catch (_e) { /* no-op */ }

                // Tween toward destination
                scene.tweens.add({
                    targets: floating,
                    x: destX,
                    y: destY,
                    duration: 900,
                    ease: 'Cubic.easeInOut',
                    onComplete: () => { try { floating.destroy(); } catch (_e) {} }
                });
            } catch (_e) { /* no-op */ }
        });

    }

    private spinAnimation: SpineGameObject;

    private createContainer(scene: GameScene): void {
        this.buttonContainer = scene.add.container(0, 0) as ButtonContainer;
        // Desktop: original depth; Mobile: slightly higher to draw over game area where needed
        this.buttonContainer.setDepth(this.isMobile ? 6 : 4);
    }

    private createRemainingFreeSpinsLabel(scene: GameScene): void {
        const labelText = 'Remaining Free Spins:';
        const x = this.isMobile ? scene.scale.width * 0.2 : scene.scale.width * 0.88;
        const y = this.isMobile ? scene.scale.height * 0.815 : scene.scale.height * 0.39;
        const style = {
            fontSize: this.isMobile ? '32px' : '28px',
            color: this.isMobile ? '#09FF5C' : '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'left' as const,
            wordWrap: { width: scene.scale.width * 0.5, useAdvancedWrap: true }
        };
        this.remainingFsLabel = scene.add.text(x, y, labelText, style);
        this.remainingFsLabel.setOrigin(0, 0);
        this.remainingFsLabel.setDepth(1000);
        this.remainingFsLabel.setVisible(false);
        
        const x_count = this.isMobile ? scene.scale.width * 0.65 : scene.scale.width * 0.88;
        const y_count = this.isMobile ? scene.scale.height * 0.81 : scene.scale.height * 0.39;
        const style2 = {
            fontSize: this.isMobile ? '84px' : '128px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'left' as const,
        };
// remaining free spin label (mobile, desktop)
        this.remainingFsLabel_Count = scene.add.text(x_count, y_count, '0', style2);
        this.remainingFsLabel_Count.setOrigin(this.isMobile ? 0 : 0.5, this.isMobile ? 0 : 0);
        this.remainingFsLabel_Count.setDepth(1000);
        this.remainingFsLabel_Count.setVisible(false);



        const updateLabelVisibility = () => {
            if (!this.remainingFsLabel || !this.remainingFsLabel_Count) return;
            // Reposition in case of resize/orientation or platform switch

            //const newX = this.isMobile ? scene.scale.width * 0.275 : scene.scale.width * 0.88;
            //const newX_count = this.isMobile ? scene.scale.width * 0.7 : scene.scale.width * 0.88;
            //const newY = this.isMobile ? scene.scale.height * 0.92 : scene.scale.height * 0.61;
            //
            //this.remainingFsLabel.setPosition(newX, newY);
            //this.remainingFsLabel_Count.setPosition(newX_count, newY);
            
            this.remainingFsLabel.setFontSize(this.isMobile ? '32px' : '20px');
            const shouldShow = !!scene.gameData.isBonusRound && (scene.gameData.freeSpins ?? 0) > 0;
            const count = this.forceSpinsLeftOverlay ? 10 : (scene.gameData.freeSpins ?? 0);
            if(this.isMobile){
                this.remainingFsLabel.setText(`Remaining Free Spins:`);
                this.remainingFsLabel_Count.setText(`${count - 1}`);
            }
            else {
                this.remainingFsLabel.setText(`Spins Left:`);
                this.remainingFsLabel_Count.setText(`${this.forceSpinsLeftOverlay ? count : (count - 1)}`);
            }
            this.remainingFsLabel.setVisible(shouldShow);
            this.remainingFsLabel_Count.setVisible(shouldShow);

            // Sync freeSpinBtn with the Spins Left label visibility or active/paused autoplay
            try { this.freeSpinBtn.visible = shouldShow || !!this.autoplay?.isAutoPlaying || !!scene.gameData.autoplayWasPaused; } catch (_e) {}
            // Avoid overlap: hide autoplay indicator while Spins Left is shown
            // Only show autoplay indicator when autoplay is actively running
            try { this.autoplayIndicator.visible = shouldShow ? false : (!!this.autoplay?.isAutoPlaying || !!scene.gameData.autoplayWasPaused); } catch (_e) {}
			// Enforcement: only during active bonus ensure freeSpinBtn stays visible
			try { if (scene.gameData.isBonusRound && this.autoplayIndicator?.visible) { this.freeSpinBtn.visible = true; } } catch (_e) {}
            // Ensure spin button alpha follows autoplay indicator visibility
            try { this.updateButtonStates(scene); } catch (_e) {}

            // Toggle bottom controls visibility and Y-axis positions based on free spins state
            // Desktop: keep controls visible; Mobile: hide while in bonus
            if (this.isMobile) {
                    this.hideBottomControlsForBonus(scene, shouldShow);

                    this.remainingFsLabel.setText(`Remaining Free Spins:`);
                    this.remainingFsLabel_Count.setText(`${count - 1}`);
                
            } else {
                // On desktop, keep controls visible and show/hide spins using the spin-button HUD like autoplay
                if (shouldShow && this.autoplay?.ensureRemainingSpinsDisplay) {
                    this.autoplay.ensureRemainingSpinsDisplay(scene);
                // } else if (!shouldShow && this.autoplay?.hideRemainingSpinsDisplay) {
                //     this.autoplay.hideRemainingSpinsDisplay();
                }
            }
        };

        // Update label on common state-change events
        Events.emitter.on(Events.SPIN_ANIMATION_START, updateLabelVisibility);
        Events.emitter.on(Events.SPIN_ANIMATION_END, updateLabelVisibility);
        Events.emitter.on(Events.MATCHES_DONE, updateLabelVisibility);
        Events.emitter.on(Events.UPDATE_TOTAL_WIN, updateLabelVisibility);
        Events.emitter.on(Events.AUTOPLAY_START, updateLabelVisibility);
        Events.emitter.on(Events.AUTOPLAY_STOP, updateLabelVisibility);

        // Show immediate label when FreeSpin overlay appears
        Events.emitter.on(Events.FREE_SPIN_OVERLAY_SHOW, () => {
            this.forceSpinsLeftOverlay = true;
            if (!this.remainingFsLabel || !this.remainingFsLabel_Count) return;
            this.remainingFsLabel.setText(this.isMobile ? `Remaining Free Spins:` : `Spins Left:`);
            this.remainingFsLabel_Count.setText(`10`);
            this.remainingFsLabel.setVisible(true);
            this.remainingFsLabel_Count.setVisible(true);
            // On entering FS overlay: ensure FS button is shown, spin hidden, and autoplay indicator hidden
            try { this.freeSpinBtn.visible = true; this.freeSpinBtn.setAlpha(1); } catch (_e) {}
            try { this.spinButton.setAlpha(0); } catch (_e) {}
            try { this.autoplayIndicator.visible = false; } catch (_e) {}
            try { this.updateButtonStates(scene); } catch (_e) {}
        });
        // Re-sync to actual state when overlay hides
        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            this.forceSpinsLeftOverlay = false;
            try { updateLabelVisibility(); } catch (_e) {}
        });

        // Initial evaluation
        updateLabelVisibility();
    }

    public showRemainingFreeSpinsLabel(scene: GameScene): void {
        if (!this.remainingFsLabel || !this.remainingFsLabel_Count) return;
        const count = scene.gameData.freeSpins ?? 0;
        if(this.isMobile){
            this.remainingFsLabel.setText(`Remaining Free Spins:`);
            this.remainingFsLabel_Count.setText(`${count - 1}`);
        }
        else{
            this.remainingFsLabel.setText(`Spins Left:`);
            this.remainingFsLabel_Count.setText(`${count}`);
        }
        // Mobile: show text label; Desktop: use autoplay HUD near spin button
        //this.remainingFsLabel.setVisible(this.isMobile);
        //this.remainingFsLabel_Count.setVisible(this.isMobile);
        if (!this.isMobile && this.autoplay?.ensureRemainingSpinsDisplay) {
            this.autoplay.ensureRemainingSpinsDisplay(scene);
        }
        // Ensure button syncs when label is requested to show
        try { this.freeSpinBtn.visible = true; } catch (_e) {}
        try { this.autoplayIndicator.visible = false; } catch (_e) {}
    }

    public updateRemainingFreeSpinsCount(scene: GameScene): void {
        if (!this.remainingFsLabel || !this.remainingFsLabel_Count) return;
        const count = scene.gameData.freeSpins ?? 0;
        if(this.isMobile){
            this.remainingFsLabel.setText(`Remaining Free Spins:`);
            this.remainingFsLabel_Count.setText(`${count}`);
        }
        else{
            this.remainingFsLabel.setText(`Spins Left:`);
            this.remainingFsLabel_Count.setText(`${count}`);
        }
        //this.remainingFsLabel_Count.setVisible(this.isMobile);
        if (!this.isMobile && this.autoplay?.ensureRemainingSpinsDisplay) {
            this.autoplay.ensureRemainingSpinsDisplay(scene);
        }
    }

    public hideRemainingFreeSpinsLabel(scene?: GameScene): void {
        if (!this.remainingFsLabel || !this.remainingFsLabel_Count) return;
        this.remainingFsLabel.setVisible(false);
        this.remainingFsLabel_Count.setVisible(false);
        this.remainingFsLabel_Count.setText(``);
        this.remainingFsLabel_Count.setVisible(false);
        // Hide the button when the label is hidden, unless autoplay indicator is visible or autoplay is running/paused for bonus
        try {
            const paused = scene ? !!(scene as any).gameData?.autoplayWasPaused : false;
            if (!this.autoplayIndicator?.visible && !this.autoplay?.isAutoPlaying && !paused) {
                this.freeSpinBtn.visible = false;
            }
        } catch (_e) {}
    }

    public hideBottomControlsForBonus(scene: GameScene, hidden: boolean): void {
        if (!this.buttonContainer) return;
        // On desktop, never hide bottom controls during free spins
        if (!this.isMobile) {
            hidden = false;
        }
        const setVisibleByName = (name: string, visible: boolean) => {
            const child = this.buttonContainer.list.find(c => (c as any).name === name) as ButtonContainer | undefined;
            if (child) child.setVisible(visible);
        };
        setVisibleByName('spinContainer', !hidden);
        setVisibleByName('turboContainer', !hidden);
        setVisibleByName('doubleFeatureContainer', !hidden);
        setVisibleByName('autoplayContainer', !hidden);
        // Mobile: keep volume/settings visible even when hiding; Desktop: follow hidden flag
        setVisibleByName('settingsContainer', this.isMobile && hidden ? !hidden : true);
        // Desktop: also hide info button when hiding
        if (!this.isMobile) {
            setVisibleByName('infoContainer', !hidden);
        }

        // Emit Y-axis toggle events to move controls out/in
        Events.emitter.emit(Events.CREATE_TURBO_BUTTON, hidden);
        Events.emitter.emit(Events.CREATE_AUTOPLAY, hidden);
        Events.emitter.emit(Events.CREATE_SPIN_BUTTON, hidden);
        Events.emitter.emit(Events.CREATE_DOUBLE_FEATURE, hidden);
        Events.emitter.emit(Events.CREATE_INFO, hidden);
    }

    private toggleTurbo(scene: GameScene): void {
        scene.audioManager.UtilityButtonSFX.play();
        
        // Only toggle if not currently spinning or wait for current spin to complete
        if (!scene.gameData.isSpinning) {
            this.turboButton.visible = !this.turboButton.visible;
            this.turboOnButton.visible = !this.turboOnButton.visible;
            scene.gameData.turbo = !scene.gameData.turbo;
        } else {
            // Queue the turbo toggle for after current spin completes
            const onSpinComplete = () => {
                this.turboButton.visible = !this.turboButton.visible;
                this.turboOnButton.visible = !this.turboOnButton.visible;
                scene.gameData.turbo = !scene.gameData.turbo;
                Events.emitter.off(Events.MATCHES_DONE, onSpinComplete); // Remove listener after use
            };
            Events.emitter.once(Events.MATCHES_DONE, onSpinComplete);
        }
    }

    private createTurboButton(scene: GameScene): void {
        const x = this.isMobile ? this.width * 0.915  : this.width * 0.88;
        const y = this.isMobile ? this.mobile_buttons_y : this.height * 0.29;
        const container = scene.add.container(x, y) as ButtonContainer;

        this.turboButton = scene.add.image(0, 0, 'turboButton') as ButtonImage;
        this.turboOnButton = scene.add.image(0, 0, 'turboOn') as ButtonImage;
        this.turboOnButton.visible = false;
            
        const width = this.turboButton.width * 0.75;
        const height = this.turboButton.height * 0.75;

        const innerCircle = scene.add.graphics();
        innerCircle.fillStyle(0x000000, 0.5);
        innerCircle.fillCircle(0, 0, width * 1.25);
        container.add(innerCircle);

        const border = scene.add.graphics();
        border.fillStyle(0x000000, 0.15);
        border.fillCircle(0, 0, width * 1.55);
        border.setVisible(this.isMobile ? false : true);

        container.add(border);

        this.turboButton.displayWidth = width;
        this.turboButton.displayHeight = height;
        this.turboOnButton.displayWidth = width * 3;
        this.turboOnButton.displayHeight = height * 2.25;
        this.turboButton.setInteractive().isButton = true;
        this.turboOnButton.setInteractive().isButton = true;
        container.add(this.turboButton);
        container.add(this.turboOnButton);
        
        container.name = 'turboContainer';
        container.setScale(this.isMobile ? 0.3 : 1);
        this.turboOnButton.setScale(this.isMobile ? 0.9 : 1);

        
        if(this.isMobile){
            const turboText = scene.add.text(0, 50,
                'Turbo',
                {
                    fontSize: '12px',
                    color: '#FFFFFF',
                    fontFamily: 'Poppins',
                    align: 'center'
                }
            );
            turboText.setOrigin(0.5, 0); // Center horizontally, top align vertically
            turboText.setScale(2);
            container.add(turboText);
        }

        container.setScale(this.isMobile ? 0.475 : 1);
        this.buttonContainer.add(container);
        // Record base Y and hook Y-axis toggle event
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_TURBO_BUTTON, (hidden?: boolean) => {
            if (!container) return;
            const baseY = this.baseYPositions['turboContainer'] ?? container.y;
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            // Fallback to direct set if tween cannot be created
            try {
                scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
            } catch (_e) {
                (container as any).y = targetY;
            }
        });

        container.setInteractive(
            new Geom.Circle(0, 0, width * 1.25), 
            Geom.Circle.Contains
        ).isButton = true;

        container.on('pointerdown', () => {
            this.toggleTurbo(scene);
        });

        this.turboButton.on('pointerdown', () => {
            this.toggleTurbo(scene);
        });

        this.turboOnButton.on('pointerdown', () => {
            this.toggleTurbo(scene);
        });
        
            
    }

    
    private setupKeyboardInput(scene: GameScene): void {
        // Add spacebar key handler for spinning
        scene.input.keyboard?.on('keydown-SPACE', () => {
            // Don't allow spin if currently spinning, win overlay is active, or help screen is visible
            
        if(scene.gameData.isBonusRound) return;
            if (scene.gameData.isSpinning || 
                scene.slotMachine.activeWinOverlay || 
                scene.gameData.isHelpScreenVisible ||
                this.isVisuallyDisabled) {
                return;
            }

            // Local check: ensure enough balance before initiating spin via keyboard
            if (!this.hasSufficientBalance(scene)) {
                console.log('[INPUT] Spacebar blocked: insufficient balance');
                Events.emitter.emit(Events.SHOW_INSUFFICIENT_BALANCE);
                return;
            }

            // IMMEDIATELY disable buttons visually for instant feedback (don't touch game logic)
            this.disableButtonsVisually(scene);


            // If autoplay is active, stop it
            if (scene.buttons.autoplay.isAutoPlaying) {
                scene.buttons.autoplay.stop();
                scene.buttons.resetAutoplayButtons();
                Events.emitter.emit(Events.AUTOPLAY_STOP); 
            }

            // Play spin sound
            scene.audioManager.SpinSFX.play();

            // Reset total win for new spin
            scene.gameData.totalWin = 0;
            Events.emitter.emit(Events.WIN, {});

            // Trigger spin (will be handled by the sequential system)
            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values
            });
        });
    }

    private spinAnimationOnce() {
        
        this.spinAnimation.setAlpha(1)
        this.spinAnimation.animationState.setAnimation(0, 'animation', false);
        this.spinAnimation.animationState.addListener({
            complete: () => {
                this.spinAnimation.setAlpha(0);
            }
        });
    }

    private createSpinButton(scene: GameScene): void {
        const x = this.isMobile ? this.width * 0.5 : this.width * 0.88;
        const y = this.isMobile ? this.mobile_buttons_y : this.height * 0.443;
        const container = scene.add.container(x, y) as ButtonContainer;
        
        this.spinButton = scene.add.image(0, 0, 'spinButton') as ButtonImage;
        const width = this.isMobile ? this.spinButton.width / 3.25 : this.spinButton.width * 0.75;
        const height = this.isMobile ? this.spinButton.height / 3.25 : this.spinButton.height * 0.75;

        this.freeSpinBtn = scene.add.image(0, 0, 'greenCircBtn') as ButtonImage;
        this.autoplayIndicator = scene.add.image(0, 0, 'autoplayIndicator') as ButtonImage;

        const widthgcb = this.isMobile ? this.freeSpinBtn.width / 2.5 : this.freeSpinBtn.width * 0.9;
        const heightgcb = this.isMobile ? this.freeSpinBtn.height / 2.5 : this.freeSpinBtn.height * 0.9;

        const spinButtonBackgroundCircle = scene.add.graphics();
        spinButtonBackgroundCircle.fillStyle(0x000000, 0.15);
        spinButtonBackgroundCircle.setVisible(this.isMobile ? false : true);
        const spinCircleRadius = width * 0.57;
        spinButtonBackgroundCircle.fillCircle(0, 0, spinCircleRadius);

        container.add(spinButtonBackgroundCircle);

        this.spinButton.displayWidth = width;
        this.spinButton.displayHeight = height;
        this.spinButton.setInteractive().isButton = true;
        container.add(this.spinButton);

        this.freeSpinBtn.displayWidth = widthgcb;
        this.freeSpinBtn.displayHeight = heightgcb;
        this.freeSpinBtn.setInteractive().isButton = true;

        this.autoplayIndicator.displayWidth = widthgcb;
        this.autoplayIndicator.displayHeight = heightgcb;
        this.autoplayIndicator.setInteractive().isButton = true;
        this.autoplayIndicator.setScale(0.95, 0.95);
        if(this.isMobile) {
            this.autoplayIndicator.setScale(0.4, 0.4);
        }
        
        container.add(this.freeSpinBtn);
        container.add(this.autoplayIndicator);

        container.name = 'spinContainer';
        
        setTimeout(() => { // suspend creation after everything else
            const spineObject = scene.add.spine(0, 0, 'button_animation_idle', 'button_animation_idle') as SpineGameObject;
            // Position relative to the container center
            spineObject.setPosition(0, 0);
            spineObject.setOrigin(0.4, 1.20);
            spineObject.setAlpha(0);
            spineObject.setScale(this.isMobile ? 1.4 : 3.3);
            // Ensure it renders above the spin button within the same container
            container.add(spineObject);
            container.bringToTop(spineObject);
            // Loop idle animation
            this.spinAnimation = spineObject;
        }, 10);

        this.buttonContainer.add(container);
        // Record base Y and hook Y-axis toggle event
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_SPIN_BUTTON, (hidden?: boolean) => {
            if (!container) return;
            const baseY = this.baseYPositions['spinContainer'] ?? container.y;
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            try {
                scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
            } catch (_e) {
                (container as any).y = targetY;
            }
        });
        // Record base Y and hook Y-axis toggle event
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_SPIN_BUTTON, (hidden: boolean) => {
            const baseY = this.baseYPositions['spinContainer'];
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
        });

        const startIdleRotation = () => {
            this.startIdleAnimation(scene);
        };

        startIdleRotation();
        const stopIdleRotation = () => {
            this.stopIdleAnimation();
        };

        const canIdleRotate = () => {
            return !scene.gameData.isSpinning && !this.autoplay.isAutoPlaying;
        };

        const updateSpinButtonState = () => {
            // Use centralized button state management
            this.updateButtonStates(scene);
        };

        // Pause/resume idle rotation during win overlay
        Events.emitter.on(Events.WIN_OVERLAY_SHOW, () => {
            stopIdleRotation();
        });
        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            if (canIdleRotate()) {
                startIdleRotation();
            }
        });

        const spinAction = () => {
            // Don't allow spin if currently spinning or win overlay is active or local flag is set
            const now = Date.now();
            const lockActive = now < ((scene as any).gameData?.freeSpinLockUntilMs || 0);
            if (lockActive) {
                try {
                    this.spinButton.setAlpha(0.5);
                    this.spinButton.disableInteractive();
                } catch (_e) {}
            }
            if (lockActive || this.spinInProgress || scene.gameData.isSpinning || scene.slotMachine.activeWinOverlay || this.isVisuallyDisabled) {
                return;
            }
            // Guard again right before spin is emitted (keyboard path already checked too)
            if (!this.hasSufficientBalance(scene)) {
                console.log('[SPIN] Blocked in spinAction: insufficient balance');
                Events.emitter.emit(Events.SHOW_INSUFFICIENT_BALANCE);
                return;
            }
            this.spinInProgress = true; // Set local flag immediately
            // IMMEDIATELY disable buttons visually for instant feedback (don't touch game logic)
            this.disableButtonsVisually(scene);

            // If autoplay is active, stop it
            if (this.autoplay.isAutoPlaying) {
                this.autoplay.stop();
                this.resetAutoplayButtons();
                Events.emitter.emit(Events.AUTOPLAY_STOP);
            }

            // Reset total win for new spin
            scene.gameData.totalWin = 0;
            Events.emitter.emit(Events.RESET_WIN, {});

            // Trigger spin (will be handled by the sequential system)
            Events.emitter.emit(Events.SPIN, {
                currentRow: scene.gameData.currentRow,
                symbols: scene.gameData.slot.values
            });
        };

        this.spinButton.on('pointerdown', () => {
            if (this.spinInProgress) return; // Double check
            if(scene.gameData.isSpinning) return;
            // Local check: ensure enough balance before initiating spin
            if (!this.hasSufficientBalance(scene)) {
                console.log('[INPUT] Spin click blocked: insufficient balance');
                Events.emitter.emit(Events.SHOW_INSUFFICIENT_BALANCE);
                return;
            }
            scene.audioManager.SpinSFX.play();
            this.spinAnimationOnce();
            spinAction();
        });

        this.freeSpinBtn.on('pointerdown', ()=>{});
        this.freeSpinBtn.visible=false;
        this.autoplayIndicator.visible=false;
        // Make autoplayIndicator act as a stop button during autoplay
        this.autoplayIndicator.on('pointerdown', () => {
            if (!this.autoplay || !this.autoplay.isAutoPlaying) return;
            scene.audioManager.UtilityButtonSFX.play();
            Events.emitter.emit(Events.AUTOPLAY_STOP);
        });

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            stopIdleRotation();
            updateSpinButtonState();
        });

        Events.emitter.on(Events.MATCHES_DONE, () => {
            updateSpinButtonState();
            if (canIdleRotate()) {
                startIdleRotation();
            }
        });

        Events.emitter.on(Events.SPIN_ANIMATION_END, () => {
            updateSpinButtonState();
        });

        // Listen for win overlay state changes
        Events.emitter.on(Events.WIN_OVERLAY_SHOW, () => {
            updateSpinButtonState();
        });

        Events.emitter.on(Events.WIN_OVERLAY_HIDE, () => {
            updateSpinButtonState();
        });

        // Initial state
        updateSpinButtonState();
        // Ensure initial alpha pairing: spin shown, FS hidden
        try { this.spinButton.setAlpha(1); } catch (_e) {}
        try { this.freeSpinBtn.setAlpha(0); } catch (_e) {}
        if (canIdleRotate()) {
            startIdleRotation();
        }

        // Listen for spin state changes to re-enable the button
        const resetSpinButton = () => {
            this.spinInProgress = false;
            const transitioningToFreeSpins = !!((scene as any)?.slotMachine?.bonusTriggeredThisSpin) && !scene.gameData.isBonusRound;
            // Re-enable other controls, but keep spin visually disabled during FS transition window
            this.enableButtonsVisually(scene);
            if (transitioningToFreeSpins) {
                try {
                    this.spinButton.setAlpha(0.5);
                    this.spinButton.disableInteractive();
                } catch (_e) {}
            }
        };
        // Only re-enable after the entire spin (including tumbles) is done
        Events.emitter.on(Events.MATCHES_DONE, resetSpinButton);
    }
    private autoPlay_Y : number = 0;
    private createAutoplay(scene: GameScene): void {
        const x = this.isMobile ? this.width * 0.28 : this.width * 0.88;
        const y = this.isMobile ? this.mobile_buttons_y : this.height * 0.598;
        const radius = 60;
        const padding = 32; 
        const textPadding = 4;

        const container = scene.add.container(x, y) as ButtonContainer;

        this.autoplayButton = scene.add.image(0, 0, 'autoplayButton') as ButtonImage;
        this.autoplayOnButton = scene.add.image(0, 0, 'autoplayOn') as ButtonImage;
        this.autoplayButton.setScale(this.isMobile ? 0.7 : 1);
        this.autoplayOnButton.setScale(this.isMobile ? 0.4 : 1);
        
        const innerCircle = scene.add.graphics();
        innerCircle.fillStyle(0x000000, 0.5);
        innerCircle.fillCircle(0, 0, radius * (this.isMobile ? 0.514 : 0.78));
        container.add(innerCircle);

        const outerCircle = scene.add.graphics();
        outerCircle.fillStyle(0x000000, 0.15);
        outerCircle.fillCircle(0, 0, radius * (this.isMobile ? 0.675 : 0.95));
        outerCircle.setVisible(this.isMobile ? false : true);
        container.add(outerCircle);

        this.autoplayButton.setInteractive().isButton = true;
        this.autoplayOnButton.setInteractive().isButton = true;
        this.autoplayOnButton.setScale(this.isMobile ? 0.7 : 1.1);

        container.add(this.autoplayButton);
        container.add(this.autoplayOnButton);
        this.autoplayOnButton.visible = false;

        this.buttonContainer.add(container);
        // Record base Y and hook Y-axis toggle event
        container.name = 'autoplayContainer';
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_AUTOPLAY, (hidden?: boolean) => {
            if (!container) return;
            const baseY = this.baseYPositions['autoplayContainer'] ?? container.y;
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            try {
                scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
            } catch (_e) {
                (container as any).y = targetY;
            }
        });

        // --- AUTOPLAY SETTINGS POPUP ---
        const popupWidth = this.isMobile ? scene.scale.width : 466 ;
        const popupHeight = 722;
        const popup = scene.add.container(
            this.isMobile ? 0  : scene.scale.width / 2 - popupWidth / 2,
            this.isMobile ? scene.scale.height / 2 - popupHeight * (1 - popupHeight/scene.scale.height * .75): scene.scale.height / 2 - popupHeight / 2);
        popup.setDepth(1000);
        popup.setVisible(false);
        popup.setScale(this.isMobile ? 1 : 1);

        // Store popup reference for external access
        this.autoplayPopup = popup;
        this.autoPlay_Y = popup.y;

        // Popup background
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.lineStyle(0, 0x66D449, 1);
        bg.strokeRoundedRect(0, 0, popupWidth, this.isMobile ? popupHeight * 2 : popupHeight, 16);
        bg.fillRoundedRect(0, 0, popupWidth, this.isMobile ? popupHeight * 2 : popupHeight, 16);
        popup.add(bg);
        
        // Add blur effect if available
        if ((scene.sys.game.renderer as any).pipelines) {
            bg.setPipeline('BlurPostFX');
        }

        // Title
        const title = scene.add.text(padding, padding, 'AUTOPLAY SETTINGS', {
            fontSize: '24px',
            color: '#66D449',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });
        popup.add(title);

        // Close button
        const closeBtn = scene.add.text(popupWidth - padding * 2, padding, '×', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        (closeBtn as any as ButtonText).setInteractive().isButton = true;
        popup.add(closeBtn);

        // Balance section (enclosed in a rectangular box)
        const balanceBoxY = padding * 2;
        const balanceBoxHeight = 60;
        const balanceBoxWidth = popupWidth - padding * 2;
        const balanceBox = scene.add.graphics();
        balanceBox.fillStyle(0x000000, 0.5);
        balanceBox.lineStyle(1, 0x66D449, 0);
        balanceBox.fillRoundedRect(padding, balanceBoxY + balanceBoxHeight / 6, balanceBoxWidth, balanceBoxHeight, 10);
        balanceBox.strokeRoundedRect(padding, balanceBoxY + balanceBoxHeight / 6, balanceBoxWidth, balanceBoxHeight, 10);
        popup.add(balanceBox);

        const balanceLabel = scene.add.text(padding + 16, balanceBoxY + balanceBoxHeight * 2/3, 'Balance', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        balanceLabel.setOrigin(0, 0.5);
        popup.add(balanceLabel);

        const balanceValue = scene.add.text(padding + balanceBoxWidth - 16, balanceBoxY + balanceBoxHeight * 2/3,
            scene.gameData.currency + scene.gameData.balance.toLocaleString(), {
            fontSize: '24px',
            color: '#66D449',
            fontFamily: 'Poppins',
            align: 'center'
        });
        (balanceValue as any).setOrigin?.(1, 0.5);
        popup.add(balanceValue);

        // Number of autospins section
        const spinsLabelY = balanceBoxY + balanceBoxHeight + textPadding * 10;
        const spinsLabel = scene.add.text(padding, spinsLabelY, 'Number of autospins', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        popup.add(spinsLabel);

        // Spin options
        const spinOptions = [10, 30, 50, 75, 100, 150, 500, 1000];
        const buttonWidth = 88.5 * 0.9;
        const buttonHeight = 60;
        const spacing = this.isMobile ? 16 : 28;
        let selectedSpins = spinOptions[0]; // Set default to first option
        let selectedButton: GameObjects.Container | null = null;

        const buttons = spinOptions.map((spins, index) => {
            const row = Math.floor(index / 4);
            const col = index % 4;
            const x = padding + col * (buttonWidth + spacing);
            const y = spinsLabel.y + spinsLabel.height + padding + row * (buttonHeight + spacing);

            const buttonContainer = scene.add.container(x, y);

            // Button background
            const buttonBg = scene.add.graphics();
            buttonBg.fillStyle(index === 0 ? 0x66D449 : 0x181818, 1); // Highlight first button by default
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            buttonContainer.add(buttonBg);

            // Button text
            const text = scene.add.text(buttonWidth/2, buttonHeight/2, spins.toString(), {
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold'
            });
            text.setOrigin(0.5);
            buttonContainer.add(text);

            // Make button interactive
            const hitArea = new Geom.Rectangle(0, 0, buttonWidth, buttonHeight);
            buttonContainer.setInteractive(hitArea, Geom.Rectangle.Contains);
            (buttonContainer as any).isButton = true;

            buttonContainer.on('pointerdown', () => {
                scene.audioManager.UtilityButtonSFX.play();
                
                // Deselect previous button
                if (selectedButton) {
                    const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                    prevBg.clear();
                    prevBg.fillStyle(0x181818, 1);
                    prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                }
                
                // Select this button
                buttonBg.clear();
                buttonBg.fillStyle(0x66D449, 1);
                buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                selectedButton = buttonContainer;
                selectedSpins = spins;

                // Update total bet display
                updateBetDisplay();
            });

            popup.add(buttonContainer);
            return buttonContainer;
        });

        // Set initial selected button
        selectedButton = buttons[0];

        // Total bet section
        const betLabel = scene.add.text(padding, popupHeight / 2 + padding, 'BET', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        popup.add(betLabel);

        // Bet controls box
        const betBoxY = betLabel.y + betLabel.height + padding / 3;
        const betBoxHeight = 74;
        const betBoxWidth = popupWidth - padding * 2;
        const betBox = scene.add.graphics();
        betBox.fillStyle(0x333333, 0.8);
        betBox.lineStyle(1, 0x66D449, 1);
        betBox.fillRoundedRect(padding, betBoxY, betBoxWidth, betBoxHeight, 10);
        betBox.strokeRoundedRect(padding, betBoxY, betBoxWidth, betBoxHeight, 10);
        popup.add(betBox);

        const betValueY = betBoxY + betBoxHeight / 2;
        // Bet controls
        const minusBtn = scene.add.image(padding + 36, betValueY, 'minus');
        (minusBtn as any as ButtonImage).setInteractive().isButton = true;
        popup.add(minusBtn);

        let bet = scene.gameData.bet
        const betValue = scene.add.text(popupWidth / 2, betValueY, scene.gameData.currency + bet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'center'
        }) as ButtonText;
        betValue.setOrigin(0.5, 0.5);
        popup.add(betValue);

        const plusBtn = scene.add.image(padding + betBoxWidth - 36, betValueY, 'plus');
        (plusBtn as any as ButtonImage).setInteractive().isButton = true;
        popup.add(plusBtn);

        // Use same bet options as main bet controls
        const betOptionsPopup = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 5, 6, 8, 10, 14, 18, 24, 32 ,40, 60, 80, 100, 110 ,120, 130, 140, 150];
        let selectedBetIndexPopup = betOptionsPopup.indexOf(scene.gameData.bet);
        if (selectedBetIndexPopup === -1) {
            selectedBetIndexPopup = 0;
        }
        const EPS_POP = 1e-6;
        const findPopupBetIndexByValue = (val: number) => betOptionsPopup.findIndex(v => Math.abs(v - val) < EPS_POP);
        const popupAtMin = (val: number) => (val <= betOptionsPopup[0] + EPS_POP);
        const popupAtMax = (val: number) => (val >= betOptionsPopup[betOptionsPopup.length - 1] - EPS_POP);

        // helper to update +/- state at min/max
        const updatePopupBetButtonsState = () => {
            // derive from actual value
            const atMin = popupAtMin(scene.gameData.bet);
            const atMax = popupAtMax(scene.gameData.bet);
            if (atMin) {
                (minusBtn as any).setAlpha?.(0.3);
                (minusBtn as any).disableInteractive?.();
            } else {
                (minusBtn as any).setAlpha?.(0.8);
                (minusBtn as any).setInteractive?.();
            }
            if (atMax) {
                (plusBtn as any).setAlpha?.(0.3);
                (plusBtn as any).disableInteractive?.();
            } else {
                (plusBtn as any).setAlpha?.(0.8);
                (plusBtn as any).setInteractive?.();
            }
        };

        plusBtn.on('pointerdown', () => {
            const idx = findPopupBetIndexByValue(scene.gameData.bet);
            if (idx >= 0 && idx < betOptionsPopup.length - 1) {
                scene.audioManager.UtilityButtonSFX.play();
                selectedBetIndexPopup = idx + 1;
                scene.gameData.bet = betOptionsPopup[selectedBetIndexPopup];
                updateBetDisplay();
                updatePopupBetButtonsState();
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        });

        minusBtn.on('pointerdown', () => {
            const idx = findPopupBetIndexByValue(scene.gameData.bet);
            if (idx > 0) {
                scene.audioManager.UtilityButtonSFX.play();
                selectedBetIndexPopup = idx - 1;
                scene.gameData.bet = betOptionsPopup[selectedBetIndexPopup];
                updateBetDisplay();
                updatePopupBetButtonsState();
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        });

        function updateBetDisplay() {
            const autoplayCost = scene.gameData.bet// * selectedSpins;
            betValue.setText(scene.gameData.currency + " " + autoplayCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
        updateBetDisplay();
        updatePopupBetButtonsState();

        // Start Autoplay button - moved down to avoid overlap
        const startBtnBg = scene.add.image(popupWidth / 2, 0, 'greenLongBtn');
        startBtnBg.displayWidth = 402;
        startBtnBg.displayHeight = 62;
        // Add additional spacing below the bet box
        const startBtnYOffset = 24; // extra space below content
        startBtnBg.setPosition(popupWidth / 2, popupHeight - padding *3 - startBtnBg.displayHeight/2 - startBtnYOffset);
        startBtnBg.setOrigin(0.5, 0.5);
        popup.add(startBtnBg);

        const startBtnText = scene.add.text(popupWidth / 2, startBtnBg.y, 'START AUTOPLAY', {
            fontSize: '28px',
            color: '#000000',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });
        startBtnText.setOrigin(0.5, 0.5);
        popup.add(startBtnText);

        (startBtnBg as any as ButtonImage).setInteractive().isButton = true;
        startBtnBg.on('pointerdown', () => {
            if (selectedSpins > 0) {
                this.autoplayIndicator.setAlpha(1);
                scene.audioManager.UtilityButtonSFX.play();

                this.autoplayButton.visible = false;
                this.autoplayOnButton.visible = true;
                
                scene.tweens.add({
                    targets: popup,
                    y: {from: popup.y, to: popup.y + 1500},
                    duration: 1000,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        popup.setVisible(false);
                        popup.list.forEach(item => {
                            if(item instanceof GameObjects.Graphics && item.name === 'betMask') {
                                item.destroy();
                            }
                        });
                    }
                });
                
                scene.gameData.debugLog("autoplay.isAutoPlaying", this.autoplay.isAutoPlaying);
                // Start autoplay 
                Events.emitter.emit(Events.AUTOPLAY_START, selectedSpins);

            }
        });

        closeBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            
            scene.tweens.add({
                targets: popup,
                alpha: 0,
                y: { from: this.autoPlay_Y, to: this.autoPlay_Y + 1000},
                duration: 500,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    popup.setVisible(false);
                    popup.list.forEach(item => {
                        if(item instanceof GameObjects.Graphics) {
                            item.destroy();
                        }
                    });
                }
            });
        });

        // Update balance display when popup is shown
        const updateBalance = () => {
                const balance = scene.gameData.balance;
            balanceValue.setText(scene.gameData.currency + balance.toLocaleString());
        };

        // Show popup when autoplay button is pressed
        this.autoplayButton.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            
            // Close buy feature popup if open
            if (scene.buyFeaturePopup && scene.buyFeaturePopup.isVisible()) {
                scene.buyFeaturePopup.hide(scene);
            }

            this.hideBetPopup(scene);
            updateBalance();
            bet = scene.gameData.bet * selectedSpins;
            updateBetDisplay();
            try { (updatePopupBetButtonsState as any)(); } catch (_e) {}
            
            const mask = scene.add.graphics();
            mask.name = 'betMask';
            mask.fillStyle(0x000000, 0.7); // Black with 0.7 opacity
            mask.fillRect(0, 0, scene.scale.width, scene.scale.height);
            mask.setInteractive(new Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height), Geom.Rectangle.Contains);
            mask.on('pointerdown', () => {
                scene.tweens.add({
                    targets:popup,
                    y: { from: this.autoPlay_Y, to: this.autoPlay_Y + 1000},
                    duration: 500,
                    ease:'Expo.easeOut',
                    onComplete: () =>{
                        popup.setVisible(false);
                    }
                });
                popup.list.forEach(item => {
                    if(item instanceof GameObjects.Graphics && item.name === 'betMask') {
                        item.destroy();
                    }
                });
            });
            mask.setScale(this.isMobile ? 2.5 : 1);
            mask.setPosition(
                this.isMobile ? - popupWidth / 2 : -popup.x,
                this.isMobile ? - popupHeight * 1.25: -popup.y); // Adjust position relative to container
                
            popup.add(mask);
            popup.sendToBack(mask); // Ensure mask is behind other elements
            scene.tweens.add({
                targets: mask,
                alpha: {from: 0, to: 0.01}
            });
            popup.setVisible(true);
            popup.alpha = 0;
            scene.tweens.add({
                targets: popup,
                alpha: {from:0, to:1},
                y:{ from: this.autoPlay_Y + 1000, to: this.autoPlay_Y},
                duration: 500,
                ease: 'Expo.easeOut'
            });
        });

        this.autoplayOnButton.on('pointerdown', () => {
            // If bonus is triggered and autoplay is paused for bonus, ignore stop clicks
            if ((scene as any).gameData?.autoplayWasPaused) {
                return;
            }
            scene.audioManager.UtilityButtonSFX.play();
            Events.emitter.emit(Events.AUTOPLAY_STOP);
        });

        // Listen for autoplay complete
        Events.emitter.on(Events.AUTOPLAY_COMPLETE, () => {
            this.autoplayButton.visible = true;
            this.autoplayOnButton.visible = false;
        });

        if(this.isMobile){
            const autoplayText = scene.add.text(0, 30,
                'Autoplay',
                {
                    fontSize: '12px',
                    color: '#FFFFFF',   
                    fontFamily: 'Poppins',
                    align: 'center'
                }
            );
            autoplayText.setOrigin(0.5, 0); // Center horizontally, top align vertically
            container.add(autoplayText);
        }
        //this.buttonContainer.add(popup);
    }
    
    public resetAutoplayButtons(): void {
        this.autoplayButton.visible = true;
        this.autoplayOnButton.visible = false;
        this.freeSpinBtn.visible = false;
        this.autoplayIndicator.visible = false;
        if (this.spinButton) { this.spinButton.setAlpha(1); }
    }

    // Centralized method to immediately update button states
    public updateButtonStates(scene: GameScene): void {
		const gameLogicDisabled = scene.gameData.isSpinning || scene.slotMachine.activeWinOverlay;
		const shouldDisable = this.isVisuallyDisabled || gameLogicDisabled;
		
		// Buy feature has additional logic - also disabled during autoplay and bonus round
		const buyFeatureShouldDisable = shouldDisable || this.autoplay.isAutoPlaying || scene.gameData.isBonusRound;
		
		// Compute new enabled states for transition detection
		const spinEnabledNow = !shouldDisable;
		const buyFeatureEnabledNow = !buyFeatureShouldDisable;
		
		// Update spin button
		if (shouldDisable) {
			this.spinButton.setAlpha(0.5);
			this.spinButton.disableInteractive();
		} else {
			this.spinButton.setAlpha(1);
			this.spinButton.setInteractive();
		}
		
		// Update autoplay button
		if (this.autoplayButton) {
			if (shouldDisable) {
				this.autoplayButton.setAlpha(0.5);
				this.autoplayButton.disableInteractive();
			} else {
				this.autoplayButton.setAlpha(1);
				this.autoplayButton.setInteractive();
			}
		}
		 
		// Update buy feature button (visual and interactive state)
		if (this.buyFeatureButton) {
			this.buyFeatureButton.setAlpha(buyFeatureShouldDisable ? 0.8 : 1);
			if (buyFeatureShouldDisable) {
				(this.buyFeatureButton as any).disableInteractive?.();
			} else {
				(this.buyFeatureButton as any).setInteractive?.();
			}
		}
		if (this.buyFeaturePriceText) {
			this.buyFeaturePriceText.setAlpha(buyFeatureShouldDisable ? 0.5 : 1);
		}
		if (this.buyFeatureButtonText) {
			this.buyFeatureButtonText.setAlpha(buyFeatureShouldDisable ? 0.5 : 1);
		}
		if (this.buyFeatureStarLeft) {
			this.buyFeatureStarLeft.setAlpha(buyFeatureShouldDisable ? 0.5 : 1);
		}
		if (this.buyFeatureStarRight) {
			this.buyFeatureStarRight.setAlpha(buyFeatureShouldDisable ? 0.5 : 1);
		}
		
		// Trigger a short "ready" visual when transitioning from disabled->enabled
		if (spinEnabledNow && !this.wasSpinEnabled) {
			this.playReadyCue(scene, this.spinButton);
		}
		if (buyFeatureEnabledNow && !this.wasBuyFeatureEnabled && this.buyFeatureButton) {
			this.playReadyCue(scene, this.buyFeatureButton);
		}
		this.wasSpinEnabled = spinEnabledNow;
		this.wasBuyFeatureEnabled = buyFeatureEnabledNow;
    }

    // Method to immediately disable buttons visually (separate from game logic)
    public disableButtonsVisually(scene: GameScene): void {
        this.isVisuallyDisabled = true;
        this.updateButtonStates(scene);
    }

    // Method to re-enable buttons visually
    public enableButtonsVisually(scene: GameScene): void {
        this.isVisuallyDisabled = false;
        this.updateButtonStates(scene);
    }

	// Subtle visual cue to indicate a button is ready to be pressed again
	private playReadyCue(scene: GameScene, target: any): void {
		try {
			const originalScaleX = target.scaleX ?? target.scale ?? 1;
			const originalScaleY = target.scaleY ?? target.scale ?? 1;
			scene.tweens.add({
				targets: target,
				scaleX: originalScaleX * 1,
				scaleY: originalScaleY * 1,
				duration: 120,
				yoyo: true,
				repeat: 1,
				ease: 'Sine.easeOut'
			});
		} catch (_e) {
			// no-op
		}
	}

    private createInfo(scene: GameScene): void {
        const x = this.isMobile ? this.width * 0.12 : this.width * 0.88;
        const y = this.isMobile ? this.mobile_buttons_y : this.height * 0.70;


        const container = scene.add.container(x, y) as ButtonContainer;

        const infoButton = scene.add.image(0, 0, 'info') as ButtonImage;
        const infoOnButton = scene.add.image(0, 0, 'infoOn') as ButtonImage;
        infoOnButton.visible = false;

        const width = infoButton.width * 0.6;
        const height = infoButton.height * 0.6;

        // inner circle
        const innerCircle = scene.add.graphics();
        innerCircle.fillStyle(0x000000, 0.5);
        innerCircle.fillCircle(0, 0, this.isMobile ? width * 1.75 : width * 1.875);
        container.add(innerCircle);

        // outer circle
        const border = scene.add.graphics();
        border.fillStyle(0x000000, 0.15);
        border.fillCircle(0, 0, width * 2.25);
        border.setVisible(this.isMobile ? false : true);
        container.add(border);

        infoButton.displayWidth = width * .8;
        infoButton.displayHeight = height * .8;
        
        infoOnButton.displayWidth = width * 4.5 * .8;
        infoOnButton.displayHeight = height * 2.25 * .8;

        infoButton.setInteractive().isButton = true;
        infoOnButton.setInteractive().isButton = true;
        container.add(infoButton);
        container.add(infoOnButton);

        container.setScale(this.isMobile ? 0 : 1);
        container.name = 'infoContainer';
        this.buttonContainer.add(container);
        // Record base Y and hook Y-axis toggle event
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_INFO, (hidden?: boolean) => {
            if (!container) return;
            const baseY = this.baseYPositions['infoContainer'] ?? container.y;
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            try {
                scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
            } catch (_e) {
                (container as any).y = targetY;
            }
        });

        container.setInteractive(
            new Geom.Circle(0, 0, width * 1.25 / 0.8),
            Geom.Circle.Contains
        ).isButton = true;

        const toggleInfo = () => {
            scene.audioManager.UtilityButtonSFX.play();
            this.hideBetPopup(scene);
            
            scene.gameData.isHelpScreenVisible = !scene.gameData.isHelpScreenVisible;
        };

        container.on('pointerdown', toggleInfo);
        infoButton.on('pointerdown', toggleInfo);
        infoOnButton.on('pointerdown', toggleInfo);

        // Listen for help screen toggle event
        Events.emitter.on(Events.HELP_SCREEN_TOGGLE, () => {
            // Update button state based on help screen visibility
            toggleInfo();
        });
    }

    private createBalance(scene: GameScene): void {
        const width = Buttons.PANEL_WIDTH * 1.5;
        const x = this.isMobile ? this.width * 0.05 : this.width * 0.24;
        const y = this.isMobile ? this.height * 0.715  : this.height * 0.83;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;

        // Create a gradient texture for balance
        const gradientTexture = scene.textures.createCanvas('balanceGradient', this.isMobile ? width / 1.5 : width, Buttons.PANEL_HEIGHT);
        if (gradientTexture) {
            const context = gradientTexture.getContext();
            const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, this.isMobile ? width / 1.5 : width, Buttons.PANEL_HEIGHT);
            gradientTexture.refresh();
        }

        // Create the background with gradient and border
        this.balance = scene.add.graphics();
        this.balance.fillStyle(0x000000, 0.5);
        this.balance.fillRoundedRect(0, 0, this.isMobile ? width / 1.5 : width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.balance.lineStyle(1, 0x66D449);
        this.balance.strokeRoundedRect(0, 0, this.isMobile ? width / 1.5 : width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.balance);

        const text1 = scene.add.text(this.isMobile ? width * 0.5 / 1.5 : width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BALANCE', {
            fontSize: '25px',
            color: '#3FFF0D',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        text1.setScale(this.isMobile ? 1.1 : 1);
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        const balance = scene.gameData.balance;
        const balanceString = balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const text2 = scene.add.text(this.isMobile ? width * 0.5 / 1.5 : width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${balanceString}`, {
            fontSize: '35px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        text2.setScale(this.isMobile ? 0.9 : 1);
        container.add(text2);
        text2.setOrigin(0.5, 0.5);

        // Add demo label below the balance
        const demoLabel = scene.add.text(this.isMobile ? width * 0.5 / 1.5 : width * 0.5, Buttons.PANEL_HEIGHT * 0.9, 'demo credits only', {
            fontSize: '16px',
            color: '#FFFFFF',
            align: 'center',
            fontFamily: 'Poppins'
        }) as ButtonText;
        demoLabel.setOrigin(0.5, 0.5);
        demoLabel.setAlpha(0.8);
        const isDemo = (typeof window !== 'undefined') && !!((window as any)?.APP_CONFIG?.demo);
        demoLabel.setVisible(isDemo);
        container.add(demoLabel);

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            //Events.emitter.emit(Events.UPDATE_BALANCE);            
        });

        Events.emitter.on(Events.WIN, (data: any) => {
            if(!data)
            {
                console.error("balance updated");
                Events.emitter.emit(Events.UPDATE_BALANCE);
            }
        });

        Events.emitter.on(Events.UPDATE_BALANCE, () => {
            console.error("balance updated");
            try{
                scene.gameAPI.getBalance().then((data) => {
                    console.log("balance", data);
                    const balance = data.data.balance;
                        text2.setText(scene.gameData.currency + " " + balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); 
                    // console.log("update balance " + balance);

                    scene.gameData.balance = parseFloat(balance);
                });
            } catch(error) {
                // console.log("error updating balance " + error);
                text2.setText(scene.gameData.currency + " " + scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            }
        });

        Events.emitter.on(Events.UPDATE_FAKE_BALANCE, (reduce: number, increase: number) => {
            scene.gameData.balance -= reduce;
            scene.gameData.balance += increase;
            console.error("fake balance updated> reduce:" + reduce + " increase:" + increase + " = balance:" +  scene.gameData.balance);
            text2.setText(scene.gameData.currency + " " + scene.gameData.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        });

        container.setScale(this.isMobile ? 0.5 : 1);
        this.balanceContainer = container;
        this.buttonContainer.add(container);

        Events.emitter.emit(Events.UPDATE_BALANCE);
    }

    private createBombWin(scene: GameScene){

    }

    private createTotalWin(scene: GameScene): void {
        const width =  Buttons.PANEL_WIDTH * 1.5; 
        const x = this.isMobile ? this.balanceContainer.x + width * 0.525 : this.balanceContainer.x + width + this.width * 0.01;
        const y = this.isMobile ? this.balanceContainer.y : this.balanceContainer.y;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;
        // Desktop: original depth 4, Mobile: slightly higher to avoid overlap with slot bg
        container.setDepth(this.isMobile ? 6 : 4);

        // Create a gradient texture for totalWin
        const gradientTexture = scene.textures.createCanvas('totalWinGradient', width, Buttons.PANEL_HEIGHT);
        if (gradientTexture) {
            const context = gradientTexture.getContext();
            const gradient = context.createLinearGradient(0, 0, 0, Buttons.PANEL_HEIGHT);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0.24)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.24)');
            context.fillStyle = gradient;
            context.fillRect(0, 0, width, Buttons.PANEL_HEIGHT);
            gradientTexture.refresh();
        }

        // Create the background with gradient and border
        this.totalWin = scene.add.graphics();
        this.totalWin.fillStyle(0x000000, 0.5);
        this.totalWin.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.totalWin.lineStyle(1, 0x66D449);
        this.totalWin.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.totalWin);

        const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'TOTAL WIN', {
            fontSize: '25px',
            color: '#3FFF0D',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        let totalWin = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const text2 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, `$ ${totalWin}`, {
            fontSize: '35px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        container.add(text2);
        text2.setOrigin(0.5, 0.5);

        // Queue-based incremental total win display (mirrors marquee processQueue, no "YOU WON" text)
        let totalWinCurrentTotal = 0;
        let totalWinQueue: number[] = [];
        let isProcessingTotalWinQueue = false;
        let multiplierApplied = false;

        const formatMoney = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const processTotalWinQueue = (isBomb?: boolean) => {
            if (isProcessingTotalWinQueue) return;
            isProcessingTotalWinQueue = true;

            let reelSpeed = scene.gameData.turbo ? 200 : 1000;

            const step = () => {
                if (totalWinQueue.length === 0) {
                    isProcessingTotalWinQueue = false;

                    // if (isBomb) {
                    //     const idx = Math.max(0, Math.min(scene.gameData.apiFreeSpinsIndex || 0, (scene.gameData.totalWinFreeSpin?.length || 1) - 1));
                    //     const arr = scene.gameData.totalWinFreeSpin || [];
                    //     totalWinCurrentTotal = arr.slice(0, i/d/x + 1).reduce((sum, v) => sum + (v || 0), 0);

                    //     if(idx == arr.length - 1){
                    //         totalWinCurrentTotal = scene.gameData.totalWin;
                    //     }
                    // }

                    text2.setText(`$ ${formatMoney(totalWinCurrentTotal)}`);
                    return;
                }
                const increment = totalWinQueue.shift() as number;
                totalWinCurrentTotal += increment || 0;
                
                text2.setText(`$ ${formatMoney(totalWinCurrentTotal)}`);
                scene.time.delayedCall(reelSpeed, step);
            };
            step();
        };

        Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
            // Reset only for base game; during free spins we keep stacking
            if (!scene.gameData.isBonusRound) {
                totalWinCurrentTotal = 0;
                totalWinQueue = [];
                isProcessingTotalWinQueue = false;
                multiplierApplied = false;
                text2.setText(`$ ${formatMoney(0)}`);
            }
        });

        // Incremental updates per match/tumble using queue
        Events.emitter.on(Events.UPDATE_TOTAL_WIN, (increment?: number, isBomb?: boolean) => {
            if (typeof increment === 'number' && !isNaN(increment)) {
                totalWinQueue.push(increment);
            } else {
                const diff = (scene.gameData.totalWin || 0) - totalWinCurrentTotal;
                if (diff > 0) totalWinQueue.push(diff);
            }
            processTotalWinQueue(isBomb);
        });

        // Apply multiplier exactly once when bombs explode (emits WIN with applyMultiplier flag)
        Events.emitter.on(Events.WIN, (data: any) => {
            if (data && data.applyMultiplier === true) {
                if (multiplierApplied) return;
                multiplierApplied = true;
                const activeMultiplier = (this.bonusMultiplier && this.bonusMultiplier > 1) ? this.bonusMultiplier : 1;
                const display = totalWinCurrentTotal * activeMultiplier;
                
                text2.setText(`$ ${formatMoney(display)}`);
                return;
            }
            if (!scene.gameData.isBonusRound && data && typeof data.win === 'number') {
                text2.setText(`$ ${formatMoney(totalWinCurrentTotal)}`);
            }
        });

        container.setScale(this.isMobile ? 0.5 : 1);
        this.totalWinContainer = container;
        this.totalWinContainer.setVisible(this.isMobile ? false : true);
        this.buttonContainer.add(container);
    }

    private amplifyBet: SpineGameObject;
    private amplifyBetAnimation(){
        this.amplifyBet.setAlpha(1);
        this.amplifyBet.animationState.setAnimation(0, 'animation', false);
        this.amplifyBet.animationState.addListener({
            complete: () => {
                this.amplifyBet.setAlpha(0);
            }
        });
    }
    

    private createBet(scene: GameScene): void {
        const width = this.isMobile ? Buttons.PANEL_WIDTH : Buttons.PANEL_WIDTH;
        const x = this.isMobile ? this.totalWinContainer.x * 1.3 : this.totalWinContainer.x + width * 1.5 + this.width * 0.01;
        const y = this.isMobile ? this.totalWinContainer.y : this.height * 0.83;
        const cornerRadius = 10;

        const container = scene.add.container(x, y) as ButtonContainer;
        // Desktop: original depth 4, Mobile: slightly higher
        container.setDepth(this.isMobile ? 6 : 4);
        const betOptions = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 5, 6, 8, 10, 14, 18, 24, 32 ,40, 60, 80, 100, 110 ,120, 130, 140, 150];
        const indexInit = localStorage.getItem('bet') ? betOptions.indexOf(parseFloat(localStorage.getItem('bet') || '1')) : 5;
        let selectedBetIndex = indexInit;
        const EPS = 1e-6;
        const findBetIndexByValue = (val: number) => betOptions.findIndex(v => Math.abs(v - val) < EPS);
        const isAtMinValue = (val: number) => (val <= betOptions[0] + EPS);
        const isAtMaxValue = (val: number) => (val >= betOptions[betOptions.length - 1] - EPS);

        // Create the background with gradient and border
        this.totalBet = scene.add.graphics();
        this.totalBet.fillStyle(0x000000, 0.5);
        this.totalBet.fillRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        this.totalBet.lineStyle(1, 0x66D449);
        this.totalBet.strokeRoundedRect(0, 0, width, Buttons.PANEL_HEIGHT, cornerRadius);
        container.add(this.totalBet);

        const text1 = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.3, 'BET', {
            fontSize: '25px',
            color: '#3FFF0D',
            align: 'center', 
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        text1.setScale(this.isMobile ? 1.1 : 1);
        container.add(text1);
        text1.setOrigin(0.5, 0.5);

        // Add bet value text under BET
        const betValueText = scene.add.text(width * 0.5, Buttons.PANEL_HEIGHT * 0.65, scene.gameData.currency + " " 
            + (scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), {
            fontSize: '32px',
            color: '#FFFFFF',
            align: 'center',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        }) as ButtonText;
        betValueText.setScale(this.isMobile ? 1.1 : 1);
        container.add(betValueText);
        betValueText.setOrigin(0.5, 0.5);

        // Amplify_Bet spine animation inside bet panel
        try {
            const amplifyAnim = scene.add.spine(width * 0.5, Buttons.PANEL_HEIGHT * 0.5, 'Amplify_Bet', 'Amplify_Bet') as SpineGameObject;
            amplifyAnim.setScale(this.isMobile ? 1.75 : 2.5);
            container.addAt(amplifyAnim, 0); // above background, behind texts
            amplifyAnim.setAlpha(0);

            this.amplifyBet = amplifyAnim;
            container.sendToBack(amplifyAnim);
        } catch (_e) {
            // ignore if spine not available
        }

        // plus button
        const plusBtn = scene.add.image(0, 0, 'plus') as ButtonImage;
        plusBtn.setPosition(betValueText.x + 90, betValueText.y - 5);
        //plusBtn.setScale(this.isMobile ? 0.25 : 0.3);
        
        plusBtn.setInteractive().isButton = true;
        container.add(plusBtn);

        // minus button
        const minusBtn = scene.add.image(0, 0, 'minus') as ButtonImage;
        minusBtn.setPosition(betValueText.x - 90, plusBtn.y);
        //minusBtn.setScale(this.isMobile ? 0.25 : 0.3);

        minusBtn.setInteractive().isButton = true;
        container.add(minusBtn);

        // Helper to enable/disable bet nav buttons at min/max
        const updateBetButtonsState = () => {
            // derive from actual bet value to avoid stale index
            const atMin = isAtMinValue(scene.gameData.bet);
            const atMax = isAtMaxValue(scene.gameData.bet);

            if (atMin) {
                minusBtn.setAlpha(0.25);
                (minusBtn as any).disableInteractive?.();
            } else {
                minusBtn.setAlpha(1);
                (minusBtn as any).setInteractive?.();
            }

            if (atMax) {
                plusBtn.setAlpha(0.25);
                (plusBtn as any).disableInteractive?.();
            } else {
                plusBtn.setAlpha(1);
                (plusBtn as any).setInteractive?.();
            }
        };

        // Clickable middle area to open bet popup
        const middleZone = scene.add.zone(width * 0.5, Buttons.PANEL_HEIGHT * 0.5, width * 0.5, Buttons.PANEL_HEIGHT * 0.6) as ButtonZone;
        (middleZone as any).setInteractive().isButton = true;
        middleZone.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            if(scene.gameData.isBonusRound) return;
            scene.audioManager.UtilityButtonSFX.play();
            selectedBetIndex = betOptions.indexOf(scene.gameData.bet);
            if (selectedBetIndex === -1) { selectedBetIndex = 0; }
            this.showBetPopup(scene, selectedBetIndex);
        });
        container.addAt(middleZone, 0);

        // Initialize +/- button states
        updateBetButtonsState();

        // bet container
        container.setScale(this.isMobile ? 0.5 : 1);

        // Add click handlers to show bet popup
        plusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            if(scene.gameData.isBonusRound) return;
            scene.audioManager.UtilityButtonSFX.play();

            const idx = findBetIndexByValue(scene.gameData.bet);
            if (idx >= 0 && idx < betOptions.length - 1) {
                scene.audioManager.UtilityButtonSFX.play();
                const nextIndex = idx + 1;
                scene.gameData.bet = betOptions[nextIndex];
                selectedBetIndex = nextIndex;
                updateBetButtonsState();
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        });

        minusBtn.on('pointerdown', () => {
            if(scene.gameData.isSpinning) return;
            if(scene.gameData.isBonusRound) return;

            const idx = findBetIndexByValue(scene.gameData.bet);
            if (idx > 0) {
                scene.audioManager.UtilityButtonSFX.play();
                const prevIndex = idx - 1;
                scene.gameData.bet = betOptions[prevIndex];
                selectedBetIndex = prevIndex;
                updateBetButtonsState();
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        });

        // Update bet value when it changes
        Events.emitter.on(Events.CHANGE_BET, () => {
            const totalBet = (scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            betValueText.setText(scene.gameData.currency + " " + totalBet);
            localStorage.setItem('bet', scene.gameData.bet.toString());
            updateBetButtonsState();
        });

        Events.emitter.on(Events.ENHANCE_BET_TOGGLE, (isBuy?:boolean) => {
            if(scene.gameData.doubleChanceEnabled) {
                betValueText.setText(scene.gameData.currency + (scene.gameData.bet * 1.25).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            } else {
                betValueText.setText(scene.gameData.currency + (scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            }
        });

        scene.gameData.bet = localStorage.getItem('bet') ? parseFloat(localStorage.getItem('bet') || '1') : 1;
        localStorage.setItem('bet', scene.gameData.bet.toString());
        try { (updateBetButtonsState as any)(); } catch (_e) {}

        container.name = 'betContainer';
        //this.buttonContainer.add(container);

        // Create bet adjustment popup
        const betContainer = scene.add.container(0, 0);
        betContainer.setScale(this.isMobile ? 1 : 1);
        betContainer.setDepth(30);
        const padding = 32;
        // Create bet background
        const betBg = scene.add.graphics();
        betBg.fillStyle(0x000000, 0.8);
        betBg.fillRoundedRect(0, 0, 403 + padding * 1.5, 912, 16);
        betBg.lineStyle(0, 0x66D449);
        betBg.strokeRoundedRect(0, 0, 403 + padding * 1.5, 912, 16);
        betContainer.add(betBg);

        // Title
        const titleText = scene.add.text(padding, padding, 'BET', {
            fontSize: '32px',
            color: '#3FFF0D',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'left'
        });
        betContainer.add(titleText);

        // Close button
        const closeBtn = scene.add.text(402 + padding, padding, '×', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        }) as ButtonText;
        closeBtn.setOrigin(1,0);
        closeBtn.setInteractive().isButton = true;
        betContainer.add(closeBtn);

        // Close button click handler
        closeBtn.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
            this.hideBetPopup(scene);
        });

        // Number of bets
        const selectSizeLabel = scene.add.text(padding, padding * 3, 'Select Bet Amount', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        betContainer.add(selectSizeLabel);

        const buttonWidth = 67.6;
        const buttonHeight = 60;
        const spacing = 16;
        let selectedButton: GameObjects.Container | null = null;

        const buttons = betOptions.map((bet, index) => {
            const row = Math.floor(index / 5);
            const col = index % 5;
            const x = padding + col * (buttonWidth + spacing);
            const y = padding * 4.5 + row * (buttonHeight + spacing);

            const buttonContainer = scene.add.container(x, y);

            // Button background
            const buttonBg = scene.add.graphics();
            buttonBg.fillStyle(index === 0 ? 0x66D449 : 0x181818, 1); // Highlight first button by default
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            buttonContainer.add(buttonBg);

            // Button text
            const text = scene.add.text(buttonWidth/2, buttonHeight/2, bet.toString(), {
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold'
            });
            text.setOrigin(0.5);
            buttonContainer.add(text);

            // Make button interactive
            const hitArea = new Geom.Rectangle(0, 0, buttonWidth, buttonHeight);
            buttonContainer.setInteractive(hitArea, Geom.Rectangle.Contains);
            (buttonContainer as any).isButton = true;

            buttonContainer.on('pointerdown', () => {
                scene.audioManager.UtilityButtonSFX.play();
                
                // Deselect previous button
                if (selectedButton) {
                    const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                    prevBg.clear();
                    prevBg.fillStyle(0x181818, 1);
                    prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                }
                
                // Select this button
                buttonBg.clear();
                buttonBg.fillStyle(0x66D449, 1);
                buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
                selectedButton = buttonContainer;
                selectedBetIndex = index;
                try { (updatePopupBetUI as any)?.(); } catch (_e) {}
            });

            betContainer.add(buttonContainer);
            return buttonContainer;
        });

        // Popup Bet control box (minus | value | plus)
        const gridBottomY = (buttons[buttons.length - 1] as any).y + buttonHeight;
        const popupBetLabel = scene.add.text(padding, gridBottomY + spacing * 1.5, 'BET', {
            fontSize: '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        });
        betContainer.add(popupBetLabel);

        const popupBetBoxY = popupBetLabel.y + popupBetLabel.height + spacing / 2;
        const popupBetBoxWidth = 402;
        const popupBetBoxHeight = 60;
        const popupBetBox = scene.add.graphics();
        popupBetBox.fillStyle(0x333333, 0.95);
        popupBetBox.lineStyle(1, 0x66D449, 1);
        popupBetBox.fillRoundedRect(padding, popupBetBoxY, popupBetBoxWidth, popupBetBoxHeight, 10);
        popupBetBox.strokeRoundedRect(padding, popupBetBoxY, popupBetBoxWidth, popupBetBoxHeight, 10);
        betContainer.add(popupBetBox);

        const popupBetValueY = popupBetBoxY + popupBetBoxHeight / 2;
        const popupMinusBtn = scene.add.image(padding + 30, popupBetValueY, 'minus') as ButtonImage;
        //popupMinusBtn.setScale(0.35);
        (popupMinusBtn as any).setInteractive?.();
        (popupMinusBtn as any).isButton = true;
        betContainer.add(popupMinusBtn);

        const popupBetValue = scene.add.text(padding + popupBetBoxWidth / 2, popupBetValueY,
            scene.gameData.currency + ' ' + betOptions[selectedBetIndex].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), {
            fontSize: '28px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        popupBetValue.setOrigin(0.5, 0.5);
        betContainer.add(popupBetValue);

        const popupPlusBtn = scene.add.image(padding + popupBetBoxWidth - 30, popupBetValueY, 'plus') as ButtonImage;
        //popupPlusBtn.setScale(0.4);
        (popupPlusBtn as any).setInteractive?.();
        (popupPlusBtn as any).isButton = true;
        betContainer.add(popupPlusBtn);

        const updatePopupBetUI = () => {
            popupBetValue.setText(
                scene.gameData.currency + ' ' + betOptions[selectedBetIndex].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            );
            // Update grid highlight to match selectedBetIndex
            if (selectedButton) {
                const prevBg = selectedButton.list[0] as GameObjects.Graphics;
                prevBg.clear();
                prevBg.fillStyle(0x181818, 1);
                prevBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            }
            selectedButton = buttons[selectedBetIndex];
            if (selectedButton) {
                const bg = selectedButton.list[0] as GameObjects.Graphics;
                bg.clear();
                bg.fillStyle(0x66D449, 1);
                bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            }
            // Enable/disable +/- at bounds (local selection only)
            const atMin = selectedBetIndex <= 0;
            const atMax = selectedBetIndex >= betOptions.length - 1;
            if (atMin) {
                (popupMinusBtn as any).setAlpha?.(0.3);
                (popupMinusBtn as any).disableInteractive?.();
            } else {
                (popupMinusBtn as any).setAlpha?.(0.8);
                (popupMinusBtn as any).setInteractive?.();
            }
            if (atMax) {
                (popupPlusBtn as any).setAlpha?.(0.3);
                (popupPlusBtn as any).disableInteractive?.();
            } else {
                (popupPlusBtn as any).setAlpha?.(0.8);
                (popupPlusBtn as any).setInteractive?.();
            }
        };
        updatePopupBetUI();

        // Keep bet popup in sync when outside plus/minus changes the bet
        Events.emitter.on(Events.CHANGE_BET, () => {
            selectedBetIndex = betOptions.indexOf(scene.gameData.bet);
            if (selectedBetIndex === -1) { selectedBetIndex = 0; }
            try { (updatePopupBetUI as any)(); } catch (_e) {}
        });

        popupMinusBtn.on('pointerdown', () => {
            if (selectedBetIndex > 0) {
                scene.audioManager.UtilityButtonSFX.play();
                selectedBetIndex -= 1;
                updatePopupBetUI();
            }
        });
        popupPlusBtn.on('pointerdown', () => {
            if (selectedBetIndex < betOptions.length - 1) {
                scene.audioManager.UtilityButtonSFX.play();
                selectedBetIndex += 1;
                updatePopupBetUI();
            }
        });

        const btnWidth = 402;
        const btnHeight = 62;
        const betBtnBg = scene.add.image(btnWidth/2 + padding, 912 - padding * 4, 'greenLongBtn') as ButtonImage;
        betBtnBg.displayWidth = btnWidth;
        betBtnBg.displayHeight = btnHeight;
        betContainer.add(betBtnBg);
        
        const betButtonText = scene.add.text(btnWidth/2 + padding, 912 - padding * 4, 'CONFIRM', {
            fontSize: '28px',
            color: '#000000',
            fontStyle: 'bold',
            fontFamily: 'Poppins'
        });
        betButtonText.setOrigin(0.5, 0.5);
        betContainer.add(betButtonText);

        (betBtnBg as any as ButtonImage).setInteractive().isButton = true;
        betBtnBg.on('pointerdown', () => {

            if(scene.gameData.isSpinning) {
                scene.gameData.bet = scene.gameData.apiBet;
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {}); 
            }
            else{
                // Update total bet display
                scene.gameData.bet = betOptions[selectedBetIndex];
                Events.emitter.emit(Events.CHANGE_BET, {});
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {}); 
            }
                scene.audioManager.UtilityButtonSFX.play();

                scene.tweens.add({
                    targets: betContainer,
                    alpha: 0,
                    duration: 200,
                    ease: 'Cubic.easeIn',
                    onComplete: () => {
                        
                        betContainer.setVisible(false);
                        betContainer.list.forEach(item => {
                            if(item instanceof GameObjects.Graphics && item.name === 'betMask') {
                                item.destroy();
                            }
                        });

                        Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});  
                    }
                });
            }
        );


        // Set initial selected button based on current bet
        const currentBetIndex = betOptions.indexOf(scene.gameData.bet);
        const initialIndex = currentBetIndex !== -1 ? currentBetIndex : 0;
        selectedButton = buttons[initialIndex];
        
        // Reset all buttons to unselected state first
        buttons.forEach((buttonContainer, index) => {
            const buttonBg = buttonContainer.list[0] as GameObjects.Graphics;
            buttonBg.clear();
            buttonBg.fillStyle(0x181818, 1);
            buttonBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
        });
        
        // Update the visual state of the initial selected button
        if (selectedButton) {
            const initialBg = selectedButton.list[0] as GameObjects.Graphics;
            initialBg.clear();
            initialBg.fillStyle(0x66D449, 1);
            initialBg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
        }

        // Sync selection highlight with global bet changes while popup is open
        const setPopupSelectionByBet = () => {
            const idx = betOptions.indexOf(scene.gameData.bet);
            if (idx === -1) { return; }
            selectedBetIndex = idx;
            // Reset all to unselected
            buttons.forEach((buttonContainer) => {
                const bg = buttonContainer.list[0] as GameObjects.Graphics;
                bg.clear();
                bg.fillStyle(0x181818, 1);
                bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            });
            // Highlight the selected
            const target = buttons[selectedBetIndex];
            if (target) {
                const bg = target.list[0] as GameObjects.Graphics;
                bg.clear();
                bg.fillStyle(0x66D449, 1);
                bg.fillRoundedRect(0, 0, buttonWidth, buttonHeight, 8);
            }
        };

        Events.emitter.on(Events.CHANGE_BET, () => {
            if (this.betContainer && this.betContainer.visible) {
                setPopupSelectionByBet();
            }
        });

        // Position the container
        betContainer.setPosition(
            this.isMobile ? 0 : scene.scale.width * 0.5 - 720 / 3,
            this.isMobile ? scene.scale.height - 912 : scene.scale.height * 0.5 - 420);
        betContainer.setScale(0.95, 1);
        betContainer.setVisible(false);

        this.betContainer = betContainer;
        this.betContainer_Y = this.betContainer.y;

        // Store references
    }

    public showBetPopup(scene: GameScene, selectedBetIndex?: number): void {
        if (this.betContainer) {
            if(this.betContainer.visible === false) {
                this.betContainer.setVisible(true);
                this.betContainer.alpha = 0;
                scene.tweens.add({
                    targets: this.betContainer,
                    alpha: { from: 0, to: 1 },
                    y: { from:  this.betContainer_Y + 1000, to: this.betContainer_Y },
                    duration: 1000,
                    ease: "Expo.easeOut",
                    onComplete: () => {
                        const mask = scene.add.graphics();
                        mask.name = 'betMask';
                        mask.fillStyle(0x000000, 0.7); // Black with 0.7 opacity
                        mask.fillRect(0, 0, scene.scale.width, scene.scale.height);
                        mask.setInteractive(new Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height), Geom.Rectangle.Contains);
                        mask.on('pointerdown', () => this.hideBetPopup(scene));
                        this.betContainer.add(mask);
                        
                        mask.setScale(this.isMobile ? 2.25 : 1, this.isMobile ? 2.5 : 1);
                        mask.setPosition(
                            this.isMobile ? -scene.scale.width / 2 : -this.betContainer.x,
                            this.isMobile ? -scene.scale.height : -this.betContainer_Y); // Adjust position relative to container
                        this.betContainer.sendToBack(mask); // Ensure mask is behind other elements
                        scene.tweens.add({
                            targets: mask,
                            alpha: {from: 0, to: 0.01},
                            duration: 1000
                        });
                    }
                });
            }
            
            // Automatically click the button corresponding to current bet when popup opens
            const betOptions = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 5, 6, 8, 10, 14, 18, 24, 32 ,40, 60, 80, 100, 110 ,120, 130, 140, 150];
            const currentBetIndex = selectedBetIndex !== undefined ? selectedBetIndex : betOptions.indexOf(scene.gameData.bet);
            
            if (currentBetIndex !== -1 && this.betContainer.list.length > 0) {
                // Find the button container for the current bet
                const buttonContainers = this.betContainer.list.filter(item => 
                    item instanceof GameObjects.Container && 
                    item !== this.betContainer && 
                    (item as any).list && 
                    (item as any).list.length > 0 &&
                    (item as any).list[0] instanceof GameObjects.Graphics
                ) as GameObjects.Container[];
                
                if (currentBetIndex < buttonContainers.length) {
                    // Simulate clicking the button for the current bet
                    const targetButton = buttonContainers[currentBetIndex];
                    if (targetButton && (targetButton as any).emit) {
                        (targetButton as any).emit('pointerdown');
                    }
                }
            }
            
            Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {}); 
        }
    }

    public hideBetPopup(scene: GameScene): void {
       if (this.betContainer) {
           scene.tweens.add({
               targets: this.betContainer,
               alpha: 0,
               y: { from: this.betContainer_Y, to: this.betContainer_Y + scene.scale.height},
               duration: 1000,
               ease: 'Expo.easeInOut',
               onComplete: () => {
                   this.betContainer.setVisible(false);
                   this.betContainer.list.forEach(item => {
                    if(item instanceof GameObjects.Graphics && item.name === 'betMask') {
                        item.destroy();
                    }
                   });
               }
           });
       }
    }



    private createBuyFeature(scene: GameScene): void {
        // Elliptical buy feature button in upper left
        const x = this.isMobile ? this.width * 0.505 : this.width * 0.15;
        const y = this.isMobile ? this.height * 0.75 : this.height * 0.13;

        const container = scene.add.container(x, y) as ButtonContainer;

        // Button background
            this.buyFeatureButton = scene.add.image(0, 0, 'buyFeature') as ButtonImage;
            // this.buyFeatureButton.preFX!.addShadow(0.5, 0.5, 0.1, 2, 10000536, 6, 1);
            this.buyFeatureButton.setScale(115/182, 52/72);
          
            this.buyFeatureButton.setInteractive(new Geom.Rectangle(
                0,
                0,
                this.buyFeatureButton.width,
                this.buyFeatureButton.height
            ), Geom.Rectangle.Contains);
            (this.buyFeatureButton as any).isButton = true;
            container.add(this.buyFeatureButton);
        

        // // Stars
        // if(!this.isMobile){
        //     this.buyFeatureStarLeft = scene.add.image(-ellipseWidth/2 + 32, -24, 'star') as ButtonImage;
        //     container.add(this.buyFeatureStarLeft);
        //     this.buyFeatureStarRight = scene.add.image(ellipseWidth/2 - 32, -24, 'star') as ButtonImage;
        //     container.add(this.buyFeatureStarRight);
        // }
        
        // BUY FEATURE text
        
        this.buyFeatureButtonText = scene.add.text(0, -24, 'BUY FEATURE', {
        }) as ButtonText;
        this.buyFeatureButtonText.setOrigin(0.5, 0.5);
            this.buyFeatureButtonText.setScale(0.5);
            this.buyFeatureButtonText.setPosition(0, -12);
            this.buyFeatureButtonText.setStyle({
                fontSize: '24px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold',
                align: 'center',
            });
        
        container.add(this.buyFeatureButtonText);

        // Price text (large, green)
        const price = scene.gameData.getBuyFeaturePrice();
        const priceText = scene.gameData.currency + ' ' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        this.buyFeaturePriceText = scene.add.text(0, 24,  priceText, {
            fontSize: '42px',
            color: '#3FFF0D',
            fontFamily: 'Poppins',
            align: 'center',
            fontStyle: 'bold'
        }) as ButtonText;
        this.buyFeaturePriceText.setOrigin(0.5, 0.5);
        
            this.buyFeaturePriceText.setScale(0.4);
            this.buyFeaturePriceText.setPosition(0, 8);
            this.buyFeaturePriceText.setColor('#FFFFFF');
            
        container.add(this.buyFeaturePriceText);

        container.name = 'buyFeatureContainer';
        this.buttonContainer.add(container);
        this.buttonContainer.sendToBack(container);

        // Popup is now handled by BuyFeaturePopup component

        // Function to update button state
        const updateButtonState = () => {
            // Disable if spinning, autoplay is active, or in bonus round
            const shouldDisable = scene.gameData.isSpinning || 
                scene.autoplay.isAutoPlaying || 
                scene.gameData.isBonusRound;

            if (shouldDisable) {
                this.buyFeaturePriceText.setAlpha(0.5);
            } else {
                this.buyFeaturePriceText.setAlpha(1);
            }
        };

        // Show popup when buy feature is pressed
        const showBuyFeaturePopup = () => {
            
            scene.audioManager.UtilityButtonSFX.play();
            
            Events.emitter.emit(Events.REMOVE_ENHANCE_BET, {});

            // Close autoplay settings if open
            if (this.autoplayPopup && this.autoplayPopup.visible) {
                this.autoplayPopup.setVisible(false);
            }
            
            // Show the new buy feature popup
            if (scene.buyFeaturePopup) {
                scene.buyFeaturePopup.show(scene); 
            }
        };

        // Add click handlers
        this.buyFeatureButton?.on('pointerdown', showBuyFeaturePopup);
        
        // Close button is now handled by BuyFeaturePopup component

        // Listen for spin state changes
        Events.emitter.on(Events.SPIN_ANIMATION_START, updateButtonState);
        Events.emitter.on(Events.SPIN_ANIMATION_END, updateButtonState);
        Events.emitter.on(Events.MATCHES_DONE, updateButtonState);
        
		// Listen for bet changes to update price
		Events.emitter.on(Events.CHANGE_BET, () => {
			this.updateBuyFeaturePrice(scene, scene.gameData.getBuyFeaturePrice());
		});
    }

    updateBuyFeaturePrice(scene: GameScene, newPrice: number) {
		if (this.buyFeaturePriceText) {
			this.buyFeaturePriceText.setText(scene.gameData.currency + ' ' + newPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
		}
	}


    private createDoubleFeature(scene: GameScene): void {
        const x = this.width * 0.73;
        const y = this.mobile_buttons_y;

        const width = 240;
        const height = 108;

        const container = scene.add.container(x, y) as ButtonContainer;

        
            // elliptical button
            const bg = scene.add.image(0, 0, 'amplifyBet') as ButtonImage;
            bg.setOrigin(0.5, 0.5);
            bg.setScale(0.7);
            bg.setInteractive().isButton = true;
            bg.on('pointerdown', () => {
                this.amplifyBetAnimation();
                scene.gameData.doubleChanceEnabled = !scene.gameData.doubleChanceEnabled;
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
                scene.audioManager.UtilityButtonSFX.play();
            });
            container.add(bg);
        

            // Bet box (left)
            const betBox = scene.add.graphics();
            betBox.fillStyle(0x181818, 1);
            betBox.fillRoundedRect(15, 20, 90, 90, 16);
            betBox.setVisible(this.isMobile ? false : true);
            container.add(betBox);
            
            const betLabel = scene.add.text(60, 45, 'BET', {
                fontSize: '24px',
                color: '#DDDDDD',
                fontFamily: 'Poppins',
                fontStyle: 'bold',
                align: 'center'
            }) as ButtonText;
            betLabel.setOrigin(0.5, 0.5);
            betLabel.setVisible(this.isMobile ? false : true);
            container.add(betLabel);

        // Enhanced Bet label (right, top)
        const enhancedLabel = scene.add.text(this.isMobile ? width * 0.15 : width - 140, this.isMobile ? height * 0.15 : 10, 'ENHANCED BET', {
            fontSize: '12px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        }) as ButtonText;
        enhancedLabel.setFontSize(this.isMobile ? '22px' : '14px');
        enhancedLabel.setVisible(this.isMobile ? false : true);
        container.add(enhancedLabel);

        // Toggle switch (right, middle)
        const toggleWidth = 64;
        const toggleHeight = 36;
        const toggleRadius = 18;
        const toggleX = this.isMobile ? toggleWidth * 0.75 : width - 120;
        const toggleY = toggleHeight + toggleRadius * 0.75;

        const toggleBg = scene.add.graphics();
        toggleBg.fillStyle(0x181818, 1);
        toggleBg.lineStyle(3, 0xFFFFFF, 0.5);
        toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
        toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
        toggleBg.setVisible(this.isMobile ? false : true);
        container.add(toggleBg);
        

        const toggleCircle = scene.add.graphics();
        let isEnabled = !!scene.gameData.doubleChanceEnabled;

        const drawToggle = () => {
            toggleCircle.clear();
            if (isEnabled) {
                toggleBg.clear();
                toggleBg.fillStyle(0x379557, 1);
                toggleBg.lineStyle(5, 0xFFFFFF, 1);
                toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleCircle.fillStyle(0x3FFF0D, 1);
                toggleCircle.fillCircle(toggleX + toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
                
                // Gray out bet box when enabled
                betBox.clear();
                betBox.fillStyle(0x000000, 0.8);
                betBox.fillRoundedRect(15, 20, 90, 90, 16);

                betLabel.setColor('#FFFFFF');

                scene.gameData.doubleChanceEnabled = true;
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});                
            } else {
                toggleBg.clear();
                toggleBg.fillStyle(0xDDDDDD, 0);
                toggleBg.lineStyle(3, 0xFFFFFF, 1);
                toggleBg.strokeRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleBg.fillRoundedRect(toggleX, toggleY, toggleWidth, toggleHeight, toggleRadius);
                toggleCircle.fillStyle(0xFFFFFF, 1);
                toggleCircle.fillCircle(toggleX + toggleWidth - toggleRadius, toggleY + toggleHeight / 2, toggleRadius - 4);
                
                // Normal bet box when disabled
                betBox.clear();
                betBox.fillStyle(0x181818, 0.5);
                betBox.fillRoundedRect(15, 20, 90, 90, 16);
                betLabel.setColor('#FFFFFF'); 

                scene.gameData.doubleChanceEnabled = false;
                Events.emitter.emit(Events.ENHANCE_BET_TOGGLE, {});
            }
        };
        drawToggle();
        
        Events.emitter.on(Events.REMOVE_ENHANCE_BET, () => {
                scene.gameData.doubleChanceEnabled = false;
                isEnabled=false;
                drawToggle();
        });

        toggleCircle.setVisible(false);
        container.add(toggleCircle);

        // Toggle logic
        const toggleArea = scene.add.zone(toggleX, toggleY, toggleWidth, toggleHeight).setOrigin(0, 0) as ButtonZone;
        toggleArea.setInteractive().isButton = true;
        toggleArea.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            this.amplifyBetAnimation();
            scene.audioManager.UtilityButtonSFX.play();
            isEnabled = !isEnabled;
            scene.gameData.doubleChanceEnabled = isEnabled;
            drawToggle();
        });
        container.add(toggleArea);

        // Description (right, bottom)
        const desc = scene.add.text(width - 140, 105, 'Higher odds for\nFree Spins', {
            fontSize: '14px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'center'
        }) as ButtonText;
        desc.setOrigin(0, 0.5);
        desc.setVisible(this.isMobile ? false : true);
        container.add(desc);

        // Slightly above other UI; keep same across devices
        container.setDepth(5);
        container.name = 'doubleFeatureContainer';
        container.setScale(this.isMobile ? 1 : 1);
        if(this.isMobile){
            const amplifyBetText = scene.add.text(0, 30,
                'Amplify Bet',
                {
                    fontSize: '12px',
                    color: '#FFFFFF',
                    fontFamily: 'Poppins',
                    align: 'center'
                }
            );
            amplifyBetText.setOrigin(0.5, 0); // Center horizontally, top align vertically
            container.add(amplifyBetText);
        }
        
        // Create "Double Chance For Feature" label with 2-line thick green border and black background, above the button
        if(this.isMobile){
            const labelWidth = 120;
            const labelHeight = 48;
            const borderThickness = 1;
            const borderColor = 0x00FF00; // Green
            const bgColor = 0x000000; // Black

            // Container for the label
            const labelContainer = scene.add.container(0, -(labelHeight/2 + 20));

            // Draw black background rectangle
            const bgRect = scene.add.graphics();
            bgRect.fillStyle(bgColor, 1);
            bgRect.fillRect(-labelWidth/2, -labelHeight/2, labelWidth, labelHeight);

            // Draw 2-line thick green border
            // Outer border
            bgRect.lineStyle(borderThickness, borderColor, 1);
            bgRect.strokeRect(-labelWidth/2, -labelHeight/2, labelWidth, labelHeight);
            // Inner border (slightly inset)
            bgRect.lineStyle(borderThickness, borderColor, 1);
            bgRect.strokeRect(-labelWidth/2 + borderThickness, -labelHeight/2 + borderThickness, labelWidth - 2*borderThickness, labelHeight - 2*borderThickness);
            bgRect.setScale(0.9, 0.8);

            labelContainer.add(bgRect);

            // Add the text
            const labelText = scene.add.text(0, 0, 'Double Chance For Feature', {
                fontSize: '12px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                align: 'center',
                wordWrap: {
                    width: labelWidth - 20
                }   
            }) as ButtonText;
            labelText.setOrigin(0.5, 0.5);
            labelContainer.add(labelText);


            container.add(labelContainer);
        }

        this.buttonContainer.add(container);
        // Record base Y and hook Y-axis toggle event
        this.baseYPositions[container.name] = container.y;
        Events.emitter.on(Events.CREATE_DOUBLE_FEATURE, (hidden?: boolean) => {
            if (!container) return;
            const baseY = this.baseYPositions['doubleFeatureContainer'] ?? container.y;
            const targetY = hidden ? scene.scale.height + 200 : baseY;
            try {
                scene.tweens.add({ targets: container, y: targetY, duration: 200, ease: 'Cubic.easeInOut' });
            } catch (_e) {
                (container as any).y = targetY;
            }
        });
    }

    private createLogo(scene: GameScene): void {
        const x = this.isMobile ? this.width * 0.22 : this.width * 0.88;
        const y = this.isMobile ? this.height * 0.10 : this.height * 0.12;
        const container = scene.add.container(x, y) as ButtonContainer;

        const logo = scene.add.image(0, 0, 'logo') as ButtonImage;
        logo.setScale(1);
        container.add(logo);

        container.name = 'logoContainer';
        container.setScale(this.isMobile ? 0.5 : 1);
        this.buttonContainer.add(container);
    }

    public bonusMultiplier : number = 1;
    
    private createMarqueeBonus(scene: GameScene): void {
        if(!this.isMobile) return;
        const x = this.width * 0.5;
        const y = this.height * 0.19;
        const container = scene.add.container(x, y);
        // Mobile-only marquee; depth high enough to be visible
        container.setDepth(20);

        const marquee = scene.add.image(0, 0, 'marquee');
        marquee.setScale(0.49);
        container.add(marquee);

        const youWonString = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const youWonLabel = scene.add.text(0, 0, 'WIN', {
            fontSize: '14px',
            color: '#FFFFFF', 
            fontFamily: 'Poppins',
            align: 'center'
        });
        youWonLabel.setOrigin(0.5, 1);
        const youWonAmount = scene.add.text(0, 0, scene.gameData.currency + ' ' + youWonString, {
            fontSize: '20px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        youWonAmount.setOrigin(0.5, 0);
        const youWonText = scene.add.container(0, 0, [youWonLabel, youWonAmount]);
        container.add(youWonText);

        this.bombMarqueeContainer = container;
        this.bombMarqueeContainer.setVisible(false);
        
        Events.emitter.on(Events.SHOW_BOMB_WIN, () => { 
            this.bombMarqueeContainer.setVisible(true);
            let multiplier = scene.gameData.totalBombWin;
            let totalWin = scene.gameData.totalWinFreeSpinPerTumble[scene.gameData.apiFreeSpinsIndex].toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            const totalProduct = scene.gameData.totalWinFreeSpinPerTumble[scene.gameData.apiFreeSpinsIndex] * scene.gameData.totalBombWin;
            const totalProductString = totalProduct.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
            //youWonLabel.setText('WIN');
            console.log('2764 Show Bomb Win ' + scene.gameData.totalWinFreeSpinPerTumble[scene.gameData.apiFreeSpinsIndex]);
            console.log('2765 Total Bomb Win ', scene.gameData.totalWinFreeSpinPerTumble);
            if(multiplier > 1)
            youWonAmount.setText(`${scene.gameData.currency} ${totalWin} x ${multiplier} = ${totalProductString}`);
        });
        Events.emitter.on(Events.HIDE_BOMB_WIN, () => { 
            this.bombMarqueeContainer.setVisible(false);
            // Finalize marquee display if last FS just finished on a bomb
            try {
                const fsLen = (scene.gameData.totalWinFreeSpin?.length || 0);
                if (this.isMobile && scene.gameData.useApiFreeSpins && fsLen > 0 && (scene.gameData.apiFreeSpinsIndex >= fsLen)) {
                    const finalTotal =
                     (scene.gameData.totalWinFreeSpin || []).reduce((s, v) => s + (Number(v) || 0));
                    youWonLabel.setText('TOTAL WIN');
                    console.log('Total Win', finalTotal);
                    youWonAmount.setText(`${scene.gameData.currency} ${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                }
            } catch (_e) {}
        });
    }

    private createMarquee(scene: GameScene): void {
        //if(!this.isMobile) return;
        const x = this.width * 0.5;
        const y = this.height * 0.19;
        const container = scene.add.container(x, y);
        container.setDepth(20);
        
        const marquee = scene.add.image(0, 0, 'marquee');
        marquee.setScale(0.49);
        container.add(marquee);

        // Title
        const youWonString = scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const youWonLabel = scene.add.text(0, 0, 'TOTAL WIN', {
            fontSize: '14px',
            color: '#FFFFFF', 
            fontFamily: 'Poppins',
            align: 'center'
        });
        youWonLabel.setOrigin(0.5, 1);
        const youWonAmount = scene.add.text(0, 0, scene.gameData.currency + ' ' + youWonString, {
            fontSize: '20px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        youWonAmount.setOrigin(0.5, 0);
        const youWonText = scene.add.container(0, 0, [youWonLabel, youWonAmount]);
        container.add(youWonText);
        
        // Marquee incremental addition queue (per-tumble)
        let marqueeCurrentTotal = 0;
        let marqueeQueue: number[] = [];
        let isProcessingQueue = false;
        let totalWinFinalTimer: Phaser.Time.TimerEvent | null = null;

        const processQueue = (isBomb?:boolean) => {
            if (isProcessingQueue) return;
            isProcessingQueue = true;

            let reelSpeed = 1000;

            if(totalWinFinalTimer){
                totalWinFinalTimer.remove(false);
                totalWinFinalTimer = null;
            }

            const step = () => {
                if (marqueeQueue.length === 0) {
                    isProcessingQueue = false;
                    
                    if (isBomb) {
                        const idx = Math.max(0, Math.min(scene.gameData.apiFreeSpinsIndex || 0, (scene.gameData.totalWinFreeSpin?.length || 1) - 1));
                        const arr = scene.gameData.totalWinFreeSpin || [];
                        marqueeCurrentTotal = arr.slice(0, idx + 1).reduce((sum, v) => sum + (v || 0), 0);
                    
                        // End of a tumble (or after bombs): show TOTAL WIN with the final value
                        youWonLabel.setText('TOTAL WIN');
                        const finalDisplay = (marqueeCurrentTotal >= scene.gameData.totalWin)
                            ? scene.gameData.totalWin
                            : marqueeCurrentTotal;
                        youWonAmount.setText(`${scene.gameData.currency} ${finalDisplay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

                        return;
                    }

                    if(scene.gameData.isBonusRound){
                        youWonLabel.setText('WIN');
                        youWonAmount.setText(`${scene.gameData.currency} ${marqueeCurrentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                        return;
                    }

                    const capValue = scene.gameData.totalWin || 0;
                    const finalDisplay = (capValue > 0 && marqueeCurrentTotal >= capValue)
                        ? capValue
                        : marqueeCurrentTotal;
                    totalWinFinalTimer = scene.time.delayedCall(250, ()=>{
                        if(!scene.gameData.isBonusRound){
                            youWonLabel.setText('WIN');
                        }
                        else{
                            youWonLabel.setText('TOTAL WIN');
                        }

                        youWonAmount.setText(`${scene.gameData.currency} ${finalDisplay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                        totalWinFinalTimer = null;
                    });
                    return;
                }
            const increment = marqueeQueue.shift() as number;
            marqueeCurrentTotal += increment || 0;
            
            // During counting, base game shows TOTAL WIN, bonus shows WIN
            youWonLabel.setText(scene.gameData.isBonusRound ? 'WIN' : 'TOTAL WIN');
            if(!scene.gameData.isBonusRound){
                youWonLabel.setText('WIN');
            }
            youWonAmount.setText(`${scene.gameData.currency} ${marqueeCurrentTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            scene.time.delayedCall(reelSpeed, step);
            };
            step();
        };

        const hideMarquee = () => {
            //marquee.setVisible(false);
            youWonText.setVisible(false);
        };

        const showMarquee = () => {
            //marquee.setVisible(true);
            youWonText.setVisible(true);
        };

        hideMarquee();
        Events.emitter.on(Events.UPDATE_TOTAL_WIN, (increment?: number, isBomb?: boolean) => {
            //if(!this.isMobile) return;
            
            showMarquee();
            // console.error(increment);
            // Queue per-tumble increment (fallback to using totalWin if payload missing)
            if (typeof increment === 'number' && !isNaN(increment)) {
                marqueeQueue.push(increment);
            } else {
                // Fallback: compute difference vs current displayed total
                const diff = (scene.gameData.totalWin || 0) - marqueeCurrentTotal;
                if (diff > 0) marqueeQueue.push(diff);
            }
            processQueue(isBomb);
        });

		// Reset marquee on new spin start
		Events.emitter.on(Events.SPIN_ANIMATION_START, () => {
			if(!this.isMobile) return;
			marqueeCurrentTotal = 0;
			marqueeQueue = [];
			isProcessingQueue = false;
            if (totalWinFinalTimer) {
                scene.time.removeEvent(totalWinFinalTimer);
                totalWinFinalTimer = null;
            }
			//if (hideTimer) { hideTimer.remove(false); hideTimer = null; }
			youWonAmount.setText(scene.gameData.currency + ' '
                + (0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			//hideMarquee();
		});

		// Also clear marquee when current tumble sequence finishes
		Events.emitter.on(Events.TUMBLE_SEQUENCE_DONE, () => {
			if(!this.isMobile) return;
			marqueeCurrentTotal = 0;
			marqueeQueue = [];
			isProcessingQueue = false;
			//if (hideTimer) { hideTimer.remove(false); hideTimer = null; }
			//youWonAmount.setText(scene.gameData.currency + ' ' + (0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			//hideMarquee();
		});

        Events.emitter.on(Events.UPDATE_CURRENCY, () => {
            if(!this.isMobile) return;
            //youWonAmount.setText(scene.gameData.currency + ' ' + youWonString);
        });

        Events.emitter.on(Events.FINAL_WIN_SHOW, () => {
            youWonLabel.setText('TOTAL WIN');
            youWonAmount.setText(`${scene.gameData.currency} ${scene.gameData.totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        });
        Events.emitter.on(Events.FREE_SPIN_TOTAL_WIN, ()=>{
            console.log(scene.gameData.currentFreeSpinIndex);
            
            // Calculate finalTotal as the sum of totalWinFreeSpin up to and including currentFreeSpinIndex
            const idx = Math.max(0, Math.min(scene.gameData.currentFreeSpinIndex || 0, (scene.gameData.totalWinFreeSpin?.length || 1) - 1));
            const finalTotal = (scene.gameData.totalWinFreeSpin || []).slice(0, idx + 1).reduce((s, v) => s + (Number(v) || 0), 0);
            
            youWonLabel.setText('TOTAL WIN');
            youWonAmount.setText(`${scene.gameData.currency} ${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        });
    }

    private createSettings(scene: GameScene): void {
        const x = this.isMobile ? scene.scale.width * 0.11 : this.width * 0.05;
        const y = this.isMobile ? this.mobile_buttons_y : this.height * 0.9;

        const container = scene.add.container(x, y) as ButtonContainer;

        const scaleFactor = 1;
        const radius = 40 * scaleFactor;

        const volumeIcon = scene.add.image(0, 0, this.isMobile ? 'hamburger' : 'volume') as ButtonImage;
        volumeIcon.setOrigin(0.5, 0.5);
        volumeIcon.setScale(this.isMobile ? 1 * scaleFactor : 0.6 * scaleFactor);

        if(this.isMobile){
            const innerCircle = scene.add.graphics();
            innerCircle.fillStyle(0x000000, 0.5);
            innerCircle.fillCircle(0, 0, volumeIcon.width);
            container.add(innerCircle);
        }
        container.add(volumeIcon);

        container.name = 'settingsContainer';
        this.buttonContainer.add(container);

        // Make container interactive
        container.setInteractive(
            new Geom.Rectangle(-radius, -radius, radius * 2, radius * 2),
            Geom.Rectangle.Contains
        ).isButton = true;

        if(this.isMobile){
            const settingsText = scene.add.text(0, 25,
                'Menu',
                {
                    fontSize: '12px',
                    color: '#FFFFFF',
                    fontFamily: 'Poppins',
                    align: 'center'
                }
            );
            settingsText.setOrigin(0.5, 0);
            container.add(settingsText);
        }

        if (!this.menu){
            // if(this.isMobile){
                this.menu = new Menu(false);
            // }
            // else{
            //     this.menu = new Menu();
            // }
            this.menu.create(scene);
        }
        // Toggle menu on settings button click
        container.on('pointerdown', () => {
            scene.audioManager.UtilityButtonSFX.play();
                this.menu.toggleMenu(scene);
        });
    }

   

    update(): void {
        // No update needed since Autoplay handles its own state
    }

    public startIdleAnimation(scene: GameScene): void {
        if (this.idleTween) {
            this.idleTween.stop();
        }
        this.idleTween = scene.tweens.add({
            targets: this.spinButton,
            angle: '+=360',
            duration: 8000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    public stopIdleAnimation(): void {
        if (this.idleTween) {
            this.idleTween.stop();
            this.idleTween = null;
        }
    }

    private closeBuyFeaturePopup(): void {
        if (this.buyFeaturePopup) {
            this.buyFeaturePopup.setVisible(false);
        }
    }
} 