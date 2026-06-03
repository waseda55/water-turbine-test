// ============================================================
// フランシス水車 — ランナーベーン翼断面図
// キャンバーライン：β1b（入口羽根角）→ β2b（出口羽根角）から決定
// 翼厚分布：NACA 4桁系（最大厚み t/c = 0.12）
// 翼弦長：lb（羽根長さ）を使用
// ============================================================
import type { TurbineResults } from '@/types'

interface Props {
  results: TurbineResults
  width?: number
  height?: number
}

// NACA 4桁系の翼厚分布 y_t(x)  x ∈ [0,1]
// t: 最大厚み比 (例: 0.12)
function nacaThickness(x: number, t = 0.12): number {
  return (t / 0.2) * (
     0.2969 * Math.sqrt(x)
    - 0.1260 * x
    - 0.3516 * x ** 2
    + 0.2843 * x ** 3
    - 0.1015 * x ** 4
  )
}

// 円弧キャンバーライン（入口角β1、出口角β2 を接線条件で決定）
// 水車翼は圧力面・負圧面が逆なので β2 > β1 が通常
// x ∈ [0,1] → y_c(x)
function camberArc(x: number, beta1Deg: number, beta2Deg: number): { yc: number; dyc: number } {
  const b1 = (beta1Deg * Math.PI) / 180
  const b2 = (beta2Deg * Math.PI) / 180
  // 両端の接線条件からキャンバー角 θ を二次で補間
  const theta = b1 + (b2 - b1) * x
  // 積分 ∫tan(θ) dx を近似（台形則）
  const N = 100
  let yc = 0
  const dx = x / N
  for (let i = 0; i < N; i++) {
    const xi = dx * i
    const t1 = Math.tan(b1 + (b2 - b1) * xi)
    const t2 = Math.tan(b1 + (b2 - b1) * (xi + dx))
    yc += ((t1 + t2) / 2) * dx
  }
  const dyc = Math.tan(theta)
  return { yc, dyc }
}

// 翼座標を生成
function generateBladeCoords(
  beta1: number,
  beta2: number,
  chord: number,   // mm
  thickness = 0.12,
  nPts = 80,
): { upper: [number, number][]; lower: [number, number][]; camber: [number, number][] } {
  const upper: [number, number][] = []
  const lower: [number, number][] = []
  const camber: [number, number][] = []

  for (let i = 0; i <= nPts; i++) {
    const x = i / nPts  // 正規化弦方向 0→1
    const { yc, dyc } = camberArc(x, beta1, beta2)
    const yt = nacaThickness(x, thickness)
    const theta = Math.atan(dyc)

    // キャンバーライン
    camber.push([x * chord, yc * chord])

    // 上面（負圧面）・下面（圧力面）
    upper.push([
      (x - yt * Math.sin(theta)) * chord,
      (yc + yt * Math.cos(theta)) * chord,
    ])
    lower.push([
      (x + yt * Math.sin(theta)) * chord,
      (yc - yt * Math.cos(theta)) * chord,
    ])
  }
  return { upper, lower, camber }
}

function toSvgPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') + ' Z'
}

function toCamberPath(pts: [number, number][]): string {
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
}

