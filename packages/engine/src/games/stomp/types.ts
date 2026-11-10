import type { BaseEntity } from '../../types';

export interface Stomper extends BaseEntity {
  grounded: boolean;
  /** ticks since leaving the ground (for coyote time) */
  airTicks: number;
  canDouble: boolean;
  jumpHeld: boolean;
  upWasDown: boolean;
  pounding: boolean;
  facing: 1 | -1;
  /** platform we stand on (movers carry us) */
  onMover: number;
  bumpVx: number;
  /** feet height last tick (a stomp must cross the victim's head) */
  prevBottom: number;
}
export interface Mover { id: number; x0: number; y: number; w: number; travel: number; speed: number; x: number; dx: number }
export interface StompState { movers: Mover[]; ids: { platforms: number[]; springs: number[]; spikes: number[] } }
export interface StompBrain { nextThink: number; out: { dx: number; dy: number; skill1: boolean; skill2: boolean; cashout: boolean }; wander: number; jumpHold: number }
