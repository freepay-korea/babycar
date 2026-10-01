import React from 'react';
import { useAppStore } from '../core/store';
import { audioManager } from '../core/audio';
import { X, User, Volume2, Mic, Clock, Check } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    childAge,
    voiceEnabled,
    volume,
    timerMinutes,
    setChildAge,
    setVoiceEnabled,
    setVolume,
    setPlayTimer,
  } = useAppStore();

  if (!isOpen) return null;

  const handleAgeChange = (age: 2 | 3 | 4) => {
    setChildAge(age);
    audioManager.playPop(550);
    audioManager.speak(`${age === 4 ? '4세 이상' : age + '세'} 모드로 설정했어요`);
  };

  const handleVoiceToggle = () => {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    audioManager.setTtsEnabled(next);
    if (next) audioManager.speak('목소리 안내를 켰어요');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
  };

  const handleTimerChange = (min: number) => {
    setPlayTimer(min);
    audioManager.playPop(600);
    if (min === 0) {
      audioManager.speak('놀이 시간 제한을 껐어요');
    } else {
      audioManager.speak(`놀이 시간을 ${min}분으로 설정했어요`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl p-6 border-4 border-amber-400 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b-2 border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h2 className="text-xl md:text-2xl font-black text-gray-900">부모 안심 설정</h2>
          </div>
          <button
            onClick={() => {
              audioManager.playPop(480);
              onClose();
            }}
            aria-label="닫기"
            className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-90 flex items-center justify-center text-gray-500 cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {/* 1. 아이 나이 설정 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-gray-500 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-500" />
              <span>아이 나이 (모드 난이도 자동 조절)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([2, 3, 4] as const).map((age) => {
                const isSelected = childAge === age;
                return (
                  <button
                    key={age}
                    onClick={() => handleAgeChange(age)}
                    className={`h-12 rounded-2xl font-black text-sm md:text-base border-2 transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-md ring-2 ring-amber-200 scale-102'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{age === 4 ? '4세 이상' : `${age}세`}</span>
                    {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] font-bold text-gray-400">
              * 2세는 즉각 터치 추종 모드, 4세 이상은 직접 드래그 역기구학 모드가 적용됩니다.
            </p>
          </div>

          {/* 2. 음성 안내 토글 */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center">
                <Mic className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black text-gray-800">한국어 음성 안내 (TTS)</span>
                <span className="text-[11px] font-bold text-gray-400">탈것 이름 및 응원 목소리</span>
              </div>
            </div>

            <button
              onClick={handleVoiceToggle}
              className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                voiceEnabled ? 'bg-amber-500' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  voiceEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. 효과음 볼륨 */}
          <div className="flex flex-col gap-2 p-3 rounded-2xl bg-gray-50 border border-gray-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-gray-700 flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-emerald-500" />
                <span>효과음 크기</span>
              </label>
              <span className="text-xs font-black text-emerald-600">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-emerald-500 h-2 bg-gray-200 rounded-lg cursor-pointer"
            />
          </div>

          {/* 4. 놀이 시간 타이머 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-gray-500 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-rose-500" />
              <span>놀이 시간 타이머 (종료 시 '차고로 가자' 자동 취침)</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[0, 10, 15, 20, 30].map((min) => {
                const isSelected = timerMinutes === min;
                return (
                  <button
                    key={min}
                    onClick={() => handleTimerChange(min)}
                    className={`h-11 rounded-2xl font-black text-xs md:text-sm border-2 transition-all cursor-pointer flex items-center justify-center ${
                      isSelected
                        ? 'bg-rose-500 border-rose-600 text-white shadow-md ring-2 ring-rose-200 scale-102'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {min === 0 ? '없음' : `${min}분`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 5. iOS 사파리 '홈 화면에 추가' 안내 */}
          <div className="p-3.5 rounded-2xl bg-sky-50 border-2 border-sky-200 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sky-900 font-black text-xs md:text-sm">
              <span className="text-lg">📲</span>
              <span>아이폰/아이패드 홈 화면에 추가 (PWA)</span>
            </div>
            <div className="text-xs text-sky-800 leading-relaxed font-bold bg-white/80 p-2.5 rounded-xl border border-sky-100 flex flex-col gap-1.5">
              <div className="flex items-start gap-1.5">
                <span className="bg-sky-200 text-sky-800 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-black mt-0.5">1</span>
                <span>사파리(Safari) 브라우저 하단의 <strong>공유(Share) 버튼 ⎋</strong>을 터치합니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="bg-sky-200 text-sky-800 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-black mt-0.5">2</span>
                <span>아래로 스크롤하여 <strong>'홈 화면에 추가(Add to Home Screen)'</strong>를 누릅니다.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="bg-sky-200 text-sky-800 w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 font-black mt-0.5">3</span>
                <span>우측 상단 <strong>'추가'</strong>를 누르면 빨간 자동차 아이콘의 전체 화면 앱으로 설치됩니다.</span>
              </div>
            </div>
            <span className="text-[10px] font-bold text-sky-600">
              * 설치 후에는 인터넷이 안 되는 비행기 모드나 야외에서도 모든 소리와 모드가 정상 작동합니다.
            </span>
          </div>
        </div>

        <button
          onClick={() => {
            audioManager.playPop(520);
            onClose();
          }}
          className="mt-6 w-full h-13 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-amber-950 font-black text-lg border-2 border-amber-300 shadow-md cursor-pointer"
        >
          설정 저장 및 닫기
        </button>
      </div>
    </div>
  );
};
