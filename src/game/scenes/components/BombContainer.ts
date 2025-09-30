import { Scene, GameObjects } from 'phaser';
import { Events } from './Events';
import { SpineGameObject } from '@esotericsoftware/spine-phaser-v3';
import { GameData } from './GameData';

/**
 * BombContainer class that manages bomb sprites with text overlays
 * The container handles traversal during drop and refill operations
 */
export class BombContainer extends GameObjects.Container {
    private bombSprite: SpineGameObject;
    private textOverlay: GameObjects.Text;
    private floatingText?: GameObjects.Text;
    private orbitTimer?: Phaser.Time.TimerEvent;
    private multiplier: number;
    private bombType: string;
    public scene: Scene;
    private gameData: GameData;
    private isMobile: boolean = false;

    // Function to detect if the device is mobile
    private isMobileDevice(): boolean {
        return true;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    constructor(scene: Scene, x: number, y: number, bombValue: number, gameData: GameData) {
        super(scene, x, y);
        this.isMobile = this.isMobileDevice();
        
        this.scene = scene;
        this.gameData = gameData;
        this.multiplier = this.getMultiplierFromBombValue(bombValue);
        this.bombType = this.getBombTypeFromMultiplier(this.multiplier);

        // Set the animation based on the bomb type
        // Create the bomb sprite
        let bombKey = 'Symbol10_FIS';
        let animationKey = 'Symbol10_FIS'
        if(this.bombType == 'medium'){
            animationKey = 'Symbol11_FIS';
        }
        else if(this.bombType == 'high'){
            animationKey = 'Symbol12_FIS';
        }
        this.bombSprite = scene.add.spine(0, 0, bombKey, bombKey);
        this.bombSprite.setVisible(true);
        this.bombSprite.setDepth(10000);
        this.bombSprite.animationState.setAnimation(0, animationKey, false);
        // Pause the animation at frame 1 (i.e., after the first frame)
        this.bombSprite.animationState.timeScale = 1;

        const entry = this.bombSprite.animationState.getCurrent(0);
        if (entry) {
            // Calculate the time for frame 1 (assuming 30 FPS)
            const frameRate = 30;
            const pauseAtFrame = 1;
            const pauseMs = (pauseAtFrame / frameRate) * 1000;
            this.scene.time.delayedCall(pauseMs, () => {
                try {
                    this.bombSprite.animationState.timeScale = 0;
                    entry.trackTime = pauseMs / 1000;
                    this.bombSprite.animationState.update(0);
                } catch (_e) {}
            });
        }

        scene.gameData.totalBombWin = 0;
        // Set the animation time scale to 1
        this.bombSprite.animationState.timeScale = 0;
        const colorIndex = this.multiplier >= 50 ? 0 : this.multiplier >= 12 ? 1 : 2;
        const gradientColor: string[][] = [
            // 🟡 Gold Bombs → Purple text
            ['#FF8C42', '#FFD700'],
            // 🟢 Green Bombs → Magenta/Pink text
            ['#FF4D94', '#FFB6C1'],  
            // 🔵 Blue Bombs → Orange/Yellow text
            ['#FF8C42', '#FFD700']   
        ];
        
        
        const shadowColor: string[] = [
            '#8B3A00',   // Burnt orange for blue bombs  
            '#8B004B',  // Dark magenta for green bombs
            '#8B3A00'   // Burnt orange for blue bombs
        ];
        
        const blur: number[] = [
            0.7, // Gold bomb shadow opacity
            0.6, // Green bomb shadow opacity
            0.6  // Blue bomb shadow opacity
        ];
        
        let _gradientColor = gradientColor[colorIndex];
        // Create the text overlay
        this.textOverlay = scene.add.text(0, 0, `${this.multiplier}X`, {
            fontSize: '32px',
            color: _gradientColor[0],
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            align: 'center',
            stroke: shadowColor[colorIndex],
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(0, 0, 0, ' + blur[colorIndex] + ')',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        this.textOverlay.setOrigin(0.5, 0.5);
        this.textOverlay.setDepth(2);
        
        // Add both elements to the container
        this.add([this.bombSprite, this.textOverlay]);
        // Ensure the container itself renders above standard symbols
        this.setDepth(10);
        
        // Create a floating text that will always render above everything else
        this.floatingText = scene.add.text(0, 0, `X ${this.multiplier}`, {
            fontSize: '28px',
            color: _gradientColor[0],
            fontFamily: 'Poppins',
            fontStyle: 'bold',
            stroke: shadowColor[colorIndex],
            strokeThickness: 4,
            shadow: {
                offsetX: 0,
                offsetY: 0,
                color: 'rgba(0, 0, 0, ' + blur[colorIndex] + ')',
                blur: 10,
                stroke: true,
                fill: false
            }
        });
        
        this.floatingText.setOrigin(0.5, 0.5);
        // Place this floating text at an extrzemely high depth so it's above all overlays
        this.floatingText.setDepth(1000000);
        // Ensure it renders on top in the display list
        try { this.scene.children.bringToTop(this.floatingText); } catch (_e) {}
        // Initialize position at the bomb center
        this.updateFloatingTextPosition();
        
        // Set initial visibility
        this.textOverlay.setAlpha(0.8);
        // Match other symbols' scaling; actual sizing is handled by setBombDisplaySize
        this.setScale(0.8);
        
        // // Debug logging
        // console.log('BombContainer created', {
        //     bombValue,
        //     multiplier: this.multiplier,
        //     bombType: this.bombType,
        //     position: { x, y }
        // });
    }

    /**
     * Get multiplier value from bomb symbol value (10-22)
     */
    private getMultiplierFromBombValue(bombValue: number): number {
        if (bombValue < 10 || bombValue > 22) {
            this.gameData.debugError('Invalid bomb value:', bombValue);
            return 1; // Default fallback
        }
        
        const multiplierIndex = bombValue - 10;
        const multipliers = this.gameData.bombMultiplier;
        
        if (multiplierIndex >= 0 && multiplierIndex < multipliers.length) {
            return multipliers[multiplierIndex];
        }
        
        this.gameData.debugError('Multiplier index out of range:', multiplierIndex);
        return 1; // Default fallback
    }

    /**
     * Get bomb type (low/medium/high) based on multiplier value
     */
    private getBombTypeFromMultiplier(multiplier: number): string {
        if (multiplier > 25) {
            return 'high';
        } else if (multiplier > 10) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    /**
     * Set the display size for both bomb sprite and text overlay
     */
    setBombDisplaySize(width: number, height: number): void {
        // Resize and center the spine object within the desired width/height
        try {
            // Compute current bounds to determine scaling
            const spineAny = this.bombSprite as any;
            const rawBounds = spineAny.getBounds ? spineAny.getBounds() : undefined;
            // Spine's getBounds() typically returns { offset: {x,y}, size: {x,y} }
            const currentWidth = (rawBounds?.size?.x) || (rawBounds?.width) || (spineAny.width) || 100;
            const currentHeight = (rawBounds?.size?.y) || (rawBounds?.height) || (spineAny.height) || 100;
            const scaleX = width / currentWidth;
            const scaleY = height / currentHeight;
            const scale = Math.min(scaleX, scaleY);

            this.bombSprite.setScale(1.1);
            // Place at the center of the container; children are positioned relative to container center
            this.bombSprite.setPosition(0, 0);
        } catch (_e) {
            // Fallback: approximate scale if bounds are not available yet
            const approximateScale = Math.min(width, height) / 120;
            //this.bombSprite.setScale(approximateScale);
            this.bombSprite.setPosition(0, 0);
        }

        // Center text within the container
        this.textOverlay.setPosition(width * 0.1, 0);

        // Adjust text size to be readable and centered inside the bomb
        const baseTextSize = Math.floor(Math.min(width/2, height/2) * 0.28) * 3;
        this.textOverlay.setFontSize(baseTextSize);

        // Update container size so tweens and layout treat it like a symbol cell
        this.setSize(width, height);

        // console.log('Bomb display size set', { width, height });
    }

    /**
     * Play bomb animation based on type
     */
    playBombAnimation(): void {
        console.log('Playing bomb animation', { bombType: this.bombType });
        
        // Set the appropriate animation based on bomb type
        setTimeout(() => {
            try { this.scene.audioManager.TExplosion.play({ volume: this.scene.audioManager.getSFXVolume() }); } catch (_e) {}
            // Spawn an overlay spine on top and animate that, so it renders above other symbols
            // Pause at the 22nd frame (assuming 30 FPS → ~733ms); extend duration so overlay persists
            this.spawnOverlayBombAnimation('animation', 1500, 31, 30);
            // During active animation, lower other symbols (regular/scatter) so bomb visually dominates
            this.setOtherSymbolsDepth(0);
            // Move floating text from bomb center to top-quarter middle while animating
            this.startFloatingTextRise();
        }, 1000);
        
        // Animate text overlay appearance
        this.scene.tweens.add({
            targets: this.textOverlay,
            alpha: 1,
            scale: 1.2,
            duration: 300,
            ease: 'Back.easeOut',
            yoyo: true,
            yoyoDelay: 200
        });
    }

    /**
     * Check if the bomb is currently playing an animation
     */
    isPlayingAnimation(): boolean {
        if (this.bombSprite && this.bombSprite.animationState.tracks.length > 0) {
            const currentAnimation = this.bombSprite.animationState.getCurrent(0);
            if (currentAnimation && currentAnimation.animation) {
                const animationName = currentAnimation.animation.name;
                // Check for both animation types: 'low-animation', 'medium-animation', 'high-animation'
                // and also 'low-static', 'medium-static', 'high-static' (used by WinAnimation)
                return animationName.includes('Symbols');
            }
        }
        return false;
    }
    /**
     * Get the bomb sprite for external animations
     */
    getBombSprite(): SpineGameObject {
        return this.bombSprite;
    }

    /**
     * Get the text overlay for external modifications
     */
    getTextOverlay(): GameObjects.Text {
        return this.textOverlay;
    }

    /**
     * Get the multiplier value
     */
    getMultiplier(): number {
        return this.multiplier;
    }

    /**
     * Get the bomb type
     */
    getBombType(): string {
        return this.bombType;
    }

    /**
     * Update text overlay content
     */
    updateText(text: string): void {
        this.textOverlay.setText(text);
        console.log('Bomb text updated', { text });
    }

    /**
     * Show explosion effect
     */
    showExplosion(): void {
        console.log('Showing bomb explosion');
        
        // Use an overlay bomb so the animation sits above other symbols
        try {
            this.scene.audioManager.TExplosion.play();
            this.scene.audioManager.BonusBG.resume();
            } catch (_e) {}
        // Pause at the 22nd frame (assuming 30 FPS)
        switch(this.bombType){
            case 'low':
                this.spawnOverlayBombAnimation('Symbols10_FIS', 1500, 31, 30);
                break;
            case 'medium':
                this.spawnOverlayBombAnimation('Symbols11_FIS', 1500, 31, 30);
                break;
            case 'high':
                this.spawnOverlayBombAnimation('Symbols12_FIS', 1500, 31, 30);
                break;
        }
        // During explosion, lower other symbols (regular/scatter) so bomb visually dominates
        this.setOtherSymbolsDepth(0);
        
        // Animate text overlay
        this.scene.tweens.add({
            targets: this.bombSprite,
            scaleX: 0.9,
            scaleY: 0.9,
            
            duration: 500,
            ease: 'Power2',
        });
        
        // Also move floating text during explosion for visibility
        this.startFloatingTextRise();
    }

    /**
     * Spawns a temporary overlay Spine bomb at the same visual position and plays an animation.
     * The overlay is added to the parent container (so masking applies) and brought to the top.
     */
    private spawnOverlayBombAnimation(animationName: string = '', durationMs: number = 650, pauseAtFrame?: number, frameRate: number = 30): void {
        try {
            const parent: any = (this as any).parentContainer;
            // Position overlay relative to parent container so it aligns under the same mask/transform
            const overlayX = this.x + this.bombSprite.x;
            const overlayY = this.y + this.bombSprite.y;
            let overlay: SpineGameObject = null!;
            
            overlay = this.scene.add.spine(overlayX, overlayY, animationName, animationName) as SpineGameObject;
            // Match visual size of the original bomb sprite
            //overlay.setScale(this.bombSprite.scaleX, this.bombSprite.scaleY);
            overlay.setAlpha(1);
            // Scale down overlay from 100% to 50% at animation start
            try {
                this.scene.tweens.add({
                    targets: overlay,
                    scaleX: overlay.scaleX * 2,
                    scaleY: overlay.scaleY * 2,
                    duration: 800,
                    ease: 'Power2'
                });
            } catch (_e) { /* no-op */ }
            // Place inside the same container (for masking) and bring to top
            if (parent && typeof parent.add === 'function') {
                parent.add(overlay);
                if (typeof parent.bringToTop === 'function') {
                    parent.bringToTop(overlay);
                }
            } else {
                // Fallback: set a very high depth on scene root
                overlay.setDepth(10000);
            }

            // Play the requested animation on the overlay
            overlay.animationState.timeScale = 1;
            const entry = overlay.animationState.setAnimation(0, animationName, false);

            // If asked to pause at a specific frame, schedule a pause at that timestamp
            if (typeof pauseAtFrame === 'number' && pauseAtFrame >= 0 && frameRate > 0) {
                const pauseMs = (pauseAtFrame / frameRate) * 1000;
                this.scene.time.delayedCall(pauseMs, () => {
                    try {
                        // Freeze the animation at the pause time
                        overlay.animationState.timeScale = 0;
                        const current = overlay.animationState.getCurrent(0) || entry;
                        if (current) {
                            current.trackTime = pauseMs / 1000;
                        }
                        overlay.animationState.update(0);
                        (overlay as any).skeleton?.updateWorldTransform?.();
                        // Keep the paused frame fully visible
                        overlay.setAlpha(1);
                        overlay.setVisible(true);
                        // Emit world coordinates for floating text illusion in Buttons
                        const wm = this.getWorldTransformMatrix(new Phaser.GameObjects.Components.TransformMatrix());
                        const lx = this.textOverlay.x;
                        const ly = this.textOverlay.y;
                        const worldX = wm.a * lx + wm.c * ly + wm.tx;
                        const worldY = wm.b * lx + wm.d * ly + wm.ty;
                        Events.emitter.emit(Events.BOMB_FLOAT_TEXT, {
                            x: worldX,
                            y: worldY,
                            valueText: this.textOverlay.text
                        });
                    } catch (_e) { /* no-op */ }
                });
                // Ensure overlay lifetime exceeds pause time
                durationMs = Math.max(durationMs, pauseMs + 500);
            }
            // Do not auto-destroy; keep overlay frozen at frame 31 until the next spin clears the grid
        } catch (_e) {
            // If overlay fails, fall back to animating the internal sprite
            try {
                this.bombSprite.animationState.timeScale = 1;
                const fallbackEntry = this.bombSprite.animationState.setAnimation(0, animationName, false);
                // Scale down internal sprite from 100% to 50% at animation start
                try {
                    this.scene.tweens.add({
                        targets: this.bombSprite,
                        scaleX: this.bombSprite.scaleX * .75,
                        scaleY: this.bombSprite.scaleY * .75,
                        duration: 400,
                        ease: 'Power2'
                    });
                } catch (__e) { /* no-op */ }
                // If asked to pause at a specific frame, pause the internal sprite as well
                if (typeof pauseAtFrame === 'number' && pauseAtFrame >= 0 && frameRate > 0) {
                    const pauseMs = (pauseAtFrame / frameRate) * 1000;
                    this.scene.time.delayedCall(pauseMs, () => {
                        try {
                            this.bombSprite.animationState.timeScale = 0;
                            const current = this.bombSprite.animationState.getCurrent(0) || fallbackEntry;
                            if (current) {
                                current.trackTime = pauseMs / 1000;
                            }
                            (this.bombSprite as any).skeleton?.updateWorldTransform?.();
                            // Keep sprite fully visible on paused frame
                            this.bombSprite.setAlpha(1);
                        } catch (__e) { /* no-op */ }
                    });
                }
            } catch (__e) {}
        }
    }

    private setOtherSymbolsDepth(depth: number): void {
        try {
            const parent: any = (this as any).parentContainer;
            if (!parent || !parent.list) return;
            parent.list.forEach((child: any) => {
                if (!child || child === this) return;
                // Lower any sibling that supports setDepth (Sprites, Spine, Containers, etc.)
                if (typeof child.setDepth === 'function') {
                    try { child.setDepth(depth); } catch (_e) {}
                }
                // If sibling is a Container, also lower its immediate children
                if (Array.isArray(child?.list)) {
                    child.list.forEach((grandChild: any) => {
                        if (!grandChild || grandChild === this) return;
                        if (typeof grandChild.setDepth === 'function') {
                            try { grandChild.setDepth(depth); } catch (_e) {}
                        }
                    });
                }
            });
        } catch (_e) {
            // no-op
        }
    }

    /**
     * Clean up the bomb container
     */
    destroy(): void {
        // console.log('Destroying bomb container');
        
        if (this.orbitTimer) {
            try { this.orbitTimer.remove(false); } catch (_e) {}
            this.orbitTimer = undefined;
        }
        if (this.floatingText) {
            try { this.floatingText.destroy(); } catch (_e) {}
            this.floatingText = undefined;
        }
        
        if (this.bombSprite) {  
            // console.error('destroying bomb sprite', this.bombSprite);
            this.bombSprite.animationState.timeScale = 1;
            this.bombSprite.animationState.addListener({
                complete: () => {
                    //console.error('destroying bomb sprite complete');
                this.bombSprite.destroy();
            }});
        }
        
        if (this.textOverlay) {
            this.textOverlay.destroy();
        }
        
        super.destroy();
    }

    /**
     * Compute the bomb's world position to anchor the floating text motion.
     */
    private getBombWorldPosition(): { x: number; y: number } {
        try {
            const wm = this.getWorldTransformMatrix(new Phaser.GameObjects.Components.TransformMatrix());
            const lx = this.bombSprite.x;
            const ly = this.bombSprite.y;
            const worldX = wm.a * lx + wm.c * ly + wm.tx;
            const worldY = wm.b * lx + wm.d * ly + wm.ty;
            return { x: worldX, y: worldY };
        } catch (_e) {
            return { x: this.x, y: this.y };
        }
    }

    /**
     * Place the floating text at the bomb center and log its coordinates.
     */
    private updateFloatingTextPosition(): void {
        if (!this.floatingText) return;
        const center = this.getBombWorldPosition();
        this.floatingText.setPosition(center.x, center.y);
    }

    /**
     * Start a tween that moves the floating text from the bomb center to
     * the top-quarter of the screen around the middle X.
     */
    private startFloatingTextRise(): void {
        if (!this.floatingText) return;
        // Stop any existing timer-based motion
        if (this.orbitTimer) {
            try { this.orbitTimer.remove(false); } catch (_e) {}
            this.orbitTimer = undefined;
        }
        // Start at bomb center
        const start = this.getBombWorldPosition();
        this.floatingText.setPosition(start.x, start.y);
        try { this.scene.children.bringToTop(this.floatingText); } catch (_e) {}

        // Compute target at top-quarter of the current camera view, centered on X
        const cam = this.scene.cameras.main;
        const view = cam.worldView;
        let targetX = this.isMobile ? view.x + view.width * 0.5 : view.x + view.width * 0.55;
        let targetY = this.isMobile ? view.y + view.height * 0.1875 : view.y + view.height * 0.90;
        this.textOverlay.setText('');

        this.scene.tweens.add({
            targets: this.floatingText,
            x: targetX,
            y: targetY,
            scale: 1.5,
            duration: 900,
            ease: 'Sine.easeOut',
            onUpdate: () => {
                if (!this.floatingText) return;
                //console.log('FloatingText position:', { x: this.floatingText.x, y: this.floatingText.y });
            },
            onComplete: () => {
                try { 
                    this.scene.children.bringToTop(this.floatingText!);
                    setTimeout(() => {
                        this.floatingText?.destroy();
                        // event call to update the total win text, multiply by the bomb multiplier amount
                        this.scene.gameData.totalBombWin += this.getMultiplier();
                        Events.emitter.emit(Events.SHOW_BOMB_WIN);
                        // console.log(this.scene.gameData.totalWinFreeSpinPerTumble[this.scene.gameData.apiFreeSpinsIndex]);
                        Events.emitter.emit(Events.UPDATE_TOTAL_WIN, 0, true);
                    }, 15);
                 } catch (_e) {}
            }
        });
    }
} 