// 회색 3D 신체모형. 입력한 치수로 부위 크기를 바꾸고, 반소매·긴소매·재킷·긴바지 템플릿에 옷 색과 총장을 반영한다.
// 체형 비율과 코디 조화를 보는 참고용이며 실제 핏을 계산하지 않는다.
import { Component, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { Body, GarmentSummary } from '../types'

const SKIN = '#b9b9bf'

type Dims = { H: number; shoulderW: number; chestR: number; waistR: number; hipR: number; inseam: number }

/** cm 입력 → 모형 치수(1 = 1m). 모르는 값은 키에 비례한 기본 비율. */
function dimsFrom(body: Partial<Body>): Dims {
  const height = Number(body.heightCm) || 170
  const H = height / 100
  const circ = (cm: number | null | undefined, ratio: number) => ((Number(cm) || height * ratio) / 100) / (2 * Math.PI)
  return {
    H,
    shoulderW: (Number(body.shoulderCm) || height * 0.255) / 100,
    chestR: circ(body.chestCm, 0.54),
    waistR: circ(body.waistCm, 0.46),
    hipR: circ(body.hipCm, 0.56),
    inseam: (Number(body.inseamCm) || height * 0.45) / 100,
  }
}

function Limb({ from, to, r1, r2, color }: { from: [number, number, number]; to: [number, number, number]; r1: number; r2: number; color: string }) {
  const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]
  const len = Math.hypot(dx, dy, dz)
  const mid: [number, number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2]
  const angle = Math.atan2(dx, dy)
  return (
    <mesh position={mid} rotation={[0, 0, -angle]}>
      <cylinderGeometry args={[r1, r2, len, 24]} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  )
}

