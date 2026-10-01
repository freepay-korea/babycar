import { PlayMode, PlayModeContext } from '../types';
import { useAppStore, CarDesign, StickerPlacement } from '../../core/store';
import { burst, triggerCelebrationConfetti } from '../../core/particles';

type GarageStep = 'body' | 'wheels' | 'colors' | 'stickers' | 'drive';

type BodyType = 'sedan' | 'truck' | 'bus' | 'sportscar' | 'fire-truck';
type WheelType = 'standard' | 'monster' | 'lightning' | 'flower';
type CarPart = 'body' | 'roof' | 'bumper';

const PALETTE = [
  '#ef4444', // 빨강
  '#f97316', // 주황
  '#facc15', // 노랑
  '#10b981', // 초록
  '#3b82f6', // 파랑
  '#8b5cf6', // 보라
  '#ec4899', // 분홍
  '#1e293b', // 검정
];

const STICKER_LIST = ['⭐', '⚡', '💖', '🔥', '1️⃣', '3️⃣', '7️⃣', '👑', '🌈', '🚀'];

export const garageMode: PlayMode = {
  id: 'garage',
  title: '자동차 정비소',
  icon: '🔧',
  color: '#f59e0b',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;

    // 현재 커스텀 차량 상태
    let step: GarageStep = 'body';
    let selectedBody: BodyType = 'sedan';
    let selectedWheels: WheelType = 'standard';
    let colors = {
      body: '#3b82f6',
      roof: '#60a5fa',
      bumper: '#1e293b',
    };
    let activePaletteColor = '#ef4444';
    let stickers: StickerPlacement[] = [];
    let isDrillSpinning = false;
    let isDriving = false;

    const container = document.createElement('div');
    container.className =
      'relative w-full h-full flex flex-col justify-between items-center p-3 pt-20 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-amber-100 via-orange-50 to-yellow-100 select-none';

    // 1. 상단 단계 표시줄 (차체 - 바퀴 - 색 - 스티커 - 주행)
    const stepperContainer = document.createElement('div');
    stepperContainer.className =
      'w-full max-w-xl mx-auto flex items-center justify-between bg-white/95 backdrop-blur-md px-3 py-2 rounded-3xl border-3 border-amber-300 shadow-xl mb-2 z-20';

    const steps: Array<{ key: GarageStep; label: string; icon: string }> = [
      { key: 'body', label: '차체', icon: '🚙' },
      { key: 'wheels', label: '바퀴', icon: '🛞' },
      { key: 'colors', label: '색칠', icon: '🎨' },
      { key: 'stickers', label: '스티커', icon: '⭐' },
      { key: 'drive', label: '시험주행', icon: '🚀' },
    ];

    const renderStepper = () => {
      stepperContainer.innerHTML = '';
      steps.forEach((s, idx) => {
        const isCurrent = step === s.key;
        const btn = document.createElement('button');
        btn.className = `flex items-center gap-1 px-2.5 py-1.5 rounded-2xl font-black transition-all cursor-pointer ${
          isCurrent
            ? 'bg-amber-400 text-amber-950 scale-110 shadow-md ring-3 ring-amber-200 text-sm md:text-base'
            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 text-xs md:text-sm'
        }`;
        btn.innerHTML = `<span class="text-base md:text-xl">${s.icon}</span><span>${s.label}</span>`;
        btn.onclick = () => {
          step = s.key;
          ctx.audio.playPop(550);
          ctx.audio.speak(s.label);
          updateAllUI();
        };
        stepperContainer.appendChild(btn);

        if (idx < steps.length - 1) {
          const arrow = document.createElement('span');
          arrow.className = 'text-gray-300 font-bold text-xs';
          arrow.textContent = '>';
          stepperContainer.appendChild(arrow);
        }
      });
    };
    renderStepper();
    container.appendChild(stepperContainer);

    // 2. 중앙 메인 작업대 (자동차 뷰포트)
    const garageBay = document.createElement('div');
    garageBay.className =
      'relative flex-1 w-full max-w-2xl flex items-center justify-center my-auto min-h-[220px]';

    const carWrapper = document.createElement('div');
    carWrapper.className =
      'car-display relative w-72 h-44 md:w-96 md:h-56 flex items-center justify-center transition-all duration-300';
    garageBay.appendChild(carWrapper);
    container.appendChild(garageBay);

    // 3. 하단 단계별 컨트롤 패널
    const panelContainer = document.createElement('div');
    panelContainer.className =
      'w-full max-w-2xl bg-white/95 backdrop-blur-md rounded-3xl border-3 border-amber-300 shadow-2xl p-3 md:p-4 mb-2 z-20 flex flex-col gap-2';
    container.appendChild(panelContainer);

    el.appendChild(container);

    // ==================================================
    // 차체 SVG 생성기 (부위별 분할: body, roof, bumper, wheelSlots)
    // ==================================================
    const getCarSvg = () => {
      let bodyPath = '';
      let roofPath = '';
      let bumperPath = '';
      let windowPath = '';
      const wY = 76;
      const wR = selectedWheels === 'monster' ? 18 : 13;

      if (selectedBody === 'sedan') {
        bodyPath = 'M 20 62 L 20 48 Q 20 42 28 42 L 50 42 L 68 24 Q 74 20 84 20 L 115 20 Q 124 20 128 28 L 138 48 L 144 52 Q 148 56 148 64 L 148 72 L 20 72 Z';
        roofPath = 'M 65 24 L 118 24 Q 126 24 130 32 L 138 46 L 52 46 Z';
        bumperPath = 'M 18 64 L 150 64 L 150 74 L 18 74 Z';
        windowPath = '<path d="M 68 38 L 78 26 L 96 26 L 96 38 Z" fill="#e0f2fe"/><path d="M 102 26 L 114 26 L 122 38 L 102 38 Z" fill="#e0f2fe"/>';
      } else if (selectedBody === 'truck') {
        bodyPath = 'M 20 62 L 20 32 L 85 32 L 85 44 L 115 44 L 135 44 Q 144 44 146 54 L 146 72 L 20 72 Z';
        roofPath = 'M 88 32 L 130 32 Q 138 32 142 42 L 144 46 L 88 46 Z';
        bumperPath = 'M 16 66 L 150 66 L 150 74 L 16 74 Z';
        windowPath = '<rect x="96" y="36" width="34" height="14" rx="3" fill="#e0f2fe"/>';
      } else if (selectedBody === 'bus') {
        bodyPath = 'M 20 64 L 20 26 Q 20 22 26 22 L 138 22 Q 144 22 144 28 L 144 72 L 20 72 Z';
        roofPath = 'M 20 22 L 144 22 L 144 32 L 20 32 Z';
        bumperPath = 'M 18 64 L 146 64 L 146 74 L 18 74 Z';
        windowPath = '<rect x="30" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/><rect x="56" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/><rect x="82" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/><rect x="108" y="32" width="24" height="18" rx="4" fill="#e0f2fe"/>';
      } else if (selectedBody === 'sportscar') {
        bodyPath = 'M 18 64 L 18 52 Q 18 46 26 46 L 50 46 L 76 28 Q 84 24 96 24 L 122 24 Q 134 24 140 36 L 150 50 L 154 58 Q 154 66 150 72 L 18 72 Z';
        roofPath = 'M 72 28 L 126 28 Q 134 28 140 38 L 146 48 L 60 48 Z';
        bumperPath = 'M 16 66 L 156 66 L 156 74 L 16 74 Z';
        windowPath = '<path d="M 78 38 L 90 28 L 112 28 L 118 38 Z" fill="#bae6fd"/>';
      } else {
        // fire-truck
        bodyPath = 'M 20 64 L 20 24 L 138 24 Q 144 24 144 30 L 144 72 L 20 72 Z';
        roofPath = 'M 40 16 L 110 16 L 110 24 L 40 24 Z';
        bumperPath = 'M 18 52 L 146 52 L 146 60 L 18 60 Z';
        windowPath = '<rect x="96" y="28" width="36" height="18" rx="3" fill="#bae6fd"/>';
      }

      // 바퀴 그래픽
      const getWheelSvg = (cx: number) => {
        const spinClass = isDrillSpinning || isDriving ? 'animate-spin' : '';
        if (selectedWheels === 'monster') {
          return `
            <g class="vehicle-wheel ${spinClass}" style="transform-origin: ${cx}px ${wY}px;">
              <circle cx="${cx}" cy="${wY}" r="${wR}" fill="#0f172a"/>
              <circle cx="${cx}" cy="${wY}" r="9" fill="#e2e8f0"/>
              <circle cx="${cx}" cy="${wY}" r="4" fill="#f59e0b"/>
              <path d="M ${cx - 16} ${wY} L ${cx + 16} ${wY} M ${cx} ${wY - 16} L ${cx} ${wY + 16}" stroke="#0f172a" stroke-width="3"/>
            </g>
          `;
        }
        if (selectedWheels === 'lightning') {
          return `
            <g class="vehicle-wheel ${spinClass}" style="transform-origin: ${cx}px ${wY}px;">
              <circle cx="${cx}" cy="${wY}" r="${wR}" fill="#1e293b"/>
              <circle cx="${cx}" cy="${wY}" r="7" fill="#facc15"/>
              <path d="M ${cx - 2} ${wY - 6} L ${cx + 3} ${wY - 1} L ${cx - 1} ${wY + 1} L ${cx + 2} ${wY + 6}" stroke="#000000" stroke-width="2" fill="none"/>
            </g>
          `;
        }
        if (selectedWheels === 'flower') {
          return `
            <g class="vehicle-wheel ${spinClass}" style="transform-origin: ${cx}px ${wY}px;">
              <circle cx="${cx}" cy="${wY}" r="${wR}" fill="#f43f5e"/>
              <circle cx="${cx}" cy="${wY}" r="6" fill="#fef08a"/>
              <circle cx="${cx - 8}" cy="${wY}" r="4" fill="#fbcfe8"/>
              <circle cx="${cx + 8}" cy="${wY}" r="4" fill="#fbcfe8"/>
              <circle cx="${cx}" cy="${wY - 8}" r="4" fill="#fbcfe8"/>
              <circle cx="${cx}" cy="${wY + 8}" r="4" fill="#fbcfe8"/>
            </g>
          `;
        }
        // 기본 바퀴
        return `
          <g class="vehicle-wheel ${spinClass}" style="transform-origin: ${cx}px ${wY}px;">
            <circle cx="${cx}" cy="${wY}" r="${wR}" fill="#1e293b"/>
            <circle cx="${cx}" cy="${wY}" r="6" fill="#94a3b8"/>
            <circle cx="${cx}" cy="${wY}" r="2" fill="#ffffff"/>
          </g>
        `;
      };

      // 스티커들 렌더링
      const stickerElements = stickers
        .map(
          (s) => `
          <text x="${s.x}%" y="${s.y}%" font-size="${24 * s.scale}" transform="rotate(${s.rot} ${s.x} ${s.y})" text-anchor="middle" dominant-baseline="central" class="select-none">
            ${s.icon}
          </text>
        `
        )
        .join('');

      return `
        <svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-2xl">
          <!-- 지붕 / 캡 -->
          <path id="part-roof" d="${roofPath}" fill="${colors.roof}" class="cursor-pointer transition-colors duration-200"/>
          
          <!-- 차체 메인 -->
          <path id="part-body" d="${bodyPath}" fill="${colors.body}" class="cursor-pointer transition-colors duration-200"/>
          
          <!-- 창문 -->
          ${windowPath}

          <!-- 범퍼 / 장식선 -->
          <path id="part-bumper" d="${bumperPath}" fill="${colors.bumper}" class="cursor-pointer transition-colors duration-200"/>

          <!-- 눈망울 -->
          <circle cx="132" cy="50" r="5" fill="#ffffff"/>
          <circle cx="133.5" cy="50" r="2.5" fill="#0f172a"/>
          <circle cx="134.5" cy="49" r="1" fill="#ffffff"/>

          <!-- 스티커 레이어 -->
          <g class="stickers-group">
            ${stickerElements}
          </g>

          <!-- 바퀴 2개 -->
          ${getWheelSvg(45)}
          ${getWheelSvg(118)}
        </svg>
      `;
    };

    // 자동차 렌더 및 이벤트 리스너 바인딩
    const updateCarDisplay = () => {
      carWrapper.innerHTML = getCarSvg();

      // 색칠 모드일 때 클릭 시 철퍽 소리와 함께 색칠
      if (step === 'colors') {
        const pRoof = carWrapper.querySelector('#part-roof');
        const pBody = carWrapper.querySelector('#part-body');
        const pBumper = carWrapper.querySelector('#part-bumper');

        const applyColor = (part: CarPart) => {
          colors[part] = activePaletteColor;
          ctx.audio.playWater();
          ctx.audio.triggerHaptic(20);
          burst(window.innerWidth / 2, window.innerHeight * 0.45, 'drop', 6);
          updateCarDisplay();
        };

        if (pRoof) pRoof.addEventListener('pointerdown', () => applyColor('roof'));
        if (pBody) pBody.addEventListener('pointerdown', () => applyColor('body'));
        if (pBumper) pBumper.addEventListener('pointerdown', () => applyColor('bumper'));
      }
    };

    // ==================================================
    // 단계별 컨트롤 패널 UI 렌더링
    // ==================================================
    const updateAllUI = () => {
      renderStepper();
      panelContainer.innerHTML = '';
      updateCarDisplay();

      // 1) 차체 선택 단계
      if (step === 'body') {
        const bodies: Array<{ type: BodyType; label: string; icon: string }> = [
          { type: 'sedan', label: '승용차', icon: '🚗' },
          { type: 'truck', label: '트럭', icon: '🚚' },
          { type: 'bus', label: '버스', icon: '🚌' },
          { type: 'sportscar', label: '스포츠카', icon: '🏎️' },
          { type: 'fire-truck', label: '소방차', icon: '🚒' },
        ];

        const row = document.createElement('div');
        row.className = 'grid grid-cols-5 gap-2';

        bodies.forEach((b) => {
          const btn = document.createElement('button');
          btn.className = `p-2 rounded-2xl flex flex-col items-center justify-center gap-1 border-3 transition-all cursor-pointer ${
            selectedBody === b.type
              ? 'bg-amber-300 border-amber-500 scale-105 shadow-md'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`;
          btn.innerHTML = `<span class="text-3xl">${b.icon}</span><span class="text-xs font-black text-gray-800">${b.label}</span>`;
          btn.onclick = () => {
            selectedBody = b.type;
            ctx.audio.playPop(520);
            ctx.audio.speak(b.label);
            updateAllUI();
          };
          row.appendChild(btn);
        });

        panelContainer.appendChild(row);
      }

      // 2) 바퀴 선택 단계 (기본/몬스터/번개/꽃)
      else if (step === 'wheels') {
        const wheels: Array<{ type: WheelType; label: string; icon: string }> = [
          { type: 'standard', label: '기본 바퀴', icon: '🛞' },
          { type: 'monster', label: '몬스터 바퀴', icon: '🚜' },
          { type: 'lightning', label: '번개 바퀴', icon: '⚡' },
          { type: 'flower', label: '꽃 바퀴', icon: '🌸' },
        ];

        const row = document.createElement('div');
        row.className = 'grid grid-cols-4 gap-2';

        wheels.forEach((w) => {
          const btn = document.createElement('button');
          btn.className = `p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 border-3 transition-all cursor-pointer ${
            selectedWheels === w.type
              ? 'bg-amber-300 border-amber-500 scale-105 shadow-md'
              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
          }`;
          btn.innerHTML = `<span class="text-3xl">${w.icon}</span><span class="text-xs font-black text-gray-800">${w.label}</span>`;
          btn.onclick = () => {
            selectedWheels = w.type;

            // 드릴 소리 + 햅틱 + 바퀴 회전 애니메이션
            ctx.audio.playEngine();
            ctx.audio.triggerHaptic(40);
            ctx.audio.speak(`${w.label} 착!`);

            isDrillSpinning = true;
            updateCarDisplay();
            setTimeout(() => {
              isDrillSpinning = false;
              updateCarDisplay();
            }, 500);

            updateAllUI();
          };
          row.appendChild(btn);
        });

        panelContainer.appendChild(row);
      }

      // 3) 색칠 단계 (8색 팔레트)
      else if (step === 'colors') {
        const guide = document.createElement('p');
        guide.className = 'text-center text-xs md:text-sm font-black text-amber-900 mb-1';
        guide.textContent = '색을 고른 후 자동차(지붕, 몸통, 범퍼)를 콕 터치하세요!';
        panelContainer.appendChild(guide);

        const paletteRow = document.createElement('div');
        paletteRow.className = 'flex items-center justify-around gap-1.5 py-1';

        PALETTE.forEach((color) => {
          const colorBtn = document.createElement('button');
          colorBtn.className = `w-11 h-11 md:w-12 md:h-12 rounded-full shadow-lg border-4 transition-transform cursor-pointer active:scale-90 ${
            activePaletteColor === color
              ? 'scale-125 border-white ring-4 ring-amber-400'
              : 'border-white/80'
          }`;
          colorBtn.style.backgroundColor = color;
          colorBtn.onclick = () => {
            activePaletteColor = color;
            ctx.audio.playPop(650);
            updateAllUI();
          };
          paletteRow.appendChild(colorBtn);
        });

        panelContainer.appendChild(paletteRow);
      }

      // 4) 스티커 단계 (별, 번개, 하트, 숫자, 불꽃)
      else if (step === 'stickers') {
        const guide = document.createElement('div');
        guide.className = 'flex items-center justify-between text-xs font-black text-amber-900 px-1';
        guide.innerHTML = `
          <span>스티커를 터치하면 차에 착 붙어요!</span>
          <button id="clear-stickers" class="text-rose-500 font-bold underline cursor-pointer">모두 떼기</button>
        `;
        panelContainer.appendChild(guide);

        const clearBtn = guide.querySelector('#clear-stickers') as HTMLButtonElement;
        if (clearBtn) {
          clearBtn.onclick = () => {
            stickers = [];
            ctx.audio.playPop(300);
            updateAllUI();
          };
        }

        const stickerRow = document.createElement('div');
        stickerRow.className = 'flex items-center gap-2 overflow-x-auto py-1 px-1';

        STICKER_LIST.forEach((icon) => {
          const sBtn = document.createElement('button');
          sBtn.className =
            'w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-amber-50 hover:bg-amber-100 active:scale-90 border-2 border-amber-300 text-2xl md:text-3xl flex items-center justify-center shrink-0 cursor-pointer shadow';
          sBtn.textContent = icon;
          sBtn.onclick = () => {
            // 차체 내부 랜덤 위치에 배치
            const x = 30 + Math.random() * 45;
            const y = 35 + Math.random() * 25;
            stickers.push({
              id: Math.random().toString(),
              icon,
              x,
              y,
              scale: 1,
              rot: (Math.random() - 0.5) * 30,
            });
            ctx.audio.playDing(1100);
            ctx.audio.triggerHaptic(20);
            burst(window.innerWidth / 2, window.innerHeight * 0.45, 'star', 6);
            updateAllUI();
          };
          stickerRow.appendChild(sBtn);
        });

        panelContainer.appendChild(stickerRow);
      }

      // 5) 시험 주행 단계 (오르막 점프대 트랙 + 차고 저장)
      else if (step === 'drive') {
        const driveControls = document.createElement('div');
        driveControls.className = 'flex items-center justify-around gap-3';

        const runBtn = document.createElement('button');
        runBtn.className =
          'flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-lg md:text-xl border-3 border-emerald-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer';
        runBtn.innerHTML = '<span>🚀</span><span>시험 주행 출발!</span>';
        runBtn.onclick = () => {
          runTestDrive();
        };

        const saveBtn = document.createElement('button');
        saveBtn.className =
          'flex-1 h-14 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-lg md:text-xl border-3 border-amber-300 shadow-xl flex items-center justify-center gap-2 cursor-pointer';
        saveBtn.innerHTML = '<span>🏠</span><span>차고에 넣기</span>';
        saveBtn.onclick = () => {
          saveToGarage();
        };

        driveControls.appendChild(runBtn);
        driveControls.appendChild(saveBtn);
        panelContainer.appendChild(driveControls);
      }
    };

    updateAllUI();

    // ==================================================
    // 시험 주행 모션 실행 (바퀴별 고유 특성)
    // ==================================================
    const runTestDrive = () => {
      if (isDriving) return;
      isDriving = true;

      ctx.audio.playEngine();
      ctx.audio.triggerHaptic(30);

      // 바퀴별 특성 음성 안내
      if (selectedWheels === 'monster') {
        ctx.audio.speak('몬스터 바퀴로 쿵덕쿵덕 힘차게 달려요!');
      } else if (selectedWheels === 'lightning') {
        ctx.audio.speak('번개 바퀴로 번개처럼 쌩쌩 날아가요!');
      } else if (selectedWheels === 'flower') {
        ctx.audio.speak('꽃 바퀴에서 예쁜 꽃잎이 피어나요!');
      } else {
        ctx.audio.speak('부릉부릉! 시험 주행을 시작해요!');
      }

      // 1. 오르막 언덕 오르기
      carWrapper.style.transition = 'transform 0.8s ease-in';
      carWrapper.style.transform = 'translateX(60px) translateY(-25px) rotate(-14deg)';

      // 꽃 바퀴 파티클 방출
      if (selectedWheels === 'flower') {
        burst(window.innerWidth / 2, window.innerHeight * 0.4, 'star', 12);
      }

      // 2. 점프대 도약 (공중 점프)
      setTimeout(() => {
        carWrapper.style.transition = 'transform 0.6s ease-out';
        const jumpScale = selectedWheels === 'monster' ? 'scale(1.25)' : 'scale(1.1)';
        carWrapper.style.transform = `translateX(140px) translateY(-50px) rotate(10deg) ${jumpScale}`;
        ctx.audio.playDing(1200);

        if (selectedWheels === 'lightning') {
          burst(window.innerWidth / 2 + 50, window.innerHeight * 0.35, 'star', 15);
        }
      }, 800);

      // 3. 착지 및 제자리 복귀
      setTimeout(() => {
        carWrapper.style.transition = 'transform 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)';
        carWrapper.style.transform = 'translateX(0) translateY(0) rotate(0deg) scale(1)';
        ctx.audio.playHorn();
        ctx.audio.playFanfare();
        triggerCelebrationConfetti();
        isDriving = false;
      }, 1450);
    };

    // ==================================================
    // 차고에 넣기 (store에 CarDesign 저장)
    // ==================================================
    const saveToGarage = () => {
      const designId = `custom-${Date.now()}`;
      const carNames: Record<BodyType, string> = {
        sedan: '멋쟁이 승용차',
        truck: '힘센 씽씽 트럭',
        bus: '노랑 꼬꼬마 버스',
        sportscar: '슈퍼 번개 레이서',
        'fire-truck': '용감한 삐뽀 소방차',
      };

      const newCar: CarDesign = {
        id: designId,
        name: carNames[selectedBody],
        body: selectedBody,
        colors: { ...colors },
        wheels: selectedWheels,
        stickers: [...stickers],
        svg: getCarSvg(),
        createdAt: Date.now(),
      };

      // store에 저장 (최대 12대)
      useAppStore.getState().saveCarDesign(newCar);

      ctx.audio.playFanfare();
      ctx.audio.speak('차고에 멋지게 보관했어요! 길 그리기에서도 탈 수 있어요!');
      triggerCelebrationConfetti();

      // 저장 완료 모달 팝업
      const alertBadge = document.createElement('div');
      alertBadge.className =
        'absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
      alertBadge.innerHTML = `
        <div class="bg-white rounded-3xl p-6 text-center border-4 border-amber-300 shadow-2xl max-w-xs animate-in zoom-in-95">
          <div class="text-6xl mb-2 animate-bounce">🏆 🚗 ✨</div>
          <h3 class="font-black text-2xl text-gray-800 mb-1">차고에 쏙 들어갔어요!</h3>
          <p class="text-xs font-bold text-gray-500 mb-4">이제 '길 그리기'와 '소리 도감'에서도 내가 만든 차를 만날 수 있어요.</p>
          <button id="close-save-alert" class="w-full h-14 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-950 font-black text-lg border-2 border-amber-300 shadow-md cursor-pointer">
            신나게 놀러 가기!
          </button>
        </div>
      `;
      container.appendChild(alertBadge);

      const closeBtn = alertBadge.querySelector('#close-save-alert') as HTMLButtonElement;
      if (closeBtn) {
        closeBtn.onclick = () => {
          if (alertBadge.parentElement) {
            alertBadge.parentElement.removeChild(alertBadge);
          }
        };
      }
    };

    return () => {
      isCleanedUp = true;
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
    };
  },
};
