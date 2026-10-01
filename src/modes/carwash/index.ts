import { PlayMode, PlayModeContext } from '../types';
import { getVehicleById } from '../../core/vehicles';
import { triggerCelebrationConfetti } from '../../core/particles';

export const carWashMode: PlayMode = {
  id: 'carwash',
  title: '보글보글 세차장',
  subtitle: '흙 묻은 자동차를 깨끗이 씻어요!',
  icon: '🧼',
  color: '#06b6d4',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    const vehicle = getVehicleById(ctx.vehicleId || 'fire-truck');

    // 단계: 0 = 거품 스펀지, 1 = 물 호스, 2 = 반짝 드라이어, 3 = 완성
    let currentTool: 'sponge' | 'water' | 'dryer' = 'sponge';
    let dirtLevel = 100; // 0이 되면 다음 단계
    let bubbleCount = 0;
    let isSparkling = false;

    // DOM 구조 생성
    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col items-center justify-between p-4 overflow-hidden bg-gradient-to-b from-sky-200 via-cyan-100 to-blue-200 select-none';

    // 1. 상단 단계 가이드 (글자를 몰라도 그림으로 알 수 있게 큰 아이콘 표시)
    const headerGuide = document.createElement('div');
    headerGuide.className =
      'w-full max-w-md flex items-center justify-around bg-white/80 backdrop-blur-md px-4 py-2.5 rounded-full shadow-lg border-2 border-white/60 z-20';
    headerGuide.innerHTML = `
      <div id="step-sponge" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500 text-white font-black text-sm shadow">
        <span class="text-xl">🧽</span><span>거품 뽀글</span>
      </div>
      <span class="text-gray-400 font-bold">➜</span>
      <div id="step-water" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 font-black text-sm">
        <span class="text-xl">🚿</span><span>물 촤아악</span>
      </div>
      <span class="text-gray-400 font-bold">➜</span>
      <div id="step-dryer" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-500 font-black text-sm">
        <span class="text-xl">✨</span><span>반짝 말리기</span>
      </div>
    `;
    container.appendChild(headerGuide);

    // 2. 세차 구역 (중앙 자동차 + 오물/거품/광택 오버레이)
    const washBay = document.createElement('div');
    washBay.className =
      'relative flex-1 w-full max-w-xl flex items-center justify-center my-2 cursor-pointer touch-none';

    // 자동차 그림 (SVG로 큼직하고 선명하게 렌더링)
    const vehicleWrapper = document.createElement('div');
    vehicleWrapper.className =
      'relative w-72 h-48 md:w-96 md:h-64 flex items-center justify-center transition-transform active:scale-95 duration-150';

    vehicleWrapper.innerHTML = `
      <svg viewBox="0 0 320 200" class="w-full h-full drop-shadow-2xl">
        <!-- 그림자 -->
        <ellipse cx="160" cy="180" rx="130" ry="14" fill="#000000" opacity="0.18"/>
        <!-- 차체 -->
        <path d="M 40 140 L 40 95 Q 40 75 60 75 L 110 75 L 150 35 Q 160 25 180 25 L 240 25 Q 260 25 270 45 L 290 95 L 300 110 Q 305 125 305 140 L 40 140 Z" fill="${vehicle.color}"/>
        <!-- 하부 범퍼 -->
        <rect x="35" y="130" width="275" height="18" rx="8" fill="${vehicle.accentColor}"/>
        <!-- 창문 -->
        <path d="M 125 72 L 155 38 L 210 38 L 210 72 Z" fill="#e0f2fe" opacity="0.9"/>
        <path d="M 220 38 L 250 38 L 270 72 L 220 72 Z" fill="#e0f2fe" opacity="0.9"/>
        <!-- 눈망울 (귀여운 캐릭터 눈) -->
        <circle cx="280" cy="115" r="14" fill="#ffffff"/>
        <circle cx="284" cy="115" r="7" fill="#1e293b"/>
        <circle cx="286" cy="112" r="2.5" fill="#ffffff"/>
        <!-- 미소 입 -->
        <path d="M 285 130 Q 295 136 300 128" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round"/>
        <!-- 바퀴 -->
        <circle cx="85" cy="150" r="28" fill="#1e293b"/>
        <circle cx="85" cy="150" r="15" fill="#94a3b8"/>
        <circle cx="85" cy="150" r="6" fill="#f8fafc"/>
        <circle cx="235" cy="150" r="28" fill="#1e293b"/>
        <circle cx="235" cy="150" r="15" fill="#94a3b8"/>
        <circle cx="235" cy="150" r="6" fill="#f8fafc"/>
        <!-- 사이렌 (비상차량일 경우) -->
        ${
          vehicle.soundType === 'fire' || vehicle.soundType === 'police'
            ? `<rect x="180" y="12" width="30" height="15" rx="5" fill="#ef4444"/>
               <circle cx="195" cy="19" r="4" fill="#67e8f9"/>`
            : ''
        }
      </svg>
    `;

    // 흙 레이어 (얼룩덜룩 진흙 스플래시)
    const mudLayer = document.createElement('div');
    mudLayer.className =
      'absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300';
    mudLayer.innerHTML = `
      <div id="mud-splatters" class="relative w-72 h-44 md:w-88 md:h-56">
        <div class="absolute top-8 left-12 w-14 h-12 bg-amber-800/80 rounded-full blur-[1px]"></div>
        <div class="absolute top-14 left-28 w-20 h-16 bg-amber-900/85 rounded-full blur-[1px]"></div>
        <div class="absolute bottom-12 left-20 w-16 h-12 bg-amber-800/80 rounded-full blur-[1px]"></div>
        <div class="absolute top-10 right-20 w-16 h-14 bg-amber-900/85 rounded-full blur-[1px]"></div>
        <div class="absolute bottom-16 right-16 w-24 h-16 bg-amber-800/85 rounded-full blur-[1px]"></div>
        <div class="absolute bottom-8 right-32 w-12 h-10 bg-amber-900/75 rounded-full blur-[1px]"></div>
      </div>
    `;

    // 거품 캔버스 레이어
    const bubbleCanvas = document.createElement('canvas');
    bubbleCanvas.className = 'absolute inset-0 w-full h-full pointer-events-none';
    const bCtx = bubbleCanvas.getContext('2d');

    // 반짝이 완성 오버레이
    const sparkleOverlay = document.createElement('div');
    sparkleOverlay.className =
      'absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-500 text-6xl';
    sparkleOverlay.innerHTML = `
      <div class="animate-bounce text-5xl md:text-7xl">✨ 🌟 ✨</div>
    `;

    washBay.appendChild(vehicleWrapper);
    washBay.appendChild(mudLayer);
    washBay.appendChild(bubbleCanvas);
    washBay.appendChild(sparkleOverlay);
    container.appendChild(washBay);

    // 3. 하단 도구 선택 바 (스펀지, 물대포, 헤어드라이어)
    const toolBar = document.createElement('div');
    toolBar.className =
      'w-full max-w-lg flex items-center justify-around py-3 px-4 bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl border-4 border-cyan-100 z-30 mb-2';

    const createToolBtn = (
      type: 'sponge' | 'water' | 'dryer',
      emoji: string,
      label: string,
      bgActive: string
    ) => {
      const btn = document.createElement('button');
      btn.className = `flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl font-black text-xs md:text-sm transition-all duration-150 border-4 cursor-pointer select-none ${
        currentTool === type
          ? `${bgActive} text-white scale-110 shadow-lg border-white ring-4 ring-cyan-300`
          : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'
      }`;
      btn.innerHTML = `<span class="text-3xl md:text-4xl mb-0.5">${emoji}</span><span>${label}</span>`;
      btn.onclick = () => {
        currentTool = type;
        ctx.audio.playPop(550);
        ctx.audio.triggerHaptic(20);
        updateToolUI();
      };
      return btn;
    };

    let spongeBtn: HTMLButtonElement;
    let waterBtn: HTMLButtonElement;
    let dryerBtn: HTMLButtonElement;

    const renderToolButtons = () => {
      toolBar.innerHTML = '';
      spongeBtn = createToolBtn('sponge', '🧽', '거품내기', 'bg-cyan-500');
      waterBtn = createToolBtn('water', '🚿', '물뿌리기', 'bg-blue-500');
      dryerBtn = createToolBtn('dryer', '✨', '반짝말리기', 'bg-amber-400');

      toolBar.appendChild(spongeBtn);
      toolBar.appendChild(waterBtn);
      toolBar.appendChild(dryerBtn);
    };

    renderToolButtons();
    container.appendChild(toolBar);
    el.appendChild(container);

    const updateToolUI = () => {
      renderToolButtons();

      const stepSponge = container.querySelector('#step-sponge') as HTMLElement;
      const stepWater = container.querySelector('#step-water') as HTMLElement;
      const stepDryer = container.querySelector('#step-dryer') as HTMLElement;

      if (stepSponge && stepWater && stepDryer) {
        stepSponge.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm shadow ${
          currentTool === 'sponge' ? 'bg-cyan-500 text-white' : 'bg-gray-100 text-gray-500'
        }`;
        stepWater.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm shadow ${
          currentTool === 'water' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-500'
        }`;
        stepDryer.className = `flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm shadow ${
          currentTool === 'dryer' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
        }`;
      }
    };

    // 캔버스 크기 맞춤
    const resizeCanvas = () => {
      bubbleCanvas.width = washBay.clientWidth;
      bubbleCanvas.height = washBay.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 인터랙션: 자동차를 손으로 슥슥 문지르면 도구에 따라 거품/물/광택 발동
    const bubbles: Array<{ x: number; y: number; r: number; alpha: number }> = [];

    const handlePointerAction = (e: PointerEvent) => {
      const rect = washBay.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (currentTool === 'sponge') {
        // 거품 생성 + 흙 지우기
        ctx.audio.playBubble();
        ctx.audio.triggerHaptic(15);
        bubbleCount++;
        dirtLevel = Math.max(0, dirtLevel - 4);
        mudLayer.style.opacity = (dirtLevel / 100).toString();

        for (let i = 0; i < 4; i++) {
          bubbles.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 40,
            r: Math.random() * 18 + 10,
            alpha: 0.85,
          });
        }

        if (dirtLevel === 0 && currentTool === 'sponge') {
          // 다음 도구(물)로 자연스럽게 유도
          setTimeout(() => {
            currentTool = 'water';
            updateToolUI();
            ctx.audio.playStarChime();
          }, 400);
        }
      } else if (currentTool === 'water') {
        // 물대포로 거품 씻어내기
        ctx.audio.playWaterSplash();
        ctx.audio.triggerHaptic(25);

        // 거품 축소 및 제거
        for (let i = 0; i < bubbles.length; i++) {
          const dx = bubbles[i].x - x;
          const dy = bubbles[i].y - y;
          if (Math.hypot(dx, dy) < 80) {
            bubbles[i].alpha = Math.max(0, bubbles[i].alpha - 0.35);
          }
        }

        const remainingBubbles = bubbles.filter((b) => b.alpha > 0.1);
        if (remainingBubbles.length <= 5 && bubbleCount > 10) {
          setTimeout(() => {
            currentTool = 'dryer';
            updateToolUI();
            ctx.audio.playStarChime();
          }, 500);
        }
      } else if (currentTool === 'dryer') {
        // 반짝이 말리기
        ctx.audio.playPop(750 + Math.random() * 150);
        ctx.audio.triggerHaptic(20);

        if (!isSparkling) {
          isSparkling = true;
          sparkleOverlay.style.opacity = '1';
          ctx.audio.playFanfare();
          triggerCelebrationConfetti();
          if (ctx.onComplete) ctx.onComplete();
        }
      }
    };

    washBay.addEventListener('pointerdown', handlePointerAction);
    washBay.addEventListener('pointermove', (e) => {
      if (e.buttons === 1) handlePointerAction(e);
    });

    // 거품 렌더 루프
    let loopId: number | null = null;
    const renderLoop = () => {
      if (isCleanedUp || !bCtx) return;
      bCtx.clearRect(0, 0, bubbleCanvas.width, bubbleCanvas.height);

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        if (b.alpha <= 0) {
          bubbles.splice(i, 1);
          continue;
        }

        bCtx.save();
        bCtx.globalAlpha = b.alpha;
        bCtx.beginPath();
        bCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        bCtx.fillStyle = '#ffffff';
        bCtx.fill();
        bCtx.lineWidth = 2.5;
        bCtx.strokeStyle = '#38bdf8';
        bCtx.stroke();

        // 거품 하이라이트
        bCtx.beginPath();
        bCtx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.25, 0, Math.PI * 2);
        bCtx.fillStyle = '#ffffff';
        bCtx.fill();
        bCtx.restore();
      }

      loopId = requestAnimationFrame(renderLoop);
    };
    loopId = requestAnimationFrame(renderLoop);

    return () => {
      isCleanedUp = true;
      if (loopId !== null) cancelAnimationFrame(loopId);
      window.removeEventListener('resize', resizeCanvas);
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};
