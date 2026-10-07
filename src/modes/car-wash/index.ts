import { PlayMode, PlayModeContext } from '../types';
import { VEHICLES, VehicleData } from '../../core/vehicles';
import { burst, triggerCelebrationConfetti } from '../../core/particles';

export const carWashMode: PlayMode = {
  id: 'car-wash',
  title: '보글보글 세차장',
  icon: '🧼',
  color: '#06b6d4',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;

    // 탈것 목록 인덱스
    let vehicleIndex = 0;
    let currentVehicle: VehicleData = VEHICLES[vehicleIndex];

    // 단계: 'mud' (진흙 닦아 거품내기) -> 'water' (물로 헹구기) -> 'celebrate' (무지개 팡파레) -> 'car-transition'
    let stage: 'mud' | 'water' | 'celebrate' | 'transition' = 'mud';

    // 8x6 진흙/거품 그리드 (총 48개 구역)
    const ROWS = 6;
    const COLS = 8;
    const TOTAL_CELLS = ROWS * COLS;

    let mudGrid: boolean[] = new Array(TOTAL_CELLS).fill(true);
    let bubbleGrid: boolean[] = new Array(TOTAL_CELLS).fill(false);

    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col justify-between items-center p-4 pt-20 overflow-hidden bg-gradient-to-b from-sky-300 via-cyan-100 to-blue-200 select-none touch-none';

    // 1. 상단 안내 헤더 & 단계 표시
    const header = document.createElement('div');
    header.className =
      'w-full max-w-md flex items-center justify-around bg-white/95 backdrop-blur-md py-2.5 px-5 rounded-3xl border-3 border-cyan-300 shadow-xl z-20';
    header.innerHTML = `
      <div id="step-badge-mud" class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 text-white font-black text-sm shadow">
        <span class="text-xl">🧽</span><span>1. 거품내기</span>
      </div>
      <span class="text-gray-400 font-black">➜</span>
      <div id="step-badge-water" class="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-400 font-black text-sm">
        <span class="text-xl">🚿</span><span>2. 물 헹구기</span>
      </div>
    `;
    container.appendChild(header);

    // 2. 대형 화려한 무지개 (완료 시 등장)
    const rainbowEl = document.createElement('div');
    rainbowEl.className =
      'absolute top-12 inset-x-0 h-44 flex items-center justify-center pointer-events-none transition-all duration-700 opacity-0 scale-75 z-10';
    rainbowEl.innerHTML = `
      <div class="relative w-80 md:w-96 h-40 overflow-hidden flex justify-center">
        <div class="w-72 md:w-88 h-72 md:h-88 rounded-full border-[14px] border-t-red-400 border-r-orange-400 border-b-transparent border-l-yellow-300 shadow-2xl animate-spin duration-10000" style="border-image: linear-gradient(to right, #ef4444, #f97316, #facc15, #10b981, #06b6d4, #8b5cf6) 1; border-radius: 9999px;"></div>
        <div class="absolute top-8 text-4xl animate-bounce">🌈 ✨ 🌈</div>
      </div>
    `;
    container.appendChild(rainbowEl);

    // 3. 중앙 세차장 무대 (자동차 + 진흙/거품 오버레이 레이어)
    const stageBay = document.createElement('div');
    stageBay.className =
      'relative flex-1 w-full max-w-xl flex items-center justify-center my-auto cursor-pointer touch-none';

    // 자동차 엘리먼트 래퍼
    const vehicleCard = document.createElement('div');
    vehicleCard.className =
      'vehicle-unit relative w-72 h-44 md:w-96 md:h-60 flex items-center justify-center transition-all duration-700 ease-out';

    // 자동차 그림 자리 (차가 바뀔 때 이 안만 교체)
    const svgHolder = document.createElement('div');
    svgHolder.className = 'absolute inset-0 flex items-center justify-center drop-shadow-2xl';
    vehicleCard.appendChild(svgHolder);

    // 진흙 & 거품 인터랙션 캔버스 (차 위에 겹쳐서 차와 함께 움직임)
    const canvas = document.createElement('canvas');
    canvas.className = 'absolute inset-0 w-full h-full z-20 pointer-events-none';
    const cCtx = canvas.getContext('2d')!;
    vehicleCard.appendChild(canvas);

    // 반짝반짝 광택 오버레이
    const sparkleOverlay = document.createElement('div');
    sparkleOverlay.className =
      'absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 transition-opacity duration-300 z-30 text-5xl md:text-6xl';
    sparkleOverlay.innerHTML = `<span class="animate-bounce">✨ 🌟 💖 🌟 ✨</span>`;

    stageBay.appendChild(vehicleCard);
    stageBay.appendChild(sparkleOverlay);
    container.appendChild(stageBay);

    // 4. 하단 진척도 & 가이드 문구 배지
    const footer = document.createElement('div');
    footer.className =
      'w-full max-w-md flex flex-col items-center gap-1.5 pb-2 z-20';
    footer.innerHTML = `
      <div id="progress-text" class="text-sm font-black text-sky-900 bg-white/90 px-4 py-1.5 rounded-full shadow border-2 border-white">
        손가락으로 흙을 슥슥 문질러 닦아줘요!
      </div>
      <div class="w-64 h-4 bg-white/80 rounded-full overflow-hidden p-0.5 border-2 border-cyan-300 shadow">
        <div id="progress-bar" class="h-full bg-cyan-500 rounded-full transition-all duration-200" style="width: 100%;"></div>
      </div>
    `;
    container.appendChild(footer);

    el.appendChild(container);

    // 자동차 그래픽 렌더
    const renderVehicle = (v: VehicleData) => {
      svgHolder.innerHTML = v.svg;
    };
    renderVehicle(currentVehicle);

    // 진흙/거품 오버레이 렌더 함수
    const renderOverlay = () => {
      if (isCleanedUp || !cCtx) return;
      cCtx.clearRect(0, 0, canvas.width, canvas.height);

      const cellW = canvas.width / COLS;
      const cellH = canvas.height / ROWS;

      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const idx = r * COLS + c;
          const x = c * cellW + cellW / 2;
          const y = r * cellH + cellH / 2;
          const radius = Math.min(cellW, cellH) * 0.7;

          // 진흙 얼룩
          if (mudGrid[idx]) {
            cCtx.beginPath();
            cCtx.ellipse(x, y, radius * 0.9, radius * 0.7, (idx % 4) * 0.4, 0, Math.PI * 2);
            cCtx.fillStyle = idx % 2 === 0 ? 'rgba(120, 53, 15, 0.88)' : 'rgba(146, 64, 14, 0.85)';
            cCtx.fill();
            // 진흙 작은 알갱이
            cCtx.beginPath();
            cCtx.arc(x - 5, y - 4, 3, 0, Math.PI * 2);
            cCtx.fillStyle = 'rgba(67, 20, 7, 0.7)';
            cCtx.fill();
          }

          // 거품
          if (bubbleGrid[idx]) {
            cCtx.beginPath();
            cCtx.arc(x, y, radius * 0.8, 0, Math.PI * 2);
            cCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
            cCtx.fill();
            cCtx.lineWidth = 2.5;
            cCtx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
            cCtx.stroke();
            // 거품 반사광
            cCtx.beginPath();
            cCtx.arc(x - radius * 0.28, y - radius * 0.28, radius * 0.22, 0, Math.PI * 2);
            cCtx.fillStyle = '#ffffff';
            cCtx.fill();
          }
        }
      }
    };
    // 캔버스 크기 조정 (renderOverlay 정의 뒤에 호출해야 함)
    const resizeCanvas = () => {
      canvas.width = vehicleCard.clientWidth || 288;
      canvas.height = vehicleCard.clientHeight || 176;
      renderOverlay();
    };
    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(vehicleCard);

    // 단계별 UI 및 안내 업데이트
    const updateStageBadges = () => {
      const badgeMud = container.querySelector('#step-badge-mud') as HTMLElement;
      const badgeWater = container.querySelector('#step-badge-water') as HTMLElement;
      const progText = container.querySelector('#progress-text') as HTMLElement;
      const progBar = container.querySelector('#progress-bar') as HTMLElement;

      if (!badgeMud || !badgeWater || !progText || !progBar) return;

      if (stage === 'mud') {
        badgeMud.className =
          'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500 text-white font-black text-sm shadow';
        badgeWater.className =
          'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-400 font-black text-sm';
        const remainingMud = mudGrid.filter(Boolean).length;
        const pct = Math.round((remainingMud / TOTAL_CELLS) * 100);
        progText.textContent = `흙을 문질러요! (남은 진흙: ${pct}%)`;
        progBar.style.width = `${pct}%`;
        progBar.className = 'h-full bg-amber-500 rounded-full transition-all duration-150';
      } else if (stage === 'water') {
        badgeMud.className =
          'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-gray-100 text-gray-400 font-black text-sm';
        badgeWater.className =
          'flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-cyan-500 text-white font-black text-sm shadow';
        const remainingBubbles = bubbleGrid.filter(Boolean).length;
        const pct = Math.round((remainingBubbles / TOTAL_CELLS) * 100);
        progText.textContent = `물로 촤아악 헹궈요! (남은 거품: ${pct}%)`;
        progBar.style.width = `${pct}%`;
        progBar.className = 'h-full bg-cyan-500 rounded-full transition-all duration-150';
      } else if (stage === 'celebrate') {
        progText.textContent = `우와! 반짝반짝 깨끗해졌어요! ✨`;
        progBar.style.width = `100%`;
        progBar.className = 'h-full bg-emerald-500 rounded-full transition-all duration-150';
      }
    };
    updateStageBadges();

    // 터치/드래그 문지르기 액션
    const handleScratch = (clientX: number, clientY: number) => {
      if (stage === 'celebrate' || stage === 'transition') return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      // 화면 좌표 → 캔버스 좌표 (차 주변을 살짝 벗어나도 닦이게 여유를 둠)
      const x = Math.max(0, Math.min(canvas.width - 1, ((clientX - rect.left) / rect.width) * canvas.width));
      const y = Math.max(0, Math.min(canvas.height - 1, ((clientY - rect.top) / rect.height) * canvas.height));
      const margin = 40;
      if (
        clientX < rect.left - margin ||
        clientX > rect.right + margin ||
        clientY < rect.top - margin ||
        clientY > rect.bottom + margin
      )
        return;

      const cellW = canvas.width / COLS;
      const cellH = canvas.height / ROWS;
      const c = Math.floor(x / cellW);
      const r = Math.floor(y / cellH);

      // 주변 셀까지 부드럽게 닦이도록 반경 1칸 적용
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            const idx = nr * COLS + nc;

            if (stage === 'mud') {
              if (mudGrid[idx]) {
                mudGrid[idx] = false;
                bubbleGrid[idx] = true; // 진흙이 닦이며 보글보글 거품 생성!
              }
            } else if (stage === 'water') {
              if (bubbleGrid[idx]) {
                bubbleGrid[idx] = false; // 물에 씻겨 내려감
              }
            }
          }
        }
      }

      renderOverlay();

      if (stage === 'mud') {
        if (ctx.audio.throttle('wash-bubble', 110)) {
          ctx.audio.playBubble();
          ctx.audio.triggerHaptic(15);
          burst(clientX, clientY, 'bubble', 3);
        }

        const remainingMudRatio = mudGrid.filter(Boolean).length / TOTAL_CELLS;
        updateStageBadges();

        // 12% 미만이면 다음 물 헹구기 단계로 전환
        if (remainingMudRatio < 0.12) {
          mudGrid.fill(false);
          renderOverlay();
          stage = 'water';
          ctx.audio.playDing();
          ctx.audio.speak('물로 깨끗하게 헹궈요!');
          updateStageBadges();
        }
      } else if (stage === 'water') {
        if (ctx.audio.throttle('wash-water', 160)) {
          ctx.audio.playWater();
          ctx.audio.triggerHaptic(20);
          burst(clientX, clientY, 'drop', 4);
        }

        const remainingBubbleRatio = bubbleGrid.filter(Boolean).length / TOTAL_CELLS;
        updateStageBadges();

        // 12% 미만이면 세차 완료 & 무지개 팡파레!
        if (remainingBubbleRatio < 0.12) {
          bubbleGrid.fill(false);
          renderOverlay();
          triggerFinishCelebration();
        }
      }
    };

    // 포인터 이벤트 바인딩 (PC 마우스 및 모바일 멀티터치 완벽 지원)
    let isPointerDown = false;

    const onPointerDown = (e: PointerEvent) => {
      isPointerDown = true;
      handleScratch(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isPointerDown) {
        handleScratch(e.clientX, e.clientY);
      }
    };

    const onPointerUp = () => {
      isPointerDown = false;
    };

    // 완료 축하 중 남은 타이머 정리용
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => !isCleanedUp && fn(), ms));
    };

    stageBay.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // 완료 축하 및 다른 차 입장 루프
    const triggerFinishCelebration = () => {
      stage = 'celebrate';
      updateStageBadges();

      // 1. 팡파레 & 컨페티 & 무지개 쫘악!
      ctx.audio.playFanfare();
      ctx.audio.speak('와아! 정말 반짝반짝 깨끗해졌어요!');
      triggerCelebrationConfetti();

      rainbowEl.style.opacity = '1';
      rainbowEl.style.transform = 'scale(1)';
      sparkleOverlay.style.opacity = '1';

      // 2. 1.8초 후 깨끗해진 차가 빵빵 울리며 오른쪽으로 퇴장
      later(() => {
        stage = 'transition';
        ctx.audio.playHorn();
        ctx.audio.playEngine();

        // 오른쪽으로 신나게 부르릉 출발
        vehicleCard.style.transform = 'translateX(120vw) rotate(4deg)';

        // 3. 차가 떠나고 새 차가 왼쪽에서 들어옴
        later(() => {
          // 다음 탈것으로 교체
          vehicleIndex = (vehicleIndex + 1) % VEHICLES.length;
          currentVehicle = VEHICLES[vehicleIndex];
          renderVehicle(currentVehicle);

          // 무지개 & 반짝이 숨김
          rainbowEl.style.opacity = '0';
          rainbowEl.style.transform = 'scale(0.75)';
          sparkleOverlay.style.opacity = '0';

          // 새로운 진흙으로 리셋
          mudGrid = new Array(TOTAL_CELLS).fill(true);
          bubbleGrid = new Array(TOTAL_CELLS).fill(false);
          renderOverlay();

          // 왼쪽 밖에서 스르륵 제자리로 진입
          vehicleCard.style.transition = 'none';
          vehicleCard.style.transform = 'translateX(-120vw) rotate(-4deg)';

          later(() => {
            vehicleCard.style.transition = 'transform 0.7s ease-out';
            vehicleCard.style.transform = 'translateX(0) rotate(0deg)';

            stage = 'mud';
            updateStageBadges();
            ctx.audio.playDing(880);
            ctx.audio.speak(`새로운 ${currentVehicle.name}${hasBatchim(currentVehicle.name) ? '이' : '가'} 왔어요! 깨끗이 씻어줄까요?`);
          }, 80);
        }, 800);
      }, 2000);
    };

    return () => {
      isCleanedUp = true;
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      stageBay.removeEventListener('pointerdown', onPointerDown);
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};

// 한글 받침 여부 (이/가 조사 선택)
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}
