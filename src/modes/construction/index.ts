import { Application, Container, Graphics } from 'pixi.js';
import { PlayMode, PlayModeContext } from '../types';
import { burst, triggerCelebrationConfetti } from '../../core/particles';

interface DirtParticle {
  gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  inBucket: boolean;
  settled: boolean;
}

export const constructionMode: PlayMode = {
  id: 'construction',
  title: '공사장 놀이',
  icon: '🚧',
  color: '#f97316',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    let app: Application | null = null;
    let animId: number | null = null;

    // 모드 설정: 2~3세 자동 모드 vs 4세 이상 직접 드래그 IK 모드
    let isDirectDragMode = false;

    // 공사 상태: 0 = 기초, 1 = 벽, 2 = 지붕, 3 = 완성
    let houseStage = 0;
    let truckDirtCount = 0;
    const MAX_TRUCK_DIRT = 40;
    let isTruckDelivering = false;

    // 굴착기 3관절 파라미터 (단위: 라디안)
    const L1 = 75; // 붐 길이
    const L2 = 65; // 암 길이
    const L3 = 35; // 버킷 길이

    let angle1 = -1.1; // 붐 각도
    let angle2 = 1.6;  // 암 각도
    let angle3 = 0.6;  // 버킷 각도

    let targetAngle1 = angle1;
    let targetAngle2 = angle2;
    let targetAngle3 = angle3;

    let dirtParticles: DirtParticle[] = [];
    let isScooping = false;

    // UI 오버레이
    const container = document.createElement('div');
    container.className =
      'absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-20';

    // 1. 상단 바: 안전 제일 현장 배지 + 모드 스위치
    const topBar = document.createElement('div');
    topBar.className =
      'pointer-events-auto flex items-center justify-between gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-3xl border-3 border-amber-400 shadow-xl ml-20 mr-2 max-w-xl self-end';

    const titleBadge = document.createElement('div');
    titleBadge.className = 'flex items-center gap-1.5';
    titleBadge.innerHTML = `
      <span class="text-2xl animate-bounce">🚧</span>
      <span class="font-black text-amber-950 text-sm md:text-base">안전제일 공사장</span>
    `;

    const ageToggleBtn = document.createElement('button');
    ageToggleBtn.className =
      'px-3 py-1.5 rounded-2xl font-black text-xs md:text-sm border-2 transition-all cursor-pointer bg-gray-100 text-gray-700 border-gray-300';
    ageToggleBtn.textContent = '조작: 2~3세 탭 모드';
    ageToggleBtn.onclick = () => {
      isDirectDragMode = !isDirectDragMode;
      ageToggleBtn.textContent = isDirectDragMode
        ? '조작: 4세+ 팔 직접 드래그'
        : '조작: 2~3세 탭 모드';
      ageToggleBtn.className = `px-3 py-1.5 rounded-2xl font-black text-xs md:text-sm border-2 transition-all cursor-pointer ${
        isDirectDragMode
          ? 'bg-amber-500 text-white border-amber-600 shadow'
          : 'bg-gray-100 text-gray-700 border-gray-300'
      }`;
      ctx.audio.playPop(550);
      ctx.audio.speak(
        isDirectDragMode ? '포크레인 팔을 직접 끌어보세요!' : '흙더미를 톡 터치하세요!'
      );
    };

    topBar.appendChild(titleBadge);
    topBar.appendChild(ageToggleBtn);
    container.appendChild(topBar);

    // 2. 하단 현황 안내 바 (건축 단계 및 트럭 짐칸 게이지)
    const bottomBar = document.createElement('div');
    bottomBar.className =
      'pointer-events-auto w-full max-w-lg mx-auto flex flex-col items-center gap-1 bg-white/95 backdrop-blur-md p-3 rounded-3xl border-3 border-amber-400 shadow-2xl mb-1';

    const stageNames = ['1. 집 기초 공사', '2. 튼튼한 벽돌 벽', '3. 빨간 지붕', '4. 예쁜 집 완성!'];
    bottomBar.innerHTML = `
      <div class="w-full flex items-center justify-between text-xs md:text-sm font-black text-amber-950">
        <span id="house-stage-label">🏗️ 집 짓기: ${stageNames[houseStage]}</span>
        <span id="truck-gauge-label">🚚 덤프트럭 짐칸: 0%</span>
      </div>
      <div class="w-full h-3.5 bg-gray-200 rounded-full overflow-hidden p-0.5 border border-amber-300">
        <div id="truck-gauge-bar" class="h-full bg-amber-500 rounded-full transition-all duration-300" style="width: 0%;"></div>
      </div>
    `;
    container.appendChild(bottomBar);

    el.appendChild(container);

    // ==================================================
    // PixiJS 렌더러 초기화
    // ==================================================
    let sceneryContainer: Container;
    let dirtMoundGfx: Graphics;
    let truckContainer: Container;
    let excavatorContainer: Container;
    let particlesContainer: Container;
    let houseSiteContainer: Container;

    // 관절별 Pixi 오브젝트
    let boomGfx: Graphics;
    let armGfx: Graphics;
    let bucketGfx: Graphics;

    let moundCenter = { x: 90, y: 0 };
    let excavatorBase = { x: 0, y: 0 };
    let truckBase = { x: 0, y: 0 };

    const initPixi = async () => {
      app = new Application();
      await app.init({
        resizeTo: el,
        backgroundColor: 0xfde68a, // 따스한 공사장 황토빛 모래색
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isCleanedUp) {
        app.destroy(true, { children: true });
        return;
      }

      el.appendChild(app.canvas);

      sceneryContainer = new Container();
      dirtMoundGfx = new Graphics();
      truckContainer = new Container();
      excavatorContainer = new Container();
      particlesContainer = new Container();
      houseSiteContainer = new Container();

      app.stage.addChild(sceneryContainer);
      app.stage.addChild(dirtMoundGfx);
      app.stage.addChild(houseSiteContainer);
      app.stage.addChild(truckContainer);
      app.stage.addChild(excavatorContainer);
      app.stage.addChild(particlesContainer);

      recalculateLayout();
      drawBackgroundDecor();
      drawDirtMound();
      drawExcavator();
      drawTruck();
      drawHouseSite();

      // 메인 Ticker 루프
      const ticker = () => {
        if (isCleanedUp) return;
        updateJoints();
        updateDirtPhysics();
        animId = requestAnimationFrame(ticker);
      };
      animId = requestAnimationFrame(ticker);
    };

    initPixi();

    const recalculateLayout = () => {
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const groundY = h - 90;

      moundCenter = { x: Math.min(130, w * 0.22), y: groundY };
      excavatorBase = { x: w * 0.46, y: groundY - 12 };
      truckBase = { x: w * 0.8, y: groundY - 12 };

      if (excavatorContainer) {
        excavatorContainer.x = excavatorBase.x;
        excavatorContainer.y = excavatorBase.y;
      }
      if (truckContainer) {
        truckContainer.x = truckBase.x;
        truckContainer.y = truckBase.y;
      }
    };

    // 배경: 주황색 공사 현장 펜스, 경고 줄무늬, 꼬깔콘
    const drawBackgroundDecor = () => {
      sceneryContainer.removeChildren();
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const groundY = h - 90;

      const g = new Graphics();

      // 하늘 그라데이션 대신 밝은 노랑 바탕 + 먼 산
      g.moveTo(0, groundY - 120).lineTo(w * 0.35, groundY - 160).lineTo(w * 0.7, groundY - 130).lineTo(w, groundY - 170).lineTo(w, groundY).lineTo(0, groundY).closePath();
      g.fill({ color: 0xfcd34d, alpha: 0.5 });

      // 바닥 지면 (흙바닥)
      g.rect(0, groundY, w, h - groundY).fill({ color: 0xb45309 });
      g.rect(0, groundY, w, 14).fill({ color: 0x92400e });

      // 안전 경고 노랑-검정 줄무늬 바
      const stripeW = 20;
      for (let i = 0; i < w / stripeW; i++) {
        g.rect(i * stripeW, groundY - 6, stripeW, 6).fill({
          color: i % 2 === 0 ? 0xfacc15 : 0x1e293b,
        });
      }

      // 안전 꼬깔콘 2개 배치 (🚧)
      [moundCenter.x + 85, truckBase.x - 70].forEach((cx) => {
        g.poly([cx, groundY - 28, cx - 12, groundY, cx + 12, groundY]).fill({ color: 0xf97316 });
        g.rect(cx - 7, groundY - 18, 14, 5).fill({ color: 0xffffff });
        g.rect(cx - 15, groundY - 2, 30, 4).fill({ color: 0x1e293b });
      });

      sceneryContainer.addChild(g);
    };

    // 왼쪽 흙더미
    const drawDirtMound = () => {
      dirtMoundGfx.clear();
      const { x, y } = moundCenter;

      // 흙더미 둔덕
      dirtMoundGfx.moveTo(x - 90, y);
      dirtMoundGfx.bezierCurveTo(x - 60, y - 90, x + 60, y - 85, x + 85, y);
      dirtMoundGfx.closePath();
      dirtMoundGfx.fill({ color: 0x78350f });

      // 흙 질감 조약돌들
      for (let i = 0; i < 15; i++) {
        const ox = x - 50 + Math.random() * 100;
        const oy = y - 10 - Math.random() * 55;
        dirtMoundGfx.circle(ox, oy, 3 + Math.random() * 3).fill({ color: 0x92400e });
      }

      dirtMoundGfx.eventMode = 'static';
      dirtMoundGfx.cursor = 'pointer';
      dirtMoundGfx.on('pointerdown', (e) => {
        e.stopPropagation();
        triggerAutoScoop();
      });
    };

    // 굴착기 본체 및 3관절 팔
    const drawExcavator = () => {
      excavatorContainer.removeChildren();

      // 1. 하부 무한궤도 캐터필러
      const trackGfx = new Graphics();
      trackGfx.roundRect(-42, 0, 84, 18, 9).fill({ color: 0x1e293b });
      for (let i = -30; i <= 30; i += 15) {
        trackGfx.circle(i, 9, 6).fill({ color: 0x64748b });
      }
      excavatorContainer.addChild(trackGfx);

      // 2. 조종석 본체 (주황색)
      const cabGfx = new Graphics();
      cabGfx.roundRect(-28, -32, 56, 32, 8).fill({ color: 0xf97316 });
      cabGfx.roundRect(-22, -28, 24, 18, 4).fill({ color: 0xbae6fd });
      cabGfx.circle(18, -12, 3).fill({ color: 0xfef08a }); // 헤드라이트
      excavatorContainer.addChild(cabGfx);

      // 3. 붐 (Boom, 제1관절)
      boomGfx = new Graphics();
      boomGfx.roundRect(-6, -6, L1 + 12, 12, 6).fill({ color: 0xf97316 });
      boomGfx.circle(0, 0, 7).fill({ color: 0x334155 });
      boomGfx.x = 10;
      boomGfx.y = -20;
      excavatorContainer.addChild(boomGfx);

      // 4. 암 (Arm, 제2관절)
      armGfx = new Graphics();
      armGfx.roundRect(-5, -5, L2 + 10, 10, 5).fill({ color: 0xf59e0b });
      armGfx.circle(0, 0, 6).fill({ color: 0x334155 });
      boomGfx.addChild(armGfx);

      // 5. 버킷 바가지 (Bucket, 제3관절)
      bucketGfx = new Graphics();
      bucketGfx.poly([0, 0, L3, -12, L3 + 8, 12, 8, 20]).fill({ color: 0x334155 });
      bucketGfx.circle(0, 0, 5).fill({ color: 0x64748b });
      armGfx.addChild(bucketGfx);

      // 인터랙션: 팔 직접 드래그 (4세 이상 모드)
      bucketGfx.eventMode = 'static';
      bucketGfx.cursor = 'grab';

      let isDraggingArm = false;
      bucketGfx.on('pointerdown', (e) => {
        if (!isDirectDragMode) return;
        isDraggingArm = true;
        e.stopPropagation();
      });

      window.addEventListener('pointermove', (e) => {
        if (!isDraggingArm) return;
        const rect = el.getBoundingClientRect();
        const mouseX = e.clientX - rect.left - (excavatorBase.x + 10);
        const mouseY = e.clientY - rect.top - (excavatorBase.y - 20);

        // 간단한 2관절 역기구학 (IK)
        const dist = Math.hypot(mouseX, mouseY);
        const clampedDist = Math.max(30, Math.min(dist, L1 + L2 - 5));

        const baseAngle = Math.atan2(mouseY, mouseX);
        const cosAngle2 = (clampedDist * clampedDist - L1 * L1 - L2 * L2) / (2 * L1 * L2);
        const ikAngle2 = Math.acos(Math.max(-1, Math.min(1, cosAngle2)));
        const ikAngle1 = baseAngle - Math.atan2(L2 * Math.sin(ikAngle2), L1 + L2 * Math.cos(ikAngle2));

        targetAngle1 = ikAngle1;
        targetAngle2 = ikAngle2;
        targetAngle3 = 0.5;

        // 흙더미 근처 도달 시 자동 흙 채우기
        if (e.clientX - rect.left < moundCenter.x + 60 && !isScooping) {
          triggerAutoScoop();
        }
      });

      window.addEventListener('pointerup', () => {
        isDraggingArm = false;
      });
    };

    // 덤프트럭
    const drawTruck = () => {
      truckContainer.removeChildren();

      const truckGfx = new Graphics();

      // 바퀴
      truckGfx.circle(-34, 10, 10).fill({ color: 0x1e293b });
      truckGfx.circle(-34, 10, 4).fill({ color: 0x94a3b8 });
      truckGfx.circle(28, 10, 10).fill({ color: 0x1e293b });
      truckGfx.circle(28, 10, 4).fill({ color: 0x94a3b8 });

      // 운전석 캡 (노란색)
      truckGfx.roundRect(14, -26, 32, 28, 6).fill({ color: 0xeab308 });
      truckGfx.roundRect(22, -22, 18, 14, 3).fill({ color: 0xe0f2fe });
      truckGfx.circle(44, -10, 3).fill({ color: 0xfef08a }); // 헤드라이트

      // 짐칸 (기울기 가능한 베드)
      truckGfx.roundRect(-46, -30, 56, 28, 4).fill({ color: 0x475569 });
      truckGfx.rect(-46, -30, 56, 4).fill({ color: 0x64748b });

      truckContainer.addChild(truckGfx);

      // 트럭 터치 시 자동 붓기
      truckContainer.eventMode = 'static';
      truckContainer.cursor = 'pointer';
      truckContainer.on('pointerdown', (e) => {
        e.stopPropagation();
        triggerAutoDump();
      });
    };

    // 집 건축 현장 (오른쪽 카메라 이동 시 등장)
    const drawHouseSite = () => {
      houseSiteContainer.removeChildren();
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      const groundY = h - 90;

      houseSiteContainer.x = w * 1.5; // 기본적으로 화면 오른쪽에 대기
      houseSiteContainer.y = groundY;

      const g = new Graphics();

      // 1. 기초 공사 단계
      if (houseStage >= 0) {
        g.roundRect(-60, -18, 120, 18, 4).fill({ color: 0x64748b });
        g.rect(-50, -12, 100, 6).fill({ color: 0x94a3b8 });
      }

      // 2. 벽돌 벽 단계
      if (houseStage >= 1) {
        g.roundRect(-50, -78, 100, 60, 4).fill({ color: 0xf97316 });
        // 창문
        const winColor = houseStage >= 3 ? 0xfef08a : 0xbae6fd;
        g.roundRect(-36, -64, 26, 26, 4).fill({ color: winColor });
        g.roundRect(10, -64, 26, 26, 4).fill({ color: winColor });
        // 문
        g.roundRect(-10, -42, 20, 42, 2).fill({ color: 0x78350f });
      }

      // 3. 지붕 단계
      if (houseStage >= 2) {
        g.poly([-62, -78, 0, -125, 62, -78]).fill({ color: 0xef4444 });
        // 굴뚝
        g.rect(26, -120, 12, 24).fill({ color: 0x78350f });
      }

      // 4. 완성 조명 효과
      if (houseStage >= 3) {
        g.circle(-23, -51, 18).fill({ color: 0xfef08a, alpha: 0.35 });
        g.circle(23, -51, 18).fill({ color: 0xfef08a, alpha: 0.35 });
      }

      houseSiteContainer.addChild(g);
    };

    // ==================================================
    // 굴착기 자동 액션 (2~3세 탭 모드)
    // ==================================================
    const triggerAutoScoop = () => {
      if (isScooping || isTruckDelivering) return;
      isScooping = true;

      ctx.audio.playExcavatorClank();
      ctx.audio.triggerHaptic(30);
      ctx.audio.speak('으랏차차! 흙을 파요!');

      // 1. 흙더미로 뻗기
      targetAngle1 = -2.1;
      targetAngle2 = 1.1;
      targetAngle3 = -0.5;

      // 2. 0.6초 뒤 흙을 푹 파올리기
      setTimeout(() => {
        if (isCleanedUp) return;
        targetAngle3 = 1.4;
        ctx.audio.playPop(350);
        burst(moundCenter.x, moundCenter.y - 40, 'dirt', 8);

        // 버킷에 흙 알갱이 35개 생성
        spawnDirtInBucket(35);

        // 3. 0.7초 뒤 번쩍 들어올리기
        setTimeout(() => {
          if (isCleanedUp) return;
          targetAngle1 = -1.2;
          targetAngle2 = 1.8;
          targetAngle3 = 1.2;
          isScooping = false;
        }, 700);
      }, 650);
    };

    const triggerAutoDump = () => {
      if (isTruckDelivering) return;

      const loadedBeads = dirtParticles.filter((p) => p.inBucket);
      if (loadedBeads.length === 0) {
        ctx.audio.playPop(420);
        ctx.audio.speak('먼저 흙더미를 눌러 흙을 퍼주세요!');
        return;
      }

      ctx.audio.playEngine();
      ctx.audio.speak('트럭에 흙을 쏟아요!');

      // 1. 덤프트럭 짐칸 위로 팔 회전
      targetAngle1 = -0.6;
      targetAngle2 = 1.5;
      targetAngle3 = 1.1;

      // 2. 트럭 위 도착 후 버킷을 콸콸 기울이기
      setTimeout(() => {
        if (isCleanedUp) return;
        targetAngle3 = -0.8; // 아래로 콸콸
        ctx.audio.playWater(); // 콸르르
        ctx.audio.playExcavatorClank();
        ctx.audio.triggerHaptic(40);

        // 버킷 속 흙들이 중력으로 쏟아짐
        loadedBeads.forEach((p) => {
          p.inBucket = false;
          p.vx = 2 + (Math.random() - 0.5) * 3;
          p.vy = 2 + Math.random() * 2;
        });

        burst(truckBase.x - 20, truckBase.y - 30, 'smoke', 5);

        // 3. 0.8초 후 팔 원위치
        setTimeout(() => {
          if (isCleanedUp) return;
          targetAngle1 = -1.1;
          targetAngle2 = 1.6;
          targetAngle3 = 0.6;
        }, 800);
      }, 700);
    };

    // 버킷 안에 흙 알갱이 생성
    const spawnDirtInBucket = (count = 35) => {
      for (let i = 0; i < count; i++) {
        const gfx = new Graphics();
        const r = 3 + Math.random() * 2.5;
        const color = [0x78350f, 0x92400e, 0xa16207, 0xb45309][Math.floor(Math.random() * 4)];
        gfx.circle(0, 0, r).fill({ color });

        particlesContainer.addChild(gfx);

        dirtParticles.push({
          gfx,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          radius: r,
          inBucket: true,
          settled: false,
        });
      }
    };

    // 굴착기 관절 부드러운 각도 보간
    const updateJoints = () => {
      angle1 += (targetAngle1 - angle1) * 0.12;
      angle2 += (targetAngle2 - angle2) * 0.12;
      angle3 += (targetAngle3 - angle3) * 0.14;

      if (boomGfx) boomGfx.rotation = angle1;
      if (armGfx) armGfx.rotation = angle2;
      if (bucketGfx) {
        bucketGfx.x = L2;
        bucketGfx.rotation = angle3;
      }
    };

    // 흙 알갱이 중력, 바닥 충돌 및 트럭 짐칸 쌓임 물리
    const updateDirtPhysics = () => {
      const h = el.clientHeight || window.innerHeight;
      const groundY = h - 90;

      // 버킷의 전역 좌표 계산
      const boomWorldX = excavatorBase.x + 10 + Math.cos(angle1) * L1;
      const boomWorldY = excavatorBase.y - 20 + Math.sin(angle1) * L1;
      const armWorldX = boomWorldX + Math.cos(angle1 + angle2) * L2;
      const armWorldY = boomWorldY + Math.sin(angle1 + angle2) * L2;
      const bucketTipX = armWorldX + Math.cos(angle1 + angle2 + angle3) * (L3 * 0.6);
      const bucketTipY = armWorldY + Math.sin(angle1 + angle2 + angle3) * (L3 * 0.6);

      const truckBedLeft = truckContainer.x - 44;
      const truckBedRight = truckContainer.x + 8;
      const truckBedY = truckContainer.y - 12;

      let newInTruckCount = 0;

      for (let i = dirtParticles.length - 1; i >= 0; i--) {
        const p = dirtParticles[i];

        if (p.inBucket) {
          // 버킷 내부 위치 고정
          p.x = bucketTipX + (Math.sin(i * 1.5) * 10);
          p.y = bucketTipY + (Math.cos(i * 1.5) * 6);
          p.gfx.x = p.x;
          p.gfx.y = p.y;
        } else if (!p.settled) {
          p.vy += 0.45; // 중력 가속도
          p.x += p.vx;
          p.y += p.vy;

          // 1. 트럭 짐칸 충돌
          if (
            p.x >= truckBedLeft &&
            p.x <= truckBedRight &&
            p.y >= truckBedY &&
            p.y <= truckBedY + 14
          ) {
            p.y = truckBedY - (i % 6) * 1.8;
            p.vx = 0;
            p.vy = 0;
            p.settled = true;
            truckDirtCount++;
            updateTruckGauge();
          }
          // 2. 바닥 지면 충돌
          else if (p.y >= groundY - 2) {
            p.y = groundY - 2;
            p.vx *= 0.5;
            p.vy *= -0.3;
            if (Math.abs(p.vy) < 0.8) {
              p.settled = true;
            }
          }

          p.gfx.x = p.x;
          p.gfx.y = p.y;
        } else {
          // 트럭이 이동할 때 실린 흙도 트럭과 함께 이동
          if (isTruckDelivering && p.x >= truckBedLeft - 30 && p.x <= truckBedRight + 30) {
            p.gfx.x = truckContainer.x - 20 + ((i % 10) * 3);
          }
        }
      }
    };

    // 트럭 짐칸 게이지 갱신 및 출발 판정
    const updateTruckGauge = () => {
      const pct = Math.min(100, Math.round((truckDirtCount / MAX_TRUCK_DIRT) * 100));
      const gaugeBar = container.querySelector('#truck-gauge-bar') as HTMLElement;
      const gaugeLabel = container.querySelector('#truck-gauge-label') as HTMLElement;

      if (gaugeBar) gaugeBar.style.width = `${pct}%`;
      if (gaugeLabel) gaugeLabel.textContent = `🚚 덤프트럭 짐칸: ${pct}%`;

      // 짐칸이 가득 차면 트럭 출발!
      if (pct >= 100 && !isTruckDelivering) {
        triggerTruckDelivery();
      }
    };

    // ==================================================
    // 덤프트럭 집 짓는 곳 배달 및 복귀 시퀀스
    // ==================================================
    const triggerTruckDelivery = () => {
      isTruckDelivering = true;
      ctx.audio.playHorn();
      ctx.audio.playEngine();
      ctx.audio.speak('빵빵! 덤프트럭 출발! 집을 지으러 가요!');

      const w = el.clientWidth || window.innerWidth;

      // 1. 카메라와 트럭이 오른쪽 집 짓는 곳으로 전진
      const startTruckX = truckContainer.x;
      let progress = 0;

      const driveInterval = setInterval(() => {
        progress += 0.035;
        truckContainer.x = startTruckX + progress * (w * 0.6);

        // 배경을 왼쪽으로 스크롤하여 카메라 이동 효과
        app!.stage.x = -progress * (w * 0.7);

        burst(truckContainer.x - 30, truckContainer.y, 'smoke', 2);

        if (progress >= 1) {
          clearInterval(driveInterval);

          // 2. 건축 현장에 도착하여 짐칸 번쩍 들기
          setTimeout(() => {
            if (isCleanedUp) return;
            ctx.audio.playExcavatorClank();
            ctx.audio.playWater();
            ctx.audio.speak('흙을 콸콸 쏟아서 집을 지어요!');

            // 트럭 짐칸 번쩍 기울이기
            truckContainer.rotation = -0.3;

            // 흙먼지 팍팍
            burst(truckContainer.x - 30, truckContainer.y - 20, 'dirt', 15);
            burst(truckContainer.x - 30, truckContainer.y - 20, 'smoke', 8);

            // 실려있던 흙 제거
            dirtParticles.forEach((p) => {
              if (p.gfx.parent) p.gfx.parent.removeChild(p.gfx);
              p.gfx.destroy();
            });
            dirtParticles = [];
            truckDirtCount = 0;

            // 3. 건축 단계 진척
            houseStage = Math.min(3, houseStage + 1);
            drawHouseSite();
            const houseLabel = container.querySelector('#house-stage-label');
            if (houseLabel) houseLabel.textContent = `🏗️ 집 짓기: ${stageNames[houseStage]}`;

            // 집 완성 시 (4번째 왕복 완료)
            if (houseStage >= 3) {
              setTimeout(() => {
                ctx.audio.playFanfare();
                ctx.audio.speak('와아! 예쁜 집이 다 지어졌어요! 멋져요!');
                triggerCelebrationConfetti();
                showHouseCompletionReward();
              }, 600);
            }

            // 4. 트럭 제자리 복귀
            setTimeout(() => {
              if (isCleanedUp) return;
              truckContainer.rotation = 0;
              ctx.audio.playEngine();

              let returnProg = 1;
              const returnInterval = setInterval(() => {
                returnProg -= 0.04;
                truckContainer.x = startTruckX + returnProg * (w * 0.6);
                app!.stage.x = -returnProg * (w * 0.7);

                if (returnProg <= 0) {
                  clearInterval(returnInterval);
                  truckContainer.x = startTruckX;
                  app!.stage.x = 0;
                  isTruckDelivering = false;
                  updateTruckGauge();
                }
              }, 25);
            }, 1200);
          }, 400);
        }
      }, 25);
    };

    // 집 완성 축하 및 스티커 보상 팝업
    const showHouseCompletionReward = () => {
      const modal = document.createElement('div');
      modal.className =
        'absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4';
      modal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 text-center border-4 border-amber-400 shadow-2xl max-w-xs animate-in zoom-in-95">
          <div class="text-6xl mb-2 animate-bounce">🏡 💡 🏆</div>
          <h3 class="font-black text-2xl text-amber-950 mb-1">집 완성!</h3>
          <p class="text-xs font-bold text-gray-500 mb-4">창문에 따뜻한 불이 켜졌어요! 칭찬 스티커를 선물로 받았어요.</p>
          <div class="flex justify-center gap-3 text-4xl mb-4">
            <span class="p-2 bg-amber-100 rounded-2xl border-2 border-amber-300 shadow">⭐</span>
            <span class="p-2 bg-amber-100 rounded-2xl border-2 border-amber-300 shadow">🏡</span>
            <span class="p-2 bg-amber-100 rounded-2xl border-2 border-amber-300 shadow">🚜</span>
          </div>
          <button id="close-complete-modal" class="w-full h-13 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-950 font-black text-lg border-2 border-amber-300 shadow cursor-pointer">
            또 다른 집 짓기!
          </button>
        </div>
      `;
      container.appendChild(modal);

      const btn = modal.querySelector('#close-complete-modal') as HTMLButtonElement;
      if (btn) {
        btn.onclick = () => {
          if (modal.parentElement) modal.parentElement.removeChild(modal);
          houseStage = 0;
          drawHouseSite();
          const houseLabel = container.querySelector('#house-stage-label');
          if (houseLabel) houseLabel.textContent = `🏗️ 집 짓기: ${stageNames[houseStage]}`;
        };
      }
    };

    window.addEventListener('resize', recalculateLayout);

    return () => {
      isCleanedUp = true;
      if (animId !== null) cancelAnimationFrame(animId);
      window.removeEventListener('resize', recalculateLayout);
      if (container.parentElement) {
        container.parentElement.removeChild(container);
      }
      if (app) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // safe
        }
      }
    };
  },
};
