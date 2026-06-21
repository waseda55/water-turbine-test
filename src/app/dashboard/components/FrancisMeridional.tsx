'use client'
// ============================================================
// フランシス水車ランナー 子午面断面図 v17
// Francis断面図.png（緑色部分）確定版
//
// 5辺の構成:
//   ① クラウン弧  D1(r1,0)    → D6(r6,H2)      左上膨らみベジェ
//   ② 出口内側線  D6(r6,H2)   → D7(r7,B1+H2)   斜線
//   ③ 出口水平線  D7(r7,B1+H2)→ D2(r2,B1+H2)   水平線
//   ④ バンド弧    D2(r2,B1+H2)→ D5(r5,B1)       左上膨らみベジェ（逆）
//   ⑤ 入口斜線    D5(r5,B1)   → D1(r1,0)        斜線
// ============================================================
import type { TurbineResults } from '@/types'

interface Props { results: TurbineResults }

export function FrancisMeridional({ results }: Props) {
  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const D1 = fd.D1 * 1000
  const D5 = fd.D5 * 1000
  const D6 = fd.D6 * 1000
  const D2 = fd.D2 * 1000
  const D7 = fd.D7 * 1000
  const B1 = fd.B1 * 1000
  const H2 = fd.H2 * 1000

  const r1 = D1 / 2
  const r5 = D5 / 2
  const r6 = D6 / 2
  const r2 = D2 / 2
  const r7 = D7 / 2

  // 代表点
  // D6のz位置: (r5-r6)/(r5-r2) を直線近似の比率として使うが、
  // D6半径がD2半径より小さいケースでは比率が1を超えてD2を飛び越し、
  // 自己交差を起こすため0.15〜0.85にクランプする（暫定対応）
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const tD6 = clamp((r5 - r6) / (r5 - r2), 0.15, 0.85)
  const p1 = { r: r1, z: 0 }        // D1: クラウン入口
  const p5 = { r: r5, z: B1 }       // D5: バンド入口
  const p6 = { r: r6, z: B1 + H2 * tD6 }  // D6: クラウン出口（D1-D2直線上の近似、クランプ済み）
  const p2 = { r: r2, z: B1 + H2 }  // D2: バンド出口
  const p7 = { r: r7, z: B1 + H2 }  // D7: ボス（D2と同じz）

  // SVGレイアウト
  const VW = 740
  const ML = 72
  const MR = 175
  const MT = 120
  const drawW = VW - ML - MR
  const S = Math.min(drawW / r5, 440 / (B1 + H2))

  const px = (r: number) => ML + r * S
  const pz = (z: number) => MT + z * S

  const sD1 = { x: px(p1.r), y: pz(p1.z) }
  const sD5 = { x: px(p5.r), y: pz(p5.z) }
  const sD6 = { x: px(p6.r), y: pz(p6.z) }
  const sD2 = { x: px(p2.r), y: pz(p2.z) }
  const sD7 = { x: px(p7.r), y: pz(p7.z) }

  // ベジェ制御点
  // β角度ベースの接線方向を試したが、実際の入力値（特にD5≈D2となる
  // 高Nsp域）で曲線が直線化したり、極端な比率で破綻することが判明したため撤回。
  // 元の固定比率（Francis断面図.png 確定版で目視検証済み）に戻す。
  // クラウン D1→D6: 左上膨らみ
  const cC1 = { x: sD1.x + (sD6.x - sD1.x) * 0.15, y: sD1.y + (sD6.y - sD1.y) * 0.10 }
  const cC2 = { x: sD6.x + (sD1.x - sD6.x) * 0.10, y: sD6.y - (sD6.y - sD1.y) * 0.30 }

  // バンド D5→D2（順方向）: 左上膨らみ
  const bC1 = { x: sD5.x + (sD2.x - sD5.x) * 0.15, y: sD5.y + (sD2.y - sD5.y) * 0.10 }
  const bC2 = { x: sD2.x + (sD5.x - sD2.x) * 0.10, y: sD2.y - (sD2.y - sD5.y) * 0.30 }

  // 全体輪郭パス（クラウン弧+バンド弧）
  const bladePath = [
    `M ${sD1.x} ${sD1.y}`,
    `C ${cC1.x} ${cC1.y}, ${cC2.x} ${cC2.y}, ${sD6.x} ${sD6.y}`,
    `L ${sD7.x} ${sD7.y}`,
    `L ${sD2.x} ${sD2.y}`,
    `C ${bC2.x} ${bC2.y}, ${bC1.x} ${bC1.y}, ${sD5.x} ${sD5.y}`,
    `L ${sD1.x} ${sD1.y} Z`,
  ].join(' ')

  // 塗りつぶし用パス: D1-D6-D2-D5（D7は通らず、D6-D2を直線で結ぶ）
  const innerPath = [
    `M ${sD1.x} ${sD1.y}`,
    `C ${cC1.x} ${cC1.y}, ${cC2.x} ${cC2.y}, ${sD6.x} ${sD6.y}`,
    `L ${sD2.x} ${sD2.y}`,
    `C ${bC2.x} ${bC2.y}, ${bC1.x} ${bC1.y}, ${sD5.x} ${sD5.y}`,
    `L ${sD1.x} ${sD1.y} Z`,
  ].join(' ')

  const C_D1 = '#1560BD'
  const C_D5 = '#1A8D5E'
  const C_D6 = '#7B2D8B'
  const C_D2 = '#A0420A'
  const C_D7 = '#C04A00'
  const C_B1 = '#5A5A5A'
  const C_H2 = '#2E5FA3'
  const C_ARR = '#2563EB'

  const fmt = (v: number) => Math.round(v).toLocaleString()

  function HDim({ ra, rb, y, label, color, above = true }: {
    ra: number; rb: number; y: number; label: string; color: string; above?: boolean
  }) {
    const x1 = px(ra), x2 = px(rb), mx = (x1 + x2) / 2
    const ly = above ? y - 13 : y + 18
    const tw = label.length * 6.6
    return (
      <g>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.0"
          markerEnd="url(#arrM)" markerStart="url(#arrM)" />
        <line x1={x1} y1={y-4} x2={x1} y2={y+4} stroke={color} strokeWidth="1.0" />
        <line x1={x2} y1={y-4} x2={x2} y2={y+4} stroke={color} strokeWidth="1.0" />
        <rect x={mx-tw/2-4} y={ly-11} width={tw+8} height={16} rx="2"
          fill="white" stroke={color} strokeWidth="0.5" opacity="0.96" />
        <text x={mx} y={ly+1} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

  function VDim({ rx: rx_, z1, z2, label, color }: {
    rx: number; z1: number; z2: number; label: string; color: string
  }) {
    const x = px(rx_), y1 = pz(z1), y2 = pz(z2), my = (y1+y2)/2
    const tw = label.length * 6.6
    return (
      <g>
        <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="1.0"
          markerEnd="url(#arrM)" markerStart="url(#arrM)" />
        <line x1={x-4} y1={y1} x2={x+4} y2={y1} stroke={color} strokeWidth="1.0" />
        <line x1={x-4} y1={y2} x2={x+4} y2={y2} stroke={color} strokeWidth="1.0" />
        <rect x={x+6} y={my-9} width={tw+8} height={16} rx="2"
          fill="white" stroke={color} strokeWidth="0.5" opacity="0.96" />
        <text x={x+10} y={my+4} fontSize={11}
          fontFamily="monospace" fill={color}>{label}</text>
      </g>
    )
  }

  const dimR_B1 = r5 + 22/S
  const dimR_H2 = r5 + 50/S
  const legY = pz(B1 + H2) + 80
  const VH = legY + 70

  const legendItems = [
    { c: C_D1, sym: 'D1', val: `${fmt(D1)} mm`, desc: 'クラウン入口径' },
    { c: C_D5, sym: 'D5', val: `${fmt(D5)} mm`, desc: 'バンド入口径（最大外径）' },
    { c: C_D6, sym: 'D6', val: `${fmt(D6)} mm`, desc: 'クラウン出口径（ハブ径）' },
    { c: C_D2, sym: 'D2', val: `${fmt(D2)} mm`, desc: 'バンド出口径' },
    { c: C_D7, sym: 'D7', val: `${fmt(D7)} mm`, desc: 'ボス径' },
    { c: C_B1, sym: 'B1', val: `${fmt(B1)} mm`, desc: '入口羽根高さ' },
    { c: C_H2, sym: 'H2', val: `${fmt(H2)} mm`, desc: '子午面流路高さ' },
  ]
  const colW = (VW - 40) / 3

  return (
    <div style={{ background: '#fff', borderRadius: 6, padding: '8px 0' }}>
      <svg width="100%" viewBox={`0 0 ${VW} ${Math.round(VH)}`} style={{ display: 'block' }}>
        <defs>
          <marker id="arrM" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker id="flowArr" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
            <path d="M1 1L9 5L1 9" fill={C_ARR} />
          </marker>
        </defs>

        {/* タイトル */}
        <text x={VW/2} y={18} textAnchor="middle" fontSize={14} fontWeight={700}
          fontFamily="sans-serif" fill="#111">
          フランシス水車ランナー　子午面断面図（右半断面）
        </text>
        <text x={VW/2} y={34} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#666">
          Ns = {Math.round(results.specificSpeed)}　単位: mm（等尺）
        </text>

        {/* 回転軸 */}
        <line x1={ML} y1={44} x2={ML} y2={pz(B1+H2)+16}
          stroke="#bbb" strokeWidth="0.8" strokeDasharray="9 4" />
        <text x={ML} y={40} textAnchor="middle" fontSize={9}
          fontFamily="sans-serif" fill="#999">回転軸</text>

        {/* 参考水平線 */}
        {[0, B1, H2, B1+H2].map(z => (
          <line key={z} x1={ML-20} y1={pz(z)} x2={px(r5)+20} y2={pz(z)}
            stroke="#e5e7eb" strokeWidth="0.6" strokeDasharray="4 3"/>
        ))}

        {/* 塗りつぶし: D1-D6-D2-D5（D7-D6-D2の領域は塗らない） */}
        <path d={innerPath} fill="#4ADE80" fillOpacity="0.55" stroke="none" />

        {/* 輪郭線: D7を含む全体外形（線のみ） */}
        <path d={bladePath}
          fill="none"
          stroke="#1e293b" strokeWidth="2.2" strokeLinejoin="round" />

        {/* D6-D2線を太く強調 */}
        <line
          x1={sD6.x} y1={sD6.y} x2={sD2.x} y2={sD2.y}
          stroke="#1e293b" strokeWidth="2.2" />

        {/* 部位ラベル */}
        <text
          x={(sD1.x + sD6.x) / 2 - 20}
          y={(sD1.y + sD6.y) / 2 - 10}
          fontSize={13} fontFamily="sans-serif" fontWeight="600" fill="#15803D">
          クラウン
        </text>
        <text
          x={sD5.x + 14}
          y={(sD5.y + sD2.y) / 2}
          fontSize={13} fontFamily="sans-serif" fontWeight="600" fill="#15803D">
          バンド
        </text>

        {/* 入口矢印（D1-D5間） */}
        <line
          x1={sD5.x + 44} y1={(sD1.y + sD5.y) / 2}
          x2={sD5.x + 8}  y2={(sD1.y + sD5.y) / 2}
          stroke={C_ARR} strokeWidth="2.0" markerEnd="url(#flowArr)" />
        <text x={sD5.x + 52} y={(sD1.y + sD5.y) / 2 + 4}
          fontSize={10} fontFamily="monospace" fill="#64748b">入口</text>

        {/* 出口矢印（D7-D2間） */}
        <line
          x1={(sD7.x + sD2.x) / 2} y1={sD2.y + 6}
          x2={(sD7.x + sD2.x) / 2} y2={sD2.y + 26}
          stroke={C_ARR} strokeWidth="2.0" markerEnd="url(#flowArr)" />
        <text x={(sD7.x + sD2.x) / 2 - 10} y={sD2.y + 42}
          fontSize={10} fontFamily="monospace" fill="#64748b">出口</text>

        {/* 点マーカー */}
        {[
          { s: sD1, label: 'D1', dx: 6,  dy: -8 },
          { s: sD5, label: 'D5', dx: 6,  dy: 14 },
          { s: sD6, label: 'D6', dx: 6,  dy: -8 },
          { s: sD2, label: 'D2', dx: 6,  dy: -8 },
          { s: sD7, label: 'D7', dx: -36, dy: -8 },
        ].map(({ s, label, dx, dy }) => (
          <g key={label}>
            <circle cx={s.x} cy={s.y} r={3.5}
              fill={label === 'D7' ? 'white' : '#1e293b'}
              stroke={label === 'D7' ? '#4a6fa5' : 'none'}
              strokeWidth="1.5"/>
            <text x={s.x + dx} y={s.y + dy} fontSize={11}
              fontFamily="monospace" fontWeight="600"
              fill={label === 'D7' ? '#4a6fa5' : '#1e293b'}>{label}</text>
          </g>
        ))}

        {/* 引出線 */}
        <line x1={sD1.x} y1={sD1.y} x2={sD1.x} y2={MT-26*2-2}
          stroke={C_D1} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD5.x} y1={sD5.y} x2={sD5.x} y2={MT-26*3-2}
          stroke={C_D5} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD6.x} y1={sD6.y} x2={sD6.x} y2={pz(B1)-24}
          stroke={C_D6} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD7.x} y1={sD7.y} x2={sD7.x} y2={pz(B1+H2)+52+14}
          stroke={C_D7} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD2.x} y1={sD2.y} x2={sD2.x} y2={pz(B1+H2)+78+14}
          stroke={C_D2} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD1.x} y1={sD1.y} x2={px(dimR_B1)} y2={sD1.y}
          stroke={C_B1} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD5.x} y1={sD5.y} x2={px(dimR_B1)} y2={sD5.y}
          stroke={C_B1} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD5.x} y1={sD5.y} x2={px(dimR_H2)} y2={sD5.y}
          stroke={C_H2} strokeWidth="0.5" strokeDasharray="3 3" />
        <line x1={sD2.x} y1={sD2.y} x2={px(dimR_H2)} y2={sD2.y}
          stroke={C_H2} strokeWidth="0.5" strokeDasharray="3 3" />

        {/* 寸法線 */}
        <HDim ra={0} rb={r5} y={MT-26*3} label={`D5 = ${fmt(D5)} mm`} color={C_D5} />
        <HDim ra={0} rb={r1} y={MT-26*2} label={`D1 = ${fmt(D1)} mm`} color={C_D1} />
        <HDim ra={0} rb={r6} y={pz(B1)-20} above={true} label={`D6 = ${fmt(D6)} mm`} color={C_D6} />
        <HDim ra={0} rb={r7} y={pz(B1+H2)+52} above={false} label={`D7 = ${fmt(D7)} mm`} color={C_D7} />
        <HDim ra={0} rb={r2} y={pz(B1+H2)+78} above={false} label={`D2 = ${fmt(D2)} mm`} color={C_D2} />
        <VDim rx={dimR_B1} z1={0} z2={B1} label={`B1=${fmt(B1)}mm`} color={C_B1} />
        <VDim rx={dimR_H2} z1={B1} z2={B1+H2} label={`H2=${fmt(H2)}mm`} color={C_H2} />

        {/* 凡例 */}
        <rect x={20} y={legY} width={VW-40} height={68} rx="6"
          fill="#f8f9fa" stroke="#ddd" strokeWidth="0.8" />
        {legendItems.map(({ c, sym, val, desc }, idx) => {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          const lx = 36 + col * colW
          const ly = legY + 20 + row * 24
          return (
            <g key={sym}>
              <line x1={lx} y1={ly-4} x2={lx+18} y2={ly-4}
                stroke={c} strokeWidth="1.8"
                markerEnd="url(#arrM)" markerStart="url(#arrM)" />
              <text x={lx+24} y={ly} fontSize={10} fontFamily="monospace" fill="#333">
                <tspan fontWeight="bold" fill={c}>{sym}</tspan>
                {` = ${val}　${desc}`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
