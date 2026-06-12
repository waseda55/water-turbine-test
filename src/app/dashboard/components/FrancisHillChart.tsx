'use client'
// ============================================================
// フランシス水車 ヒルチャート（等効率曲線）D3版
// Python HillChart.py の contourf + contour + clabel 完全再現
// d3-contour + d3-interpolate + SVG描画
// ============================================================
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import type { TurbineResults } from '@/types'
import {
  calcHillChart,
  DEFAULT_ROUGHNESS,
  type RoughnessParams,
  type HillChartInputs,
  type HillChartPoint,
} from '@/lib/hill-chart-calc'

interface Props {
  results: TurbineResults
  inputs:  HillChartInputs
}

export default function FrancisHillChart({ results, inputs }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [rp, setRp]               = useState<RoughnessParams>({...DEFAULT_ROUGHNESS})
  const [open, setOpen]           = useState(false)
  const [computing, setComputing] = useState(false)
  const [data, setData]           = useState<HillChartPoint[]|null>(null)
  const [status, setStatus]       = useState('')

  const compute = useCallback(async () => {
    setComputing(true); setStatus('計算中...')
    await new Promise(r => setTimeout(r, 30))
    try {
      const pts = calcHillChart(results, inputs, rp)
      setData(pts)
      const best = pts.length ? pts.reduce((b,d)=>d.eta>b.eta?d:b,pts[0]) : null
      setStatus(best
        ? `${pts.length}点完了 / 最高効率 η=${best.eta.toFixed(1)}% (N11=${best.N11.toFixed(1)}, Q11=${best.Q11.toFixed(3)})`
        : `${pts.length}点完了`)
    } catch(e) { setStatus('エラー: '+String(e)) }
    setComputing(false)
  }, [results, inputs, rp])

// D3で描画
  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return

    // d3-delaunay を動的ロードに追加
    Promise.all([
      import('d3-contour'),
      import('d3-scale'),
      import('d3-axis'),
      import('d3-selection'),
      import('d3-shape'),
      import('d3-geo'),
      import('d3-delaunay') // ← 追加
    ]).then(([contourMod, scaleMod, axisMod, selMod, shapeMod, geoMod, delaunayMod]) => {
      const { contours: d3contours } = contourMod
      const { scaleLinear, scaleSequential } = scaleMod
      const { axisBottom, axisLeft, axisRight } = axisMod
      const { select } = selMod
      const { line } = shapeMod
      const { geoPath, geoTransform } = geoMod
      const { Delaunay } = delaunayMod // ← 追加

      const svg = select(svgRef.current!)
      svg.selectAll('*').remove()

      const W = svgRef.current!.clientWidth || 640
      const H = 520  // was 480
      const ml=54, mr=85, mt=38, mb=50
      const pw = W-ml-mr, ph = H-mt-mb

      svg.attr('height', H)

      const n11s = data.map(d=>d.N11), q11s = data.map(d=>d.Q11)
      const xMin=Math.min(...n11s), xMax=Math.max(...n11s)
      const yMin=Math.min(...q11s), yMax=Math.max(...q11s)
      const etaMin=Math.min(...data.map(d=>d.eta))
      const etaMax=Math.max(...data.map(d=>d.eta))

      const xSc = scaleLinear().domain([xMin,xMax]).range([0,pw])
      const ySc = scaleLinear().domain([yMin,yMax]).range([ph,0])

      const g = svg.append('g').attr('transform',`translate(${ml},${mt})`)

      // クリップ
      svg.append('defs').append('clipPath').attr('id','hc-clip')
        .append('rect').attr('width',pw).attr('height',ph)

      // ── Python griddata(method='linear') の完全再現 ──
      const nx=100, ny=100
      const gridArr = new Float64Array(nx*ny)

      // 1. 測定点からドロネー三角形分割を生成
      // 変数 pts に : [number, number][] という型を明示します
      const pts: [number, number][] = data.map(d => [d.N11, d.Q11])
      const delaunay = Delaunay.from(pts)
      const { triangles } = delaunay

      // 2. ループを高速化するため、各三角形の座標と分母(D)を事前計算
      const triData = []
      for (let i = 0; i < triangles.length; i += 3) {
        const p1 = data[triangles[i]]
        const p2 = data[triangles[i+1]]
        const p3 = data[triangles[i+2]]
        // 重心座標系の分母
        const D = (p2.Q11 - p3.Q11) * (p1.N11 - p3.N11) + (p3.N11 - p2.N11) * (p1.Q11 - p3.Q11)
        if (Math.abs(D) > 1e-10) { // 面積が0の縮退三角形を除外
          triData.push({ p1, p2, p3, D })
        }
      }

      // 3. 100x100グリッドの各点について、内包する三角形を探して線形補間
      for (let j=0;j<ny;j++) {
        for (let i=0;i<nx;i++) {
          const qx = xMin+i*(xMax-xMin)/(nx-1)
          const qy = yMin+j*(yMax-yMin)/(ny-1)
          let val = NaN

          for (const tri of triData) {
            const { p1, p2, p3, D } = tri
            // 重心座標 (w1, w2, w3) を計算
            const w1 = ((p2.Q11 - p3.Q11) * (qx - p3.N11) + (p3.N11 - p2.N11) * (qy - p3.Q11)) / D
            if (w1 < -1e-5 || w1 > 1.00001) continue // 浮動小数点誤差を考慮した境界判定
            
            const w2 = ((p3.Q11 - p1.Q11) * (qx - p3.N11) + (p1.N11 - p3.N11) * (qy - p3.Q11)) / D
            if (w2 < -1e-5 || w2 > 1.00001) continue
            
            const w3 = 1 - w1 - w2
            if (w3 < -1e-5 || w3 > 1.00001) continue

            // 点が三角形の内部にある場合、頂点の効率(eta)を重み付けして補間
            val = w1 * p1.eta + w2 * p2.eta + w3 * p3.eta
            break // 三角形が見つかったら探索終了
          }
          gridArr[j*nx+i] = val
        }
      }

      // ── Python levels=20 相当（ここから下は既存のまま） ──
      // ── 5刻みの固定等高線レベル（50,55,60,65,...）──
      const levelStep = 5
      const levelStart = Math.ceil(etaMin / levelStep) * levelStep
      const levelEnd   = Math.floor(etaMax / levelStep) * levelStep
      const levels: number[] = []
      for (let v = levelStart; v <= levelEnd; v += levelStep) levels.push(v)
      const nLevels = levels.length

      // ── d3-contour で等高線生成 ──
      const contourGen = d3contours().size([nx,ny]).thresholds(levels)
      const contoursData = contourGen(Array.from(gridArr))

      // グリッド座標 → SVG座標変換
      const proj = geoTransform({
        point(px: number, py: number) {
          const n11 = xMin+px*(xMax-xMin)/(nx-1)
          const q11 = yMin+py*(yMax-yMin)/(ny-1)
          ;(this as any).stream.point(xSc(n11), ySc(q11))
        }
      })
      const pathGen = geoPath(proj)

      // jet カラーマップ
      const jetColor = (t: number) => {
        t = Math.max(0,Math.min(1,t))
        const r = Math.max(0,Math.min(1,1.5-Math.abs(4*t-3)))
        const gg = Math.max(0,Math.min(1,1.5-Math.abs(4*t-2)))
        const b = Math.max(0,Math.min(1,1.5-Math.abs(4*t-1)))
        return `rgb(${Math.round(r*255)},${Math.round(gg*255)},${Math.round(b*255)})`
      }

      const colorSc = scaleSequential()
        .domain([etaMin,etaMax])
        .interpolator((t:number)=>jetColor(t))

      // ── contourf 相当（塗り等高線）──
      const gc = g.append('g').attr('clip-path','url(#hc-clip)')
      contoursData.forEach(c => {
        gc.append('path')
          .datum(c)
          .attr('d', pathGen as any)
          .attr('fill', colorSc(c.value))
          .attr('opacity', 0.85)
          .attr('stroke','none')
      })

      // ── contour lines 相当 ──
      contoursData.forEach(c => {
        const isMain = Math.round(c.value) % 10 === 0
        gc.append('path')
          .datum(c)
          .attr('d', pathGen as any)
          .attr('fill','none')
          .attr('stroke','black')
          .attr('stroke-width', isMain ? 0.9 : 0.35)
          .attr('opacity', isMain ? 0.75 : 0.45)
      })

      // ── clabel 相当（等高線ラベル: 5刻み全て）──
      contoursData.forEach((c,idx) => {
        // 全レベルにラベルを表示（5刻みなので全部表示）
        c.coordinates.forEach(polygon => {
          polygon.forEach(ring => {
            if (ring.length < 12) return
            // 複数箇所にラベルを配置
            [0.25, 0.6].forEach(frac => {
              const pt = ring[Math.floor(ring.length*frac)]
              const n11 = xMin+pt[0]*(xMax-xMin)/(nx-1)
              const q11 = yMin+pt[1]*(yMax-yMin)/(ny-1)
              const lx = xSc(n11), ly = ySc(q11)
              if (lx<4||lx>pw-4||ly<4||ly>ph-4) return
              g.append('text')
                .attr('x',lx).attr('y',ly)
                .attr('text-anchor','middle').attr('dominant-baseline','middle')
                .attr('font-size',8).attr('font-family','monospace')
                .attr('fill','black')
                .attr('stroke','white').attr('stroke-width',2.5)
                .attr('paint-order','stroke')
                .text(String(Math.round(c.value)))
            })
          })
        })
      })

      // ── 測定点 ──
      g.selectAll('circle.pt').data(data).enter()
        .append('circle').attr('class','pt')
        .attr('cx',d=>xSc(d.N11)).attr('cy',d=>ySc(d.Q11))
        .attr('r',2.5).attr('fill','#222').attr('opacity',0.5)

      // ── 最高効率点 ──
      const best = data.reduce((b,d)=>d.eta>b.eta?d:b,data[0])
      g.append('circle').attr('cx',xSc(best.N11)).attr('cy',ySc(best.Q11))
        .attr('r',7).attr('fill','none').attr('stroke','white').attr('stroke-width',2.5)
      g.append('circle').attr('cx',xSc(best.N11)).attr('cy',ySc(best.Q11))
        .attr('r',3.5).attr('fill','white')

      // ── 軸 ──
      const xa = axisBottom(xSc).ticks(8).tickFormat((d:any)=>String(Math.round(d)))
      const ya = axisLeft(ySc).ticks(8).tickFormat((d:any)=>Number(d).toFixed(2))
      g.append('g').attr('transform',`translate(0,${ph})`).call(xa)
        .selectAll('text').attr('font-size',10).attr('font-family','monospace')
      g.append('g').call(ya)
        .selectAll('text').attr('font-size',10).attr('font-family','monospace')

      // グリッド線
      const xGrid = axisBottom(xSc).ticks(8).tickSize(-ph).tickFormat(()=>'')
      const yGrid = axisLeft(ySc).ticks(8).tickSize(-pw).tickFormat(()=>'')
      g.append('g').attr('transform',`translate(0,${ph})`).call(xGrid)
        .selectAll('line').attr('stroke','rgba(255,255,255,0.3)').attr('stroke-dasharray','3 3')
      g.append('g').call(yGrid)
        .selectAll('line').attr('stroke','rgba(255,255,255,0.3)').attr('stroke-dasharray','3 3')
      g.selectAll('.domain').attr('stroke','#555')

      // 軸ラベル
      svg.append('text').attr('x',ml+pw/2).attr('y',H-8)
        .attr('text-anchor','middle').attr('font-size',12)
        .attr('font-family','monospace').attr('fill','#333')
        .text('Unit Speed N₁₁')
      svg.append('text')
        .attr('transform','rotate(-90)')
        .attr('x',-(mt+ph/2)).attr('y',15)
        .attr('text-anchor','middle').attr('font-size',12)
        .attr('font-family','monospace').attr('fill','#333')
        .text('Unit Discharge Q₁₁')

      // タイトル
      svg.append('text').attr('x',ml+pw/2).attr('y',22)
        .attr('text-anchor','middle').attr('font-size',13).attr('font-weight',600)
        .attr('font-family','monospace').attr('fill','#222')
        .text('Turbine Hill Diagram (Efficiency Contours)')

      // ── カラーバー ──
      const cbX=ml+pw+10, cbW=15
      const cbSteps=50
      for (let i=0;i<cbSteps;i++) {
        const t0=i/cbSteps,t1=(i+1)/cbSteps
        svg.append('rect')
          .attr('x',cbX).attr('y',mt+ph*(1-t1))
          .attr('width',cbW).attr('height',ph/cbSteps+0.5)
          .attr('fill',jetColor((t0+t1)/2))
      }
      svg.append('rect').attr('x',cbX).attr('y',mt)
        .attr('width',cbW).attr('height',ph)
        .attr('fill','none').attr('stroke','#999').attr('stroke-width',0.5)

      const cbSc = scaleLinear().domain([etaMin,etaMax]).range([mt+ph,mt])
      const cbAxis = axisRight(cbSc).ticks(7).tickFormat((d:any)=>Math.round(d)+'%')
      svg.append('g').attr('transform',`translate(${cbX+cbW},0)`).call(cbAxis)
        .selectAll('text').attr('font-size',9).attr('font-family','monospace')
      svg.append('text')
        .attr('transform','rotate(90)')
        .attr('x',mt+ph/2).attr('y',-(cbX+cbW+38))
        .attr('text-anchor','middle').attr('font-size',10)
        .attr('font-family','monospace').attr('fill','#555')
        .text('Efficiency η (%)')

      // 凡例
      g.append('circle').attr('cx',8).attr('cy',ph-8)
        .attr('r',2.5).attr('fill','#222').attr('opacity',0.5)
      g.append('text').attr('x',14).attr('y',ph-8)
        .attr('dominant-baseline','middle').attr('font-size',9)
        .attr('font-family','monospace').attr('fill','#333')
        .text('Measurement Points')
    })
  }, [data])

  const btnStyle = (dis: boolean): React.CSSProperties => ({
    padding:'6px 18px', fontSize:12, fontFamily:'monospace',
    background: dis?'rgba(245,158,11,0.08)':'rgba(245,158,11,0.15)',
    border:'1px solid rgba(245,158,11,0.6)',
    color: dis?'#aaa':'var(--accent,#f59e0b)',
    borderRadius:4, cursor: dis?'not-allowed':'pointer',
  })

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>

      {/* 粗さパラメータ（アコーデオン） */}
      <div style={{border:'1px solid var(--color-border-tertiary,#ddd)',borderRadius:6}}>
        <button onClick={()=>setOpen(v=>!v)}
          style={{width:'100%',padding:'8px 12px',display:'flex',
            justifyContent:'space-between',alignItems:'center',
            background:'none',border:'none',cursor:'pointer',
            fontSize:12,fontFamily:'monospace',
            color:'var(--color-text-secondary,#666)'}}>
          <span>⚙️ 粗さパラメータ（詳細設定）</span>
          <span>{open?'▲':'▼'}</span>
        </button>
        {open && (
          <div style={{padding:'10px 14px 12px',
            borderTop:'1px solid var(--color-border-tertiary,#ddd)',
            display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'8px 16px'}}>
            {([
              ['rrC','ケーシング'],['rrS','ステーベーン'],['rrG','ガイドベーン'],
              ['rrR','ランナ'],['rrD','ドラフトチューブ'],['rrW','シール（固定）'],
            ] as [keyof RoughnessParams, string][]).map(([key,label])=>(
              <div key={key} style={{display:'flex',flexDirection:'column',gap:2}}>
                <label style={{fontSize:10,fontFamily:'monospace',
                  color:'var(--color-text-secondary,#888)'}}>{label}（{key}）</label>
                <input type="number" step="0.000001" min="0" max="0.1"
                  value={rp[key]}
                  onChange={e=>setRp(p=>({...p,[key]:parseFloat(e.target.value)||0}))}
                  disabled={key==='rrW'}
                  style={{width:120,padding:'3px 6px',fontSize:11,fontFamily:'monospace',
                    background:'var(--color-background-secondary,#f5f5f5)',
                    border:'1px solid var(--color-border-tertiary,#ddd)',
                    borderRadius:3,color:'var(--color-text-primary,#333)'}}/>
              </div>
            ))}
            <div style={{gridColumn:'1/-1',marginTop:4}}>
              <button onClick={()=>setRp({...DEFAULT_ROUGHNESS})}
                style={{...btnStyle(false),padding:'3px 10px',fontSize:10}}>
                デフォルトに戻す
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 計算ボタン */}
      <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <button onClick={compute} disabled={computing} style={btnStyle(computing)}>
          {computing?'⏳ 計算中...':'▶ ヒルチャートを計算'}
        </button>
        {status && (
          <span style={{fontSize:11,fontFamily:'monospace',
            color:'var(--color-text-secondary,#888)'}}>{status}</span>
        )}
      </div>

      {/* ヒルチャート SVG */}
      {data && data.length > 0 ? (
        <div style={{background:'#fff',borderRadius:6,padding:'8px 4px',
          border:'1px solid var(--color-border-tertiary,#ddd)'}}>
          <svg ref={svgRef} width="100%" style={{display:'block'}}/>
        </div>
      ) : !computing && (
        <div style={{border:'1px solid var(--color-border-tertiary,#ddd)',
          borderRadius:6,padding:40,textAlign:'center',
          color:'var(--color-text-tertiary,#aaa)',
          fontSize:12,fontFamily:'monospace'}}>
          「▶ ヒルチャートを計算」ボタンを押すと<br/>
          N₁₁–Q₁₁ 平面上の等効率曲線（ヒルチャート）を描画します。<br/>
          <span style={{fontSize:10,marginTop:8,display:'block'}}>
            9通りの回転数比率 × 最大10段階の開度 = 性能マップを計算・補間します
          </span>
        </div>
      )}
    </div>
  )
}
