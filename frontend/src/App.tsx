import { lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AppShell from './components/AppShell'
import { Loading } from './components/Ui'
import SessionProvider from './SessionProvider'
import { useSession } from './session'
import Landing from './pages/Landing'
import { Login, Signup } from './pages/Auth'
import Closet from './pages/Closet'
import GarmentDetailPage from './pages/GarmentDetail'
import Register from './pages/Register'
import SpaceMap from './pages/SpaceMap'
import CareBoard from './pages/CareBoard'
import Move from './pages/Move'
import NotFound from './pages/NotFound'

// 3D 화면은 용량이 커서 열 때 불러온다.
const Studio = lazy(() => import('./pages/Studio'))

function RequireLogin({ children }: { children: ReactNode }) {
  const { me } = useSession()
  const location = useLocation()
  if (me === undefined) return <Loading />
  if (me === null) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route element={<RequireLogin><AppShell /></RequireLogin>}>
            <Route path="/closet" element={<Closet />} />
            <Route path="/closet/:id" element={<GarmentDetailPage />} />
            <Route path="/register" element={<Register />} />
            <Route path="/studio" element={<Suspense fallback={<Loading />}><Studio /></Suspense>} />
            <Route path="/map" element={<SpaceMap />} />
            <Route path="/care" element={<CareBoard />} />
            <Route path="/move" element={<Move />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </SessionProvider>
    </BrowserRouter>
  )
}
