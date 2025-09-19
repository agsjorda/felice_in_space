import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';

interface GameScene extends Scene {
	buttons: any;
	slotMachine: any;
}

export class RetriggerOverlayContainer {
	private scene: GameScene;
	private container: GameObjects.Container;
	private contentContainer: GameObjects.Container;
	private buttonZone: GameObjects.Zone;
	private isMobile: boolean = false;
	private inputLocked: boolean = false;
	private onSpaceDown?: (event: KeyboardEvent) => void;

	constructor(scene: GameScene) {
		this.scene = scene;
		this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
		this.container = this.scene.add.container(0, 0);
		this.container.setDepth(10000);
		this.container.setScale(this.isMobile ? 0.5 : 1);

		// Semi-transparent fullscreen dimmer
		const dim = this.scene.add.graphics();
		dim.fillStyle(0x000000, 0.7);
		dim.fillRect(0, 0, this.scene.scale.width * 2, this.scene.scale.height * 2);
		this.container.add(dim);

		// Centered content container
		this.contentContainer = this.scene.add.container(
			this.isMobile ? this.scene.scale.width : this.scene.scale.width * 0.5,
			this.isMobile ? this.scene.scale.height : this.scene.scale.height * 0.5
		);
		this.container.add(this.contentContainer);

		// Fullscreen interactive zone for click-to-continue
		this.buttonZone = this.scene.add.zone(0, 0, this.scene.scale.width, this.scene.scale.height);
		this.buttonZone.setInteractive(
			new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width * 2, this.scene.scale.height * 2),
			Phaser.Geom.Rectangle.Contains
		);
		this.container.add(this.buttonZone);
	}

	public show(addFreeSpins: number, onClose?: () => void): void {
		// Build popup visuals (reuse Buy Feature BG and texts similar to showRetriggerPopup)
		const bg = this.scene.add.image(0, 0, 'buyFeatBG');
		bg.setOrigin(0.5, 0.5);
		if ((this.scene.sys.game.renderer as any).pipelines) {
			bg.setPipeline('BlurPostFX');
		}
		const text = this.scene.add.text(0, 0, `You won\n\n\nmore free spins`, {
			fontSize: '48px',
			color: '#FFFFFF',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		text.setOrigin(0.5, 0.5);

		const freeSpinsCount = this.scene.add.text(0, 0, `${addFreeSpins}`, {
			fontSize: '88px',
			color: '#FFFFFF',
			fontFamily: 'Poppins',
			fontStyle: 'bold',
			align: 'center'
		});
		freeSpinsCount.setOrigin(0.5, 0.5);
		const gradient = freeSpinsCount.context.createLinearGradient(0, 0, 0, freeSpinsCount.height);
		gradient.addColorStop(0, '#FFF15A');
		gradient.addColorStop(0.5, '#FFD000');
		gradient.addColorStop(1, '#FFB400');
		freeSpinsCount.setFill(gradient);

		// Add to container (centered under buttonZone)
		this.contentContainer.add(bg);
		this.contentContainer.add(text);
		this.contentContainer.add(freeSpinsCount);

		// Brief pause before allowing skip
		this.inputLocked = true;
		this.scene.time.delayedCall(400, () => {
			this.inputLocked = false;
		});

		// Keyboard skip on desktop
		if (!this.isMobile && this.scene.input.keyboard) {
			this.onSpaceDown = () => this.tryClose(onClose);
			this.scene.input.keyboard.on('keydown-SPACE', this.onSpaceDown);
		}

		// Pointer skip
		this.buttonZone.on('pointerdown', () => this.tryClose(onClose));

		// Auto-close in autoplay/API-driven scenarios after a short pause
		const shouldAutoClose = (this.scene as any).buttons?.autoplay?.isAutoPlaying || (this.scene as any).gameData?.useApiFreeSpins;
		if (shouldAutoClose) {
			this.scene.time.delayedCall(400, () => this.tryClose(onClose));
		}

		// Notify overlay shown and block win overlay queue in slotMachine
		if (this.scene.slotMachine) {
			this.scene.slotMachine.activeWinOverlay = true;
		}
		Events.emitter.emit(Events.WIN_OVERLAY_SHOW);
	}

	private tryClose(onClose?: () => void): void {
		if (this.inputLocked) return;
		this.end(() => {
			if (onClose) onClose();
		});
	}

	private end(cb: () => void): void {
		this.scene.tweens.add({
			targets: this.container,
			alpha: 0,
			duration: 333,
			ease: 'Power2',
			onComplete: () => {
				cb();
				this.destroy();
			}
		});
	}

	public destroy(): void {
		if (this.onSpaceDown && this.scene.input.keyboard) {
			this.scene.input.keyboard.off('keydown-SPACE', this.onSpaceDown);
			this.onSpaceDown = undefined;
		}
		if (this.scene.slotMachine) {
			this.scene.slotMachine.activeWinOverlay = false;
		}
		this.container.destroy();
		Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
	}
}


