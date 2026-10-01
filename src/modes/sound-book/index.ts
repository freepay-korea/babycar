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
      'w-full h-full flex flex-col justify-between p-4 pt-20 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-amber-200 via-orange-100 to-yellow-100 select-none';

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

      card.addEventListener('pointerdown', (e) => {
        e.stopPropagation();

        // 1. 즉각적인 팝 사운드 + 햅틱
        ctx.audio.playPop(520);
        ctx.audio.triggerHaptic(30);

        // 2. 탈것 고유 소리 재생
        ctx.audio.play(v.sound);

        // 3. 한국어 TTS 음성 안내
        ctx.audio.speak(v.voiceText);

        // 4. 화면 터치 위치에 화려한 파티클 버스트 (별 + 연기)
        const rect = card.getBoundingClientRect();
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
  // 바퀴 회전 클래스 활성화
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

// 눈 달린 귀여운 차 얼굴 SVG
function createVehicleWithCuteFace(v: VehicleData): string {
  // SVG 내부에 깜찍한 눈과 미소 입 추가
  return `
    <svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 기존 탈것 본체 -->
      ${v.svg.replace('<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">', '').replace('</svg>', '')}
      
      <!-- 눈 달린 귀여운 캐릭터 얼굴 -->
      <g class="cute-face">
        <!-- 왼쪽 눈 (흰자 + 반짝이는 눈동자) -->
        <circle cx="108" cy="40" r="7" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
        <circle cx="110" cy="40" r="4" fill="#0f172a"/>
        <circle cx="111.5" cy="38.5" r="1.5" fill="#ffffff"/>
        
        <!-- 오른쪽 눈 -->
        <circle cx="126" cy="40" r="7" fill="#ffffff" stroke="#1e293b" stroke-width="1.5"/>
        <circle cx="128" cy="40" r="4" fill="#0f172a"/>
        <circle cx="129.5" cy="38.5" r="1.5" fill="#ffffff"/>

        <!-- 발그레 볼터치 -->
        <circle cx="102" cy="48" r="4" fill="#f43f5e" opacity="0.6"/>
        <circle cx="132" cy="48" r="4" fill="#f43f5e" opacity="0.6"/>

        <!-- 방긋 미소 입 -->
        <path d="M 113 46 Q 117 52 121 46" stroke="#0f172a" stroke-width="2" fill="none" stroke-linecap="round"/>
      </g>
    </svg>
  `;
}
