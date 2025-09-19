import { Scene, Sound } from 'phaser';
import chalk from 'chalk';

export class AudioManager {
    private musicVolume: number = 1.0; // Default music volume (0.0 - 1.0)
    private sfxVolume: number = 1.0;   // Default SFX volume (0.0 - 1.0)
    public winIsPlaying: boolean = false;
    private winSFXQueue: string[] = []; // Queue for win SFX
    private isPlayingQueue: boolean = false; // Flag to track if we're currently playing from queue

    // Background Music
    public MainBG: Sound.WebAudioSound;
    public BonusBG: Sound.WebAudioSound;
    public BGChecker: Sound.WebAudioSound;

    // SFX
    private ClickSFX: Sound.WebAudioSound;
    public ReelDrop: Sound.WebAudioSound;
    public TurboDrop: Sound.WebAudioSound;
    public SpinSFX: Sound.WebAudioSound;
    public UtilityButtonSFX: Sound.WebAudioSound;
    public ScatterSFX: Sound.WebAudioSound;
    public TExplosion: Sound.WebAudioSound;
    public TWin1: Sound.WebAudioSound;
    public TWin2: Sound.WebAudioSound;
    public TWin3: Sound.WebAudioSound;
    public TWin4: Sound.WebAudioSound;


    // Win Sounds
    public EpicW: Sound.WebAudioSound;
    public EpicWinSkip: Sound.WebAudioSound;

    public MegaW: Sound.WebAudioSound;
    public MegaWinSkip: Sound.WebAudioSound;

    public BigW: Sound.WebAudioSound;
    public BigWinSkip: Sound.WebAudioSound;

    public SuperW: Sound.WebAudioSound;
    public SuperWinSkip: Sound.WebAudioSound;

    public CongratsW: Sound.WebAudioSound;
    public FreeSpinW: Sound.WebAudioSound;

    public BonusW: Sound.WebAudioSound;
    public FreeSpinWon: Sound.WebAudioSound;
    public WinSkip: Sound.WebAudioSound;


    preload(scene: Scene): void {
        const prefixAudio = 'assets/Audio';
        const fileType = '.ogg';

        // BGMusic
        scene.load.audio('BonusBG', `${prefixAudio}/bonusbg_fis${fileType}`);    
        scene.load.audio('MainBG', `${prefixAudio}/mainbg_fis${fileType}`);
        scene.load.audio('BGChecker', `${prefixAudio}/mainbg_fis${fileType}`);


        // SFX
        scene.load.audio('ClickSFX', `${prefixAudio}/click_fis${fileType}`);
        scene.load.audio('ReelDrop', `${prefixAudio}/reeldrop_fis${fileType}`);
        scene.load.audio('TurboDrop', `${prefixAudio}/turbob_fis${fileType}`);
        scene.load.audio('SpinSFX', `${prefixAudio}/spin_fis${fileType}`);
        scene.load.audio('UtilityButtonSFX', `${prefixAudio}/ub_fis${fileType}`);
        scene.load.audio('ScatterSFX', `${prefixAudio}/scatter_fis${fileType}`);
        scene.load.audio('TExplosion', `${prefixAudio}/texplo_fis${fileType}`);

        scene.load.audio('TWin1', `${prefixAudio}/twin1_fis${fileType}`);
        scene.load.audio('TWin2', `${prefixAudio}/twin2_fis${fileType}`);
        scene.load.audio('TWin3', `${prefixAudio}/twin3_fis${fileType}`);
        scene.load.audio('TWin4', `${prefixAudio}/twin4_fis${fileType}`);
        
        // Wins
        scene.load.audio('BigW', `${prefixAudio}/bigw_fis${fileType}`);
        scene.load.audio('BigWinSkip', `${prefixAudio}/bigwskip_fis${fileType}`);
        
        scene.load.audio('MegaW', `${prefixAudio}/megaw_fis${fileType}`);
        scene.load.audio('MegaWinSkip', `${prefixAudio}/megawskip_fis${fileType}`);

        scene.load.audio('SuperW', `${prefixAudio}/superw_fis${fileType}`);
        scene.load.audio('SuperWinSkip', `${prefixAudio}/superwskip_fis${fileType}`);

        scene.load.audio('EpicW', `${prefixAudio}/epicw_fis${fileType}`);
        scene.load.audio('EpicWinSkip', `${prefixAudio}/epicwskip_fis${fileType}`);

        scene.load.audio('FreeSpinWon', `${prefixAudio}/superw_fis${fileType}`); // wala pa nito
        scene.load.audio('WinSkip', `${prefixAudio}/bigwskip_fis${fileType}`);
        scene.load.audio('Congrats', `${prefixAudio}/superw_fis${fileType}`);
        scene.load.audio('FreeSpin', `${prefixAudio}/superw_fis${fileType}`);
        
    }

