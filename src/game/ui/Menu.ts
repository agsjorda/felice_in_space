import { Scene, GameObjects, Tweens } from 'phaser';
import { Geom } from 'phaser';
import { GameData, Slot } from '../scenes/components/GameData';
import { AudioManager } from '../scenes/components/AudioManager';
import { SlotMachine } from '../scenes/components/SlotMachine';
import { Autoplay } from '../scenes/components/Autoplay';
import { SymbolContainer } from '../scenes/components/SymbolContainer';

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

export class Menu {
    private menuContainer: ButtonContainer;
    private contentArea: GameObjects.Container;
    private isMobile: boolean = false;
    private width: number = 0;
    private height: number = 0;
    private menuEventHandlers: Function[] = [];
    private isDraggingMusic: boolean = false;
    private isDraggingSFX: boolean = false;
    private scene: GameScene;

    private padding = 20;
    private contentWidth = 1200;
    private viewWidth = 1329;
    private yPosition = 0;
    private scrollView: GameObjects.Container;
    private contentContainer: GameObjects.Container;
    private mask: Phaser.Display.Masks.GeometryMask;
    private isVisible: boolean = false;
    private panel: GameObjects.Container;
    
    // Tab content containers for proper tab switching
    private rulesContent: GameObjects.Container;
    private historyContent: GameObjects.Container;
    private settingsContent: GameObjects.Container;
    private activeTabIndex: number = 0;

    protected titleStyle = {
        fontSize: '24px',
        color: '#379557',
        fontFamily: 'Poppins',
        fontStyle: 'bold'
    };

    protected textStyle = {
        fontSize: '20px',
        color: '#FFFFFF',
        fontFamily: 'Poppins',
        align: 'left',
        wordWrap: { width: this.contentWidth }
    };


    constructor() {
        this.isMobile = this.isMobileDevice();
    }

    preload(){

    }

    create(scene: GameScene){
        // No need to store scene reference
        this.contentContainer = scene.add.container(0, 0);
    }

    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    public createMenu(scene: GameScene): ButtonContainer {
        this.scene = scene; // Store scene reference
        this.width = scene.scale.width;
        this.height = scene.scale.height;

        // Create main menu container
        const menuContainer = scene.add.container(0, 0) as ButtonContainer;
        menuContainer.setDepth(2000);
        menuContainer.setVisible(false);
        menuContainer.setAlpha(0);

        // Create background overlay
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRect(0, 0, this.width, this.height);
        menuContainer.add(bg);

        // Create menu panel - full screen
        const panelWidth = this.width;
        const panelHeight = this.height;
        const panelX = 0;
        const panelY = 0;

        this.panel = scene.add.container(panelX, panelY) as ButtonContainer;
        menuContainer.add(this.panel);

        // Panel background - no border
        const panelBg = scene.add.graphics();
        panelBg.fillStyle(0x181818, 0.95);
        panelBg.fillRect(0, 0, panelWidth, panelHeight);
        this.panel.add(panelBg);

        // Create tabs with different widths
        const tabHeight = 61;
        const normalTabCount = 3;
        const smallTabScale = 0.5; // X tab will be half the width of normal tabs
        const totalTabUnits = normalTabCount + smallTabScale; // 3.5 units total
        const normalTabWidth = panelWidth / totalTabUnits;
        const smallTabWidth = normalTabWidth * smallTabScale;

        const tabConfigs = [
            { text: 'Rules', width: normalTabWidth, x: 0, icon: 'info' },
            { text: 'History', width: normalTabWidth, x: normalTabWidth, icon: 'history' },
            { text: 'Settings', width: normalTabWidth, x: normalTabWidth * 2, icon: 'settings' },
            { text: 'X', width: smallTabWidth, x: normalTabWidth * 3, icon: 'close' }
        ];

        const tabContainers: ButtonContainer[] = [];

        tabConfigs.forEach((tabConfig, index) => {
            const tabContainer = scene.add.container(tabConfig.x, 0) as ButtonContainer;
            
            // Tab background - black for all tabs initially
            const tabBg = scene.add.graphics();
            tabBg.fillStyle(0x000000, 1);
            tabBg.fillRect(0, 0, tabConfig.width, tabHeight);
            tabContainer.add(tabBg);

            // Active tab indicator (green underline) - only for first tab initially
            const activeIndicator = scene.add.graphics();
            activeIndicator.fillStyle(0x00FF00, 1); // Bright green
            activeIndicator.fillRect(0, tabHeight - 3, tabConfig.width, 3);
            activeIndicator.setVisible(index === 0);
            tabContainer.add(activeIndicator);

            // Tab icon (if not close button)
            if (index < 3) {
                let iconText = '';
                let iconColor = '#90EE90'; // Light green
                
                switch (tabConfig.icon) {
                    case 'info':
                        iconText = 'ⓘ';
                        break;
                    case 'history':
                        iconText = '↻';
                        break;
                    case 'settings':
                        iconText = '⚙';
                        break;
                }

                const icon = scene.add.text(15, tabHeight / 2, iconText, {
                    fontSize: this.isMobile ? '18px' : '22px',
                    color: iconColor,
                    fontFamily: 'Arial',
                    align: 'left'
                }) as ButtonText;
                icon.setOrigin(0, 0.5);
                tabContainer.add(icon);
            }

            // Tab text
            const textX = index < 3 ? 45 : tabConfig.width / 2; // Offset for icon on normal tabs
            const textAlign = index < 3 ? 'left' : 'center';
            
            const text = scene.add.text(textX, tabHeight / 2, tabConfig.text, {
                fontSize: this.isMobile ? '16px' : '20px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                align: textAlign
            }) as ButtonText;
            text.setOrigin(index < 3 ? 0 : 0.5, 0.5);
            tabContainer.add(text);

            // Make tab interactive
            tabContainer.setInteractive(
                new Geom.Rectangle(0, 0, tabConfig.width, tabHeight),
                Geom.Rectangle.Contains
            ).isButton = true;

            // Tab click handler
            tabContainer.on('pointerdown', () => {
                scene.audioManager.UtilityButtonSFX.play();
                this.switchTab(scene, tabContainers, index, tabConfigs);
            });

            tabContainers.push(tabContainer);
            this.panel.add(tabContainer);

            this.switchTab(scene, tabContainers, 0, tabConfigs); // initial tab is Rules
        });

        // Create content area with mask to prevent overlap with tabs
        const contentArea = scene.add.container(20, tabHeight + 20);
        contentArea.setSize(panelWidth - 40, panelHeight - tabHeight - 40);
        
        // Create mask for content area to prevent overlap with tabs
        const contentMask = scene.add.graphics();
        contentMask.fillStyle(0xffffff);
        contentMask.fillRect(0, 60, panelWidth, panelHeight);
        const geometryMask = contentMask.createGeometryMask();
        contentArea.setMask(geometryMask);
        contentMask.setVisible(false); // Hide the mask graphics
        
        this.panel.add(contentArea);

        // Store content area reference
        this.contentArea = contentArea;

        // Initialize tab content containers
        this.initializeTabContentContainers(scene);

        // Show initial content (Rules tab)
        this.showTabContent(scene, 0);

        // Store menu container reference
        this.menuContainer = menuContainer;

        return menuContainer;
    }

