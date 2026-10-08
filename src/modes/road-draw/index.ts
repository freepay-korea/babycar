import { Application, Container, Graphics, Text, Ticker } from 'pixi.js';
import { PlayMode, PlayModeContext } from '../types';
import { getCombinedVehicles, VehicleData, getVehicleById } from '../../core/vehicles';
import { useAppStore, CarDesign } from '../../core/store';
import { ParticleEngine, triggerCelebrationConfetti } from '../../core/particles';

interface Point {
  x: number;
  y: number;
}

interface PathSample {
  x: number;
  y: number;
  angle: number;
  dist: number;
}

type RoadItemType = 'tunnel' | 'bridge' | 'traffic' | 'jump';

interface PlacedItem {
  type: RoadItemType;
  dist: number; // 경로 상의 위치(거리)
  x: number;
  y: number;
  angle: number;
  state: 'red' | 'green';
  entered: boolean; // 이번 주행에서 소리를 이미 냈는지
  done: boolean; // 이번 주행에서 지나갔는지
}

const ROAD_WIDTH = 56;
const MIN_ROAD_LENGTH = 80;
const DRIVE_SPEED = 4.2; // 프레임당 px (60fps 기준)
const JUMP_LENGTH = 90;
const MAX_ITEMS = 8;

const ITEM_DEFS: Array<{ type: RoadItemType; label: string; icon: string }> = [
  { type: 'tunnel', label: '터널', icon: '🚇' },
  { type: 'bridge', label: '다리', icon: '🌉' },
  { type: 'traffic', label: '신호등', icon: '🚦' },
  { type: 'jump', label: '점프대', icon: '🛹' },
];

