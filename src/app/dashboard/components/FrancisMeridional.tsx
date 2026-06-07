'use client'
// ============================================================
// フランシス水車ランナー 子午面断面図 v4
// - D5/D1寸法線の重なりを完全解消（段差を十分確保）
// - 凡例をviewBox内に確実に収める
// - 右側縦寸法線はB1/H2のみ（右マージン確保）
// ============================================================
import type { TurbineResults } from '@/types'

interface Props { results: TurbineResults }

export function FrancisMeridional({ results }: Props) {
  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const D1 = fd.D1 * 1000
  const D2 = fd.D2 * 1000
  const D5 = fd.D5 * 1000
  const D6 = fd.D6 * 1000
  const B1 = fd.B1 * 1000
  const H2 = fd.H2 * 1000

  // ── レイアウト ──
  // 上部: タイトル(40px) + 寸法線3段(各28px=84px) + 余白(16px) = 140px
  // 右部: H2縦寸法(50px) + B1縦寸法(50px) + ラベル余白(70px)
  const VW    = 720
  const AXIS  = 70      // 回転軸 x
  const OY    = 140     // 図形の上端 y
  const DRAW  = 380     // 半径方向の描画幅（D5/2 がここに収まる）

  const S   = DRAW / (D5 / 2)
  const xOf = (mm: number) => AXIS + mm * S
  const yOf = (mm: number) => OY   + mm * S

  const xD1 = xOf(D1/2)
  const xD2 = xOf(D2/2)
  const xD5 = xOf(D5/2)   // = AXIS + DRAW = 70 + 380 = 450
  const xD6 = xOf(D6/2)
  const yTop = yOf(0)
  const yB1  = yOf(B1)
  const yH2  = yOf(H2)
  const yBot = yOf(B1 + H2)

  // ベジェ制御点（クラウン曲面）
  const cc1x = xD1,  cc1y = yTop + (yH2-yTop)*0.35
  const cc2x = xD6 + (xD1-xD6)*0.25, cc2y = yH2 - (yH2-yTop)*0.15

  // ベジェ制御点（バンド曲面）
  const bc1x = AXIS + (xD5-AXIS)*1.01
  const bc1y = yB1 + (yBot-yB1)*0.25
  const bc2x = xD2 + (xD5-xD2)*0.08
  const bc2y = yBot - (yBot-yB1)*0.12

  const flowPath =
    `M${xD1},${yTop} C${cc1x},${cc1y} ${cc2x},${cc2y} ${xD6},${yH2} ` +
    `L${xD2},${yBot} ` +
    `C${bc2x},${bc2y} ${bc1x},${bc1y} ${xD5},${yB1} ` +
    `L${xD1},${yTop} Z`

  // ── 寸法線 y座標（上部・28px間隔で3段）──
  // OY=140なので: D5=84px, D1=112px, タイトルは24px → 十分な余裕
  const dimY_D5 = OY - 84   // y=56 （最上段）
  const dimY_D1 = OY - 56   // y=84 （中段）
  // ※D5とD1のラベルbgは高さ15px、矢印間隔は28pxなので重ならない

  const dimY_D2 = yBot + 26  // 下部
  const dimY_D6 = yH2  + 48  // ハブ下端より下

  // 右側縦寸法線（xD5より右に配置、VW内に収める）
  const dimX_H2 = xD5 + 30   // H2: x=480
  const dimX_B1 = xD5 + 76   // B1: x=526  ← VW=720内に収まる

  // viewBox 高さ（凡例2行分を含む）
  const legendH = 68
  const VH = yBot + 30 + legendH + 20  // 図形下端 + マージン + 凡例 + 余白

  const dc = {
    D1:'#185FA5', D5:'#1D9E75', D2:'#854F0B',
    D6:'#72243E', H2:'#3C3489', B1:'#5F5E5A',
  }

  // ── 水平寸法線コンポーネント ──
  function HDim({ y, x1, x2, label, color, above=true }: {
    y:number; x1:number; x2:number; label:string; color:string; above?:boolean
  }) {
    const mid = (x1+x2)/2
    const ly  = above ? y-11 : y+18
    const tw  = label.length * 6.2  // 概算テキスト幅
    return (
      <g>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.9"
          markerEnd="url(#ma)" markerStart="url(#ma)"/>
        <line x1={x1} y1={y-4} x2={x1} y2={y+4} stroke={color} strokeWidth="0.9"/>
        <line x1={x2} y1={y-4} x2={x2} y2={y+4} stroke={color} strokeWidth="0.9"/>
        <rect x={mid-tw/2-4} y={ly-11} width={tw+8} height={15} rx="2"
          fill="white" stroke={color} strokeWidth="0.4" opacity="0.95"/>
        <text x={mid} y={ly} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

  // ── 垂直寸法線コンポーネント ──
  function VDim({ x, y1, y2, label, color }: {
    x:number; y1:number; y2:number; label:string; color:string
  }) {
    const mid = (y1+y2)/2
    const tw  = label.length * 6.2
    return (
      <g>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="0.9"
          markerEnd="url(#ma)" markerStart="url(#ma)"/>
        <line x1={x-4} y1={y1} x2={x+4} y2={y1} stroke={color} strokeWidth="0.9"/>
        <line x1={x-4} y1={y2} x2={x+4} y2={y2} stroke={color} strokeWidth="0.9"/>
        <rect x={x+5} y={mid-8} width={tw+8} height={15} rx="2"
          fill="white" stroke={color} strokeWidth="0.4" opacity="0.95"/>
        <text x={x+9} y={mid+4} fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

  // 凡例データ（2行×3列）
  const legendItems = [
    { color:dc.D1, sym:'D1', val:`${Math.round(D1)}mm`, desc:'クラウン外径' },
    { color:dc.D2, sym:'D2', val:`${Math.round(D2)}mm`, desc:'バンド下端径' },
    { color:dc.H2, sym:'H2', val:`${Math.round(H2)}mm`, desc:'流路高さ' },
    { color:dc.D5, sym:'D5', val:`${Math.round(D5)}mm`, desc:'最大外径' },
    { color:dc.D6, sym:'D6', val:`${Math.round(D6)}mm`, desc:'ハブ径' },
    { color:dc.B1, sym:'B1', val:`${Math.round(B1)}mm`, desc:'入口高さ' },
  ]
  const colW = (VW - 40) / 3   // 3列の幅
  const legY = yBot + 38

  return (
    <div style={{ background:'var(--color-background-primary,#fff)', borderRadius:6, padding:'8px 0' }}>
      <svg width="100%" viewBox={`0 0 ${VW} ${Math.round(VH)}`} style={{ display:'block' }}>
        <defs>
          <marker id="ma" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>

        {/* タイトル */}
        <text x={VW/2} y={20} textAnchor="middle" fontSize={14} fontWeight={600}
          fontFamily="sans-serif" fill="#1a1a18">
          フランシス水車ランナー　子午面断面図（右半断面）
        </text>
        <text x={VW/2} y={36} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#6b6b68">
          Ns = {Math.round(results.specificSpeed)}　単位: mm　回転軸を中心とした右半断面
        </text>

        {/* 回転軸 */}
        <line x1={AXIS} y1={OY-90} x2={AXIS} y2={yH2+10}
          stroke="#bbb" strokeWidth="0.7" strokeDasharray="8 4"/>
        <text x={AXIS} y={OY-94} textAnchor="middle" fontSize={10}
          fontFamily="monospace" fill="#888">回転軸</text>

        {/* 流路塗り */}
        <path d={flowPath} fill="#e8f0fe" opacity={0.55}/>

        {/* 輪郭線 */}
        <line x1={xD6} y1={yTop} x2={xD1} y2={yTop} stroke="#222" strokeWidth="2"/>
        <path d={`M${xD1},${yTop} C${cc1x},${cc1y} ${cc2x},${cc2y} ${xD6},${yH2}`}
          fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round"/>
        <line x1={AXIS} y1={yH2} x2={xD6} y2={yH2} stroke="#222" strokeWidth="2"/>
        <line x1={xD6} y1={yTop} x2={xD6} y2={yH2} stroke="#222" strokeWidth="2"/>
        <line x1={xD1} y1={yTop} x2={xD1} y2={yB1} stroke="#222" strokeWidth="2"/>
        <line x1={xD1} y1={yB1} x2={xD5} y2={yB1} stroke="#222" strokeWidth="2"/>
        <path d={`M${xD5},${yB1} C${bc1x},${bc1y} ${bc2x},${bc2y} ${xD2},${yBot}`}
          fill="none" stroke="#222" strokeWidth="2" strokeLinecap="round"/>
        <line x1={xD2} y1={yBot} x2={xD2+12} y2={yBot} stroke="#222" strokeWidth="2"/>

        {/* 部位ラベル */}
        <text x={AXIS+8} y={yTop+(yH2-yTop)*0.35} fontSize={12}
          fontFamily="monospace" fill="#555">クラウン</text>
        <text x={AXIS+8} y={(yB1+yBot)/2+6} fontSize={12}
          fontFamily="monospace" fill="#555">バンド</text>
        <text x={(xD6+xD5)*0.5} y={(yTop+yBot)/2+4} textAnchor="middle" fontSize={13}
          fontFamily="monospace" fill="#999">流　路</text>

        {/* 引出線（寸法線へ） */}
        <line x1={xD5} y1={yTop} x2={xD5} y2={dimY_D5-2}
          stroke={dc.D5} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD1} y1={yTop} x2={xD1} y2={dimY_D1-2}
          stroke={dc.D1} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD2} y1={yBot} x2={xD2} y2={dimY_D2+14}
          stroke={dc.D2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD6} y1={yH2} x2={xD6} y2={dimY_D6+14}
          stroke={dc.D6} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD5} y1={yB1}  x2={dimX_H2} y2={yB1}
          stroke={dc.H2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD2} y1={yBot} x2={dimX_H2} y2={yBot}
          stroke={dc.H2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD1} y1={yTop} x2={dimX_B1} y2={yTop}
          stroke={dc.B1} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD5} y1={yB1}  x2={dimX_B1} y2={yB1}
          stroke={dc.B1} strokeWidth="0.5" strokeDasharray="3 3"/>

        {/* 水平寸法線（上部）*/}
        <HDim y={dimY_D5} x1={AXIS} x2={xD5}
          label={`D5 = ${Math.round(D5)} mm`} color={dc.D5}/>
        <HDim y={dimY_D1} x1={AXIS} x2={xD1}
          label={`D1 = ${Math.round(D1)} mm`} color={dc.D1}/>

        {/* 水平寸法線（下部）*/}
        <HDim y={dimY_D2} x1={AXIS} x2={xD2}
          label={`D2 = ${Math.round(D2)} mm`} color={dc.D2} above={false}/>
        <HDim y={dimY_D6} x1={AXIS} x2={xD6}
          label={`D6 = ${Math.round(D6)} mm`} color={dc.D6} above={false}/>

        {/* 垂直寸法線（右側）*/}
        <VDim x={dimX_H2} y1={yB1} y2={yBot}
          label={`H2=${Math.round(H2)}mm`} color={dc.H2}/>
        <VDim x={dimX_B1} y1={yTop} y2={yB1}
          label={`B1=${Math.round(B1)}mm`} color={dc.B1}/>

        {/* 凡例（2行×3列、VW内に収める）*/}
        <rect x={20} y={legY} width={VW-40} height={legendH} rx="6"
          fill="#f7f6f2" stroke="#ddd" strokeWidth="0.8"/>
        {legendItems.map(({ color, sym, val, desc }, idx) => {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          const lx = 36 + col * colW
          const ly = legY + 20 + row * 26
          return (
            <g key={sym}>
              <line x1={lx} y1={ly-4} x2={lx+20} y2={ly-4}
                stroke={color} strokeWidth="1.5"
                markerEnd="url(#ma)" markerStart="url(#ma)"/>
              <text x={lx+26} y={ly} fontSize={10}
                fontFamily="monospace" fill="#333">
                <tspan fontWeight="bold" fill={color}>{sym}</tspan>
                {` = ${val}　${desc}`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
