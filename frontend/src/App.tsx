import { useEffect } from 'react';
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Closet from './pages/Closet';
import GarmentDetail from './pages/GarmentDetail';
import Register from './pages/Register';
import Outfit from './pages/Outfit';
import Storage from './pages/Storage';
import NotFound from './pages/NotFound';
import Auth from './pages/Auth';
import { AuthProvider, RequireAuth } from './lib/auth';
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

// 주소는 Spring 이 index.html 로 넘겨 준다(SpaController). 로그인·회원가입 말고는 모두 로그인해야 볼 수 있다.
export default function App() {
  useFitDevice();
  return (
    <ThemeProvider>
      <div className="device">
        <ToastProvider>
          <WeatherProvider>
            <ImagesProvider>
              <BrowserRouter>
                <AuthProvider>
                  <Routes>
                    <Route element={<Layout />}>
                      <Route path="login" element={<Auth mode="login" />} />
                      <Route path="signup" element={<Auth mode="signup" />} />
                      <Route element={<RequireAuth><GarmentsProvider><OutfitsProvider><Outlet /></OutfitsProvider></GarmentsProvider></RequireAuth>}>
                        <Route index element={<Home />} />
                        <Route path="closet" element={<Closet />} />
                        <Route path="closet/:id" element={<GarmentDetail />} />
                        <Route path="register" element={<Register />} />
                        <Route path="outfit" element={<Outfit />} />
                        <Route path="storage" element={<Storage />} />
                        <Route path="*" element={<NotFound />} />
                      </Route>
                    </Route>
                  </Routes>
                </AuthProvider>
              </BrowserRouter>
            </ImagesProvider>
          </WeatherProvider>
        </ToastProvider>
      </div>
    </ThemeProvider>
  );
}
