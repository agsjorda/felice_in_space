import { Game as MainGame } from './scenes/Game';
import { LandingPage } from './scenes/LandingPage';
import { LoadingPage } from './scenes/LoadingPage';
import { AUTO, Game, Scale, Types } from 'phaser';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const mobileConfig: Types.Core.GameConfig = {
    type: AUTO,
    width: 428,
    height: 926,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH
    },
    scene: [
        LandingPage,
        LoadingPage,
        MainGame,
    ],
    plugins: {
        scene: [
            {
                key: 'spine.SpinePlugin',
                plugin: SpinePlugin,
                mapping: 'spine'
            }
        ]
    },
    dom: {
        createContainer: true
    },
    input: {
        activePointers: 3
    }
};

// Function to detect if the device is mobile
const isMobile = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
};

declare global {
    interface Window {
        phaserGame?: Game;
    }
}

const StartGame = (parent: string): Game => {
    const config = mobileConfig;
    //setupAspectRatioReload();
    const game = new Game({ ...config, parent });
    // Harden input reliability on mobile Safari/Chrome by setting runtime styles
    try {
        const appElement = document.getElementById('app');
        const container = document.getElementById(parent) || appElement;
        const canvas = game.canvas as HTMLCanvasElement | null;
        // Ensure touch listeners can call preventDefault on Safari/Chrome mobile
        if (canvas) {
            const noopPrevent = (e: Event) => {
                // Prevent browser scroll/zoom from stealing the gesture
                e.preventDefault();
            };
            canvas.addEventListener('touchstart', noopPrevent, { passive: false });
            canvas.addEventListener('touchmove', noopPrevent, { passive: false });
            canvas.addEventListener('touchend', noopPrevent, { passive: false });
            canvas.addEventListener('touchcancel', noopPrevent, { passive: false });
        }
        const applyTouchSafeStyles = (el: HTMLElement | null | undefined) => {
            if (!el) return;
            el.style.touchAction = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).msTouchAction = 'none';
            el.style.userSelect = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).webkitUserSelect = 'none';
            // @ts-ignore vendor prefix
            (el.style as any).webkitTapHighlightColor = 'transparent';
            (el.style as any).overscrollBehavior = 'contain';
        };
        applyTouchSafeStyles(appElement as HTMLElement);
        applyTouchSafeStyles(container as HTMLElement);
        applyTouchSafeStyles(canvas as unknown as HTMLElement);
    } catch (_e) { /* no-op */ }
    // Make canvas focusable to improve gesture handling after exiting fullscreen
    if (game.canvas && !game.canvas.hasAttribute('tabindex')) {
        game.canvas.setAttribute('tabindex', '0');
    }
    // Expose game globally for UI overlay controls
    window.phaserGame = game;
    // Ensure the fullscreen element includes the HTML overlay controls
    const appElement = document.getElementById('app');
    if (appElement) {
        // Phaser will request fullscreen on this element, so overlay stays visible
        // @ts-ignore - property exists on Phaser 3 ScaleManager
        game.scale.fullscreenTarget = appElement as unknown as HTMLElement;
    }
    // Ensure ability to re-enter fullscreen after exiting
    game.scale.on('leavefullscreen', () => {
        // Refocus canvas so the next user gesture is captured
        game.canvas?.focus();
    });
    // Cross-browser: also listen for DOM fullscreen change
    const onFsChange = () => {
        if (!game.scale.isFullscreen) {
            game.canvas?.focus();
        }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    // @ts-ignore - Safari legacy prefix
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return game;
};

export default StartGame; 