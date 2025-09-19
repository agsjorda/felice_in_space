import { Scene } from 'phaser';
import { State } from '../../fsm/state';
import { IdleState } from './IdleState';

export class StartState extends State {
    start(scene: Scene): void {
        setTimeout(() => {
            if (this.stateMachine) {
                this.stateMachine.setState(new IdleState(), scene);
            }
        }, 100);
    }

    update(_scene: Scene, _time: number, _delta: number): void {
        //_console.log("Update");
    }

    end(_scene: Scene): void {
        // Empty implementation
    }
} 