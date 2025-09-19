import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';

interface GameScene extends Scene {}

export class MaxWinClaimPopup {
    private container: GameObjects.Container | null = null;
    private content: GameObjects.Container | null = null;
    private claimCb?: () => void;

    create(scene: GameScene): void {
        if (this.container) return;
        this.container = scene.add.container(0, 0);
        this.container.setDepth(10000);
        this.container.alpha = 0;

        const dim = scene.add.graphics();
        dim.fillStyle(0x000000, 0.7);
        dim.fillRect(0, 0, scene.scale.width * 2, scene.scale.height * 2);
        this.container.add(dim);

        this.content = scene.add.container(
            scene.scale.width * 0.5,
            scene.scale.height * 0.5
        );
        this.container.add(this.content);

        // Card background (rounded rect)
        const cardW = Math.min(560, scene.scale.width * 0.9);
        const cardH = 260;
        const card = scene.add.graphics();
        card.fillStyle(0x121212, 1);
        card.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
        this.content.add(card);

        // Header: BET
        const header = scene.add.text(-cardW / 2 + 20, -cardH / 2 + 24, 'You Win!', {
            fontSize: '20px',
            color: '#37A557',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        this.content.add(header);

        // Title text placeholder (set in show)
        const title = scene.add.text(0, -20, 'Max Win:', {
            fontSize: '28px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center'
        });
        title.setOrigin(0.5, 0.5);
        (this.content as any).title = title;
        this.content.add(title);

        // Claim button (drawn with graphics for zero-asset dependency)
        const btnW = Math.min(340, cardW - 80);
        const btnH = 56;
        const btnY = -cardH / 2 + cardH * 0.75; // center of button at 75% of card height
        const btnG = scene.add.graphics();
        btnG.fillStyle(0x4BD969, 1);
        btnG.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 28);
        btnG.lineStyle(2, 0x2E8B57, 1);
        btnG.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 28);
        this.content.add(btnG);

        // Place the interactive zone centered on the button for reliable hit testing
        const btnZone = scene.add.zone(0, btnY, btnW, btnH);
        btnZone.setOrigin(0.5, 0.5);
        btnZone.setInteractive({ useHandCursor: true });
        try { (btnZone as any).input.cursor = 'pointer'; } catch (_e) {}
        this.content.add(btnZone);

        const btnText = scene.add.text(0, btnY, 'CLAIM', {
            fontSize: '22px',
            color: '#000000',
            fontFamily: 'Poppins',
            fontStyle: 'bold'
        });
        btnText.setOrigin(0.5, 0.5);
        this.content.add(btnText);

        // Hover & press animations
        btnZone.on('pointerover', () => {
            try {
                scene.tweens.add({ targets: [btnG, btnText], scaleX: 1.03, scaleY: 1.03, duration: 80, ease: 'Cubic.easeOut' });
            } catch (_e) {}
        });
        btnZone.on('pointerout', () => {
            try {
                scene.tweens.add({ targets: [btnG, btnText], scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.easeOut' });
            } catch (_e) {}
        });
        btnZone.on('pointerdown', (pointer: any) => {
            // Guard for proper button
            if (!pointer || (pointer.button !== undefined && pointer.button !== 0)) {
                return;
            }
            try {
                btnZone.disableInteractive();
                scene.tweens.add({
                    targets: [btnG, btnText],
                    scaleX: 0.95,
                    scaleY: 0.95,
                    duration: 80,
                    ease: 'Cubic.Out',
                    yoyo: true,
                    onComplete: () => {
                        try { btnZone.setInteractive({ useHandCursor: true }); } catch (_e) {}
                        this.hide(scene);
                        if (this.claimCb) this.claimCb();
                    }
                });
            } catch (_e) {
                this.hide(scene);
                if (this.claimCb) this.claimCb();
            }
        });
    }

    show(scene: GameScene, maxMultiplier: number, onClaim?: () => void): void {
        this.create(scene);
        if (!this.container || !this.content) return;
        this.claimCb = onClaim;
        const title = (this.content as any).title as GameObjects.Text;
        const maxWinAmt = maxMultiplier * scene.gameData.bet;
        if (title) {
            title.setText(`Max Win: x${maxMultiplier.toLocaleString('en-US')}\nYou Won: ${scene.gameData.currency} ${maxWinAmt.toLocaleString('en-US')}`);
        }
        this.container.alpha = 1;
        Events.emitter.emit(Events.WIN_OVERLAY_SHOW);
    }

    hide(scene: GameScene): void {
        if (!this.container) return;
        scene.tweens.add({
            targets: this.container,
            alpha: 0,
            duration: 150,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                try { this.container?.destroy(); } catch (_e) {}
                this.container = null;
                this.content = null;
                Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
            }
        });
    }
}