    private initializeTabContentContainers(scene: GameScene): void {
        // Create separate containers for each tab's content
        this.rulesContent = scene.add.container(0, 0);
        this.historyContent = scene.add.container(0, 0);
        this.settingsContent = scene.add.container(0, 0);
        
        // Add all containers to the content area
        this.contentArea.add(this.rulesContent);
        this.contentArea.add(this.historyContent);
        this.contentArea.add(this.settingsContent);
        
        // Initialize content for each tab
        this.setupScrollableRulesContent(scene);
        this.showHistoryContent(scene, this.historyContent);
        this.createVolumeSettingsContent(scene, this.settingsContent);
        
        // Initially hide all except rules
        this.hideAllTabContent();
        this.rulesContent.setVisible(true);
    }

    private hideAllTabContent(): void {
        this.rulesContent.setVisible(false);
        this.historyContent.setVisible(false);
        this.settingsContent.setVisible(false);
    }

    private setupScrollableRulesContent(scene: GameScene): void {
        // Create scroll view container
        this.scrollView = scene.add.container(0, 0);
        this.contentContainer = scene.add.container(0, 0);
        this.scrollView.add(this.contentContainer);
        
        // Create mask for scrolling
        const maskGraphics = scene.add.graphics();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillRect(0, 0, this.contentArea.width, this.contentArea.height);
        this.mask = maskGraphics.createGeometryMask();
        this.scrollView.setMask(this.mask);
        // Make the mask graphics invisible (it's only used for the mask, not for display)
        maskGraphics.setVisible(false);
        
        // Create the rules content
        this.createHelpScreenContent(scene, this.rulesContent);
        
        // Add scroll view to rules content
        this.rulesContent.add(this.scrollView);
        
        // Enable scrolling
        this.enableScrolling(scene);
    }

    private switchTab(scene: GameScene, tabContainers: ButtonContainer[], activeIndex: number, tabConfigs: any[]): void {
        // Update tab highlighting
        tabContainers.forEach((tabContainer, index) => {
            const tabBg = tabContainer.getAt(0) as GameObjects.Graphics;
            const activeIndicator = tabContainer.getAt(1) as GameObjects.Graphics;
            const tabConfig = tabConfigs[index];
            
            if (index === activeIndex) {
                // Active tab: dark green background with bright green underline
                tabBg.fillStyle(0x2D5A3D, 1); // Dark green background
                tabBg.fillRect(0, 0, tabConfig.width, 61);
                activeIndicator.setVisible(true);
            } else {
                // Inactive tab: black background, no underline
                tabBg.fillStyle(0x000000, 1);
                tabBg.fillRect(0, 0, tabConfig.width, 61);
                activeIndicator.setVisible(false);
            }
        });

        // Show content for active tab
        this.showTabContent(scene, activeIndex);
    }

    private showTabContent(scene: GameScene, tabIndex: number): void {
        if (!this.contentArea) return;
        
        this.activeTabIndex = tabIndex;
        this.hideAllTabContent();

        switch (tabIndex) {
            case 0: // Rules
                this.rulesContent.setVisible(true);
                break;
            case 1: // History
                this.historyContent.setVisible(true);
                break;
            case 2: // Settings
                this.settingsContent.setVisible(true);
                break;
            case 3: // X (Close)
                this.hideMenu(scene);
                break;
        }
    }



    private showHistoryContent(scene: GameScene, contentArea: GameObjects.Container): void {
        // Create a simple history page with "HISTORY" text
        const historyText = scene.add.text(15, 15,'History', this.titleStyle) as ButtonText;
        historyText.setOrigin(0, 0);
        contentArea.add(historyText);
    }

