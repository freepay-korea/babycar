import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../core/store';
import { getModeById } from '../modes/registry';
import { audioManager } from '../core/audio';
import { getVehicleById } from '../core/vehicles';
import { ArrowLeft, Star, Volume2, VolumeX, Sparkles, RotateCcw } from 'lucide-react';
import { VehicleSelectorModal } from './VehicleSelectorModal';

interface ModeContainerProps {
  modeId: string;
  onBack: () => void;
}

export const ModeContainer: React.FC<ModeContainerProps> = ({ modeId, onBack }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [vehicleSelectorOpen, setVehicleSelectorOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const {
    selectedVehicleId,
    starsCount,
    addStar,
    soundEnabled,
    toggleSound,
  } = useAppStore();

  const mode = getModeById(modeId);
  const vehicle = getVehicleById(selectedVehicleId);

  useEffect(() => {
    if (!mode || !mountRef.current) return;

    const el = mountRef.current;
    // 기존 자식 노드 정리
    el.innerHTML = '';

    const cleanup = mode.mount(el, {
      audio: audioManager,
      vehicleId: selectedVehicleId,
      onBack,
      onComplete: () => {
        addStar(3);
        setShowCelebration(true);
      },
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [mode, selectedVehicleId, modeId, onBack, addStar]);

  if (!mode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-black mb-4">놀이 모드를 찾을 수 없어요!</h2>
        <button
          onClick={onBack}
          className="px-6 py-3 rounded-2xl bg-amber-400 text-amber-950 font-black text-lg shadow-lg"
        >
          홈으로 가기
        </button>
      </div>
    );
  }

  const handleBack = () => {
    audioManager.playPop(520);
    audioManager.triggerHaptic(20);
    onBack();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-900 overflow-hidden select-none">
      {/* 1. 상단 바: 유아를 위한 72px 이상 큰 뒤로가기 버튼과 상태 표시 */}
      <header className="relative z-30 flex items-center justify-between px-3 py-2 bg-white/95 backdrop-blur-md shadow-md border-b-4 border-yellow-200">
        {/* 뒤로 가기 큰 버튼 (최소 68px 이상 보장) */}
        <button
          onClick={handleBack}
          aria-label="뒤로가기"
          className="min-w-[68px] min-h-[64px] px-3 rounded-2xl bg-rose-500 hover:bg-rose-600 active:scale-90 border-3 border-rose-200 shadow-md flex items-center justify-center text-white font-black text-xl gap-1 transition-transform cursor-pointer"
        >
          <ArrowLeft className="w-7 h-7 stroke-[3]" />
          <span className="text-sm font-black hidden sm:inline">홈으로</span>
        </button>

        {/* 현재 탈것 뱃지 (터치하면 탈것 교체 모달 열림) */}
        <button
          onClick={() => {
            audioManager.playPop(620);
            setVehicleSelectorOpen(true);
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-100 hover:bg-amber-200 border-2 border-amber-300 shadow cursor-pointer active:scale-95 transition-transform"
        >
          <span className="text-3xl">{vehicle.emoji}</span>
          <span className="font-black text-amber-900 text-sm md:text-base hidden sm:inline">
            {vehicle.name}
          </span>
          <span className="text-xs bg-amber-300 px-2 py-0.5 rounded-full font-bold text-amber-950">
            바꾸기
          </span>
        </button>

        {/* 오른쪽 별 개수 및 소리 토글 */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-yellow-100 border-2 border-yellow-300 shadow">
            <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
            <span className="font-black text-amber-900 text-base">{starsCount}</span>
          </div>

          <button
            onClick={() => {
              toggleSound();
              audioManager.setSoundMuted(!soundEnabled);
            }}
            className="w-12 h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 border-2 border-gray-300 cursor-pointer active:scale-90"
          >
            {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* 2. 각 모드가 렌더링되는 인터랙티브 캔버스 / DOM 영역 */}
      <main ref={mountRef} className="relative flex-1 w-full h-full overflow-hidden" />

      {/* 탈것 선택 모달 */}
      <VehicleSelectorModal
        isOpen={vehicleSelectorOpen}
        onClose={() => setVehicleSelectorOpen(false)}
      />

      {/* 축하 완료 팝업 (성공 시 폭죽과 함께 별 보상) */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-yellow-300 via-amber-200 to-orange-300 p-6 text-center border-6 border-white shadow-2xl">
            <div className="text-6xl animate-bounce mb-2">🎉 ⭐ 🏆</div>
            <h3 className="font-black text-3xl text-amber-950 mb-1">참 잘했어요!</h3>
            <p className="font-bold text-amber-900 text-base mb-4">
              별 3개를 선물로 받았어요!
            </p>

            <div className="flex justify-center gap-2 text-4xl mb-6">
              <span className="animate-spin text-amber-500">⭐</span>
              <span className="animate-bounce text-amber-500">⭐</span>
              <span className="animate-pulse text-amber-500">⭐</span>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  audioManager.playPop(500);
                  setShowCelebration(false);
                }}
                className="w-full h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 border-3 border-emerald-200 text-white font-black text-2xl shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-6 h-6 stroke-[3]" /> 또 놀기!
              </button>

              <button
                onClick={() => {
                  setShowCelebration(false);
                  onBack();
                }}
                className="w-full h-14 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 border-3 border-amber-200 text-amber-950 font-black text-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-5 h-5" /> 다른 놀이 하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
