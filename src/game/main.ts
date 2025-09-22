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
    // Enforce a portrait-first UX at 428x926 regardless of device rotation
    try {
        const appElement = document.getElementById('app');
        const container = document.getElementById(parent) || appElement;
        // Helpers to compute and apply full-viewport sizing and trigger Phaser refreshes
        const getViewportSize = () => {
            const vv = (window as any).visualViewport;
            const width = vv && vv.width ? Math.round(vv.width) : window.innerWidth;
            const height = vv && vv.height ? Math.round(vv.height) : window.innerHeight;
            return { width, height };
        };
        const applyContainerSize = () => {
            const { height } = getViewportSize();
            if (appElement) {
                appElement.style.width = '100vw';
                appElement.style.height = `${height}px`;
            }
            if (container) {
                (container as HTMLElement).style.width = '100vw';
                (container as HTMLElement).style.height = `${height}px`;
            }
        };
        const scheduleScaleRefresh = () => {
            try { game.scale.refresh(); } catch (_e) { /* no-op */ }
            // Multi-pass to catch mobile UI bar hide/show settling
            [60, 180, 360, 720].forEach((ms) => {
                window.setTimeout(() => {
                    applyContainerSize();
                    try { game.scale.refresh(); } catch (_e) { /* no-op */ }
                }, ms);
            });
        };
        applyContainerSize();
        if (appElement) {
            // Keep the outer app centered with a portrait aspect box
            (appElement.style as any).display = appElement.style.display || 'flex';
            (appElement.style as any).justifyContent = appElement.style.justifyContent || 'center';
            (appElement.style as any).alignItems = appElement.style.alignItems || 'center';
        }
        if (container) {
            // Ensure container grows to available viewport; Phaser FIT preserves 428x926 aspect
            (container.style as any).aspectRatio = '';
            container.style.maxWidth = '100vw';
            container.style.maxHeight = '100vh';
        }

        // Build a lightweight rotate-to-portrait overlay
        const overlayId = 'rotate-portrait-overlay';
        let overlay = document.getElementById(overlayId) as HTMLDivElement | null;
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = overlayId;
            overlay.style.position = 'fixed';
            overlay.style.inset = '0';
            overlay.style.background = '#000';
            overlay.style.color = '#fff';
            overlay.style.display = 'none';
            overlay.style.zIndex = '2147483647';
            overlay.style.fontFamily = 'Inter, Poppins, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.textAlign = 'center';
            overlay.style.padding = '24px';
            overlay.style.lineHeight = '1.4';
            overlay.style.userSelect = 'none';
            overlay.style.touchAction = 'none';
            overlay.innerHTML = '<div style="max-width: 480px; margin: 0 auto;">\
                <div style="font-size: 18px; opacity: 0.9;">Please rotate your device</div>\
                <div style="font-size: 14px; opacity: 0.75; margin-top: 8px;">This game is best experienced in portrait mode.</div>\
            </div>';
            (document.body || document.documentElement).appendChild(overlay);
        }

        const isPortrait = () => getViewportSize().height >= getViewportSize().width;
        const updateOverlay = () => {
            const show = !isPortrait();
            if (overlay) overlay.style.display = show ? 'flex' : 'none';
            // When returning to portrait, aggressively reflow and refresh scale
            if (!show) {
                applyContainerSize();
                scheduleScaleRefresh();
            }
        };
        // Initialize and react to changes
        updateOverlay();
        window.addEventListener('resize', () => { applyContainerSize(); updateOverlay(); });
        window.addEventListener('orientationchange', () => { applyContainerSize(); updateOverlay(); });
        // Track visual viewport changes (iOS/Android address bars)
        const vv = (window as any).visualViewport;
        if (vv && vv.addEventListener) {
            vv.addEventListener('resize', () => { applyContainerSize(); updateOverlay(); });
        }

        // Best-effort: lock orientation when entering fullscreen (supported browsers only)
        const lockPortraitIfPossible = async () => {
            try {
                // @ts-ignore - not universally typed
                if (screen && screen.orientation && screen.orientation.lock) {
                    // @ts-ignore
                    await screen.orientation.lock('portrait');
                }
            } catch (_e) { /* no-op */ }
        };
        game.scale.on('enterfullscreen', lockPortraitIfPossible);
        game.scale.on('resize', () => { applyContainerSize(); });
    } catch (_err) { /* no-op */ }
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