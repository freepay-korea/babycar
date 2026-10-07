import { PlayMode, PlayModeContext } from '../types';
import { getCombinedVehicles, VehicleData } from '../../core/vehicles';
import { useAppStore } from '../../core/store';
import { burst } from '../../core/particles';

export const soundBookMode: PlayMode = {
  id: 'sound-book',
  title: '탈것 소리 도감',
  icon: '🔊',
  color: '#f59e0b',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;

    const container = document.createElement('div');
    container.className =
      'w-full h-full flex flex-col p-4 pt-24 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-amber-200 via-orange-100 to-yellow-100 select-none';
    // 전역 touch-action:none 때문에 막힌 세로 스크롤을 이 화면에서만 허용
    container.style.touchAction = 'pan-y';

    // 1. 상단 안내 헤더 배지
    const header = document.createElement('div');
    header.className =
      'w-full max-w-lg mx-auto flex items-center justify-center gap-2 bg-white/90 backdrop-blur-md py-2.5 px-6 rounded-3xl border-3 border-amber-300 shadow-md mb-3';
    header.innerHTML = `
      <span class="text-3xl animate-bounce">🎵</span>
      <span class="font-black text-amber-950 text-xl md:text-2xl">탈것을 누르면 소리가 나요!</span>
    `;
    container.appendChild(header);

    // 2. 탈것 카드 그리드 (기본 탈것 + 차고에서 만든 내 차)
    const grid = document.createElement('div');
    grid.className =
      'w-full max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5 pb-6';

    const customCars = useAppStore.getState().customCars || [];
    const allVehicles = getCombinedVehicles(customCars);

    allVehicles.forEach((v: VehicleData) => {
      const card = document.createElement('div');
      card.className =
        'relative min-h-[160px] md:min-h-[190px] rounded-3xl p-4 bg-white/95 backdrop-blur-md border-4 shadow-xl flex flex-col items-center justify-between cursor-pointer active:scale-95 transition-all duration-200 overflow-hidden';
      card.style.borderColor = v.bgColor;

      // 눈 달린 귀여운 차 얼굴 SVG 생성
      const vehicleSvgWithEyes = createVehicleWithCuteFace(v);

      card.innerHTML = `
        <!-- 탈것 무대 영역 -->
        <div class="vehicle-stage relative w-full h-24 md:h-28 flex items-center justify-center">
          <div class="vehicle-actor w-full h-full transition-transform duration-300 pointer-events-none">
            ${vehicleSvgWithEyes}
          </div>
        </div>

        <!-- 하단 이름 및 소리 배지 -->
        <div class="w-full flex items-center justify-between pt-2 border-t-2 border-dashed border-gray-100">
          <span class="font-black text-lg md:text-xl text-gray-900">${v.name}</span>
          <span class="px-3 py-1 rounded-full text-xs font-black text-white shadow-sm flex items-center gap-1" style="background-color: ${v.bgColor}">
            <span>🔊</span> 소리 듣기
          </span>
        </div>
      `;

      // 탭 이벤트 핸들러
      const actor = card.querySelector('.vehicle-actor') as HTMLElement;
      let isAnimating = false;

      // 스크롤하려고 끌 때는 소리가 나지 않도록 '짧게 누름'일 때만 반응
      let downX = 0;
      let downY = 0;
      card.addEventListener('pointerdown', (e) => {
        downX = e.clientX;
        downY = e.clientY;
        ctx.audio.playPop(520); // 100ms 안에 즉시 반응
      });
      card.addEventListener('pointerup', (e) => {
        if (isCleanedUp) return;
        if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) return;
        e.stopPropagation();

        // 1. 햅틱
        ctx.audio.triggerHaptic(30);

        // 2. 탈것 고유 소리 재생
        ctx.audio.play(v.sound);

        // 3. 한국어 TTS 음성 안내
        ctx.audio.speak(v.voiceText);

        // 4. 화면 터치 위치에 화려한 파티클 버스트 (별 + 연기)
        burst(e.clientX, e.clientY, 'star', 10);
        burst(e.clientX, e.clientY, 'smoke', 6);

        // 5. 탈것 고유 애니메이션 실행
        if (isAnimating || !actor) return;
        isAnimating = true;

        playVehicleSpecificAnimation(v.id, actor, card, () => {
          isAnimating = false;
        });
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
    el.appendChild(container);

    return () => {
      isCleanedUp = true;
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};

// 탈것별 특화 애니메이션 (달리기, 날기, 땅파기 등)
function playVehicleSpecificAnimation(
  id: string,
  actor: HTMLElement,
  card: HTMLElement,
  onDone: () => void
) {
  // 바퀴 회전 (정비소에서 만든 차의 바퀴 그룹)
  const wheels = actor.querySelectorAll('.vehicle-wheel');
  wheels.forEach((w) => w.classList.add('animate-spin'));

  if (id === 'helicopter') {
    // 헬리콥터: 프로펠러 고속 회전 + 위로 붕 떠오르며 하늘 날기
    actor.style.transform = 'translateY(-24px) scale(1.1) rotate(6deg)';
    setTimeout(() => {
      actor.style.transform = 'translateY(-28px) scale(1.15) rotate(-6deg)';
    }, 250);
    setTimeout(() => {
      actor.style.transform = 'translateY(0) scale(1) rotate(0deg)';
      wheels.forEach((w) => w.classList.remove('animate-spin'));
      onDone();
    }, 700);
  } else if (id === 'excavator') {
    // 포크레인: 차체가 기우뚱하며 으랏차차 흙 파기 모션
    actor.style.transform = 'rotate(-12deg) scale(1.1)';
    setTimeout(() => {
      actor.style.transform = 'rotate(15deg) translateY(6px) scale(1.1)';
    }, 280);
    setTimeout(() => {
      actor.style.transform = 'rotate(0deg) translateY(0) scale(1)';
      wheels.forEach((w) => w.classList.remove('animate-spin'));
      onDone();
    }, 650);
  } else if (id === 'train') {
    // 기차: 덜컹덜컹 리드미컬하게 바운스하며 전진
    actor.style.transform = 'translateX(18px) translateY(-8px)';
    setTimeout(() => {
      actor.style.transform = 'translateX(-12px) translateY(4px)';
    }, 220);
    setTimeout(() => {
      actor.style.transform = 'translateX(0) translateY(0)';
      wheels.forEach((w) => w.classList.remove('animate-spin'));
      onDone();
    }, 600);
  } else {
    // 소방차, 경찰차, 버스: 좌우로 쌩쌩 달리기 + 통통 튀기
    actor.style.transform = 'translateX(25px) scale(1.08) rotate(3deg)';
    setTimeout(() => {
      actor.style.transform = 'translateX(-15px) scale(1.05) rotate(-2deg)';
    }, 220);
    setTimeout(() => {
      actor.style.transform = 'translateX(0) scale(1) rotate(0deg)';
      wheels.forEach((w) => w.classList.remove('animate-spin'));
      onDone();
    }, 550);
  }

  // 카드 본체 통통 튀기기
  card.classList.add('ring-4', 'ring-amber-300', 'shadow-2xl');
  setTimeout(() => {
    card.classList.remove('ring-4', 'ring-amber-300', 'shadow-2xl');
  }, 400);
}

// 탈것마다 얼굴(눈·입)이 놓일 자리 (viewBox 160x100 기준)
const FACE_POS: Record<string, { x: number; y: number; r?: number }> = {
  'fire-truck': { x: 118, y: 39 },
  'police-car': { x: 112, y: 47, r: 5 },
  bus: { x: 117, y: 41 },
  excavator: { x: 53, y: 50, r: 5 },
  train: { x: 40, y: 39, r: 5 },
  helicopter: { x: 97, y: 46, r: 5 },
};

// 눈 달린 귀여운 차 얼굴 SVG
function createVehicleWithCuteFace(v: VehicleData): string {
  // 정비소에서 만든 차는 이미 눈이 있으므로 그대로 사용
  if (v.isCustom) return v.svg;

  const inner = v.svg.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const pos = FACE_POS[v.id] || { x: 117, y: 41 };
  const r = pos.r ?? 6;
  const gap = r + 3;
  const eye = (cx: number) => `
        <circle cx="${cx}" cy="${pos.y}" r="${r}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
        <circle cx="${cx + r * 0.3}" cy="${pos.y}" r="${r * 0.58}" fill="#0f172a"/>
        <circle cx="${cx + r * 0.5}" cy="${pos.y - r * 0.25}" r="${r * 0.22}" fill="#ffffff"/>`;

  return `
    <svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      ${inner}
      <g class="cute-face">
        ${eye(pos.x - gap)}
        ${eye(pos.x + gap)}
        <circle cx="${pos.x - gap - r}" cy="${pos.y + r + 2}" r="${r * 0.55}" fill="#f43f5e" opacity="0.55"/>
        <circle cx="${pos.x + gap + r}" cy="${pos.y + r + 2}" r="${r * 0.55}" fill="#f43f5e" opacity="0.55"/>
        <path d="M ${pos.x - 4} ${pos.y + r + 1} Q ${pos.x} ${pos.y + r + 6} ${pos.x + 4} ${pos.y + r + 1}" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}
