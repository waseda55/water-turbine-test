'use client'
// ============================================================
// TurbineSchematic.tsx
// 水車形式に応じて適切な概略図を表示するディスパッチャー
// ============================================================
import { useMemo } from 'react'
import type { TurbineResults } from '@/types'
import { buildFrancisSvg }   from './francis-svg'
import { buildPeltonSvg }    from './pelton-svg'
import { buildKaplanSvg }    from './kaplan-svg'
import { buildCrossflowSvg } from './crossflow-svg'
import { buildTubularSvg }   from './tubular-svg'

interface Props {
  results: TurbineResults | null
}

const typeColor: Record<string, string> = {
  'フランシス水車': '#38bdf8',
  'ペルトン水車':   '#a78bfa',
  'カプラン水車':   '#34d399',
  'クロスフロー水車': '#fb923c',
  'チューブラ水車': '#f472b6',
}

const typeLabel: Record<string, string> = {
  'フランシス水車': 'フランシス水車　断面概略図',
  'ペルトン水車':   'ペルトン水車　正面概略図',
  'カプラン水車':   'カプラン水車　縦断面概略図',
  'クロスフロー水車': 'クロスフロー水車　断面概略図',
  'チューブラ水車': 'チューブラ水車　縦断面概略図',
}

export default function TurbineSchematic({ results }: Props) {
  const svgContent = useMemo(() => {
    if (!results) return null
    try {
      switch (results.turbineType) {
        case 'フランシス水車':   return buildFrancisSvg(results)
        case 'ペルトン水車':     return buildPeltonSvg(results)
        case 'カプラン水車':     return buildKaplanSvg(results)
        case 'クロスフロー水車': return buildCrossflowSvg(results)
        case 'チューブラ水車':   return buildTubularSvg(results)
        default:                 return null
      }
    } catch {
      return null
    }
  }, [results])

  if (!results) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 360, color: 'var(--muted)', fontSize: 13,
        border: '1px dashed var(--border)', borderRadius: 8,
        flexDirection: 'column', gap: 8,
      }}>
        <span style={{ fontSize: 32, opacity: 0.4 }}>📐</span>
        <span>入力パラメータを設定して計算を実行してください</span>
      </div>
    )
  }

  if (!svgContent) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 360, color: 'var(--muted)', fontSize: 13,
        border: '1px dashed var(--border)', borderRadius: 8,
        flexDirection: 'column', gap: 8,
      }}>
        <span style={{ fontSize: 32, opacity: 0.4 }}>🔧</span>
        <span>この水車形式の図面生成に対応していません</span>
        <span style={{ fontSize: 11, opacity: 0.5 }}>{results.turbineType}</span>
      </div>
    )
  }

  const color = typeColor[results.turbineType] ?? '#94a3b8'
  const label = typeLabel[results.turbineType] ?? results.turbineType

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
        borderRadius: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: color, display: 'inline-block', flexShrink: 0,
            boxShadow: `0 0 6px ${color}`,
          }}/>
          <span style={{ fontSize: 12, fontWeight: 600, color, fontFamily: 'monospace' }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
          概略参考図（設計確認用）
        </div>
      </div>

      {/* SVG 図面エリア */}
      <div style={{
        border: `1px solid color-mix(in srgb, ${color} 20%, var(--border))`,
        borderRadius: 8,
        overflow: 'hidden',
        background: '#0f1117',
        position: 'relative',
        aspectRatio: '520 / 480',
      }}>
        <div
          style={{ width: '100%', height: '100%' }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
      </div>

      {/* スペック概要 */}
      <SchematicSpecs results={results} color={color} />
    </div>
  )
}

function SchematicSpecs({ results, color }: { results: TurbineResults; color: string }) {
  const d = results.dimensions
  const rows: [string, string][] = [
    ['ランナー径 D', `${(d.runnerDiameter * 1000).toFixed(1)} mm`],
    ['導水管径', `${(d.penstockDiameter * 1000).toFixed(1)} mm`],
  ]

  if (d.pelton) {
    rows.push(
      ['ジェット数', `${d.pelton.numJets} 本`],
      ['ジェット径 d', `${(d.pelton.jetDiameter * 1000).toFixed(1)} mm`],
      ['バケット数', `${d.pelton.numBuckets} 枚`],
      ['D/d 比', d.pelton.dOverD.toFixed(2)],
    )
  }
  if (d.francis) {
    rows.push(
      ['入口径 D01', `${(d.francis.inletDiameter * 1000).toFixed(1)} mm`],
      ['GV高さ Bd', `${(d.francis.guideVaneHeight * 1000).toFixed(1)} mm`],
      ['ブレード数', `${d.francis.numBlades} 枚`],
      ['ガイドベーン数', `${d.francis.numGuideVanes} 枚`],
    )
  }
  if (d.kaplan) {
    rows.push(
      ['ハブ径 Dh', `${(d.kaplan.hubDiameter * 1000).toFixed(1)} mm`],
      ['ハブ比', d.kaplan.hubRatio.toFixed(3)],
      ['ブレード数', `${d.kaplan.numBlades} 枚`],
      ['ガイドベーン数', `${d.kaplan.numGuideVanes} 枚`],
    )
  }
  if (d.crossflow) {
    rows.push(
      ['ランナー幅 B', `${(d.crossflow.runnerWidth * 1000).toFixed(1)} mm`],
      ['B/D 比', d.crossflow.aspectRatio.toFixed(2)],
      ['入射角', `${d.crossflow.attackAngle}°`],
      ['ブレード数', `${d.crossflow.numBlades} 枚`],
    )
  }
  if (d.tubular) {
    rows.push(
      ['ハブ径 Dh', `${(d.tubular.hubDiameter * 1000).toFixed(1)} mm`],
      ['ハブ比', d.tubular.hubRatio.toFixed(3)],
      ['コーン角（半角）', `${d.tubular.coneAngle}°`],
      ['ブレード数', `${d.tubular.numBlades} 枚`],
    )
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '2px 16px',
      padding: '10px 12px',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
    }}>
      {rows.map(([label, val]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
          <span style={{ color: 'var(--muted)' }}>{label}</span>
          <span style={{ color, fontFamily: 'monospace', fontWeight: 600 }}>{val}</span>
        </div>
      ))}
    </div>
  )
}
