import { Scene } from 'phaser';

export class Autoplay {
    isAutoPlaying: boolean;
    private remainingSpins: number;
    private spinEventListener?: (...args: any[]) => void;
    private spinEndEventListener?: (...args: any[]) => void;
    start(scene: Scene, spins: number): void;
    stop(): void;
    update(scene: Scene, time: number, delta: number): void;
} 