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

    // D3を動的ロード
    Promise.all([
      import('d3-contour'),
      import('d3-scale'),
      import('d3-axis'),
      import('d3-selection'),
      import('d3-shape'),
      import('d3-geo'),
    ]).then(([contourMod, scaleMod, axisMod, selMod, shapeMod, geoMod]) => {
      const { contours: d3contours } = contourMod
      const { scaleLinear, scaleSequential } = scaleMod
      const { axisBottom, axisLeft, axisRight } = axisMod
      const { select } = selMod
      const { line } = shapeMod
      const { geoPath, geoTransform } = geoMod

      const svg = select(svgRef.current!)
      svg.selectAll('*').remove()

      const W = svgRef.current!.clientWidth || 640
      const H = 480
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

      // ── 100×100 グリッド補間（IDW power=2）──
      const nx=100, ny=100
      const gridArr = new Float64Array(nx*ny)
      for (let j=0;j<ny;j++) {
        for (let i=0;i<nx;i++) {
          const qx = xMin+i*(xMax-xMin)/(nx-1)
          const qy = yMin+j*(yMax-yMin)/(ny-1)
          let sw=0,sv=0
          for (const d of data) {
            const dx=d.N11-qx, dy=(d.Q11-qy)*40
            const d2=dx*dx+dy*dy
            if (d2<1e-8){sv=d.eta;sw=1;break}
            const w=1/d2; sw+=w; sv+=w*d.eta
          }
          gridArr[j*nx+i] = sw>0 ? sv/sw : NaN
        }
      }

      // ── Python levels=20 相当 ──
      const nLevels = 20
      const levels = Array.from({length:nLevels},(_,i)=>etaMin+i*(etaMax-etaMin)/(nLevels-1))

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
        const isMain = Math.round(c.value) % 5 === 0
        gc.append('path')
          .datum(c)
          .attr('d', pathGen as any)
          .attr('fill','none')
          .attr('stroke','black')
          .attr('stroke-width', isMain ? 0.9 : 0.35)
          .attr('opacity', isMain ? 0.75 : 0.45)
      })

      // ── clabel 相当（等高線ラベル）──
      const labelStep = Math.max(1, Math.floor(nLevels/6))
      contoursData.forEach((c,idx) => {
        if (idx % labelStep !== 0) return
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
                .text(c.value.toFixed(1))
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
