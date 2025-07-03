import { Scene } from 'phaser';
import { State } from './state';

export class StateMachine {
    private state: State | undefined;

    constructor() {
        this.state = undefined;
    }

    setState(state: State, scene: Scene): void {
        if (this.state !== undefined) {
            this.state.end(scene);
        }
        this.state = state;
        //@ts-ignore
        this.state.stateMachine = this;
        this.state.start(scene);
    }

    update(scene: Scene, time: number, delta: number): void {
        if (this.state !== undefined) {
            this.state.update(scene, time, delta);
        }
    }
} 