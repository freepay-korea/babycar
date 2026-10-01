import React, { useState } from 'react';
import { useAppStore } from '../core/store';
import { getAllModes } from '../modes/registry';
import { getVehicleById } from '../core/vehicles';
import { audioManager } from '../core/audio';
import { Lock, Star, Sparkles, Settings } from 'lucide-react';
import { VehicleSelectorModal } from './VehicleSelectorModal';
import { ParentGateModal } from './ParentGateModal';
import { ParentSettingsModal } from './ParentSettingsModal';

interface HomeViewProps {
  onSelectMode: (modeId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onSelectMode }) => {
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [parentGateOpen, setParentGateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    selectedVehicleId,
    starsCount,
    timerActive,
    timeRemainingSeconds,
  } = useAppStore();

  const currentVehicle = getVehicleById(selectedVehicleId);
  const modes = getAllModes();

  const handleModeClick = (modeId: string) => {
    audioManager.playPop(580);
    audioManager.playEngineRev();
    audioManager.triggerHaptic(30);
    onSelectMode(modeId);
  };

  const handleVehicleTap = () => {
    // 탈것 고유 소리
    if (currentVehicle.soundType === 'fire' || currentVehicle.soundType === 'police') {
      audioManager.playSiren(1);
    } else if (currentVehicle.soundType === 'bus') {
      audioManager.playHorn();
    } else if (currentVehicle.soundType === 'train') {
      audioManager.playTrainWhistle();
    } else {
      audioManager.playEngineRev();
    }
    audioManager.triggerHaptic(30);
    setVehicleModalOpen(true);
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-y-auto overflow-x-hidden bg-gradient-to-b from-sky-300 via-sky-100 to-amber-100 select-none pb-6">
      {/* 1. 상단 바 (헤더) */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3">
        {/* 별 개수 표시 */}
        <div className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/90 backdrop-blur-md border-3 border-amber-300 shadow-md">
          <Star className="w-6 h-6 text-amber-500 fill-amber-400 animate-pulse" />
          <span className="font-black text-amber-900 text-lg md:text-xl">{starsCount}</span>
        </div>

        {/* 부모 게이트 설정 버튼 (자물쇠 아이콘) */}
        <button
          onClick={() => {
            audioManager.playPop(440);
            setParentGateOpen(true);
          }}
          aria-label="부모 설정"
          className="w-13 h-13 rounded-2xl bg-white/90 backdrop-blur-md border-3 border-amber-300 shadow-md flex items-center justify-center text-amber-800 hover:bg-white active:scale-90 transition-transform cursor-pointer"
        >
          <div className="relative">
            <Settings className="w-6 h-6 text-amber-700" />
            <Lock className="w-3.5 h-3.5 text-amber-900 absolute -bottom-1 -right-1" />
          </div>
        </button>
      </header>

      {/* 놀이 시간 초과 시 휴식 알림 */}
      {timerActive && timeRemainingSeconds <= 0 && (
        <div className="mx-4 mb-2 p-3 bg-purple-500 text-white rounded-2xl text-center font-black shadow-lg animate-bounce">
          🌙 잠시 눈을 쉬어줄 시간이에요! 친구들과 잠시 쉬어가요.
        </div>
      )}

      {/* 2. 메인 타이틀 & 큼직한 탈것 아바타 */}
      <div className="flex flex-col items-center justify-center px-4 my-2 text-center z-10">
        <div className="inline-flex items-center gap-2 mb-1">
          <span className="text-3xl animate-bounce">✨</span>
          <h1 className="text-4xl md:text-5xl font-black text-amber-950 tracking-tight drop-shadow-sm">
            부릉부릉 놀이터
          </h1>
          <span className="text-3xl animate-bounce" style={{ animationDelay: '0.2s' }}>✨</span>
        </div>
        <p className="text-base md:text-lg font-black text-sky-800 mb-3">
          신나는 탈것 세상으로 출발해볼까요?
        </p>

        {/* 탭하면 소리나며 교체되는 메인 탈것 카드 */}
        <div
          onClick={handleVehicleTap}
          className="relative group cursor-pointer active:scale-95 transition-transform"
        >
          <div className="w-48 h-32 md:w-56 md:h-36 rounded-3xl bg-white/90 backdrop-blur-md border-4 border-amber-300 shadow-2xl flex flex-col items-center justify-center p-3 animate-soft-bounce">
            <span className="text-6xl md:text-7xl mb-1 drop-shadow-lg group-hover:scale-110 transition-transform">
              {currentVehicle.emoji}
            </span>
            <span className="font-black text-lg md:text-xl text-gray-800">
              {currentVehicle.name}
            </span>
            <span className="text-xs font-bold text-sky-600 flex items-center gap-1 mt-0.5">
              <Sparkles className="w-3.5 h-3.5" /> 콕 눌러 바꿔요!
            </span>
          </div>
        </div>
      </div>

      {/* 3. 모드 선택 카드 그리드 (모든 버튼 80px 이상, 유아 조작 최적화) */}
      <div className="w-full max-w-3xl mx-auto px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 z-10 my-auto">
        {modes.map((mode) => (
          <button
            key={mode.id}
            onClick={() => handleModeClick(mode.id)}
            className="group relative flex items-center gap-4 p-4 rounded-3xl bg-white/95 backdrop-blur-md border-4 shadow-xl active:scale-95 transition-all text-left cursor-pointer"
            style={{ borderColor: mode.color }}
          >
            <div
              className="w-18 h-18 md:w-20 md:h-20 rounded-2xl flex items-center justify-center text-4xl md:text-5xl shrink-0 shadow-md group-hover:scale-110 transition-transform"
              style={{ backgroundColor: `${mode.color}25` }}
            >
              {mode.icon}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-black text-gray-900 leading-tight">
                {mode.title}
              </h2>
              <p className="text-xs md:text-sm font-bold text-gray-500 mt-1 truncate">
                {mode.subtitle}
              </p>
            </div>

            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-black shadow shrink-0"
              style={{ backgroundColor: mode.color }}
            >
              ➜
            </div>
          </button>
        ))}
      </div>

      {/* 4. 하단 안전 및 오프라인 배지 */}
      <footer className="mt-4 text-center z-10">
        <span className="text-xs font-bold text-sky-800 bg-white/70 px-4 py-1.5 rounded-full shadow-sm">
          👶 2~5세 안심 놀이터 · 광고 없음 · 오프라인 완벽 지원
        </span>
      </footer>

      {/* 모달들 */}
      <VehicleSelectorModal
        isOpen={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
      />

      <ParentGateModal
        isOpen={parentGateOpen}
        onClose={() => setParentGateOpen(false)}
        onSuccess={() => {
          setParentGateOpen(false);
          setSettingsOpen(true);
        }}
      />

      <ParentSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
};