    create(scene: Scene): void {
        this.ClickSFX = scene.sound.add('ClickSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.ReelDrop = scene.sound.add('ReelDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TurboDrop = scene.sound.add('TurboDrop', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.SpinSFX = scene.sound.add('SpinSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.UtilityButtonSFX = scene.sound.add('UtilityButtonSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.ScatterSFX = scene.sound.add('ScatterSFX', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TExplosion = scene.sound.add('TExplosion', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.FreeSpinWon = scene.sound.add('FreeSpinWon', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.WinSkip = scene.sound.add('WinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.TWin1 = scene.sound.add('TWin1', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TWin2 = scene.sound.add('TWin2', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TWin3 = scene.sound.add('TWin3', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.TWin4 = scene.sound.add('TWin4', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.EpicW = scene.sound.add('EpicW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.EpicWinSkip = scene.sound.add('EpicWinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.MegaW = scene.sound.add('MegaW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.MegaWinSkip = scene.sound.add('MegaWinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.BigW = scene.sound.add('BigW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.BigWinSkip = scene.sound.add('BigWinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        this.SuperW = scene.sound.add('SuperW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.SuperWinSkip = scene.sound.add('SuperWinSkip', { volume: this.sfxVolume }) as Sound.WebAudioSound;

        //this.BonusW = scene.sound.add('BonusW', { volume: this.sfxVolume }) as Sound.WebAudioSound; // wala pa nito
        this.CongratsW = scene.sound.add('Congrats', { volume: 0 }) as Sound.WebAudioSound;
        this.FreeSpinW = scene.sound.add('FreeSpin', { volume: 0}) as Sound.WebAudioSound;

        this.BonusBG = scene.sound.add('BonusBG', { 
            loop: true, 
            volume: this.musicVolume
        }) as Sound.WebAudioSound;
        this.MainBG = scene.sound.add('MainBG', {
            loop: true,
            volume: this.musicVolume
        }) as Sound.WebAudioSound;
        this.BGChecker = scene.sound.add('BGChecker', {
            loop: true,
            volume: 0
        }) as Sound.WebAudioSound;
        this.MainBG.play();
        this.BGChecker.play();

        scene.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
            const clickedButton = gameObjects.find(obj => (obj as any).isButton);
            if (!clickedButton) {
                this.ClickSFX.play({ volume: this.sfxVolume });
            }
        });
    }
    changeBackgroundMusic(scene: Scene): void {
        if (scene.gameData.isBonusRound) {
            this.BonusBG.play();
            this.MainBG.stop();
        } else {
            this.MainBG.play();
            this.BonusBG.stop();
        }
    }

    playRandomQuickWin(): void {
        const randSFX = Math.floor(Math.random() * 4);
        switch (randSFX) {
            case 0:
                this.TWin1.play({ volume: this.sfxVolume });
                break;
            case 1:
                this.TWin2.play({ volume: this.sfxVolume });
                break;
            case 2:
                this.TWin3.play({ volume: this.sfxVolume });
                break;
            case 3:
                this.TWin4.play({ volume: this.sfxVolume });
                break;
        }
    }

    /**
     * Add a win SFX to the queue to be played sequentially
     * @param winName - The name of the win SFX to queue
     */
    queueWinSFX(winNames: string[]): void {
        winNames.forEach(winName => {
            this.winSFXQueue.push(winName);
            //console.log(winName);
        });
        
        // If not currently playing from queue, start playing
        if (!this.isPlayingQueue) {
            this.playNextInQueue();
        }
    }

    /**
     * Play the next sound in the queue
     */
    private playNextInQueue(): void {
        if (this.winSFXQueue.length === 0) {
            this.isPlayingQueue = false;
            this.winIsPlaying = false;
            return;
        }

        this.isPlayingQueue = true;
        this.winIsPlaying = true;
        
        const nextSound = this.winSFXQueue.shift()!;
        this.playWinSFX(nextSound);
    }

    /**
     * Clear the win SFX queue and stop any currently playing sounds
     */
    clearWinSFXQueue(scene?: Scene): void {
        this.winSFXQueue = [];
        this.isPlayingQueue = false;
        this.winIsPlaying = false;
        if (scene) {
            this.stopWinSFX(scene);
        } else {
            // Stop sounds directly without scene reference
            
            this.BigW.stop();
            this.MegaW.stop();
            this.EpicW.stop();
            this.SuperW.stop();
            this.WinSkip.stop();

            this.BGChecker.resume();
            // this.setMusicVolume(this.getMusicVolume() / 0.01);
            if(this.getMusicVolume() > 1) {
                this.setMusicVolume(1);
            }
        }
    }

    /**
     * Get the current queue length
     */
    getQueueLength(): number {
        return this.winSFXQueue.length;
    }

    /**
     * Get the current queue contents (for debugging)
     */
    getQueueContents(): string[] {
        return [...this.winSFXQueue];
    }

    playWinSFX(winName: string): void {
        let winSound: Sound.WebAudioSound | undefined;
        if(winName === 'FreeSpin') {
            this.BGChecker.stop();
            //if(this.getMusicVolume() > 0.01){
            //    this.setMusicVolume(this.getMusicVolume() * 0.01);
            //}
            let winSound: Sound.WebAudioSound | undefined;
            winSound = this.FreeSpinWon;

            if (winSound) {
                winSound.once('complete', () => {
                    this.BGChecker.resume();
                    //this.setMusicVolume(this.getMusicVolume() / 0.01);
                    // Play next in queue if we're using the queue system
                    if (this.isPlayingQueue) {
                        this.playNextInQueue();
                    }
                });
                winSound.play({ volume: this.sfxVolume });
            }
            return;
        }
        else
        { 
            this.BGChecker.stop();
            //this.setMusicVolume(this.getMusicVolume() * 0.01);

            if (winName === 'BigWin') {
                winSound = this.BigW;
            } else if (winName === 'BigWinSkip') {
                //winSound = this.WinSkip;
            } else if (winName === 'EpicWin') {
                winSound = this.EpicW;
            } else if (winName === 'EpicWinSkip') {
                //winSound = this.WinSkip;
            } else if (winName === 'MegaWin') {
                winSound = this.MegaW;
            } else if (winName === 'MegaWinSkip') {
                //winSound = this.WinSkip;
            } else if (winName === 'SuperWin') {
                winSound = this.SuperW;
            } else if (winName === 'SuperWinSkip') {
                //winSound = this.WinSkip;
            }
            
            if (winSound) {
                winSound.once('complete', () => {
                    this.winIsPlaying = false;
                    this.BGChecker.play();
                    // Play next in queue if we're using the queue system
                    if (this.isPlayingQueue) {
                        console.log('playing next in queue');
                        this.playNextInQueue();
                    }
                });
                winSound.play({ volume: this.sfxVolume });
            }
        }
    }

    stopWinSFX(_scene: Scene): void {   
        this.BGChecker.play();
        // this.setMusicVolume(this.getMusicVolume() / 0.01);
        console.log(this.getMusicVolume());
        if(this.getMusicVolume() > 1) {
            this.setMusicVolume(1);
        }
        this.EpicW.stop();
        this.MegaW.stop();
        this.SuperW.stop();
        this.BigW.stop();
        this.WinSkip.stop();
        // Also clear the queue when stopping
        this.winSFXQueue = [];
        this.isPlayingQueue = false;
        this.winIsPlaying = false;
    }

    /**
     * Check if the win SFX queue is currently playing
     */
    isQueuePlaying(): boolean {
        return this.isPlayingQueue;
    }


    update(_scene: Scene, _time: number, _delta: number): void {
        // Empty implementation
    }

    setMusicVolume(vol: number): void {
        this.musicVolume = vol;
        if (this.MainBG) this.MainBG.setVolume(this.musicVolume);
        if (this.BonusBG) this.BonusBG.setVolume(this.musicVolume);
        console.log(chalk.blueBright.bold("setMusicVolume" + this.musicVolume));
    }

    getMusicVolume(): number {
        return this.musicVolume;
    }

    setSFXVolume(vol: number): void {
        this.sfxVolume = vol;
        // Update all SFX objects
        if (this.ClickSFX) this.ClickSFX.setVolume(this.sfxVolume);
        if (this.TWin1) this.TWin1.setVolume(this.sfxVolume);
        if (this.TWin2) this.TWin2.setVolume(this.sfxVolume);
        if (this.TWin3) this.TWin3.setVolume(this.sfxVolume);
        if (this.TWin4) this.TWin4.setVolume(this.sfxVolume);
        if (this.ReelDrop) this.ReelDrop.setVolume(this.sfxVolume);
        if (this.SpinSFX) this.SpinSFX.setVolume(this.sfxVolume);
        if (this.UtilityButtonSFX) this.UtilityButtonSFX.setVolume(this.sfxVolume);
        if (this.EpicW) this.EpicW.setVolume(this.sfxVolume);
        if (this.MegaW) this.MegaW.setVolume(this.sfxVolume);
        if (this.BigW) this.BigW.setVolume(this.sfxVolume);
        if (this.SuperW) this.SuperW.setVolume(this.sfxVolume);
        if (this.BonusW) this.BonusW.setVolume(this.sfxVolume);
        if (this.FreeSpinWon) this.FreeSpinWon.setVolume(this.sfxVolume);
        if (this.WinSkip) this.WinSkip.setVolume(this.sfxVolume);
        if (this.TExplosion) this.TExplosion.setVolume(this.sfxVolume);
        if (this.CongratsW) this.CongratsW.setVolume(0);
        if (this.FreeSpinW) this.FreeSpinW.setVolume(0);
    }

    getSFXVolume(): number {
        return this.sfxVolume;
    }
} 