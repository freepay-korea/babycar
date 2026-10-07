import { Application, Container, Graphics, Ticker } from 'pixi.js';
import { PlayMode, PlayModeContext } from '../types';
import { ParticleEngine, triggerCelebrationConfetti } from '../../core/particles';
import { useAppStore } from '../../core/store';
import { CONSTRUCTION_VEHICLES } from './vehicles';

// 화면은 '월드 좌표'로 그리고, 기기 크기에 맞춰 통째로 확대/축소함
// 땅(지면)은 y = 0, 위쪽은 음수
const SCENE_W = 580;
const MOUND_X = 90;
const EXCAVATOR_X = 270;
const TRUCK_X = 450;
const HOUSE_X = 1150;
const TRUCK_CAPACITY = 50;
const HOUSE_STEPS = 4; // 왕복 4번: 기초 → 벽 → 지붕 → 완성

// 굴착기 팔 길이 (붐, 암)
const L1 = 115;
const L2 = 95;
const PIVOT = { x: EXCAVATOR_X + 8, y: -52 };

const STAGE_ICONS = ['🧱', '🏠', '🔺', '💡'];
const STAGE_VOICES = ['기초 완성!', '벽이 생겼어요!', '지붕을 올렸어요!', '집이 다 지어졌어요!'];

type Phase = 'idle' | 'toMound' | 'dig' | 'lift' | 'toTruck' | 'dump' | 'return';
type TruckPhase = 'parked' | 'go' | 'unload' | 'celebrate' | 'back';

interface Dirt {
  g: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  state: 'bucket' | 'fall' | 'ground';
  slot: number;
  age: number;
}

const hexToNum = (hex: string) => parseInt(hex.replace('#', ''), 16);
const EXCAVATOR_COLOR = hexToNum(CONSTRUCTION_VEHICLES.find((v) => v.id === 'excavator')?.color || '#f97316');
const TRUCK_COLOR = hexToNum(CONSTRUCTION_VEHICLES.find((v) => v.id === 'dump-truck')?.color || '#eab308');

