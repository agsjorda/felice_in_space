import { Scene, GameObjects } from 'phaser';

export class TokenExpiredPopup extends GameObjects.Container {
    private background: GameObjects.Graphics;
    private messageText: GameObjects.Text;
    private backgroundColor: number = 0x000000; // Black
    private backgroundAlpha: number = 0.8; // Default opacity (0.6 = 60%)
    private cornerRadius: number = 20; // Default corner radius
    private animationDuration: number = 300; // Animation duration in milliseconds
    private overlay: Phaser.GameObjects.Graphics; // Full-screen overlay
    
    constructor(scene: Scene, x: number = 0, y: number = 0, options: { 
        opacity?: number,
        cornerRadius?: number,
        overlayColor?: number,
        overlayAlpha?: number
    } = {}) {
        super(scene, x, y);
        this.scene = scene;
        
        // Create overlay first (behind everything else)
        this.overlay = new GameObjects.Graphics(scene);
        this.overlay.fillStyle(options.overlayColor || 0x000000, options.overlayAlpha !== undefined ? 
            Phaser.Math.Clamp(options.overlayAlpha, 0, 1) : 0.35);
        this.overlay.fillRect(0, 0, scene.scale.width, scene.scale.height);
        this.overlay.setScrollFactor(0);
        this.overlay.setInteractive(
            new Phaser.Geom.Rectangle(0, 0, scene.scale.width, scene.scale.height),
            Phaser.Geom.Rectangle.Contains
        );
        this.overlay.visible = false;
        
        // Add overlay to scene (but not to this container yet)
        scene.add.existing(this.overlay);
        
        // Apply custom options if provided
        if (options.opacity !== undefined) {
            this.backgroundAlpha = Phaser.Math.Clamp(options.opacity, 0, 1);
        }
        if (options.cornerRadius !== undefined) {
            this.cornerRadius = Math.max(0, options.cornerRadius);
        }
        
        // Create a graphics object for the rounded rectangle background
        this.background = new Phaser.GameObjects.Graphics(scene);
        this.drawBackground();
        
        // Create message text (centered vertically since button was removed)
        this.messageText = new GameObjects.Text(
            scene,
            0,
            0,
            'Your play session has expired. Please log in again to keep playing. \n\nIf you were actively playing a game, your progress has been saved, and you can pick up right where you left off after relaunching the game.',
            {
                fontFamily: 'Poppins-Regular',
                fontSize: '21px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: scene.scale.width * 0.7, useAdvancedWrap: true }
            }
        );
        this.messageText.setOrigin(0.5);
        
        // Add all elements to container (button removed but functionality preserved)
        this.add([this.background, this.messageText]);
        
        // Center the container
        this.setPosition(scene.scale.width / 2, scene.scale.height / 2);
        
        // Start hidden
        this.setVisible(false);
        
        // Add to scene
        scene.add.existing(this);
    }
    
    /**
     * Show the popup with a smooth animation
     */
    public show(): void {
        // Show overlay first
        this.overlay.setVisible(true);
        this.overlay.setDepth(9999); // Just below the popup
        
        // Set initial state for animation
        this.setVisible(true);
        this.setDepth(10000); // Ensure it's on top of the overlay
        this.setScale(0.5);
        this.setAlpha(0);
        
        // Create a fade-in and pop-up effect
        this.scene.tweens.add({
            targets: this,
            scaleX: 1,
            scaleY: 1,
            alpha: 1,
            duration: this.animationDuration,
            ease: 'Back.Out', // Bouncy effect
            onStart: () => {
                // Play a sound effect if available
                if ((window as any).audioManager) {
                    (window as any).audioManager.playSoundEffect('popup_open');
                }
            }
        });
    }
    
    /**
     * Hide the popup with a smooth animation
     * @param callback - Optional callback when hide animation completes
     */
    public hide(callback?: () => void): void {
        this.scene.tweens.add({
            targets: this,
            scaleX: 0.5,
            scaleY: 0.5,
            alpha: 0,
            duration: this.animationDuration * 0.8, // Slightly faster than show
            ease: 'Back.In', // Slight ease in
            onComplete: () => {
                this.setVisible(false);
                this.overlay.setVisible(false);
                if (callback) callback();
            }
        });
    }
    
    public updateMessage(message: string): void {
        this.messageText.setText(message);
    }
    
    /**
     * Update the background opacity
     * @param opacity - Opacity value between 0 (fully transparent) and 1 (fully opaque)
     */
    public setBackgroundOpacity(opacity: number): void {
        this.backgroundAlpha = Phaser.Math.Clamp(opacity, 0, 1);
        this.drawBackground();
    }
    
    /**
     * Redraw the background with current settings
     */
    private drawBackground(): void {
        const width = this.scene.scale.width * 0.8;
        const height = this.scene.scale.height * 0.4;
        
        this.background.clear();
        this.background.fillStyle(this.backgroundColor, this.backgroundAlpha);
        
        // Draw rounded rectangle
        this.background.fillRoundedRect(
            -width / 2,  // x
            -height / 2, // y
            width,       // width
            height,      // height
            this.cornerRadius // radius
        );
    }
    
    /**
     * Update the background color
     * @param color - Color value (e.g., 0x000000 for black)
     */
    public setBackgroundColor(color: number): void {
        this.backgroundColor = color;
        this.drawBackground();
    }
    
    /**
     * Set the corner radius of the background
     * @param radius - The radius of the corners in pixels
     */
    public setCornerRadius(radius: number): void {
        this.cornerRadius = Math.max(0, radius);
        this.drawBackground();
    }
    
    /**
     * Refresh functionality (preserved but button removed)
     * Can be called programmatically if needed
     */
    public refresh(): void {
        try {
            (window as any).audioManager?.playSoundEffect?.('button_fx');
        } catch {}
        window.location.reload();
    }
    
    /**
     * Clean up the popup and its overlay
     */
    public destroy(fromScene?: boolean): void {
        if (this.overlay) {
            this.overlay.destroy();
        }
        super.destroy(fromScene);
    }
}

