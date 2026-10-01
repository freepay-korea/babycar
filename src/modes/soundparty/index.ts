import { PlayMode, PlayModeContext } from '../types';
import { triggerCelebrationConfetti } from '../../core/particles';

export const soundPartyMode: PlayMode = {
  id: 'soundparty',
  title: '소리 쿵짝 연주회',
  subtitle: '신나는 탈것 소리로 쿵짝쿵짝!',
  icon: '🎵',
  color: '#8b5cf6',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;

    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col items-center justify-between p-4 overflow-hidden bg-gradient-to-b from-purple-200 via-indigo-100 to-pink-200 select-none';

    // 1. 상단 무대 조명 및 관람객 동물 친구들
    const stageTop = document.createElement('div');
    stageTop.className =
      'w-full max-w-lg flex items-center justify-between bg-white/80 backdrop-blur-md px-5 py-3 rounded-3xl shadow-lg border-2 border-purple-200 z-10';

    stageTop.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-3xl animate-bounce">🪩</span>
        <span class="font-black text-purple-700 text-lg md:text-xl">신나는 탈것 밴드!</span>
      </div>
      <!-- 응원하는 동물 관객들 -->
      <div class="flex gap-2 text-2xl md:text-3xl">
        <span class="animate-bounce" style="animation-delay: 0s;">🐻</span>
        <span class="animate-bounce" style="animation-delay: 0.15s;">🐰</span>
        <span class="animate-bounce" style="animation-delay: 0.3s;">🐶</span>
        <span class="animate-bounce" style="animation-delay: 0.45s;">🐱</span>
      </div>
    `;
    container.appendChild(stageTop);

    // 2. 대형 리듬 패드 그리드 (각각 64px+ 이상의 거대한 터치 영역)
    const padGrid = document.createElement('div');
    padGrid.className =
      'w-full max-w-lg grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 my-auto z-10';

    const pads = [
      {
        emoji: '🚗',
        label: '부르릉~',
        color: 'from-amber-400 to-amber-500 border-amber-300',
        textColor: 'text-amber-950',
        action: () => ctx.audio.playEngineRev(),
      },
      {
        emoji: '📢',
        label: '빵! 빵!',
        color: 'from-blue-400 to-blue-500 border-blue-300',
        textColor: 'text-white',
        action: () => ctx.audio.playHorn(),
      },
      {
        emoji: '🚨',
        label: '삐뽀삐뽀',
        color: 'from-red-400 to-red-500 border-red-300',
        textColor: 'text-white',
        action: () => ctx.audio.playSiren(1),
      },
      {
        emoji: '🚂',
        label: '칙칙폭폭',
        color: 'from-purple-400 to-purple-500 border-purple-300',
        textColor: 'text-white',
        action: () => ctx.audio.playTrainWhistle(),
      },
      {
        emoji: '🚀',
        label: '슈우웅~!',
        color: 'from-pink-400 to-pink-500 border-pink-300',
        textColor: 'text-white',
        action: () => ctx.audio.playRocketBlast(),
      },
      {
        emoji: '🚜',
        label: '쿵덕쿵덕',
        color: 'from-emerald-400 to-emerald-500 border-emerald-300',
        textColor: 'text-white',
        action: () => ctx.audio.playExcavatorClank(),
      },
    ];

    let tapTotal = 0;

    pads.forEach((pad) => {
      const btn = document.createElement('button');
      btn.className = `h-28 md:h-32 rounded-3xl bg-gradient-to-b ${pad.color} border-4 shadow-xl flex flex-col items-center justify-center gap-1 active:scale-90 transition-transform cursor-pointer select-none`;

      btn.innerHTML = `
        <span class="text-4xl md:text-5xl drop-shadow">${pad.emoji}</span>
        <span class="text-lg md:text-xl font-black ${pad.textColor} tracking-wide">${pad.label}</span>
      `;

      btn.onclick = (e) => {
        e.stopPropagation();
        pad.action();
        ctx.audio.triggerHaptic(25);
        tapTotal++;

        // 10회 이상 신나게 두드리면 팡파레와 폭죽 보너스
        if (tapTotal % 12 === 0) {
          ctx.audio.playFanfare();
          triggerCelebrationConfetti();
        }
      };

      padGrid.appendChild(btn);
    });

    container.appendChild(padGrid);

    // 3. 하단 댄스 파티 팡파레 버튼
    const bottomBar = document.createElement('div');
    bottomBar.className = 'w-full max-w-lg flex justify-center py-2 z-10';

    const partyBtn = document.createElement('button');
    partyBtn.className =
      'px-8 h-18 rounded-3xl bg-yellow-400 hover:bg-yellow-500 active:scale-95 border-4 border-yellow-200 shadow-xl flex items-center gap-3 text-2xl font-black text-yellow-950 cursor-pointer select-none';
    partyBtn.innerHTML = '<span>🎉</span><span>다 같이 쿵짝쿵짝!</span>';
    partyBtn.onclick = () => {
      ctx.audio.playFanfare();
      triggerCelebrationConfetti();
      if (ctx.onComplete) ctx.onComplete();
    };

    bottomBar.appendChild(partyBtn);
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