export function FrancisBladeProfileSvg({ results, width = 600, height = 380 }: Props) {
  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const beta1 = fd.beta1b   // 入口羽根角 [deg]
  const beta2 = fd.beta2b   // 出口羽根角 [deg]
  const chord = fd.lb != null ? Math.abs(fd.lb) * 1000 : 300  // mm（lbが null なら 300mm デフォルト）

  // 翼厚：比速度に応じて薄め〜厚め（Ns 100→0.18, Ns 300→0.10）
  const Ns = results.specificSpeed
  const tRatio = Math.max(0.09, Math.min(0.20, 0.20 - (Ns - 100) / 200 * 0.10))

  const { upper, lower, camber } = generateBladeCoords(beta1, beta2, chord, tRatio)

  // ── SVG座標系に変換 ──
  // 翼を水平に配置し、前縁を左、後縁を右
  const margin = 60
  const availW = width - margin * 2
  const availH = height - margin * 2

  // 翼の座標範囲を計算
  const allX = [...upper.map(p => p[0]), ...lower.map(p => p[0])]
  const allY = [...upper.map(p => p[1]), ...lower.map(p => p[1])]
  const xMin = Math.min(...allX), xMax = Math.max(...allX)
  const yMin = Math.min(...allY), yMax = Math.max(...allY)
  const scaleX = availW / (xMax - xMin)
  const scaleY = availH / (Math.max(yMax - yMin, chord * 0.3))
  const scale = Math.min(scaleX, scaleY, 1.8)

  const cx = margin + availW / 2
  const cy = margin + availH / 2
  const midX = (xMin + xMax) / 2
  const midY = (yMin + yMax) / 2

  const tx = (x: number) => cx + (x - midX) * scale
  const ty = (y: number) => cy - (y - midY) * scale  // y軸反転

  const mapPts = (pts: [number, number][]) => pts.map(([x, y]) => [tx(x), ty(y)] as [number, number])

  const upperSvg = mapPts(upper)
  const lowerSvg = mapPts(lower)
  const camberSvg = mapPts(camber)

  // 翼輪郭パス（上面→後縁→下面逆順）
  const bladePath = [
    ...upperSvg.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`),
    ...[...lowerSvg].reverse().map(p => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`),
    'Z'
  ].join(' ')

  const monoFont = "'JetBrains Mono','Courier New',monospace"
  const accentColor = 'var(--accent, #f59e0b)'
  const dimColor = 'var(--muted, #b8915a)'
  const textColor = 'var(--text, #fff8ed)'

  // 速度三角形の矢印（入口・出口）
  const leX = tx(xMin), leY = ty(camber[0][1])     // 前縁
  const teX = tx(xMax), teY = ty(camber[camber.length - 1][1])  // 後縁
  const arrowLen = chord * scale * 0.22

  // 入口速度三角形（前縁付近に表示）
  const b1r = (beta1 * Math.PI) / 180
  const b2r = (beta2 * Math.PI) / 180
  const inU = { dx: arrowLen, dy: 0 }                           // 周速 u1
  const inW = { dx: arrowLen * Math.cos(b1r), dy: -arrowLen * Math.sin(b1r) }  // 相対速度 w1

  // 出口速度三角形（後縁付近）
  const outU = { dx: arrowLen, dy: 0 }
  const outW = { dx: arrowLen * Math.cos(b2r), dy: -arrowLen * Math.sin(b2r) }

  const arrow = (x1: number, y1: number, dx: number, dy: number, color: string, label: string, lx: number, ly: number) => {
    const x2 = x1 + dx, y2 = y1 + dy
    const len = Math.sqrt(dx * dx + dy * dy)
    const ax = dx / len, ay = dy / len
    const hx = x2 - ax * 8, hy = y2 - ay * 8
    const px = -ay * 4, py = ax * 4
    return `
      <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${color}" stroke-width="1.8" opacity="0.85"/>
      <polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(hx+px).toFixed(1)},${(hy+py).toFixed(1)} ${(hx-px).toFixed(1)},${(hy-py).toFixed(1)}"
        fill="${color}" opacity="0.85"/>
      <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" font-family="${monoFont}" font-size="9" fill="${color}">${label}</text>
    `
  }

  // 弦長・最大厚み寸法線
  const yTopBlade = Math.min(...upperSvg.map(p => p[1]))
  const dimY = yTopBlade - 18
  const xLE = upperSvg[0][0], xTE = upperSvg[upperSvg.length - 1][0]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}>
      <defs>
        {/* 翼面グラデーション */}
        <linearGradient id="bladeGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.18"/>
          <stop offset="50%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.32"/>
          <stop offset="100%" stopColor="var(--accent2, #d97706)" stopOpacity="0.18"/>
        </linearGradient>
        <marker id="bArr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={dimColor}/>
        </marker>
      </defs>

      {/* 背景 */}
      <rect width={width} height={height} fill="var(--bg, #1c1408)"/>

      {/* グリッド */}
      {Array.from({ length: Math.ceil(width / 30) }, (_, i) => (
        <line key={`gv${i}`} x1={i*30} y1="0" x2={i*30} y2={height}
          stroke="var(--border,#7a5220)" strokeWidth="0.3" opacity="0.35"/>
      ))}
      {Array.from({ length: Math.ceil(height / 30) }, (_, i) => (
        <line key={`gh${i}`} x1="0" y1={i*30} x2={width} y2={i*30}
          stroke="var(--border,#7a5220)" strokeWidth="0.3" opacity="0.35"/>
      ))}

      {/* 翼輪郭（塗り） */}
      <path d={bladePath} fill="url(#bladeGrad)" stroke="none"/>

      {/* 翼輪郭（線） */}
      <path d={[
        ...upperSvg.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`),
        'Z'
      ].join(' ')} fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.5"/>
      <path d={[
        ...lowerSvg.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`),
        'Z'
      ].join(' ')} fill="none" stroke={accentColor} strokeWidth="0.8" opacity="0.5"/>

      {/* 上面輪郭（メイン線） */}
      <path d={upperSvg.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
        fill="none" stroke={accentColor} strokeWidth="2.2" strokeLinecap="round"/>

      {/* 下面輪郭 */}
      <path d={lowerSvg.map((p, i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}
        fill="none" stroke="var(--accent3,#fcd34d)" strokeWidth="2.2" strokeLinecap="round"/>

      {/* キャンバーライン */}
      <path d={toCamberPath(camberSvg)}
        fill="none" stroke={dimColor} strokeWidth="1" strokeDasharray="6 3" opacity="0.7"/>

      {/* 弦長寸法線 */}
      <line x1={xLE.toFixed(1)} y1={dimY.toFixed(1)} x2={xTE.toFixed(1)} y2={dimY.toFixed(1)}
        stroke={dimColor} strokeWidth="0.8" markerStart="url(#bArr)" markerEnd="url(#bArr)"/>
      <text x={((xLE+xTE)/2).toFixed(1)} y={(dimY-5).toFixed(1)} textAnchor="middle"
        fontFamily={monoFont} fontSize="9" fill={dimColor}>
        lb = {chord.toFixed(0)} mm
      </text>

      {/* 入口角 β1b 矢印（前縁） */}
      {arrow(leX - arrowLen * 0.1, leY,
        inW.dx, inW.dy, '#60a5fa',
        `β1b = ${beta1.toFixed(1)}°`, leX - arrowLen * 0.1 + inW.dx + 4, leY + inW.dy - 4)}
      {arrow(leX - arrowLen * 0.1, leY,
        inU.dx, 0, '#34d399',
        `u1`, leX - arrowLen * 0.1 + inU.dx / 2, leY + 14)}

      {/* 出口角 β2b 矢印（後縁） */}
      {arrow(teX, teY,
        outW.dx, outW.dy, '#c084fc',
        `β2b = ${beta2.toFixed(1)}°`, teX + outW.dx + 4, teY + outW.dy - 4)}

      {/* 前縁・後縁ラベル */}
      <text x={(leX - 4).toFixed(1)} y={(leY + 4).toFixed(1)} textAnchor="end"
        fontFamily={monoFont} fontSize="9" fill={dimColor}>LE</text>
      <text x={(teX + 4).toFixed(1)} y={(teY + 4).toFixed(1)} textAnchor="start"
        fontFamily={monoFont} fontSize="9" fill={dimColor}>TE</text>

      {/* 負圧面・圧力面ラベル */}
      <text x={(cx - chord * scale * 0.1).toFixed(1)} y={(yTopBlade - 5).toFixed(1)} textAnchor="middle"
        fontFamily={monoFont} fontSize="9" fill={accentColor} opacity="0.8">負圧面 (Suction Side)</text>
      <text x={(cx - chord * scale * 0.1).toFixed(1)} y={(Math.max(...lowerSvg.map(p=>p[1])) + 14).toFixed(1)} textAnchor="middle"
        fontFamily={monoFont} fontSize="9" fill="var(--accent3,#fcd34d)" opacity="0.8">圧力面 (Pressure Side)</text>

      {/* タイトル */}
      <text x={width - 10} y="16" textAnchor="end"
        fontFamily={monoFont} fontSize="11" fontWeight="bold" fill={accentColor}>
        ランナーベーン　翼断面図
      </text>
      <text x={width - 10} y="30" textAnchor="end"
        fontFamily={monoFont} fontSize="8" fill={dimColor}>
        FRANCIS RUNNER BLADE — CROSS SECTION PROFILE
      </text>
      <text x={width - 10} y="44" textAnchor="end"
        fontFamily={monoFont} fontSize="8" fill={dimColor}>
        t/c = {(tRatio * 100).toFixed(0)}%　Ns = {Ns.toFixed(1)}　(単位: mm)
      </text>

      {/* 凡例 */}
      <rect x={10} y={height - 70} width="160" height="60"
        fill="var(--surface,#2a1f0e)" stroke="var(--border,#7a5220)" strokeWidth="0.8" opacity="0.9"/>
      <line x1="18" y1={height - 56} x2="42" y2={height - 56} stroke={accentColor} strokeWidth="2.2"/>
      <text x="48" y={height - 52} fontFamily={monoFont} fontSize="8" fill={textColor}>負圧面</text>
      <line x1="18" y1={height - 40} x2="42" y2={height - 40} stroke="var(--accent3,#fcd34d)" strokeWidth="2.2"/>
      <text x="48" y={height - 36} fontFamily={monoFont} fontSize="8" fill={textColor}>圧力面</text>
      <line x1="18" y1={height - 24} x2="42" y2={height - 24} stroke={dimColor} strokeWidth="1" strokeDasharray="5 3"/>
      <text x="48" y={height - 20} fontFamily={monoFont} fontSize="8" fill={textColor}>キャンバーライン</text>
    </svg>
  )
}