function Figure({ d, top, bottom }: { d: Dims; top: GarmentSummary | null; bottom: GarmentSummary | null }) {
  const { H, shoulderW, chestR, waistR, hipR, inseam } = d
  const crotch = inseam
  const waistY = crotch + H * 0.13
  const shoulderY = H * 0.815
  const neckY = H * 0.86
  const headR = H * 0.062
  const sx = shoulderW / 2
  const armLen = H * 0.34
  const thighR = hipR * 0.52
  const legX = hipR * 0.5

  const topT = top?.template ?? null
  const topColor = top?.colorHex ?? '#d9d3c9'
  const topLen = (top?.totalLengthCm ?? (topT === 'JACKET' ? 72 : 68)) / 100
  const topBottomY = Math.max(crotch - 0.05, shoulderY - topLen)
  const jacket = topT === 'JACKET'
  const shell = jacket ? 1.16 : 1.07

  const pants = bottom?.template === 'LONG_PANTS'
  const pantsColor = bottom?.colorHex ?? '#3a3d45'
  const pantsLen = (bottom?.totalLengthCm ?? 100) / 100
  const hemY = Math.max(0.02, waistY - pantsLen)

  const armEnd = (side: 1 | -1, t: number): [number, number, number] => [side * (sx + 0.04 + armLen * 0.12 * t), shoulderY - armLen * t, 0]

  return (
    <group>
      {/* 머리·목 */}
      <mesh position={[0, neckY + headR * 1.1, 0]}><sphereGeometry args={[headR, 32, 24]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
      <Limb from={[0, shoulderY, 0]} to={[0, neckY + headR * 0.2, 0]} r1={headR * 0.42} r2={headR * 0.45} color={SKIN} />
      {/* 몸통·골반 */}
      <mesh position={[0, (waistY + shoulderY) / 2, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[chestR, waistR, shoulderY - waistY, 32]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>
      <mesh position={[0, (crotch + waistY) / 2, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[waistR, hipR, waistY - crotch, 32]} />
        <meshStandardMaterial color={SKIN} roughness={0.85} />
      </mesh>
      <mesh position={[0, shoulderY, 0]} scale={[sx / chestR, 0.32, 0.72]}><sphereGeometry args={[chestR, 32, 16]} /><meshStandardMaterial color={SKIN} roughness={0.85} /></mesh>
      {/* 다리·팔 */}
      {([1, -1] as const).map((s) => (
        <group key={s}>
          <Limb from={[s * legX, crotch, 0]} to={[s * legX * 0.85, 0.04, 0]} r1={thighR} r2={thighR * 0.42} color={SKIN} />
          <Limb from={[s * (sx + 0.02), shoulderY - 0.02, 0]} to={armEnd(s, 1)} r1={chestR * 0.3} r2={chestR * 0.2} color={SKIN} />
        </group>
      ))}

      {/* 상의 템플릿 */}
      {topT && (
        <group>
          <mesh position={[0, (topBottomY + shoulderY + 0.01) / 2, 0]} scale={[1, 1, 0.74]}>
            <cylinderGeometry args={[chestR * shell, Math.max(waistR, hipR * (topBottomY < waistY ? 1 : 0.9)) * shell, shoulderY + 0.01 - topBottomY, 32, 1, true]} />
            <meshStandardMaterial color={topColor} roughness={0.9} side={2} />
          </mesh>
          <mesh position={[0, shoulderY + 0.005, 0]} scale={[sx / chestR * shell, 0.34, 0.74 * shell]}><sphereGeometry args={[chestR, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={topColor} roughness={0.9} /></mesh>
          {([1, -1] as const).map((s) => (
            <Limb key={s} from={[s * (sx + 0.02), shoulderY - 0.02, 0]} to={armEnd(s, topT === 'SHORT_SLEEVE_TOP' ? 0.3 : 0.93)}
              r1={chestR * 0.36 * (jacket ? 1.12 : 1)} r2={chestR * (topT === 'SHORT_SLEEVE_TOP' ? 0.31 : 0.24) * (jacket ? 1.12 : 1)} color={topColor} />
          ))}
          {jacket && (
            <mesh position={[0, shoulderY - 0.16, chestR * 0.74 * shell + 0.002]}>
              <planeGeometry args={[0.035, 0.28]} />
              <meshStandardMaterial color="#000" transparent opacity={0.18} />
            </mesh>
          )}
        </group>
      )}

      {/* 하의 템플릿 */}
      {pants && (
        <group>
          <mesh position={[0, (crotch - 0.02 + waistY + 0.01) / 2, 0]} scale={[1, 1, 0.74]}>
            <cylinderGeometry args={[waistR * 1.08, hipR * 1.08, waistY + 0.03 - crotch, 32]} />
            <meshStandardMaterial color={pantsColor} roughness={0.9} />
          </mesh>
          {([1, -1] as const).map((s) => (
            <Limb key={s} from={[s * legX, crotch + 0.02, 0]} to={[s * legX * 0.86, hemY, 0]} r1={thighR * 1.14} r2={thighR * 0.62} color={pantsColor} />
          ))}
        </group>
      )}
      {/* 바닥 그림자 */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.45, 48]} /><meshBasicMaterial color="#000" transparent opacity={0.07} /></mesh>
    </group>
  )
}

class GlBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}

function Fallback() {
  return <div className="stage-fallback">이 기기에서는 3D 화면을 그릴 수 없어요. 선택한 옷과 치수는 그대로 저장할 수 있어요.</div>
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export default function Mannequin({ body, top, bottom }: { body: Partial<Body>; top: GarmentSummary | null; bottom: GarmentSummary | null }) {
  const d = dimsFrom(body)
  if (!webglAvailable()) return <Fallback />
  return (
    <GlBoundary>
      <Canvas camera={{ position: [0, d.H * 0.58, d.H * 1.85], fov: 38 }} dpr={[1, 2]} aria-label="3D 신체모형">
        <ambientLight intensity={0.75} />
        <directionalLight position={[2, 4, 3]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <Figure d={d} top={top} bottom={bottom} />
        <OrbitControls target={[0, d.H * 0.52, 0]} enablePan={false} minDistance={d.H * 0.9} maxDistance={d.H * 3.2} />
      </Canvas>
    </GlBoundary>
  )
}
