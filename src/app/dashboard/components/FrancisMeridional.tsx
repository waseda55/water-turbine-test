'use client'
// ============================================================
// フランシス水車ランナー 子午面断面図 v3
// - 回転軸を左端に固定、右半断面のみ
// - 寸法線の重なりを解消
// - 凡例をインラインスタイルで確実に表示
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

  // ── レイアウト定数 ──
  const VW   = 700
  const AXIS = 80     // 回転軸 x座標
  const OY   = 140    // 上端マージン（タイトル・寸法線用）
  const DRAW = 440    // 描画幅（D5/2 がこの中に収まる）

  const S    = DRAW / (D5 / 2)   // スケール px/mm

  const xOf = (mm: number) => AXIS + mm * S
  const yOf = (mm: number) => OY   + mm * S

  const xD1 = xOf(D1/2)
  const xD2 = xOf(D2/2)
  const xD5 = xOf(D5/2)
  const xD6 = xOf(D6/2)
  const yTop = yOf(0)
  const yB1  = yOf(B1)
  const yH2  = yOf(H2)
  const yBot = yOf(B1 + H2)

  // ベジェ制御点（クラウン）
  const cc1x = xD1, cc1y = yTop + (yH2-yTop)*0.35
  const cc2x = xD6 + (xD1-xD6)*0.25, cc2y = yH2 - (yH2-yTop)*0.15

  // ベジェ制御点（バンド）
  const bc1x = xD5*1.005 + AXIS*0.005
  const bc1y = yB1 + (yBot-yB1)*0.25
  const bc2x = xD2 + (xD5-xD2)*0.08
  const bc2y = yBot - (yBot-yB1)*0.12

  const flowPath =
    `M${xD1},${yTop} C${cc1x},${cc1y} ${cc2x},${cc2y} ${xD6},${yH2} ` +
    `L${xD2},${yBot} ` +
    `C${bc2x},${bc2y} ${bc1x},${bc1y} ${xD5},${yB1} ` +
    `L${xD1},${yTop} Z`

  // 寸法線を上下に分散（重ならないよう各レベルを固定）
  const dimY_D5  = OY - 90   // 最上段
  const dimY_D1  = OY - 60   // 次段
  const dimY_D2  = yBot + 24
  const dimY_D6  = yH2  + 46
  const dimX_H2  = xD5  + 32
  const dimX_B1  = xD5  + 90

  const VH = yBot + 160

  const dc = {
    D1:'#185FA5', D5:'#1D9E75', D2:'#854F0B',
    D6:'#72243E', H2:'#3C3489', B1:'#5F5E5A',
  }

  // 水平寸法線
  function HDim({ y, x1, x2, label, color, above = true }: {
    y:number; x1:number; x2:number; label:string; color:string; above?:boolean
  }) {
    const mid = (x1+x2)/2
    const ly  = above ? y-10 : y+18
    return (
      <g>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="0.9"
          markerEnd="url(#ma)" markerStart="url(#ma)"/>
        <line x1={x1} y1={y-4} x2={x1} y2={y+4} stroke={color} strokeWidth="0.9"/>
        <line x1={x2} y1={y-4} x2={x2} y2={y+4} stroke={color} strokeWidth="0.9"/>
        <rect x={mid-42} y={ly-11} width={84} height={15} rx="2"
          fill="#ffffff" stroke={color} strokeWidth="0.4" opacity="0.95"/>
        <text x={mid} y={ly} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

  // 垂直寸法線
  function VDim({ x, y1, y2, label, color }: {
    x:number; y1:number; y2:number; label:string; color:string
  }) {
    const mid = (y1+y2)/2
    return (
      <g>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="0.9"
          markerEnd="url(#ma)" markerStart="url(#ma)"/>
        <line x1={x-4} y1={y1} x2={x+4} y2={y1} stroke={color} strokeWidth="0.9"/>
        <line x1={x-4} y1={y2} x2={x+4} y2={y2} stroke={color} strokeWidth="0.9"/>
        <rect x={x+5} y={mid-9} width={72} height={15} rx="2"
          fill="#ffffff" stroke={color} strokeWidth="0.4" opacity="0.95"/>
        <text x={x+9} y={mid+4} fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

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

        {/* ── タイトル ── */}
        <text x={VW/2} y={22} textAnchor="middle" fontSize={14} fontWeight={600}
          fontFamily="sans-serif" fill="#1a1a18">
          フランシス水車ランナー　子午面断面図（右半断面）
        </text>
        <text x={VW/2} y={38} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#6b6b68">
          Ns = {Math.round(results.specificSpeed)}　単位: mm　回転軸を中心とした右半断面
        </text>

        {/* 回転軸 */}
        <line x1={AXIS} y1={OY-100} x2={AXIS} y2={yH2+10}
          stroke="#aaa" strokeWidth="0.7" strokeDasharray="8 4"/>
        <text x={AXIS} y={OY-8} textAnchor="middle" fontSize={10}
          fontFamily="monospace" fill="#888">回転軸</text>

        {/* 流路塗り */}
        <path d={flowPath} fill="#e8f0fe" opacity={0.6}/>

        {/* ── 輪郭線 ── */}
        <line x1={xD6} y1={yTop} x2={xD1} y2={yTop}
          stroke="#333" strokeWidth="2"/>
        <path d={`M${xD1},${yTop} C${cc1x},${cc1y} ${cc2x},${cc2y} ${xD6},${yH2}`}
          fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        <line x1={AXIS} y1={yH2} x2={xD6} y2={yH2}
          stroke="#333" strokeWidth="2"/>
        <line x1={xD6} y1={yTop} x2={xD6} y2={yH2}
          stroke="#333" strokeWidth="2"/>
        <line x1={xD1} y1={yTop} x2={xD1} y2={yB1}
          stroke="#333" strokeWidth="2"/>
        <line x1={xD1} y1={yB1} x2={xD5} y2={yB1}
          stroke="#333" strokeWidth="2"/>
        <path d={`M${xD5},${yB1} C${bc1x},${bc1y} ${bc2x},${bc2y} ${xD2},${yBot}`}
          fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round"/>
        <line x1={xD2} y1={yBot} x2={xD2+12} y2={yBot}
          stroke="#333" strokeWidth="2"/>

        {/* 部位ラベル */}
        <text x={AXIS+10} y={(yTop+yH2*0.6)/2+20} fontSize={12}
          fontFamily="monospace" fill="#555">クラウン</text>
        <text x={AXIS+10} y={(yB1+yBot)/2+6} fontSize={12}
          fontFamily="monospace" fill="#555">バンド</text>
        <text x={(xD6+xD5)/2} y={(yTop+yBot)/2+4} textAnchor="middle" fontSize={13}
          fontFamily="monospace" fill="#888">流　路</text>

        {/* ── 引出線（寸法線用） ── */}
        <line x1={xD5} y1={yB1} x2={xD5} y2={dimY_D5-2}
          stroke={dc.D5} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD1} y1={yTop} x2={xD1} y2={dimY_D1-2}
          stroke={dc.D1} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD2} y1={yBot} x2={xD2} y2={dimY_D2+12}
          stroke={dc.D2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD6} y1={yH2} x2={xD6} y2={dimY_D6+12}
          stroke={dc.D6} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD5} y1={yB1}  x2={dimX_H2} y2={yB1}
          stroke={dc.H2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD2} y1={yBot} x2={dimX_H2} y2={yBot}
          stroke={dc.H2} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD1} y1={yTop} x2={dimX_B1} y2={yTop}
          stroke={dc.B1} strokeWidth="0.5" strokeDasharray="3 3"/>
        <line x1={xD5} y1={yB1}  x2={dimX_B1} y2={yB1}
          stroke={dc.B1} strokeWidth="0.5" strokeDasharray="3 3"/>

        {/* ── 寸法線 ── */}
        <HDim y={dimY_D5} x1={AXIS} x2={xD5}
          label={`D5 = ${Math.round(D5)} mm`} color={dc.D5}/>
        <HDim y={dimY_D1} x1={AXIS} x2={xD1}
          label={`D1 = ${Math.round(D1)} mm`} color={dc.D1}/>
        <HDim y={dimY_D2} x1={AXIS} x2={xD2}
          label={`D2 = ${Math.round(D2)} mm`} color={dc.D2} above={false}/>
        <HDim y={dimY_D6} x1={AXIS} x2={xD6}
          label={`D6 = ${Math.round(D6)} mm`} color={dc.D6} above={false}/>
        <VDim x={dimX_H2} y1={yB1} y2={yBot}
          label={`H2=${Math.round(H2)}mm`} color={dc.H2}/>
        <VDim x={dimX_B1} y1={yTop} y2={yB1}
          label={`B1=${Math.round(B1)}mm`} color={dc.B1}/>

        {/* ── 凡例 ── */}
        <rect x={40} y={yBot+70} width={600} height={62} rx="6"
          fill="#f7f6f2" stroke="#ddd" strokeWidth="0.8"/>
        {([
          [dc.D1, `D1 = ${Math.round(D1)} mm　クラウン外径`,   60,  yBot+90],
          [dc.D5, `D5 = ${Math.round(D5)} mm　最大外径`,       60,  yBot+112],
          [dc.D2, `D2 = ${Math.round(D2)} mm　バンド下端径`,  310,  yBot+90],
          [dc.D6, `D6 = ${Math.round(D6)} mm　ハブ径`,        310,  yBot+112],
          [dc.H2, `H2 = ${Math.round(H2)} mm　流路高さ`,      530,  yBot+90],
          [dc.B1, `B1 = ${Math.round(B1)} mm　入口高さ`,      530,  yBot+112],
        ] as [string,string,number,number][]).map(([color,label,x,ly]) => (
          <g key={label}>
            <line x1={x} y1={ly-5} x2={x+22} y2={ly-5}
              stroke={color} strokeWidth="1.5"
              markerEnd="url(#ma)" markerStart="url(#ma)"/>
            <text x={x+28} y={ly} fontSize={10}
              fontFamily="monospace" fill="#333">{label}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}
