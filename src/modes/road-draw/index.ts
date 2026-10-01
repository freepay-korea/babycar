import { Application, Container, Graphics } from 'pixi.js';
import { PlayMode, PlayModeContext } from '../types';
import { getCombinedVehicles, VehicleData, getVehicleById } from '../../core/vehicles';
import { useAppStore } from '../../core/store';
import { burst, triggerCelebrationConfetti } from '../../core/particles';

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
  id: string;
  type: RoadItemType;
  dist: number; // 경로 상의 위치(거리)
  x: number;
  y: number;
  angle: number;
  state?: 'red' | 'green';
}

export const roadDrawMode: PlayMode = {
  id: 'road-draw',
  title: '길 그리기 드라이브',
  icon: '🛤️',
  color: '#10b981',
  minAge: 2,
  locked: false,
  mount: (el: HTMLElement, ctx: PlayModeContext) => {
    let isCleanedUp = false;
    let app: Application | null = null;
    let animId: number | null = null;

    // 현재 선택된 탈것
    let currentVehicle: VehicleData = getVehicleById(ctx.vehicleId || 'bus');
    let easyMode2yo = false; // 2세 쉬운 모드 (손가락 바로 따라오기)

    // 상태
    let rawPoints: Point[] = [];
    let isDrawing = false;
    let smoothedPath: PathSample[] = [];
    let placedItems: PlacedItem[] = [];

    // 주행 상태
    let isDriving = false;
    let driveProgress = 0; // 0 ~ totalDistance
    let totalDistance = 0;
    let driveSpeed = 5.5;
    let waitingAtTraffic = false;

    // DOM UI 컨테이너
    const uiOverlay = document.createElement('div');
    uiOverlay.className =
      'absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-20';

    // 1. 상단 바: 탈것 선택기 & 2세 쉽게 모드 토글
    const topBar = document.createElement('div');
    topBar.className =
      'pointer-events-auto flex items-center justify-between gap-2 bg-white/90 backdrop-blur-md p-2 rounded-3xl border-3 border-emerald-300 shadow-xl ml-20 mr-2 max-w-xl self-end';

    // 탈것 고르기 슬롯
    const vehiclePicker = document.createElement('div');
    vehiclePicker.className = 'flex items-center gap-1.5 overflow-x-auto py-1 px-1';

    const customCars = useAppStore.getState().customCars || [];
    const allVehicles = getCombinedVehicles(customCars);

    allVehicles.forEach((v) => {
      const vBtn = document.createElement('button');
      vBtn.className = `w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl border-2 transition-all cursor-pointer ${
        currentVehicle.id === v.id
          ? 'bg-amber-300 border-amber-500 scale-105 shadow'
          : 'bg-white border-gray-200 hover:bg-gray-50'
      }`;
      vBtn.innerHTML = v.emoji;
      vBtn.onclick = (e) => {
        e.stopPropagation();
        currentVehicle = v;
        ctx.audio.playPop(550);
        ctx.audio.speak(v.name);
        updateVehicleButtons();
        drawCar();
      };
      vehiclePicker.appendChild(vBtn);
    });

    const updateVehicleButtons = () => {
      const buttons = vehiclePicker.querySelectorAll('button');
      buttons.forEach((btn, idx) => {
        const v = allVehicles[idx];
        if (v && currentVehicle.id === v.id) {
          btn.className =
            'w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl border-2 bg-amber-300 border-amber-500 scale-105 shadow cursor-pointer';
        } else {
          btn.className =
            'w-11 h-11 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-2xl border-2 bg-white border-gray-200 hover:bg-gray-50 cursor-pointer';
        }
      });
    };

    // 2세 모드 스위치
    const easyModeBtn = document.createElement('button');
    easyModeBtn.className =
      'px-3 py-1.5 rounded-2xl font-black text-xs md:text-sm bg-gray-100 text-gray-600 border-2 border-gray-300 shrink-0 cursor-pointer';
    easyModeBtn.textContent = '2세 따라오기: 꺼짐';
    easyModeBtn.onclick = () => {
      easyMode2yo = !easyMode2yo;
      easyModeBtn.textContent = `2세 따라오기: ${easyMode2yo ? '켜짐' : '꺼짐'}`;
      easyModeBtn.className = `px-3 py-1.5 rounded-2xl font-black text-xs md:text-sm border-2 shrink-0 cursor-pointer ${
        easyMode2yo
          ? 'bg-emerald-500 text-white border-emerald-600 shadow'
          : 'bg-gray-100 text-gray-600 border-gray-300'
      }`;
      ctx.audio.playPop(600);
      ctx.audio.speak(easyMode2yo ? '손가락을 바로 따라와요' : '직접 그려서 달려요');
    };

    topBar.appendChild(vehiclePicker);
    topBar.appendChild(easyModeBtn);
    uiOverlay.appendChild(topBar);

    // 2. 하단 액션 버튼 바: 아이템 4종(터널, 다리, 신호등, 점프대) + 다시 달리기 / 모두 지우기
    const bottomControls = document.createElement('div');
    bottomControls.className =
      'pointer-events-auto w-full max-w-2xl mx-auto flex flex-col items-center gap-2 mb-2';

    // 아이템 배치 트레이
    const itemsTray = document.createElement('div');
    itemsTray.className =
      'flex items-center justify-center gap-2 bg-white/95 backdrop-blur-md px-4 py-2 rounded-3xl border-3 border-emerald-300 shadow-xl';

    const itemDefs: Array<{ type: RoadItemType; label: string; icon: string }> = [
      { type: 'tunnel', label: '터널', icon: '🚇' },
      { type: 'bridge', label: '다리', icon: '🌉' },
      { type: 'traffic', label: '신호등', icon: '🚦' },
      { type: 'jump', label: '점프대', icon: '🎪' },
    ];

    itemDefs.forEach((item) => {
      const itemBtn = document.createElement('button');
      itemBtn.className =
        'flex flex-col items-center justify-center w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-amber-50 hover:bg-amber-100 active:scale-90 border-2 border-amber-300 cursor-pointer shadow transition-transform';
      itemBtn.innerHTML = `
        <span class="text-2xl md:text-3xl">${item.icon}</span>
        <span class="text-[10px] md:text-xs font-black text-amber-900">${item.label}</span>
      `;
      itemBtn.onclick = () => {
        addItemToRoad(item.type);
      };
      itemsTray.appendChild(itemBtn);
    });

    // 동작 버튼 (다시 달리기, 모두 지우기)
    const actionBtns = document.createElement('div');
    actionBtns.className = 'flex items-center gap-3';

    const rerunBtn = document.createElement('button');
    rerunBtn.className =
      'px-5 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm md:text-base border-2 border-emerald-300 shadow-lg flex items-center gap-1.5 cursor-pointer';
    rerunBtn.innerHTML = '<span>🚀</span><span>다시 달리기</span>';
    rerunBtn.onclick = () => {
      if (smoothedPath.length > 0) {
        startDrive();
      } else {
        ctx.audio.playPop(400);
        ctx.audio.speak('먼저 길을 그려주세요!');
      }
    };

    const clearBtn = document.createElement('button');
    clearBtn.className =
      'px-5 py-2.5 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-sm md:text-base border-2 border-rose-300 shadow-lg flex items-center gap-1.5 cursor-pointer';
    clearBtn.innerHTML = '<span>🚜</span><span>모두 지우기</span>';
    clearBtn.onclick = () => {
      triggerBulldozerClear();
    };

    actionBtns.appendChild(rerunBtn);
    actionBtns.appendChild(clearBtn);

    bottomControls.appendChild(itemsTray);
    bottomControls.appendChild(actionBtns);
    uiOverlay.appendChild(bottomControls);

    el.appendChild(uiOverlay);

    // ==========================================
    // PixiJS 무대 및 그래픽스 초기화
    // ==========================================
    let roadGraphics: Graphics;
    let sceneryContainer: Container;
    let itemsContainer: Container;
    let carContainer: Container;
    let startFlagContainer: Container;
    let finishFlagContainer: Container;
    let bulldozerContainer: Container;

    const startX = 80;
    const startY = 160;

    const initPixi = async () => {
      app = new Application();
      await app.init({
        resizeTo: el,
        backgroundColor: 0x86efac, // 포근한 잔디밭 초록
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isCleanedUp) {
        app.destroy(true, { children: true });
        return;
      }

      el.appendChild(app.canvas);

      // 레이어 구조
      sceneryContainer = new Container();
      roadGraphics = new Graphics();
      itemsContainer = new Container();
      startFlagContainer = new Container();
      finishFlagContainer = new Container();
      carContainer = new Container();
      bulldozerContainer = new Container();

      app.stage.addChild(sceneryContainer);
      app.stage.addChild(roadGraphics);
      app.stage.addChild(itemsContainer);
      app.stage.addChild(startFlagContainer);
      app.stage.addChild(finishFlagContainer);
      app.stage.addChild(carContainer);
      app.stage.addChild(bulldozerContainer);

      drawLawnDecorations();
      drawStartFlag(startX, startY);

      // 시작 시 차 대기
      carContainer.x = startX;
      carContainer.y = startY;
      drawCar();

      // 메인 애니메이션 렌더 루프
      const ticker = () => {
        if (isCleanedUp) return;
        updateDrive();
        animId = requestAnimationFrame(ticker);
      };
      animId = requestAnimationFrame(ticker);
    };

    initPixi();

    // 잔디밭 꽃 및 클로버 장식
    const drawLawnDecorations = () => {
      sceneryContainer.removeChildren();
      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;

      // 귀여운 작은 들꽃들
      for (let i = 0; i < 35; i++) {
        const flower = new Graphics();
        const fx = Math.random() * w;
        const fy = Math.random() * h;
        const col = [0xfef08a, 0xf472b6, 0xffffff, 0xbae6fd][Math.floor(Math.random() * 4)];
        flower.circle(0, 0, 5).fill({ color: col });
        flower.circle(0, 0, 2).fill({ color: 0xf59e0b });
        flower.x = fx;
        flower.y = fy;
        sceneryContainer.addChild(flower);
      }
    };

    // 출발 깃발 그리기
    const drawStartFlag = (x: number, y: number) => {
      startFlagContainer.removeChildren();
      const g = new Graphics();
      // 깃대
      g.rect(0, -38, 4, 38).fill({ color: 0x475569 });
      // 깃발 (초록색 깃발 ⛳)
      g.moveTo(4, -38).lineTo(26, -26).lineTo(4, -14).closePath();
      g.fill({ color: 0x22c55e });
      // 깃발 받침
      g.ellipse(2, 0, 8, 3).fill({ color: 0x334155 });
      startFlagContainer.addChild(g);
      startFlagContainer.x = x;
      startFlagContainer.y = y;
    };

    // 도착 깃발 그리기
    const drawFinishFlag = (x: number, y: number) => {
      finishFlagContainer.removeChildren();
      const g = new Graphics();
      // 깃대
      g.rect(0, -42, 4, 42).fill({ color: 0x1e293b });
      // 체크 깃발 🏁
      const size = 6;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          const isBlack = (r + c) % 2 === 0;
          g.rect(4 + c * size, -42 + r * size, size, size).fill({
            color: isBlack ? 0x000000 : 0xffffff,
          });
        }
      }
      finishFlagContainer.addChild(g);
      finishFlagContainer.x = x;
      finishFlagContainer.y = y;
      finishFlagContainer.visible = true;
    };

    // 자동차 그리기 (현재 선택된 차 색상 및 얼굴 적용)
    const drawCar = () => {
      carContainer.removeChildren();
      const g = new Graphics();
      const vColor = parseInt(currentVehicle.bgColor.replace('#', '0x'), 16) || 0xef4444;

      // 차체 (폭 44px, 높이 24px)
      g.roundRect(-22, -12, 44, 24, 8).fill({ color: vColor });
      // 운전석 창문
      g.roundRect(0, -9, 14, 18, 4).fill({ color: 0xe0f2fe });
      // 헤드라이트
      g.circle(21, -6, 3).fill({ color: 0xfef08a });
      g.circle(21, 6, 3).fill({ color: 0xfef08a });

      // 앞뒤 바퀴
      g.roundRect(-16, -15, 8, 4, 2).fill({ color: 0x1e293b });
      g.roundRect(8, -15, 8, 4, 2).fill({ color: 0x1e293b });
      g.roundRect(-16, 11, 8, 4, 2).fill({ color: 0x1e293b });
      g.roundRect(8, 11, 8, 4, 2).fill({ color: 0x1e293b });

      // 깜찍한 눈
      g.circle(12, -4, 2.5).fill({ color: 0x0f172a });
      g.circle(13, -4.5, 0.9).fill({ color: 0xffffff });
      g.circle(12, 4, 2.5).fill({ color: 0x0f172a });
      g.circle(13, 3.5, 0.9).fill({ color: 0xffffff });

      carContainer.addChild(g);
    };

    // ==========================================
    // 도로 터치 드로잉 핸들러
    // ==========================================
    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      if (isDriving) return;

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      isDrawing = true;
      rawPoints = [{ x, y }];
      placedItems = [];
      finishFlagContainer.visible = false;

      ctx.audio.playPop(480);
      ctx.audio.triggerHaptic(15);

      if (easyMode2yo) {
        carContainer.x = x;
        carContainer.y = y;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawing) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const last = rawPoints[rawPoints.length - 1];
      const dist = Math.hypot(x - last.x, y - last.y);

      // 최소 12px 이동 시 점 추가
      if (dist >= 12) {
        rawPoints.push({ x, y });
        renderRoadLive(rawPoints);

        if (easyMode2yo) {
          const angle = Math.atan2(y - last.y, x - last.x);
          carContainer.x = x;
          carContainer.y = y;
          carContainer.rotation = angle;
          ctx.audio.playEngine();
          burst(x, y, 'smoke', 2);
        }
      }
    };

    const onPointerUp = () => {
      if (!isDrawing) return;
      isDrawing = false;

      // 80px보다 짧은 길은 "부릉?" 소리만 내고 무시
      let lengthSum = 0;
      for (let i = 1; i < rawPoints.length; i++) {
        lengthSum += Math.hypot(
          rawPoints[i].x - rawPoints[i - 1].x,
          rawPoints[i].y - rawPoints[i - 1].y
        );
      }

      if (lengthSum < 80) {
        ctx.audio.playPop(300);
        ctx.audio.speak('부릉? 더 길게 그려줘요!');
        roadGraphics.clear();
        rawPoints = [];
        return;
      }

      // Catmull-Rom 스플라인 보간 및 등간격 재표본화
      smoothedPath = generateSmoothEquidistantPath(rawPoints, 5);
      totalDistance = smoothedPath[smoothedPath.length - 1]?.dist || 0;

      // 최종 매끄러운 도로 렌더링
      renderRoadFinal(smoothedPath);

      // 도착 깃발 표시
      const lastPoint = smoothedPath[smoothedPath.length - 1];
      drawFinishFlag(lastPoint.x, lastPoint.y);

      // 0.3초 뒤 선택한 차가 도로를 따라 달림
      setTimeout(() => {
        if (!isCleanedUp) {
          startDrive();
        }
      }, 300);
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    // 실시간 드로잉 도로 렌더 (폭 56px)
    const renderRoadLive = (points: Point[]) => {
      roadGraphics.clear();
      if (points.length < 2) return;

      // 도로 아스팔트 바닥 (폭 56px)
      roadGraphics.beginPath();
      roadGraphics.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        roadGraphics.lineTo(points[i].x, points[i].y);
      }
      roadGraphics.stroke({ width: 56, color: 0x334155, cap: 'round', join: 'round' });

      // 흰색 점선 중앙선
      for (let i = 1; i < points.length; i += 2) {
        roadGraphics.circle(points[i].x, points[i].y, 3).fill({ color: 0xffffff });
      }
    };

    // 완성된 매끄러운 도로 렌더
    const renderRoadFinal = (samples: PathSample[]) => {
      roadGraphics.clear();
      if (samples.length < 2) return;

      // 1. 도로 외곽선 (테두리 62px)
      roadGraphics.beginPath();
      roadGraphics.moveTo(samples[0].x, samples[0].y);
      for (let i = 1; i < samples.length; i++) {
        roadGraphics.lineTo(samples[i].x, samples[i].y);
      }
      roadGraphics.stroke({ width: 62, color: 0x1e293b, cap: 'round', join: 'round' });

      // 2. 도로 메인 아스팔트 (56px)
      roadGraphics.beginPath();
      roadGraphics.moveTo(samples[0].x, samples[0].y);
      for (let i = 1; i < samples.length; i++) {
        roadGraphics.lineTo(samples[i].x, samples[i].y);
      }
      roadGraphics.stroke({ width: 56, color: 0x334155, cap: 'round', join: 'round' });

      // 3. 흰 점선 중앙선
      for (let i = 0; i < samples.length; i += 6) {
        const s = samples[i];
        roadGraphics
          .rect(-6, -2, 12, 4)
          .fill({ color: 0xffffff });
        roadGraphics.pivot.set(0, 0);
      }

      // 배치된 아이템 다시 그리기
      renderPlacedItems();
    };

    // ==========================================
    // 주행 로직
    // ==========================================
    const startDrive = () => {
      if (smoothedPath.length === 0) return;
      isDriving = true;
      driveProgress = 0;
      waitingAtTraffic = false;
      ctx.audio.playEngine();
      ctx.audio.triggerHaptic(25);
    };

    const updateDrive = () => {
      if (!isDriving || smoothedPath.length === 0) return;
      if (waitingAtTraffic) return;

      driveProgress += driveSpeed;

      // 현재 주행 위치 샘플 찾기
      const currentSample = getSampleAtDistance(smoothedPath, driveProgress);
      if (!currentSample) return;

      carContainer.x = currentSample.x;
      carContainer.y = currentSample.y;
      carContainer.rotation = currentSample.angle;

      // 달리는 동안 뒤로 퐁퐁 먼지 파티클
      if (Math.random() < 0.4) {
        const backX = currentSample.x - Math.cos(currentSample.angle) * 22;
        const backY = currentSample.y - Math.sin(currentSample.angle) * 22;
        burst(backX, backY, 'smoke', 2);
      }

      // 도로 위 아이템 상호작용 체크
      for (const item of placedItems) {
        if (Math.abs(item.dist - driveProgress) < 16) {
          if (item.type === 'tunnel') {
            // 터널 안으로 숨었다 나오며 울림
            carContainer.alpha = 0.25;
            ctx.audio.playPop(260);
          } else if (item.type === 'bridge') {
            // 다리 건너기: 물소리
            ctx.audio.playWater();
          } else if (item.type === 'jump') {
            // 점프대: 폴짝 점프
            carContainer.y -= 18;
            ctx.audio.playDing(1200);
            burst(currentSample.x, currentSample.y, 'star', 6);
          } else if (item.type === 'traffic' && item.state === 'red') {
            // 빨간불에 멈춤
            waitingAtTraffic = true;
            ctx.audio.playHorn();
            ctx.audio.speak('신호등을 탭해서 초록불로 바꿔요!');
          }
        } else if (item.type === 'tunnel' && driveProgress > item.dist + 30) {
          carContainer.alpha = 1;
        }
      }

      // 도착 깃발 도달 시
      if (driveProgress >= totalDistance) {
        isDriving = false;
        driveProgress = totalDistance;
        carContainer.alpha = 1;

        ctx.audio.playFanfare();
        ctx.audio.speak('도착! 정말 잘 달렸어요!');
        triggerCelebrationConfetti();
        burst(currentSample.x, currentSample.y, 'star', 20);
      }
    };

    // ==========================================
    // 아이템 배치 및 상호작용
    // ==========================================
    const addItemToRoad = (type: RoadItemType) => {
      if (smoothedPath.length === 0) {
        ctx.audio.playPop(350);
        ctx.audio.speak('먼저 길을 그려주세요!');
        return;
      }

      // 도로 중앙 근처(30%~70% 지점)에 순차적으로 자동 배치
      const offsetRatio = 0.25 + (placedItems.length * 0.2) % 0.6;
      const targetDist = totalDistance * offsetRatio;
      const sample = getSampleAtDistance(smoothedPath, targetDist);
      if (!sample) return;

      const newItem: PlacedItem = {
        id: Math.random().toString(),
        type,
        dist: targetDist,
        x: sample.x,
        y: sample.y,
        angle: sample.angle,
        state: type === 'traffic' ? 'red' : undefined,
      };

      placedItems.push(newItem);
      ctx.audio.playDing(880);
      burst(sample.x, sample.y, 'star', 8);
      renderPlacedItems();
    };

    const renderPlacedItems = () => {
      itemsContainer.removeChildren();

      placedItems.forEach((item) => {
        const g = new Graphics();
        g.x = item.x;
        g.y = item.y;
        g.rotation = item.angle;

        if (item.type === 'tunnel') {
          // 터널 아치 (폭 64px)
          g.roundRect(-30, -32, 60, 64, 12).fill({ color: 0x475569 });
          g.roundRect(-22, -26, 44, 52, 8).fill({ color: 0x0f172a });
          g.rect(-30, 24, 60, 8).fill({ color: 0xf59e0b });
        } else if (item.type === 'bridge') {
          // 다리와 아래 흐르는 강물
          g.rect(-35, -34, 70, 68).fill({ color: 0x0284c7 });
          g.rect(-35, -30, 70, 6).fill({ color: 0x94a3b8 });
          g.rect(-35, 24, 70, 6).fill({ color: 0x94a3b8 });
        } else if (item.type === 'jump') {
          // 노란색 점프대 램프
          g.poly([-20, -20, 20, -20, 10, -28]).fill({ color: 0xf59e0b });
          g.roundRect(-16, -24, 32, 48, 6).fill({ color: 0xfacc15 });
          g.rect(-16, -4, 32, 8).fill({ color: 0xef4444 });
        } else if (item.type === 'traffic') {
          // 신호등 (빨간불 / 초록불 탭 가능)
          const isRed = item.state === 'red';
          g.rect(20, -30, 18, 40).fill({ color: 0x1e293b });
          g.circle(29, -20, 6).fill({ color: isRed ? 0xef4444 : 0x475569 });
          g.circle(29, -6, 6).fill({ color: isRed ? 0x475569 : 0x22c55e });
          g.rect(27, 10, 4, 18).fill({ color: 0x64748b });

          g.eventMode = 'static';
          g.cursor = 'pointer';
          g.on('pointerdown', (e) => {
            e.stopPropagation();
            item.state = item.state === 'red' ? 'green' : 'red';
            ctx.audio.playPop(700);
            renderPlacedItems();
            if (waitingAtTraffic && item.state === 'green') {
              waitingAtTraffic = false;
              ctx.audio.playHorn();
              ctx.audio.speak('초록불 출발!');
            }
          });
        }

        itemsContainer.addChild(g);
      });
    };

    // ==========================================
    // 모두 지우기 (불도저가 화면을 쓱 밀며 지나감)
    // ==========================================
    const triggerBulldozerClear = () => {
      isDriving = false;
      waitingAtTraffic = false;
      ctx.audio.playExcavatorClank();
      ctx.audio.playEngine();
      ctx.audio.speak('불도저가 출동해요!');

      bulldozerContainer.removeChildren();
      const bGfx = new Graphics();
      // 힘센 불도저 본체
      bGfx.roundRect(-40, -25, 80, 50, 10).fill({ color: 0xf59e0b });
      bGfx.rect(-50, -18, 12, 36).fill({ color: 0x1e293b });
      // 불도저 앞 밀대 블레이드
      bGfx.roundRect(35, -35, 14, 70, 4).fill({ color: 0x334155 });
      // 무한궤도 바퀴
      bGfx.roundRect(-42, -28, 84, 8, 4).fill({ color: 0x0f172a });
      bGfx.roundRect(-42, 20, 84, 8, 4).fill({ color: 0x0f172a });
      bulldozerContainer.addChild(bGfx);

      const w = el.clientWidth || window.innerWidth;
      const h = el.clientHeight || window.innerHeight;
      bulldozerContainer.y = h * 0.5;

      let bX = -120;
      const bSpeed = 18;

      const runBulldozer = () => {
        bX += bSpeed;
        bulldozerContainer.x = bX;
        burst(bX, h * 0.5, 'smoke', 3);

        if (bX > w * 0.5 && roadGraphics) {
          roadGraphics.clear();
          placedItems = [];
          itemsContainer.removeChildren();
          finishFlagContainer.visible = false;
          rawPoints = [];
          smoothedPath = [];
        }

        if (bX < w + 160) {
          requestAnimationFrame(runBulldozer);
        } else {
          bulldozerContainer.removeChildren();
          carContainer.x = startX;
          carContainer.y = startY;
          carContainer.rotation = 0;
          carContainer.alpha = 1;
        }
      };

      requestAnimationFrame(runBulldozer);
    };

    return () => {
      isCleanedUp = true;
      if (animId !== null) cancelAnimationFrame(animId);
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      if (uiOverlay.parentElement) {
        uiOverlay.parentElement.removeChild(uiOverlay);
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

    const segments = 12;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      densePoints.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
      });
    }
  }

  // 등간격 재표본화
  const samples: PathSample[] = [];
  let currentDist = 0;
  samples.push({
    x: densePoints[0].x,
    y: densePoints[0].y,
    angle: 0,
    dist: 0,
  });

  let prev = densePoints[0];
  for (let i = 1; i < densePoints.length; i++) {
    const curr = densePoints[i];
    const d = Math.hypot(curr.x - prev.x, curr.y - prev.y);

    if (d >= step) {
      currentDist += d;
      const angle = Math.atan2(curr.y - prev.y, curr.x - prev.x);
      samples.push({
        x: curr.x,
        y: curr.y,
        angle,
        dist: currentDist,
      });
      prev = curr;
    }
  }

  if (samples.length >= 2) {
    samples[0].angle = samples[1].angle;
  }

  return samples;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (2 * p1 - 2 * p2 + v0 + v1) * t3 + (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 + v0 * t + p1;
}

function getSampleAtDistance(samples: PathSample[], targetDist: number): PathSample | null {
  if (samples.length === 0) return null;
  if (targetDist <= 0) return samples[0];
  if (targetDist >= samples[samples.length - 1].dist) return samples[samples.length - 1];

  for (let i = 0; i < samples.length - 1; i++) {
    if (targetDist >= samples[i].dist && targetDist <= samples[i + 1].dist) {
      const segDist = samples[i + 1].dist - samples[i].dist;
      const ratio = segDist > 0 ? (targetDist - samples[i].dist) / segDist : 0;
      return {
        x: samples[i].x + (samples[i + 1].x - samples[i].x) * ratio,
        y: samples[i].y + (samples[i + 1].y - samples[i].y) * ratio,
        angle: samples[i].angle,
        dist: targetDist,
      };
    }
  }

  return samples[samples.length - 1];
}