export const roadDrawMode: PlayMode = {
  id: 'road-draw',
  title: '길 그리기 드라이브',
  icon: '🛤️',
  color: '#10b981',
  minAge: 3,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    let app: Application | null = null;
    const fx = new ParticleEngine();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => {
      timers.push(setTimeout(() => !isCleanedUp && fn(), ms));
    };

    const { customCars, childAge, selectedVehicleId } = useAppStore.getState();
    const allVehicles = getCombinedVehicles(customCars);
    let currentVehicle: VehicleData = getVehicleById(selectedVehicleId, customCars);
    // 설정의 '2세 쉽게 모드': 그리는 동안 차가 손가락을 바로 따라옴
    const easyMode = childAge === 2;

    // 길 상태
    let rawPoints: Point[] = [];
    let drawingPointerId: number | null = null;
    let smoothedPath: PathSample[] = [];
    let totalDistance = 0;
    let placedItems: PlacedItem[] = [];
    let startPoint: Point = { x: 90, y: 200 };
    // 짧게 긋고 말았을 때 되돌릴 이전 길
    let backup: { path: PathSample[]; items: PlacedItem[]; start: Point } | null = null;

    // 주행 상태
    let isDriving = false;
    let driveProgress = 0;
    let waitingItem: PlacedItem | null = null;
    let bulldozerX: number | null = null;
    let dustTick = 0;

    // ==========================================
    // DOM UI (위: 차 고르기, 아래: 아이템 + 버튼)
    // ==========================================
    const uiOverlay = document.createElement('div');
    uiOverlay.className =
      'absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-20';

    const topBar = document.createElement('div');
    topBar.className =
      'pointer-events-auto flex items-center gap-2 bg-white/90 backdrop-blur-md p-2 rounded-3xl border-3 border-emerald-300 shadow-xl ml-24 overflow-x-auto max-w-[calc(100%-6rem)] self-end';
    topBar.style.touchAction = 'pan-x';

    const vehicleButtons: HTMLButtonElement[] = [];
    const styleVehicleButton = (btn: HTMLButtonElement, selected: boolean) => {
      btn.className = `w-16 h-16 shrink-0 rounded-2xl flex items-center justify-center text-4xl border-3 transition-transform cursor-pointer p-1 ${
        selected ? 'bg-amber-300 border-amber-500 scale-105 shadow' : 'bg-white border-gray-200'
      }`;
    };
    allVehicles.forEach((v) => {
      const vBtn = document.createElement('button');
      vBtn.innerHTML = v.svg;
      styleVehicleButton(vBtn, v.id === currentVehicle.id);
      vBtn.onclick = () => {
        currentVehicle = v;
        useAppStore.getState().selectVehicle(v.id);
        ctx.audio.playPop(550);
        ctx.audio.speak(v.name);
        vehicleButtons.forEach((b, i) => styleVehicleButton(b, allVehicles[i].id === v.id));
        drawCar();
      };
      vehicleButtons.push(vBtn);
      topBar.appendChild(vBtn);
    });
    uiOverlay.appendChild(topBar);

    const bottomControls = document.createElement('div');
    bottomControls.className =
      'pointer-events-auto self-center flex flex-wrap items-center justify-center gap-2 bg-white/95 backdrop-blur-md px-3 py-2 rounded-3xl border-3 border-emerald-300 shadow-xl';

    ITEM_DEFS.forEach((item) => {
      const itemBtn = document.createElement('button');
      itemBtn.className =
        'flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 active:scale-90 border-2 border-amber-300 cursor-grab shadow transition-transform';
      itemBtn.style.touchAction = 'none';
      itemBtn.innerHTML = `
        <span class="text-3xl leading-none pointer-events-none">${item.icon}</span>
        <span class="text-[11px] font-black text-amber-900 pointer-events-none">${item.label}</span>
      `;
      itemBtn.addEventListener('pointerdown', (e) => startItemDrag(item.type, item.icon, e));
      bottomControls.appendChild(itemBtn);
    });

    const divider = document.createElement('div');
    divider.className = 'w-px h-12 bg-emerald-200 mx-1';
    bottomControls.appendChild(divider);

    // 출발 버튼: 길을 그리고 아이템을 다 놓은 뒤 누르면 달림 (준비되면 통통 튀며 알려 줌)
    const startBtn = document.createElement('button');
    startBtn.setAttribute('aria-label', '출발');
    startBtn.innerHTML = `
      <svg viewBox="0 0 40 40" class="w-9 h-9"><path d="M11 7 L33 20 L11 33 Z" fill="currentColor"/></svg>`;
    const setStartState = (state: 'none' | 'ready' | 'driving') => {
      startBtn.dataset.state = state;
      startBtn.className = `w-20 h-16 rounded-2xl text-white border-3 shadow-lg flex items-center justify-center cursor-pointer transition-all ${
        state === 'ready'
          ? 'bg-emerald-500 border-emerald-300 active:scale-90 animate-soft-bounce ring-4 ring-emerald-200'
          : state === 'driving'
            ? 'bg-emerald-600 border-emerald-400 active:scale-90'
            : 'bg-gray-300 border-gray-200 opacity-60'
      }`;
    };
    setStartState('none');
    startBtn.onclick = () => {
      if (smoothedPath.length > 1) {
        startDrive();
      } else {
        ctx.audio.playPop(400);
        ctx.audio.speak('먼저 손가락으로 길을 그려 보세요!');
      }
    };

    const clearBtn = document.createElement('button');
    clearBtn.className =
      'w-16 h-16 rounded-2xl bg-rose-500 active:scale-90 text-white text-3xl border-3 border-rose-300 shadow-lg flex items-center justify-center cursor-pointer';
    clearBtn.setAttribute('aria-label', '모두 지우기');
    clearBtn.textContent = '🚜';
    clearBtn.onclick = () => triggerBulldozerClear();

    bottomControls.appendChild(startBtn);
    bottomControls.appendChild(clearBtn);
    uiOverlay.appendChild(bottomControls);
    el.appendChild(uiOverlay);

    // ==========================================
    // PixiJS 무대
    // ==========================================
    const sceneryLayer = new Container();
    const riverLayer = new Container(); // 다리 아래 강 (도로보다 아래)
    const roadGraphics = new Graphics();
    const itemsLayer = new Container(); // 점프대, 신호등, 다리 난간
    const flagLayer = new Container();
    const startFlag = new Container();
    const finishFlag = new Container();
    const carContainer = new Container();
    const carShadow = new Graphics();
    const carBody = new Graphics();
    const tunnelLayer = new Container(); // 터널은 차 위에 그려서 차가 숨음
    const particleLayer = new Container();
    const bulldozer = new Graphics();

    flagLayer.addChild(startFlag, finishFlag);
    carContainer.addChild(carShadow, carBody);
    carContainer.scale.set(1.3); // 도로 폭(56px)에 맞는 크기

    const width = () => el.clientWidth || window.innerWidth;
    const height = () => el.clientHeight || window.innerHeight;

    const initPixi = async () => {
      const a = new Application();
      try {
        await a.init({
          resizeTo: el,
          backgroundColor: 0x86efac, // 잔디밭 초록
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
      } catch (err) {
        console.error('[road-draw] PixiJS 초기화 실패', err);
        return;
      }
      if (isCleanedUp) {
        a.destroy(true, { children: true });
        return;
      }
      app = a;
      const canvas = a.canvas;
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.touchAction = 'none';
      el.insertBefore(canvas, uiOverlay);

      a.stage.addChild(
        sceneryLayer,
        riverLayer,
        roadGraphics,
        itemsLayer,
        flagLayer,
        carContainer,
        tunnelLayer,
        particleLayer,
        bulldozer
      );
      fx.setContainer(particleLayer, a.ticker);

      startPoint = { x: Math.min(110, width() * 0.18), y: height() * 0.5 };
      drawLawnDecorations();
      drawStartFlag();
      drawFinishFlag();
      finishFlag.visible = false;
      drawCar();
      resetCarToStart();

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);

      a.ticker.add(update);
    };
    initPixi();

    const resizeObserver = new ResizeObserver(() => {
      if (app) drawLawnDecorations();
    });
    resizeObserver.observe(el);

    // 잔디밭 꽃 장식
    const drawLawnDecorations = () => {
      sceneryLayer.removeChildren().forEach((c) => c.destroy());
      const g = new Graphics();
      const w = width();
      const h = height();
      const count = Math.round((w * h) / 9000);
      for (let i = 0; i < count; i++) {
        const fx0 = Math.random() * w;
        const fy0 = Math.random() * h;
        if (Math.random() < 0.5) {
          const col = [0xfef08a, 0xf472b6, 0xffffff, 0xbae6fd][Math.floor(Math.random() * 4)];
          g.circle(fx0, fy0, 5).fill({ color: col });
          g.circle(fx0, fy0, 2).fill({ color: 0xf59e0b });
        } else {
          g.circle(fx0, fy0, 3).fill({ color: 0x4ade80 });
          g.circle(fx0 + 4, fy0 + 1, 3).fill({ color: 0x4ade80 });
        }
      }
      sceneryLayer.addChild(g);
    };

    const drawStartFlag = () => {
      const g = new Graphics();
      g.ellipse(2, 0, 10, 4).fill({ color: 0x334155, alpha: 0.5 });
      g.rect(0, -44, 5, 44).fill({ color: 0x475569 });
      g.poly([5, -44, 32, -32, 5, -20]).fill({ color: 0x22c55e });
      startFlag.addChild(g);
      startFlag.position.set(startPoint.x - 8, startPoint.y - 30);
    };

    const drawFinishFlag = () => {
      const g = new Graphics();
      g.ellipse(2, 0, 10, 4).fill({ color: 0x334155, alpha: 0.5 });
      g.rect(0, -50, 5, 50).fill({ color: 0x1e293b });
      const size = 7;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          g.rect(5 + c * size, -50 + r * size, size, size).fill({
            color: (r + c) % 2 === 0 ? 0x000000 : 0xffffff,
          });
        }
      }
      finishFlag.addChild(g);
    };

    // 위에서 내려다본 탈것 (종류마다 생김새가 다름). 앞쪽이 +x
    let rotor: Graphics | null = null;
    let chimney: { x: number; y: number } | null = null;
    const drawCar = () => {
      carBody.removeChildren().forEach((c) => c.destroy());
      rotor = null;
      chimney = null;
      const g = new Graphics();
      carBody.addChild(g);
      const design = currentVehicle.isCustom ? customCars.find((c) => c.id === currentVehicle.id) : undefined;
      const toColor = (hex: string, fallback: number) => {
        const n = parseInt(hex.replace('#', ''), 16);
        return Number.isFinite(n) ? n : fallback;
      };
      const main = toColor(currentVehicle.bgColor, 0xef4444);

      const wheels = (xs: number[], w = 10, h = 6, color = 0x1e293b) => {
        xs.forEach((x) => {
          g.roundRect(x - w / 2, -16 - h / 2 + 2, w, h, 2).fill({ color });
          g.roundRect(x - w / 2, 16 - h / 2 - 2, w, h, 2).fill({ color });
        });
      };
      const eyes = (x: number) => {
        g.circle(x, -5, 3).fill({ color: 0xffffff });
        g.circle(x + 0.8, -5, 1.8).fill({ color: 0x0f172a });
        g.circle(x, 5, 3).fill({ color: 0xffffff });
        g.circle(x + 0.8, 5, 1.8).fill({ color: 0x0f172a });
      };
      const headlights = (x: number) => {
        g.circle(x, -8, 2.6).fill({ color: 0xfef08a });
        g.circle(x, 8, 2.6).fill({ color: 0xfef08a });
      };
      const shadowOf = (w: number, h: number) => {
        carShadow.clear();
        carShadow.roundRect(-w / 2 + 2, -h / 2 + 3, w, h, 10).fill({ color: 0x000000, alpha: 0.18 });
      };

      switch (design ? 'custom' : currentVehicle.id) {
        case 'fire-truck': {
          shadowOf(64, 30);
          wheels([-20, -6, 18], 10, 6);
          g.roundRect(-32, -13, 64, 26, 7).fill({ color: 0xef4444 }).stroke({ width: 2, color: 0xfecaca, alpha: 0.8 });
          g.rect(-32, -2, 64, 4).fill({ color: 0xffffff }); // 흰 띠
          g.roundRect(14, -10, 14, 20, 4).fill({ color: 0xbae6fd }); // 앞 유리
          // 사다리
          g.roundRect(-28, -4, 36, 8, 2).fill({ color: 0x94a3b8 });
          for (let k = -24; k <= 4; k += 7) g.rect(k, -4, 2, 8).fill({ color: 0x475569 });
          g.circle(10, 0, 3.5).fill({ color: 0x38bdf8 }); // 경광등
          headlights(31);
          eyes(22);
          break;
        }
        case 'police-car': {
          shadowOf(54, 28);
          wheels([-16, 16]);
          g.roundRect(-27, -12, 54, 24, 7).fill({ color: 0xffffff }).stroke({ width: 2, color: 0xcbd5e1 });
          g.roundRect(-27, -12, 14, 24, 6).fill({ color: 0x3b82f6 });
          g.roundRect(13, -12, 14, 24, 6).fill({ color: 0x3b82f6 });
          g.roundRect(-10, -9, 22, 18, 4).fill({ color: 0xbae6fd }); // 지붕 창
          g.rect(-3, -9, 6, 8).fill({ color: 0xef4444 }); // 경광등 빨강
          g.rect(-3, 1, 6, 8).fill({ color: 0x38bdf8 }); // 경광등 파랑
          headlights(26);
          eyes(18);
          break;
        }
        case 'bus': {
          shadowOf(70, 30);
          wheels([-22, 22], 10, 6);
          g.roundRect(-35, -13, 70, 26, 8).fill({ color: 0xfacc15 }).stroke({ width: 2, color: 0xfde68a });
          g.rect(-35, -13, 70, 3).fill({ color: 0x0284c7 });
          g.rect(-35, 10, 70, 3).fill({ color: 0x0284c7 });
          for (let k = -28; k <= 10; k += 11) {
            g.roundRect(k, -9, 8, 5, 1.5).fill({ color: 0xe0f2fe });
            g.roundRect(k, 4, 8, 5, 1.5).fill({ color: 0xe0f2fe });
          }
          g.roundRect(22, -9, 10, 18, 3).fill({ color: 0xe0f2fe });
          g.roundRect(-8, -4, 12, 8, 2).fill({ color: 0xfde68a }); // 지붕 환풍구
          headlights(34);
          eyes(26);
          break;
        }
        case 'excavator': {
          shadowOf(66, 32);
          // 무한궤도
          g.roundRect(-26, -16, 40, 8, 4).fill({ color: 0x1e293b });
          g.roundRect(-26, 8, 40, 8, 4).fill({ color: 0x1e293b });
          for (let k = -22; k <= 10; k += 8) {
            g.rect(k, -15, 2, 6).fill({ color: 0x64748b });
            g.rect(k, 9, 2, 6).fill({ color: 0x64748b });
          }
          g.roundRect(-22, -11, 30, 22, 6).fill({ color: 0xf97316 }); // 조종석
          g.roundRect(-14, -8, 14, 16, 3).fill({ color: 0xbae6fd });
          g.roundRect(6, -4, 30, 8, 3).fill({ color: 0xf97316 }); // 팔
          g.circle(8, 0, 4).fill({ color: 0x334155 });
          g.roundRect(32, -9, 10, 18, 3).fill({ color: 0x334155 }); // 버킷
          for (let k = -6; k <= 6; k += 6) g.rect(41, k - 1, 4, 2).fill({ color: 0x94a3b8 });
          eyes(-3);
          break;
        }
        case 'train': {
          shadowOf(66, 30);
          wheels([-22, -8, 8, 22], 8, 5);
          g.roundRect(-33, -11, 44, 22, 5).fill({ color: 0x7c3aed }); // 기관실
          g.roundRect(-30, -8, 18, 16, 3).fill({ color: 0xe0f2fe });
          g.roundRect(8, -10, 26, 20, 10).fill({ color: 0x8b5cf6 }); // 보일러
          g.circle(30, 0, 5).fill({ color: 0xfacc15 }); // 앞 등
          g.circle(18, 0, 5).fill({ color: 0x475569 }); // 굴뚝
          g.circle(18, 0, 2.5).fill({ color: 0x1e293b });
          g.rect(-33, -2, 44, 4).fill({ color: 0xfacc15, alpha: 0.6 });
          chimney = { x: 18, y: 0 };
          eyes(26);
          break;
        }
        case 'helicopter': {
          shadowOf(64, 30);
          // 스키드
          g.roundRect(-14, -17, 30, 3, 1.5).fill({ color: 0x475569 });
          g.roundRect(-14, 14, 30, 3, 1.5).fill({ color: 0x475569 });
          g.roundRect(-40, -3, 30, 6, 3).fill({ color: 0x0891b2 }); // 꼬리
          g.roundRect(-42, -8, 5, 16, 2).fill({ color: 0x0891b2 });
          g.circle(-39, 0, 7).stroke({ width: 2, color: 0x64748b });
          g.ellipse(0, 0, 22, 13).fill({ color: 0x06b6d4 });
          g.ellipse(9, 0, 9, 9).fill({ color: 0xe0f2fe }); // 앞 유리
          eyes(10);
          rotor = new Graphics();
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2;
            rotor.poly([
              Math.cos(a) * 3 - Math.sin(a) * 2, Math.sin(a) * 3 + Math.cos(a) * 2,
              Math.cos(a) * 30 - Math.sin(a) * 2, Math.sin(a) * 30 + Math.cos(a) * 2,
              Math.cos(a) * 30 + Math.sin(a) * 2, Math.sin(a) * 30 - Math.cos(a) * 2,
              Math.cos(a) * 3 + Math.sin(a) * 2, Math.sin(a) * 3 - Math.cos(a) * 2,
            ]).fill({ color: 0x334155, alpha: 0.85 });
          }
          rotor.circle(0, 0, 4).fill({ color: 0x1e293b });
          carBody.addChild(rotor);
          break;
        }
        case 'custom': {
          const d = design as CarDesign;
          const body = toColor(d.colors.body, main);
          const roof = toColor(d.colors.roof, 0x60a5fa);
          const bumper = toColor(d.colors.bumper, 0x1e293b);
          const long = d.body === 'bus' || d.body === 'truck' || d.body === 'fire-truck';
          const L = long ? 64 : d.body === 'sportscar' ? 56 : 52;
          shadowOf(L, 30);
          // 바퀴 종류
          const wx = long ? [-20, 18] : [-15, 15];
          if (d.wheels === 'monster') wheels(wx, 14, 9, 0x0f172a);
          else if (d.wheels === 'lightning') {
            wheels(wx, 11, 6);
            wx.forEach((x) => {
              g.rect(x - 2, -17, 4, 3).fill({ color: 0xfacc15 });
              g.rect(x - 2, 14, 4, 3).fill({ color: 0xfacc15 });
            });
          } else if (d.wheels === 'flower') {
            wheels(wx, 10, 6, 0xf43f5e);
            wx.forEach((x) => {
              g.circle(x, -16, 2).fill({ color: 0xfef08a });
              g.circle(x, 16, 2).fill({ color: 0xfef08a });
            });
          } else wheels(wx);
          g.roundRect(-L / 2, -13, L, 26, d.body === 'sportscar' ? 12 : 7).fill({ color: body }).stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
          // 지붕
          if (d.body === 'truck') {
            g.roundRect(-L / 2 + 3, -10, L * 0.55, 20, 4).fill({ color: roof });
            g.roundRect(L / 2 - 20, -9, 12, 18, 3).fill({ color: 0xbae6fd });
          } else if (d.body === 'bus') {
            g.roundRect(-L / 2 + 4, -9, L - 8, 18, 4).fill({ color: roof });
            for (let k = -L / 2 + 8; k < L / 2 - 10; k += 11) {
              g.roundRect(k, -8, 7, 4, 1).fill({ color: 0xe0f2fe });
              g.roundRect(k, 4, 7, 4, 1).fill({ color: 0xe0f2fe });
            }
          } else if (d.body === 'fire-truck') {
            g.roundRect(-L / 2 + 4, -9, L - 8, 18, 4).fill({ color: roof });
            g.roundRect(-L / 2 + 8, -3, L * 0.5, 6, 2).fill({ color: 0x94a3b8 });
            g.circle(L / 2 - 16, 0, 3).fill({ color: 0x38bdf8 });
          } else {
            g.roundRect(-L * 0.22, -9, L * 0.44, 18, 5).fill({ color: roof });
            g.roundRect(L * 0.1, -8, 8, 16, 3).fill({ color: 0xbae6fd });
          }
          // 범퍼
          g.rect(L / 2 - 4, -11, 3, 22).fill({ color: bumper });
          g.rect(-L / 2 + 1, -11, 3, 22).fill({ color: bumper });
          headlights(L / 2 - 1);
          eyes(L / 2 - 10);
          // 스티커 (정비소 좌표 160x100 → 차 위)
          d.stickers.slice(0, 6).forEach((st) => {
            const t = new Text({ text: st.icon, style: { fontSize: 11 * st.scale } });
            t.anchor.set(0.5);
            t.position.set(((st.x - 80) / 160) * L, ((st.y - 50) / 100) * 22);
            t.rotation = (st.rot * Math.PI) / 180;
            carBody.addChild(t);
          });
          break;
        }
        default: {
          shadowOf(48, 26);
          wheels([-14, 14]);
          g.roundRect(-24, -13, 48, 26, 9).fill({ color: main }).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
          g.roundRect(-4, -9, 14, 18, 4).fill({ color: 0xe0f2fe });
          headlights(22);
          eyes(15);
        }
      }
    };

    const resetCarToStart = () => {
      const first = smoothedPath[0];
      carContainer.position.set(first ? first.x : startPoint.x, first ? first.y : startPoint.y);
      carContainer.rotation = first ? first.angle : 0;
      carContainer.alpha = 1;
      carBody.scale.set(1);
      carBody.y = 0;
    };

    // ==========================================
    // 도로 그리기 (도로 + 흰 점선)
    // ==========================================
    const strokePolyline = (pts: Point[], width: number, color: number) => {
      roadGraphics.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) roadGraphics.lineTo(pts[i].x, pts[i].y);
      roadGraphics.stroke({ width, color, cap: 'round', join: 'round' });
    };

    const renderRoad = (pts: Point[]) => {
      roadGraphics.clear();
      if (pts.length < 2) {
        if (pts.length === 1) roadGraphics.circle(pts[0].x, pts[0].y, ROAD_WIDTH / 2).fill({ color: 0x334155 });
        return;
      }
      strokePolyline(pts, ROAD_WIDTH + 8, 0x1e293b);
      strokePolyline(pts, ROAD_WIDTH, 0x475569);

      // 흰 점선 중앙선: 길이 기준으로 14px 칠하고 12px 쉬기
      const DASH = 14;
      const GAP = 12;
      let carry = 0;
      let drawing = true;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen === 0) continue;
        const ux = (b.x - a.x) / segLen;
        const uy = (b.y - a.y) / segLen;
        let pos = 0;
        while (pos < segLen) {
          const remain = (drawing ? DASH : GAP) - carry;
          const stepLen = Math.min(remain, segLen - pos);
          if (drawing) {
            roadGraphics
              .moveTo(a.x + ux * pos, a.y + uy * pos)
              .lineTo(a.x + ux * (pos + stepLen), a.y + uy * (pos + stepLen));
          }
          pos += stepLen;
          carry += stepLen;
          if (carry >= (drawing ? DASH : GAP)) {
            carry = 0;
            drawing = !drawing;
          }
        }
      }
      roadGraphics.stroke({ width: 4, color: 0xffffff, cap: 'round' });
    };

    // ==========================================
    // 손가락으로 길 그리기
    // ==========================================
    const toLocal = (e: PointerEvent): Point => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onPointerDown = (e: PointerEvent) => {
      if (!app || drawingPointerId !== null || bulldozerX !== null) return;
      const p = toLocal(e);

      // 신호등을 톡 → 빨간불/초록불
      const light = placedItems.find((it) => it.type === 'traffic' && Math.hypot(lightPos(it).x - p.x, lightPos(it).y - p.y) < 48);
      if (light) {
        toggleTraffic(light);
        return;
      }

      drawingPointerId = e.pointerId;
      try {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // 일부 브라우저 미지원
      }

      backup = { path: smoothedPath, items: placedItems, start: startPoint };
      isDriving = false;
      waitingItem = null;
      rawPoints = [p];
      renderRoad(rawPoints);
      renderItems([]);
      finishFlag.visible = false;
      setStartState('none');
      startPoint = p;
      startFlag.position.set(p.x - 8, p.y - 30);
      carContainer.position.set(p.x, p.y);
      carContainer.alpha = 1;
      carBody.scale.set(1);

      ctx.audio.playPop(480);
      ctx.audio.triggerHaptic(15);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== drawingPointerId) return;
      const p = toLocal(e);
      const last = rawPoints[rawPoints.length - 1];
      const d = Math.hypot(p.x - last.x, p.y - last.y);
      if (d < 8) return;

      rawPoints.push(p);
      renderRoad(rawPoints);

      if (easyMode) {
        carContainer.position.set(p.x, p.y);
        carContainer.rotation = Math.atan2(p.y - last.y, p.x - last.x);
        if (ctx.audio.throttle('road-follow', 450)) ctx.audio.playEngine();
        if (Math.random() < 0.3) fx.burst(p.x, p.y, 'smoke', 1);
      } else if (ctx.audio.throttle('road-draw', 140)) {
        ctx.audio.playPop(380 + Math.min(400, rawPoints.length * 4));
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== drawingPointerId) return;
      drawingPointerId = null;

      let lengthSum = 0;
      for (let i = 1; i < rawPoints.length; i++) {
        lengthSum += Math.hypot(rawPoints[i].x - rawPoints[i - 1].x, rawPoints[i].y - rawPoints[i - 1].y);
      }

      // 80px보다 짧은 길은 "부릉?" 소리만 내고 무시 (이전 길은 그대로)
      if (lengthSum < MIN_ROAD_LENGTH || rawPoints.length < 2) {
        ctx.audio.playEngine();
        ctx.audio.speak('부릉?');
        rawPoints = [];
        if (backup) {
          smoothedPath = backup.path;
          placedItems = backup.items;
          startPoint = backup.start;
        }
        startFlag.position.set(startPoint.x - 8, startPoint.y - 30);
        renderRoad(smoothedPath);
        renderItems(placedItems);
        resetCarToStart();
        return;
      }

      // Catmull-Rom 스플라인 + 길이 기준 등간격 재표본화
      smoothedPath = generateSmoothEquidistantPath(rawPoints, 4);
      totalDistance = smoothedPath[smoothedPath.length - 1]?.dist || 0;
      placedItems = [];
      backup = null;
      renderRoad(smoothedPath);
      renderItems(placedItems);

      const last = smoothedPath[smoothedPath.length - 1];
      finishFlag.position.set(last.x + 6, last.y - 26);

      // 차는 출발선에서 대기. 아이템을 놓고 ▶ 버튼을 누르면 출발
      resetCarToStart();
      setStartState('ready');
      ctx.audio.playDing(880);
      ctx.audio.speak(placedItems.length === 0 && !hintedItems ? '길이 생겼어요! 터널이나 다리를 놓고 출발 버튼을 눌러요' : '출발 버튼을 눌러요!');
      hintedItems = true;
    };
    let hintedItems = false;

    // ==========================================
    // 주행
    // ==========================================
    const startDrive = () => {
      if (smoothedPath.length < 2) return;
      totalDistance = smoothedPath[smoothedPath.length - 1].dist;
      isDriving = true;
      waitingItem = null;
      driveProgress = 0;
      finishFlag.visible = false;
      placedItems.forEach((it) => {
        it.entered = false;
        it.done = false;
        if (it.type === 'traffic') it.state = 'red';
      });
      renderItems(placedItems);
      resetCarToStart();
      setStartState('driving');
      ctx.audio.playEngine();
      ctx.audio.triggerHaptic(25);
    };

    const arrive = () => {
      isDriving = false;
      carContainer.alpha = 1;
      carBody.scale.set(1);
      setStartState('ready');
      const last = smoothedPath[smoothedPath.length - 1];
      if (!last) return;
      finishFlag.visible = true;
      finishFlag.scale.set(0.2);
      ctx.audio.playFanfare();
      ctx.audio.speak('도착!');
      triggerCelebrationConfetti();
      fx.burst(last.x, last.y, 'star', 24);
      fx.burst(last.x, last.y, 'confetti', 20);
    };

    const update = (ticker: Ticker) => {
      const d = Math.min(3, ticker.deltaTime);

      // 도착 깃발 뿅 커지기
      if (finishFlag.visible && finishFlag.scale.x < 1) {
        finishFlag.scale.set(Math.min(1, finishFlag.scale.x + 0.08 * d));
      }

      updateBulldozer(d);

      // 헬리콥터 날개는 늘 돌고, 달릴 때 더 빨리
      if (rotor) rotor.rotation += (isDriving ? 0.6 : 0.12) * d;

      if (!isDriving || smoothedPath.length < 2) return;

      // 빨간불: 신호등 앞에서 부르르 떨며 기다림
      if (waitingItem) {
        carBody.y = Math.sin(performance.now() / 40) * 0.8;
        return;
      }
      carBody.y = 0;

      driveProgress += DRIVE_SPEED * d;

      for (const item of placedItems) {
        const rel = driveProgress - item.dist;
        if (item.type === 'traffic') {
          if (!item.done && item.state === 'red' && rel >= -40) {
            driveProgress = item.dist - 40;
            waitingItem = item;
            ctx.audio.playHorn();
            ctx.audio.speak('빨간불! 신호등을 눌러 주세요');
            break;
          }
          if (rel >= -40) item.done = true;
        } else if (item.type === 'tunnel') {
          if (!item.entered && rel >= -36) {
            item.entered = true;
            ctx.audio.playTunnel();
          }
        } else if (item.type === 'bridge') {
          if (!item.entered && rel >= -30) {
            item.entered = true;
            ctx.audio.playWater();
            const n = normal(item.angle);
            fx.burst(item.x + n.x * 50, item.y + n.y * 50, 'drop', 8);
            fx.burst(item.x - n.x * 50, item.y - n.y * 50, 'drop', 8);
          }
        } else if (item.type === 'jump') {
          if (!item.entered && rel >= 0) {
            item.entered = true;
            ctx.audio.playBoing();
          }
          if (item.entered && !item.done && rel >= JUMP_LENGTH) {
            item.done = true;
            ctx.audio.playPop(220);
            fx.burst(carContainer.x, carContainer.y, 'star', 10);
          }
        }
      }

      const s = getSampleAtDistance(smoothedPath, driveProgress);
      if (!s) return;
      carContainer.position.set(s.x, s.y);
      carContainer.rotation = s.angle;

      // 점프대: 폴짝 (위에서 본 화면이라 커졌다 작아짐)
      let lift = 0;
      for (const item of placedItems) {
        if (item.type !== 'jump') continue;
        const rel = driveProgress - item.dist;
        if (rel >= 0 && rel <= JUMP_LENGTH) lift = Math.max(lift, Math.sin((rel / JUMP_LENGTH) * Math.PI));
      }
      carBody.scale.set(1 + lift * 0.6);
      carShadow.alpha = 1 - lift * 0.6;

      // 달리는 동안 엔진 소리와 뒤로 먼지
      if (ctx.audio.throttle('road-engine', 700)) ctx.audio.playEngine();
      dustTick += d;
      if (dustTick > 4 && lift === 0) {
        dustTick = 0;
        if (chimney) {
          // 기차: 굴뚝에서 칙칙폭폭 연기
          const cx = s.x + Math.cos(s.angle) * chimney.x - Math.sin(s.angle) * chimney.y;
          const cy = s.y + Math.sin(s.angle) * chimney.x + Math.cos(s.angle) * chimney.y;
          fx.burst(cx, cy, 'smoke', 2);
        } else if (!rotor) {
          fx.burst(s.x - Math.cos(s.angle) * 24, s.y - Math.sin(s.angle) * 24, 'smoke', 1);
        }
      }

      if (driveProgress >= totalDistance) arrive();
    };

    // ==========================================
    // 아이템: 끌어다 도로 위에 놓기 (톡 누르면 알아서 놓임)
    // ==========================================
    const normal = (angle: number) => ({ x: -Math.sin(angle), y: Math.cos(angle) });
    const lightPos = (it: PlacedItem) => {
      const n = normal(it.angle);
      return { x: it.x + n.x * 46, y: it.y + n.y * 46 };
    };

    const toggleTraffic = (item: PlacedItem) => {
      item.state = item.state === 'red' ? 'green' : 'red';
      ctx.audio.playPop(item.state === 'green' ? 760 : 420);
      ctx.audio.triggerHaptic(20);
      fx.burst(lightPos(item).x, lightPos(item).y, 'star', 6);
      renderItems(placedItems);
      if (waitingItem === item && item.state === 'green') {
        waitingItem = null;
        item.done = true;
        ctx.audio.playHorn();
        ctx.audio.speak('초록불 출발!');
      }
    };

    const placeItem = (type: RoadItemType, targetDist: number) => {
      const margin = Math.min(50, totalDistance * 0.2);
      const dist = Math.max(margin, Math.min(totalDistance - margin, targetDist));
      const s = getSampleAtDistance(smoothedPath, dist);
      if (!s) return;
      if (placedItems.length >= MAX_ITEMS) placedItems.shift();
      placedItems.push({
        type,
        dist,
        x: s.x,
        y: s.y,
        angle: s.angle,
        state: 'red',
        entered: false,
        done: false,
      });
      placedItems.sort((a, b) => a.dist - b.dist);
      ctx.audio.playDing(880);
      ctx.audio.triggerHaptic(20);
      fx.burst(s.x, s.y, 'star', 10);
      renderItems(placedItems);
    };

    const autoPlaceItem = (type: RoadItemType) => {
      const slots = [0.5, 0.3, 0.7, 0.4, 0.6, 0.2, 0.8, 0.45];
      placeItem(type, totalDistance * slots[placedItems.length % slots.length]);
    };

    const startItemDrag = (type: RoadItemType, icon: string, e: PointerEvent) => {
      e.preventDefault();
      ctx.audio.playPop(600);
      if (smoothedPath.length < 2) {
        ctx.audio.speak('먼저 손가락으로 길을 그려요!');
        return;
      }
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      let moved = false;

      const ghost = document.createElement('div');
      ghost.className = 'fixed z-50 text-6xl pointer-events-none select-none drop-shadow-xl';
      ghost.textContent = icon;
      ghost.style.left = `${startX - 32}px`;
      ghost.style.top = `${startY - 40}px`;
      document.body.appendChild(ghost);

      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 20) moved = true;
        ghost.style.left = `${ev.clientX - 32}px`;
        ghost.style.top = `${ev.clientY - 40}px`;
      };
      const end = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        ghost.remove();
        dragCleanup = null;
        if (isCleanedUp) return;

        if (!moved) {
          autoPlaceItem(type);
          return;
        }
        // 놓은 곳에서 가장 가까운 도로 지점에 착 붙이기
        const rect = el.getBoundingClientRect();
        const p = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
        let best: PathSample | null = null;
        let bestD = Infinity;
        for (const s of smoothedPath) {
          const dd = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
          if (dd < bestD) {
            bestD = dd;
            best = s;
          }
        }
        if (best && Math.sqrt(bestD) < 140) {
          placeItem(type, best.dist);
        } else {
          // 도로에서 너무 멀면 가장 알맞은 곳에 알아서 놓아 줌 (실패 없음)
          autoPlaceItem(type);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      dragCleanup = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        ghost.remove();
      };
    };
    let dragCleanup: (() => void) | null = null;

    const clearLayer = (layer: Container) => layer.removeChildren().forEach((c) => c.destroy());

    const renderItems = (items: PlacedItem[]) => {
      clearLayer(riverLayer);
      clearLayer(itemsLayer);
      clearLayer(tunnelLayer);

      items.forEach((item) => {
        const g = new Graphics();
        g.position.set(item.x, item.y);
        g.rotation = item.angle;

        if (item.type === 'bridge') {
          // 길 아래를 가로지르는 강
          const river = new Graphics();
          river.position.set(item.x, item.y);
          river.rotation = item.angle;
          river.roundRect(-30, -90, 60, 180, 20).fill({ color: 0x38bdf8 });
          river.roundRect(-22, -90, 44, 180, 16).fill({ color: 0x0ea5e9 });
          for (let k = -70; k <= 70; k += 28) {
            river.moveTo(-10, k).quadraticCurveTo(0, k - 6, 10, k).stroke({ width: 3, color: 0xe0f2fe });
          }
          riverLayer.addChild(river);
          // 다리 난간
          g.rect(-34, -ROAD_WIDTH / 2 - 8, 68, 7).fill({ color: 0xa16207 });
          g.rect(-34, ROAD_WIDTH / 2 + 1, 68, 7).fill({ color: 0xa16207 });
          for (let k = -30; k <= 30; k += 15) {
            g.circle(k, -ROAD_WIDTH / 2 - 4.5, 3).fill({ color: 0x78350f });
            g.circle(k, ROAD_WIDTH / 2 + 4.5, 3).fill({ color: 0x78350f });
          }
          itemsLayer.addChild(g);
        } else if (item.type === 'tunnel') {
          // 차 위를 덮는 초록 언덕 터널
          g.roundRect(-38, -ROAD_WIDTH / 2 - 16, 76, ROAD_WIDTH + 32, 22).fill({ color: 0x15803d });
          g.roundRect(-30, -ROAD_WIDTH / 2 - 8, 60, ROAD_WIDTH + 16, 18).fill({ color: 0x22c55e });
          g.circle(-10, -8, 5).fill({ color: 0xfef08a });
          g.circle(12, 10, 4).fill({ color: 0xf472b6 });
          // 입구 (어두운 굴)
          g.roundRect(-42, -ROAD_WIDTH / 2 + 2, 10, ROAD_WIDTH - 4, 5).fill({ color: 0x0f172a });
          g.roundRect(32, -ROAD_WIDTH / 2 + 2, 10, ROAD_WIDTH - 4, 5).fill({ color: 0x0f172a });
          tunnelLayer.addChild(g);
        } else if (item.type === 'jump') {
          // 노란 점프대 (화살표 무늬)
          g.roundRect(-20, -ROAD_WIDTH / 2 + 2, 40, ROAD_WIDTH - 4, 6).fill({ color: 0xfacc15 }).stroke({ width: 3, color: 0xb45309 });
          for (let k = -12; k <= 8; k += 10) {
            g.moveTo(k, -14).lineTo(k + 8, 0).lineTo(k, 14).stroke({ width: 4, color: 0xef4444, cap: 'round', join: 'round' });
          }
          itemsLayer.addChild(g);
        } else if (item.type === 'traffic') {
          // 정지선 + 길가의 큰 신호등 (톡 누르면 바뀜)
          g.rect(-44, -ROAD_WIDTH / 2, 6, ROAD_WIDTH).fill({ color: 0xffffff });
          itemsLayer.addChild(g);

          const lp = lightPos(item);
          const light = new Graphics();
          light.position.set(lp.x, lp.y);
          const isRed = item.state === 'red';
          light.circle(0, 0, 30).fill({ color: 0xffffff, alpha: 0.35 });
          light.roundRect(-16, -26, 32, 52, 10).fill({ color: 0x1e293b }).stroke({ width: 3, color: 0xffffff });
          light.circle(0, -12, 9).fill({ color: isRed ? 0xef4444 : 0x475569 });
          light.circle(0, 12, 9).fill({ color: isRed ? 0x475569 : 0x22c55e });
          if (isRed) light.circle(0, -12, 13).fill({ color: 0xef4444, alpha: 0.3 });
          else light.circle(0, 12, 13).fill({ color: 0x22c55e, alpha: 0.3 });
          itemsLayer.addChild(light);
        }
      });
    };

    // ==========================================
    // 모두 지우기: 불도저가 화면을 쓱 밀며 지나감
    // ==========================================
    const drawBulldozer = () => {
      bulldozer.clear();
      const h = height();
      // 화면 높이만큼 긴 밀대
      bulldozer.roundRect(36, -h / 2 - 20, 16, h + 40, 6).fill({ color: 0x475569 });
      bulldozer.roundRect(-46, -40, 84, 80, 12).fill({ color: 0xf59e0b });
      bulldozer.roundRect(-48, -48, 88, 12, 6).fill({ color: 0x0f172a });
      bulldozer.roundRect(-48, 36, 88, 12, 6).fill({ color: 0x0f172a });
      bulldozer.roundRect(-30, -22, 34, 44, 6).fill({ color: 0xbae6fd });
      bulldozer.circle(24, -12, 5).fill({ color: 0xffffff });
      bulldozer.circle(25.5, -12, 2.6).fill({ color: 0x0f172a });
      bulldozer.circle(24, 12, 5).fill({ color: 0xffffff });
      bulldozer.circle(25.5, 12, 2.6).fill({ color: 0x0f172a });
      bulldozer.y = h / 2;
    };

    const triggerBulldozerClear = () => {
      if (!app || bulldozerX !== null) return;
      isDriving = false;
      waitingItem = null;
      ctx.audio.playEngine();
      ctx.audio.speak('불도저 출동!');
      drawBulldozer();
      bulldozer.visible = true;
      bulldozerX = -80;
    };

    const updateBulldozer = (d: number) => {
      if (bulldozerX === null) return;
      bulldozerX += 14 * d;
      bulldozer.x = bulldozerX;
      if (ctx.audio.throttle('bulldozer', 500)) ctx.audio.playEngine();
      if (Math.random() < 0.5) fx.burst(bulldozerX + 50, Math.random() * height(), 'dirt', 2);

      // 지나간 곳까지 길과 아이템을 지움 (밀대가 쓸어감)
      if (smoothedPath.length > 0 || placedItems.length > 0) {
        const edge = bulldozerX + 44;
        const remaining = smoothedPath.filter((s) => s.x > edge);
        renderRoad(remaining.length > 1 ? remaining : []);
        renderItems(placedItems.filter((it) => it.x > edge));
        if (carContainer.x < edge) carContainer.x = edge;
        if (startFlag.x < edge) startFlag.visible = false;
        if (finishFlag.x < edge) finishFlag.visible = false;
      }

      if (bulldozerX > width() + 120) {
        bulldozerX = null;
        bulldozer.visible = false;
        smoothedPath = [];
        placedItems = [];
        rawPoints = [];
        totalDistance = 0;
        renderRoad([]);
        renderItems([]);
        startPoint = { x: Math.min(110, width() * 0.18), y: height() * 0.5 };
        startFlag.position.set(startPoint.x - 8, startPoint.y - 30);
        startFlag.visible = true;
        finishFlag.visible = false;
        resetCarToStart();
        setStartState('none');
        ctx.audio.playDing(880);
      }
    };

    return () => {
      isCleanedUp = true;
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
      dragCleanup?.();
      uiOverlay.remove();
      fx.destroy();
      if (app) {
        try {
          app.canvas.removeEventListener('pointerdown', onPointerDown);
          app.canvas.removeEventListener('pointermove', onPointerMove);
          app.canvas.removeEventListener('pointerup', onPointerUp);
          app.canvas.removeEventListener('pointercancel', onPointerUp);
          app.destroy(true, { children: true });
        } catch {
          // 이미 정리됨
        }
        app = null;
      }
    };
  },
};

