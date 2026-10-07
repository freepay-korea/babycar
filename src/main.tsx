import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '@fontsource/jua/400.css'; // 글꼴을 앱에 내장 (인터넷 없이 동작)
import './index.css';

// 유아용 UX: 화면 길게 누름(우클릭 메뉴), 더블탭 줌, 핀치 줌 방지
window.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

createRoot(document.getElementById('root')!).render(<App />);
