import { PlayMode } from './types';
import { constructionMode } from './construction/index';
import { garageMode } from './garage/index';
import { roadDrawMode } from './road-draw/index';
import { soundBookMode } from './sound-book/index';
import { carWashMode } from './car-wash/index';

// 여기에 한 줄 추가 = 새 모드 (홈 화면 버튼 순서)
export const PLAY_MODES: PlayMode[] = [
  soundBookMode,
  carWashMode,
  roadDrawMode,
  garageMode,
  constructionMode,
];

export function getAllModes(): PlayMode[] {
  return PLAY_MODES;
}

export function getModeById(id: string): PlayMode | undefined {
  return PLAY_MODES.find((m) => m.id === id);
}