// ==========================================
// Catmull-Rom 및 등간격 스플라인 헬퍼
// ==========================================
function generateSmoothEquidistantPath(points: Point[], step = 5): PathSample[] {
  if (points.length < 2) return [];

  const padded: Point[] = [points[0], ...points, points[points.length - 1]];
  const densePoints: Point[] = [];

  for (let i = 1; i < padded.length - 2; i++) {
    const p0 = padded[i - 1];
    const p1 = padded[i];
    const p2 = padded[i + 1];
    const p3 = padded[i + 2];

    const segments = 8;
    for (let s = 0; s < segments; s++) {
      const t = s / segments;
      densePoints.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
      });
    }
  }
  densePoints.push(points[points.length - 1]);

  // 길이 기준 등간격 재표본화 (일정한 속도)
  const samples: PathSample[] = [{ x: densePoints[0].x, y: densePoints[0].y, angle: 0, dist: 0 }];
  let currentDist = 0;
  let prev = densePoints[0];
  for (let i = 1; i < densePoints.length; i++) {
    const curr = densePoints[i];
    const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    const isLast = i === densePoints.length - 1;
    if (d >= step || (isLast && d > 0.5)) {
      currentDist += d;
      samples.push({
        x: curr.x,
        y: curr.y,
        angle: Math.atan2(curr.y - prev.y, curr.x - prev.x),
        dist: currentDist,
      });
      prev = curr;
    }
  }

  if (samples.length >= 2) samples[0].angle = samples[1].angle;
  return samples;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

function getSampleAtDistance(samples: PathSample[], targetDist: number): PathSample | null {
  if (samples.length === 0) return null;
  if (targetDist <= 0) return samples[0];
  const last = samples[samples.length - 1];
  if (targetDist >= last.dist) return last;

  // 이진 탐색
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].dist <= targetDist) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const seg = b.dist - a.dist;
  const t = seg > 0 ? (targetDist - a.dist) / seg : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    angle: lerpAngle(a.angle, b.angle, t),
    dist: targetDist,
  };
}