    private createVolumeSettingsContent(scene: GameScene, contentArea: GameObjects.Container): void {
        const scaleFactor = 1;
        const widthSlider = 300;

        // Title - Settings in green color #379557
        const title = scene.add.text(15, 15, 'Settings', this.titleStyle) as ButtonText;
        title.setOrigin(0, 0);
        contentArea.add(title);

        // Calculate proper positions
        const startX = 15;
        const startY = 15;
        const sliderStartX = startX;
        const musicSliderY = startY + 80;
        const sfxSliderY = startY + 220;

        // Music section
        const musicIcon = scene.add.image(startX + 10, startY + 60, 'volume') as ButtonImage;
        musicIcon.setScale(0.5 * scaleFactor);
        contentArea.add(musicIcon);

        const musicLabel = scene.add.text(startX + 40, startY + 50, 'Background Music', {
            fontSize: '18px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(musicLabel);

        // SFX section
        const sfxIcon = scene.add.image(startX + 10, startY + 200, 'volume') as ButtonImage;
        sfxIcon.setScale(0.5 * scaleFactor);
        contentArea.add(sfxIcon);

        const sfxLabel = scene.add.text(startX + 40, startY + 190, 'Sound FX', {
            fontSize: '18px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(sfxLabel);

                // Music slider background
        const musicSliderBg = scene.add.graphics();
        musicSliderBg.fillStyle(0x379557, 1);
        musicSliderBg.fillRoundedRect(sliderStartX, musicSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        
        const musicSliderBg2 = scene.add.graphics();
        musicSliderBg2.fillStyle(0x333333, 1);
        musicSliderBg2.lineStyle(1, 0x666666);
        musicSliderBg2.fillRoundedRect(sliderStartX, musicSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        musicSliderBg2.strokeRoundedRect(sliderStartX, musicSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        
        contentArea.add(musicSliderBg2);
        contentArea.add(musicSliderBg);

        const musicSlider = scene.add.graphics();
        musicSlider.fillStyle(0xffffff, 1);
        musicSlider.fillCircle(sliderStartX + 0.75 * widthSlider * scaleFactor, musicSliderY + 4, 12 * scaleFactor);
        contentArea.add(musicSlider);

        // Music value text
        const musicValue = scene.add.text(sliderStartX , musicSliderY + 15, '75%', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(musicValue);

        // SFX slider
        const sfxSliderBg = scene.add.graphics();
        sfxSliderBg.fillStyle(0x379557, 1);
        sfxSliderBg.fillRoundedRect(sliderStartX, sfxSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        
        const sfxSliderBg2 = scene.add.graphics();
        sfxSliderBg2.fillStyle(0x333333, 1);
        sfxSliderBg2.lineStyle(1, 0x666666);
        sfxSliderBg2.fillRoundedRect(sliderStartX, sfxSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        sfxSliderBg2.strokeRoundedRect(sliderStartX, sfxSliderY, widthSlider * scaleFactor, 8 * scaleFactor, 4 * scaleFactor);
        
        contentArea.add(sfxSliderBg2);
        contentArea.add(sfxSliderBg);

        const sfxSlider = scene.add.graphics();
        sfxSlider.fillStyle(0xffffff, 1);
        sfxSlider.fillCircle(sliderStartX + 0.75 * widthSlider * scaleFactor, sfxSliderY + 4, 12 * scaleFactor);
        contentArea.add(sfxSlider);

        // SFX value text
        const sfxValue = scene.add.text(sliderStartX, sfxSliderY + 15, '75%', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(sfxValue);

        // Helper to update slider positions and values
        const updateSliders = (musicX: number | null = null, sfxX: number | null = null) => {
            const sliderWidth = widthSlider * scaleFactor;

            const musicVol = musicX !== null ? 
                Math.max(0, Math.min(1, (musicX - sliderStartX) / sliderWidth)) : 
                scene.audioManager.getMusicVolume();
            
            const sfxVol = sfxX !== null ? 
                Math.max(0, Math.min(1, (sfxX - sliderStartX) / sliderWidth)) : 
                scene.audioManager.getSFXVolume();
            
            // Update music slider
            musicSlider.clear();
            musicSlider.fillStyle(0xffffff, 1);
            const musicSliderX = sliderStartX + (musicVol * sliderWidth);
            musicSlider.fillCircle(musicSliderX, musicSliderY + 4, 12 * scaleFactor);
            musicSliderBg.clear();
            musicSliderBg.fillStyle(0x379557, 1);
            musicSliderBg.fillRoundedRect(sliderStartX, musicSliderY, sliderWidth * musicVol, 8 * scaleFactor, 4 * scaleFactor);
            musicValue.setText(Math.round(musicVol * 100) + '%');
            
            // Update SFX slider
            sfxSlider.clear();
            sfxSlider.fillStyle(0xffffff, 1);
            const sfxSliderX = sliderStartX + (sfxVol * sliderWidth);
            sfxSlider.fillCircle(sfxSliderX, sfxSliderY + 4, 12 * scaleFactor);
            sfxSliderBg.clear();
            sfxSliderBg.fillStyle(0x379557, 1);
            sfxSliderBg.fillRoundedRect(sliderStartX, sfxSliderY, sliderWidth * sfxVol, 8 * scaleFactor, 4 * scaleFactor);
            sfxValue.setText(Math.round(sfxVol * 100) + '%');

            // Update volumes
            if (musicX !== null) scene.audioManager.setMusicVolume(musicVol);
            if (sfxX !== null) scene.audioManager.setSFXVolume(sfxVol);

            // Update interactive areas for sliders
            musicSlider.setInteractive(
                new Geom.Circle(musicSliderX, musicSliderY + 4, 15 * scaleFactor),  
                Geom.Circle.Contains
            );
            sfxSlider.setInteractive(
                new Geom.Circle(sfxSliderX, sfxSliderY + 4, 15 * scaleFactor),
                Geom.Circle.Contains
            );
        };

        // Initial slider setup
        updateSliders();
        
                musicIcon.setInteractive();
        musicIcon.on('pointerdown', () => {
            if(scene.audioManager.getMusicVolume() === 0) {
                scene.audioManager.setMusicVolume(1);
                musicIcon.setTint(0xFFFFFF);
            } else {
                scene.audioManager.setMusicVolume(0);
                musicIcon.setTint(0xFF0000);
            }
            updateSliders();
        });

        sfxIcon.setInteractive();
        sfxIcon.on('pointerdown', () => {
            if(scene.audioManager.getSFXVolume() === 0) {
                scene.audioManager.setSFXVolume(1);
                sfxIcon.setTint(0xFFFFFF);
            } else {
                scene.audioManager.setSFXVolume(0);
                sfxIcon.setTint(0xFF0000);
            }
            updateSliders();
        });

        // Make sliders draggable
        this.isDraggingMusic = false;
        this.isDraggingSFX = false;

        // Global pointer move and up handlers
        const pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
            if (this.isDraggingMusic) {
                const sliderWidth = widthSlider * scaleFactor;
                const localX = pointer.x - contentArea.x - sliderStartX;
                updateSliders(Math.max(0, Math.min(sliderWidth, localX)), null);
            } else if (this.isDraggingSFX) {
                const sliderWidth = widthSlider * scaleFactor;
                const localX = pointer.x - contentArea.x - sliderStartX;
                updateSliders(null, Math.max(0, Math.min(sliderWidth, localX)));
            }
        };

        const pointerUpHandler = () => {
            this.isDraggingMusic = false;
            this.isDraggingSFX = false;
        };

        // Store handlers for cleanup
        this.menuEventHandlers.push(pointerMoveHandler, pointerUpHandler);

        this.scene.input.on('pointermove', pointerMoveHandler);
        this.scene.input.on('pointerup', pointerUpHandler);

        // Create clickable areas for the entire slider tracks
        const musicSliderTrack = scene.add.graphics();
        musicSliderTrack.fillStyle(0x000000, 0); // Transparent
        musicSliderTrack.fillRect(sliderStartX, musicSliderY - 10, widthSlider * scaleFactor, 28);
        musicSliderTrack.setInteractive(
            new Geom.Rectangle(sliderStartX, musicSliderY - 10, widthSlider * scaleFactor, 28),
            Geom.Rectangle.Contains
        );
        contentArea.add(musicSliderTrack);

        const sfxSliderTrack = scene.add.graphics();
        sfxSliderTrack.fillStyle(0x000000, 0); // Transparent
        sfxSliderTrack.fillRect(sliderStartX, sfxSliderY - 10, widthSlider * scaleFactor, 28);
        sfxSliderTrack.setInteractive(
            new Geom.Rectangle(sliderStartX, sfxSliderY - 10, widthSlider * scaleFactor, 28),
            Geom.Rectangle.Contains
        );
        contentArea.add(sfxSliderTrack);

        // Music slider track click handler
        musicSliderTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - contentArea.x - sliderStartX;
            const sliderWidth = widthSlider * scaleFactor;
            const newVolume = Math.max(0, Math.min(1, localX / sliderWidth));
            scene.audioManager.setMusicVolume(newVolume);
            updateSliders();
        });

        // SFX slider track click handler
        sfxSliderTrack.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            const localX = pointer.x - contentArea.x - sliderStartX;
            const sliderWidth = widthSlider * scaleFactor;
            const newVolume = Math.max(0, Math.min(1, localX / sliderWidth));
            scene.audioManager.setSFXVolume(newVolume);
            updateSliders();
        });

        // Music slider handle interaction
        musicSlider.on('pointerdown', () => {
            this.isDraggingMusic = true;
        });

        // SFX slider handle interaction
        sfxSlider.on('pointerdown', () => {
            this.isDraggingSFX = true;
        });
    }

    public showMenu(scene: GameScene): void {        
        this.createMenu(scene);

        this.menuContainer.setVisible(true);
        this.menuContainer.setAlpha(0);
        this.isVisible = true;
        
        scene.tweens.add({
            targets: this.menuContainer,
            alpha: 1,
            duration: 300,
            ease: 'Power2'
        });
    }

    public hideMenu(scene: GameScene): void {
        if (!this.menuContainer) return;
        
        // Ensure menu container and all its children are hidden
        this.menuContainer.setVisible(false);
        this.menuContainer.setActive(false);
        this.isVisible = false;
        
        // Reset help screen visibility state
        scene.gameData.isHelpScreenVisible = false;
        
        // Clean up event handlers
        if (this.menuEventHandlers) {
            this.menuEventHandlers.forEach(handler => {
                scene.input.off('pointermove', handler);
                scene.input.off('pointerup', handler);
            });
            this.menuEventHandlers = [];
        }
        
        // Reset dragging states
        this.isDraggingMusic = false;
        this.isDraggingSFX = false;
    }



    private addContent(scene: GameScene, _text: string, _type: string, _wordWrap: boolean = false, _wordWrapWidth: number = 0): void {
        if (_type === 'title') {
            const content = scene.add.text(this.padding / 2, this.yPosition, _text, this.titleStyle as Phaser.Types.GameObjects.Text.TextStyle);
            this.contentContainer.add(content);
            if (_text === 'Bonus Trigger') {
                content.setPosition(content.x + this.padding * 2, content.y);
            }
            this.yPosition += content.height + this.padding;
        } else if (_type === 'text') {
            const style = { ...this.textStyle } as Phaser.Types.GameObjects.Text.TextStyle;
            if (_wordWrap) {
                // wordWrap should be an object, not undefined
                style.wordWrap = { width: _wordWrapWidth };
            }
            const content = scene.add.text(this.padding / 2, this.yPosition, _text, style);
            this.contentContainer.add(content);
            this.yPosition += content.height + this.padding;
        }
    }


    private createHelpScreenContent(scene: GameScene, contentArea: GameObjects.Container): void {
            this.padding = 10;
            this.contentWidth = this.isMobile ? scene.scale.width - this.padding * 6 : this.viewWidth - this.padding * 12;
            this.yPosition = this.padding;
    
            this.addContent(scene, 'Game Rules', 'title');
    
            this.addContent(scene, 'Win by landing 8 or more matching symbols anywhere on the screen. The more matching symbols you get, the higher your payout.', 
                'text', true, this.contentWidth);
    
            this.addContent(scene, 'RTP', 'title');
            this.addContent(scene, '96.49% - 96.6%', 'text');
    
            this.yPosition += this.padding * 2;
    
            this.addContent(scene, 'Payout', 'title');
            
            this.yPosition += this.padding * 12;
    
            // Create 9 row symbol grid with payouts
            const symbolSize = 153;
            const symbolScale = 0.75;
            const scaledSymbolSize = symbolSize * symbolScale;
            for (let i = 0; i < 9; i++) {
                const cellX = this.padding;
                const cellY = this.yPosition;
    
                // Create symbol container with white border
                const symbolContainer = scene.add.container(cellX, cellY);
    
                this.createBorder(scene, symbolContainer, 
                    -this.padding / 2, 
                    -scaledSymbolSize + this.padding * 3, 
                    this.contentWidth + this.padding * 3,
                    scaledSymbolSize * 1.25
                );
    
                // Add symbol using SymbolContainer
                const symbol = new SymbolContainer(scene, this.padding * 3, 0, i + 1, scene.gameData);
                
                // Apply symbol size adjustment similar to SlotMachine.ts line 431
                const symbolValue = i + 1;
                if (symbolValue === 2 || symbolValue === 4 || symbolValue === 6) {
                    // Adjust ratio for symbols 2, 4, and 6 to match other symbols
                    symbol.setSymbolDisplaySize(
                        symbolSize * symbolScale * (1 + Slot.SYMBOL_SIZE_ADJUSTMENT), 
                        symbolSize * symbolScale * (1 - Slot.SYMBOL_SIZE_ADJUSTMENT)
                    );
                } else {
                    // Regular symbols
                    symbol.setSymbolDisplaySize(symbolSize * symbolScale, symbolSize * symbolScale);
                }
                
                symbol.setScale(symbolScale);
                symbol.getSymbolSprite().setOrigin(0, 0.7);
                symbolContainer.add(symbol);
                if(i == 5){
                    symbol.setPosition(symbol.x, symbol.y + this.padding);
                }
    
    
                // Add payout table next to symbol
                this.createPayoutTable(scene,
                    scaledSymbolSize + symbolSize/5,  // Position table right of symbol
                    0,                      // Center vertically with symbol
                    symbolContainer,
                    i + 1
                );
    
                this.contentContainer.add(symbolContainer);
                symbolContainer.setPosition(0, symbolContainer.y);
                this.yPosition += scaledSymbolSize + this.padding * 5;  // Move to next row
            }
            this.yPosition -=  scaledSymbolSize;
    
            this.yPosition += this.padding * 4;
            this.addContent(scene, 'Scatter', 'text');
    
            this.yPosition += this.padding * 4;
            { // scatter payouts
                const cellX = -this.padding / 2;
                const cellY = this.yPosition;
    
                // Create symbol container with white border
                const symbolContainer = scene.add.container(cellX, cellY );
    
                this.createBorder(scene, symbolContainer, 
                    0, 
                    -scaledSymbolSize + this.padding * 3, 
                    this.contentWidth + this.padding * 3 ,
                    scaledSymbolSize * 4
                );
    
                // Add symbol
                const symbol = scene.add.sprite(0, 0, 'ScatterLabel');
                symbol.setScale(0.7);
                symbol.setOrigin(0.5, 0.5);
                symbolContainer.add(symbol);
                symbol.setPosition(scene.scale.width * 0.4, this.padding);
    
                // Add payout table next to symbol
                this.createPayoutTable(scene, 
                    symbol.x / 3,  // Position table right of symbol
                    symbol.height * 0.9,                      // Center vertically with symbol
                    symbolContainer,
                    0       
                );
    
                this.contentContainer.add(symbolContainer);
                this.contentContainer.sendToBack(symbolContainer);
                this.yPosition += scaledSymbolSize * 5;  // Move to next row
            }
    
            this.yPosition -= scaledSymbolSize * 1.5;
            this.addContent(scene, 'Tumble Win', 'title');
    
            const tumbleWinContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, tumbleWinContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 5.75 
            );
            this.contentContainer.add(tumbleWinContainer);
            this.createHowToPlayEntry(scene, 20, 170, tumbleWinContainer, 'tumbleGame', 
                'After each spin, winning symbols are paid and then removed from the screen. Remaining symbols drop down, and new ones fall from above to fill the empty spaces.\n\n' +
                'Tumbles continue as long as new winning combinations appear — there\'s no limit to the number of tumbles per spin.\n\n' +
                'All wins are credited to the player\'s balance after all tumbles from a base spin are completed.',
            true, this.contentWidth + this.padding * 5);
    
    
            const tumbleSymbolImage = scene.add.image(0, 0, 'tumbleSymbol');
            tumbleSymbolImage.setScale(0.5);
            tumbleSymbolImage.setOrigin(0.5, 0.5);
            tumbleSymbolImage.setPosition(70, 85);
            tumbleWinContainer.add(tumbleSymbolImage);
            
    
            const tumbleWinImage = scene.add.image(0, 0, 'tumbleWin');
            tumbleWinImage.setScale(0.5);
            tumbleWinImage.setOrigin(0.5, 0.5);
            tumbleWinImage.setPosition(tumbleSymbolImage.x - tumbleSymbolImage.displayWidth/2 + this.padding * 2, tumbleSymbolImage.y - tumbleWinImage.height/3);
            tumbleWinContainer.add(tumbleWinImage);
            
            this.yPosition -= scaledSymbolSize * 5.75;
            
            this.yPosition -= this.padding * 1.25;
            this.addContent(scene, 'Free Spins Rules', 'title');
            this.yPosition += this.padding * 1.25;

            this.yPosition += scaledSymbolSize  * 1.75;
            this.addContent(scene, 'Bonus Trigger', 'title');
            this.yPosition -= scaledSymbolSize  * 1.75;
    
            const freeSpinContainer = scene.add.container(-this.padding * 1.5, this.yPosition-scaledSymbolSize * 0.5);
            this.yPosition += this.createBorder(scene, freeSpinContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 4.5
                
            );
            this.contentContainer.add(freeSpinContainer);
            this.contentContainer.sendToBack(freeSpinContainer);
            this.yPosition -= this.padding * 2;
            this.createHowToPlayEntry(scene, 20, 120, freeSpinContainer, 'scatterGame', 
                'Land 4 or more         SCATTER \nsymbols anywhere on the screen to trigger the free spins feature.\n\n' +
                'You\'ll start with 10 free spins.\n\n' +
                'During the bonus round, hitting 3 or more scatter symbols awards 5 extra free spins', 
            true, this.contentWidth + this.padding * 3);
    
            const scatterSymbolImage2 = scene.add.image(0, 0, 'scatterIcon');
            scatterSymbolImage2.setScale(0.25);
            scatterSymbolImage2.setOrigin(0.5, 0.5);
            scatterSymbolImage2.setPosition(195, 300);
            freeSpinContainer.add(scatterSymbolImage2);
    
            const scatterSymbolImage = scene.add.image(0, 0, 'scatterIcon');
            scatterSymbolImage.setScale(0.5);
            scatterSymbolImage.setOrigin(0.5, 0.5);
            scatterSymbolImage.setPosition(100, 60);
            freeSpinContainer.add(scatterSymbolImage);
            
            const scatterWinImage = scene.add.image(0, 0, 'scatterWin');
            scatterWinImage.setScale(0.5);
            scatterWinImage.setOrigin(0.5, 0.5);
            scatterWinImage.setPosition(scatterSymbolImage.x - scatterSymbolImage.displayWidth/2 + this.padding * 2, scatterSymbolImage.y * 3/4 - scatterWinImage.height/ 4);
            freeSpinContainer.add(scatterWinImage);
            
            this.yPosition -= scaledSymbolSize * 3;
            //this.addDivider(0x379557);
    
            //this.yPosition += scaledSymbolSize  * 4;
            this.addContent(scene, 'Multiplier', 'title');
            this.yPosition -= scaledSymbolSize  * 2.5;
            
            const multiplierContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, multiplierContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 6.5
            );
            this.yPosition += scaledSymbolSize *6;
            this.contentContainer.add(multiplierContainer);
            this.contentContainer.sendToBack(multiplierContainer);
            
    
            this.createHowToPlayEntry(scene, 20, 150, multiplierContainer, 'multiplierGame', 
                '\nThe         Multiplier symbol only appears during the FREE SPINS round and remains on the screen until the tumbling sequence ends.\n\n' +
                'Each time a         symbol lands, it randomly takes a multiplier value: 2x, 3x, 4x, 5x, 6x, 8x, 10x, 12x, 15x, 20x, 25x, 50x, or even 100x!\n\n' +
                'Once all tumbles are finished, the total of all           multipliers is added and applied to the total win of the that sequence.\n\n' +
                'Special reels are used during the FREE SPINS round.',
            true, this.contentWidth + this.padding * 3);
    
            
                const multiplierIcon4 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon4.setScale(0.15);
                multiplierIcon4.setOrigin(0.5, 0.5);
                multiplierIcon4.setPosition(80, 280);
                multiplierContainer.add(multiplierIcon4);
            
                const multiplierIcon3 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon3.setScale(0.15);
                multiplierIcon3.setOrigin(0.5, 0.5);
                multiplierIcon3.setPosition(163, 405);
                multiplierContainer.add(multiplierIcon3);
                
            
                const multiplierIcon2 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon2.setScale(0.15);
                multiplierIcon2.setOrigin(0.5, 0.5);
                multiplierIcon2.setPosition(100, 550);
                multiplierContainer.add(multiplierIcon2);
            
            const multiplierIcon = scene.add.image(0, 0, 'multiplierIcon');
            multiplierIcon.setScale(0.25);
            multiplierIcon.setOrigin(0.5, 0.5);
            multiplierIcon.setPosition(40, 75);
            multiplierContainer.add(multiplierIcon);
            this.contentContainer.bringToTop(multiplierIcon);
            
            this.yPosition -= scaledSymbolSize * 12.5;
            this.addContent(scene, 'Game Settings', 'title');
    
            const gamesettingsContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, gamesettingsContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 6
            );
            this.contentContainer.add(gamesettingsContainer);
    
            this.yPosition -= scaledSymbolSize * 6;
    
            this.addContent(scene, 'Paylines', 'title');
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 0.6, gamesettingsContainer, '', 'Symbols can land anywhere on the screen.', true, this.contentWidth + this.padding * 3);
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 1.75, gamesettingsContainer, 'paylineMobileWin', '');
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 3.25, gamesettingsContainer, 'paylineMobileNoWin', '');
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 4.0, gamesettingsContainer, '', 'All wins are multiplied by the base bet. \n\n'+
                'When multiple symbol wins occur, all values are combined into the total win. \n\n'+
                'Free spins rewards are granted after the round ends.', true, this.contentWidth + this.padding * 3);
    
