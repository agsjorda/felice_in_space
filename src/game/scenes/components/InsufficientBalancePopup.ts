import { Scene, GameObjects, Geom } from 'phaser';
import { Events } from './Events';

interface GameScene extends Scene {}

export class InsufficientBalancePopup {
    private container: GameObjects.Container | null = null;
    private isVisible: boolean = false;
    private isMobile: boolean = false;

    preload(_scene: GameScene): void {}

    private isMobileDevice(): boolean {
        return true;
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.get('device') == 'mobile'){
            return true;
        }else if(urlParams.get('device') == 'desktop'){
            return false;
        }
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    create(scene: GameScene): void {
        this.isMobile = this.isMobileDevice();
        if (this.container) return;

        const width = scene.scale.width;
        const height = scene.scale.height;

        this.container = scene.add.container(0, 0);
        this.container.setDepth(10000);
        this.container.setVisible(false);

        const mask = scene.add.graphics();
        mask.name = 'insufficientBalanceMask';
        mask.fillStyle(0x000000, 0.8);
        mask.fillRect(0, 0, width, height);
        mask.setInteractive(new Geom.Rectangle(0, 0, width, height), Geom.Rectangle.Contains);
        this.container.add(mask);

        const panelWidth = Math.min(width * 0.9, this.isMobile ? width * 0.9 : 560);
        const panelHeight = Math.min(height * 0.5, this.isMobile ? height * 0.45 : 240);

        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        const panel = scene.add.graphics();
        panel.fillStyle(0x222222, 0.95);
        panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        panel.lineStyle(2, 0x379557, 1);
        panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, 12);
        this.container.add(panel);

        const title = scene.add.text(width / 2, panelY + panelHeight * 0.33, 'Out of Balance', {
            fontSize: this.isMobile ? '24px' : '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);
        this.container.add(title);

        const message = scene.add.text(width / 2, panelY + panelHeight * 0.53, 'Insufficient Funds', {
            fontSize: this.isMobile ? '16px' : '20px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            align: 'center',
            wordWrap: { width: panelWidth * 0.9 }
        });
        message.setOrigin(0.5, 0.5);
        this.container.add(message);

        const buttonWidth = this.isMobile ? panelWidth * 0.55 : 220;
        const buttonHeight = this.isMobile ? 44 : 52;
        const buttonX = width / 2 - buttonWidth / 2;
        const buttonY = panelY + panelHeight * 0.75 - buttonHeight / 2;

        const button = scene.add.graphics();
        button.fillStyle(0x3DBE66, 1);
        button.fillRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        button.lineStyle(2, 0x2b7a46, 1);
        button.strokeRoundedRect(buttonX, buttonY, buttonWidth, buttonHeight, 8);
        this.container.add(button);

        const buttonLabel = scene.add.text(width / 2, buttonY + buttonHeight / 2, 'CLOSE', {
            fontSize: this.isMobile ? '18px' : '22px',
            color: '#000000',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        buttonLabel.setOrigin(0.5, 0.5);
        this.container.add(buttonLabel);

        const interactiveZone = scene.add.zone(buttonX, buttonY, buttonWidth, buttonHeight);
        interactiveZone.setOrigin(0, 0);
        interactiveZone.setInteractive(new Geom.Rectangle(0, 0, buttonWidth, buttonHeight), Geom.Rectangle.Contains);
        interactiveZone.on('pointerdown', () => {
            console.log('[UI] InsufficientBalancePopup OK clicked');
            this.hide(scene);
        });
        this.container.add(interactiveZone);

        Events.emitter.on(Events.SHOW_INSUFFICIENT_BALANCE, () => {
            this.show(scene);
        });
    }

    show(scene: GameScene): void {
        if (!this.container || this.isVisible) return;
        this.isVisible = true;
        this.container.setVisible(true);
        this.container.alpha = 1;
        console.log('[UI] Showing InsufficientBalancePopup');
    }

    hide(scene: GameScene): void {
        if (!this.container || !this.isVisible) return;
        scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 150,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.container!.setVisible(false);
                this.isVisible = false;
            }
        });
    }

    destroy(): void {
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.isVisible = false;
    }
}


