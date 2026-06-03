// ============================================================
// フランシス水車 — 子午面断面図（クラウン・バンド輪郭）
// D1: 入口クラウン径, D5: 入口バンド径
// D6: 出口クラウン径, D2: 出口バンド径
// D7: ボス径, B1: 入口羽根高さ, H2: 出口高さ
// ============================================================
import type { TurbineResults } from '@/types'

interface Props {
  results: TurbineResults
  width?: number
  height?: number
}

export function FrancisMeridionalSvg({ results, width = 560, height = 440 }: Props) {
  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const W = width, H = height

  // ── 寸法取得（m → mm） ──
  const D1 = fd.D1 * 1000  // 入口クラウン径
  const D5 = fd.D5 * 1000  // 入口バンド径
  const D6 = fd.D6 * 1000  // 出口クラウン径
  const D2 = fd.D2 * 1000  // 出口バンド径
  const D7 = fd.D7 * 1000  // ボス径
  const B1 = fd.B1 * 1000  // 入口羽根高さ
  const H2 = fd.H2 * 1000  // 出口高さ

  // 半径
  const r1  = D1 / 2   // 入口クラウン半径
  const r5  = D5 / 2   // 入口バンド半径
  const r6  = D6 / 2   // 出口クラウン半径（小さい）
  const r2  = D2 / 2   // 出口バンド半径（大きい）
  const r7  = D7 / 2   // ボス半径

  // ── キャンバス座標系の設定 ──
  // 回転軸を左側（x = margin）に配置
  // y軸下向き正方向
  const margin = 60
  const axisX = margin  // 回転軸のX座標（左端）

  // 全体スケール（子午面の最大寸法に合わせる）
  const maxR   = r2  // 最大半径
  const maxH   = H2 + B1 * 1.5  // 縦方向の目安
  const scaleR = (W - margin - 80) / maxR  // 半径方向スケール
  const scaleZ = (H - 80) / Math.max(maxH, maxR * 0.8)
  const scale  = Math.min(scaleR, scaleZ, 0.95)

  // Y原点：入口の上端（クラウン入口）を基準に
  const yOrigin = 50

  // 座標変換：r=半径, z=軸方向（下向き正）
  const px = (r: number) => axisX + r * scale
  const py = (z: number) => yOrigin + z * scale

  // ── 子午面上の代表点 ──
  // 入口
  const zIn = 0           // 入口高さ基準
  const crownInR = r1     // クラウン入口半径
  const bandInR  = r5     // バンド入口半径
  const crownInZ = zIn
  const bandInZ  = zIn + B1  // バンドは高さB1だけ下

  // 出口（軸方向へ）
  // クラウン側：小径r6で下方へH2
  const crownOutR = r6
  const crownOutZ = crownInZ + H2

  // バンド側：大径r2で下方へH2（B1分のオフセット考慮）
  const bandOutR = r2
  const bandOutZ = bandInZ + H2 * 0.85

  // ボス（回転軸に沿って）
  const bossTopZ = crownOutZ
  const bossBotZ = crownOutZ + H2 * 0.3

  // ── クラウン輪郭線（4点のベジェ曲線で滑らかに） ──
  // 入口(crownInR, crownInZ) → 中間制御点 → 出口(crownOutR, crownOutZ)
  const cp1r = crownInR * 0.55
  const cp1z = crownInZ + H2 * 0.15
  const cp2r = crownOutR + (crownInR - crownOutR) * 0.2
  const cp2z = crownOutZ - H2 * 0.15

  const crownPath =
    `M ${px(crownInR).toFixed(1)} ${py(crownInZ).toFixed(1)} ` +
    `C ${px(cp1r).toFixed(1)} ${py(cp1z).toFixed(1)}, ` +
    `${px(cp2r).toFixed(1)} ${py(cp2z).toFixed(1)}, ` +
    `${px(crownOutR).toFixed(1)} ${py(crownOutZ).toFixed(1)}`

  // ── バンド輪郭線 ──
  const bp1r = bandInR * 1.02
  const bp1z = bandInZ + H2 * 0.1
  const bp2r = bandOutR - (bandOutR - bandInR) * 0.15
  const bp2z = bandOutZ - H2 * 0.12

  const bandPath =
    `M ${px(bandInR).toFixed(1)} ${py(bandInZ).toFixed(1)} ` +
    `C ${px(bp1r).toFixed(1)} ${py(bp1z).toFixed(1)}, ` +
    `${px(bp2r).toFixed(1)} ${py(bp2z).toFixed(1)}, ` +
    `${px(bandOutR).toFixed(1)} ${py(bandOutZ).toFixed(1)}`

  // ── 水路領域の塗り（クラウンとバンドで囲まれた流路） ──
  const flowAreaPath =
    `M ${px(crownInR).toFixed(1)} ${py(crownInZ).toFixed(1)} ` +
    `C ${px(cp1r).toFixed(1)} ${py(cp1z).toFixed(1)}, ` +
    `${px(cp2r).toFixed(1)} ${py(cp2z).toFixed(1)}, ` +
    `${px(crownOutR).toFixed(1)} ${py(crownOutZ).toFixed(1)} ` +
    // 出口下端
    `L ${px(crownOutR).toFixed(1)} ${py(crownOutZ).toFixed(1)} ` +
    // バンド輪郭を逆にたどる
    `C ${px(bp2r).toFixed(1)} ${py(bp2z).toFixed(1)}, ` +
    `${px(bp1r).toFixed(1)} ${py(bp1z).toFixed(1)}, ` +
    `${px(bandInR).toFixed(1)} ${py(bandInZ).toFixed(1)} ` +
    // 入口上端をつなぐ
    `L ${px(crownInR).toFixed(1)} ${py(crownInZ).toFixed(1)} Z`

  // ── ボス輪郭 ──
  const bossPath =
    `M ${px(r7).toFixed(1)} ${py(bossTopZ).toFixed(1)} ` +
    `L ${px(r7).toFixed(1)} ${py(bossBotZ).toFixed(1)} ` +
    `L ${px(0).toFixed(1)} ${py(bossBotZ).toFixed(1)} ` +
    `L ${px(0).toFixed(1)} ${py(bossTopZ).toFixed(1)} Z`

  // 寸法線の色
  const dimColor = 'var(--muted, #b8915a)'
  const accentColor = 'var(--accent, #f59e0b)'
  const textColor = 'var(--text, #fff8ed)'

  // ── フォント ──
  const monoFont = "'JetBrains Mono', 'Courier New', monospace"

  // 寸法線ヘルパー：水平
  const hDim = (r1d: number, r2d: number, z: number, label: string, offset = -14) => {
    const x1 = px(r1d), x2 = px(r2d), y = py(z) + offset
    return `
      <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${dimColor}" stroke-width="0.8" marker-start="url(#dimArr)" marker-end="url(#dimArr)"/>
      <line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}" stroke="${dimColor}" stroke-width="0.8"/>
      <line x1="${x2}" y1="${y - 4}" x2="${x2}" y2="${y + 4}" stroke="${dimColor}" stroke-width="0.8"/>
      <text x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle" font-family="${monoFont}" font-size="9" fill="${dimColor}">${label}</text>
    `
  }

  // 寸法線ヘルパー：垂直
  const vDim = (z1: number, z2: number, r: number, label: string, offset = 16) => {
    const y1 = py(z1), y2 = py(z2), x = px(r) + offset
    return `
      <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${dimColor}" stroke-width="0.8" marker-start="url(#dimArr)" marker-end="url(#dimArr)"/>
      <line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}" stroke="${dimColor}" stroke-width="0.8"/>
      <line x1="${x - 4}" y1="${y2}" x2="${x + 4}" y2="${y2}" stroke="${dimColor}" stroke-width="0.8"/>
      <text x="${x + 5}" y="${(y1 + y2) / 2 + 3}" font-family="${monoFont}" font-size="9" fill="${dimColor}">${label}</text>
    `
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      <defs>
        {/* グラデーション：流路 */}
        <linearGradient id="flowGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--accent, #f59e0b)" stopOpacity="0.08"/>
        </linearGradient>
        {/* 矢印マーカー（寸法線用） */}
        <marker id="dimArr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
          <path d="M0,0 L5,2.5 L0,5 Z" fill={dimColor}/>
        </marker>
        {/* 流れ方向矢印 */}
        <marker id="flowArr" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
          <path d="M0,0 L7,3.5 L0,7 Z" fill={accentColor} opacity="0.8"/>
        </marker>
      </defs>

      {/* 背景 */}
      <rect width={W} height={H} fill="var(--bg, #1c1408)"/>

      {/* グリッド */}
      {Array.from({ length: Math.ceil(W / 30) }, (_, i) => (
        <line key={`gv${i}`} x1={i * 30} y1="0" x2={i * 30} y2={H}
          stroke="var(--border, #7a5220)" strokeWidth="0.3" opacity="0.4"/>
      ))}
      {Array.from({ length: Math.ceil(H / 30) }, (_, i) => (
        <line key={`gh${i}`} x1="0" y1={i * 30} x2={W} y2={i * 30}
          stroke="var(--border, #7a5220)" strokeWidth="0.3" opacity="0.4"/>
      ))}

      {/* 回転軸 */}
      <line
        x1={axisX} y1="10" x2={axisX} y2={H - 10}
        stroke={dimColor} strokeWidth="1" strokeDasharray="10 5" opacity="0.6"
      />
      <text
        x={axisX - 6} y={H - 14}
        textAnchor="middle" fontFamily={monoFont} fontSize="8"
        fill={dimColor} opacity="0.7" writingMode="vertical-rl"
      >回転軸</text>

      {/* ── 流路領域（塗り） ── */}
      <path d={flowAreaPath} fill="url(#flowGrad)" opacity="0.9"/>

      {/* ── バンド（外側輪郭）── */}
      <path
        d={bandPath}
        fill="none"
        stroke="var(--accent3, #fcd34d)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <text
        x={px(bandInR) + 6} y={py(bandInZ) - 6}
        fontFamily={monoFont} fontSize="9" fill="var(--accent3, #fcd34d)"
      >BAND</text>

      {/* ── クラウン（内側輪郭）── */}
      <path
        d={crownPath}
        fill="none"
        stroke={accentColor}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <text
        x={px(crownInR) - 4} y={py(crownInZ) - 6}
        textAnchor="end" fontFamily={monoFont} fontSize="9" fill={accentColor}
      >CROWN</text>

      {/* ── ボス ── */}
      <path d={bossPath} fill="var(--surface2, #362815)" stroke={dimColor} strokeWidth="1.5"/>
      <text
        x={px(r7 / 2)} y={py((bossTopZ + bossBotZ) / 2) + 3}
        textAnchor="middle" fontFamily={monoFont} fontSize="8" fill={dimColor}
      >BOSS</text>

      {/* ── 入口ライン ── */}
      <line
        x1={px(crownInR)} y1={py(crownInZ)}
        x2={px(bandInR)}  y2={py(bandInZ)}
        stroke={accentColor} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7"
      />

      {/* ── 出口ライン ── */}
      <line
        x1={px(crownOutR)} y1={py(crownOutZ)}
        x2={px(bandOutR)}  y2={py(bandOutZ)}
        stroke="var(--accent3, #fcd34d)" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7"
      />

      {/* ── 流れ方向矢印（子午面流線イメージ） ── */}
      {[0.25, 0.5, 0.75].map((t, i) => {
        // クラウンとバンドの中間点
        const cr  = crownInR + (crownOutR - crownInR) * t
        const cz  = crownInZ + (crownOutZ - crownInZ) * t
        const br  = bandInR  + (bandOutR - bandInR)   * t
        const bz  = bandInZ  + (bandOutZ - bandInZ)   * t
        const mr  = (cr + br) / 2
        const mz  = (cz + bz) / 2
        // 接線方向
        const drt = (crownOutR - crownInR) + (bandOutR - bandInR)
        const dzt = (crownOutZ - crownInZ) + (bandOutZ - bandInZ)
        const len = Math.sqrt(drt * drt + dzt * dzt)
        const drn = (drt / len) * 16 * scale
        const dzn = (dzt / len) * 16 * scale
        return (
          <line key={i}
            x1={px(mr) - drn / 2} y1={py(mz) - dzn / 2}
            x2={px(mr) + drn / 2} y2={py(mz) + dzn / 2}
            stroke={accentColor} strokeWidth="1.2" opacity="0.5"
            markerEnd="url(#flowArr)"
          />
        )
      })}

      {/* ── 寸法注記 ── */}
      {/* D1 水平寸法（入口クラウン） */}
      {hDim(0, r1, crownInZ, `D1=${D1.toFixed(0)}`, -18)}
      {/* D5 水平寸法（入口バンド） */}
      {hDim(0, r5, bandInZ + B1 * 0.1, `D5=${D5.toFixed(0)}`, 8)}
      {/* D6 水平寸法（出口クラウン） */}
      {hDim(0, r6, crownOutZ, `D6=${D6.toFixed(0)}`, 12)}
      {/* D2 水平寸法（出口バンド） */}
      {hDim(0, r2, bandOutZ, `D2=${D2.toFixed(0)}`, 14)}
      {/* B1 垂直寸法（入口高さ） */}
      {vDim(crownInZ, bandInZ, r5, `B1=${B1.toFixed(0)}`, 14)}
      {/* H2 垂直寸法（出口高さ） */}
      {vDim(crownInZ, crownOutZ, r1, `H2=${H2.toFixed(0)}`, -14)}

      {/* ── タイトル・凡例 ── */}
      <text x={W - 10} y="16" textAnchor="end"
        fontFamily={monoFont} fontSize="11" fontWeight="bold" fill={accentColor}>
        子午面断面図
      </text>
      <text x={W - 10} y="30" textAnchor="end"
        fontFamily={monoFont} fontSize="8" fill={dimColor}>
        FRANCIS RUNNER — MERIDIONAL SECTION
      </text>
      <text x={W - 10} y="44" textAnchor="end"
        fontFamily={monoFont} fontSize="8" fill={dimColor}>
        (単位: mm)
      </text>

      {/* 凡例 */}
      <rect x={W - 120} y={H - 52} width="110" height="42"
        fill="var(--surface, #2a1f0e)" stroke="var(--border, #7a5220)" strokeWidth="0.8" opacity="0.85"/>
      <line x1={W - 112} y1={H - 40} x2={W - 92} y2={H - 40}
        stroke={accentColor} strokeWidth="2.2"/>
      <text x={W - 88} y={H - 36} fontFamily={monoFont} fontSize="8" fill={textColor}>クラウン</text>
      <line x1={W - 112} y1={H - 24} x2={W - 92} y2={H - 24}
        stroke="var(--accent3, #fcd34d)" strokeWidth="2.2"/>
      <text x={W - 88} y={H - 20} fontFamily={monoFont} fontSize="8" fill={textColor}>バンド</text>
    </svg>
  )
}
