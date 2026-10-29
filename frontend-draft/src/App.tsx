import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Closet from './pages/Closet';
import GarmentDetail from './pages/GarmentDetail';
import Register from './pages/Register';
import Outfit from './pages/Outfit';
import Storage from './pages/Storage';
import NotFound from './pages/NotFound';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { WeatherProvider } from './lib/WeatherProvider';
import { GarmentsProvider } from './data/store';
import { OutfitsProvider } from './data/outfits';
import { ImagesProvider } from './data/images';

// 모바일 전용 UI. 큰 화면에서는 아이폰(390×844) 비율의 틀 안에 앱을 가두고, 창이 작으면 비율을 유지한 채 줄인다.
const W = 390;
const H = 844;

function useFitDevice() {
  useEffect(() => {
    const fit = () => {
      const s = Math.min(1, (window.innerHeight - 48) / H, (window.innerWidth - 48) / W);
      document.documentElement.style.setProperty('--scale', String(Math.max(0.4, s)));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
}

// HashRouter: 서버 설정 없이 정적 파일만으로 동작한다. Spring 이 index.html 폴백을 제공하게 되면 BrowserRouter 로 바꿔도 된다.
export default function App() {
  useFitDevice();
  return (
    <ThemeProvider>
      <div className="device">
        <ToastProvider>
          <WeatherProvider>
            <ImagesProvider>
            <GarmentsProvider>
             <OutfitsProvider>
              <HashRouter>
                <Routes>
                  <Route element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="closet" element={<Closet />} />
                    <Route path="closet/:id" element={<GarmentDetail />} />
                    <Route path="register" element={<Register />} />
                    <Route path="outfit" element={<Outfit />} />
                    <Route path="storage" element={<Storage />} />
          <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </HashRouter>
             </OutfitsProvider>
            </GarmentsProvider>
            </ImagesProvider>
          </WeatherProvider>
        </ToastProvider>
      </div>
    </ThemeProvider>
  );
}
