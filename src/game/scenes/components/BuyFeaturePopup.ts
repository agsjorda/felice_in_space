import { Scene, GameObjects, Geom } from 'phaser';
import { Events } from './Events';
import { GameData } from './GameData';
import { AudioManager } from './AudioManager';
import { Autoplay } from './Autoplay';
import { SlotMachine } from './SlotMachine';

// Custom button interfaces with proper type safety
interface ButtonBase {
    isButton: boolean;
}

type ButtonContainer = GameObjects.Container & ButtonBase;
type ButtonImage = GameObjects.Image & ButtonBase;
type ButtonText = GameObjects.Text & ButtonBase;

interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    slotMachine: SlotMachine;
    autoplay: Autoplay;
}

export class BuyFeaturePopup {
    private popupContainer: GameObjects.Container | null = null;
    private isMobile: boolean = false;
    private betOptions: number[] = [0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2, 2.4, 2.8, 3.2, 3.6, 4, 5, 6, 8, 10, 14, 18, 24, 32, 40, 60, 80, 100, 110, 120, 130, 140, 150];
    private currentBetIndex: number = 17; // Default to bet value 10

    constructor() {
        this.isMobile = this.isMobileDevice();
    }

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    preload(scene: GameScene): void {
        // dimensions not stored; computed per-show

        // Load assets needed for the popup
        scene.load.image('buyFeatBG', 'assets/Reels/BuyFeatureBG.png');
        scene.load.image('freeSpinDisplay', 'assets/Controllers/FreeSpinDisplay.png');
        scene.load.image('greenBtn', 'assets/Buttons/greenBtn.png');
        scene.load.image('greenLongBtn', 'assets/Buttons/greenLongBtn.png');
        scene.load.image('ekis', 'assets/Buttons/ekis.png');
        scene.load.image('ScatterLogo', 'assets/Logo/Scatter.png');
        scene.load.image('ScatterBackground', 'assets/background/Bonus_BG.jpg');
        scene.load.image('plus', 'assets/Controllers/Plus.png');
        scene.load.image('minus', 'assets/Controllers/Minus.png');
    }

