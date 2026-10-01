import { audioManager } from '../core/audio';

export interface PlayModeContext {
  audio: typeof audioManager;
  onBack: () => void;
  onComplete?: () => void;
  vehicleId?: string;
}

export interface PlayMode {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  minAge: number;
  locked: boolean;
  mount: (el: HTMLElement, ctx: PlayModeContext) => () => void;
}
