import React from 'react';
import { useAppStore } from '../core/store';
import { audioManager } from '../core/audio';
import { X, Volume2, VolumeX, Music, Clock, Smartphone, ShieldCheck } from 'lucide-react';

interface ParentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ParentSettingsModal: React.FC<ParentSettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    soundEnabled,
    musicEnabled,
    toggleSound,
    toggleMusic,
    screenTimeMinutes,
    setScreenTimer,
    hapticEnabled,
    toggleHaptic,
  } = useAppStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border-4 border-sky-300 max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <h3 className="font-black text-2xl text-gray-800 mb-1">부모 안심 설정</h3>
        <p className="text-xs text-gray-500 mb-5">
          광고 없음 · 외부 링크 없음 · 100% 오프라인 동작
        </p>

        <div className="space-y-4">
          {/* 1. 소리 & 음악 토글 */}
          <div className="p-4 rounded-2xl bg-sky-50 border border-sky-100">
            <h4 className="font-black text-sm text-sky-900 mb-3 flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-sky-600" /> 소리 설정
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  toggleSound();
                  audioManager.setSoundMuted(!soundEnabled);
                }}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold border-2 cursor-pointer transition-all ${
                  soundEnabled
                    ? 'bg-sky-500 text-white border-sky-600 shadow'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                효과음 {soundEnabled ? '켜짐' : '꺼짐'}
              </button>

              <button
                onClick={() => {
                  toggleMusic();
                  audioManager.setMusicMuted(!musicEnabled);
                }}
                className={`py-3 px-3 rounded-2xl flex items-center justify-center gap-2 text-sm font-bold border-2 cursor-pointer transition-all ${
                  musicEnabled
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow'
                    : 'bg-white text-gray-600 border-gray-200'
                }`}
              >
                <Music className="w-4 h-4" />
                배경음악 {musicEnabled ? '켜짐' : '꺼짐'}
              </button>
            </div>
          </div>

          {/* 2. 놀이 시간 타이머 (시력 보호 및 과몰입 방지) */}
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <h4 className="font-black text-sm text-amber-900 mb-1 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" /> 놀이 시간 타이머
            </h4>
            <p className="text-xs text-amber-700 mb-3">
              설정한 시간이 되면 부드럽게 '휴식 시간' 안내 화면이 뜹니다.
            </p>
            <div className="grid grid-cols-4 gap-2">
              {[0, 10, 15, 20].map((mins) => (
                <button
                  key={mins}
                  onClick={() => setScreenTimer(mins)}
                  className={`py-2.5 rounded-xl font-black text-sm border-2 cursor-pointer transition-all ${
                    screenTimeMinutes === mins
                      ? 'bg-amber-500 text-white border-amber-600 shadow'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {mins === 0 ? '무제한' : `${mins}분`}
                </button>
              ))}
            </div>
          </div>

          {/* 3. 진동 햅틱 피드백 */}
          <div className="p-4 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-600" />
              <div>
                <span className="font-black text-sm text-purple-900 block">진동(햅틱) 피드백</span>
                <span className="text-xs text-purple-700">터치할 때 손끝으로 느껴지는 재미</span>
              </div>
            </div>
            <button
              onClick={toggleHaptic}
              className={`w-14 h-8 rounded-full transition-colors relative cursor-pointer ${
                hapticEnabled ? 'bg-purple-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white absolute top-1 transition-transform ${
                  hapticEnabled ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>

          {/* 4. 아동 보호 선언 */}
          <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200 flex items-start gap-2.5 text-xs text-gray-600">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-gray-800 block">안전한 유아 전용 앱 안내</strong>
              본 앱은 외부 광고, 인앱 결제 유도, 개인정보 수집, 외부 링크가 전혀 포함되어 있지
              않습니다. 비행기 모드에서도 완벽하게 동작합니다.
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full h-14 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-black text-lg shadow-lg cursor-pointer transition-transform active:scale-98"
        >
          확인 완료
        </button>
      </div>
    </div>
  );
};
