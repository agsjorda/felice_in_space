import { Scene, Sound } from 'phaser';

export class AudioManager {
    private musicVolume: number = 1.0; // Default music volume (0.0 - 1.0)
    private sfxVolume: number = 1.0;   // Default SFX volume (0.0 - 1.0)

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


    // Win Sounds
    public EpicW: Sound.WebAudioSound;
    public MegaW: Sound.WebAudioSound;
    public BigW: Sound.WebAudioSound;
    public SuperW: Sound.WebAudioSound;
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
        
        // Wins
        scene.load.audio('BigW', `${prefixAudio}/bigw_fis${fileType}`);
        //scene.load.audio('BonusW', `${prefixAudio}/bonusw_fis${fileType}`);
        scene.load.audio('SuperW', `${prefixAudio}/superw_fis${fileType}`);
        scene.load.audio('MegaW', `${prefixAudio}/megaw_fis${fileType}`);
        scene.load.audio('EpicW', `${prefixAudio}/epicw_fis${fileType}`);
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

        this.EpicW = scene.sound.add('EpicW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.MegaW = scene.sound.add('MegaW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.BigW = scene.sound.add('BigW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
        this.SuperW = scene.sound.add('SuperW', { volume: this.sfxVolume }) as Sound.WebAudioSound;
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

    playWinSFX(multiplier: number, _scene: Scene): void {
        if(multiplier === -1) {
            this.BGChecker.pause();
            this.setMusicVolume(this.getMusicVolume() * 0.01);
            let winSound: Sound.WebAudioSound | undefined;
            winSound = this.FreeSpinWon;

            if (winSound) {
                winSound.once('complete', () => {
                    this.BGChecker.pause();
                    this.setMusicVolume(this.getMusicVolume() * 0.01);
                });
                winSound.play({ volume: this.sfxVolume });
            }
            return;
        }
        else
        { 
            if (multiplier < 15) {
                return;
            }
            
            this.BGChecker.pause();
            this.setMusicVolume(this.getMusicVolume() * 0.01);

            let winSound: Sound.WebAudioSound | undefined;
            if (multiplier >= 20 && multiplier < 30) {
                winSound = this.EpicW;
            } else if (multiplier >= 30 && multiplier < 50) {
                winSound = this.MegaW;
            } else if (multiplier >= 50 && multiplier < 100) {
                winSound = this.SuperW;
            } else if (multiplier >= 100) {
                winSound = this.BigW;
            }

            if (winSound) {
                winSound.once('complete', () => {
                    
                    this.BGChecker.resume();
                    this.setMusicVolume(this.getMusicVolume() / 0.01);
                    if(this.getMusicVolume() > 1) {
                        this.setMusicVolume(1);
                    }
                });
                winSound.play({ volume: this.sfxVolume });
            }
        }
    }

    stopWinSFX(_scene: Scene): void {   
            this.BGChecker.resume();
            this.setMusicVolume(this.getMusicVolume() / 0.01);
            if(this.getMusicVolume() > 1) {
                this.setMusicVolume(1);
            }
        this.EpicW.stop();
        this.MegaW.stop();
        this.SuperW.stop();
        this.BigW.stop();
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        // Empty implementation
    }

    setMusicVolume(vol: number): void {
        this.musicVolume = vol;
        if (this.MainBG) this.MainBG.setVolume(this.musicVolume);
        if (this.BonusBG) this.BonusBG.setVolume(this.musicVolume);
    }

    getMusicVolume(): number {
        return this.musicVolume;
    }

    setSFXVolume(vol: number): void {
        this.sfxVolume = vol;
        // Update all SFX objects
        if (this.ClickSFX) this.ClickSFX.setVolume(this.sfxVolume);
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