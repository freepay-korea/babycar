import { create } from 'zustand';
import { audioManager } from './audio';

export interface StickerPlacement {
  id: string;
  icon: string;
  x: number;
  y: number;
  scale: number;
  rot: number;
}

export interface CarDesign {
  id: string;
  name: string;
  body: 'sedan' | 'truck' | 'bus' | 'sportscar' | 'fire-truck';
  colors: {
    body: string;
    roof: string;
    bumper: string;
  };
  wheels: 'standard' | 'monster' | 'lightning' | 'flower';
  stickers: StickerPlacement[];
  svg: string;
  createdAt: number;
}

export interface SettingsData {
  childAge: 2 | 3 | 4;
  voiceEnabled: boolean;
  soundVolume: number;
  timerMinutes: number; // 0 = 없음, 10, 15, 20, 30
}

export interface AppState {
  currentModeId: string | null;
  selectedVehicleId: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  volume: number;
  voiceEnabled: boolean;
  childAge: 2 | 3 | 4;
  timerMinutes: number;
  timerActive: boolean;
  timeRemainingSeconds: number;
  isSleeping: boolean;
  parentGateOpen: boolean;
  settingsOpen: boolean;
  hapticEnabled: boolean;
  customCars: CarDesign[];
  starsCount: number;
  screenTimeMinutes: number;

  // Actions
  setMode: (modeId: string | null) => void;
  selectVehicle: (vehicleId: string) => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  setVolume: (v: number) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setChildAge: (age: 2 | 3 | 4) => void;
  setPlayTimer: (minutes: number) => void;
  setScreenTimer: (minutes: number) => void;
  addStar: (amount?: number) => void;
  toggleHaptic: () => void;
  setParentGateOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setIsSleeping: (sleeping: boolean) => void;
  decrementTimer: () => void;
  saveCarDesign: (car: CarDesign) => void;
  deleteCarDesign: (id: string) => void;
  resetBedtime: () => void;
}

// 저장소 어댑터 (웹 localStorage 및 Capacitor Preferences 호환)
const storage = {
  get: (key: string): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      // Capacitor Preferences 지원 여부 확인
      const cap = (window as unknown as { Capacitor?: { Plugins?: { Preferences?: { get: (opts: { key: string }) => Promise<{ value: string | null }> } } } }).Capacitor;
      if (cap?.Plugins?.Preferences) {
        // 비동기 캐시 또는 로컬스토리지 병행
      }
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
      const cap = (window as unknown as { Capacitor?: { Plugins?: { Preferences?: { set: (opts: { key: string; value: string }) => Promise<void> } } } }).Capacitor;
      if (cap?.Plugins?.Preferences) {
        cap.Plugins.Preferences.set({ key, value }).catch(() => {});
      }
    } catch {
      // ignore
    }
  },
};

const defaultSettings: SettingsData = {
  childAge: 3,
  voiceEnabled: true,
  soundVolume: 0.8,
  timerMinutes: 0,
};

const loadSavedSettings = (): SettingsData => {
  const raw = storage.get('bungbung_settings');
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
};

const loadSavedCars = (): CarDesign[] => {
  const raw = storage.get('bungbung_custom_cars');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.id === 'string' && typeof c.svg === 'string').slice(0, 12)
      : [];
  } catch {
    return [];
  }
};

const initialSettings = loadSavedSettings();

export const useAppStore = create<AppState>((set, get) => ({
  currentModeId: null,
  selectedVehicleId: 'fire-truck',
  soundEnabled: true,
  musicEnabled: true,
  volume: initialSettings.soundVolume,
  voiceEnabled: initialSettings.voiceEnabled,
  childAge: initialSettings.childAge,
  timerMinutes: initialSettings.timerMinutes,
  timerActive: initialSettings.timerMinutes > 0,
  timeRemainingSeconds: initialSettings.timerMinutes * 60,
  isSleeping: false,
  parentGateOpen: false,
  settingsOpen: false,
  hapticEnabled: true,
  customCars: loadSavedCars(),
  starsCount: 12,
  screenTimeMinutes: initialSettings.timerMinutes,

  setMode: (modeId) => set({ currentModeId: modeId }),
  selectVehicle: (selectedVehicleId) => set({ selectedVehicleId }),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
  addStar: (amount = 1) => set((state) => ({ starsCount: state.starsCount + amount })),
  setScreenTimer: (minutes) => get().setPlayTimer(minutes),

  setVolume: (volume) => {
    set({ volume });
    const cur = loadSavedSettings();
    storage.set('bungbung_settings', JSON.stringify({ ...cur, soundVolume: volume }));
  },

  setVoiceEnabled: (voiceEnabled) => {
    set({ voiceEnabled });
    const cur = loadSavedSettings();
    storage.set('bungbung_settings', JSON.stringify({ ...cur, voiceEnabled }));
  },

  setChildAge: (childAge) => {
    set({ childAge });
    const cur = loadSavedSettings();
    storage.set('bungbung_settings', JSON.stringify({ ...cur, childAge }));
  },

  setPlayTimer: (minutes) => {
    const cur = loadSavedSettings();
    storage.set('bungbung_settings', JSON.stringify({ ...cur, timerMinutes: minutes }));

    if (minutes <= 0) {
      set({ timerMinutes: 0, timerActive: false, timeRemainingSeconds: 0, isSleeping: false });
    } else {
      set({
        timerMinutes: minutes,
        timerActive: true,
        timeRemainingSeconds: minutes * 60,
        isSleeping: false,
      });
    }
  },

  decrementTimer: () => {
    const { timeRemainingSeconds, timerActive, isSleeping } = get();
    if (!timerActive || isSleeping) return;

    if (timeRemainingSeconds <= 1) {
      // 타이머 종료 -> 차고로 가자(잠자기 모드) 돌입
      set({
        timeRemainingSeconds: 0,
        timerActive: false,
        isSleeping: true,
        currentModeId: null, // 진행 중이던 모드 종료
      });
    } else {
      set({ timeRemainingSeconds: timeRemainingSeconds - 1 });
    }
  },

  resetBedtime: () => {
    set({ isSleeping: false, timerActive: false, timeRemainingSeconds: 0 });
  },

  toggleHaptic: () => set((state) => ({ hapticEnabled: !state.hapticEnabled })),
  setParentGateOpen: (open) => set({ parentGateOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setIsSleeping: (sleeping) => set({ isSleeping: sleeping }),

  saveCarDesign: (car) => {
    const { customCars } = get();
    const updated = [car, ...customCars.filter((c) => c.id !== car.id)].slice(0, 12);
    storage.set('bungbung_custom_cars', JSON.stringify(updated));
    set({ customCars: updated, selectedVehicleId: car.id });
  },

  deleteCarDesign: (id) => {
    const { customCars } = get();
    const updated = customCars.filter((c) => c.id !== id);
    storage.set('bungbung_custom_cars', JSON.stringify(updated));
    set({ customCars: updated });
  },
}));

// 스토어 설정(음성·효과음·볼륨)을 오디오 엔진에 항상 반영
const syncAudio = (state: AppState) => {
  audioManager.setTtsEnabled(state.voiceEnabled);
  audioManager.setSfxEnabled(state.soundEnabled);
  audioManager.setVolume(state.volume);
};
syncAudio(useAppStore.getState());
useAppStore.subscribe(syncAudio);