export const constructionMode: PlayMode = {
  id: 'construction',
  title: '공사장 놀이',
  icon: '🚧',
  color: '#f97316',
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

    // 4세 이상: 팔을 직접 드래그 / 2~3세: 탭하면 자동
    const dragMode = useAppStore.getState().childAge >= 4;

    // 상태
    let phase: Phase = 'idle';
    let phaseT = 0;
    let truckPhase: TruckPhase = 'parked';
    let truckLoad = 0;
    let houseStage = 0;
    let camX = 0;
    let dirt: Dirt[] = [];
    let bedHeap: number[] = new Array(10).fill(0);
    let dragging = false;
    let dragPointerId: number | null = null;
    let hintT = 0;

    // 팔 끝(버킷 관절) 현재/목표 위치 (PIVOT 기준), 버킷 각도(월드 기준)
    const tip = { x: 70, y: -80 };
    const tipTarget = { x: 70, y: -80 };
    let bucketAngle = 0;
    let bucketTarget = 0;

    // ==========================================
    // DOM UI
    // ==========================================
    const ui = document.createElement('div');
    ui.className = 'absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-20';

    const topBar = document.createElement('div');
    topBar.className =
      'flex items-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-3xl border-3 border-amber-400 shadow-xl ml-24 self-end';
    topBar.innerHTML = `
      <span class="text-3xl">🚧</span>
      <span class="font-black text-amber-950 text-base md:text-lg">${dragMode ? '팔을 끌어서 흙을 퍼요' : '흙더미를 톡!'}</span>
    `;
    ui.appendChild(topBar);

    const bottomBar = document.createElement('div');
    bottomBar.className =
      'w-full max-w-lg mx-auto flex items-center gap-3 bg-white/95 backdrop-blur-md p-2.5 rounded-3xl border-3 border-amber-400 shadow-2xl';
    bottomBar.innerHTML = `
      <div class="flex items-center gap-1 shrink-0">
        ${STAGE_ICONS.map(
          (icon, i) =>
            `<span data-stage="${i}" class="w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl bg-gray-100 opacity-40 transition-all">${icon}</span>`
        ).join('')}
      </div>
      <div class="flex-1 flex items-center gap-2">
        <span class="text-3xl">🚚</span>
        <div class="flex-1 h-5 bg-gray-200 rounded-full overflow-hidden border-2 border-amber-300">
          <div data-gauge class="h-full bg-amber-500 rounded-full transition-all duration-300" style="width:0%"></div>
        </div>
      </div>
    `;
    ui.appendChild(bottomBar);
    el.appendChild(ui);

    const updateGauge = () => {
      const pct = Math.min(100, Math.round((truckLoad / TRUCK_CAPACITY) * 100));
      const bar = bottomBar.querySelector('[data-gauge]') as HTMLElement | null;
      if (bar) bar.style.width = `${pct}%`;
    };
    const updateStageIcons = () => {
      bottomBar.querySelectorAll<HTMLElement>('[data-stage]').forEach((n) => {
        const i = Number(n.dataset.stage);
        const done = i < houseStage;
        n.className = `w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl transition-all ${
          done ? 'bg-amber-300 opacity-100 scale-110 shadow' : 'bg-gray-100 opacity-40'
        }`;
      });
    };

    // ==========================================
    // PixiJS 무대
    // ==========================================
    const world = new Container();
    const groundG = new Graphics();
    const moundG = new Graphics();
    const houseG = new Graphics();
    const truck = new Container();
    const truckBody = new Graphics();
    const bed = new Container(); // 뒤쪽 경첩을 기준으로 기울어지는 짐칸
    const bedG = new Graphics();
    const bedDirt = new Container();
    const excavator = new Container();
    const boomG = new Graphics();
    const armG = new Graphics();
    const bucketG = new Graphics();
    const dirtLayer = new Container();
    const hintG = new Graphics();
    const particleLayer = new Container();

    const initPixi = async () => {
      const a = new Application();
      try {
        await a.init({
          resizeTo: el,
          backgroundColor: 0xbae6fd,
          antialias: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          autoDensity: true,
        });
      } catch (err) {
        console.error('[construction] PixiJS 초기화 실패', err);
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
      el.insertBefore(canvas, ui);

      world.addChild(groundG, moundG, houseG, truck, excavator, dirtLayer, hintG, particleLayer);
      a.stage.addChild(world);
      fx.setContainer(particleLayer, a.ticker);

      drawGround();
      drawMound();
      drawHouse();
      drawTruck();
      drawExcavator();
      layout();

      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      a.ticker.add(update);

      if (!dragMode) later(() => ctx.audio.speak('흙더미를 톡 눌러 보세요!'), 500);
      else later(() => ctx.audio.speak('포크레인 팔을 끌어서 흙을 퍼 보세요!'), 500);
    };
    initPixi();

    // 기기 크기에 맞춰 월드 확대/축소
    let sceneScale = 1;
    let sceneOffsetX = 0;
    const layout = () => {
      if (!app) return;
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const groundScreenY = h - 100;
      sceneScale = Math.max(0.45, Math.min(w / SCENE_W, (groundScreenY - 90) / 250, 1.9));
      sceneOffsetX = (w - SCENE_W * sceneScale) / 2;
      world.scale.set(sceneScale);
      world.y = groundScreenY;
      world.x = sceneOffsetX - camX * sceneScale;
    };
    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(el);

    const drawGround = () => {
      const g = groundG;
      g.clear();
      // 먼 산
      g.moveTo(-1500, -110)
        .lineTo(150, -170)
        .lineTo(420, -120)
        .lineTo(700, -180)
        .lineTo(1000, -130)
        .lineTo(1400, -175)
        .lineTo(2600, -120)
        .lineTo(2600, 0)
        .lineTo(-1500, 0)
        .closePath()
        .fill({ color: 0xfcd34d, alpha: 0.6 });
      // 흙바닥
      g.rect(-1500, 0, 4100, 800).fill({ color: 0xb45309 });
      g.rect(-1500, 0, 4100, 12).fill({ color: 0x92400e });
      // 경고 줄무늬
      for (let x = -1500; x < 2600; x += 24) {
        g.rect(x, -6, 12, 6).fill({ color: 0xfacc15 });
        g.rect(x + 12, -6, 12, 6).fill({ color: 0x1e293b });
      }
      // 꼬깔콘
      [MOUND_X + 110, TRUCK_X - 90, HOUSE_X - 120, HOUSE_X + 230].forEach((cx) => {
        g.poly([cx, -34, cx - 14, 0, cx + 14, 0]).fill({ color: 0xf97316 });
        g.rect(cx - 8, -22, 16, 6).fill({ color: 0xffffff });
        g.roundRect(cx - 18, -3, 36, 5, 2).fill({ color: 0x1e293b });
      });
      // 집 짓는 곳 표지판
      g.rect(HOUSE_X - 175, -70, 6, 70).fill({ color: 0x78350f });
      g.roundRect(HOUSE_X - 205, -100, 66, 40, 8).fill({ color: 0xfacc15 }).stroke({ width: 3, color: 0x1e293b });
      g.poly([HOUSE_X - 190, -68, HOUSE_X - 172, -92, HOUSE_X - 154, -68]).fill({ color: 0xef4444 });
    };

    const drawMound = () => {
      const g = moundG;
      g.clear();
      g.moveTo(MOUND_X - 100, 0)
        .bezierCurveTo(MOUND_X - 70, -100, MOUND_X + 70, -100, MOUND_X + 100, 0)
        .closePath()
        .fill({ color: 0x78350f });
      let seed = 7;
      const rnd = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
      for (let i = 0; i < 18; i++) {
        g.circle(MOUND_X - 60 + rnd() * 120, -8 - rnd() * 55, 3 + rnd() * 4).fill({ color: 0x92400e });
      }
    };

    // 집: 0 = 빈 터, 1 기초, 2 벽, 3 지붕, 4 완성(창문 불 켜짐)
    const drawHouse = () => {
      const g = houseG;
      g.clear();
      const x = HOUSE_X;
      if (houseStage === 0) {
        // 점선 집터
        for (let k = -70; k < 70; k += 16) g.rect(x + k, -4, 9, 4).fill({ color: 0xfef3c7 });
      }
      if (houseStage >= 1) {
        g.roundRect(x - 80, -22, 160, 22, 4).fill({ color: 0x64748b });
        g.rect(x - 70, -15, 140, 6).fill({ color: 0x94a3b8 });
      }
      if (houseStage >= 2) {
        g.rect(x - 68, -112, 136, 90).fill({ color: 0xf97316 });
        for (let row = 0; row < 6; row++) {
          for (let col = 0; col < 6; col++) {
            const off = row % 2 === 0 ? 0 : 11;
            g.rect(x - 68 + col * 23 + off, -112 + row * 15, 21, 13).fill({ color: 0xfb923c });
          }
        }
        const lit = houseStage >= 4;
        if (lit) {
          g.circle(x - 34, -78, 30).fill({ color: 0xfef08a, alpha: 0.35 });
          g.circle(x + 34, -78, 30).fill({ color: 0xfef08a, alpha: 0.35 });
        }
        g.roundRect(x - 52, -96, 34, 34, 4).fill({ color: lit ? 0xfde047 : 0xbae6fd }).stroke({ width: 4, color: 0xffffff });
        g.roundRect(x + 18, -96, 34, 34, 4).fill({ color: lit ? 0xfde047 : 0xbae6fd }).stroke({ width: 4, color: 0xffffff });
        g.roundRect(x - 14, -62, 28, 40, 3).fill({ color: 0x78350f });
        g.circle(x + 8, -42, 3).fill({ color: 0xfacc15 });
      }
      if (houseStage >= 3) {
        g.rect(x + 30, -175, 18, 40).fill({ color: 0x78350f });
        g.poly([x - 86, -110, x, -175, x + 86, -110]).fill({ color: 0xef4444 }).stroke({ width: 4, color: 0xb91c1c });
      }
    };

    const drawTruck = () => {
      truck.removeChildren();
      const g = truckBody;
      g.clear();
      // 캡 (오른쪽)
      g.roundRect(22, -58, 46, 44, 8).fill({ color: TRUCK_COLOR });
      g.roundRect(34, -52, 26, 18, 4).fill({ color: 0xe0f2fe });
      g.circle(52, -24, 4).fill({ color: 0xffffff });
      g.circle(53.5, -24, 2).fill({ color: 0x0f172a });
      g.circle(66, -22, 4).fill({ color: 0xfef08a });
      // 차대
      g.rect(-62, -18, 130, 8).fill({ color: 0x334155 });
      // 바퀴
      [-42, 44].forEach((wx) => {
        g.circle(wx, -4, 15).fill({ color: 0x1e293b });
        g.circle(wx, -4, 6).fill({ color: 0x94a3b8 });
      });

      // 짐칸 (경첩 = 뒤쪽 아래 -62, -18)
      bed.position.set(-62, -18);
      bedG.clear();
      bedG.roundRect(0, -42, 80, 42, 4).fill({ color: 0x475569 });
      bedG.rect(4, -38, 72, 34).fill({ color: 0x334155 });
      bedG.rect(0, -42, 80, 5).fill({ color: 0x64748b });
      bed.removeChildren();
      bed.addChild(bedG, bedDirt);

      truck.addChild(bed, g);
      truck.position.set(TRUCK_X, 0);
    };

    const drawExcavator = () => {
      excavator.removeChildren();
      const base = new Graphics();
      // 무한궤도
      base.roundRect(-58, -24, 116, 24, 12).fill({ color: 0x1e293b });
      for (let i = -42; i <= 42; i += 21) base.circle(i, -12, 7).fill({ color: 0x64748b });
      // 조종석
      base.roundRect(-48, -70, 76, 46, 10).fill({ color: EXCAVATOR_COLOR });
      base.roundRect(-40, -64, 32, 26, 5).fill({ color: 0xbae6fd });
      base.circle(-30, -54, 4).fill({ color: 0xffffff });
      base.circle(-31.5, -54, 2).fill({ color: 0x0f172a });
      base.circle(-18, -54, 4).fill({ color: 0xffffff });
      base.circle(-19.5, -54, 2).fill({ color: 0x0f172a });
      base.rect(-58, -78, 30, 8).fill({ color: 0x334155 }); // 평형추
      excavator.addChild(base);
      excavator.position.set(EXCAVATOR_X, 0);

      boomG.clear();
      boomG.roundRect(-8, -9, L1 + 16, 18, 9).fill({ color: EXCAVATOR_COLOR });
      boomG.circle(0, 0, 8).fill({ color: 0x334155 });
      armG.clear();
      armG.roundRect(-7, -7, L2 + 14, 14, 7).fill({ color: 0xf59e0b });
      armG.circle(0, 0, 7).fill({ color: 0x334155 });
      // 버킷: 입구가 위(-y)를 향하는 컵 모양
      bucketG.clear();
      bucketG
        .moveTo(-22, -16)
        .lineTo(-18, 10)
        .quadraticCurveTo(0, 22, 18, 10)
        .lineTo(24, -16)
        .lineTo(16, -16)
        .lineTo(12, 4)
        .quadraticCurveTo(0, 12, -10, 4)
        .lineTo(-14, -16)
        .closePath()
        .fill({ color: 0x334155 });
      for (let k = -14; k <= 14; k += 9) bucketG.poly([k - 3, 14, k + 3, 14, k, 22]).fill({ color: 0x94a3b8 });
      bucketG.circle(0, -16, 5).fill({ color: 0x64748b });
      bucketG.pivot.set(0, -16); // 관절(경첩) 기준으로 회전

      // 관절 연결: 붐 → 암 → 버킷 (모두 월드에 직접 두고 매 프레임 위치 계산)
      world.addChild(boomG, armG, bucketG);
      world.setChildIndex(dirtLayer, world.children.length - 1);
      world.setChildIndex(hintG, world.children.length - 1);
      world.setChildIndex(particleLayer, world.children.length - 1);
    };

    // 2관절 역기구학 (팔꿈치가 위로 오도록)
    const solveIK = (tx: number, ty: number) => {
      const dist = Math.max(Math.abs(L1 - L2) + 1, Math.min(Math.hypot(tx, ty), L1 + L2 - 1));
      const cos2 = (dist * dist - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      const base = Math.atan2(ty, tx);
      let best = { a1: 0, a2: 0, elbowY: Infinity };
      for (const sign of [1, -1]) {
        const a2 = sign * Math.acos(Math.max(-1, Math.min(1, cos2)));
        const a1 = base - Math.atan2(L2 * Math.sin(a2), L1 + L2 * Math.cos(a2));
        const elbowY = Math.sin(a1) * L1;
        if (elbowY < best.elbowY) best = { a1, a2, elbowY };
      }
      return best;
    };

    // 버킷 로컬 좌표 → 월드 좌표 (경첩 기준 회전)
    const bucketToWorld = (lx: number, ly: number) => {
      const c = Math.cos(bucketAngle);
      const sn = Math.sin(bucketAngle);
      const dx = lx;
      const dy = ly + 16;
      return { x: bucketG.x + c * dx - sn * dy, y: bucketG.y + sn * dx + c * dy };
    };
    const bucketMouth = () => bucketToWorld(0, -4);

    // ==========================================
    // 자동 동작 (2~3세)
    // ==========================================
    // 목표 지점 (PIVOT 기준)
    const POSE = {
      rest: { x: 60, y: -95 },
      aboveMound: { x: -150, y: -80 },
      dig: { x: -168, y: 10 },
      lift: { x: -60, y: -125 },
      aboveTruck: { x: TRUCK_X - PIVOT.x - 15, y: -90 },
    };
    const setTip = (p: { x: number; y: number }, bucket: number) => {
      tipTarget.x = p.x;
      tipTarget.y = p.y;
      bucketTarget = bucket;
    };
    const loadedCount = () => dirt.filter((d) => d.state === 'bucket').length;

    const startScoop = () => {
      if (phase !== 'idle' || truckPhase !== 'parked' || deliveryScheduled) return;
      if (loadedCount() > 0) {
        // 이미 흙이 있으면 트럭으로 안내
        ctx.audio.playPop(500);
        ctx.audio.speak('트럭을 톡 눌러요!');
        hintT = 0;
        return;
      }
      phase = 'toMound';
      phaseT = 0;
      setTip(POSE.aboveMound, -0.6);
      ctx.audio.playExcavatorClank();
      ctx.audio.playEngine();
      ctx.audio.triggerHaptic(30);
    };

    const startDump = () => {
      if (phase !== 'idle' || truckPhase !== 'parked' || deliveryScheduled) return;
      if (loadedCount() === 0) {
        ctx.audio.playPop(420);
        ctx.audio.speak('먼저 흙더미를 톡 눌러요!');
        hintT = 0;
        return;
      }
      phase = 'toTruck';
      phaseT = 0;
      setTip(POSE.aboveTruck, 0);
      ctx.audio.playEngine();
    };

    const spawnDirtInBucket = () => {
      const count = 30 + Math.floor(Math.random() * 31); // 30~60개
      const colors = [0x78350f, 0x92400e, 0xa16207, 0xb45309];
      for (let i = 0; i < count; i++) {
        const r = 3 + Math.random() * 2.2;
        const g = new Graphics();
        g.circle(0, 0, r).fill({ color: colors[i % colors.length] });
        dirtLayer.addChild(g);
        dirt.push({ g, x: 0, y: 0, vx: 0, vy: 0, r, state: 'bucket', slot: i, age: 0 });
      }
      ctx.audio.playDirtPour();
      ctx.audio.speak('으랏차차!');
      const m = bucketMouth();
      fx.burst(m.x, m.y, 'dirt', 10);
    };

    const pourBucket = () => {
      let any = false;
      dirt.forEach((d) => {
        if (d.state !== 'bucket') return;
        any = true;
        d.state = 'fall';
        d.vx = (Math.random() - 0.5) * 1.6;
        d.vy = 0.5 + Math.random() * 1.5;
      });
      if (any) {
        ctx.audio.playDirtPour();
        ctx.audio.triggerHaptic(40);
        const m = bucketMouth();
        fx.burst(m.x, m.y + 10, 'smoke', 6);
      }
    };

    // ==========================================
    // 터치 처리
    // ==========================================
    const toWorld = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left - world.x) / world.scale.x,
        y: (e.clientY - rect.top - world.y) / world.scale.y,
      };
    };
    const hitMound = (p: { x: number; y: number }) => Math.abs(p.x - MOUND_X) < 110 && p.y > -110 && p.y < 30;
    const hitTruck = (p: { x: number; y: number }) =>
      Math.abs(p.x - truck.x) < 80 && p.y > -110 && p.y < 30;

    const onPointerDown = (e: PointerEvent) => {
      if (!app) return;
      const p = toWorld(e);
      ctx.audio.unlockAudio();

      if (dragMode && truckPhase === 'parked') {
        dragging = true;
        dragPointerId = e.pointerId;
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          // 미지원
        }
        setTip({ x: p.x - PIVOT.x, y: p.y - PIVOT.y }, bucketTarget);
        ctx.audio.playPop(420);
        return;
      }

      if (hitMound(p)) {
        startScoop();
      } else if (hitTruck(p)) {
        startDump();
      } else if (Math.abs(p.x - EXCAVATOR_X) < 70 && p.y > -90 && p.y < 10) {
        ctx.audio.playHorn();
        fx.burst(p.x, p.y, 'star', 6);
      } else {
        // 어디를 눌러도 반응 (실패 없음)
        ctx.audio.playPop(450 + Math.random() * 200);
        fx.burst(p.x, p.y, 'dirt', 4);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragPointerId) return;
      const p = toWorld(e);
      setTip({ x: p.x - PIVOT.x, y: p.y - PIVOT.y }, bucketTarget);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== dragPointerId) return;
      dragging = false;
      dragPointerId = null;
    };

    // ==========================================
    // 매 프레임
    // ==========================================
    const update = (ticker: Ticker) => {
      const d = Math.min(3, ticker.deltaTime);
      phaseT += d;
      hintT += d;

      // 팔 끝을 목표로 부드럽게 이동 → IK
      const ease = dragging ? 0.35 : 0.09;
      tip.x += (tipTarget.x - tip.x) * Math.min(1, ease * d);
      tip.y += (tipTarget.y - tip.y) * Math.min(1, ease * d);
      // 땅 밑으로는 못 들어가게
      if (PIVOT.y + tip.y > 8) tip.y = 8 - PIVOT.y;
      bucketAngle += (bucketTarget - bucketAngle) * Math.min(1, 0.12 * d);

      const { a1, a2 } = solveIK(tip.x, tip.y);
      boomG.position.set(PIVOT.x, PIVOT.y);
      boomG.rotation = a1;
      const elbow = { x: PIVOT.x + Math.cos(a1) * L1, y: PIVOT.y + Math.sin(a1) * L1 };
      armG.position.set(elbow.x, elbow.y);
      armG.rotation = a1 + a2;
      const wrist = { x: elbow.x + Math.cos(a1 + a2) * L2, y: elbow.y + Math.sin(a1 + a2) * L2 };
      bucketG.position.set(wrist.x, wrist.y);
      bucketG.rotation = bucketAngle;

      if (dragMode) updateDragMode(wrist);
      else updateAutoPhases();

      updateDirt(d);
      updateTruck(d);
      updateHint();
    };

    const updateAutoPhases = () => {
      const near = Math.hypot(tipTarget.x - tip.x, tipTarget.y - tip.y) < 6;
      switch (phase) {
        case 'toMound':
          if (near) {
            phase = 'dig';
            phaseT = 0;
            setTip(POSE.dig, -1.1);
            ctx.audio.playPop(300);
          }
          break;
        case 'dig':
          if (near || phaseT > 50) {
            fx.burst(MOUND_X - 10, -50, 'dirt', 14);
            spawnDirtInBucket();
            phase = 'lift';
            phaseT = 0;
            setTip(POSE.lift, 0);
          }
          break;
        case 'lift':
          if (near) {
            phase = 'idle';
            hintT = 0;
          }
          break;
        case 'toTruck':
          if (near) {
            phase = 'dump';
            phaseT = 0;
            bucketTarget = 2.4;
          }
          break;
        case 'dump':
          if (phaseT > 12 && loadedCount() > 0) pourBucket();
          if (phaseT > 55) {
            phase = 'return';
            setTip(POSE.rest, 0);
          }
          break;
        case 'return':
          if (near) phase = 'idle';
          break;
      }
    };

    // 4세 이상: 버킷이 흙더미에 닿으면 퍼지고, 트럭 위에서 올라가 있으면 쏟아짐
    const updateDragMode = (wrist: { x: number; y: number }) => {
      const loaded = loadedCount();
      if (loaded === 0 && truckPhase === 'parked' && Math.abs(wrist.x - MOUND_X) < 80 && wrist.y > -60) {
        bucketTarget = -1.1;
        spawnDirtInBucket();
        later(() => {
          bucketTarget = 0;
        }, 250);
      } else if (loaded > 0 && wrist.x > truck.x - 70 && wrist.x < truck.x + 25 && wrist.y < -50 && wrist.y > -200) {
        bucketTarget = 2.4;
        if (Math.abs(bucketAngle - 2.4) < 0.9) {
          pourBucket();
          later(() => {
            bucketTarget = 0;
          }, 600);
        }
      }
    };

    const bedLeft = () => truck.x - 62 + 4;
    const bedRight = () => truck.x - 62 + 76;
    const BED_FLOOR = -22;

    const updateDirt = (d: number) => {
      for (let i = dirt.length - 1; i >= 0; i--) {
        const p = dirt[i];
        if (p.state === 'bucket') {
          // 버킷 안에 소복이 (버킷이 기울면 같이 기울어짐)
          const row = Math.floor(p.slot / 10);
          const col = p.slot % 10;
          const lp = bucketToWorld(-15 + col * 3.3 + (row % 2) * 1.6, 4 - row * 3.6);
          p.x = lp.x;
          p.y = lp.y;
        } else if (p.state === 'fall') {
          p.vy += 0.35 * d;
          p.x += p.vx * d;
          p.y += p.vy * d;

          // 트럭 짐칸에 떨어지면 쌓임
          if (truckPhase === 'parked' && p.x > bedLeft() && p.x < bedRight() && p.vy > 0) {
            const col = Math.max(0, Math.min(bedHeap.length - 1, Math.floor(((p.x - bedLeft()) / (bedRight() - bedLeft())) * bedHeap.length)));
            const surface = BED_FLOOR - bedHeap[col];
            if (p.y >= surface - p.r) {
              // 짐칸 컨테이너로 옮겨서 트럭과 함께 움직이게
              dirtLayer.removeChild(p.g);
              p.g.position.set(p.x - (truck.x - 62), surface - p.r - (-18));
              bedDirt.addChild(p.g);
              bedHeap[col] = Math.min(36, bedHeap[col] + p.r * 0.55);
              dirt.splice(i, 1);
              truckLoad++;
              updateGauge();
              if (truckLoad >= TRUCK_CAPACITY && !deliveryScheduled) {
                deliveryScheduled = true;
                later(startDelivery, 700);
              }
              continue;
            }
          }
          // 땅에 떨어지면 통통 튀다 멈춤
          if (p.y >= -p.r) {
            p.y = -p.r;
            p.vy *= -0.3;
            p.vx *= 0.6;
            if (Math.abs(p.vy) < 1) p.state = 'ground';
          }
        } else {
          // 바닥 흙은 서서히 사라짐 (오래된 폰 성능 보호)
          p.age += d;
          if (p.age > 120) {
            p.g.alpha = Math.max(0, 1 - (p.age - 120) / 40);
            if (p.age > 160) {
              p.g.destroy();
              dirt.splice(i, 1);
              continue;
            }
          }
        }
        p.g.position.set(p.x, p.y);
      }
    };

    // ==========================================
    // 트럭: 빵빵 → 집 짓는 곳 → 쏟기 → 복귀
    // ==========================================
    let deliveryScheduled = false;
    const startDelivery = () => {
      truckPhase = 'go';
      deliveryScheduled = false;
      ctx.audio.playHorn();
      later(() => ctx.audio.playHorn(), 300);
      ctx.audio.speak('빵빵! 집 지으러 출발!');
      // 팔은 비켜서 기다림
      setTip(POSE.rest, 0);
    };

    const updateTruck = (d: number) => {
      const w = el.clientWidth || window.innerWidth;
      let camTarget = 0;

      if (truckPhase === 'go') {
        truck.x += 5 * d;
        if (Math.random() < 0.3) fx.burst(truck.x - 70, -20, 'smoke', 1);
        if (ctx.audio.throttle('truck-engine', 600)) ctx.audio.playEngine();
        if (truck.x >= HOUSE_X + 185) {
          truck.x = HOUSE_X + 185;
          truckPhase = 'unload';
        }
      } else if (truckPhase === 'unload') {
        bed.rotation = Math.max(-0.75, bed.rotation - 0.02 * d);
        if (bed.rotation <= -0.5 && bedDirt.children.length > 0) {
          // 짐칸 흙이 와르르
          bedDirt.removeChildren().forEach((c) => c.destroy());
          bedHeap = new Array(10).fill(0);
          ctx.audio.playDirtPour();
          fx.burst(HOUSE_X + 110, -30, 'dirt', 24);
          fx.burst(HOUSE_X + 110, -30, 'smoke', 10);
          truckLoad = 0;
          updateGauge();
          later(buildNextStage, 500);
        }
      } else if (truckPhase === 'back') {
        bed.rotation = Math.min(0, bed.rotation + 0.03 * d);
        if (bed.rotation >= 0) {
          truck.x -= 6 * d;
          if (Math.random() < 0.3) fx.burst(truck.x + 70, -20, 'smoke', 1);
          if (truck.x <= TRUCK_X) {
            truck.x = TRUCK_X;
            truckPhase = 'parked';
            ctx.audio.playHorn();
            hintT = 0;
            if (houseStage >= HOUSE_STEPS) resetHouse();
          }
        }
      }

      // 트럭이 떠나면 카메라가 트럭을 화면 가운데에 두고 따라감
      if (truckPhase !== 'parked') {
        camTarget = Math.max(0, truck.x - (w / 2 - sceneOffsetX) / world.scale.x);
      }
      camX += (camTarget - camX) * Math.min(1, 0.08 * d);
      world.x = sceneOffsetX - camX * world.scale.x;
    };

    const buildNextStage = () => {
      houseStage = Math.min(HOUSE_STEPS, houseStage + 1);
      drawHouse();
      updateStageIcons();
      ctx.audio.playDing(660 + houseStage * 110);
      ctx.audio.speak(STAGE_VOICES[houseStage - 1]);
      fx.burst(HOUSE_X, -80, 'star', 18);

      if (houseStage >= HOUSE_STEPS) {
        truckPhase = 'celebrate';
        later(() => {
          ctx.audio.playFanfare();
          triggerCelebrationConfetti();
          fx.burst(HOUSE_X, -120, 'confetti', 40);
          showReward();
        }, 700);
      } else {
        later(() => {
          truckPhase = 'back';
        }, 900);
      }
    };

    const resetHouse = () => {
      houseStage = 0;
      drawHouse();
      updateStageIcons();
    };

    const showReward = () => {
      const modal = document.createElement('div');
      modal.className =
        'absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4 pointer-events-auto';
      modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 text-center border-4 border-amber-400 shadow-2xl max-w-xs">
          <div class="text-7xl mb-2 animate-bounce">🏡</div>
          <div class="flex justify-center gap-3 text-5xl mb-4">
            <span class="p-2 bg-amber-100 rounded-2xl border-2 border-amber-300 shadow">⭐</span>
          </div>
          <button data-again class="w-full min-h-[72px] rounded-2xl bg-amber-400 active:scale-95 text-amber-950 font-black text-3xl border-2 border-amber-300 shadow cursor-pointer">🔁</button>
        </div>
      `;
      ui.appendChild(modal);
      const btn = modal.querySelector('[data-again]') as HTMLButtonElement;
      btn.onclick = () => {
        modal.remove();
        ctx.audio.playPop(600);
        truckPhase = 'back';
      };
    };

    // 다음에 누를 곳을 알려주는 통통 튀는 화살표
    const updateHint = () => {
      hintG.clear();
      if (dragMode || phase !== 'idle' || truckPhase !== 'parked' || hintT < 120) return;
      const target = loadedCount() > 0 ? { x: truck.x - 20, y: -120 } : { x: MOUND_X, y: -120 };
      const bob = Math.sin(hintT / 8) * 8;
      hintG
        .poly([target.x - 18, target.y - 20 + bob, target.x + 18, target.y - 20 + bob, target.x, target.y + 4 + bob])
        .fill({ color: 0xffffff })
        .stroke({ width: 4, color: 0xef4444 });
    };

    updateGauge();
    updateStageIcons();

    return () => {
      isCleanedUp = true;
      timers.forEach(clearTimeout);
      resizeObserver.disconnect();
      ui.remove();
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
