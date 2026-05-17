// ============================================================
// フランシス水車 — SVG 断面図生成ロジック
// ============================================================
import type { TurbineResults } from '@/types'

export function buildFrancisSvg(results: TurbineResults): string {
  const f = results.dimensions.francis!
  const D2e = results.dimensions.runnerDiameter          // アウトレット径
  const D01  = f.inletDiameter                           // 入口径
  const Bd   = f.guideVaneHeight                         // ガイドベーン高さ
  const Dsc  = f.spiralCaseInlet                         // スパイラルケーシング径
  const numBlades = f.numBlades
  const numGV     = f.numGuideVanes

  const W = 520, H = 480
  const cx = W / 2, cy = H / 2 - 20

  // スケール: キャンバスに収まるよう最大半径を計算
  const maxR  = Math.max(D01 / 2, Dsc / 2 + D01 / 2) * 1000  // mm
  const scale = Math.min((W * 0.38) / maxR, (H * 0.38) / maxR)

  const r2e = (D2e / 2) * 1000 * scale    // アウトレット半径
  const r01 = (D01 / 2) * 1000 * scale    // 入口半径
  const bd  = Bd        * 1000 * scale    // ガイドベーン高さ
  const rsc = (Dsc / 2) * 1000 * scale    // スパイラルケーシング半径

  // 吸出し管 (draft tube)
  const dtTop    = cy + r2e * 0.3
  const dtTopW   = r2e * 0.85
  const dtBot    = cy + r2e * 0.3 + r2e * 1.4
  const dtBotW   = r2e * 1.25
  const dtH      = dtBot - dtTop

  // ケーシング中心
  const caseR = r01 + rsc + rsc * 0.15
  // スパイラルケーシング中心 (右上)
  const scCx  = cx + r01 * 0.55
  const scCy  = cy - r01 * 0.05

  // ガイドベーン位置
  const gvR = (r2e + r01) / 2

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`

  // 背景
  svg += `<rect width="${W}" height="${H}" fill="var(--bg,#0f1117)"/>`

  // グリッド（薄い）
  for (let x = 0; x < W; x += 40)
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`
  for (let y = 0; y < H; y += 40)
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`

  // 吸出し管
  svg += `<path d="M${cx - dtTopW} ${dtTop} L${cx - dtBotW} ${dtBot} L${cx + dtBotW} ${dtBot} L${cx + dtTopW} ${dtTop} Z"
    fill="color-mix(in srgb,#38bdf8 10%,transparent)" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="5 3"/>`
  svg += `<text x="${cx}" y="${dtBot - 6}" text-anchor="middle" font-family="monospace" font-size="8" fill="#38bdf8" opacity="0.7">吸出し管</text>`

  // スパイラルケーシング（断面円）
  svg += `<circle cx="${scCx}" cy="${scCy}" r="${rsc}" fill="none" stroke="#0ea5e9" stroke-width="10" opacity="0.25"/>`
  svg += `<circle cx="${scCx}" cy="${scCy}" r="${rsc}" fill="none" stroke="#0ea5e9" stroke-width="1.5"/>`

  // ガイドベーンリング
  svg += `<circle cx="${cx}" cy="${cy}" r="${gvR + bd / 2}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>`
  svg += `<circle cx="${cx}" cy="${cy}" r="${gvR - bd / 2}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>`

  // ガイドベーン（放射状の線分）
  for (let i = 0; i < numGV; i++) {
    const angle = (i / numGV) * 2 * Math.PI
    const lean  = 0.18 // 傾き角
    const x1 = cx + (gvR + bd / 2) * Math.cos(angle)
    const y1 = cy + (gvR + bd / 2) * Math.sin(angle)
    const x2 = cx + (gvR - bd / 2) * Math.cos(angle + lean)
    const y2 = cy + (gvR - bd / 2) * Math.sin(angle + lean)
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>`
  }

  // ランナーブレード
  for (let i = 0; i < numBlades; i++) {
    const angle = (i / numBlades) * 2 * Math.PI
    const sweep = 0.45
    const rOuter = r2e * 0.95
    const rInner = r2e * 0.35
    const x1 = cx + rOuter * Math.cos(angle)
    const y1 = cy + rOuter * Math.sin(angle)
    const x2 = cx + rInner * Math.cos(angle + sweep)
    const y2 = cy + rInner * Math.sin(angle + sweep)
    svg += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>`
  }

  // ランナー外周リング
  svg += `<circle cx="${cx}" cy="${cy}" r="${r2e}" fill="none" stroke="#34d399" stroke-width="2"/>`
  // 入口リング
  svg += `<circle cx="${cx}" cy="${cy}" r="${r01}" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.6"/>`
  // ハブ
  const hubR = r2e * 0.15
  svg += `<circle cx="${cx}" cy="${cy}" r="${hubR}" fill="color-mix(in srgb,#34d399 20%,transparent)" stroke="#34d399" stroke-width="1.5"/>`

  // 中心線
  svg += `<line x1="${cx - r01 - 20}" y1="${cy}" x2="${cx + r01 + 20}" y2="${cy}" stroke="#475569" stroke-width="0.8" stroke-dasharray="8 4"/>`
  svg += `<line x1="${cx}" y1="${cy - r01 - 20}" x2="${cx}" y2="${dtTop}" stroke="#475569" stroke-width="0.8" stroke-dasharray="8 4"/>`

  // 寸法注記
  const annColor = '#94a3b8'
  const fontSize = 9

  // D2e
  const d2eY = cy - r2e - 8
  svg += `<line x1="${cx}" y1="${d2eY + 4}" x2="${cx + r2e}" y2="${d2eY + 4}" stroke="${annColor}" stroke-width="0.8" marker-end="url(#arr)"/>`
  svg += `<text x="${cx + r2e / 2}" y="${d2eY}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="${annColor}">D2e=${(D2e * 1000).toFixed(0)}mm</text>`

  // D01
  const d01Y = cy + r01 + 22
  svg += `<line x1="${cx}" y1="${d01Y - 4}" x2="${cx + r01}" y2="${d01Y - 4}" stroke="${annColor}" stroke-width="0.8" marker-end="url(#arr)"/>`
  svg += `<text x="${cx + r01 / 2}" y="${d01Y + 1}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="${annColor}">D01=${(D01 * 1000).toFixed(0)}mm</text>`

  // Bd
  const bdX = cx + gvR + 10
  svg += `<line x1="${bdX}" y1="${cy - bd / 2}" x2="${bdX}" y2="${cy + bd / 2}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${bdX + 4}" y="${cy + 3}" font-family="monospace" font-size="${fontSize}" fill="${annColor}">Bd=${(Bd * 1000).toFixed(0)}mm</text>`

  // Dsc
  svg += `<text x="${scCx}" y="${scCy + rsc + 14}" text-anchor="middle" font-family="monospace" font-size="${fontSize}" fill="#0ea5e9">Dsc=${(Dsc * 1000).toFixed(0)}mm</text>`

  // 矢印マーカー定義
  svg += `<defs><marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
    <path d="M0,0 L6,3 L0,6 Z" fill="${annColor}"/>
  </marker></defs>`

  // タイトル
  svg += `<text x="12" y="18" font-family="monospace" font-size="10" fill="#38bdf8" font-weight="bold">フランシス水車　概略断面図</text>`
  svg += `<text x="12" y="30" font-family="monospace" font-size="8" fill="#475569">ブレード数:${numBlades}枚　GV数:${numGV}枚</text>`

  svg += `</svg>`
  return svg
}
