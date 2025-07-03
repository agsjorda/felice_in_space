import { Scene } from 'phaser';
import { StateMachine } from './statemachine';

export abstract class State {
    protected stateMachine: StateMachine | undefined = undefined;
 
    start(scene: Scene): void {}
    update(scene: Scene, time: number, delta: number): void {}
    end(scene: Scene): void {}
} 