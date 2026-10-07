import React, { useState, useEffect } from 'react';
import { audioManager } from '../core/audio';
import { X, ShieldAlert, LogOut } from 'lucide-react';
import { exitApp } from '../core/native';

export interface ParentGateModalProps {
  isOpen: boolean;
  mode?: 'settings' | 'exit';
  onSuccess: () => void;
  onClose: () => void;
}

const KOREAN_NUMS: Record<number, string> = {
  1: '하나',
  2: '둘',
  3: '셋',
  4: '넷',
  5: '다섯',
  6: '여섯',
  7: '일곱',
  8: '여덟',
  9: '아홉',
};

export const ParentGateModal: React.FC<ParentGateModalProps> = ({
  isOpen,
  mode = 'settings',
  onSuccess,
  onClose,
}) => {
  const [num1, setNum1] = useState(3);
  const [num2, setNum2] = useState(4);
  const [options, setOptions] = useState<number[]>([]);
  const [isWrong, setIsWrong] = useState(false);
  const [passedQuizForExit, setPassedQuizForExit] = useState(false);

  const generateProblem = () => {
    const n1 = Math.floor(Math.random() * 8) + 1;
    const n2 = Math.floor(Math.random() * 8) + 1;
    const sum = n1 + n2;

    const wrongSet = new Set<number>();
    while (wrongSet.size < 3) {
      const offset = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 4) + 1);
      const wrong = sum + offset;
      if (wrong > 0 && wrong !== sum) {
        wrongSet.add(wrong);
      }
    }

    const allOptions = [sum, ...Array.from(wrongSet)].sort(() => Math.random() - 0.5);

    setNum1(n1);
    setNum2(n2);
    setOptions(allOptions);
    setIsWrong(false);
    setPassedQuizForExit(false);
  };

  useEffect(() => {
    if (isOpen) {
      generateProblem();
      audioManager.speak(mode === 'exit' ? '앱 종료 확인 문제입니다' : '부모 확인 문제입니다');
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const correctAnswer = num1 + num2;

  const handleSelectOption = (chosen: number) => {
    if (chosen === correctAnswer) {
      audioManager.playDing(1046);
      if (mode === 'exit') {
        setPassedQuizForExit(true);
      } else {
        audioManager.speak('확인되었어요');
        onSuccess();
      }
    } else {
      audioManager.playPop(280);
      setIsWrong(true);
      setTimeout(() => {
        generateProblem();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-sm bg-white rounded-3xl p-6 border-4 border-amber-400 shadow-2xl transition-transform ${
          isWrong ? 'animate-bounce' : ''
        }`}
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-90 flex items-center justify-center text-gray-500 cursor-pointer"
        >
          <X className="w-5 h-5 stroke-[2.5]" />
        </button>

        {passedQuizForExit ? (
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-3 shadow">
              <LogOut className="w-8 h-8 stroke-[2.5]" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-1">앱을 종료할까요?</h2>
            <p className="text-xs font-bold text-gray-500 mb-6">
              아이가 실수로 누르지 않도록 부모 확인이 완료되었습니다.
            </p>
            <div className="flex gap-3 w-full">
              <button
                onClick={onClose}
                className="flex-1 h-13 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-base cursor-pointer"
              >
                계속 놀기
              </button>
              <button
                onClick={() => exitApp()}
                className="flex-1 h-13 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-black text-base shadow-md cursor-pointer"
              >
                앱 종료
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-3 shadow">
              <ShieldAlert className="w-8 h-8 stroke-[2.5]" />
            </div>

            <h2 className="text-xl font-black text-gray-900 mb-1">
              {mode === 'exit' ? '앱 종료 안심 확인' : '부모 안심 확인'}
            </h2>
            <p className="text-xs font-bold text-gray-500 mb-4">
              어른만 풀 수 있는 간단한 한글 덧셈 문제예요.
            </p>

            <div className="w-full bg-amber-50 rounded-2xl p-4 border-2 border-amber-200 mb-5">
              <span className="text-xs font-bold text-amber-700 block mb-1">문제</span>
              <div className="text-2xl font-black text-amber-950 tracking-wide">
                "{KOREAN_NUMS[num1]} 더하기 {KOREAN_NUMS[num2]}
                {num2 === 1 ? '는' : '은'}?"
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleSelectOption(opt)}
                  className="h-14 rounded-2xl bg-gray-50 hover:bg-amber-100 active:scale-95 border-2 border-gray-200 hover:border-amber-400 text-2xl font-black text-gray-800 shadow-sm flex items-center justify-center cursor-pointer transition-all"
                >
                  {opt}
                </button>
              ))}
            </div>

            {isWrong && (
              <p className="text-xs font-black text-rose-500 mt-3 animate-pulse">
                정답이 아니에요! 새 문제를 풀어보세요.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
