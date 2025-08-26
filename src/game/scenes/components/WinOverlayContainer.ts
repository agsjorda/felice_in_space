import { Scene, GameObjects, Sound } from 'phaser';
import { Events } from './Events';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { WinAnimation } from './WinAnimation';
import { GameData } from './GameData';
import { Buttons } from '../../ui/Buttons';
import { AudioManager } from './AudioManager';

// Extend Scene to include gameData and audioManager
interface GameScene extends Scene {
    gameData: GameData;
    audioManager: AudioManager;
    buttons: Buttons;
    autoplay: any;
}

export class WinOverlayContainer {
    private scene: GameScene;
    private container: GameObjects.Container;
    private winAnimation: WinAnimation;
    private winText: GameObjects.Text;
    private winText_x: number = 0;
    private winText_y: number = 0;


    private freeSpinsText: GameObjects.Text;
    private buttonText: GameObjects.Text;
    private winAnim: SpineGameObject;
    private isActive: boolean = false;
    private isAnimating: boolean = false;
    private multiplier: number = 0;
    private isMobile: boolean = false;
    private buttonZone: GameObjects.Zone;
    private skipOnce :boolean[] = [false, false, false, false, false];

    constructor(scene: GameScene, winAnimation: WinAnimation) {
        this.scene = scene;
        this.isMobile = this.isMobileDevice();
        this.winAnimation = winAnimation;
        this.container = scene.add.container(0, 0);
        this.container.setDepth(10000);
        this.container.setScale(this.isMobile ? 0.5 : 1);

        this.createOverlay();
    }

    private isMobileDevice(): boolean {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }

    resetSkipOnce(): void {
        this.skipOnce = [false, false, false, false, false];
    }

