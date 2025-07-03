import 'phaser';
import { GameData } from '../game/scenes/components/GameData';
import { Background } from '../game/scenes/components/Background';
import { SlotMachine } from '../game/scenes/components/SlotMachine';
import { Buttons } from '../game/ui/Buttons';
import { AudioManager } from '../game/scenes/components/AudioManager';
import { GameAPI } from '../game/scenes/backend/GameAPI';

declare module 'phaser' {
    interface Scene {
        gameData: GameData;
        background: Background;
        slotMachine: SlotMachine;
        buttons: Buttons;
        audioManager: AudioManager;
        gameAPI: GameAPI;
    }
} 