import React from 'react';
import { useAppStore } from '../core/store';
import { VEHICLES } from '../core/vehicles';
import { audioManager } from '../core/audio';
import { X, Check } from 'lucide-react';

interface VehicleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VehicleSelectorModal: React.FC<VehicleSelectorModalProps> = ({ isOpen, onClose }) => {
  const { selectedVehicleId, selectVehicle } = useAppStore();

  if (!isOpen) return null;

  const handleSelect = (vId: string, soundType: string) => {
    selectVehicle(vId);

    // 각 탈것 고유 소리 즉시 재생
    if (soundType === 'fire' || soundType === 'police') {
      audioManager.playSiren(1);
    } else if (soundType === 'bus') {
      audioManager.playHorn();
    } else if (soundType === 'train') {
      audioManager.playTrainWhistle();
    } else if (soundType === 'rocket') {
      audioManager.playRocketBlast();
    } else if (soundType === 'excavator') {
      audioManager.playExcavatorClank();
    } else {
      audioManager.playEngineRev();
    }

    audioManager.triggerHaptic(25);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl border-4 border-yellow-300 max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 cursor-pointer z-10"
        >
          <X className="w-7 h-7" />
        </button>

        <div className="text-center mb-4">
          <span className="text-3xl">🚗 🚜 🚒</span>
          <h3 className="font-black text-2xl text-gray-800">탈것을 골라보세요!</h3>
          <p className="text-sm font-bold text-amber-600">마음에 드는 친구를 콕 터치해요</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 overflow-y-auto p-1 flex-1">
          {VEHICLES.map((v) => {
            const isSelected = selectedVehicleId === v.id;
            return (
              <button
                key={v.id}
                onClick={() => handleSelect(v.id, v.soundType || 'engine')}
                className={`relative flex flex-col items-center justify-center p-3 rounded-2xl border-4 transition-all duration-150 cursor-pointer active:scale-90 ${
                  isSelected
                    ? 'border-yellow-400 bg-yellow-50 shadow-xl ring-4 ring-yellow-200 scale-105'
                    : 'border-gray-200 bg-gray-50 hover:bg-white'
                }`}
                style={{ minHeight: '110px' }}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-yellow-400 text-yellow-950 flex items-center justify-center font-bold">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                )}
                <span className="text-5xl mb-1 drop-shadow-md">{v.emoji}</span>
                <span className="font-black text-sm text-gray-800 text-center leading-tight">
                  {v.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
