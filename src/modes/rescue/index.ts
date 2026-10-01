import { PlayMode, PlayModeContext } from '../types';
import { triggerCelebrationConfetti } from '../../core/particles';

interface TargetItem {
  id: string;
  type: 'fire' | 'balloon' | 'kitten';
  x: number;
  y: number;
  emoji: string;
  resolvedEmoji: string;
  cleared: boolean;
}

export const rescueMode: PlayMode = {
  id: 'rescue',
  title: '출동! 구조대',
  subtitle: '친구들을 돕고 불을 꺼요!',
  icon: '🚨',
  color: '#ef4444',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;

    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col items-center justify-between p-4 overflow-hidden bg-gradient-to-b from-amber-100 via-rose-50 to-orange-100 select-none';

    // 1. 안내 팝업 및 헤더 (큰 텍스트와 이모지)
    const header = document.createElement('div');
    header.className =
      'w-full max-w-md flex items-center justify-between bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border-2 border-rose-200 z-20';
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-3xl animate-bounce">🚨</span>
        <span class="font-black text-rose-600 text-lg md:text-xl">출동 미션! 터치해 도와줘요</span>
      </div>
      <div id="rescue-stars" class="flex gap-1 text-2xl text-amber-400">
        <span>⭐</span><span>⭐</span><span>⭐</span>
      </div>
    `;
    container.appendChild(header);

    // 2. 구조 현장 마을 무대
    const scene = document.createElement('div');
    scene.className =
      'relative flex-1 w-full max-w-2xl my-2 rounded-3xl bg-gradient-to-b from-sky-200 to-emerald-100 border-4 border-white shadow-2xl overflow-hidden';

    // 마을 배경 요소 (집, 나무)
    scene.innerHTML = `
      <!-- 하늘과 구름 -->
      <div class="absolute top-4 left-6 text-4xl opacity-80">☁️</div>
      <div class="absolute top-8 right-12 text-4xl opacity-80">☁️</div>
      <!-- 나무와 집 -->
      <div class="absolute bottom-16 left-6 text-6xl">🏡</div>
      <div class="absolute bottom-20 right-8 text-7xl">🌳</div>
      <div class="absolute bottom-0 inset-x-0 h-16 bg-emerald-300 border-t-4 border-emerald-400"></div>
    `;

    // 타겟 아이템 생성 (불 2개, 풍선 2개, 아기 고양이 1개)
    const targets: TargetItem[] = [
      { id: '1', type: 'fire', x: 22, y: 68, emoji: '🔥', resolvedEmoji: '🌸', cleared: false },
      { id: '2', type: 'fire', x: 50, y: 72, emoji: '🔥', resolvedEmoji: '🌼', cleared: false },
      { id: '3', type: 'balloon', x: 75, y: 28, emoji: '🎈', resolvedEmoji: '🎉', cleared: false },
      { id: '4', type: 'balloon', x: 35, y: 32, emoji: '🎈', resolvedEmoji: '✨', cleared: false },
      { id: '5', type: 'kitten', x: 80, y: 62, emoji: '🐱', resolvedEmoji: '💖', cleared: false },
    ];

    let clearedCount = 0;

    // 아이템 렌더링
    targets.forEach((item) => {
      const itemBtn = document.createElement('button');
      itemBtn.className =
        'absolute transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-5xl md:text-6xl transition-all duration-300 active:scale-125 cursor-pointer z-10 select-none';
      itemBtn.style.left = `${item.x}%`;
      itemBtn.style.top = `${item.y}%`;
      itemBtn.innerHTML = item.emoji;

      itemBtn.onclick = (e) => {
        e.stopPropagation();
        if (item.cleared) {
          // 이미 해결된 곳도 터치하면 예쁜 별 소리와 팝
          ctx.audio.playPop(700);
          ctx.audio.triggerHaptic(15);
          return;
        }

        item.cleared = true;
        clearedCount++;

        if (item.type === 'fire') {
          ctx.audio.playWaterSplash();
          ctx.audio.triggerHaptic(30);
          itemBtn.innerHTML = item.resolvedEmoji;
          itemBtn.classList.add('animate-spin', 'scale-125');
          setTimeout(() => itemBtn.classList.remove('animate-spin'), 600);
        } else if (item.type === 'balloon') {
          ctx.audio.playStarChime();
          ctx.audio.triggerHaptic(20);
          itemBtn.innerHTML = item.resolvedEmoji;
        } else if (item.type === 'kitten') {
          ctx.audio.playSiren(1);
          ctx.audio.triggerHaptic(40);
          itemBtn.innerHTML = item.resolvedEmoji;
        }

        // 별 보상
        ctx.audio.playPop(880);

        // 모든 미션 클리어 시
        if (clearedCount >= targets.length) {
          setTimeout(() => {
            if (isCleanedUp) return;
            ctx.audio.playFanfare();
            triggerCelebrationConfetti();
            if (ctx.onComplete) ctx.onComplete();
          }, 350);
        }
      };

      scene.appendChild(itemBtn);
    });

    container.appendChild(scene);

    // 3. 하단 구조 버튼
    const bottomBar = document.createElement('div');
    bottomBar.className =
      'w-full max-w-md flex items-center justify-center gap-4 py-2 z-20';

    const sirenCallBtn = document.createElement('button');
    sirenCallBtn.className =
      'px-8 h-18 rounded-3xl bg-rose-500 hover:bg-rose-600 active:scale-95 border-4 border-rose-200 shadow-xl flex items-center gap-3 text-2xl font-black text-white cursor-pointer select-none';
    sirenCallBtn.innerHTML = '<span>🚨</span><span>삐뽀삐뽀 출동!</span>';
    sirenCallBtn.onclick = () => {
      ctx.audio.playSiren(3);
      ctx.audio.triggerHaptic(50);
    };

    bottomBar.appendChild(sirenCallBtn);
    container.appendChild(bottomBar);

    el.appendChild(container);

    return () => {
      isCleanedUp = true;
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};
