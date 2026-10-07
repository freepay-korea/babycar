import { SoundEffect } from './audio';
import { CarDesign } from './store';

export interface VehicleData {
  id: string;
  name: string;
  voiceText: string;
  bgColor: string;
  sound: SoundEffect;
  svg: string;
  emoji: string;
  color: string;
  accentColor: string;
  soundType: string;
  isCustom?: boolean;
}

export const VEHICLES: VehicleData[] = [
  {
    id: 'fire-truck',
    name: '소방차',
    voiceText: '출동! 삐뽀삐뽀 용감한 소방차예요!',
    bgColor: '#ef4444',
    color: '#ef4444',
    accentColor: '#fbbf24',
    sound: 'siren',
    soundType: 'fire',
    emoji: '🚒',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 사다리 -->
      <line x1="45" y1="20" x2="110" y2="20" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
      <line x1="55" y1="16" x2="55" y2="24" stroke="#94a3b8" stroke-width="3"/>
      <line x1="75" y1="16" x2="75" y2="24" stroke="#94a3b8" stroke-width="3"/>
      <line x1="95" y1="16" x2="95" y2="24" stroke="#94a3b8" stroke-width="3"/>
      <!-- 사이렌 -->
      <rect x="110" y="14" width="14" height="10" rx="3" fill="#38bdf8"/>
      <circle cx="117" cy="12" r="3" fill="#ef4444"/>
      <!-- 차체 메인 -->
      <rect x="20" y="24" width="120" height="52" rx="8" fill="#ef4444"/>
      <!-- 흰색 줄무늬 -->
      <rect x="20" y="52" width="120" height="8" fill="#ffffff"/>
      <!-- 앞창문 & 옆창문 -->
      <path d="M 105 30 L 132 30 Q 136 30 136 34 L 136 48 L 105 48 Z" fill="#bae6fd"/>
      <rect x="75" y="30" width="24" height="18" rx="2" fill="#bae6fd"/>
      <!-- 헤드라이트 -->
      <circle cx="138" cy="62" r="5" fill="#fef08a"/>
      <!-- 앞뒤 바퀴 -->
      <circle cx="45" cy="76" r="14" fill="#1e293b"/>
      <circle cx="45" cy="76" r="6" fill="#cbd5e1"/>
      <circle cx="115" cy="76" r="14" fill="#1e293b"/>
      <circle cx="115" cy="76" r="6" fill="#cbd5e1"/>
    </svg>`,
  },
  {
    id: 'police-car',
    name: '경찰차',
    voiceText: '삐뽀삐뽀! 씩씩한 경찰차가 순찰을 돌아요!',
    bgColor: '#3b82f6',
    color: '#3b82f6',
    accentColor: '#ffffff',
    sound: 'police',
    soundType: 'police',
    emoji: '🚓',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 경광등 -->
      <rect x="70" y="16" width="10" height="8" rx="2" fill="#ef4444"/>
      <rect x="80" y="16" width="10" height="8" rx="2" fill="#38bdf8"/>
      <!-- 차체 (블루 + 화이트) -->
      <path d="M 25 65 L 25 50 Q 25 42 35 42 L 55 42 L 72 26 Q 78 24 86 24 L 115 24 Q 123 24 128 32 L 138 48 L 142 52 Q 145 56 145 65 Z" fill="#ffffff"/>
      <path d="M 25 56 L 145 56 L 145 74 Q 145 76 142 76 L 28 76 Q 25 76 25 74 Z" fill="#3b82f6"/>
      <!-- 창문 -->
      <path d="M 68 40 L 78 28 L 96 28 L 96 40 Z" fill="#bae6fd"/>
      <path d="M 102 28 L 114 28 L 124 40 L 102 40 Z" fill="#bae6fd"/>
      <!-- 경찰 마크 별 -->
      <circle cx="85" cy="65" r="5" fill="#facc15"/>
      <!-- 헤드라이트 -->
      <circle cx="142" cy="62" r="4" fill="#fef08a"/>
      <!-- 바퀴 -->
      <circle cx="48" cy="76" r="13" fill="#1e293b"/>
      <circle cx="48" cy="76" r="6" fill="#94a3b8"/>
      <circle cx="120" cy="76" r="13" fill="#1e293b"/>
      <circle cx="120" cy="76" r="6" fill="#94a3b8"/>
    </svg>`,
  },
  {
    id: 'bus',
    name: '노란 버스',
    voiceText: '부릉부릉~ 친구들이 타는 신나는 노란 버스 출발!',
    bgColor: '#facc15',
    color: '#facc15',
    accentColor: '#0284c7',
    sound: 'horn',
    soundType: 'bus',
    emoji: '🚌',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 버스 차체 -->
      <rect x="20" y="24" width="122" height="52" rx="10" fill="#facc15"/>
      <!-- 하부 파란색 띠 -->
      <rect x="20" y="62" width="122" height="6" fill="#0284c7"/>
      <!-- 창문들 -->
      <rect x="28" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/>
      <rect x="52" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/>
      <rect x="76" y="32" width="18" height="18" rx="4" fill="#e0f2fe"/>
      <path d="M 100 32 L 132 32 Q 136 32 136 38 L 136 50 L 100 50 Z" fill="#e0f2fe"/>
      <!-- 앞면 웃는 표정 눈 -->
      <circle cx="132" cy="62" r="3" fill="#1e293b"/>
      <circle cx="140" cy="60" r="4" fill="#fef08a"/>
      <!-- 바퀴 -->
      <circle cx="45" cy="76" r="14" fill="#1e293b"/>
      <circle cx="45" cy="76" r="6" fill="#cbd5e1"/>
      <circle cx="115" cy="76" r="14" fill="#1e293b"/>
      <circle cx="115" cy="76" r="6" fill="#cbd5e1"/>
    </svg>`,
  },
  {
    id: 'excavator',
    name: '포크레인',
    voiceText: '으랏차차! 무거운 흙을 팍팍 파내는 포크레인!',
    bgColor: '#f97316',
    color: '#f97316',
    accentColor: '#1e293b',
    sound: 'engine',
    soundType: 'excavator',
    emoji: '🚜',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 붐대 & 굴착기 암 -->
      <line x1="55" y1="46" x2="95" y2="20" stroke="#f97316" stroke-width="8" stroke-linecap="round"/>
      <circle cx="95" cy="20" r="4" fill="#334155"/>
      <line x1="95" y1="20" x2="135" y2="40" stroke="#f97316" stroke-width="7" stroke-linecap="round"/>
      <!-- 버킷 바가지 -->
      <path d="M 135 40 Q 148 48 140 60 Q 130 65 125 50 Z" fill="#334155"/>
      <!-- 조종석 몸체 -->
      <rect x="25" y="38" width="46" height="30" rx="6" fill="#f97316"/>
      <rect x="42" y="42" width="22" height="16" rx="4" fill="#bae6fd"/>
      <!-- 무한궤도 캐터필러 바퀴 -->
      <rect x="18" y="68" width="62" height="16" rx="8" fill="#1e293b"/>
      <circle cx="28" cy="76" r="5" fill="#64748b"/>
      <circle cx="42" cy="76" r="5" fill="#64748b"/>
      <circle cx="56" cy="76" r="5" fill="#64748b"/>
      <circle cx="70" cy="76" r="5" fill="#64748b"/>
    </svg>`,
  },
  {
    id: 'train',
    name: '기차',
    voiceText: '칙칙폭폭! 꼬마 기차가 연기를 퐁퐁 뿜으며 달려요!',
    bgColor: '#8b5cf6',
    color: '#8b5cf6',
    accentColor: '#f97316',
    sound: 'horn',
    soundType: 'train',
    emoji: '🚂',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 굴뚝 & 연기 -->
      <circle cx="120" cy="14" r="5" fill="#e2e8f0" opacity="0.8"/>
      <circle cx="112" cy="8" r="7" fill="#e2e8f0" opacity="0.6"/>
      <rect x="114" y="24" width="12" height="16" fill="#475569"/>
      <!-- 기차 차체 -->
      <rect x="65" y="34" width="65" height="38" rx="6" fill="#8b5cf6"/>
      <!-- 기관사실 (뒷부분 높은 캡) -->
      <rect x="25" y="24" width="45" height="48" rx="8" fill="#7c3aed"/>
      <rect x="32" y="30" width="16" height="18" rx="4" fill="#e0f2fe"/>
      <!-- 기차 앞 헤드라이트 돔 -->
      <path d="M 130 42 Q 142 52 130 62 Z" fill="#facc15"/>
      <!-- 바퀴들 (큰 바퀴 + 작은 바퀴) -->
      <circle cx="48" cy="74" r="16" fill="#1e293b"/>
      <circle cx="48" cy="74" r="7" fill="#cbd5e1"/>
      <circle cx="86" cy="76" r="12" fill="#1e293b"/>
      <circle cx="86" cy="76" r="5" fill="#cbd5e1"/>
      <circle cx="118" cy="76" r="12" fill="#1e293b"/>
      <circle cx="118" cy="76" r="5" fill="#cbd5e1"/>
    </svg>`,
  },
  {
    id: 'helicopter',
    name: '헬리콥터',
    voiceText: '두두두두! 하늘 높이 날아가는 쌩쌩 헬리콥터!',
    bgColor: '#06b6d4',
    color: '#06b6d4',
    accentColor: '#e11d48',
    sound: 'engine',
    soundType: 'helicopter',
    emoji: '🚁',
    svg: `<svg viewBox="0 0 160 100" class="w-full h-full drop-shadow-md">
      <!-- 프로펠러 로터 -->
      <ellipse cx="75" cy="18" rx="55" ry="3" fill="#475569"/>
      <rect x="72" y="18" width="6" height="12" fill="#334155"/>
      <!-- 본체 둥근 캐빈 -->
      <path d="M 45 45 Q 45 30 75 30 Q 110 30 115 48 Q 115 68 85 68 Q 45 68 45 45 Z" fill="#06b6d4"/>
      <!-- 앞 유리창 -->
      <path d="M 85 34 Q 106 36 108 48 Q 106 58 92 58 Z" fill="#e0f2fe"/>
      <!-- 꼬리 날개 & 꼬리 프로펠러 -->
      <rect x="18" y="44" width="32" height="6" fill="#0891b2"/>
      <rect x="14" y="34" width="6" height="22" fill="#0891b2"/>
      <ellipse cx="17" cy="45" rx="3" ry="14" fill="#64748b"/>
      <!-- 착륙 스키드 다리 -->
      <line x1="55" y1="68" x2="52" y2="78" stroke="#334155" stroke-width="4"/>
      <line x1="85" y1="68" x2="88" y2="78" stroke="#334155" stroke-width="4"/>
      <line x1="38" y1="78" x2="105" y2="78" stroke="#334155" stroke-width="5" stroke-linecap="round"/>
    </svg>`,
  },
];

export function carDesignToVehicleData(car: CarDesign): VehicleData {
  return {
    id: car.id,
    name: car.name || '나만의 멋진 차',
    voiceText: `부릉부릉! 내가 직접 만든 멋진 ${car.name || '자동차'}예요!`,
    bgColor: car.colors?.body || '#3b82f6',
    color: car.colors?.body || '#3b82f6',
    accentColor: car.colors?.bumper || '#f59e0b',
    sound: car.body === 'fire-truck' ? 'siren' : car.wheels === 'monster' ? 'engine' : 'horn',
    soundType: car.wheels === 'monster' ? 'excavator' : 'bus',
    emoji: car.body === 'truck' ? '🚚' : car.body === 'bus' ? '🚌' : car.body === 'fire-truck' ? '🚒' : '🏎️',
    svg: car.svg,
    isCustom: true,
  };
}

export function getCombinedVehicles(customCars: CarDesign[] = []): VehicleData[] {
  const converted = customCars.map(carDesignToVehicleData);
  return [...converted, ...VEHICLES];
}

export function getVehicleById(id: string, customCars: CarDesign[] = []): VehicleData {
  if (customCars.length > 0) {
    const custom = customCars.find((c) => c.id === id);
    if (custom) return carDesignToVehicleData(custom);
  }
  return VEHICLES.find((v) => v.id === id) || VEHICLES[0];
}