            this.yPosition -= scaledSymbolSize * 3;
    
            this.commonRules(scene, this.contentWidth, 153);
    
            this.yPosition -= scaledSymbolSize * 38;
            contentArea.add(this.contentContainer);
    }
    
    private commonRules(scene: GameScene, genericTableWidth: number, scaledSymbolSize: number): void {
        
        this.addContent(scene, 'How to Play', 'title');
        const commonPadding = 20;
        
        const howToPlayContainer = scene.add.container(0, this.yPosition);

        this.yPosition += this.createBorder(scene, howToPlayContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 25
        );
        this.contentContainer.add(howToPlayContainer);

        this.createHeader(scene, commonPadding , this.isMobile ? commonPadding / 2 : commonPadding * 1.5, howToPlayContainer, 'Bet Controls', '#379557');

        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 5 : commonPadding * 6 , howToPlayContainer, this.isMobile ? 'howToPlay1Mobile' : 'howToPlay1', this.isMobile ? '' : 'Adjust your total bet.');

        this.createHeader(scene, commonPadding, this.isMobile ? commonPadding * 9.5 : commonPadding * 9, howToPlayContainer, 'Game Actions', '#379557');
        
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 15 : commonPadding * 14, howToPlayContainer, this.isMobile ? 'howToPlay2Mobile' : 'howToPlay2', this.isMobile ? '' : 'Start the game round.');
        this.createHowToPlayEntry(scene, commonPadding / 3, this.isMobile ? commonPadding * 25 : commonPadding * 21, howToPlayContainer, this.isMobile ? 'howToPlay11Mobile' : 'BuyFeatHelp', this.isMobile ? '' : 'Lets you buy the free spins round for 100x your total bet.');
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 38 : commonPadding * 28, howToPlayContainer, this.isMobile ? 'howToPlay12Mobile' : 'DoubleHelp', this.isMobile ? '' : 'You\'re wagering 25% more per spin, but you also have better chances at hitting big features.');
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 50 : commonPadding * 35, howToPlayContainer, this.isMobile ? 'howToPlay3Mobile' : 'howToPlay3', this.isMobile ? '' : 'Open the autoplay menu. Tap again to stop autoplay.');
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 60 : commonPadding * 42, howToPlayContainer, this.isMobile ? 'howToPlay4Mobile' : 'howToPlay4', this.isMobile ? '' : 'Speeds up the game.');

        this.createHeader(scene, commonPadding, this.isMobile ? commonPadding * 66 : commonPadding * 52, howToPlayContainer, 'Display & Stats', '#379557');

        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 70 : commonPadding * 52, howToPlayContainer, 'howToPlay5', 'Shows your current available credits.', true, this.contentWidth + this.padding * 3);
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 79 : commonPadding * 59, howToPlayContainer, 'howToPlay6', 'Display your total winnings from the current round.', true, this.contentWidth + this.padding * 3);
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 88 : commonPadding * 66, howToPlayContainer, 'howToPlay7', 'Adjust your wager using the - and + buttons.', true, this.contentWidth + this.padding * 3);

        this.createHeader(scene, commonPadding, this.isMobile ? commonPadding * 96 : commonPadding * 71, howToPlayContainer, 'General Controls', '#379557');

        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 102 : commonPadding * 74, howToPlayContainer, this.isMobile ? 'howToPlay8Mobile' : 'howToPlay8', this.isMobile ? '' : 'Toggle game sounds on and off.');  
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 110.5 : commonPadding * 78, howToPlayContainer, this.isMobile ? 'howToPlay9Mobile' : 'howToPlay9', this.isMobile ? '' : 'Access gameplay preferences and system options.');
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 120 : commonPadding * 83, howToPlayContainer, this.isMobile ? 'howToPlay10Mobile' : 'howToPlay10', this.isMobile ? '' : 'View game rules, features, and paytable.');        

        this.yPosition -= scaledSymbolSize * 5;
    }

    private createHeader(scene: GameScene, x: number, y: number, container: GameObjects.Container, text: string, color: string): void {
        const genericTableWidth = this.isMobile ? this.viewWidth - this.padding * 2 : 1129;
        
        const header = scene.add.text(0, 0,text,
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 },
                fontSize: '20px',
                color: color,
                fontFamily: 'Poppins',
                fontStyle: 'bold'
            }
        );
        header.setPosition(x, y);
        container.add(header);
    }

    private enableScrolling(scene: Scene): void {
        let isDragging = false;
        let startY = 0;
        let currentY = 0;
        let lastY = 0;
        let dragVelocity = 0;
        const minVelocity = 0.1;

        // Make the scroll view interactive for the content area width and height
        this.scrollView.setInteractive(new Phaser.Geom.Rectangle(
            0, 0,
            this.contentArea.width,
            this.contentArea.height
        ), Phaser.Geom.Rectangle.Contains);

        this.scrollView.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            isDragging = true;
            startY = pointer.y;
            lastY = pointer.y;
            // Stop any ongoing momentum scrolling
            if (scene.tweens.isTweening(this.contentContainer)) {
                scene.tweens.killTweensOf(this.contentContainer);
            }
        });

        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!isDragging || !this.isVisible) return;

            // Calculate the distance moved since last frame
            const deltaY = pointer.y - lastY;
            lastY = pointer.y;
            
            // Update velocity
            dragVelocity = deltaY;

            // Update position
            currentY = this.contentContainer.y + deltaY;
            
            // Calculate bounds
            const maxY = 0;
            const contentHeight = this.yPosition;
            const viewHeight = this.contentArea.height;
            const minY = Math.min(0, viewHeight - contentHeight);
            
            // Apply bounds with elastic effect
            if (currentY > maxY) {
                currentY = maxY + (currentY - maxY) * 0.5;
            } else if (currentY < minY) {
                currentY = minY + (currentY - minY) * 0.5;
            }
            
            this.contentContainer.y = currentY;
        });

        scene.input.on('pointerup', () => {
            if (!isDragging) return;
            isDragging = false;

            // Apply momentum scrolling
            if (Math.abs(dragVelocity) > minVelocity) {
                let targetY = this.contentContainer.y + (dragVelocity * 20);
                
                // Calculate bounds
                const maxY = 0;
                const contentHeight = this.yPosition;
                const viewHeight = this.contentArea.height;
                const minY = Math.min(0, viewHeight - contentHeight);
                
                // Clamp target position
                targetY = Phaser.Math.Clamp(targetY, minY, maxY);
                
                scene.tweens.add({
                    targets: this.contentContainer,
                    y: targetY,
                    duration: 500,
                    ease: 'Cubic.out'
                });
            } else {
                // If velocity is too low, just snap to bounds
                const maxY = 0;
                const minY = Math.min(0, scene.scale.height - this.yPosition);
                const targetY = Phaser.Math.Clamp(this.contentContainer.y, minY, maxY);
                
                if (targetY !== this.contentContainer.y) {
                    scene.tweens.add({
                        targets: this.contentContainer,
                        y: targetY,
                        duration: 200,
                        ease: 'Cubic.out'
                    });
                }
            }
        });

        // Enable mouse wheel scrolling
        scene.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
            if (!this.isVisible) return;
            
            // Calculate new position
            currentY = this.contentContainer.y - deltaY;
            
            // Calculate bounds
            const maxY = 0;
            const contentHeight = this.yPosition;
            const viewHeight = this.contentArea.height;
            const minY = Math.min(0, viewHeight - contentHeight);
            
            // Clamp the position
            currentY = Phaser.Math.Clamp(currentY, minY, maxY);
            
            // Animate to new position
            scene.tweens.add({
                targets: this.contentContainer,
                y: currentY,
                duration: 100,
                ease: 'Cubic.out'
            });
        });
    }

    
    private createHowToPlayEntry(scene: GameScene, x: number, y: number, container: GameObjects.Container, image: string, text: string, wordWrap: boolean = false, wordWrapWidth: number = 0): void {
        let imageElement = null;
        if(image!=''){
            imageElement = scene.add.image(x, y, image);
        }
        if(imageElement != null){
            if(image == 'tumbleGame' || image == 'scatterGame' || image == 'multiplierGame'){
                imageElement.setScale(0.5);
            }
            imageElement.setOrigin(0, 0.5);
        }
        if(image == 'BuyFeatMobile'){
            imageElement?.setPosition(x - imageElement.displayWidth/5, y);
        }
        if(imageElement != null){
            container.add(imageElement);
        }
     
        const textElement = scene.add.text(
            0, 0,
            text,
            {
                ...this.textStyle,
                wordWrap: wordWrap ? { width: wordWrapWidth } : undefined,
            }
        );
        textElement.setPosition(
            this.isMobile ? x : x + (imageElement != null ? imageElement.displayWidth + this.padding : 0),
            this.isMobile ? (imageElement != null ? imageElement.y + imageElement.displayHeight / 2 + this.padding * 2 : y) :
                            (imageElement != null ? imageElement.y - imageElement.displayHeight / 10: y));
        textElement.setOrigin(0, 0);
        
        if(image == 'BuyFeatMobile'){
            textElement.setPosition(x, y + this.padding*5 );
        }
        if(image == 'scatterGame'){
            textElement.setPosition(x, textElement.y + this.padding * 6);
        }
        container.add(textElement); 
        if(this.isMobile){
            this.yPosition += (imageElement != null ? imageElement.displayHeight * 2 : 0) + textElement.displayHeight + this.padding * 2;
        }
    }

    private createBorder(scene: GameScene, _container: GameObjects.Container, _x: number, _y: number, _width: number, _height: number): number {
        const border = scene.add.graphics();
        border.fillStyle(0x333333);
        border.fillRoundedRect(_x, _y, _width, _height, 8);
        border.lineStyle(2, 0x333333);
        border.strokeRoundedRect(_x, _y, _width, _height, 8);
        border.setAlpha(0.7);
        _container.add(border);
        _container.sendToBack(border);
        return _height;
    }

    private addDivider(scene: GameScene, _color: number = 0xFFFFFF): void {
        // Add divider
        const divider = scene.add.graphics();
        divider.lineStyle(2, _color);
        const x2 = this.isMobile ? this.viewWidth - this.padding * 4 : this.contentWidth + this.padding * 2;
        divider.lineBetween(this.padding, this.yPosition, x2, this.yPosition );
        this.contentContainer.add(divider);
        this.yPosition += this.padding;
    }

    private createPayoutTable(scene: GameScene, x: number, y: number, container: GameObjects.Container, symbolIndex: number): void {
        const cellWidth1 = this.isMobile ? 45 : 45; 
        const cellWidth2 = this.isMobile ? 100 : 80;
        const cellHeight = 22.5;
        const cellPadding = 5;

        const tableHeight = (cellHeight + cellPadding) * 4;
        const matchNumRange : string[] = ['12+', '10', '8'];
        const scatterNumRange : string[] = ['6', '5', '4'];
        const scatterText: string[] = [
            'This is the SCATTER symbol.', 
            'SCATTER symbol is present on all reels.', 
            'SCATTER pays on any position.'
        ];
        // Center the table vertically relative to the symbol
        const tableY = y - tableHeight / 2;

        // Create table background
        const graphics = scene.add.graphics();

        let payoutAdjustments : [number, number, number] = [0, 0, 0];
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                let cellWidth = 0;
                if(col == 0) {
                    cellWidth = cellWidth1;
                } else if(col == 1) {
                    cellWidth = cellWidth2;
                } else {
                    cellWidth = cellWidth2 * 2;
                }
                const cellX = x + (col == 2 ? cellWidth1 + cellWidth2 : col * (cellWidth /2 ));
                const cellY = tableY + row * (cellHeight + cellPadding);

                // Draw cell border
                graphics.strokeRect(cellX, cellY, cellWidth, cellHeight);

                if(symbolIndex != 0) {
                    // For regular symbols
                    if(col < 2) {
                        const text2 = (scene.gameData.winamounts[row][symbolIndex] * scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        payoutAdjustments[row] = text2.length;

                        let text : string;  
                        const repeatTimes = payoutAdjustments[0] - text2.length;

                        if(repeatTimes > 0){
                            text = col == 0 ? matchNumRange[row] : 
                                ' '.repeat(repeatTimes) + scene.gameData.currency + text2;
                        }
                        else{
                            text = col == 0 ? matchNumRange[row] : 
                                scene.gameData.currency + text2;
                        }

                        let textElement : GameObjects.Text;
                         if(col == 0){
                            textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
                                fontSize: '20px',
                                color: '#FFFFFF',
                                fontFamily: 'Poppins', 
                                align: 'left'
                            });
                        }
                        else{
                            textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
                                fontSize: '20px',
                                color: '#FFFFFF',
                                fontFamily: 'Poppins', 
                                align: 'right'
                            });
                        }

                        textElement.setOrigin(col == 0 ? 0 : 0.5, 0.5);
                        container.add(textElement);
                    }
                } else {
                    // For scatter symbol
                    const text2 = (scene.gameData.winamounts[row][symbolIndex] * scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        payoutAdjustments[row] = text2.length;

                        let text : string;  
                        const repeatTimes = payoutAdjustments[0] - text2.length;

                        if(repeatTimes > 0){
                            text = col == 0 ? scatterNumRange[row] : 
                                ' '.repeat(repeatTimes) + scene.gameData.currency + text2;
                        }
                        else{
                            text = col == 0 ? scatterNumRange[row] : 
                                scene.gameData.currency + text2;
                        }

                    if(col == 0) {
                        const textElement = scene.add.text(cellX + cellWidth + this.padding, cellY + cellHeight/2, text, {
                            fontSize: '20px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins'
                        });
                        textElement.setOrigin(col == 0 ? 0 : 0.5, 0.5);
                        container.add(textElement);
                    } else if(col == 1) {
                        
                        const textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
                            fontSize: '20px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins'
                        });
                        textElement.setOrigin(0.5, 0.5);
                        container.add(textElement);
                    
                    } else {
                        const scatterTextCell = scene.add.text(
                            cellX + cellWidth/2 + this.padding,
                            cellY + cellHeight/2 - this.padding * 0.7,
                            scatterText[row], 
                            {
                                fontSize: '20px',
                                color: '#FFFFFF',
                                fontFamily: 'Poppins',
                            }
                        );
                        scatterTextCell.setOrigin(0, 0);
                        container.add(scatterTextCell);
                        if(this.isMobile){
                            scatterTextCell.setPosition(this.padding, scatterTextCell.y + scatterTextCell.displayHeight + this.padding * 10);
                            scatterTextCell.setWordWrapWidth(this.contentWidth * 2);
                        }
                    }
                }
            }
        }
        container.add(graphics);
    }


    public toggleMenu(scene: GameScene): void {
        this.showMenu(scene);
    }
}