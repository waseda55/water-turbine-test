// ============================================================
// チューブラ水車 — SVG 縦断面図生成ロジック（水平軸）
// ============================================================
import type { TurbineResults } from '@/types'

export function buildTubularSvg(results: TurbineResults): string {
  const t  = results.dimensions.tubular!
  const D  = results.dimensions.runnerDiameter    // ランナー径 [m]
  const Dh = t.hubDiameter                        // ハブ径 [m]
  const numBlades = t.numBlades
  const numGV     = t.numGuideVanes
  const coneAngle = t.coneAngle                   // コーン角 [deg]

  const W = 520, H = 420
  const cy = H / 2, cx = W / 2

  const scale = (H * 0.35) / ((D / 2) * 1000)

  const R  = (D / 2) * 1000 * scale
  const rh = (Dh / 2) * 1000 * scale

  // 水平軸チューブラ: 水は左→右に流れる
  const tubeLeft  = cx - R * 2.4
  const tubeRight = cx + R * 2.4

  // ドラフトチューブ広がり
  const coneRad = (coneAngle * Math.PI) / 180
  const dtLen   = R * 1.8
  const dtEndR  = R + dtLen * Math.tan(coneRad)

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`
  svg += `<rect width="${W}" height="${H}" fill="var(--bg,#0f1117)"/>`

  for (let x = 0; x < W; x += 40)
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`
  for (let y = 0; y < H; y += 40)
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`

  // 流路外壁（水平チューブ）
  svg += `<rect x="${tubeLeft}" y="${cy - R}" width="${cx - tubeLeft}" height="${R * 2}"
    fill="color-mix(in srgb,#f472b6 5%,transparent)" stroke="#f472b6" stroke-width="1.5" rx="2"/>`

  // ドラフトチューブ（右側、広がり）
  svg += `<path d="M${cx} ${cy - R} L${cx + dtLen} ${cy - dtEndR} L${cx + dtLen} ${cy + dtEndR} L${cx} ${cy + R} Z"
    fill="color-mix(in srgb,#38bdf8 6%,transparent)" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="5 3"/>`
  svg += `<text x="${cx + dtLen / 2}" y="${cy + dtEndR - 6}" text-anchor="middle" font-family="monospace" font-size="8" fill="#38bdf8" opacity="0.7">ドラフトチューブ</text>`

  // 水流矢印（左→右）
  for (let fi = 0; fi < 4; fi++) {
    const fy = cy - R * 0.55 + fi * R * 0.36
    svg += `<line x1="${tubeLeft + 20}" y1="${fy}" x2="${tubeLeft + 60}" y2="${fy}" stroke="#38bdf8" stroke-width="1.2" opacity="0.5" marker-end="url(#harr)"/>`
  }

  // ガイドベーン（縦方向の翼断面、ランナー上流）
  const gvX = cx - R * 0.9
  for (let i = 0; i < Math.min(numGV, 8); i++) {
    const frac  = (i + 0.5) / Math.min(numGV, 8)
    const gvY   = cy - R + frac * 2 * R
    const dist  = Math.abs(gvY - cy)
    if (dist < rh * 1.2) continue
    const lean  = 6
    svg += `<path d="M${gvX - 8},${gvY - lean / 2} Q${gvX},${gvY} ${gvX + 8},${gvY + lean / 2}"
      fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round"/>`
  }

  // ランナーブレード（軸流翼断面、垂直に描画）
  for (let i = 0; i < numBlades; i++) {
    const frac  = (i + 0.5) / numBlades
    const bY    = cy - R + frac * 2 * R
    const distFromCenter = Math.abs(bY - cy)
    if (distFromCenter < rh * 1.1) continue
    const sign  = bY < cy ? 1 : -1
    const twist = sign * 10

    svg += `<ellipse cx="${cx}" cy="${bY.toFixed(1)}" rx="14" ry="5"
      transform="rotate(${twist},${cx},${bY.toFixed(1)})"
      fill="color-mix(in srgb,#f472b6 25%,transparent)" stroke="#f472b6" stroke-width="1.8"/>`
  }

  // ハブ（水平軸の円筒断面）
  svg += `<rect x="${cx - R * 0.8}" y="${cy - rh}" width="${R * 1.6}" height="${rh * 2}"
    fill="color-mix(in srgb,#f472b6 15%,transparent)" stroke="#f472b6" stroke-width="1.5" rx="4"/>`

  // シャフト（右に伸びる）
  svg += `<line x1="${cx + R * 0.8}" y1="${cy}" x2="${cx + dtLen + 30}" y2="${cy}" stroke="#7c3aed" stroke-width="3" stroke-linecap="round"/>`
  svg += `<text x="${cx + dtLen + 34}" y="${cy + 4}" font-family="monospace" font-size="8" fill="#7c3aed">SHAFT</text>`

  // 中心線（水平）
  svg += `<line x1="${tubeLeft - 10}" y1="${cy}" x2="${cx + dtLen + 10}" y2="${cy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`

  // 矢印定義
  svg += `<defs><marker id="harr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
    <path d="M0,0 L6,3 L0,6 Z" fill="#38bdf8"/>
  </marker></defs>`

  // 寸法注記
  const annColor = '#94a3b8'
  const fz = 9
  // D
  svg += `<line x1="${tubeLeft - 8}" y1="${cy}" x2="${tubeLeft - 8}" y2="${cy + R}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${tubeLeft - 10}" y="${cy + R / 2 + 3}" text-anchor="end" font-family="monospace" font-size="${fz}" fill="${annColor}">D/2</text>`
  svg += `<text x="${tubeLeft - 10}" y="${cy + R + 12}" text-anchor="end" font-family="monospace" font-size="${fz}" fill="${annColor}">${(D * 1000 / 2).toFixed(0)}mm</text>`
  // Dh
  svg += `<line x1="${cx - R * 0.78}" y1="${cy - rh - 8}" x2="${cx - R * 0.78}" y2="${cy - 2}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${cx - R * 0.78 - 2}" y="${cy - rh - 10}" text-anchor="middle" font-family="monospace" font-size="${fz}" fill="${annColor}">Dh=${(Dh * 1000).toFixed(0)}mm</text>`
  // コーン角
  svg += `<text x="${cx + dtLen / 2 + 8}" y="${cy - 10}" font-family="monospace" font-size="${fz}" fill="#94a3b8">θ=${coneAngle}°</text>`

  // タイトル
  svg += `<text x="12" y="18" font-family="monospace" font-size="10" fill="#f472b6" font-weight="bold">チューブラ水車　縦断面概略図（水平軸）</text>`
  svg += `<text x="12" y="30" font-family="monospace" font-size="8" fill="#475569">ブレード数:${numBlades}枚　GV数:${numGV}枚　ハブ比:${t.hubRatio.toFixed(3)}</text>`

  svg += `</svg>`
  return svg
}
