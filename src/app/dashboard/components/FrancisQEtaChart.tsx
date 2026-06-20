

'use client'
// ============================================================
// フランシス水車 Q-η曲線 + 損失内訳チャート
// q-eta-calc.ts（1d_loss_ver2.py移植）を使用
// ============================================================
import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { TurbineResults } from '@/types'
import {
  calcQEtaCurve,
  DEFAULT_ROUGHNESS,
  type RoughnessParams,
  type QEtaPoint,
} from '@/lib/q-eta-calc'

interface Props {
  results:  TurbineResults
  head:     number
  flowRate: number
  ratedRpm: number
  turbineEff: number  // 0〜1
}

const LOSS_COLORS = {
  thetaC: '#60a5fa',   // ケーシング
  thetaS: '#34d399',   // ステーベーン
  thetaG: '#f59e0b',   // ガイドベーン
  thetaR: '#ef4444',   // ランナ
  thetaD: '#a78bfa',   // ドラフトチューブ
}
const LOSS_LABELS = {
  thetaC: 'ケーシング',
  thetaS: 'ステーベーン',
  thetaG: 'ガイドベーン',
  thetaR: 'ランナ',
  thetaD: 'ドラフトチューブ',
}

export default function FrancisQEtaChart({ results, head, flowRate, ratedRpm, turbineEff }: Props) {
  const [rp, setRp]               = useState<RoughnessParams>({ ...DEFAULT_ROUGHNESS })
  const [open, setOpen]           = useState(false)
  const [computing, setComputing] = useState(false)
  const [data, setData]           = useState<QEtaPoint[] | null>(null)
  const [status, setStatus]       = useState('')

  const compute = useCallback(async () => {
    setComputing(true); setStatus('計算中...')
    await new Promise(r => setTimeout(r, 20))
    try {
      const pts = calcQEtaCurve(
        results,
        { head, flowRate, rotationalSpeed: ratedRpm, turbineEff },
        rp,
      )
      setData(pts)
      const best = pts.length ? pts.reduce((b, d) => d.eta > b.eta ? d : b, pts[0]) : null
      setStatus(best
        ? `${pts.length}点完了 / 最高効率 η=${best.eta.toFixed(1)}%（Q=${best.Q.toFixed(3)} m³/s, GVO=${best.GVO}%）`
        : `${pts.length}点完了`)
    } catch (e) { setStatus('エラー: ' + String(e)) }
    setComputing(false)
  }, [results, head, flowRate, ratedRpm, turbineEff, rp])

  // 設計点（Q=flowRate）に最も近い点
  const designPoint = useMemo(() => {
    if (!data) return null
    return data.reduce((b, d) => Math.abs(d.Q - flowRate) < Math.abs(b.Q - flowRate) ? d : b, data[0])
  }, [data, flowRate])

  // チャート用データ（Q昇順、設計流量比 Q/Qd も付加）
  const chartData = useMemo(() => {
    if (!data) return []
    return data.map(d => ({
      ...d,
      QRatio: +(d.Q / flowRate * 100).toFixed(1),
      Qlabel: d.Q.toFixed(3),
    }))
  }, [data, flowRate])

  const btnStyle = (dis: boolean): React.CSSProperties => ({
    padding: '6px 18px', fontSize: 12, fontFamily: 'monospace',
    background: dis ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.6)',
    color: dis ? '#aaa' : 'var(--accent,#f59e0b)',
    borderRadius: 4, cursor: dis ? 'not-allowed' : 'pointer',
  })

  const ttStyle: React.CSSProperties = {
    background: 'var(--color-background-primary,#fff)',
    border: '1px solid var(--color-border-tertiary,#ddd)',
    borderRadius: 4, fontSize: 11, fontFamily: 'monospace',
    padding: '6px 10px', lineHeight: 1.7,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* 粗さパラメータ（アコーデオン） */}
      <div style={{ border: '1px solid var(--color-border-tertiary,#ddd)', borderRadius: 6 }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ width: '100%', padding: '8px 12px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, fontFamily: 'monospace',
            color: 'var(--color-text-secondary,#666)' }}>
          <span>⚙️ 粗さパラメータ（詳細設定）</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div style={{ padding: '10px 14px 12px',
            borderTop: '1px solid var(--color-border-tertiary,#ddd)',
            display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px 16px' }}>
            {([
              ['rrC', 'ケーシング'], ['rrS', 'ステーベーン'], ['rrG', 'ガイドベーン'],
              ['rrR', 'ランナ'],     ['rrD', 'ドラフトチューブ'], ['rrW', 'シール（固定）'],
            ] as [keyof RoughnessParams, string][]).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 10, fontFamily: 'monospace' }}>
                  {label}
                </label>
                <input type="number" step="0.000001" min="0" max="0.1"
                  value={rp[key]}
                  onChange={e => setRp(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                  disabled={key === 'rrW'}
                  style={{ width: 120, padding: '3px 6px', fontSize: 11, fontFamily: 'monospace',
                    background: 'var(--color-background-secondary,#f5f5f5)',
                    border: '1px solid var(--color-border-tertiary,#ddd)',
                    borderRadius: 3, color: 'var(--color-text-primary,#333)' }} />
              </div>
            ))}
            <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
              <button onClick={() => setRp({ ...DEFAULT_ROUGHNESS })}
                style={{ ...btnStyle(false), padding: '3px 10px', fontSize: 10 }}>
                デフォルトに戻す
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 計算ボタン */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button onClick={compute} disabled={computing} style={btnStyle(computing)}>
          {computing ? '⏳ 計算中...' : '▶ Q-η曲線を計算'}
        </button>
        {status && (
          <span style={{ fontSize: 11, fontFamily: 'monospace',
            color: 'var(--color-text-secondary,#888)' }}>{status}</span>
        )}
      </div>

      {data && data.length > 0 ? (
        <>
          {/* ── Q-η曲線 ── */}
          <div style={{ border: '1px solid var(--color-border-tertiary,#ddd)',
            borderRadius: 6, padding: '12px 8px', height: 640 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10,
              fontFamily: 'monospace', color: 'var(--color-text-primary,#333)' }}>
              Q–η曲線（流量–効率曲線）
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}
                margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3"
                  stroke="var(--color-border-tertiary,#eee)" />
                <XAxis dataKey="Q"
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: '流量 Q [m³/s]', position: 'insideBottom',
                    offset: -12, fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis yAxisId="eta" domain={[0, 100]}
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: '効率 η [%]', angle: -90, position: 'insideLeft',
                    offset: 10, fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis yAxisId="p" orientation="right"
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: '出力 P [kW]', angle: 90, position: 'insideRight',
                    offset: 10, fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={ttStyle}
                  formatter={(v: number, name: string) => [
                    name === '出力 P' ? v.toFixed(0) + ' kW' : v.toFixed(1) + '%',
                    name,
                  ]}
                  labelFormatter={v => `Q = ${Number(v).toFixed(3)} m³/s`} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                {/* 設計流量の参照線 */}
                <ReferenceLine yAxisId="eta" x={flowRate}
                  stroke="#999" strokeDasharray="4 3"
                  label={{ value: 'Qd', position: 'top', fontSize: 10 }} />
                <Line yAxisId="eta" type="monotone" dataKey="eta"
                  name="総合効率 η" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="eta" type="monotone" dataKey="etaH"
                  name="水力効率 ηH" stroke="#60a5fa" strokeWidth={1.2}
                  strokeDasharray="5 3" dot={false} />
                <Line yAxisId="eta" type="monotone" dataKey="etaL"
                  name="容積効率 ηL" stroke="#34d399" strokeWidth={1.2}
                  strokeDasharray="3 3" dot={false} />
                <Line yAxisId="eta" type="monotone" dataKey="etaM"
                  name="機械効率 ηM" stroke="#a78bfa" strokeWidth={1.2}
                  strokeDasharray="2 2" dot={false} />
                <Line yAxisId="p" type="monotone" dataKey="P"
                  name="出力 P" stroke="#fb923c" strokeWidth={1.5}
                  strokeDasharray="4 2" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* ── 損失内訳（積み上げ棒グラフ）── */}
          <div style={{ border: '1px solid var(--color-border-tertiary,#ddd)',
            borderRadius: 6, padding: '12px 8px', height: 640}}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10,
              fontFamily: 'monospace', color: 'var(--color-text-primary,#333)' }}>
              損失内訳 θ [% of H₀]
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}
                margin={{ top: 8, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3"
                  stroke="var(--color-border-tertiary,#eee)" />
                <XAxis dataKey="Q"
                  tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: '流量 Q [m³/s]', position: 'insideBottom',
                    offset: -12, fontSize: 11, fontFamily: 'monospace' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'monospace' }}
                  label={{ value: '損失 θ [%]', angle: -90, position: 'insideLeft',
                    offset: 10, fontSize: 11, fontFamily: 'monospace' }} />
                <Tooltip contentStyle={ttStyle}
                  formatter={(v: number, name: string) => [v.toFixed(2) + '%', name]}
                  labelFormatter={v => `Q = ${Number(v).toFixed(3)} m³/s`} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'monospace' }} />
                <ReferenceLine x={flowRate}
                  stroke="#999" strokeDasharray="4 3" />
                {(Object.keys(LOSS_COLORS) as (keyof typeof LOSS_COLORS)[]).map(key => (
                  <Bar key={key} dataKey={key} name={LOSS_LABELS[key]}
                    stackId="loss" fill={LOSS_COLORS[key]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── 設計点サマリー ── */}
          {designPoint && (
            <div style={{ border: '1px solid var(--color-border-tertiary,#ddd)',
              borderRadius: 6, padding: '10px 14px',
              background: 'var(--color-background-secondary,#f9f9f9)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8,
                fontFamily: 'monospace', color: 'var(--color-text-primary,#333)' }}>
                設計点近傍（GVO={designPoint.GVO}%、Q={designPoint.Q.toFixed(3)} m³/s）
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
                gap: '6px 12px', fontSize: 11, fontFamily: 'monospace' }}>
                {[
                  ['総合効率 η',     designPoint.eta.toFixed(2) + ' %'],
                  ['水力効率 ηH',    designPoint.etaH.toFixed(2) + ' %'],
                  ['容積効率 ηL',    designPoint.etaL.toFixed(2) + ' %'],
                  ['機械効率 ηM',    designPoint.etaM.toFixed(2) + ' %'],
                  ['出力 P',         designPoint.P.toFixed(0) + ' kW'],
                  ['理論揚程 Hth',   designPoint.Hth.toFixed(2) + ' m'],
                  ['θ ランナ',       designPoint.thetaR.toFixed(2) + ' %'],
                  ['θ ガイドベーン', designPoint.thetaG.toFixed(2) + ' %'],
                  ['θ ステーベーン', designPoint.thetaS.toFixed(2) + ' %'],
                  ['θ ケーシング',   designPoint.thetaC.toFixed(2) + ' %'],
                  ['θ ドラフトチューブ', designPoint.thetaD.toFixed(2) + ' %'],
                  ['θ 合計',        (designPoint.thetaR+designPoint.thetaG+designPoint.thetaS+designPoint.thetaC+designPoint.thetaD).toFixed(2) + ' %'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column',
                    padding: '4px 0', borderBottom: '1px solid var(--color-border-tertiary,#eee)' }}>
                    <span style={{ fontSize: 10, color: 'var(--color-text-secondary,#888)' }}>{label}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary,#333)' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : !computing && (
        <div style={{ border: '1px solid var(--color-border-tertiary,#ddd)',
          borderRadius: 6, padding: 32, textAlign: 'center',
          color: 'var(--color-text-tertiary,#aaa)',
          fontSize: 12, fontFamily: 'monospace' }}>
          「▶ Q-η曲線を計算」ボタンを押すと<br />
          1D損失解析によるQ–η曲線と損失内訳を表示します。<br />
          <span style={{ fontSize: 10, marginTop: 8, display: 'block' }}>
            GVO 20〜110%（10段階）× 流量収束計算
          </span>
        </div>
      )}
    </div>
  )
}
