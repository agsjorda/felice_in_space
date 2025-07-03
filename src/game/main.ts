import { Game as MainGame } from './scenes/Game';
import { LandingPage } from './scenes/LandingPage';
import { LoadingPage } from './scenes/LoadingPage';
import { AUTO, Game, Scale, Types } from 'phaser';
import { SpinePlugin } from '@esotericsoftware/spine-phaser-v3';

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const desktopConfig: Types.Core.GameConfig = {
    type: AUTO,
    width: 1920,
    height: 1080,
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
    }
};

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
    }
};

// Function to detect if the device is mobile
const isMobile = (): boolean => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth <= 768;
};

const StartGame = (parent: string): Game => {
    const config = isMobile() ? mobileConfig : desktopConfig;
    return new Game({ ...config, parent });
};

export default StartGame; 