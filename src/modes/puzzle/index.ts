import { PlayMode, PlayModeContext } from '../types';
import { getVehicleById } from '../../core/vehicles';
import { triggerCelebrationConfetti } from '../../core/particles';

export const puzzleMode: PlayMode = {
  id: 'puzzle',
  title: '뚝딱뚝딱 조립하기',
  subtitle: '커다란 조각을 쏙쏙 맞춰요!',
  icon: '🧩',
  color: '#f59e0b',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    const vehicle = getVehicleById(ctx.vehicleId || 'fire-truck');

    const parts = [
      { id: 'body', label: '차체', icon: '🚙', placed: false },
      { id: 'wheels', label: '바퀴', icon: '🛞', placed: false },
      { id: 'siren', label: '사이렌', icon: '🚨', placed: false },
    ];

    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col items-center justify-between p-4 overflow-hidden bg-gradient-to-b from-amber-100 via-orange-50 to-yellow-100 select-none';

    // 1. 상단 안내
    const header = document.createElement('div');
    header.className =
      'w-full max-w-md flex items-center justify-between bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-full shadow-lg border-2 border-amber-300 z-10';
    header.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-3xl animate-bounce">🧩</span>
        <span class="font-black text-amber-900 text-lg md:text-xl">조각을 터치해 완성해요!</span>
      </div>
      <div id="puzzle-progress" class="font-black text-amber-600 text-lg">0 / 3</div>
    `;
    container.appendChild(header);

    // 2. 중앙 조립 도면 (자동차 실루엣)
    const stageArea = document.createElement('div');
    stageArea.className =
      'relative flex-1 w-full max-w-lg flex items-center justify-center my-2';

    const blueprint = document.createElement('div');
    blueprint.className =
      'relative w-72 h-48 md:w-96 md:h-64 rounded-3xl bg-blue-900/10 border-4 border-dashed border-blue-400/60 flex items-center justify-center shadow-inner overflow-hidden';

    blueprint.innerHTML = `
      <!-- 슬롯 1: 차체 (미배치 시 점선 실루엣) -->
      <div id="slot-body" class="absolute inset-0 flex items-center justify-center transition-all duration-300 opacity-20">
        <svg viewBox="0 0 320 200" class="w-full h-full">
          <path d="M 40 140 L 40 95 Q 40 75 60 75 L 110 75 L 150 35 Q 160 25 180 25 L 240 25 Q 260 25 270 45 L 290 95 L 300 110 Q 305 125 305 140 L 40 140 Z" fill="${vehicle.color}"/>
        </svg>
      </div>

      <!-- 슬롯 2: 사이렌 -->
      <div id="slot-siren" class="absolute top-4 left-1/2 transform -translate-x-1/2 text-4xl opacity-20 transition-all duration-300">
        🚨
      </div>

      <!-- 슬롯 3: 바퀴 -->
      <div id="slot-wheels" class="absolute bottom-4 inset-x-8 flex justify-between px-4 opacity-20 transition-all duration-300">
        <div class="w-14 h-14 rounded-full bg-slate-800 border-4 border-slate-600 flex items-center justify-center text-white text-xl">🛞</div>
        <div class="w-14 h-14 rounded-full bg-slate-800 border-4 border-slate-600 flex items-center justify-center text-white text-xl">🛞</div>
      </div>
    `;

    stageArea.appendChild(blueprint);
    container.appendChild(stageArea);

    // 3. 하단 거대 부품 버튼 트레이 (터치하기 쉬운 큼직한 퍼즐 조각)
    const piecesTray = document.createElement('div');
    piecesTray.className =
      'w-full max-w-md flex items-center justify-around py-3 px-4 bg-white/90 backdrop-blur-md rounded-3xl shadow-xl border-4 border-amber-200 z-10 mb-2';

    const updatePuzzleUI = () => {
      const placedCount = parts.filter((p) => p.placed).length;
      const progressEl = container.querySelector('#puzzle-progress');
      if (progressEl) progressEl.textContent = `${placedCount} / 3`;

      // 차체 배치
      const slotBody = container.querySelector('#slot-body') as HTMLElement;
      if (slotBody && parts.find((p) => p.id === 'body')?.placed) {
        slotBody.style.opacity = '1';
        slotBody.classList.add('animate-pop-wiggle');
      }

      // 사이렌 배치
      const slotSiren = container.querySelector('#slot-siren') as HTMLElement;
      if (slotSiren && parts.find((p) => p.id === 'siren')?.placed) {
        slotSiren.style.opacity = '1';
        slotSiren.classList.add('animate-bounce');
      }

      // 바퀴 배치
      const slotWheels = container.querySelector('#slot-wheels') as HTMLElement;
      if (slotWheels && parts.find((p) => p.id === 'wheels')?.placed) {
        slotWheels.style.opacity = '1';
        slotWheels.classList.add('animate-pop-wiggle');
      }

      // 3개 모두 완성되었을 때 축하!
      if (placedCount === 3) {
        blueprint.classList.remove('border-dashed', 'bg-blue-900/10');
        blueprint.classList.add('border-emerald-400', 'bg-emerald-100/40');
        setTimeout(() => {
          if (isCleanedUp) return;
          ctx.audio.playEngineRev();
          ctx.audio.playFanfare();
          triggerCelebrationConfetti();
          if (ctx.onComplete) ctx.onComplete();
        }, 300);
      }
    };

    parts.forEach((part) => {
      const pieceBtn = document.createElement('button');
      pieceBtn.className =
        'flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-90 border-4 border-amber-200 shadow-lg text-3xl font-black transition-all cursor-pointer select-none';
      pieceBtn.innerHTML = `<span>${part.icon}</span><span class="text-xs font-black text-amber-950">${part.label}</span>`;

      pieceBtn.onclick = () => {
        if (part.placed) {
          ctx.audio.playPop(600);
          return;
        }

        part.placed = true;
        pieceBtn.style.opacity = '0.3';
        pieceBtn.style.pointerEvents = 'none';

        ctx.audio.playStarChime();
        ctx.audio.triggerHaptic(30);

        updatePuzzleUI();
      };

      piecesTray.appendChild(pieceBtn);
    });

    container.appendChild(piecesTray);
    el.appendChild(container);

    return () => {
      isCleanedUp = true;
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};
