import { Scene, GameObjects, Tweens } from 'phaser';
import { Geom } from 'phaser';
import { GameData } from '../scenes/components/GameData';
import { SymbolContainer } from '../scenes/components/SymbolContainer';
import { AudioManager } from '../scenes/components/AudioManager';
import { SlotMachine } from '../scenes/components/SlotMachine';
import { Autoplay } from '../scenes/components/Autoplay';
import { SetupPoseBoundsProvider } from '@esotericsoftware/spine-phaser-v3';

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
    private menuContainer?: ButtonContainer;
    private contentArea: GameObjects.Container;
    private isMobile: boolean = false;
    private width: number = 0;
    private height: number = 0;
    private menuEventHandlers: Function[] = [];
    private isDraggingMusic: boolean = false;
    private isDraggingSFX: boolean = false;
    private scene: GameScene;
    public settingsOnly: boolean = false;

    private padding = 10;
    private contentWidth = 488;
    private viewWidth = 488;
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

    // History pagination state
    private historyCurrentPage: number = 1;
    private historyTotalPages: number = 1;
    private historyPageLimit: number = 11;
    private historyIsLoading: boolean = false;
    private historyHeaderContainer?: GameObjects.Container;
    private historyRowsContainer?: GameObjects.Container;
    private historyPaginationContainer?: GameObjects.Container;

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


    constructor(settingsOnly: boolean = false) {
        this.isMobile = this.isMobileDevice();
        //this.settingsOnly = settingsOnly;
    }

    preload(scene: Scene){
        // Load menu icon sprites
        scene.load.image('menu_info', 'assets/Mobile/Menu/Info.png');
        scene.load.image('menu_history', 'assets/Mobile/Menu/History.png');
        scene.load.image('menu_settings', 'assets/Mobile/Menu/Settings.png');
        scene.load.image('menu_close', 'assets/Buttons/ekis.png');
        // History pager icons
        scene.load.image('icon_left', 'assets/Mobile/Menu/icon_left.png');
        scene.load.image('icon_most_left', 'assets/Mobile/Menu/icon_most_left.png');
        scene.load.image('icon_right', 'assets/Mobile/Menu/icon_right.png');
        scene.load.image('icon_most_right', 'assets/Mobile/Menu/icon_most_right.png');

        scene.load.image('loading_icon', 'assets/Mobile/Menu/loading.png');

        
        const prefix = 'assets/Symbols/HelpScreen/';
        scene.load.image('ScatterLabel', `${prefix}ScatterSymbol.png`);
        scene.load.image('BuyFeatHelp', `${prefix}BuyFeatHelp.png`);
        scene.load.image('DoubleHelp', `${prefix}DoubleHelp.png`);
        scene.load.image('BuyFeatMobile', `${prefix}BuyFeatMobile.png`);
        scene.load.image('DoubleHelpMobile', `${prefix}DoubleHelpMobile.png`);

        scene.load.image('tumbleSymbol', `${prefix}tumbleIcon.png`);
        scene.load.image('tumbleGame', `${prefix}tumbleGame.png`);
        scene.load.image('tumbleWin', `${prefix}tumbleWin.png`);

        scene.load.image('scatterIcon', `${prefix}scatterIcon.png`);
        scene.load.image('scatterGame', `${prefix}scatterGame.png`);
        scene.load.image('scatterWin', `${prefix}scatterWin.png`);

        scene.load.image('multiplierIcon', `${prefix}multiplierIcon.png`);
        scene.load.image('multiplierGame', `${prefix}multiplierGame.png`);

        scene.load.image('paylineWin1', `${prefix}paylineWin1.png`);
        scene.load.image('paylineWin2', `${prefix}paylineWin2.png`);
        scene.load.image('paylineNoWin1', `${prefix}paylineNoWin1.png`);
        scene.load.image('paylineNoWin2', `${prefix}paylineNoWin2.png`);
        scene.load.image('paylineMobileWin', `${prefix}paylineMobileWin.png`);
        scene.load.image('paylineMobileNoWin', `${prefix}paylineMobileNoWin.png`);

        scene.load.image('howToPlay1', `${prefix}HowToPlay1.png`);
        scene.load.image('howToPlay2', `${prefix}HowToPlay2.png`);
        scene.load.image('howToPlay3', `${prefix}HowToPlay3.png`);
        scene.load.image('howToPlay4', `${prefix}HowToPlay4.png`);
        scene.load.image('howToPlay5', `${prefix}HowToPlay5.png`);
        scene.load.image('howToPlay6', `${prefix}HowToPlay6.png`);
        scene.load.image('howToPlay7', `${prefix}HowToPlay7.png`);
        scene.load.image('howToPlay8', `${prefix}HowToPlay8.png`);
        scene.load.image('howToPlay9', `${prefix}HowToPlay9.png`);
        scene.load.image('howToPlay10', `${prefix}HowToPlay10.png`);

        scene.load.image('howToPlay1Mobile', `${prefix}HowToPlay1Mobile.png`);
        scene.load.image('howToPlay2Mobile', `${prefix}HowToPlay2Mobile.png`);
        scene.load.image('howToPlay3Mobile', `${prefix}HowToPlay3Mobile.png`);
        scene.load.image('howToPlay4Mobile', `${prefix}HowToPlay4Mobile.png`);
        scene.load.image('howToPlay8Mobile', `${prefix}HowToPlay8Mobile.png`);
        scene.load.image('howToPlay9Mobile', `${prefix}HowToPlay9Mobile.png`);
        scene.load.image('howToPlay10Mobile', `${prefix}HowToPlay10Mobile.png`);
        scene.load.image('howToPlay11Mobile', `${prefix}HowToPlay11Mobile.png`);
        scene.load.image('howToPlay12Mobile', `${prefix}HowToPlay12Mobile.png`);

        // Load UI elements
        scene.load.image('greenRectBtn', 'assets/Buttons/greenRectBtn.png');
        scene.load.image('ekis', 'assets/Buttons/ekis.png');
    }

    create(scene: GameScene){
        // No need to store scene reference
        this.contentContainer = scene.add.container(0, 0);
    }

    private isMobileDevice(): boolean {
        return true;
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('device') == 'mobile'){
            return true;
        }else if(urlParams.get('device') == 'desktop'){
            return false;
        }
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
        // Make overlay interactive to block pointer events from reaching the game underneath
        bg.setInteractive(new Geom.Rectangle(0, 0, this.width, this.height), Geom.Rectangle.Contains);
        bg.on('pointerdown', () => {});
        bg.on('pointerup', () => {});
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
        // Make panel capture input too
        panelBg.setInteractive(new Geom.Rectangle(0, 0, panelWidth, panelHeight), Geom.Rectangle.Contains);
        panelBg.on('pointerdown', () => {});
        panelBg.on('pointerup', () => {});
        this.panel.add(panelBg);

        // Create tabs with different widths
        const tabHeight = 61;
        const smallTabScale = 0.5; // X tab will be half the width of normal tabs

        // Determine which tabs to show
        const baseIcons: string[] = 
            ['info', 'history', 'settings'];

        const getLabel = (icon: string) => {
            switch (icon) {
                case 'info': return 'Rules';
                case 'history': return 'History';
                case 'settings': return 'Settings';
                case 'close': return 'X';
                default: return '';
            }
        };

        const normalTabCount = baseIcons.length;
        const totalTabUnits = normalTabCount + smallTabScale;
        const normalTabWidth = panelWidth / totalTabUnits;
        // Calculate close width to cover any rounding remainder to the panel edge
        const closeWidth = panelWidth - normalTabWidth * normalTabCount;

        // Original spacing: no inter-tab gaps; close tab is smaller on the right
        const tabConfigs: { text: string; width: number; x: number; icon: string }[] = [
            ...baseIcons.map((icon, i) => ({ text: getLabel(icon), width: normalTabWidth, x: normalTabWidth * i, icon })),
            { text: getLabel('close'), width: closeWidth, x: normalTabWidth * normalTabCount, icon: 'close' }
        ];

        const tabContainers: ButtonContainer[] = [];

        tabConfigs.forEach((tabConfig, index) => {
            const tabContainer = scene.add.container(tabConfig.x, 0) as ButtonContainer;
            
            // Tab background
            const tabBg = scene.add.graphics();
            const isClose = tabConfig.icon === 'close';

            tabBg.fillStyle(isClose ? 0x1F1F1F : 0x000000, 1); // Close has dark gray bg
            tabBg.fillRect(0, 0, tabConfig.width, tabHeight);
            tabContainer.add(tabBg);

            // Active tab indicator (green underline) - only for first tab initially
            const activeIndicator = scene.add.graphics();
            activeIndicator.fillStyle(0x00FF00, 1); // Bright green
            activeIndicator.fillRect(0, tabHeight - 3, tabConfig.width, 3);
            activeIndicator.setVisible(index === 0);
            tabContainer.add(activeIndicator);

            // Tab icon for all (including close)
            let iconKey = '';
            switch (tabConfig.icon) {
                case 'info':
                    iconKey = 'menu_info';
                    break;
                case 'history':
                    iconKey = 'menu_history';
                    break;
                case 'settings':
                    iconKey = 'menu_settings';
                    break;
                case 'close':
                    iconKey = 'menu_close';
                    break;
            }

            if (iconKey) {
                const icon = scene.add.image(0, tabHeight / 2, iconKey) as ButtonImage;
                icon.setOrigin(-0.5, 0.5);
                // Scale to a consistent height
                const targetHeight = this.isMobile ? 18 : 22;
                const scale = targetHeight / icon.height;
                icon.setScale(scale);
                if (tabConfig.icon === 'close') {
                    // Center the close icon on its dark background
                    icon.setOrigin(0, 0.5);
                    icon.setPosition(tabConfig.width / 3, tabHeight / 2);
                    icon.clearTint();
                } else {
                    // Left align icon with padding and tint green
                    icon.setPosition(12, tabHeight / 2);
                    icon.setTint(0x379557);
                }
                tabContainer.add(icon);
            }

            // Tab text
            const textX = index < normalTabCount ? 45 : tabConfig.width / 2; // Offset for icon on normal tabs
            const textAlign = index < normalTabCount ? 'left' : 'center';
            
            const text = scene.add.text(textX, tabHeight / 2, tabConfig.text, {
                fontSize: this.isMobile ? '16px' : '20px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                align: textAlign
            }) as ButtonText;
            if(tabConfig.icon === 'close'){
                text.setVisible(false);
            }
            text.setOrigin(index < normalTabCount ? 0 : 0.5, 0.5);
            tabContainer.add(text);

            // Make tab interactive
            tabContainer.setInteractive(
                new Geom.Rectangle(0, 0, tabConfig.width, tabHeight),
                Geom.Rectangle.Contains
            ).isButton = true;

            // Tab click handler
            tabContainer.on('pointerup', () => {
                scene.audioManager.UtilityButtonSFX.play();
                this.switchTab(scene, tabContainers, index, tabConfigs);
            });

            tabContainers.push(tabContainer);
            this.panel.add(tabContainer);
        });

        // Set initial active tab highlight
        this.switchTab(scene, tabContainers, 0, tabConfigs);

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

        // Show initial content based on first tab
        this.showTabContent(scene, tabConfigs[0].icon);

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
        this.historyCurrentPage = 1;
        this.historyPageLimit = 11;
        this.showHistoryContent(scene, this.historyContent, this.historyCurrentPage, this.historyPageLimit);
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
                tabBg.fillStyle(tabConfig.icon === 'close' ? 0x1F1F1F : 0x000000);
                tabBg.fillRect(0, 0, tabConfig.width, 61);
                activeIndicator.setVisible(false);
            }
        });

        // Show content for active tab
        const tabKey: string = tabConfigs[activeIndex].icon;
        this.showTabContent(scene, tabKey);
    }

    private showTabContent(scene: GameScene, tabKey: string): void {
        if (!this.contentArea) return;
        
        this.hideAllTabContent();

        switch (tabKey) {
            case 'info':
                this.rulesContent.setVisible(true);
                // Enable scrolling only on rules tab
                try {
                    const interactiveHeight = Math.max(this.contentArea.height, this.yPosition);
                    this.scrollView.setInteractive(new Phaser.Geom.Rectangle(
                        0, 0,
                        this.contentArea.width,
                        interactiveHeight
                    ), Phaser.Geom.Rectangle.Contains);
                } catch (_e) {}
                break;
            case 'history':
                this.historyContent.setVisible(true);
                // Disable scrolling and reset position for non-rules tabs
                try { this.scrollView.disableInteractive(); } catch (_e) {}
                this.contentContainer.y = 0;
                break;
            case 'settings':
                this.settingsContent.setVisible(true);
                // Disable scrolling and reset position for non-rules tabs
                try { this.scrollView.disableInteractive(); } catch (_e) {}
                this.contentContainer.y = 0;
                break;
            case 'close':
                this.hideMenu(scene);
                break;
        }
    }



    private async showHistoryContent(scene: GameScene, contentArea: GameObjects.Container, page: number, limit: number): Promise<void> {
        // Keep old rows until new data is ready; build containers on first run
        const historyHeaders : string[] = ['Spin', 'Currency', 'Bet', 'Win'];
        // Recreate or reparent containers if needed (handles menu reopen)
        if (!this.historyHeaderContainer || !this.historyHeaderContainer.scene) {
            this.historyHeaderContainer = scene.add.container(0, 0);
            const historyText = scene.add.text(15, 15,'History', this.titleStyle) as ButtonText;
            historyText.setOrigin(0, 0);
            this.historyHeaderContainer.add(historyText);
        }
        if (!this.historyRowsContainer || !this.historyRowsContainer.scene) {
            this.historyRowsContainer = scene.add.container(0, 0);
        }
        if (!this.historyPaginationContainer || !this.historyPaginationContainer.scene) {
            this.historyPaginationContainer = scene.add.container(0, 0);
        }
        if ((this.historyHeaderContainer as any).parentContainer !== contentArea) {
            contentArea.add(this.historyHeaderContainer);
        }
        if ((this.historyRowsContainer as any).parentContainer !== contentArea) {
            contentArea.add(this.historyRowsContainer);
        }
        if ((this.historyPaginationContainer as any).parentContainer !== contentArea) {
            contentArea.add(this.historyPaginationContainer);
        }

        // Prevent stacking requests
        if (this.historyIsLoading) {
            return;
        }
        this.historyIsLoading = true;

        // Show loading icon while fetching history (centered on screen)
        const loaderX = scene.scale.width * 0.45;
        const loaderY = scene.scale.height * 0.3;
        const loader = scene.add.image(loaderX, loaderY, 'loading_icon') as ButtonImage;
        loader.setOrigin(0.5, 0.5);
        loader.setScale(0.25);
        contentArea.add(loader);
        const spinTween = scene.tweens.add({
            targets: loader,
            angle: 360,
            duration: 800,
            repeat: -1,
            ease: 'Linear'
        });

        let result: any;
        try{
            result = await scene.gameAPI.getHistory(page, limit);
        } finally {
            spinTween.stop();
            loader.destroy();
            this.historyIsLoading = false;
        }
        console.log(result);

        // Update pagination state
        this.historyCurrentPage = result?.meta?.page ?? page;
        this.historyTotalPages = result?.meta?.pageCount ?? 1;
        this.historyPageLimit = limit;
        
        // Display headers centered per column (only once)
        const columnCenters = this.getHistoryColumnCenters(scene);
        const headerContainer = this.historyHeaderContainer as GameObjects.Container;
        // When reopening, header could have been destroyed; rebuild if empty or missing headers
        if (headerContainer.length <= 1) { // only title exists
            const headerY = 60;
            historyHeaders.forEach((header, idx) => {
                const headerText = scene.add.text(columnCenters[idx], headerY, header, {
                    fontSize: '14px',
                    color: '#FFFFFF',
                    fontFamily: 'Poppins',
                    fontStyle: 'bold',
                }) as ButtonText;
                headerText.setOrigin(0.5, 0);
                headerContainer.add(headerText);
            });
        }

        let spinDate = '26/7/2025, 16:00';
        let currency = 'usd';
        let bet = '250.00';
        let win = 250000000;

        let contentY = 100;
        const rowsContainer = this.historyRowsContainer as GameObjects.Container;
        rowsContainer.removeAll(true);
        result.data?.forEach((v?:any)=>{
            spinDate = this.formatISOToDMYHM(v.created_at);
            currency = v.currency == ''?'usd':v.currency;
            bet = v.total_bet;
            win = v.total_win;

            contentY += 30;
            // Create row centered per column
            this.createHistoryEntry(contentY, scene, rowsContainer, spinDate, currency, bet, win.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), columnCenters);
            this.addDividerHistory(scene, rowsContainer, contentY);
            contentY += 20;
        });
        
        // Add pagination buttons at bottom-center
        const paginationContainer = this.historyPaginationContainer as GameObjects.Container;
        paginationContainer.removeAll(true);
        this.addHistoryPagination(scene, paginationContainer, this.historyCurrentPage, this.historyTotalPages, this.historyPageLimit);
    }

    private formatISOToDMYHM(iso: string, timeZone = 'Asia/Manila'): string {
        const d = new Date(iso);
        const parts = new Intl.DateTimeFormat('en-GB', {
          day: 'numeric',        // no leading zero
          month: 'numeric',      // no leading zero
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone,
        }).formatToParts(d);
      
        const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
        return `${map.day}/${map.month}/${map.year}, ${map.hour}:${map.minute}`;
      }
      

    private createHistoryEntry(y: number, scene: GameScene, contentArea: GameObjects.Container, spinDate: string, currency: string, bet: string, win: string, columnCenters: number[]): void {
        // Create separate text fields and center them per column
        const values: string[] = [spinDate, currency, bet, win];
        values.forEach((value, idx) => {
            const text = scene.add.text(columnCenters[idx], y, value, {
                fontSize: '14px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
            }) as ButtonText;
            text.setOrigin(0.5, 0);
            contentArea.add(text);
        });
    }

    // Compute four column centers within the content area bounds
    private getHistoryColumnCenters(scene: GameScene): number[] {
        const worldLeft = 20;
        const worldRight = scene.scale.width - 20;
        const parentOffsetX = this.contentArea ? this.contentArea.x : 0;
        const localLeft = worldLeft - parentOffsetX;
        const localRight = worldRight - parentOffsetX;
        const totalWidth = localRight - localLeft;

        // Define column center ratios across the available width (tuned for headers)
        const ratios = [0.15, 0.40, 0.65, 0.88];
        return ratios.map(r => localLeft + totalWidth * r);
    }

    private addDividerHistory(scene: GameScene, contentArea: GameObjects.Container, y: number): void {
        const dividerY = y + 30;
        const worldLeft = 20;
        const worldRight = scene.scale.width - 20;
        const parentOffsetX = this.contentArea ? this.contentArea.x : 0;
        const localLeft = worldLeft - parentOffsetX;
        const localWidth = worldRight - worldLeft;
        const divider = scene.add.graphics();
        divider.fillStyle(0xFFFFFF, 0.1);
        divider.fillRect(localLeft, dividerY, localWidth, 1);
        contentArea.add(divider);
    }

    private addHistoryPagination(scene: GameScene, contentArea: GameObjects.Container, page: number, totalPages: number, limit: number): void {
        const buttonSpacing = 18;
        const icons = ['icon_most_left', 'icon_left', 'icon_right', 'icon_most_right'];

        // Use the actual content area dimensions (parent container) for placement
        const areaWidth = this.contentArea ? this.contentArea.width : scene.scale.width;
        const areaHeight = this.contentArea ? this.contentArea.height : scene.scale.height;

        // Bottom within the visible content area
        const bottomPadding = 80;
        const y = areaHeight - bottomPadding;

        // Measure total width for centering within the content area
        const tempImages: Phaser.GameObjects.Image[] = icons.map(key => scene.add.image(0, 0, key) as ButtonImage);
        const totalWidth = tempImages.reduce((sum, img, i) => sum + img.width + (i > 0 ? buttonSpacing : 0), 0);
        tempImages.forEach(img => img.destroy());

        // Start X so the row is centered inside the content area's local coordinates
        let currentX = (areaWidth - totalWidth) / 2;

        // Place interactive buttons into the history content container
        icons.forEach((key) => {
            const btn = scene.add.image(currentX, y, key) as ButtonImage;
            btn.setOrigin(0, 1);

            let targetPage = page;
            let enabled = true;
            switch (key) {
                case 'icon_most_left':
                    targetPage = 1;
                    enabled = page > 1;
                    break;
                case 'icon_left':
                    targetPage = Math.max(1, page - 1);
                    enabled = page > 1;
                    break;
                case 'icon_right':
                    targetPage = Math.min(totalPages, page + 1);
                    enabled = page < totalPages;
                    break;
                case 'icon_most_right':
                    targetPage = Math.max(1, totalPages);
                    enabled = page < totalPages;
                    break;
            }

            if (enabled) {
                btn.setInteractive({ useHandCursor: true });
                btn.on('pointerup', () => {
                    if (this.historyIsLoading) { return; }
                    scene.audioManager.UtilityButtonSFX.play();
                    // Disable all pagination buttons during load
                    contentArea.iterate((child: Phaser.GameObjects.GameObject) => {
                        const img = child as Phaser.GameObjects.Image;
                        if (img && (img as any).texture && icons.includes((img as any).texture.key)) {
                            img.disableInteractive();
                            img.setAlpha(0.5);
                        }
                    });
                    this.showHistoryContent(scene, this.historyContent, targetPage, limit);
                });
            } else {
                btn.setAlpha(0.5);
                btn.disableInteractive();
            }

            contentArea.add(btn);
            currentX += btn.width + buttonSpacing;
        });

        // Page number display: "Page 1 of 10"
        const pageNumberText = scene.add.text(
            areaWidth / 2,
            y + 40, // place below the pagination buttons
            `Page ${page} of ${totalPages}`,
            {
                fontSize: '20px',
                color: '#FFFFFF',
                fontFamily: 'Poppins',
                align: 'center'
            }
        ) as ButtonText;
        pageNumberText.setOrigin(0.5, 0); // center horizontally
        contentArea.add(pageNumberText);
    }



    private createVolumeSettingsContent(scene: GameScene, contentArea: GameObjects.Container): void {
        const scaleFactor = 1;
        const widthSlider = 340;

        // Title - Settings in green color #379557
        const title = scene.add.text(15, 15, 'Settings', this.titleStyle) as ButtonText;
        title.setOrigin(0, 0);
        contentArea.add(title);

        // Calculate proper positions
        const startX = 15;
        const startY = 15;
        const sliderStartX = startX;
        const musicSliderY = startY + 115;
        const sfxSliderY = startY + 230;

        // Music section (no icon)
        const musicLabel = scene.add.text(startX + 0, startY + 70, 'Background Music', {
            fontSize: '18px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(musicLabel);

        // SFX section (no icon)
        const sfxLabel = scene.add.text(startX + 0, startY + 170, 'Sound FX', {
            fontSize: '18px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(sfxLabel);

        // Skip Intro section (UI only)
        const skipLabelY = startY + 270;
        const skipLabel = scene.add.text(startX + 0, skipLabelY, 'Skip Intro', {
            fontSize: '18px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(skipLabel);

        // Toggle switches (right side)
        const toggleWidth = 64;
        const toggleHeight = 36;
        const toggleRadius = 18;
        // Place toggles within the visible content area width (panel width - 40 padding)
        const contentAreaWidth = scene.scale.width - 40;
        const toggleX = Math.max(sliderStartX + 200, contentAreaWidth - toggleWidth - 20);

        const drawToggle = (bg: Phaser.GameObjects.Graphics, circle: Phaser.GameObjects.Graphics, x: number, yCenter: number, on: boolean) => {
            const y = yCenter - toggleHeight / 2;
            bg.clear();
            circle.clear();
            if (on) {
                // ON: green track; white knob on RIGHT
                bg.fillStyle(0x379557, 1);
                bg.lineStyle(3, 0x2F6D49, 1);
                bg.strokeRoundedRect(x, y, toggleWidth, toggleHeight, toggleRadius);
                bg.fillRoundedRect(x, y, toggleWidth, toggleHeight, toggleRadius);
                circle.fillStyle(0xFFFFFF, 1);
                circle.fillCircle(x + toggleWidth - toggleRadius, y + toggleHeight / 2, toggleRadius - 4);
            } else {
                // OFF: dark gray track; white knob on LEFT
                bg.fillStyle(0x1F2937, 1);
                bg.lineStyle(3, 0x9CA3AF, 1);
                bg.strokeRoundedRect(x, y, toggleWidth, toggleHeight, toggleRadius);
                bg.fillRoundedRect(x, y, toggleWidth, toggleHeight, toggleRadius);
                circle.fillStyle(0xFFFFFF, 1);
                circle.fillCircle(x + toggleRadius, y + toggleHeight / 2, toggleRadius - 4);
            }
        };

        // Music toggle
        const musicToggleBg = scene.add.graphics();
        const musicToggleCircle = scene.add.graphics();
        contentArea.add(musicToggleBg);
        contentArea.add(musicToggleCircle);
        musicToggleBg.setDepth(10);
        musicToggleCircle.setDepth(11);
        let musicOn = scene.audioManager.getMusicVolume() > 0;
        if (!musicOn) {
            // Default should be ON
            musicOn = true;
            scene.audioManager.setMusicVolume(1);
        }
        drawToggle(musicToggleBg, musicToggleCircle, toggleX, startY + 70, musicOn);
        const musicToggleArea = scene.add.zone(toggleX, startY + 70 - toggleHeight / 2, toggleWidth, toggleHeight).setOrigin(0, 0);
        musicToggleArea.setInteractive();
        musicToggleArea.on('pointerdown', () => {
            musicOn = !musicOn;
            scene.audioManager.setMusicVolume(musicOn ? 1 : 0);
            drawToggle(musicToggleBg, musicToggleCircle, toggleX, startY + 70, musicOn);
            updateSliders();
        });
        contentArea.add(musicToggleArea);
        musicToggleArea.setDepth(12);

        // SFX toggle
        const sfxToggleBg = scene.add.graphics();
        const sfxToggleCircle = scene.add.graphics();
        contentArea.add(sfxToggleBg);
        contentArea.add(sfxToggleCircle);
        sfxToggleBg.setDepth(10);
        sfxToggleCircle.setDepth(11);
        let sfxOn = scene.audioManager.getSFXVolume() > 0;
        if (!sfxOn) {
            // Default should be ON
            sfxOn = true;
            scene.audioManager.setSFXVolume(1);
        }
        drawToggle(sfxToggleBg, sfxToggleCircle, toggleX, startY + 170, sfxOn);
        const sfxToggleArea = scene.add.zone(toggleX, startY + 170 - toggleHeight / 2, toggleWidth, toggleHeight).setOrigin(0, 0);
        sfxToggleArea.setInteractive();
        sfxToggleArea.on('pointerdown', () => {
            sfxOn = !sfxOn;
            scene.audioManager.setSFXVolume(sfxOn ? 1 : 0);
            drawToggle(sfxToggleBg, sfxToggleCircle, toggleX, startY + 170, sfxOn);
            updateSliders();
        });
        contentArea.add(sfxToggleArea);
        sfxToggleArea.setDepth(12);

        // Skip Intro toggle (no functionality yet)
        const skipToggleBg = scene.add.graphics();
        const skipToggleCircle = scene.add.graphics();
        contentArea.add(skipToggleBg);
        contentArea.add(skipToggleCircle);
        skipToggleBg.setDepth(10);
        skipToggleCircle.setDepth(11);
        let skipOn = false; // UI-only state
        drawToggle(skipToggleBg, skipToggleCircle, toggleX, skipLabelY + 2, skipOn);
        const skipToggleArea = scene.add.zone(toggleX, skipLabelY + 2 - toggleHeight / 2, toggleWidth, toggleHeight).setOrigin(0, 0);
        skipToggleArea.setInteractive();
        skipToggleArea.on('pointerdown', () => {
            skipOn = !skipOn;
            drawToggle(skipToggleBg, skipToggleCircle, toggleX, skipLabelY + 2, skipOn);
        });
        contentArea.add(skipToggleArea);
        skipToggleArea.setDepth(12);

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
        // Draw knob at local origin and position the graphics instead of drawing at world coords
        musicSlider.fillCircle(0, 0, 12 * scaleFactor);
        musicSlider.setPosition(sliderStartX + 0.75 * widthSlider * scaleFactor, musicSliderY + 4);
        // Enlarge interactive hit area and keep it local to the graphics
        musicSlider.setInteractive(
            new Geom.Circle(0, 0, 22 * scaleFactor),
            Geom.Circle.Contains
        );
        contentArea.add(musicSlider);

        // Music value text
        const musicValue = scene.add.text(sliderStartX , musicSliderY + 25, '75%', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        contentArea.add(musicValue);

        // SFX slider (hidden for now)
        const sfxSliderBg = scene.add.graphics();
        const sfxSliderBg2 = scene.add.graphics();
        const sfxSlider = scene.add.graphics();
        const sfxValue = scene.add.text(sliderStartX, sfxSliderY + 25, '75%', {
            fontSize: '16px',
            color: '#FFFFFF',
            fontFamily: 'Poppins'
        }) as ButtonText;
        sfxSliderBg.setVisible(false);
        sfxSliderBg2.setVisible(false);
        sfxSlider.setVisible(false);
        sfxValue.setVisible(false);

        // Helper to update slider positions and values
        const updateSliders = (musicX: number | null = null, sfxX: number | null = null) => {
            const sliderWidth = widthSlider * scaleFactor;

            const musicVol = musicX !== null ? 
                Math.max(0, Math.min(1, musicX / sliderWidth)) : 
                scene.audioManager.getMusicVolume();
            
            const sfxVol = sfxX !== null ? 
                Math.max(0, Math.min(1, sfxX / sliderWidth)) : 
                scene.audioManager.getSFXVolume();
            
            // Update music slider
            musicSlider.clear();
            musicSlider.fillStyle(0xffffff, 1);
            const musicSliderX = sliderStartX + (musicVol * sliderWidth);
            // Keep drawing local and move the graphics to the new position
            musicSlider.fillCircle(0, 0, 12 * scaleFactor);
            musicSlider.setPosition(musicSliderX, musicSliderY + 4);
            musicSliderBg.clear();
            musicSliderBg.fillStyle(0x379557, 1);
            musicSliderBg.fillRoundedRect(sliderStartX, musicSliderY, sliderWidth * musicVol, 8 * scaleFactor, 4 * scaleFactor);
            musicValue.setText(Math.round(musicVol * 100) + '%');

            // Sync music toggle state with slider value
            // If slider reaches 0%, force toggle OFF; if >0%, ensure toggle ON
            if (musicVol === 0) {
                if (musicOn) {
                    musicOn = false;
                    drawToggle(musicToggleBg, musicToggleCircle, toggleX, startY + 70, musicOn);
                }
            } else {
                if (!musicOn) {
                    musicOn = true;
                    drawToggle(musicToggleBg, musicToggleCircle, toggleX, startY + 70, musicOn);
                }
            }
            
            // Update SFX slider (kept hidden)
            const sfxSliderX = sliderStartX + (sfxVol * sliderWidth);
            sfxSlider.clear();
            sfxSlider.fillStyle(0xffffff, 1);
            sfxSlider.fillCircle(0, 0, 12 * scaleFactor);
            sfxSlider.setPosition(sfxSliderX, sfxSliderY + 4);
            sfxSliderBg.clear();
            sfxSliderBg.fillStyle(0x379557, 1);
            sfxSliderBg.fillRoundedRect(sliderStartX, sfxSliderY, sliderWidth * sfxVol, 8 * scaleFactor, 4 * scaleFactor);
            sfxValue.setText(Math.round(sfxVol * 100) + '%');

            // Update volumes
            if (musicX !== null) scene.audioManager.setMusicVolume(musicVol);
            if (sfxX !== null) scene.audioManager.setSFXVolume(sfxVol);

            // Update interactive areas for sliders (keep hit areas centered on the local origin)
            musicSlider.setInteractive(
                new Geom.Circle(0, 0, 22 * scaleFactor),  
                Geom.Circle.Contains
            );
            // Keep SFX interactions disabled while hidden
            sfxSlider.disableInteractive();
        };

        // Initial slider setup
        updateSliders();


        // Make sliders draggable
        this.isDraggingMusic = false;
        this.isDraggingSFX = false;

        // Global pointer move and up handlers
        const pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
            if (this.isDraggingMusic) {
                const sliderWidth = widthSlider * scaleFactor;
                const p = (musicSliderTrack as any).getLocalPoint(pointer.x, pointer.y);
                const localX = Math.max(0, Math.min(sliderWidth, p && typeof p.x === 'number' ? p.x : 0));
                updateSliders(localX, null);
            } else if (this.isDraggingSFX) {
                const sliderWidth = widthSlider * scaleFactor;
                const p = (sfxSliderTrack as any).getLocalPoint(pointer.x, pointer.y);
                const localX = Math.max(0, Math.min(sliderWidth, p && typeof p.x === 'number' ? p.x : 0));
                updateSliders(null, localX);
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
        musicSliderTrack.setPosition(sliderStartX, musicSliderY);
        musicSliderTrack.fillStyle(0x000000, 0); // Transparent
        // Draw and set hit area in local coords for reliable input inside a container
        musicSliderTrack.fillRect(0, -10, widthSlider * scaleFactor, 28);
        musicSliderTrack.setInteractive(
            new Geom.Rectangle(0, -10, widthSlider * scaleFactor, 28),
            Geom.Rectangle.Contains
        );
        contentArea.add(musicSliderTrack);

        const sfxSliderTrack = scene.add.graphics();
        sfxSliderTrack.setPosition(sliderStartX, sfxSliderY);
        sfxSliderTrack.fillStyle(0x000000, 0); // Transparent
        // Keep SFX track hidden and non-interactive for now
        sfxSliderTrack.setVisible(false);
        contentArea.add(sfxSliderTrack);

        // Music slider track click handler
        musicSliderTrack.on('pointerdown', (pointer: Phaser.Input.Pointer, localX: number) => {
            const sliderWidth = widthSlider * scaleFactor;
            localX = Math.max(0, Math.min(sliderWidth, localX));
            const newVolume = localX / sliderWidth;
            scene.audioManager.setMusicVolume(newVolume);
            this.isDraggingMusic = true; // allow click-and-drag on the track
            updateSliders();
        });

        // SFX slider track click handler
        // SFX track interaction disabled while hidden

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
        
        // Ensure only one instance exists by destroying any previous menu
        if (this.menuContainer) {
            this.destroyMenu(scene);
        }
        const container = this.createMenu(scene);

        container.setVisible(true);
        container.setAlpha(0);
        this.isVisible = true;
        
        scene.tweens.add({
            targets: container,
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

    private destroyMenu(scene: GameScene): void {
        // Hide and cleanup listeners first
        this.hideMenu(scene);
        // Destroy existing container to free resources
        if (this.menuContainer) {
            this.menuContainer.destroy(true);
            this.menuContainer = undefined;
        }
        this.panel = undefined as any;
    }



    private addContent(scene: GameScene, _text: string, _type: string, _wordWrap: boolean = false, _wordWrapWidth: number = 0): void {
        if (_type === 'title') {
            const content = scene.add.text(this.padding / 2, this.yPosition, _text, this.titleStyle as Phaser.Types.GameObjects.Text.TextStyle);
            this.contentContainer.add(content);
            if (_text === 'Bonus Trigger') {
                content.setPosition(0, content.y);
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
            
            this.yPosition += this.padding * 7;
    
            // Create 9 row symbol grid with payouts
            const symbolSize = 153;
            const symbolScale = 0.5;
            const scaledSymbolSize = symbolSize * symbolScale;
            for (let i = 0; i < 9; i++) {
                const cellX = this.padding;
                const cellY = this.yPosition;
    
                // Create symbol container with white border
                const symbolContainer = scene.add.container(cellX, cellY);
    
                this.createBorder(scene, symbolContainer, 
                    -this.padding / 2, 
                    -scaledSymbolSize, 
                    this.contentWidth + this.padding * 3,
                    scaledSymbolSize * 1.5
                );
    
                const symbol = new SymbolContainer(scene, 0, 0, i + 1, scene.gameData);
                symbol.setSymbolDisplaySize(scaledSymbolSize, scaledSymbolSize);
                symbol.setScale(symbolScale * 1.5);
                symbol.getSymbolSprite().setOrigin(-0.5, 0.75);
                try { symbol.getSymbolSprite().animationState.timeScale = 0; } catch (_e) {}
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
    
            this.yPosition += this.padding * 3;
            this.addContent(scene, 'Scatter', 'text');
    
            this.yPosition += this.padding * 3;
            { // scatter payouts
                const cellX = -this.padding / 2;
                const cellY = this.yPosition;
    
                // Create symbol container with white border
                const symbolContainer = scene.add.container(cellX, cellY );
    
                this.createBorder(scene, symbolContainer, 
                    0, 
                    -scaledSymbolSize, 
                    this.contentWidth + this.padding * 3 ,
                    scaledSymbolSize * 5.5
                );
    
                // Add symbol
                const symbol = scene.add.sprite(0, 0, 'ScatterLabel');
                symbol.setScale(0.75);
                symbol.setOrigin(0.3, 0.4);
                symbolContainer.add(symbol);
                symbol.setPosition(scene.scale.width * 0.4, this.padding);
    
                // Add payout table next to symbol
                this.createPayoutTable(scene, 
                    symbol.x / 3,  // Position table right of symbol
                    symbol.height,                      // Center vertically with symbol
                    symbolContainer,
                    0       
                );
    
                this.contentContainer.add(symbolContainer);
                this.contentContainer.sendToBack(symbolContainer);
                this.yPosition += scaledSymbolSize * 5;  // Move to next row
            }
    
            //this.yPosition -= scaledSymbolSize * 3.5;
            this.addContent(scene, 'Tumble Win', 'title');
    
            const tumbleWinContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, tumbleWinContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 8.75 
            );
            this.contentContainer.add(tumbleWinContainer);
            this.createHowToPlayEntry(scene, 20, 170, tumbleWinContainer, 'tumbleGame', 
                'After each spin, winning symbols are paid and then removed from the screen. Remaining symbols drop down, and new ones fall from above to fill the empty spaces.\n\n' +
                'Tumbles continue as long as new winning combinations appear — there\'s no limit to the number of tumbles per spin.\n\n' +
                'All wins are credited to the player\'s balance after all tumbles from a base spin are completed.',
            true, this.contentWidth - this.padding * 2);
    
    
            const tumbleSymbolImage = scene.add.image(0, 0, 'tumbleSymbol');
            tumbleSymbolImage.setScale(0.5);
            tumbleSymbolImage.setOrigin(0.5, 0.5);
            tumbleSymbolImage.setPosition(90, 65);
            tumbleWinContainer.add(tumbleSymbolImage);
            
    
            const tumbleWinImage = scene.add.image(0, 0, 'tumbleWin');
            tumbleWinImage.setScale(0.5);
            tumbleWinImage.setOrigin(0.5, 0.5);
            tumbleWinImage.setPosition(tumbleSymbolImage.x - tumbleSymbolImage.displayWidth/2 + this.padding * 2, tumbleSymbolImage.y - tumbleWinImage.height/3);
            tumbleWinContainer.add(tumbleWinImage);
            
            this.yPosition -= scaledSymbolSize * 10;
            this.addContent(scene, 'Free Spins Rules', 'title');
            this.yPosition += scaledSymbolSize  * 3.5;
            this.addContent(scene, 'Bonus Trigger', 'title');
            this.yPosition -= scaledSymbolSize  * 3.5;
    
            const freeSpinContainer = scene.add.container(-this.padding * 1.5, this.yPosition-scaledSymbolSize * 0.5);
            this.yPosition += this.createBorder(scene, freeSpinContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 7
                
            );
            this.contentContainer.add(freeSpinContainer);
            this.contentContainer.sendToBack(freeSpinContainer);

            this.yPosition -= scaledSymbolSize * 0.25;
            
            this.createHowToPlayEntry(scene, 20, 120, freeSpinContainer, 'scatterGame', 
                'Land 4 or more         SCATTER \nsymbols anywhere on the screen to trigger the free spins feature.\n\n' +
                'You\'ll start with 10 free spins.\n\n' +
                'During the bonus round, hitting 3 or more scatter symbols awards 5 extra free spins', 
            true, this.contentWidth + this.padding * 3);
    
            const scatterSymbolImage2 = scene.add.image(0, 0, 'scatterIcon');
            scatterSymbolImage2.setScale(0.25);
            scatterSymbolImage2.setOrigin(0.5, 0.5);
            scatterSymbolImage2.setPosition(195, 320);
            freeSpinContainer.add(scatterSymbolImage2);
    
            const scatterSymbolImage = scene.add.image(0, 0, 'scatterIcon');
            scatterSymbolImage.setScale(0.5);
            scatterSymbolImage.setOrigin(0.5, 0.5);
            scatterSymbolImage.setPosition(100, 75);
            freeSpinContainer.add(scatterSymbolImage);
            
            const scatterWinImage = scene.add.image(0, 0, 'scatterWin');
            scatterWinImage.setScale(0.5);
            scatterWinImage.setOrigin(0.5, 0.5);
            scatterWinImage.setPosition(scatterSymbolImage.x - scatterSymbolImage.displayWidth/2 + this.padding * 2, scatterSymbolImage.y * 3/4 - scatterWinImage.height/ 4);
            freeSpinContainer.add(scatterWinImage);
            
            this.yPosition -= scaledSymbolSize * 4.75;
            // this.addDivider(scene, 0x379557);
            

            //this.yPosition += scaledSymbolSize  * 4;
            this.addContent(scene, 'Multiplier', 'title');
            this.yPosition -= scaledSymbolSize  * 4.25;
            
            const multiplierContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, multiplierContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 10
            );
            this.yPosition += scaledSymbolSize * 6.5;
            this.contentContainer.add(multiplierContainer);
            this.contentContainer.sendToBack(multiplierContainer);
            
    
            this.createHowToPlayEntry(scene, 20, 170, multiplierContainer, 'multiplierGame', 
                '\nThe         Multiplier symbol only appears during the FREE SPINS round and remains on the screen until the tumbling sequence ends.\n\n' +
                'Each time a         symbol lands, it randomly takes a multiplier value: 2x, 3x, 4x, 5x, 6x, 8x, 10x, 12x, 15x, 20x, 25x, 50x, or even 100x!\n\n' +
                'Once all tumbles are finished, the total of all           multipliers is added and applied to the total win of the that sequence.\n\n' +
                'Special reels are used during the FREE SPINS round.',
            true, this.contentWidth + this.padding * 3);
    
            let multiplier_y = 50;
                const multiplierIcon4 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon4.setScale(0.15);
                multiplierIcon4.setOrigin(0.5, 0.5);
                multiplierIcon4.setPosition(80, 280 + multiplier_y);
                multiplierContainer.add(multiplierIcon4);
            
                const multiplierIcon3 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon3.setScale(0.15);
                multiplierIcon3.setOrigin(0.5, 0.5);
                multiplierIcon3.setPosition(163, 405 + multiplier_y);
                multiplierContainer.add(multiplierIcon3);
                
            
                const multiplierIcon2 = scene.add.image(0, 0, 'multiplierIcon');
                multiplierIcon2.setScale(0.15);
                multiplierIcon2.setOrigin(0.5, 0.5);
                multiplierIcon2.setPosition(100, 550 + multiplier_y);
                multiplierContainer.add(multiplierIcon2);
            
            const multiplierIcon = scene.add.image(0, 0, 'multiplierIcon');
            multiplierIcon.setScale(0.33);
            multiplierIcon.setOrigin(0.5, 0.5);
            multiplierIcon.setPosition(100, 50);
            multiplierContainer.add(multiplierIcon);
            this.contentContainer.bringToTop(multiplierIcon);
            
            this.yPosition -= scaledSymbolSize * 17.75;
            this.addContent(scene, 'Game Settings', 'title');
    
            const gamesettingsContainer = scene.add.container(-this.padding * 1.5, this.yPosition);
            this.yPosition += this.createBorder(scene, gamesettingsContainer, 
                this.padding, 
                0, 
                this.contentWidth + this.padding * 3, 
                scaledSymbolSize * 10
            );
            this.contentContainer.add(gamesettingsContainer);
    
            //this.yPosition -= scaledSymbolSize * 9.75;
            this.yPosition -= scaledSymbolSize * 10
    
            this.yPosition += this.padding;
            this.addContent(scene, 'Paylines', 'title');
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 0.75, gamesettingsContainer, '', 'Symbols can land anywhere on the screen.', true, this.contentWidth + this.padding * 3);
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 2.75, gamesettingsContainer, 'paylineMobileWin', '');
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 5.25, gamesettingsContainer, 'paylineMobileNoWin', '');
    
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 6.5, gamesettingsContainer, '', 'All wins are multiplied by the base bet.', true, this.contentWidth + this.padding * 3);
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 7.5, gamesettingsContainer, '', 'When multiple symbol wins occur, all values are combined into the total win.', true, this.contentWidth + this.padding * 3);
            this.createHowToPlayEntry(scene, 20, scaledSymbolSize * 8.75, gamesettingsContainer, '', 'Free spins rewards are granted after the round ends.', true, this.contentWidth + this.padding * 3);
    
            this.yPosition -= scaledSymbolSize * 3.5;
    
            this.commonRules(scene, this.contentWidth, 153);
    
            this.yPosition -= scaledSymbolSize * 45;
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

        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 72 : commonPadding * 52, howToPlayContainer, 'howToPlay5', 'Shows your current available credits.', true, this.contentWidth - this.padding * 2);
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 82 : commonPadding * 59, howToPlayContainer, 'howToPlay6', 'Display your total winnings from the current round.', true, this.contentWidth - this.padding * 2);
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 93 : commonPadding * 66, howToPlayContainer, 'howToPlay7', 'Adjust your wager using the - and + buttons.', true, this.contentWidth - this.padding * 2);

        this.createHeader(scene, commonPadding, this.isMobile ? commonPadding * 101 : commonPadding * 71, howToPlayContainer, 'General Controls', '#379557');

        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 107 : commonPadding * 74, howToPlayContainer, this.isMobile ? 'howToPlay8Mobile' : 'howToPlay8', this.isMobile ? '' : 'Toggle game sounds on and off.');  
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 114.5 : commonPadding * 78, howToPlayContainer, this.isMobile ? 'howToPlay9Mobile' : 'howToPlay9', this.isMobile ? '' : 'Access gameplay preferences and system options.');
        this.createHowToPlayEntry(scene, commonPadding, this.isMobile ? commonPadding * 124 : commonPadding * 83, howToPlayContainer, this.isMobile ? 'howToPlay10Mobile' : 'howToPlay10', this.isMobile ? '' : 'View game rules, features, and paytable.');        

        this.yPosition -= scaledSymbolSize * 15;
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
            //if(image == 'tumbleGame' || image == 'scatterGame' || image == 'multiplierGame'){
            if(image == 'scatterGame'){
                imageElement.setScale(189/1144, 337/1546);
            }
            else if(image == 'tumbleGame'){
                imageElement.setScale(204/1144, 367/1543);
            }
            else if(image == 'multiplierGame'){
                imageElement.setScale(190/1144, 337/1543);
            }
            imageElement.setOrigin(-0.5, 0.5);
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
        const cellWidth1 = this.isMobile ? 60 : 45; 
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
                const cellX = x + (col == 2 ? cellWidth1 + cellWidth2 + cellPadding * 2 : col * (cellWidth + cellPadding));
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
                                align: 'left',
                                fontStyle: 'bold'
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
                            fontFamily: 'Poppins',
                            fontStyle: 'bold'
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
                                padding: {
                                    left: this.padding,
                                    right: this.padding
                                }
                            }
                        );
                        scatterTextCell.setOrigin(0, 0);
                        container.add(scatterTextCell);
                        if(this.isMobile){
                            scatterTextCell.setPosition(0, scatterTextCell.y + scatterTextCell.displayHeight + this.padding * 10);
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