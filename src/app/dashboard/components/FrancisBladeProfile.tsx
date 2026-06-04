'use client'
// ============================================================
// フランシス水車 ブレード翼型断面図 v3
// - 縦方向に翼型を拡大表示（縦横比を独立スケール）
// - ラベル・凡例をインラインスタイルで確実に表示
// - β角ベクトルを図の上部に分離して表示
// ============================================================
import { useMemo } from 'react'
import type { TurbineResults } from '@/types'

interface Props { results: TurbineResults }

export function FrancisBladeProfile({ results }: Props) {
  const fd = results.dimensions.francisDetail
  if (!fd) return null

  const beta1deg = fd.beta1b
  const beta2deg = fd.beta2b
  const t1mm     = fd.t1 * 1000
  const t2mm     = fd.t2 * 1000
  const chord    = 650
  const N        = 100

  function nacaY(x: number): number {
    if (x <= 0) x = 1e-4
    return (1/0.2)*(0.2969*Math.sqrt(x)-0.126*x-0.3516*x*x+0.2843*x*x*x-0.1015*x*x*x*x)
  }
  const nacaRef = nacaY(0.01)

  function camberAt(x: number, b1r: number, b2r: number): number {
    const ns=30, dx=x/ns; let yc=0
    for(let i=0;i<ns;i++){
      const a=b1r+(b2r-b1r)*dx*i, b=b1r+(b2r-b1r)*dx*(i+1)
      yc+=(Math.sin(a)+Math.sin(b))/2*dx
    }
    return yc
  }

  const data = useMemo(() => {
    const b1r = beta1deg * Math.PI / 180
    const b2r = beta2deg * Math.PI / 180
    let ycMax = 0
    for(let i=0;i<=20;i++){
      const y = Math.abs(camberAt(i/20, b1r, b2r))
      if(y > ycMax) ycMax = y
    }
    const cScale = ycMax > 0 ? chord * 0.12 / ycMax : 0

    const upper: [number,number][] = []
    const lower: [number,number][] = []
    const camber: [number,number][] = []
    for(let i=0;i<=N;i++){
      const x = i/N
      const yc = camberAt(x, b1r, b2r) * cScale
      const yt = nacaY(x)/nacaRef * (t1mm+(t2mm-t1mm)*x)/2
      upper.push([x*chord, yc+yt])
      lower.push([x*chord, yc-yt])
      camber.push([x*chord, yc])
    }

    // 翼の実際の高さ範囲を取得
    const allY = [...upper.map(p=>p[1]), ...lower.map(p=>p[1])]
    const yMin = Math.min(...allY)
    const yMax = Math.max(...allY)
    const yRange = yMax - yMin

    // スケール: 横500px、縦は翼型が最低60px高さになるよう拡大
    const SX = 500 / chord
    const SY = Math.max(SX, 60 / Math.max(yRange, 1))  // 縦を強制拡大

    return { upper, lower, camber, SX, SY, yMin, yMax }
  }, [beta1deg, beta2deg, t1mm, t2mm])

  const { upper: upperPts, lower: lowerPts, camber: camberPts, SX, SY, yMin } = data

  const OX = 100   // 前縁x
  const OY = 200   // 基準y（翼型の中心あたり）

  const tx = (xmm: number) => OX + xmm * SX
  const ty = (ymm: number) => OY - ymm * SY

  const upperPath = upperPts.map((p,i)=>`${i===0?'M':'L'}${tx(p[0]).toFixed(1)},${ty(p[1]).toFixed(1)}`).join(' ')
  const lowerPath = [...lowerPts].reverse().map(p=>`L${tx(p[0]).toFixed(1)},${ty(p[1]).toFixed(1)}`).join(' ')
  const outlinePath = `${upperPath} ${lowerPath} Z`
  const camberPath  = camberPts.map((p,i)=>`${i===0?'M':'L'}${tx(p[0]).toFixed(1)},${ty(p[1]).toFixed(1)}`).join(' ')

  const teX = tx(chord)
  const teY = OY

  // 翼厚寸法線位置
  const i1  = Math.round(N*0.10)
  const i2  = Math.round(N*0.88)
  const t1u = ty(upperPts[i1][1])
  const t1l = ty(lowerPts[i1][1])
  const t1x = tx(upperPts[i1][0])
  const t2u = ty(upperPts[i2][1])
  const t2l = ty(lowerPts[i2][1])
  const t2x = tx(upperPts[i2][0])

  const yBotMax = Math.max(...lowerPts.map(p=>ty(p[1])))
  const dimY    = yBotMax + 40
  const VH      = dimY + 130

  const b1r = beta1deg * Math.PI / 180
  const b2r = beta2deg * Math.PI / 180
  const vL  = 52
  const b1ex = OX + Math.cos(b1r)*vL
  const b1ey = OY - Math.sin(b1r)*vL
  const b2ex = teX + Math.cos(b2r)*vL
  const b2ey = teY - Math.sin(b2r)*vL

  return (
    <div style={{ background:'var(--color-background-primary,#fff)', borderRadius:6, padding:'8px 0' }}>
      <svg width="100%" viewBox={`0 0 700 ${Math.round(VH)}`} style={{ display:'block' }}>
        <defs>
          <marker id="bA" viewBox="0 0 10 10" refX="8" refY="5"
            markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </marker>
        </defs>

        {/* タイトル */}
        <text x={350} y={22} textAnchor="middle" fontSize={14} fontWeight={600}
          fontFamily="sans-serif" fill="#1a1a18">
          ブレード翼型断面図（コード面展開）
        </text>
        <text x={350} y={38} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#6b6b68">
          β1b = {beta1deg.toFixed(1)}°　β2b = {beta2deg.toFixed(1)}°　コード = {chord} mm　t1 = {t1mm.toFixed(1)} mm　t2 = {t2mm.toFixed(1)} mm
        </text>
        <text x={350} y={52} textAnchor="middle" fontSize={10}
          fontFamily="monospace" fill="#999">
          ※ ブレード1枚をコード方向に展開した断面。前縁（入口）→後縁（出口）の翼型形状。
        </text>

        {/* コード基準線 */}
        <line x1={OX} y1={OY} x2={teX} y2={OY}
          stroke="#ccc" strokeWidth="0.6" strokeDasharray="6 3"/>

        {/* 翼型塗り */}
        <path d={outlinePath} fill="#dbe9ff" opacity={0.7}/>

        {/* 翼型輪郭 */}
        <path d={outlinePath} fill="none" stroke="#334"
          strokeWidth="2" strokeLinejoin="round"/>

        {/* キャンバーライン */}
        <path d={camberPath} fill="none" stroke="#888"
          strokeWidth="0.8" strokeDasharray="5 3"/>

        {/* キャンバーラベル */}
        <text x={tx(chord*0.4)} y={ty(camberPts[Math.round(N*0.4)][1])-10}
          textAnchor="middle" fontSize={10} fontFamily="monospace" fill="#888">
          キャンバーライン
        </text>

        {/* 前縁・後縁ラベル */}
        <text x={OX} y={yBotMax+16} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#666">前縁（入口）</text>
        <text x={teX} y={yBotMax+16} textAnchor="middle" fontSize={11}
          fontFamily="monospace" fill="#666">後縁（出口）</text>

        {/* β1b ベクトル */}
        <line x1={OX} y1={OY} x2={b1ex} y2={b1ey}
          stroke="#185FA5" strokeWidth="2" markerEnd="url(#bA)"/>
        <rect x={OX-90} y={b1ey-8} width={84} height={16} rx="3"
          fill="white" stroke="#185FA5" strokeWidth="0.8"/>
        <text x={OX-48} y={b1ey+4} textAnchor="middle"
          fontSize={11} fontFamily="monospace" fill="#185FA5">
          β1b={beta1deg.toFixed(1)}°
        </text>

        {/* β2b ベクトル */}
        <line x1={teX} y1={teY} x2={b2ex} y2={b2ey}
          stroke="#993C1D" strokeWidth="2" markerEnd="url(#bA)"/>
        <rect x={teX+8} y={b2ey-8} width={84} height={16} rx="3"
          fill="white" stroke="#993C1D" strokeWidth="0.8"/>
        <text x={teX+50} y={b2ey+4} textAnchor="middle"
          fontSize={11} fontFamily="monospace" fill="#993C1D">
          β2b={beta2deg.toFixed(1)}°
        </text>

        {/* t1 寸法線 */}
        <line x1={t1x} y1={t1u} x2={t1x} y2={t1l}
          stroke="#534AB7" strokeWidth="1" markerEnd="url(#bA)" markerStart="url(#bA)"/>
        <rect x={t1x-76} y={(t1u+t1l)/2-8} width={72} height={16} rx="2"
          fill="white" stroke="#534AB7" strokeWidth="0.5"/>
        <text x={t1x-40} y={(t1u+t1l)/2+4} textAnchor="middle"
          fontSize={11} fontFamily="monospace" fill="#534AB7">
          t1={t1mm.toFixed(1)}mm
        </text>

        {/* t2 寸法線 */}
        <line x1={t2x} y1={t2u} x2={t2x} y2={t2l}
          stroke="#D85A30" strokeWidth="1" markerEnd="url(#bA)" markerStart="url(#bA)"/>
        <rect x={t2x+4} y={(t2u+t2l)/2-8} width={72} height={16} rx="2"
          fill="white" stroke="#D85A30" strokeWidth="0.5"/>
        <text x={t2x+40} y={(t2u+t2l)/2+4} textAnchor="middle"
          fontSize={11} fontFamily="monospace" fill="#D85A30">
          t2={t2mm.toFixed(1)}mm
        </text>

        {/* コード寸法線 */}
        <line x1={OX}  y1={yBotMax+4} x2={OX}  y2={dimY+4}
          stroke="#aaa" strokeWidth="0.5" strokeDasharray="3 2"/>
        <line x1={teX} y1={yBotMax+4} x2={teX} y2={dimY+4}
          stroke="#aaa" strokeWidth="0.5" strokeDasharray="3 2"/>
        <line x1={OX} y1={dimY} x2={teX} y2={dimY}
          stroke="#444" strokeWidth="0.9" markerEnd="url(#bA)" markerStart="url(#bA)"/>
        <rect x={(OX+teX)/2-48} y={dimY+5} width={96} height={15} rx="2"
          fill="white" stroke="#444" strokeWidth="0.4"/>
        <text x={(OX+teX)/2} y={dimY+16} textAnchor="middle"
          fontSize={11} fontFamily="monospace" fill="#333">
          コード長 = {chord} mm
        </text>

        {/* 凡例 */}
        <rect x={40} y={dimY+30} width={620} height={76} rx="6"
          fill="#f7f6f2" stroke="#ddd" strokeWidth="0.8"/>
        <text x={60} y={dimY+48} fontSize={11} fontFamily="monospace" fill="#333">
          凡例
        </text>
        {([
          ['#185FA5', `β1b = ${beta1deg.toFixed(1)}°　入口角（前縁での相対速度方向）`,  60,  dimY+66],
          ['#993C1D', `β2b = ${beta2deg.toFixed(1)}°　出口角（後縁での相対速度方向）`,  60,  dimY+86],
          ['#534AB7', `t1 = ${t1mm.toFixed(1)} mm　入口側翼厚`,                          390, dimY+66],
          ['#D85A30', `t2 = ${t2mm.toFixed(1)} mm　出口側翼厚`,                          390, dimY+86],
        ] as [string,string,number,number][]).map(([color,label,x,ly]) => (
          <g key={label}>
            <line x1={x} y1={ly-5} x2={x+24} y2={ly-5}
              stroke={color} strokeWidth="1.5"
              markerEnd="url(#bA)" markerStart="url(#bA)"/>
            <text x={x+30} y={ly} fontSize={11}
              fontFamily="monospace" fill="#333">{label}</text>
          </g>
        ))}
        <line x1={60} y1={dimY+100} x2={84} y2={dimY+100}
          stroke="#888" strokeWidth="0.8" strokeDasharray="5 3"/>
        <text x={90} y={dimY+104} fontSize={11}
          fontFamily="monospace" fill="#333">キャンバーライン（翼弦中線）</text>
      </svg>
    </div>
  )
}
