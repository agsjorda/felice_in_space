import { Scene, GameObjects } from 'phaser';
import { GameData } from './GameData';
// import { Events } from './Events';
// import { SymbolContainer } from './SymbolContainer';
    
interface GameScene extends Scene {
    gameData: GameData;
}

export class HelpScreen {
    // private container: GameObjects.Container;
    // private scrollView: GameObjects.Container;
    // private contentContainer: GameObjects.Container;
    // private mask: Phaser.Display.Masks.GeometryMask;
    // private isVisible: boolean = false;
    // private scene: GameScene;
    // private viewWidth: number = 1329;
    // private isMobile: boolean = false;

    constructor() {
        // this.isVisible = false;
    }

    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }   

    preload(scene: GameScene): void {
        // Load scatter symbol
        
    }

    create(scene: GameScene): void {
        return;
    //     this.isMobile = this.isMobileDevice();

    //     const screenHeight = scene.scale.height;
    //     const padding = this.isMobile ? 16 : 64;

    //     this.viewWidth = this.isMobile ? scene.scale.width : 1329;

    //     // Position container initially off-screen to the left
    //     this.container = scene.add.container(-this.viewWidth, 0);
    //     this.container.setDepth(1000);
    //     this.container.setVisible(false);

    //     // Create background with blur effect
    //     const bg = scene.add.graphics();
    //     bg.fillStyle(0x000000, 0.8);
    //     bg.fillRoundedRect(0, 0, this.viewWidth, screenHeight, 1);
    //     bg.strokeRoundedRect(0, 0, this.viewWidth, screenHeight, 1);
    //     this.container.add(bg);

    //     // Create scroll view container
    //     this.scrollView = scene.add.container(padding, padding);
    //     this.container.add(this.scrollView);

    //     // Create content container that will hold all the content
    //     this.contentContainer = scene.add.container(0, 0);
    //     this.scrollView.add(this.contentContainer);

    //     // Create mask for scroll view
    //     const maskGraphics = scene.add.graphics();
    //     maskGraphics.fillStyle(0xffffff);
    //     maskGraphics.fillRect(this.container.x + padding, this.container.y + padding, 
    //                         this.viewWidth - padding * 2, screenHeight * 0.8 - padding * 2);
    //     //this.mask = maskGraphics.createGeometryMask();
    //     //this.scrollView.setMask(this.mask);

    //     // Create close button
    //     const closeButtonContainer = scene.add.container(
    //         this.isMobile ? this.viewWidth - padding * 6 : this.viewWidth - padding,  this.isMobile ? padding * 2 : padding);
    //     const closeButton = scene.add.image(0, 0, 'greenRectBtn');
    //     closeButton.setScale(this.isMobile ? 0.125 : 0.25, this.isMobile ? 0.25 : 0.5);
        
    //     const closeText = scene.add.image(0, 0, 'ekis');
    //     closeText.setOrigin(0.5);
    //     closeText.setScale(this.isMobile ? 0.5 : 1);
        
    //     closeButton.setPosition(closeButton.x + closeButton.width/4, closeButton.y);
    //     closeText.setPosition(closeText.x + closeButton.width/4, closeText.y);

    //     closeButtonContainer.add(closeButton);
    //     closeButtonContainer.add(closeText);

    //     closeButton.setInteractive()
    //         .on('pointerover', () => closeButton.setTint(0x3FFF0D))
    //         .on('pointerout', () => closeButton.clearTint())
    //         .on('pointerdown', () => {
    //         scene.audioManager.UtilityButtonSFX.play();
    //         this.hide(scene);
    //         scene.gameData.isHelpScreenVisible = false;
    //         Events.emitter.emit(Events.HELP_SCREEN_TOGGLE);
    //         }
    //     );

    //     this.container.add(closeButtonContainer);
    //     if(!this.isMobile){
    //         this.createContent(scene);
    //     }

    //     // Enable scrolling
    //     this.enableScrolling(scene);
    //     this.contentContainer.setSize(this.isMobile ? -this.viewWidth : -this.contentWidth, this.yPosition);
    //     this.contentContainer.setInteractive();
    //     this.contentContainer.setPosition( this.isMobile ? 0 : -this.padding * 2, 0);
    // }

    // private createContent(scene: GameScene): void {
    //     this.padding = 20;
    //     this.contentWidth = 1200;
    //     this.yPosition = 0;

    //     // Game Rules Header
    //     this.addContent(scene, 'Game Rules', 'title');

    //     // Game Rules Text
    //     this.addContent(scene, 'Win by landing 8 or more matching symbols anywhere on the screen.', 'text', true, this.contentWidth - this.padding * 2);
    //     this.addContent(scene, 'The more matching symbols you get, the higher your payout.', 'text', true, this.contentWidth - this.padding * 4);


    //     // RTP Header
    //     this.addContent(scene, 'RTP', 'title');

    //     // RTP Text
    //     this.addContent(scene, '96.49% - 96.6%', 'text');

    //     // Payout Section
    //     this.addContent(scene, 'Payout', 'title');
    //     this.yPosition += this.padding * 2;

    //     // Create 3x3 symbol grid with payouts
    //     const symbolSize = 153;
    //     const symbolScale = 0.5;
    //     const scaledSymbolSize = symbolSize * symbolScale;
    //     const tableWidth = 250;  // Width for the 2x3 payout table
    //     const cellSpacing = 10;
    //     const genericTableWidth = 1129;
        
    //     // Calculate total width needed for each row (3 symbols + tables)
    //     const rowWidth = (scaledSymbolSize + tableWidth + cellSpacing);
    //     // Center the grid horizontally
    //     const startX = (this.contentWidth - rowWidth) / 10;

    //     // Create 3x3 grid
    //     for (let row = 0; row < 3; row++) {
    //         for (let col = 0; col < 3; col++) {
    //             const symbolIndex = row * 3 + col + 1;
    //             const cellX = startX + col * (scaledSymbolSize + tableWidth + cellSpacing * 4);
    //             const cellY = this.yPosition + cellSpacing;

    //             // Create symbol container with white border
    //             const symbolContainer = scene.add.container(cellX, cellY);

    //             this.createBorder(scene, symbolContainer, 
    //                 -this.padding, 
    //                 -scaledSymbolSize, 
    //                 scaledSymbolSize + tableWidth * 1.1, 
    //                 scaledSymbolSize * 1.5
    //             );

    //             // Add symbol using SymbolContainer
    //             const symbol = new SymbolContainer(scene, 0, 0, symbolIndex, scene.gameData);
    //             symbol.setSymbolDisplaySize(scaledSymbolSize, scaledSymbolSize);
    //             symbol.setScale(symbolScale);
    //             symbol.getSymbolSprite().setOrigin(0, 0.3);
    //             // Set animation state and pause with timeScale = 0
    //             try { symbol.getSymbolSprite().animationState.setAnimation(0, `animation`, false); } catch (_e) {}
    //             try { symbol.getSymbolSprite().animationState.timeScale = 0; } catch (_e) {}
    //             symbolContainer.add(symbol);

    //             // Add payout table next to symbol
    //             this.createPayoutTable(scene,
    //                 scaledSymbolSize + symbolSize/5,  // Position table right of symbol
    //                 0,                      // Center vertically with symbol
    //                 symbolContainer,
    //                 symbolIndex
    //             );

    //             this.contentContainer.add(symbolContainer);
    //         }
    //         this.yPosition += scaledSymbolSize + this.padding * 2.5;  // Move to next row
    //     }


    //     this.yPosition += this.padding;

    //     const content = scene.add.text(this.padding * 4, this.yPosition - this.padding * 2 , 'Scatter', {
    //         ...this.textStyle,
    //     });
    //     this.contentContainer.add(content);
        

    //     // Add scatter symbol row (full width)
    //     const scatterContainer = scene.add.container(startX - this.padding/2, this.yPosition + this.padding);
        
    //     this.createBorder(scene, scatterContainer, 
    //         -this.padding / 2, 
    //         -scaledSymbolSize * 1.25, 
    //         genericTableWidth * 0.96, 
    //         scaledSymbolSize * 3
    //     );
        
    //     // Add scatter symbol
    //     const scatter = scene.add.sprite(this.padding, this.padding * 2, 'ScatterLabel');
    //     scatter.setScale(0.20);
    //     scatter.setOrigin(-1, 0.75);
    //     scatterContainer.add(scatter);

    //     // Add scatter payout table
    //     this.createPayoutTable(scene,
    //         scaledSymbolSize + 200,
    //         0,
    //         scatterContainer,
    //         0
    //     );

    //     this.contentContainer.add(scatterContainer);
    //     this.contentContainer.sendToBack(scatterContainer);
    //     this.yPosition += scaledSymbolSize + this.padding * 5;


    //     this.addDivider(scene);

    //     this.addContent(scene, 'Tumble Win', 'title');

    //     this.yPosition += this.padding;

    //     const tumbleWinContainer = scene.add.container(this.padding, this.yPosition);

    //     const tumbleGameImage = scene.add.image(0, 0, 'tumbleGame');
    //     tumbleGameImage.setScale(1);
    //     tumbleGameImage.setOrigin(0.5, 0.5);
    //     tumbleGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, tumbleGameImage.height/2 + this.padding);
    //     tumbleWinContainer.add(tumbleGameImage);
        

    //     const tumbleSymbolImage = scene.add.image(0, 0, 'tumbleSymbol');
    //     tumbleSymbolImage.setScale(1);
    //     tumbleSymbolImage.setOrigin(0.5, 0.5);
    //     tumbleSymbolImage.setPosition(tumbleGameImage.x - tumbleGameImage.displayWidth/2 - this.padding, tumbleSymbolImage.height*3/4 + this.padding);
    //     tumbleWinContainer.add(tumbleSymbolImage);
        

    //     const tumbleWinImage = scene.add.image(0, 0, 'tumbleWin');
    //     tumbleWinImage.setScale(1);
    //     tumbleWinImage.setOrigin(0.5, 0.5);
    //     tumbleWinImage.setPosition(tumbleSymbolImage.x - tumbleSymbolImage.displayWidth/2 + this.padding, tumbleSymbolImage.y - tumbleWinImage.height/2);
    //     tumbleWinContainer.add(tumbleWinImage);
        
    //     const tumbleWinText = scene.add.text(
    //         0, 0,
    //         'After each spin, winning symbols are paid and then removed from the screen. Remaining symbols drop down, and new ones fall from above to fill the empty spaces.\n\n' +
    //         'Tumbles continue as long as new winning combinations appear — there\'s no limit to the number of tumbles per spin.\n\n' +
    //         'All wins are credited to the player\'s balance after all tumbles from a base spin are completed.',
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 }
    //         }
    //     );
        
    //     tumbleWinText.setPosition(this.padding, tumbleWinImage.displayHeight/2 + tumbleGameImage.displayHeight + this.padding);
        
    //     tumbleWinContainer.add(tumbleWinText);
    //     this.yPosition += this.createBorder(scene, tumbleWinContainer, 
    //             0, 
    //         0, 
    //         genericTableWidth, 
    //         scaledSymbolSize * 9
    //     );
    //     this.contentContainer.add(tumbleWinContainer);
        
    //     this.yPosition += this.padding * 3;

    //     this.addDivider(scene);

    //     this.addContent(scene, 'Free Spins Rules', 'title');

    //     this.yPosition += this.padding;

    //     const freeSpinContainer = scene.add.container(this.padding, this.yPosition);

    //     //  game image scatte
    //     const scatterGameImage = scene.add.image(0, 0, 'scatterGame');
    //     scatterGameImage.setScale(1);
    //     scatterGameImage.setOrigin(0.5, 0.5);
    //     scatterGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, scatterGameImage.height/2 + this.padding);
    //     freeSpinContainer.add(scatterGameImage);
        
    //     // scatter 4 pieces
    //     const scatterSymbolImage = scene.add.image(0, 0, 'scatterIcon');
    //     scatterSymbolImage.setScale(1);
    //     scatterSymbolImage.setOrigin(0.5, 0.5);
    //     scatterSymbolImage.setPosition(scatterGameImage.x - scatterGameImage.displayWidth/2 - this.padding, scatterSymbolImage.height + this.padding);
    //     freeSpinContainer.add(scatterSymbolImage);

    //     // scatter 4 pieces
    //     const scatterSymbolImage3 = scene.add.image(0, 0, 'scatterIcon');
    //     scatterSymbolImage3.setScale(0.65);
    //     scatterSymbolImage3.setOrigin(0.5, 0.5);
    //     scatterSymbolImage3.setRotation(0.3);
    //     scatterSymbolImage3.setPosition(scatterSymbolImage.x - this.padding * 2.5, scatterSymbolImage.y - this.padding * 2.5);
    //     freeSpinContainer.add(scatterSymbolImage3);

    //     // scatter 4 pieces
    //     const scatterSymbolImage4 = scene.add.image(0, 0, 'scatterIcon');
    //     scatterSymbolImage4.setScale(0.7);
    //     scatterSymbolImage4.setOrigin(0.5, 0.5);    
    //     scatterSymbolImage4.setRotation(-0.3);
    //     scatterSymbolImage4.setPosition(scatterSymbolImage.x - this.padding * 3.5, scatterSymbolImage.y + this.padding * 3.5);
    //     freeSpinContainer.add(scatterSymbolImage4);

    //     // scatter 4 pieces
    //     const scatterSymbolImage5 = scene.add.image(0, 0, 'scatterIcon');
    //     scatterSymbolImage5.setScale(0.5);
    //     scatterSymbolImage5.setOrigin(0.5, 0.5);
    //     scatterSymbolImage5.setRotation(0.3);
    //     scatterSymbolImage5.setPosition(scatterSymbolImage.x + this.padding * 2.5, scatterSymbolImage.y + this.padding * 2.5);
    //     freeSpinContainer.add(scatterSymbolImage5);
    //     freeSpinContainer.bringToTop(scatterSymbolImage);
        

    //     // 4+ icon
    //     const scatterWinImage = scene.add.image(0, 0, 'scatterWin');
    //     scatterWinImage.setScale(1);
    //     scatterWinImage.setOrigin(0.5, 0.5);
    //     scatterWinImage.setPosition(scatterSymbolImage.x + scatterSymbolImage.displayWidth/3,
    //          scatterSymbolImage.y * 3/4 - scatterWinImage.height/2 + this.padding);
    //     freeSpinContainer.add(scatterWinImage);
       
    //     // land 4 or more - icon
    //     const scatterSymbolImage2 = scene.add.image(0, 0, 'scatterIcon');
    //     scatterSymbolImage2.setScale(0.25);
    //     scatterSymbolImage2.setOrigin(0.5, 0.5);
    //     scatterSymbolImage2.setPosition(scatterGameImage.x - scatterGameImage.displayWidth / 2 - this.padding * 5.5, 
    //             scatterSymbolImage.y + scatterSymbolImage.displayHeight + this.padding * 4.25);
    //     freeSpinContainer.add(scatterSymbolImage2);
        

    //     const freeSpinText = scene.add.text(
    //         0, 0,
    //         'Bonus Trigger\n\n' +
    //         'Land 4 or more          SCATTER   symbols anywhere on the screen to trigger the FREE SPINS feature.\n\n' +
    //         'You\'ll start with 10 free spins.\n\n' +
    //         'During the bonus round, hitting 3 or more SCATTER symbols awards 5 extra free spins',
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 }
    //         }
    //     );
        
    //     freeSpinText.setPosition(this.padding, scatterWinImage.displayHeight/2 + scatterGameImage.displayHeight + this.padding);
        
    //     freeSpinContainer.add(freeSpinText);

    //     this.yPosition += this.createBorder(scene, freeSpinContainer, 
    //         0, 
    //         0, 
    //         genericTableWidth, 
    //         scaledSymbolSize * 9
    //     );
    //     this.contentContainer.add(freeSpinContainer);
        
    //     this.yPosition += this.padding;
    //     //this.addDivider(0x57FFA3, 1);

    //     const multiplierContainer = scene.add.container(this.padding, this.yPosition);

    //     const multiplierGameImage = scene.add.image(0, 0, 'multiplierGame');
    //     multiplierGameImage.setScale(1);
    //     multiplierGameImage.setOrigin(0.5, 0.5);
    //     multiplierGameImage.setPosition(genericTableWidth / 2 + this.padding * 2, multiplierGameImage.height/2 + this.padding);
    //     multiplierContainer.add(multiplierGameImage);
        

    //     const multiplierSymbolImage = scene.add.image(0, 0, 'multiplierIcon');
    //     multiplierSymbolImage.setScale(0.75);
    //     multiplierSymbolImage.setOrigin(0.5, 0.5);
    //     multiplierSymbolImage.setPosition(
    //         multiplierGameImage.x - multiplierGameImage.displayWidth/2 - this.padding * 3, 
    //         multiplierSymbolImage.height - this.padding * 2);
    //     multiplierContainer.add(multiplierSymbolImage);
        

    //     const multiplierText = scene.add.text(
    //         0, 0,
    //         'Multiplier\n\n' +
    //         'The         Multiplier symbol appears only during the FREE SPINS round and remains on\n' +
    //         'the screen until the tumbling sequence ends\n\n' +
    //         'Each time a          lands, it randomly takes a multiplie value:\n' +
    //         '2x, 3x, 4x, 5x, 6x, 8x, 10x, 12x, 15x, 20x, 25x, 50x, or even 100x!\n\n' +
    //         'Once all tumbles are finished, the total of all        multipliers is added and applied to\n' +
    //         'the total win of that sequence\n\n' +
    //         'Special reels are used during the FREE SPINS round',
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 }
    //         }
    //     );
        
    //     // bomb 1
    //     const miniBomb1 = scene.add.image(0, 0, 'multiplierIcon');
    //     miniBomb1.setScale(0.15);
    //     miniBomb1.setOrigin(0.5, 0.5);
    //     miniBomb1.setPosition(
    //         multiplierGameImage.x - multiplierGameImage.displayWidth * 3/4 - this.padding * 3.5, 
    //         multiplierSymbolImage.height * 1.88);
    //     multiplierContainer.add(miniBomb1);
        
    //     // bomb 2
    //     const miniBomb2 = scene.add.image(0, 0, 'multiplierIcon');
    //     miniBomb2.setScale(0.15);
    //     miniBomb2.setOrigin(0.5, 0.5);
    //     miniBomb2.setPosition(
    //         multiplierGameImage.x - multiplierGameImage.displayWidth * 3 / 5 + this.padding / 2 - this.padding * 4.5, 
    //         multiplierSymbolImage.height * 7/3 - this.padding * 1.5);
    //     multiplierContainer.add(miniBomb2);
        
    //     // bomb 3
    //     const miniBomb3= scene.add.image(0, 0, 'multiplierIcon');
    //     miniBomb3.setScale(0.15);
    //     miniBomb3.setOrigin(0.5, 0.5);
    //     miniBomb3.setPosition(
    //         multiplierGameImage.x + multiplierGameImage.displayWidth * 0.06 - this.padding * 8,
    //         multiplierSymbolImage.height * 8/3 - this.padding * 1.5);
    //     multiplierContainer.add(miniBomb3);
        
    //     multiplierText.setPosition(this.padding, multiplierSymbolImage.displayHeight/2 + multiplierGameImage.displayHeight * 3/4 + this.padding);
        
    //     multiplierContainer.add(multiplierText);

    //     this.yPosition += this.createBorder(scene, multiplierContainer, 
    //             0, 
    //         0, 
    //         genericTableWidth, 
    //         scaledSymbolSize * 9.5
    //     );
    //     this.contentContainer.add(multiplierContainer);

    //     this.yPosition += this.padding*2;
        
    //     this.addContent(scene, 'Game Settings', 'title');

    //     this.yPosition += this.padding;

        
    //     const paylinesContainer = scene.add.container(this.padding, this.yPosition);

    //     const paylinesText1 = scene.add.text(
    //         0, 0,
    //         'Paylines\n\n' +
    //         'Symbols can land anywhere on the screen.\n\n',
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 }
    //         }
    //     );
        

    //     paylinesText1.setPosition(this.padding, this.padding);

    //     paylinesContainer.add(paylinesText1);
    //     const paylinesWin1 = scene.add.image(0, this.padding * 3, 'paylineMobileWin');
    //     paylinesWin1.setScale(1);
    //     paylinesWin1.setOrigin(0.5, 0.5);
    //     paylinesWin1.setPosition(
    //         genericTableWidth / 2,
    //         paylinesWin1.height / 2 + this.padding * 4);
    //     paylinesContainer.add(paylinesWin1);
        

    //     const paylinesNoWin1 = scene.add.image(paylinesWin1.x, paylinesWin1.y, 'paylineMobileNoWin');
    //     paylinesNoWin1.setScale(1);
    //     paylinesNoWin1.setOrigin(0.5, 0.5);
    //     paylinesNoWin1.setPosition(
    //         paylinesWin1.x,
    //         paylinesWin1.y + paylinesWin1.displayHeight + this.padding * 2);
    //     paylinesContainer.add(paylinesNoWin1);
        

    //     const paylinesText2 = scene.add.text(
    //         0, 0,
    //         'All wins are multiplied by the base bet.\n\n' +
    //         'When multiple symbol wins occur, all values are combined into the total win.\n\n' +
    //         'Free spins rewards are granted after the round ends.',
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 }
    //         }
    //     );
        
    //     paylinesText2.setPosition(this.padding, paylinesNoWin1.height / 2 + paylinesNoWin1.y + this.padding);
        
    //     paylinesContainer.add(paylinesText2);

    //     this.yPosition += this.createBorder(scene, paylinesContainer, 
    //                 0, 
    //         0, 
    //         genericTableWidth, 
    //         scaledSymbolSize * 9.5
    //     );
    //     this.contentContainer.add(paylinesContainer);
        
    //     this.yPosition += this.padding;

        
    //     this.commonRules(scene, genericTableWidth, scaledSymbolSize);
        

    //     this.yPosition += scaledSymbolSize * 5;
    // }

    // private commonRules(scene: GameScene, genericTableWidth: number, scaledSymbolSize: number): void {
        
    //     this.addContent(scene, 'How to Play', 'title');
    //     const commonPadding = 20;
        
    //     const howToPlayContainer = scene.add.container(0, this.yPosition);

    //     this.yPosition += this.createBorder(scene, howToPlayContainer, 
    //         this.padding, 
    //         0, 
    //         genericTableWidth, 
    //         scaledSymbolSize * 25
    //     );
    //     this.contentContainer.add(howToPlayContainer);

    //     this.createHeader(scene, commonPadding * 2, this.isMobile ? commonPadding : commonPadding * 1.5, howToPlayContainer, 'Bet Controls', '#379557');

    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 5 : commonPadding * 6 , howToPlayContainer, this.isMobile ? 'howToPlay1Mobile' : 'howToPlay1', this.isMobile ? '' : 'Adjust your total bet.');

    //     this.createHeader(scene, commonPadding * 2, this.isMobile ? commonPadding * 10 : commonPadding * 9, howToPlayContainer, 'Game Actions', '#379557');
        
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 15 : commonPadding * 14, howToPlayContainer, this.isMobile ? 'howToPlay2Mobile' : 'howToPlay2', this.isMobile ? '' : 'Start the game round.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 25 : commonPadding * 21, howToPlayContainer, this.isMobile ? 'howToPlay11Mobile' : 'BuyFeatHelp', this.isMobile ? '' : 'Lets you buy the free spins round for 100x your total bet.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 35 : commonPadding * 28, howToPlayContainer, this.isMobile ? 'howToPlay12Mobile' : 'DoubleHelp', this.isMobile ? '' : 'You\'re wagering 25% more per spin, but you also have better chances at hitting big features.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 45 : commonPadding * 35, howToPlayContainer, this.isMobile ? 'howToPlay3Mobile' : 'howToPlay3', this.isMobile ? '' : 'Open the autoplay menu. Tap again to stop autoplay.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 55 : commonPadding * 42, howToPlayContainer, this.isMobile ? 'howToPlay4Mobile' : 'howToPlay4', this.isMobile ? '' : 'Speeds up the game.');

    //     this.createHeader(scene, commonPadding * 2, this.isMobile ? commonPadding * 52 : commonPadding * 47, howToPlayContainer, 'Display & Stats', '#379557');

    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 57 : commonPadding * 52, howToPlayContainer, 'howToPlay5', 'Shows your current available credits.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 68 : commonPadding * 59, howToPlayContainer, 'howToPlay6', 'Display your total winnings from the current round.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 79 : commonPadding * 66, howToPlayContainer, 'howToPlay7', 'Adjust your wager using the - and + buttons.');

    //     this.createHeader(scene, commonPadding * 2, this.isMobile ? commonPadding * 87 : commonPadding * 71, howToPlayContainer, 'General Controls', '#379557');

    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 90 : commonPadding * 74, howToPlayContainer, this.isMobile ? 'howToPlay8Mobile' : 'howToPlay8', this.isMobile ? '' : 'Toggle game sounds on and off.');  
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 98 : commonPadding * 78, howToPlayContainer, this.isMobile ? 'howToPlay9Mobile' : 'howToPlay9', this.isMobile ? '' : 'Access gameplay preferences and system options.');
    //     this.createHowToPlayEntry(scene, commonPadding * 2, this.isMobile ? commonPadding * 108 : commonPadding * 83, howToPlayContainer, this.isMobile ? 'howToPlay10Mobile' : 'howToPlay10', this.isMobile ? '' : 'View game rules, features, and paytable.');        
    // }
    

    
    // protected padding = 20;
    // protected contentWidth = 1200;
    
    // protected titleStyle = {
    //     fontSize: '24px',
    //     color: '#379557',
    //     fontFamily: 'Poppins',
    //     fontStyle: 'bold'
    // };

    // protected textStyle = {
    //     fontSize: '20px',
    //     color: '#FFFFFF',
    //     fontFamily: 'Poppins',
    //     align: 'left',
    //     wordWrap: { width: this.contentWidth }
    // };

    // private yPosition: number = 0;
    // private addContent(scene: GameScene, _text:string, _type:string, _wordWrap: boolean = false, _wordWrapWidth: number = 0): void {
        

    //     if(_type == 'title'){
    //         const content = scene.add.text(this.padding / 2, this.yPosition, _text, this.titleStyle);
    //         this.contentContainer.add(content);
    //         if(_text == 'Bonus Trigger'){
    //             content.setPosition(content.x + this.padding * 2, content.y);
    //         }
    //         this.yPosition += content.height + this.padding;
    //     }
    //     else if(_type == 'text'){
    //             const content = scene.add.text(this.padding / 2, this.yPosition, _text, {
    //             ...this.textStyle,
    //             wordWrap: _wordWrap ? { width: _wordWrapWidth } : undefined
    //         });
    //         this.contentContainer.add(content);
    //         this.yPosition += content.height + this.padding;
    //     }
    // }
    // private createHeader(scene: GameScene, x: number, y: number, container: GameObjects.Container, text: string, color: string): void {
    //     const genericTableWidth = 1129;
        
    //     const header = scene.add.text(0, 0,text,
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6 },
    //             fontSize: '20px',
    //             color: color,
    //             fontFamily: 'Poppins',
    //             fontStyle: 'bold'
    //         }
    //     );
    //     header.setPosition(x, y);
    //     container.add(header);
    // }

    // private createHowToPlayEntry(scene: GameScene, x: number, y: number, container: GameObjects.Container, image: string, text: string): void {
    //     const genericTableWidth = this.isMobile ? this.viewWidth - this.padding * 2 : 1129;
    //     let imageElement = null;
    //     if(image!=''){
    //         imageElement = scene.add.image(x, y, image);
    //     }
    //     if(imageElement != null){
    //         if(image == 'tumbleGame' || image == 'scatterGame' || image == 'multiplierGame'){
    //             imageElement.setScale(0.5);
    //         }
    //         imageElement.setOrigin(0, 0.5);
    //     }
    //     if(image == 'BuyFeatMobile'){
    //         imageElement?.setPosition(x - imageElement.displayWidth/5, y);
    //     }
    //     if(imageElement != null){
    //         container.add(imageElement);
    //     }
     
    //     const textElement = scene.add.text(
    //         0, 0,
    //         text,
    //         {
    //             ...this.textStyle,
    //             wordWrap: { width: genericTableWidth - this.padding * 6},
                
    //         }
    //     );
    //     textElement.setPosition(
    //         this.isMobile ? x : x + (imageElement != null ? imageElement.displayWidth + this.padding : 0),
    //         this.isMobile ? (imageElement != null ? imageElement.y + imageElement.displayHeight / 2 + this.padding * 2 : y) :
    //                         (imageElement != null ? imageElement.y - imageElement.displayHeight / 10: y));
    //     textElement.setOrigin(0, 0);
        
    //     if(image == 'BuyFeatMobile'){
    //         textElement.setPosition(x, y + this.padding*5 );
    //     }
    //     if(image == 'scatterGame'){
    //         textElement.setPosition(x, textElement.y + this.padding * 6);
    //     }
    //     container.add(textElement); 
    //     if(this.isMobile){
    //         this.yPosition += (imageElement != null ? imageElement.displayHeight * 2 : 0) + textElement.displayHeight + this.padding * 2;
    //     }
    // }

    // private createBorder(scene: GameScene, _container: GameObjects.Container, _x: number, _y: number, _width: number, _height: number): number {
    //     const border = scene.add.graphics();
    //     border.fillStyle(0x333333);
    //     border.fillRoundedRect(_x, _y, _width, _height, 8);
    //     border.lineStyle(2, 0x333333);
    //     border.strokeRoundedRect(_x, _y, _width, _height, 8);
    //     border.setAlpha(0.7);
    //     _container.add(border);
    //     _container.sendToBack(border);
    //     return _height;
    // }

    // private addDivider(scene: GameScene, _color: number = 0xFFFFFF): void {
    //     // Add divider
    //     const divider = scene.add.graphics();
    //     divider.lineStyle(2, _color);
    //     const x2 = this.isMobile ? this.viewWidth - this.padding * 4 : this.contentWidth + this.padding * 2;
    //     divider.lineBetween(this.padding, this.yPosition, x2, this.yPosition );
    //     this.contentContainer.add(divider);
    //     this.yPosition += this.padding;
    // }

    // private createPayoutTable(scene: GameScene, x: number, y: number, container: GameObjects.Container, symbolIndex: number): void {
    //     const cellWidth1 = this.isMobile ? 60 : 45; 
    //     const cellWidth2 = this.isMobile ? 120 : 80;
    //     const cellHeight = 22.5;
    //     const cellPadding = 5;

    //     const tableHeight = (cellHeight + cellPadding) * 4;
    //     const matchNumRange : string[] = ['12+', '10', '8'];
    //     const scatterNumRange : string[] = ['6', '5', '4'];
    //     const scatterText: string[] = [
    //         'This is the SCATTER symbol.', 
    //         'SCATTER symbol is present on all reels.', 
    //         'SCATTER pays on any position.'
    //     ];
    //     // Center the table vertically relative to the symbol
    //     const tableY = y - tableHeight / 2;

    //     // Create table background
    //     const graphics = scene.add.graphics();

    //     let payoutAdjustments : [number, number, number] = [0, 0, 0];
    //     for (let row = 0; row < 3; row++) {
    //         for (let col = 0; col < 3; col++) {
    //             let cellWidth = 0;
    //             if(col == 0) {
    //                 cellWidth = cellWidth1;
    //             } else if(col == 1) {
    //                 cellWidth = cellWidth2;
    //             } else {
    //                 cellWidth = cellWidth2 * 2;
    //             }
    //             const cellX = x + (col == 2 ? cellWidth1 + cellWidth2 + cellPadding * 2 : col * (cellWidth + cellPadding));
    //             const cellY = tableY + row * (cellHeight + cellPadding);

    //             // Draw cell border
    //             graphics.strokeRect(cellX, cellY, cellWidth, cellHeight);

    //             if(symbolIndex != 0) {
    //                 // For regular symbols
    //                 if(col < 2) {
    //                     const text2 = (scene.gameData.winamounts[row][symbolIndex] * scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    //                     payoutAdjustments[row] = text2.length;

    //                     let text : string;  
    //                     const repeatTimes = payoutAdjustments[0] - text2.length;

    //                     if(repeatTimes > 0){
    //                         text = col == 0 ? matchNumRange[row] : 
    //                             ' '.repeat(repeatTimes) + scene.gameData.currency + text2;
    //                     }
    //                     else{
    //                         text = col == 0 ? matchNumRange[row] : 
    //                             scene.gameData.currency + text2;
    //                     }

    //                     let textElement : GameObjects.Text;
    //                      if(col == 0){
    //                         textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
    //                             fontSize: '20px',
    //                             color: '#FFFFFF',
    //                             fontFamily: 'Poppins', 
    //                             align: 'left'
    //                         });
    //                     }
    //                     else{
    //                         textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
    //                             fontSize: '20px',
    //                             color: '#FFFFFF',
    //                             fontFamily: 'Poppins', 
    //                             align: 'right'
    //                         });
    //                     }

    //                     textElement.setOrigin(col == 0 ? 0 : 0.5, 0.5);
    //                     container.add(textElement);
    //                 }
    //             } else {
    //                 // For scatter symbol
    //                 const text2 = (scene.gameData.winamounts[row][symbolIndex] * scene.gameData.bet).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    //                     payoutAdjustments[row] = text2.length;

    //                     let text : string;  
    //                     const repeatTimes = payoutAdjustments[0] - text2.length;

    //                     if(repeatTimes > 0){
    //                         text = col == 0 ? scatterNumRange[row] : 
    //                             ' '.repeat(repeatTimes) + scene.gameData.currency + text2;
    //                     }
    //                     else{
    //                         text = col == 0 ? scatterNumRange[row] : 
    //                             scene.gameData.currency + text2;
    //                     }

    //                 if(col == 0) {
    //                     const textElement = scene.add.text(cellX + cellWidth + this.padding, cellY + cellHeight/2, text, {
    //                         fontSize: '20px',
    //                         color: '#FFFFFF',
    //                         fontFamily: 'Poppins'
    //                     });
    //                     textElement.setOrigin(col == 0 ? 0 : 0.5, 0.5);
    //                     container.add(textElement);
    //                 } else if(col == 1) {
                        
    //                     const textElement = scene.add.text(cellX + cellWidth , cellY + cellHeight/2, text, {
    //                         fontSize: '20px',
    //                         color: '#FFFFFF',
    //                         fontFamily: 'Poppins'
    //                     });
    //                     textElement.setOrigin(0.5, 0.5);
    //                     container.add(textElement);
                    
    //                 } else {
    //                     const scatterTextCell = scene.add.text(
    //                         cellX + cellWidth/2 + this.padding,
    //                         cellY + cellHeight/2 - this.padding * 0.7,
    //                         scatterText[row], 
    //                         {
    //                             fontSize: '20px',
    //                             color: '#FFFFFF',
    //                             fontFamily: 'Poppins',
    //                         }
    //                     );
    //                     scatterTextCell.setOrigin(0, 0);
    //                     container.add(scatterTextCell);
    //                     if(this.isMobile){
    //                         scatterTextCell.setPosition(0, scatterTextCell.y + scatterTextCell.displayHeight + this.padding * 10);
    //                         scatterTextCell.setWordWrapWidth(this.contentWidth * 2);
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     container.add(graphics);
    // }

    // private enableScrolling(scene: GameScene): void {
    //     let isDragging = false;
    //     let startY = 0;
    //     let currentY = 0;
    //     let lastY = 0;
    //     let dragVelocity = 0;
    //     const minVelocity = 0.1;

    //     // Make the scroll view interactive for the full width and height
    //     this.scrollView.setInteractive(new Phaser.Geom.Rectangle(
    //         0, 0,
    //         scene.scale.width,
    //         scene.scale.height
    //     ), Phaser.Geom.Rectangle.Contains);

    //     this.scrollView.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    //         isDragging = true;
    //         startY = pointer.y;
    //         lastY = pointer.y;
    //         // Stop any ongoing momentum scrolling
    //         if (scene.tweens.isTweening(this.contentContainer)) {
    //             scene.tweens.killTweensOf(this.contentContainer);
    //         }
    //     });

    //     scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
    //         if (!isDragging || !this.isVisible) return;

    //         // Calculate the distance moved since last frame
    //         const deltaY = pointer.y - lastY;
    //         lastY = pointer.y;
            
    //         // Update velocity
    //         dragVelocity = deltaY;

    //         // Update position
    //         currentY = this.contentContainer.y + deltaY;
            
    //         // Calculate bounds
    //         const maxY = 0;
    //         const minY = Math.min(0, scene.scale.height - this.yPosition);
            
    //         // Apply bounds with elastic effect
    //         if (currentY > maxY) {
    //             currentY = maxY + (currentY - maxY) * 0.5;
    //         } else if (currentY < minY) {
    //             currentY = minY + (currentY - minY) * 0.5;
    //         }
            
    //         this.contentContainer.y = currentY;
    //     });

    //     scene.input.on('pointerup', () => {
    //         if (!isDragging) return;
    //         isDragging = false;

    //         // Apply momentum scrolling
    //         if (Math.abs(dragVelocity) > minVelocity) {
    //             let targetY = this.contentContainer.y + (dragVelocity * 20);
                
    //             // Calculate bounds
    //             const maxY = 0;
    //             const minY = Math.min(0, scene.scale.height - this.yPosition);
                
    //             // Clamp target position
    //             targetY = Phaser.Math.Clamp(targetY, minY, maxY);
                
    //             scene.tweens.add({
    //                 targets: this.contentContainer,
    //                 y: targetY,
    //                 duration: 500,
    //                 ease: 'Cubic.out'
    //             });
    //         } else {
    //             // If velocity is too low, just snap to bounds
    //             const maxY = 0;
    //             const minY = Math.min(0, scene.scale.height - this.yPosition);
    //             const targetY = Phaser.Math.Clamp(this.contentContainer.y, minY, maxY);
                
    //             if (targetY !== this.contentContainer.y) {
    //                 scene.tweens.add({
    //                     targets: this.contentContainer,
    //                     y: targetY,
    //                     duration: 200,
    //                     ease: 'Cubic.out'
    //                 });
    //             }
    //         }
    //     });

    //     // Enable mouse wheel scrolling
    //     scene.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number) => {
    //         if (!this.isVisible) return;
            
    //         // Calculate new position
    //         currentY = this.contentContainer.y - deltaY;
            
    //         // Calculate bounds
    //         const maxY = 0;
    //         const minY = Math.min(0, scene.scale.height - this.yPosition);
            
    //         // Clamp the position
    //         currentY = Phaser.Math.Clamp(currentY, minY, maxY);
            
    //         // Animate to new position
    //         scene.tweens.add({
    //             targets: this.contentContainer,
    //             y: currentY,
    //             duration: 100,
    //             ease: 'Cubic.out'
    //         });
    //     });
    // }

    // show(scene: GameScene): void {
    //     if(this.isVisible) return;

    //     this.container.setVisible(true);
    //     this.isVisible = true;
        
    //     // Slide in from left with content
    //     this.container.x = -this.viewWidth; // Start from off-screen left
    //     scene.tweens.add({
    //         targets: this.container,
    //         x: 0,
    //         duration: 500,
    //         ease: 'Power2'
    //     });
    // }

    // hide(scene: GameScene): void {
    //     if (!this.isVisible) return;

    //     // Slide out to left with content
    //     scene.tweens.add({
    //         targets: this.container,
    //         x: -this.viewWidth * 1.5,
    //         duration: 500,
    //         ease: 'Power2',
    //         onComplete: () => {
    //             this.container.setVisible(false);
    //             this.isVisible = false;
    //             // Emit event to update info button state
    //             Events.emitter.emit(Events.HELP_SCREEN_TOGGLE);
    //             // Destroy the help screen content
    //             this.destroy();
    //         }
    //     });
    // }

    // destroy(): void {
    //     if (this.mask) {
    //         this.mask.destroy();
    //     }
    //     if (this.container) {
    //         this.container.destroy();
    //     }
    //     this.isVisible = false;
    }
}
