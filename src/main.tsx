import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// 유아용 UX: 화면 길게 누름(우클릭 메뉴), 더블탭 줌, 핀치 줌 방지
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);