    private createOverlay(): void {
        // Create semi-transparent background
        const bg = this.scene.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRect(0, 0, this.scene.scale.width * 2, this.scene.scale.height * 2);
        if(this.isMobile) {
            bg.setScale(2, 2);
        }
        this.container.add(bg);

        // Create container for content
        const contentContainer = this.scene.add.container(
            this.isMobile ? this.scene.scale.width : this.scene.scale.width / 2,
            this.isMobile ? this.scene.scale.height : this.scene.scale.height / 2);
        this.container.add(contentContainer);

        // Add win animation
        this.winAnim = this.scene.add.spine(0, 0, 'myWinAnim2', 'myWinAnim2') as SpineGameObject;
        this.winAnim.setScale(this.isMobile ? 0.6 : 1);
        this.winAnim.setOrigin(this.isMobile ? 0.5 : 0.5, this.isMobile ? 0.5 : 0.5);
        contentContainer.add(this.winAnim);

        // Add win amount text
        this.winText = this.scene.add.text(60, 220, '0.00', {
            fontSize: '128px',
            color: '#111111',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
        });
        this.winText_x = this.winText.x;
        this.winText_y = this.winText.y;
        const gradient = this.winText.context.createLinearGradient(0,0,0,this.winText.height);
        gradient.addColorStop(0, '#00FF88');
        gradient.addColorStop(0.5, '#00DD55');
        gradient.addColorStop(1, '#00AA33');
        this.winText.setFill(gradient);

        this.winText.setStroke('#000000', 4);
        // Add a darker shadow underneath the existing one for more depth
        this.winText.setShadow(0, 0, '#000000', 30, false, true); // darker, larger shadow
        this.winText.setShadow(0, 0, '#00FF88', 15, false, false); // original shadow on top

        this.winText.setOrigin(0.5);
        this.winText.alpha = 1;
        

        if(this.isMobile){
            this.winText.setScale(0.5);
        }
        

        contentContainer.add(this.winText);

        // Add free spins text
        this.freeSpinsText = this.scene.add.text(0, 0, '0.00', {
            fontSize: '84px',
            color: '#FFD700',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#FF0000',
            strokeThickness: 6,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#FFFFFF',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        
        const gradient2  = this.freeSpinsText.context.createLinearGradient(0,0,0,this.freeSpinsText.height);
        gradient2.addColorStop(0, '#00FF88');
        gradient2.addColorStop(0.5, '#00DD55');
        gradient2.addColorStop(1, '#00AA33');
        this.freeSpinsText.setFill(gradient2);

        this.freeSpinsText.setStroke('#00FF88', 4);
        this.freeSpinsText.setShadow(0, 0, '#00FF88', 15);

        this.freeSpinsText.setOrigin(0.5);
        this.freeSpinsText.visible = false;
        this.freeSpinsText.setPosition(-110, 95);
        
        contentContainer.add(this.freeSpinsText);

        // Add continue button
        this.buttonText = this.scene.add.text(100, 300, 'Press anywhere to continue', {
            fontSize: '32px',
            color: '#FFFFFF',
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: '#379557',
            strokeThickness: 6,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: '#000000',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        this.buttonText.setOrigin(0.5);
        contentContainer.add(this.buttonText);

        // Make entire screen interactive
        const buttonZone = this.scene.add.zone(0, 0, this.scene.scale.width, this.scene.scale.height);
        this.buttonZone = buttonZone;
        buttonZone.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, this.scene.scale.width* 2 , this.scene.scale.height * 2),
            Phaser.Geom.Rectangle.Contains
        );
        contentContainer.add(buttonZone);

        // Set up event listeners
        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        Events.emitter.on(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN, (totalWin: number, winType: string) => {
            if (winType === 'Congrats') {
                this.winText.setPosition(0, -60);
                this.winText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                this.freeSpinsText.visible = true;
                this.freeSpinsText.setText(`${this.scene.gameData.totalFreeSpins.toFixed(0)}`);
            } else if (winType === 'FreeSpin') {
                this.winText.setPosition(0, -60);
                this.winText.setText(`${totalWin.toFixed(0)}`);
                this.freeSpinsText.visible = false;

            } else {
                //this.winText.setPosition(20, 130);
                //this.winText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
                this.startCounting(this.winAnim, totalWin);
                this.freeSpinsText.visible = false;
            }
            
        });
    

        this.buttonZone.on('pointerdown', () => {
            if (this.multiplier === -1) {
                // Handle free spins case      
                this.buttonZone.disableInteractive(true);
                this.endWinAnimation(() => {
                    // Start free spins autoplay without stopping existing autoplay
                    if (!this.scene.autoplay.isAutoPlaying) {
                        Events.emitter.emit(Events.AUTOPLAY_START, this.scene.gameData.freeSpins);
                    }
                    this.destroy();
                });
            } else {
                console.log('regular win case', this.currentCount, this.targetCount);
                // Handle regular win case with animation transitions
                this.handleButtonPressDuringCounting();
            }
        });
    }

    public async show(totalWin: number, winType?: string): Promise<void> {
        if (this.isAnimating) {
            return;
        }

        this.isActive = true;
        this.isAnimating = true;

        // Set up gradient colors for win text
        let colorGradient = ['#00FF8A', '#00E676', '#00C75F'];
        let colorMid = 0.5;

        // Apply gradient to win text
        const gradient = this.winText.context.createLinearGradient(0, 0, 0, this.winText.height);
        gradient.addColorStop(0, colorGradient[0]);
        gradient.addColorStop(colorMid, colorGradient[1]);
        gradient.addColorStop(1, colorGradient[2]);
        this.winText.setFill(gradient);

        // Handle different win types
        if (winType === 'FreeSpin') {
            this.winText.setPosition(0, -60);
            this.winText.setText(`${totalWin.toFixed(0)}`);
            this.freeSpinsText.visible = false;
            this.multiplier = -1;
            this.playWinSound(totalWin);
        } else if (winType === 'Congrats') {
            this.winText.setPosition(0, -60);
            this.winText.setText(`${totalWin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            this.freeSpinsText.visible = true;
            this.freeSpinsText.setText(`${this.scene.gameData.totalFreeSpins.toFixed(0)}`);
            this.multiplier = -2;
            this.playWinSound(totalWin);
        } else {
            // Regular win - use counting animation
            //this.winText.setPosition(20, 130);
            this.freeSpinsText.visible = false;
            this.multiplier = 0;
            this.startCounting(this.winAnim, totalWin);
        }

        // Emit show event
        Events.emitter.emit(Events.WIN_OVERLAY_SHOW);
        this.isAnimating = false;
    }



    private playWinSound(totalWin: number): void {
        let winSound: Sound.WebAudioSound | undefined;
        
        // Handle special cases first
        if (this.multiplier === -1) {
            winSound = this.scene.audioManager.FreeSpinW;
        } else if (this.multiplier === -2) {
            winSound = this.scene.audioManager.CongratsW;
        } else {
            // Determine which sound to play based on total win amount
            if (totalWin >= this.scene.gameData.bet * this.scene.gameData.winRank[4]) {
                winSound = this.scene.audioManager.SuperW;
            } else if (totalWin >= this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
                winSound = this.scene.audioManager.EpicW;
            } else if (totalWin >= this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
                winSound = this.scene.audioManager.MegaW;
            } else if (totalWin >= this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
                winSound = this.scene.audioManager.BigW;
            } else {
                winSound = this.scene.audioManager.FreeSpinW;
            }
        }

        if (winSound) {
            winSound.play();
        }
    }

    public destroy(): void {
        if (this.isActive) {
            this.scene.slotMachine.activeWinOverlay = false;
            this.winAnimation.exitAnimation();
            Events.emitter.off(Events.WIN_OVERLAY_UPDATE_TOTAL_WIN);
            this.container.destroy();
            this.isActive = false;
            this.isAnimating = false;
            this.isIntroPlaying = false; // Reset the intro playing flag
            this.scene.audioManager.stopWinSFX(this.scene);
            
            Events.emitter.emit(Events.WIN_OVERLAY_HIDE);
        }
    }
    
	private currentCount: number = 0;
    //@ts-ignore
	private targetCount: number = 0;
	private countInterval?: Phaser.Time.TimerEvent;
	private isCounting: boolean = false;
	private finalBetTotal: number = 0;
    //@ts-ignore
	private currentAnimationPhase: string = 'bigwin';
	private skipIdleAnimation: boolean = false; // Flag to skip idle animation when count is equal
	private isIntroPlaying: boolean = false; // Flag to track if intro animation is currently playing

	startCounting(winAnim: SpineGameObject, totalWin: number) {
        this.winAnim = winAnim;
        this.finalBetTotal = totalWin;
		console.log('Starting win counting algorithm...');
		
		// Play appropriate win sound based on total win amount (only for regular wins)
		if (this.multiplier === 0) {
		//	this.playWinSound(totalWin);
		}
		this.winText.setVisible(false); 
		this.playBigwinIntro();
	}

	winTextFadeIn(){
		this.winText?.setScale(3);
		this.scene.tweens.add({
			targets: this.winText,
			scale: 1,
			duration: 777,
			ease: 'Expo.InOut',
			onComplete: () => {
				this.winText?.setScale(1);
			}
		});
	}

	playBigwinIntro() {
		if (!this.winAnimation || !this.winText) return;
		
		// Check if intro is already playing
		if (this.isIntroPlaying) {
			console.log('Intro already playing, skipping bigwin intro');
			return;
		}
		
		console.log('Playing bigwin_intro_fis, winText:', this.winText.text);
		this.isIntroPlaying = true;
		this.currentAnimationPhase = 'bigwin_intro';
		this.winAnim.animationState.setAnimation(0, 'bigwin_intro_fis', false);
		this.winTextFadeIn();

		// Queue the appropriate sounds
		if (this.skipIdleAnimation) {
			// If skipping idle, queue both skip and win sounds
			this.scene.audioManager.queueWinSFX(['BigWinSkip']);
		} else {
			// Normal flow, just queue the win sound
			this.scene.audioManager.queueWinSFX(['BigWin']);
		}

		setTimeout(() => {
			this.isIntroPlaying = false; // Reset flag
			if (this.skipIdleAnimation) {
				// Skip idle animation and handle based on target count
				this.skipIdleAnimation = false; // Reset flag
				this.handleIntroSkip();
			} else {
				this.playBigwinIdle();
			}
		}, 500); // 0.5 second pause
	}

	playBigwinIdle() {
		if (!this.winAnimation || !this.winText) return;
		console.log('Playing bigwin_idle_fis, resuming count from:', this.winText.text);
		this.currentAnimationPhase = 'bigwin_idle';
		this.winAnim.animationState.setAnimation(0, 'bigwin_idle_fis', true);
		let incrementTo = this.finalBetTotal
		if(this.finalBetTotal > this.scene.gameData.bet * this.scene.gameData.winRank[1]){
			incrementTo = this.scene.gameData.bet * this.scene.gameData.winRank[1];
		}

		this.startCountUp(incrementTo, 6000); // 6 seconds to count to bet * 10
	}

	playMegawinIntro() {
		if (!this.winAnimation || !this.winText) return;

		// Check if intro is already playing
		if (this.isIntroPlaying) {
			console.log('Intro already playing, skipping megawin intro');
			return;
		}

		console.log('Playing megawin_intro_fis, winText:', this.winText.text);
		this.isIntroPlaying = true;
		this.currentAnimationPhase = 'megawin_intro';
            
		this.winAnim.animationState.setAnimation(0, 'megawin_intro_fis', false); 
		this.winTextFadeIn();

		// Queue the appropriate sounds
		if (this.skipIdleAnimation) {
			// If skipping idle, queue skip sound only (win sound will be queued based on target count)
			this.scene.audioManager.queueWinSFX(['MegaWinSkip']);
		} else {
			// Normal flow, just queue the win sound
			this.scene.audioManager.queueWinSFX(['BigWinSkip']);
            setTimeout(() => {  
                this.scene.audioManager.clearWinSFXQueue();
                this.scene.audioManager.queueWinSFX(['MegaWin']);
            }, 1000);
		}

		setTimeout(() => {
			this.isIntroPlaying = false; // Reset flag
			if (this.skipIdleAnimation) {
				// Skip idle animation and handle based on target count
				this.skipIdleAnimation = false; // Reset flag
				this.handleIntroSkip();
			} else {
				this.playMegawinIdle();
			}
		}, 1000); // 1 second pause
	}

	playMegawinIdle() {
		if (!this.winAnimation || !this.winText) return;
		console.log('Playing megawin_idle_fis, resuming count from:', this.winText.text);
		this.currentAnimationPhase = 'megawin_idle';
		this.winAnim.animationState.setAnimation(0, 'megawin_idle_fis', true);

		let incrementTo = this.finalBetTotal
		if(this.finalBetTotal > this.scene.gameData.bet * this.scene.gameData.winRank[2]){
			incrementTo = this.scene.gameData.bet * this.scene.gameData.winRank[2];
		}

		this.startCountUp(incrementTo, 6000); // 6 seconds to count to bet * 30
	}

	playEpicwinIntro() {
		if (!this.winAnimation || !this.winText) return;

		// Check if intro is already playing
		if (this.isIntroPlaying) {
			console.log('Intro already playing, skipping epicwin intro');
			return;
		}

		console.log('Playing epicwin_intro_fis, winText:', this.winText.text);
		this.isIntroPlaying = true;
		this.currentAnimationPhase = 'epicwin_intro';
		this.winAnim.animationState.setAnimation(0, 'epicwin_intro_fis', false);
		this.winText.setPosition(this.winText_x, this.winText_y - 80);
		this.winTextFadeIn();

		// Queue the appropriate sounds
		if (this.skipIdleAnimation) {
			// If skipping idle, queue skip sound only (win sound will be queued based on target count)
			this.scene.audioManager.queueWinSFX(['EpicWinSkip']);
		} else {
			// Normal flow, just queue the win sound
			this.scene.audioManager.queueWinSFX(['MegaWinSkip']);
            setTimeout(() => {  
                this.scene.audioManager.clearWinSFXQueue();
                this.scene.audioManager.queueWinSFX(['EpicWin']);
            }, 1000);
		}

		setTimeout(() => {
			this.isIntroPlaying = false; // Reset flag
			if (this.skipIdleAnimation) {
				// Skip idle animation and handle based on target count
				this.skipIdleAnimation = false; // Reset flag
				this.handleIntroSkip();
			} else {
				this.playEpicwinIdle();
			}
		}, 1000); // 1 second pause
	}

	playEpicwinIdle() {
		if (!this.winAnimation || !this.winText) return;
		console.log('Playing epicwin_idle_fis, resuming count from:', this.winText.text);
		this.currentAnimationPhase = 'epicwin_idle';
		this.winAnim.animationState.setAnimation(0, 'epicwin_idle_fis', true);

		let incrementTo = this.finalBetTotal
		if(this.finalBetTotal > this.scene.gameData.bet * this.scene.gameData.winRank[3]){
			incrementTo = this.scene.gameData.bet * this.scene.gameData.winRank[3];
		}

		this.startCountUp(incrementTo, 6000); // 6 seconds to count to bet * 60
	}

	playSuperwinIntro() {
		if (!this.winAnimation || !this.winText) return;

		// Check if intro is already playing
		if (this.isIntroPlaying) {
			console.log('Intro already playing, skipping superwin intro');
			return;
		}

		console.log('Playing superwin_intro_fis, winText:', this.winText.text);
		this.isIntroPlaying = true;
		this.currentAnimationPhase = 'superwin_intro';
		this.winText.setPosition(this.winText_x, this.winText_y);
		this.winAnim.animationState.setAnimation(0, 'superwin_intro_fis', false);
		this.winTextFadeIn();

		// Queue the appropriate sounds
		if (this.skipIdleAnimation) {
			// If skipping idle, queue skip sound only (win sound will be queued based on target count)
			this.scene.audioManager.queueWinSFX(['SuperWinSkip']);
		} else {
			// Normal flow, just queue the win sound
			this.scene.audioManager.queueWinSFX(['EpicWinSkip']);
            setTimeout(() => {
                this.scene.audioManager.clearWinSFXQueue();
                this.scene.audioManager.queueWinSFX(['SuperWin']);
            }, 1000);
		}

		setTimeout(() => {
			this.isIntroPlaying = false; // Reset flag
			if (this.skipIdleAnimation) {
				// Skip idle animation and handle based on target count
				this.skipIdleAnimation = false; // Reset flag
				this.handleIntroSkip();
			} else {
				this.playSuperwinIdle();
			}
		}, 1000); // 1 second pause
	}
    
	playSuperwinIdle() {
		if (!this.winAnimation || !this.winText) return;
		console.log('Playing superwin_idle_fis, resuming count from:', this.winText.text);
		this.currentAnimationPhase = 'superwin_idle';
		this.winAnim.animationState.setAnimation(0, 'superwin_idle_fis', true);

		this.startCountUp(this.finalBetTotal, 6000); // 6 seconds to count to final total
	}

	startCountUp(targetValue: number, duration: number) {
		this.targetCount = targetValue;
		const startValue = this.currentCount;
		let elapsed = 0;

		this.isCounting = true;
		this.countInterval = this.scene.time.addEvent({
			delay: 8, // ~120 FPS for faster counting
			callback: () => {
				if (!this.isCounting) return;

				elapsed += 16;

				// Option 1: Use increment directly (stepwise)
				// this.currentCount = Math.min(targetValue, this.currentCount + increment);

				// Option 2: Use progress-based interpolation (smoother)
				const progress = Math.min(elapsed / duration, this.scene.gameData.bet);
				this.currentCount = startValue + (this.targetCount - startValue) * progress;

				this.updateWinText();

				// Check if we've reached the target
				if (this.currentCount >= this.targetCount) {
					this.currentCount = this.targetCount;
					this.updateWinText();
					this.isCounting = false;
					if (this.countInterval) {
						this.scene.time.removeEvent(this.countInterval);
					}

					// Stop progression if we've reached the final total
					if (this.currentCount >= this.finalBetTotal) {
						console.log('Final count reached:', this.winText?.text);
						this.handleFinalWin();
						return; // Exit early, don't proceed to next animation
					}

					// Determine next animation phase based on current count, not target
					const currentWinAmount = this.currentCount;
					if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[1] && currentWinAmount < this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
						this.playMegawinIntro();
					} else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[2] && currentWinAmount < this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
						this.playEpicwinIntro();
					} else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[3] && currentWinAmount < this.finalBetTotal) {
						this.playSuperwinIntro();
					}
				}
			},
			loop: true
		});
	}

	updateWinText() {
		if (this.winText) {
				if(this.winText.text == '0.00'){
					this.winText.setVisible(false);
				}
				else {
					this.winText.setVisible(true);
				}
				this.winText.setText(this.currentCount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
			}

    }

    /**
     * Handle button press during counting animation
     */
    private handleButtonPressDuringCounting(): void {
        // Stop current counting
        if (this.countInterval) {
            this.scene.time.removeEvent(this.countInterval);
            this.isCounting = false;
            this.scene.audioManager.stopWinSFX(this.scene);
        }

        // Complete current count to target
        if (this.currentCount < this.targetCount) {
            this.currentCount = this.targetCount;
            this.updateWinText();
        }

        // Check if current count equals target count (skip idle animation)
        this.skipIdleAnimation = (this.currentCount === this.targetCount);

        // Determine next animation phase based on current count
        const currentWinAmount = this.currentCount;
        const nextPhase = this.determineNextAnimationPhase(currentWinAmount);

        if (nextPhase) {
            // Transition to next animation phase and continue counting
            this.transitionToNextAnimation(nextPhase);
        } else {
            // No more phases, end the animation
            console.log('end win animation - no more phases');
            this.buttonZone.disableInteractive(true);
            this.endWinAnimation(() => {
                this.destroy();
            });
        }
    }

    /**
     * Determine the next animation phase based on current win amount
     */
    private determineNextAnimationPhase(currentWinAmount: number): string | null {
        // Determine the highest applicable phase based on current win amount
        if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[4]) {
            return 'superwin';
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
            return 'epicwin';
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
            return 'megawin';
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
            return 'bigwin';
        }
        return null; // No more phases
    }

    /**
     * Determine the next animation phase to transition to (for progression)
     */
    private determineNextTransitionPhase(currentWinAmount: number): string | null {
        // For transitions, we want to go to the next higher phase
        if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[4]) {
            return null; // Already at highest phase
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
            return 'superwin';
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
            return 'epicwin';
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
            return 'megawin';
        } else {
            return 'bigwin';
        }
    }

    /**
     * Transition to the next animation phase
     */
    private transitionToNextAnimation(phase: string): void {
        console.log(`Transitioning to ${phase} animation`);
        
        switch (phase) {
            case 'bigwin':
                this.playMegawinIntro();
                break;
            case 'megawin':
                this.playEpicwinIntro();
                break;
            case 'epicwin':
                this.playSuperwinIntro();
                break;
            case 'superwin':
                this.playSuperwinIdle();
                break;
        }
    }

    /**
     * Continue counting to the next phase after skipping idle animation
     */
    private continueCountingToNextPhase(): void {
        // Check if we should transition to next animation based on target count
        const shouldTransition = this.shouldTransitionToNextAnimation();
        
        if (shouldTransition) {
            // Transition to next animation phase
            this.transitionToNextAnimation(shouldTransition);
        } else {
            // Continue counting to the next target
            const currentWinAmount = this.currentCount;
            const nextTarget = this.calculateNextTarget(currentWinAmount);
            console.log(`Continuing count from ${currentWinAmount} to ${nextTarget}`);
            this.startCountUp(nextTarget, 6000); // 6 seconds to count to next target
        }
    }

    /**
     * Handle intro skip logic based on target count
     */
    private handleIntroSkip(): void {
        const currentPhase = this.currentAnimationPhase;
        
        // Check based on current intro phase and target count
        if (currentPhase === 'bigwin_intro') {
            if (this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
                // Transition to megawin - queue megawin sound
                this.scene.audioManager.queueWinSFX(['BigWinSkip']);
                setTimeout(() => {
                    this.scene.audioManager.clearWinSFXQueue();
                    this.scene.audioManager.queueWinSFX(['MegaWin']);
                }, 1000);
                this.transitionToNextAnimation('megawin');
            } else {
                // Stay in bigwin idle - queue bigwin sound
                this.scene.audioManager.queueWinSFX(['BigWin']);
                this.playBigwinIdle();
            }
        } else if (currentPhase === 'megawin_intro') {
            if (this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
                // Transition to epicwin - queue epicwin sound
                this.scene.audioManager.queueWinSFX(['MegaWinSkip']);
                setTimeout(() => {
                    this.scene.audioManager.clearWinSFXQueue();
                    this.scene.audioManager.queueWinSFX(['EpicWin']);
                }, 1000);
                this.transitionToNextAnimation('epicwin');
            } else {
                // Stay in megawin idle - queue megawin sound
                this.scene.audioManager.queueWinSFX(['MegaWin']);
                this.playMegawinIdle();
            }
        } else if (currentPhase === 'epicwin_intro') {
            if (this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
                // Transition to superwin - queue superwin sound
                this.scene.audioManager.queueWinSFX(['EpicWinSkip']);
                setTimeout(() => {
                    this.scene.audioManager.clearWinSFXQueue();
                    this.scene.audioManager.queueWinSFX(['SuperWin']);
                }, 1000);
                this.transitionToNextAnimation('superwin');
            } else {
                // Stay in epicwin idle - queue epicwin sound
                this.scene.audioManager.queueWinSFX(['EpicWin']);
                this.playEpicwinIdle();
            }
        } else if (currentPhase === 'superwin_intro') {
            if (this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[4]) {
                // Continue to final target - queue superwin sound
                this.scene.audioManager.queueWinSFX(['SuperWin']);
                const nextTarget = this.calculateNextTarget(this.currentCount);
                this.startCountUp(nextTarget, 6000);
            } else {
                // Stay in superwin idle - queue superwin sound
                this.scene.audioManager.queueWinSFX(['SuperWin']);
                this.playSuperwinIdle();
            }
        }
    }

    /**
     * Check if we should transition to next animation based on target count and current phase
     */
    private shouldTransitionToNextAnimation(): string | null {
        const currentPhase = this.currentAnimationPhase;
        
        // Check based on current phase and target count
        if (currentPhase === 'bigwin_idle' && this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
            return 'megawin';
        } else if (currentPhase === 'megawin_idle' && this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
            return 'epicwin';
        } else if (currentPhase === 'epicwin_idle' && this.targetCount > this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
            return 'superwin';
        } else if (currentPhase === 'superwin_idle') {
            // Special case for superwin - play skip sound and end after 1 second
            this.handleSuperwinSkip();
            return null;
        }
        
        return null; // No transition needed
    }

    /**
     * Handle superwin skip - play skip sound and end animation after 1 second
     */
    private handleSuperwinSkip(): void {
        console.log('Handling superwin skip');
        this.scene.audioManager.queueWinSFX(['SuperWinSkip']);
        
        // End the animation after 1 second
        this.buttonZone.disableInteractive(true);
        setTimeout(() => {
            this.endWinAnimation(() => {
                this.destroy();
            });
        }, 2000);
    }

    /**
     * Calculate the next target count based on current win amount
     */
    private calculateNextTarget(currentWinAmount: number): number {
        if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[4]) {
            return this.finalBetTotal; // Final target
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[3]) {
            return this.finalBetTotal;
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[2]) {
            return Math.min(this.finalBetTotal, this.scene.gameData.bet * this.scene.gameData.winRank[3]);
        } else if (currentWinAmount >= this.scene.gameData.bet * this.scene.gameData.winRank[1]) {
            return Math.min(this.finalBetTotal, this.scene.gameData.bet * this.scene.gameData.winRank[2]);
        }
        return this.finalBetTotal;
    }

    /**
     * Handle the final win case when count reaches final total
     */
    private handleFinalWin(): void {
        console.log('Handling final win');
        this.scene.audioManager.queueWinSFX(['SuperWinSkip']);
        
        // End the animation after a short delay
        this.buttonZone.setInteractive(false);
        setTimeout(() => {
            this.endWinAnimation(() => {
                this.destroy();
            });
        }, 1000); // 1 second delay to let the skip sound play
    }

    endWinAnimation(functionToCall: () => void){
        this.buttonZone.disableInteractive(true);
        this.scene.tweens.add({
            targets: this.container,
            alpha: 0,
            y: -this.scene.scale.height,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                functionToCall();
            }
        });
    }
} 