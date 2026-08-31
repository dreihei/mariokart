import * as THREE from 'three';

export type ItemType = 'boost' | 'pulse' | 'barrier' | 'shield';
export type BotState = 'race' | 'reverse' | 'realign' | 'respawn';

export interface TrackSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  width: number;
  distance: number;
  index: number;
}

export interface RacerProgress {
  lap: number;
  checkpoint: number;
  trackIndex: number;
  totalProgress: number;
  finished: boolean;
  finishTime: number;
}

export interface InputState {
  throttle: number;
  steer: number;
  drift: boolean;
}
