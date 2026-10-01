import { PlayMode, PlayModeContext } from './types';
import { constructionMode } from './construction/index';
import { garageMode } from './garage/index';
import { roadDrawMode } from './road-draw/index';
import { soundBookMode } from './sound-book/index';
import { carWashMode } from './car-wash/index';

function createPlaceholderMode(
  id: string,
  title: string,
  icon: string,
  color: string,
  minAge = 2
): PlayMode {
  return {
    id,
    title,
    icon,
    color,
    minAge,
    locked: false,
    mount: (el: HTMLElement, ctx: PlayModeContext) => {
      const container = document.createElement('div');
      container.className =
        'w-full h-full flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden touch-none';
      container.style.backgroundColor = `${color}15`;

      container.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-4 max-w-sm">
          <div class="w-32 h-32 rounded-full flex items-center justify-center text-7xl shadow-xl animate-bounce" style="background-color: ${color}30; border: 4px solid ${color};">
            ${icon}
          </div>
          <h2 class="text-3xl md:text-4xl font-black text-gray-800 tracking-tight">
            ${title}
          </h2>
          <div class="px-5 py-2.5 rounded-full bg-white/90 shadow-md border-2 border-gray-200 text-lg font-black text-amber-600 flex items-center gap-2">
            <span>🚧</span>
            <span>준비 중이에요! 곧 만나요</span>
          </div>
          <p class="text-sm font-bold text-gray-500 mt-2">
            화면을 톡톡 터치하면 재미있는 소리가 나요!
          </p>
        </div>
      `;

      const handleTouch = () => {
        ctx.audio.playPop(500 + Math.random() * 300);
      };

      container.addEventListener('pointerdown', handleTouch);
      el.appendChild(container);

      return () => {
        container.removeEventListener('pointerdown', handleTouch);
        if (container.parentElement) {
          container.parentElement.removeChild(container);
        }
      };
    },
  };
}

export const PLAY_MODES: PlayMode[] = [
  constructionMode,
  garageMode,
  roadDrawMode,
  soundBookMode,
  carWashMode,
  createPlaceholderMode('rescue', '출동! 구조대', '🚨', '#ef4444'),
];

export function getAllModes(): PlayMode[] {
  return PLAY_MODES;
}

export function getModeById(id: string): PlayMode | undefined {
  return PLAY_MODES.find((m) => m.id === id);
}