    create(scene: GameScene): void {
        // Create the popup container
        const popupWidth = this.isMobile ? scene.scale.width : 573;
        const popupHeight = this.isMobile ? scene.scale.height * 0.8 : 369;
        const popupX = this.isMobile ? scene.scale.width / 2 - popupWidth / 2 : scene.scale.width / 2 - popupWidth / 2;
        const popupY = this.isMobile ? scene.scale.height / 2 - popupHeight / 2 : scene.scale.height / 2 - popupHeight / 2;
        // console.log(popupX, popupY, popupWidth, popupHeight);

        this.popupContainer = scene.add.container(popupX, popupY) as ButtonContainer;
        this.popupContainer.setDepth(1000);
        this.popupContainer.setVisible(false);

        // Desktop-specific popup (old version from Buttons.txt) — build and return early
        if (!this.isMobile) {
            const width = 573;
            const height = 369;

            const bgDesk = scene.add.image(width / 2, height / 2, 'buyFeatBG') as ButtonImage;
            bgDesk.setOrigin(0.5, 0.5);
            this.popupContainer.add(bgDesk);

            const freeSpinDisplay = scene.add.image(width / 2, 46, 'freeSpinDisplay');
            freeSpinDisplay.displayWidth = 200;
            freeSpinDisplay.displayHeight = 107;
            freeSpinDisplay.setOrigin(0.5, 0.25);
            freeSpinDisplay.alpha = 1;
            this.popupContainer.add(freeSpinDisplay);

            const buyText = scene.add.text(width / 2, 144, '', {
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold',
                align: 'center'
            }) as ButtonText;
            buyText.setOrigin(0.5, 0.25);
            this.popupContainer.add(buyText);

            const btnWidth = 127;
            const btnHeight = 63;
            const buyBtnBg = scene.add.image(width / 2 - btnWidth / 2 - 20, height - 48 - btnHeight / 2, 'greenBtn') as ButtonImage;
            buyBtnBg.displayWidth = btnWidth;
            buyBtnBg.displayHeight = btnHeight;
            buyBtnBg.setOrigin(0.5, 0.5);
            buyBtnBg.alpha = 1;
            this.popupContainer.add(buyBtnBg);
            
            const buyBtnText = scene.add.text(width / 2 - btnWidth / 2 - 20, height - 48 - btnHeight / 2, 'Buy', {
                fontSize: '36px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold',
                align: 'center'
            }) as ButtonText;
            buyBtnText.setOrigin(0.5, 0.5);
            this.popupContainer.add(buyBtnText);
            
            const closeBtnBg = scene.add.image(width / 2 + btnWidth / 2 + 20, height - 48 - btnHeight / 2, 'greenBtn') as ButtonImage;
            closeBtnBg.displayWidth = btnWidth;
            closeBtnBg.displayHeight = btnHeight;
            closeBtnBg.setOrigin(0.5, 0.5);
            closeBtnBg.alpha = 0;

            closeBtnBg.setInteractive().isButton = true;
            closeBtnBg.on('pointerdown', () => {
                this.hide(scene);
            });

            this.popupContainer.add(closeBtnBg);

            const closeBtnText = scene.add.text(width / 2 + btnWidth / 2 + 20, height - 48 - btnHeight / 2, 'Close', {
                fontSize: '32px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontStyle: 'bold'
            }) as ButtonText;
            closeBtnText.setOrigin(0.5, 0.5);
            this.popupContainer.add(closeBtnText);

            buyBtnBg.setInteractive().isButton = true;
            buyBtnBg.on('pointerdown', () => {
                const cost = scene.gameData.getBuyFeaturePrice();
                const balance = scene.gameData.balance;
                const ok = balance >= cost;
                console.log(`[BUY FEATURE] Clicked. balance=${balance}, cost=${cost}, ok=${ok}`);
                if (!ok) {
                    console.log('[BUY FEATURE] Blocked: insufficient balance, showing popup');
                    Events.emitter.emit(Events.SHOW_INSUFFICIENT_BALANCE);
                    return;
                }
                this.handleBuyFeature(scene);
            });
            // Make Close label clickable too
            closeBtnText.setInteractive().isButton = true;
            closeBtnText.on('pointerdown', () => {
                this.hide(scene);
            });
            (this.popupContainer as any).buyText = buyText;
            (this.popupContainer as any).closeBtnBg = closeBtnBg;

            return;
        }

        // Popup background
        const bg = scene.add.image(0, 0, 'ScatterBackground');
        bg.setCrop(0, 0, bg.width, bg.height * 2 / 3);
        bg.setDisplaySize(popupWidth, popupHeight * 1.5);
        bg.setOrigin(0, 0);
        
        this.popupContainer.add(bg);

        let padding = Math.min(popupWidth, popupHeight) / 16;
        // Title text "HEAVEN'S WELCOME BONUS"
        const BuyFeatureText = scene.add.text(padding, padding * 2, 'Buy Feature', {
            fontSize: this.isMobile ? '24px' : '32px',
            color: '#379557',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
        }) as ButtonText;
        BuyFeatureText.setOrigin(0, 0);
        this.popupContainer.add(BuyFeatureText);

        const titleText = scene.add.text(popupWidth / 2, padding * 5, 'Sugar Bomb Bonus', {
            fontSize: this.isMobile ? '24px' : '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        titleText.setOrigin(0.5, 0);
        this.popupContainer.add(titleText);

        // Scatter symbol (symbol0) in the middle
        const scatterSymbol = scene.add.image(popupWidth / 2, popupHeight * 0.4, 'ScatterLogo') as ButtonImage;
        scatterSymbol.setOrigin(0.5, 0.5);
        this.popupContainer.add(scatterSymbol);

        // Main text
        const buyText = scene.add.text(popupWidth / 2, popupHeight * 0.6, '', {
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        buyText.setOrigin(0.5, 0.5);
        this.popupContainer.add(buyText);

        // Bet controls container
        const betControlsContainer = scene.add.container(popupWidth / 2, popupHeight * 0.7);
        this.popupContainer.add(betControlsContainer);

        // Bet label
        const betLabel = scene.add.text(0, -30, 'BET', {
            fontSize: this.isMobile ? '20px' : '24px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        betLabel.setOrigin(0.5, 0.5);
        betControlsContainer.add(betLabel);

        // Bet value text
        const betValueText = scene.add.text(0, 0, '', {
            fontSize: this.isMobile ? '28px' : '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        betValueText.setOrigin(0.5, 0.5);
        betControlsContainer.add(betValueText);

        // Minus button
        const minusBtn = scene.add.image(-padding * 4, 0, 'minus') as ButtonImage;
        //minusBtn.setScale(this.isMobile ? 0.25 : 0.3);
        minusBtn.setInteractive().isButton = true;
        minusBtn.setAlpha(0.8);
        betControlsContainer.add(minusBtn);

        // Plus button
        const plusBtn = scene.add.image(padding * 4, 0, 'plus') as ButtonImage;
        //plusBtn.setScale(this.isMobile ? 0.25 : 0.3);
        plusBtn.setInteractive().isButton = true;
        plusBtn.setAlpha(0.8);
        betControlsContainer.add(plusBtn);

        // Buy Feature button
        const buyBtnBg = scene.add.image(padding * 2, popupHeight * 0.8, 'greenLongBtn') as ButtonImage;
        buyBtnBg.setDisplaySize(padding * 12, padding * 2.5);
        buyBtnBg.setOrigin(0, 0);
        this.popupContainer.add(buyBtnBg);

        const buyBtnText = scene.add.text(popupWidth / 2, buyBtnBg.y + buyBtnBg.height / 2, 'BUY FEATURE', {
            fontSize: this.isMobile ? '24px' : '24px',
            color: '#000000',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        }) as ButtonText;
        buyBtnText.setOrigin(0.5, 0.5);
        this.popupContainer.add(buyBtnText);

        // Close button (X button)
        const closeBtnBg = scene.add.image(padding * 14, padding * 3, 'ekis') as ButtonImage;
        closeBtnBg.setDisplaySize(padding / 1.5, padding / 1.5);
        closeBtnBg.setOrigin(0.5, 0.5);
        this.popupContainer.add(closeBtnBg);

        // Set up button interactions
        buyBtnBg.setInteractive().isButton = true;
        buyBtnBg.on('pointerdown', () => {
            const cost = scene.gameData.getBuyFeaturePrice();
            const balance = scene.gameData.balance;
            const ok = balance >= cost;
            console.log(`[BUY FEATURE] Clicked. balance=${balance}, cost=${cost}, ok=${ok}`);
            if (!ok) {
                console.log('[BUY FEATURE] Blocked: insufficient balance, showing popup');
                Events.emitter.emit(Events.SHOW_INSUFFICIENT_BALANCE);
                return;
            }
            this.handleBuyFeature(scene);
        });

        closeBtnBg.setInteractive().isButton = true;
        closeBtnBg.on('pointerdown', () => {
            this.hide(scene);
        });

        // Bet control interactions
        minusBtn.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            
            this.currentBetIndex--;
            if (this.currentBetIndex < 0) {
                this.currentBetIndex = this.betOptions.length - 1;
            }
            
            scene.gameData.bet = this.betOptions[this.currentBetIndex];
            this.updateBetDisplay(scene, betValueText, buyText);
            Events.emitter.emit(Events.CHANGE_BET, {});
        });

        plusBtn.on('pointerdown', () => {
            if (scene.gameData.isSpinning) return;
            scene.audioManager.UtilityButtonSFX.play();
            
            this.currentBetIndex++;
            if (this.currentBetIndex >= this.betOptions.length) {
                this.currentBetIndex = 0;
            }
            
            scene.gameData.bet = this.betOptions[this.currentBetIndex];
            this.updateBetDisplay(scene, betValueText, buyText);
            Events.emitter.emit(Events.CHANGE_BET, {});
        });

        // Store references for later use
        (this.popupContainer as any).buyText = buyText;
        (this.popupContainer as any).buyBtnBg = buyBtnBg;
        (this.popupContainer as any).closeBtnBg = closeBtnBg;
        (this.popupContainer as any).betValueText = betValueText;
    }

    private updateBetDisplay(scene: GameScene, betValueText: ButtonText, buyText: ButtonText): void {
        // Update bet value display
        const betValue = scene.gameData.bet.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        betValueText.setText(betValue);
        
        // Update buy feature price
        const cost = scene.gameData.getBuyFeaturePrice();
        buyText.setText(`${scene.gameData.currency}${cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        buyText.setStyle({
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontSize: this.isMobile ? '42px' : '24px',
            fontStyle: 'bold',
            fontWeight: '700',
            align: 'center',
            lineHeight: 'normal'
        });
    }

    show(scene: GameScene): void {
        if (!this.popupContainer) return;

        // Don't show if spinning, autoplay is active, or in bonus round
        if (scene.gameData.isSpinning || 
            scene.autoplay.isAutoPlaying || 
            scene.gameData.isBonusRound) return;

        // Find current bet index
        this.currentBetIndex = this.betOptions.indexOf(scene.gameData.bet);
        if (this.currentBetIndex === -1) {
            this.currentBetIndex = 17; // Default to 1 if not found
        }

        const buyText = (this.popupContainer as any).buyText;
        const betValueText = (this.popupContainer as any).betValueText;
        
        if (this.isMobile) {
            this.updateBetDisplay(scene, betValueText, buyText);
        } else {
            const cost = scene.gameData.getBuyFeaturePrice();
            buyText.setText(`Buy 10 Free Spins\nAt the cost of $${cost}?`);
            buyText.setStyle({
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                fontSize: '48px',
                fontStyle: 'bold',
                fontWeight: '700',
                align: 'center',
                lineHeight: 'normal'
            });
        }

        // Create background mask
        const mask = scene.add.graphics();
        mask.name = 'buyFeatureMask';
        mask.fillStyle(0x000000, 0.7);
        mask.fillRect(0, 0, scene.scale.width, scene.scale.height);
        mask.setInteractive(new Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height), Geom.Rectangle.Contains);
        //mask.on('pointerdown', () => {this.hide(scene);});

        // Add mask to scene instead of popup container to cover entire screen
        scene.add.existing(mask);
        mask.setDepth(999); // Just below the popup

        // Show popup with animation
        this.popupContainer.setVisible(true);
        this.popupContainer.alpha = 0;
        scene.tweens.add({
            targets: this.popupContainer,
            alpha: 1,
            duration: 200,
            ease: 'Cubic.easeOut'
        });
    }

    hide(scene: GameScene): void {
        if (!this.popupContainer) return;

        // Clean up mask first
        scene.children.list.forEach(item => {
            if (item instanceof GameObjects.Graphics && item.name === 'buyFeatureMask') {
                item.destroy();
            }
        });

        scene.tweens.add({
            targets: this.popupContainer,
            alpha: 0,
            duration: 200,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.popupContainer!.setVisible(false);
            }
        });
    }

    private handleBuyFeature(scene: GameScene): void {
        // Reset any existing state
        scene.gameData.isSpinning = false;
        scene.gameData.totalWin = 0;
        Events.emitter.emit(Events.WIN, {});

        // Hide the popup
        this.hide(scene);

        // Trigger the spin without deducting bet amount
        Events.emitter.emit(Events.SPIN, {
            currentRow: scene.gameData.currentRow,
            symbols: scene.gameData.slot.values,
            isBuyFeature: true  // Add flag to indicate this is a buy feature spin
        });
    }

    isVisible(): boolean {
        return this.popupContainer ? this.popupContainer.visible : false;
    }
} 