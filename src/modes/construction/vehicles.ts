export interface ConstructionVehicleData {
  id: string;
  name: string;
  role: 'digger' | 'hauler' | 'mixer' | 'crane' | 'pusher';
  icon: string;
  color: string;
  accentColor: string;
  soundAction: 'engine' | 'horn' | 'clank' | 'dump';
  description: string;
}

export const CONSTRUCTION_VEHICLES: ConstructionVehicleData[] = [
  {
    id: 'excavator',
    name: '포크레인',
    role: 'digger',
    icon: '🚜',
    color: '#f97316',
    accentColor: '#334155',
    soundAction: 'clank',
    description: '3단 관절 팔로 무거운 흙을 팍팍 파내는 포크레인!',
  },
  {
    id: 'dump-truck',
    name: '덤프트럭',
    role: 'hauler',
    icon: '🚚',
    color: '#eab308',
    accentColor: '#475569',
    soundAction: 'dump',
    description: '짐칸을 번쩍 들어 흙을 콸콸 쏟아내는 힘센 덤프트럭!',
  },
  {
    id: 'concrete-mixer',
    name: '레미콘',
    role: 'mixer',
    icon: '🚛',
    color: '#3b82f6',
    accentColor: '#64748b',
    soundAction: 'engine',
    description: '빙글빙글 통을 돌리며 시멘트를 섞는 튼튼한 레미콘!',
  },
  {
    id: 'crane',
    name: '크레인',
    role: 'crane',
    icon: '🏗️',
    color: '#ef4444',
    accentColor: '#1e293b',
    soundAction: 'horn',
    description: '높은 곳까지 무거운 철근과 벽돌을 번쩍 드는 크레인!',
  },
  {
    id: 'bulldozer',
    name: '불도저',
    role: 'pusher',
    icon: '🚜',
    color: '#f59e0b',
    accentColor: '#0f172a',
    soundAction: 'clank',
    description: '단단한 흙과 바위를 힘차게 밀어 평평하게 만드는 불도저!',
  },
];
