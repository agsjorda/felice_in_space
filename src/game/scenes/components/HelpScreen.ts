import { Scene, GameObjects } from 'phaser';
import { GameData } from './GameData';
import { Events } from './Events';
import { SymbolContainer } from './SymbolContainer';

interface GameScene extends Scene {
    gameData: GameData;
}

export class HelpScreen {
    private container: GameObjects.Container;
    private scrollView: GameObjects.Container;
    private contentContainer: GameObjects.Container;
    private mask: Phaser.Display.Masks.GeometryMask;
    private isVisible: boolean = false;
    private scene: GameScene;
    private viewWidth: number = 1329;
    private isMobile: boolean = false;

    constructor() {
        this.isVisible = false;
    }

    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }   

    preload(scene: GameScene): void {
        // Load scatter symbol
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

    create(scene: GameScene): void {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();

        const screenHeight = scene.scale.height;
        const padding = this.isMobile ? 16 : 64;

        this.viewWidth = this.isMobile ? scene.scale.width : 1329;

        // Position container initially off-screen to the left
        this.container = scene.add.container(-this.viewWidth, 0);
        this.container.setDepth(1000);
        this.container.setVisible(false);

        // Create background with blur effect
        const bg = scene.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(0, 0, this.viewWidth, screenHeight, 1);
        bg.strokeRoundedRect(0, 0, this.viewWidth, screenHeight, 1);
        this.container.add(bg);

        // Create scroll view container
        this.scrollView = scene.add.container(padding, padding);
        this.container.add(this.scrollView);

        // Create content container that will hold all the content
        this.contentContainer = scene.add.container(0, 0);
        this.scrollView.add(this.contentContainer);

        // Create mask for scroll view
        const maskGraphics = scene.add.graphics();
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillRect(this.container.x + padding, this.container.y + padding, 
                            this.viewWidth - padding * 2, screenHeight * 0.8 - padding * 2);
        //this.mask = maskGraphics.createGeometryMask();
        //this.scrollView.setMask(this.mask);

        // Create close button
        const closeButtonContainer = scene.add.container(
            this.isMobile ? this.viewWidth - padding * 6 : this.viewWidth - padding,  this.isMobile ? padding * 2 : padding);
        const closeButton = scene.add.image(0, 0, 'greenRectBtn');
        closeButton.setScale(this.isMobile ? 0.125 : 0.25, this.isMobile ? 0.25 : 0.5);
        
        const closeText = scene.add.image(0, 0, 'ekis');
        closeText.setOrigin(0.5);
        closeText.setScale(this.isMobile ? 0.5 : 1);
        
        closeButton.setPosition(closeButton.x + closeButton.width/4, closeButton.y);
        closeText.setPosition(closeText.x + closeButton.width/4, closeText.y);

        closeButtonContainer.add(closeButton);
        closeButtonContainer.add(closeText);

        closeButton.setInteractive()
            .on('pointerover', () => closeButton.setTint(0x3FFF0D))
            .on('pointerout', () => closeButton.clearTint())
            .on('pointerdown', () => {
            this.scene.audioManager.UtilityButtonSFX.play();
            this.hide();
            this.scene.gameData.isHelpScreenVisible = false;
            Events.emitter.emit(Events.HELP_SCREEN_TOGGLE);
            }
        );

        this.container.add(closeButtonContainer);

        // Create help screen content
        if(this.isMobile){
            this.createMobileContent();
        }
        else{
            this.createContent();
        }

        // Enable scrolling
        this.enableScrolling(this.scene);
        this.contentContainer.setSize(-this.contentWidth, this.yPosition);
        this.contentContainer.setInteractive();
    }

    
    protected padding = 20;
    protected contentWidth = 1200;
    
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

    private yPosition: number = 0;
    private addContent(_text:string, _type:string, _wordWrap: boolean = false, _wordWrapWidth: number = 0): void {
        

        if(_type == 'title'){
            const content = this.scene.add.text(this.padding / 2, this.yPosition, _text, this.titleStyle);
            this.contentContainer.add(content);
            this.yPosition += content.height + this.padding;
        }
        else if(_type == 'text'){
            const content = this.scene.add.text(this.padding / 2, this.yPosition, _text, {
                ...this.textStyle,
                wordWrap: _wordWrap ? { width: _wordWrapWidth } : undefined
            });
            this.contentContainer.add(content);
            this.yPosition += content.height + this.padding;
        }
    }

    private createMobileContent(): void {
        this.padding = 10;
        this.contentWidth = this.viewWidth - this.padding * 6;
        this.yPosition = this.padding * 4;

        this.addContent('Game Rules', 'title');

        this.addContent('Win by landing 8 or more matching symbols anywhere on the screen.', 'text', true, this.contentWidth + this.padding * 2);
        this.yPosition-=this.padding;
        this.addContent('The more matching symbols you get, the higher your payout.', 'text', true, this.contentWidth - this.padding * 2);

        this.addContent('RTP', 'title');
        this.addContent('96.49% - 96.6%', 'text');

        this.yPosition += this.padding * 2;

        this.addContent('Payout', 'title');
        
        this.yPosition += this.padding * 7;

        // Create 9 row symbol grid with payouts
        const symbolSize = 153;
        const symbolScale = 0.5;
        const scaledSymbolSize = symbolSize * symbolScale;
        for (let i = 0; i < 9; i++) {
            const cellX = this.padding;
            const cellY = this.yPosition;

            // Create symbol container with white border
            const symbolContainer = this.scene.add.container(cellX, cellY);

            this.createBorder(symbolContainer, 
                -this.padding, 
                -scaledSymbolSize, 
                this.contentWidth + this.padding * 3 ,
                scaledSymbolSize * 1.5
            );

            // Add symbol using SymbolContainer
            const symbol = new SymbolContainer(this.scene, 0, 0, i + 1, this.scene.gameData);
            symbol.setSymbolDisplaySize(symbolSize * symbolScale, symbolSize * symbolScale);
            symbol.setScale(symbolScale);
            symbol.getSymbolSprite().setOrigin(0, 0.7);
            symbolContainer.add(symbol);
            if(i == 5){
                symbol.setPosition(symbol.x, symbol.y + this.padding);
            }

            // Add payout table next to symbol
            this.createPayoutTable(
                scaledSymbolSize + symbolSize/5,  // Position table right of symbol
                0,                      // Center vertically with symbol
                symbolContainer,
                i + 1
            );

            this.contentContainer.add(symbolContainer);
            this.yPosition += scaledSymbolSize + this.padding * 5;  // Move to next row
        }
        this.yPosition -=  scaledSymbolSize;

        this.yPosition += this.padding * 3;
        this.addContent('Scatter', 'text');

        this.yPosition += this.padding * 3;
        { // scatter payouts
            const cellX = this.padding;
            const cellY = this.yPosition;

            // Create symbol container with white border
            const symbolContainer = this.scene.add.container(cellX, cellY);

            this.createBorder(symbolContainer, 
                -this.padding, 
                -scaledSymbolSize, 
                this.contentWidth + this.padding * 3 ,
                scaledSymbolSize * 5.5
            );

            // Add symbol
            const symbol = this.scene.add.sprite(this.viewWidth * 4 / 9, 0, 'ScatterLabel');
            symbol.setScale(0.2);
            symbol.setOrigin(0.5, 0.5);
            symbolContainer.add(symbol);
            symbol.setPosition(symbol.x, symbol.y + this.padding * 3);

            // Add payout table next to symbol
            this.createPayoutTable( 
                symbol.x / 3,  // Position table right of symbol
                symbol.height * 3 / 10,                      // Center vertically with symbol
                symbolContainer,
                0       
            );

            this.contentContainer.add(symbolContainer);
            this.contentContainer.sendToBack(symbolContainer);
            this.yPosition += scaledSymbolSize * 5;  // Move to next row
        }

        this.addContent('Enhanced Bet', 'title');
        const doubleHelpContainer = this.scene.add.container(0, this.yPosition);
        this.yPosition += this.createBorder(doubleHelpContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 2.25
        );
        this.contentContainer.add(doubleHelpContainer);
        this.createHowToPlayEntry(20, 40, doubleHelpContainer, 'DoubleHelpMobile', 'You\'re wagering 25% more per spin, but you also have better chances at hitting big features.');
 
        this.yPosition -= scaledSymbolSize * 2.5;
        
        const buyFeatHelpContainer = this.scene.add.container(0, this.yPosition);
        this.yPosition += this.createBorder(buyFeatHelpContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 2
        );
        this.contentContainer.add(buyFeatHelpContainer);
        this.createHowToPlayEntry(20, 40, buyFeatHelpContainer, 'BuyFeatMobile', 'Lets you buy the free spins round for 100x your total bet');

        this.yPosition -= scaledSymbolSize * 3.5;
        this.addContent('Tumble Win', 'title');

        const tumbleWinContainer = this.scene.add.container(0, this.yPosition);
        this.yPosition += this.createBorder(tumbleWinContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 9
        );
        this.contentContainer.add(tumbleWinContainer);
        this.createHowToPlayEntry(20, 170, tumbleWinContainer, 'tumbleGame', 
            'After each spin, winning symbols are paid and then removed from the screen. Remaining symbols drop down, and new ones fall from above to fill the empty spaces.\n\n' +
            'Tumbles continue as long as new winning combinations appear — there\'s no limit to the number of tumbles per spin.\n\n' +
            'All wins are credited to the player\'s balance after all tumbles from a base spin are completed.');


        const tumbleSymbolImage = this.scene.add.image(0, 0, 'tumbleSymbol');
        tumbleSymbolImage.setScale(0.5);
        tumbleSymbolImage.setOrigin(0.5, 0.5);
        tumbleSymbolImage.setPosition(70, 85);
        tumbleWinContainer.add(tumbleSymbolImage);
        

        const tumbleWinImage = this.scene.add.image(0, 0, 'tumbleWin');
        tumbleWinImage.setScale(0.5);
        tumbleWinImage.setOrigin(0.5, 0.5);
        tumbleWinImage.setPosition(tumbleSymbolImage.x - tumbleSymbolImage.displayWidth/2 + this.padding * 2, tumbleSymbolImage.y - tumbleWinImage.height/3);
        tumbleWinContainer.add(tumbleWinImage);
        
        this.yPosition -= scaledSymbolSize * 9;
        this.addContent('Free Spins Rules', 'title');

        this.yPosition += scaledSymbolSize  * 3;
        this.addContent('Bonus Trigger', 'title');
        this.yPosition -= scaledSymbolSize  * 3;

        const freeSpinContainer = this.scene.add.container(0, this.yPosition-scaledSymbolSize * 0.5);
        this.yPosition += this.createBorder(freeSpinContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 6.75
            
        );
        this.contentContainer.add(freeSpinContainer);
        this.contentContainer.sendToBack(freeSpinContainer);
        
        this.createHowToPlayEntry(20, 120, freeSpinContainer, 'scatterGame', 
            'Land 4 or more         SCATTER \nsymbols anywhere on the screen to trigger the free spins feature.\n\n' +
            'You\'ll start with 10 free spins.\n\n' +
            'During the bonus round, hitting 3 or more scatter symbols awards 5 extra free spins');

        const scatterSymbolImage2 = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage2.setScale(0.25);
        scatterSymbolImage2.setOrigin(0.5, 0.5);
        scatterSymbolImage2.setPosition(195, 300);
        freeSpinContainer.add(scatterSymbolImage2);

        const scatterSymbolImage = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage.setScale(0.5);
        scatterSymbolImage.setOrigin(0.5, 0.5);
        scatterSymbolImage.setPosition(100, 60);
        freeSpinContainer.add(scatterSymbolImage);
        
        const scatterWinImage = this.scene.add.image(0, 0, 'scatterWin');
        scatterWinImage.setScale(0.5);
        scatterWinImage.setOrigin(0.5, 0.5);
        scatterWinImage.setPosition(scatterSymbolImage.x - scatterSymbolImage.displayWidth/2 + this.padding * 2, scatterSymbolImage.y * 3/4 - scatterWinImage.height/ 4);
        freeSpinContainer.add(scatterWinImage);
        
        this.yPosition -= scaledSymbolSize * 8;
        //this.addDivider(0x379557);

        

        this.yPosition += scaledSymbolSize  * 3.5;
        this.addContent('Multiplier', 'title');
        this.yPosition -= scaledSymbolSize  * 3.5;
        
        const multiplierContainer = this.scene.add.container(0, this.yPosition);
        this.yPosition += this.createBorder(multiplierContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 9
        );
        this.yPosition += scaledSymbolSize * 5;
        this.contentContainer.add(multiplierContainer);
        this.contentContainer.sendToBack(multiplierContainer);
        

        this.createHowToPlayEntry(20, 150, multiplierContainer, 'multiplierGame', 
            'The         Multiplier symbol only appears during the FREE SPINS round and remains on the screen until the tumbling sequence ends.\n\n' +
            'Each time a         symbol lands, it randomly takes a multiplier value: 2x, 3x, 4x, 5x, 6x, 8x, 10x, 12x, 15x, 20x, 25x, 50x, or even 100x!\n\n' +
            'Once all tumbles are finished, the total of all           multipliers is added and applied to the total win of the that sequence.\n\n' +
            'Special reels are used during the FREE SPINS round.');

        
            const multiplierIcon2 = this.scene.add.image(0, 0, 'multiplierIcon');
            multiplierIcon2.setScale(0.15);
            multiplierIcon2.setOrigin(0.5, 0.5);
            multiplierIcon2.setPosition(153.5, 500);
            multiplierContainer.add(multiplierIcon2);
        
            const multiplierIcon3 = this.scene.add.image(0, 0, 'multiplierIcon');
            multiplierIcon3.setScale(0.15);
            multiplierIcon3.setOrigin(0.5, 0.5);
            multiplierIcon3.setPosition(163, 355);
            multiplierContainer.add(multiplierIcon3);
        
            const multiplierIcon4 = this.scene.add.image(0, 0, 'multiplierIcon');
            multiplierIcon4.setScale(0.15);
            multiplierIcon4.setOrigin(0.5, 0.5);
            multiplierIcon4.setPosition(80, 230);
            multiplierContainer.add(multiplierIcon4);
            
        
        const multiplierIcon = this.scene.add.image(0, 0, 'multiplierIcon');
        multiplierIcon.setScale(0.25);
        multiplierIcon.setOrigin(0.5, 0.5);
        multiplierIcon.setPosition(40, 40);
        multiplierContainer.add(multiplierIcon);
        this.contentContainer.bringToTop(multiplierIcon);
        
        this.yPosition -= scaledSymbolSize * 10.5
        this.addContent('Game Settings', 'title');

        const gamesettingsContainer = this.scene.add.container(0, this.yPosition);
        this.yPosition += this.createBorder(gamesettingsContainer, 
            -this.padding, 
            0, 
            this.contentWidth, 
            scaledSymbolSize * 10
        );
        this.contentContainer.add(gamesettingsContainer);

        this.yPosition -= scaledSymbolSize * 9.75;

        this.addContent('Paylines', 'title');

        this.createHowToPlayEntry(20, scaledSymbolSize * 0.75, gamesettingsContainer, '', 'Symbols can land anywhere on the screen.');

        this.createHowToPlayEntry(20, scaledSymbolSize * 2.75, gamesettingsContainer, 'paylineMobileWin', '');
        this.createHowToPlayEntry(20, scaledSymbolSize * 5.25, gamesettingsContainer, 'paylineMobileNoWin', '');

        this.createHowToPlayEntry(20, scaledSymbolSize * 6.5, gamesettingsContainer, '', 'All wins are multiplied by the base bet.');
        this.createHowToPlayEntry(20, scaledSymbolSize * 7.5, gamesettingsContainer, '', 'When multiple symbol wins occur, all values are combined into the total win.');
        this.createHowToPlayEntry(20, scaledSymbolSize * 8.75, gamesettingsContainer, '', 'Free spins rewards are granted after the round ends.');

        this.yPosition -= scaledSymbolSize * 4;

        this.commonRules(this.contentWidth, 153);

        this.yPosition -= scaledSymbolSize * 38;
    }

    private createContent(): void {
        this.padding = 20;
        this.contentWidth = 1200;
        this.yPosition = 0;

        // Game Rules Header
        this.addContent('Game Rules', 'title');

        // Game Rules Text
        this.addContent('Win by landing 8 or more matching symbols anywhere on the screen.', 'text', true, this.contentWidth - this.padding * 2);
        this.addContent('The more matching symbols you get, the higher your payout.', 'text', true, this.contentWidth - this.padding * 4);


        // RTP Header
        this.addContent('RTP', 'title');

        // RTP Text
        this.addContent('96.49% - 96.6%', 'text');

        // Payout Section
        this.addContent('Payout', 'title');

        // Create 3x3 symbol grid with payouts
        const symbolSize = 153;
        const symbolScale = 0.5;
        const scaledSymbolSize = symbolSize * symbolScale;
        const tableWidth = 250;  // Width for the 2x3 payout table
        const cellSpacing = 50;
        const genericTableWidth = 1129;
        
        // Calculate total width needed for each row (3 symbols + tables)
        const rowWidth = (scaledSymbolSize + tableWidth + cellSpacing);
        // Center the grid horizontally
        const startX = (this.contentWidth - rowWidth) / 10;

        // Create 3x3 grid
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const symbolIndex = row * 3 + col + 1;
                const cellX = startX + col * (scaledSymbolSize + tableWidth + cellSpacing * 1.5);
                const cellY = this.yPosition + cellSpacing * 2;

                // Create symbol container with white border
                const symbolContainer = this.scene.add.container(cellX, cellY);

                this.createBorder(symbolContainer, 
                    -this.padding, 
                    -scaledSymbolSize, 
                    scaledSymbolSize + tableWidth, 
                    scaledSymbolSize * 1.5
                );

                // Add symbol using SymbolContainer
                const symbol = new SymbolContainer(this.scene, 0, 0, symbolIndex, this.scene.gameData);
                symbol.setSymbolDisplaySize(symbolSize * symbolScale, symbolSize * symbolScale);
                symbol.setScale(1);
                symbol.getSymbolSprite().setOrigin(0, 0.7);
                symbolContainer.add(symbol);

                // Add payout table next to symbol
                this.createPayoutTable(
                    scaledSymbolSize + symbolSize/5,  // Position table right of symbol
                    0,                      // Center vertically with symbol
                    symbolContainer,
                    symbolIndex
                );

                this.contentContainer.add(symbolContainer);
            }
            this.yPosition += scaledSymbolSize + this.padding * 3.25;  // Move to next row
        }

        this.yPosition += this.padding;

        const content = this.scene.add.text(this.padding * 5, this.yPosition + this.padding, 'Scatter', {
            ...this.textStyle,
        });
        this.contentContainer.add(content);
        

        this.yPosition += this.padding * 3;
        // Add scatter symbol row (full width)
        const scatterContainer = this.scene.add.container(startX, this.yPosition + this.padding * 2);
        
        this.createBorder(scatterContainer, 
            -this.padding, 
            -scaledSymbolSize * 1.25, 
            genericTableWidth, 
            scaledSymbolSize * 2
        );
        
        // Add scatter symbol
        const scatter = this.scene.add.sprite(0, 0, 'ScatterLabel');
        scatter.setScale(0.6);
        scatter.setOrigin(-1, 0.75);
        scatterContainer.add(scatter);

        // Add scatter payout table
        this.createPayoutTable(
            scaledSymbolSize + 200,
            0,
            scatterContainer,
            0
        );

        this.contentContainer.add(scatterContainer);
        this.contentContainer.sendToBack(scatterContainer);
        this.yPosition += scaledSymbolSize + this.padding * 4;


        this.addDivider();

        // Enhanced Bet Title
        const nextPageText = this.scene.add.text(this.padding, this.yPosition, 'Enhanced Bet', this.titleStyle);    
        this.yPosition += this.padding * 8;
        this.contentContainer.add(nextPageText);

        
        // Double Feature Help
        const doubleHelpContainer = this.scene.add.container(this.padding, this.yPosition);
        
        this.createBorder(doubleHelpContainer, 
            this.padding, 
            -scaledSymbolSize * 1.25, 
            genericTableWidth, 
            scaledSymbolSize * 2.5
        );

        const doubleHelpImage = this.scene.add.image(0, 0, 'DoubleHelp');
        doubleHelpImage.setOrigin(-0.25, 0.5);
        doubleHelpImage.setScale(1);
        doubleHelpContainer.add(doubleHelpImage);

        const doubleHelpText = this.scene.add.text(
            doubleHelpImage.displayWidth + this.padding * 5,
            0,
            "You're wagering 25% more per spin, but you also have better chances at hitting big features.",
            {
                ...this.textStyle,
                wordWrap: { width: this.contentWidth - doubleHelpImage.displayWidth - this.padding * 10 }
            }
        );
        doubleHelpText.setOrigin(0, 0.5);
        doubleHelpContainer.add(doubleHelpText);
        this.contentContainer.add(doubleHelpContainer);

        this.yPosition += Math.max(doubleHelpImage.displayHeight, doubleHelpText.height) + this.padding * 5;

        // Row 2: Buy Feature Help
        const buyFeatContainer = this.scene.add.container(this.padding, this.yPosition);
        
        // Add white border background with gray fill
        this.createBorder(buyFeatContainer, 
            this.padding, 
            -scaledSymbolSize * 1.25, 
            genericTableWidth, 
            scaledSymbolSize * 2.5
        );

        const buyFeatImage = this.scene.add.image(0, 0, 'BuyFeatHelp');
        buyFeatImage.setOrigin(-0.125, 0.5);
        buyFeatImage.setScale(1);
        buyFeatContainer.add(buyFeatImage);

        const buyFeatText = this.scene.add.text(
            buyFeatImage.displayWidth + this.padding * 2,
            0,
            'Lets you buy the free spins round for 100x your total bet',
            {
                ...this.textStyle,
                wordWrap: { width: this.contentWidth - buyFeatImage.displayWidth - this.padding * 3 }
            }
        );
        buyFeatText.setOrigin(0, 0.5);
        buyFeatContainer.add(buyFeatText);
        this.contentContainer.add(buyFeatContainer);

        this.yPosition += Math.max(buyFeatImage.displayHeight, buyFeatText.height) + this.padding;

        this.addDivider();

        this.addContent('Tumble Win', 'title');

        this.yPosition += this.padding;

        const tumbleWinContainer = this.scene.add.container(this.padding, this.yPosition);

        const tumbleGameImage = this.scene.add.image(0, 0, 'tumbleGame');
        tumbleGameImage.setScale(1);
        tumbleGameImage.setOrigin(0.5, 0.5);
        tumbleGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, tumbleGameImage.height/2 + this.padding);
        tumbleWinContainer.add(tumbleGameImage);
        

        const tumbleSymbolImage = this.scene.add.image(0, 0, 'tumbleSymbol');
        tumbleSymbolImage.setScale(1);
        tumbleSymbolImage.setOrigin(0.5, 0.5);
        tumbleSymbolImage.setPosition(tumbleGameImage.x - tumbleGameImage.displayWidth/2 - this.padding, tumbleSymbolImage.height*3/4 + this.padding);
        tumbleWinContainer.add(tumbleSymbolImage);
        

        const tumbleWinImage = this.scene.add.image(0, 0, 'tumbleWin');
        tumbleWinImage.setScale(1);
        tumbleWinImage.setOrigin(0.5, 0.5);
        tumbleWinImage.setPosition(tumbleSymbolImage.x - tumbleSymbolImage.displayWidth/2 + this.padding, tumbleSymbolImage.y - tumbleWinImage.height/2);
        tumbleWinContainer.add(tumbleWinImage);
        
        const tumbleWinText = this.scene.add.text(
            0, 0,
            'After each spin, winning symbols are paid and then removed from the screen. Remaining symbols drop down, and new ones fall from above to fill the empty spaces.\n\n' +
            'Tumbles continue as long as new winning combinations appear — there\'s no limit to the number of tumbles per spin.\n\n' +
            'All wins are credited to the player\'s balance after all tumbles from a base spin are completed.',
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 }
            }
        );
        
        tumbleWinText.setPosition(this.padding * 4, tumbleWinImage.displayHeight/2 + tumbleGameImage.displayHeight + this.padding);
        
        tumbleWinContainer.add(tumbleWinText);
        this.yPosition += this.createBorder(tumbleWinContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 9
        );
        this.contentContainer.add(tumbleWinContainer);
        
        this.yPosition += this.padding * 3;

        this.addDivider();

        this.addContent('Free Spins Rules', 'title');

        this.yPosition += this.padding;

        const freeSpinContainer = this.scene.add.container(this.padding, this.yPosition);

        const scatterGameImage = this.scene.add.image(0, 0, 'scatterGame');
        scatterGameImage.setScale(1);
        scatterGameImage.setOrigin(0.5, 0.5);
        scatterGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, scatterGameImage.height/2 + this.padding);
        freeSpinContainer.add(scatterGameImage);
        

        const scatterSymbolImage = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage.setScale(1);
        scatterSymbolImage.setOrigin(0.5, 0.5);
        scatterSymbolImage.setPosition(scatterGameImage.x - scatterGameImage.displayWidth/2 - this.padding, scatterSymbolImage.height + this.padding);
        freeSpinContainer.add(scatterSymbolImage);


        const scatterSymbolImage3 = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage3.setScale(0.65);
        scatterSymbolImage3.setOrigin(0.5, 0.5);
        scatterSymbolImage3.setRotation(0.3);
        scatterSymbolImage3.setPosition(scatterSymbolImage.x - this.padding * 2.5, scatterSymbolImage.y - this.padding * 2.5);
        freeSpinContainer.add(scatterSymbolImage3);

        const scatterSymbolImage4 = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage4.setScale(0.7);
        scatterSymbolImage4.setOrigin(0.5, 0.5);    
        scatterSymbolImage4.setRotation(-0.3);
        scatterSymbolImage4.setPosition(scatterSymbolImage.x - this.padding * 3.5, scatterSymbolImage.y + this.padding * 3.5);
        freeSpinContainer.add(scatterSymbolImage4);

        const scatterSymbolImage5 = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage5.setScale(0.5);
        scatterSymbolImage5.setOrigin(0.5, 0.5);
        scatterSymbolImage5.setRotation(0.3);
        scatterSymbolImage5.setPosition(scatterSymbolImage.x + this.padding * 2.5, scatterSymbolImage.y + this.padding * 2.5);
        freeSpinContainer.add(scatterSymbolImage5);
        freeSpinContainer.bringToTop(scatterSymbolImage);
        


        const scatterWinImage = this.scene.add.image(0, 0, 'scatterWin');
        scatterWinImage.setScale(1);
        scatterWinImage.setOrigin(0.5, 0.5);
        scatterWinImage.setPosition(scatterSymbolImage.x + scatterSymbolImage.displayWidth/3,
             scatterSymbolImage.y * 3/4 - scatterWinImage.height/2 + this.padding);
        freeSpinContainer.add(scatterWinImage);
       
        const scatterSymbolImage2 = this.scene.add.image(0, 0, 'scatterIcon');
        scatterSymbolImage2.setScale(0.25);
        scatterSymbolImage2.setOrigin(0.5, 0.5);
        scatterSymbolImage2.setPosition(scatterGameImage.x - scatterGameImage.displayWidth/2 - this.padding * 2.25, 
                scatterSymbolImage.y + scatterSymbolImage.displayHeight + this.padding * 4.25);
        freeSpinContainer.add(scatterSymbolImage2);
        

        const freeSpinText = this.scene.add.text(
            0, 0,
            'Bonus Trigger\n\n' +
            'Land 4 or more          SCATTER   symbols anywhere on the screen to trigger the FREE SPINS feature.\n\n' +
            'You\'ll start with 10 free spins.\n\n' +
            'During the bonus round, hitting 3 or more SCATTER symbols awards 5 extra free spins',
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 }
            }
        );
        
        freeSpinText.setPosition(this.padding * 4, scatterWinImage.displayHeight/2 + scatterGameImage.displayHeight + this.padding);
        
        freeSpinContainer.add(freeSpinText);

        this.yPosition += this.createBorder(freeSpinContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 9
        );
        this.contentContainer.add(freeSpinContainer);
        
        this.yPosition += this.padding;
        //this.addDivider(0x57FFA3, 1);

        const multiplierContainer = this.scene.add.container(this.padding, this.yPosition);

        const multiplierGameImage = this.scene.add.image(0, 0, 'multiplierGame');
        multiplierGameImage.setScale(1);
        multiplierGameImage.setOrigin(0.5, 0.5);
        multiplierGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, multiplierGameImage.height/2 + this.padding);
        multiplierContainer.add(multiplierGameImage);
        

        const multiplierSymbolImage = this.scene.add.image(0, 0, 'multiplierIcon');
        multiplierSymbolImage.setScale(0.75);
        multiplierSymbolImage.setOrigin(0.5, 0.5);
        multiplierSymbolImage.setPosition(
            multiplierGameImage.x - multiplierGameImage.displayWidth/2 - this.padding * 3, 
            multiplierSymbolImage.height - this.padding * 2);
        multiplierContainer.add(multiplierSymbolImage);
        

        const multiplierText = this.scene.add.text(
            0, 0,
            'Multiplier\n\n' +
            'The         Multiplier symbol appears only during the FREE SPINS round and remains on\n' +
            'the screen until the tumbling sequence ends\n\n' +
            'Each time a          lands, it randomly takes a multiplie value:\n' +
            '2x, 3x, 4x, 5x, 6x, 8x, 10x, 12x, 15x, 20x, 25x, 50x, or even 100x!\n\n' +
            'Once all tumbles are finished, the total of all          multipliers is added and applied to\n' +
            'the total win of that sequence\n\n' +
            'Special reels are used during the FREE SPINS round',
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 }
            }
        );
        
        const miniBomb1 = this.scene.add.image(0, 0, 'multiplierIcon');
        miniBomb1.setScale(0.15);
        miniBomb1.setOrigin(0.5, 0.5);
        miniBomb1.setPosition(
            multiplierGameImage.x - multiplierGameImage.displayWidth * 3/4 - this.padding * 0.55, 
            multiplierSymbolImage.height * 1.88);
        multiplierContainer.add(miniBomb1);
        
        const miniBomb2 = this.scene.add.image(0, 0, 'multiplierIcon');
        miniBomb2.setScale(0.15);
        miniBomb2.setOrigin(0.5, 0.5);
        miniBomb2.setPosition(
            multiplierGameImage.x - multiplierGameImage.displayWidth * 3 / 5 + this.padding / 2 - this.padding * 1.5, 
            multiplierSymbolImage.height * 7/3 - this.padding * 1.5);
        multiplierContainer.add(miniBomb2);
        
        const miniBomb3= this.scene.add.image(0, 0, 'multiplierIcon');
        miniBomb3.setScale(0.15);
        miniBomb3.setOrigin(0.5, 0.5);
        miniBomb3.setPosition(
            multiplierGameImage.x + multiplierGameImage.displayWidth * 0.06 - this.padding * 4.75, 
            multiplierSymbolImage.height * 8/3 - this.padding * 1.5);
        multiplierContainer.add(miniBomb3);
        
        multiplierText.setPosition(this.padding * 4, multiplierSymbolImage.displayHeight/2 + multiplierGameImage.displayHeight * 3/4 + this.padding);
        
        multiplierContainer.add(multiplierText);

        this.yPosition += this.createBorder(multiplierContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 9.5
        );
        this.contentContainer.add(multiplierContainer);

        this.yPosition += this.padding*2;
        
        this.addContent('Game Settings', 'title');

        this.yPosition += this.padding;

        
        const paylinesContainer = this.scene.add.container(this.padding, this.yPosition);

        const paylinesText1 = this.scene.add.text(
            0, 0,
            'Paylines\n\n' +
            'Symbols can land anywhere on the screen.\n\n',
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 }
            }
        );
        

        paylinesText1.setPosition(this.padding * 4, this.padding);

        paylinesContainer.add(paylinesText1);
        const paylinesWin1 = this.scene.add.image(0, this.padding * 3, 'paylineMobileWin');
        paylinesWin1.setScale(1);
        paylinesWin1.setOrigin(0.5, 0.5);
        paylinesWin1.setPosition(
            genericTableWidth / 2,
            paylinesWin1.height / 2 + this.padding * 4);
        paylinesContainer.add(paylinesWin1);
        

        const paylinesNoWin1 = this.scene.add.image(paylinesWin1.x, paylinesWin1.y, 'paylineMobileNoWin');
        paylinesNoWin1.setScale(1);
        paylinesNoWin1.setOrigin(0.5, 0.5);
        paylinesNoWin1.setPosition(
            paylinesWin1.x,
            paylinesWin1.y + paylinesWin1.displayHeight + this.padding * 2);
        paylinesContainer.add(paylinesNoWin1);
        

        const paylinesText2 = this.scene.add.text(
            0, 0,
            'All wins are multiplied by the base bet.\n\n' +
            'When multiple symbol wins occur, all values are combined into the total win.\n\n' +
            'Free spins rewards are granted after the round ends.',
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6 }
            }
        );
        
        paylinesText2.setPosition(this.padding * 4, paylinesNoWin1.height / 2 + paylinesNoWin1.y + this.padding);
        
        paylinesContainer.add(paylinesText2);

        this.yPosition += this.createBorder(paylinesContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 9.5
        );
        this.contentContainer.add(paylinesContainer);
        
        this.yPosition += this.padding;

        
        this.commonRules(genericTableWidth, scaledSymbolSize);
        

        this.yPosition += scaledSymbolSize * 5;
    }

    private commonRules(genericTableWidth: number, scaledSymbolSize: number): void {
        
        this.addContent('How to Play', 'title');
        const commonPadding = 20;
        
        const howToPlayContainer = this.scene.add.container(commonPadding, this.yPosition);

        this.yPosition += this.createBorder(howToPlayContainer, 
            this.padding, 
            0, 
            genericTableWidth, 
            scaledSymbolSize * 19
        );
        this.contentContainer.add(howToPlayContainer);

        this.createHeader(commonPadding * 2, this.isMobile ? commonPadding : commonPadding * 1.5, howToPlayContainer, 'Bet Controls', '#379557');

        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 5 : commonPadding * 6 , howToPlayContainer, 'howToPlay1', 'Adjust your total bet.');

        this.createHeader(commonPadding * 2, this.isMobile ? commonPadding * 10 : commonPadding * 9, howToPlayContainer, 'Game Actions', '#379557');
        
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 15 : commonPadding * 14, howToPlayContainer, 'howToPlay2', 'Start the game round.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 25 : commonPadding * 21, howToPlayContainer, 'howToPlay3', 'Open the autoplay menu. Tap again to stop autoplay.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 35 : commonPadding * 28, howToPlayContainer, 'howToPlay4', 'Speeds up the game.');

        this.createHeader(commonPadding * 2, this.isMobile ? commonPadding * 42 : commonPadding * 32, howToPlayContainer, 'Display & Stats', '#379557');

        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 47 : commonPadding * 37, howToPlayContainer, 'howToPlay5', 'Shows your current available credits.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 58 : commonPadding * 44, howToPlayContainer, 'howToPlay6', 'Display your total winnings from the current round.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 69 : commonPadding * 51, howToPlayContainer, 'howToPlay7', 'Adjust your wager using the - and + buttons.');

        this.createHeader(commonPadding * 2, this.isMobile ? commonPadding * 77 : commonPadding * 55, howToPlayContainer, 'General Controls', '#379557');

        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 80 : commonPadding * 59, howToPlayContainer, 'howToPlay8', 'Toggle game sounds on and off.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 88 : commonPadding * 63, howToPlayContainer, 'howToPlay9', 'Access gameplay preferences and system options.');
        this.createHowToPlayEntry(commonPadding * 2, this.isMobile ? commonPadding * 98 : commonPadding * 68, howToPlayContainer, 'howToPlay10', 'View game rules, features, and paytable.');     
        
        this.yPosition -= scaledSymbolSize * 3;
    }

    private createHeader(x: number, y: number, container: GameObjects.Container, text: string, color: string): void {
        const genericTableWidth = 1129;
        
        const header = this.scene.add.text(0, 0,text,
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

    private createHowToPlayEntry(x: number, y: number, container: GameObjects.Container, image: string, text: string): void {
        const genericTableWidth = this.isMobile ? this.viewWidth - this.padding * 2 : 1129;
        let imageElement = null;
        if(image!=''){
            imageElement = this.scene.add.image(x, y, image);
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
     
        const textElement = this.scene.add.text(
            0, 0,
            text,
            {
                ...this.textStyle,
                wordWrap: { width: genericTableWidth - this.padding * 6},
                
            }
        );
        textElement.setPosition(
            this.isMobile ? x : x + (imageElement != null ? imageElement.displayWidth + this.padding : 0),
            this.isMobile ? (imageElement != null ? imageElement.y + imageElement.displayHeight / 2 + this.padding * 2 : y) : y);
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

    private createBorder(_container: GameObjects.Container, _x: number, _y: number, _width: number, _height: number): number {
        const border = this.scene.add.graphics();
        _x = this.isMobile ? _x - this.padding * 10 : _x;
        _width = this.isMobile ? this.scene.scale.width * 1.21 : _width;
        border.fillStyle(0x333333);
        border.fillRoundedRect(_x, _y, _width, _height, 8);
        border.lineStyle(2, 0x333333);
        border.strokeRoundedRect(_x, _y, _width, _height, 8);
        border.setAlpha(0.7);
        _container.add(border);
        _container.sendToBack(border);
        return _height;
    }

    private addDivider(_color: number = 0xFFFFFF): void {
        // Add divider
        const divider = this.scene.add.graphics();
        divider.lineStyle(2, _color);
        const x2 = this.isMobile ? this.viewWidth - this.padding * 4 : this.contentWidth + this.padding * 2;
        divider.lineBetween(this.padding, this.yPosition, x2, this.yPosition );
        this.contentContainer.add(divider);
        this.yPosition += this.padding;
    }

    private createPayoutTable(x: number, y: number, container: GameObjects.Container, symbolIndex: number): void {
        const cellWidth1 = this.isMobile ? 60 : 45;
        const cellWidth2 = this.isMobile ? 120 : 80;
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
        const graphics = this.scene.add.graphics();

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
                        const text2 = (this.scene.gameData.winamounts[row][symbolIndex] * this.scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        payoutAdjustments[row] = text2.length;

                        let text : string;  
                        const repeatTimes = payoutAdjustments[0] - text2.length;

                        if(repeatTimes > 0){
                            text = col == 0 ? matchNumRange[row] : 
                                ' '.repeat(repeatTimes) + this.scene.gameData.currency + text2;
                        }
                        else{
                            text = col == 0 ? matchNumRange[row] : 
                                this.scene.gameData.currency + text2;
                        }

                        let textElement : GameObjects.Text;
                         if(col == 0){
                            textElement = this.scene.add.text(cellX + cellWidth/2, cellY + cellHeight/2, text, {
                                fontSize: '20px',
                                color: '#FFFFFF',
                                fontFamily: 'Poppins', 
                                align: 'left'
                            });
                        }
                        else{
                            textElement = this.scene.add.text(cellX + cellWidth/2, cellY + cellHeight/2, text, {
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
                    const text2 = (this.scene.gameData.winamounts[row][symbolIndex] * this.scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        payoutAdjustments[row] = text2.length;

                        let text : string;  
                        const repeatTimes = payoutAdjustments[0] - text2.length;

                        if(repeatTimes > 0){
                            text = col == 0 ? scatterNumRange[row] : 
                                ' '.repeat(repeatTimes) + this.scene.gameData.currency + text2;
                        }
                        else{
                            text = col == 0 ? scatterNumRange[row] : 
                                this.scene.gameData.currency + text2;
                        }

                    if(col == 0) {
                        const textElement = this.scene.add.text(cellX + cellWidth/2, cellY + cellHeight/2, text, {
                            fontSize: '20px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins'
                        });
                        textElement.setOrigin(col == 0 ? 0 : 0.5, 0.5);
                        container.add(textElement);
                    } else if(col == 1) {
                        
                        const textElement = this.scene.add.text(cellX + cellWidth/2, cellY + cellHeight/2, text, {
                            fontSize: '20px',
                            color: '#FFFFFF',
                            fontFamily: 'Poppins'
                        });
                        textElement.setOrigin(0.5, 0.5);
                        container.add(textElement);
                    
                    } else {
                        const scatterTextCell = this.scene.add.text(
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
                            scatterTextCell.setPosition(0, scatterTextCell.y + scatterTextCell.displayHeight + this.padding * 10);
                            scatterTextCell.setWordWrapWidth(this.contentWidth * 2);
                        }
                    }
                }
            }
        }
        container.add(graphics);
    }

    private enableScrolling(scene: Scene): void {
        let isDragging = false;
        let startY = 0;
        let currentY = 0;
        let lastY = 0;
        let dragVelocity = 0;
        const minVelocity = 0.1;

        // Make the scroll view interactive for the full width and height
        this.scrollView.setInteractive(new Phaser.Geom.Rectangle(
            0, 0,
            scene.scale.width,
            scene.scale.height
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
            const minY = Math.min(0, scene.scale.height - this.yPosition);
            
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
                const minY = Math.min(0, scene.scale.height - this.yPosition);
                
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
            const minY = Math.min(0, scene.scale.height - this.yPosition);
            
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

    show(): void {
        if (this.isVisible) return;
        
        // Create new help screen content
        this.create(this.scene);
        
        this.container.setVisible(true);
        this.isVisible = true;
        
        // Slide in from left with content
        this.container.x = -this.viewWidth; // Start from off-screen left
        this.container.scene.tweens.add({
            targets: this.container,
            x: 0,
            duration: 500,
            ease: 'Power2'
        });
    }

    hide(): void {
        if (!this.isVisible) return;

        // Slide out to left with content
        this.container.scene.tweens.add({
            targets: this.container,
            x: -this.viewWidth * 1.5,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.container.setVisible(false);
                this.isVisible = false;
                // Emit event to update info button state
                Events.emitter.emit(Events.HELP_SCREEN_TOGGLE);
                // Destroy the help screen content
                this.destroy();
            }
        });
    }

    destroy(): void {
        if (this.mask) {
            this.mask.destroy();
        }
        if (this.container) {
            this.container.destroy();
        }
        this.isVisible = false;
    }
}
