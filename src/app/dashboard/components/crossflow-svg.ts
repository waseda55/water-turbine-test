// ============================================================
// クロスフロー水車 — SVG 断面図生成ロジック
// ============================================================
import type { TurbineResults } from '@/types'

export function buildCrossflowSvg(results: TurbineResults): string {
  const cf = results.dimensions.crossflow!
  const D  = results.dimensions.runnerDiameter   // ランナー径 [m]
  const B  = cf.runnerWidth                      // ランナー幅 [m]
  const numBlades  = cf.numBlades
  const attackAngle = cf.attackAngle             // 入射角 [deg]

  const W = 520, H = 480
  const cx = W / 2, cy = H / 2 + 10

  const scale = (Math.min(W, H) * 0.3) / ((D / 2) * 1000)

  const R  = (D / 2) * 1000 * scale
  const bW = B       * 1000 * scale   // 幅方向（画面奥行）は断面では高さで表現

  // ノズル入射角
  const attackRad = (attackAngle * Math.PI) / 180

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`
  svg += `<rect width="${W}" height="${H}" fill="var(--bg,#0f1117)"/>`

  for (let x = 0; x < W; x += 40)
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`
  for (let y = 0; y < H; y += 40)
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`

  // ランナー外周
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#fb923c" stroke-width="2.2"/>`

  // ブレード（円弧形状）
  const rInner = R * 0.62
  for (let i = 0; i < numBlades; i++) {
    const angle = (i / numBlades) * 2 * Math.PI
    const ax1 = cx + R      * Math.cos(angle)
    const ay1 = cy + R      * Math.sin(angle)
    const ax2 = cx + rInner * Math.cos(angle + 0.35)
    const ay2 = cy + rInner * Math.sin(angle + 0.35)
    svg += `<path d="M${ax1.toFixed(1)},${ay1.toFixed(1)} Q${(cx + R * 0.82 * Math.cos(angle + 0.17)).toFixed(1)},${(cy + R * 0.82 * Math.sin(angle + 0.17)).toFixed(1)} ${ax2.toFixed(1)},${ay2.toFixed(1)}"
      fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" opacity="0.85"/>`
  }

  // シャフト（中心）
  svg += `<circle cx="${cx}" cy="${cy}" r="${R * 0.08}" fill="color-mix(in srgb,#fb923c 25%,transparent)" stroke="#fb923c" stroke-width="1.5"/>`

  // ノズル（入射方向）
  const nozzleLen = R * 0.55
  const nozzleW   = R * 0.28
  // ノズルは右上から左下へ水が流れる角度
  const nozAngle = Math.PI + attackRad  // 右上から流入
  const noxX1 = cx + (R + nozzleLen) * Math.cos(nozAngle)
  const noxY1 = cy + (R + nozzleLen) * Math.sin(nozAngle)
  const noxX2 = cx + (R + 4)         * Math.cos(nozAngle)
  const noxY2 = cy + (R + 4)         * Math.sin(nozAngle)
  const perpAngle = nozAngle + Math.PI / 2
  const hw = nozzleW / 2

  svg += `<path d="
    M${(noxX1 + hw * Math.cos(perpAngle)).toFixed(1)},${(noxY1 + hw * Math.sin(perpAngle)).toFixed(1)}
    L${(noxX2 + hw * 0.5 * Math.cos(perpAngle)).toFixed(1)},${(noxY2 + hw * 0.5 * Math.sin(perpAngle)).toFixed(1)}
    L${(noxX2 - hw * 0.5 * Math.cos(perpAngle)).toFixed(1)},${(noxY2 - hw * 0.5 * Math.sin(perpAngle)).toFixed(1)}
    L${(noxX1 - hw * Math.cos(perpAngle)).toFixed(1)},${(noxY1 - hw * Math.sin(perpAngle)).toFixed(1)}
    Z"
    fill="color-mix(in srgb,#38bdf8 15%,transparent)" stroke="#38bdf8" stroke-width="1.5"/>`

  // 水流矢印
  for (let fi = 0; fi < 3; fi++) {
    const frac = (fi + 1) / 4
    const fx1 = noxX1 + (hw * 0.5 * (frac * 2 - 1)) * Math.cos(perpAngle)
    const fy1 = noxY1 + (hw * 0.5 * (frac * 2 - 1)) * Math.sin(perpAngle)
    const fx2 = noxX2 + (hw * 0.3 * (frac * 2 - 1)) * Math.cos(perpAngle)
    const fy2 = noxY2 + (hw * 0.3 * (frac * 2 - 1)) * Math.sin(perpAngle)
    svg += `<line x1="${fx1.toFixed(1)}" y1="${fy1.toFixed(1)}" x2="${fx2.toFixed(1)}" y2="${fy2.toFixed(1)}" stroke="#38bdf8" stroke-width="1" opacity="0.6" marker-end="url(#farr)"/>`
  }

  // ケーシング（簡略）
  const casingR = R + R * 0.12
  svg += `<path d="M${cx - casingR} ${cy - casingR} L${cx - casingR} ${cy + casingR} L${cx + casingR} ${cy + casingR} L${cx + casingR} ${cy - casingR} Z"
    fill="none" stroke="#475569" stroke-width="1.2" stroke-dasharray="6 4"/>`

  // 中心線
  svg += `<line x1="${cx - casingR - 15}" y1="${cy}" x2="${cx + casingR + 15}" y2="${cy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`
  svg += `<line x1="${cx}" y1="${cy - casingR - 15}" x2="${cx}" y2="${cy + casingR + 15}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`

  // 寸法
  const annColor = '#94a3b8'
  const fz = 9
  svg += `<line x1="${cx}" y1="${cy + 4}" x2="${cx + R}" y2="${cy + 4}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${cx + R / 2}" y="${cy + 16}" text-anchor="middle" font-family="monospace" font-size="${fz}" fill="${annColor}">D=${(D * 1000).toFixed(0)}mm</text>`

  // 入射角
  svg += `<text x="${(noxX1 + 12).toFixed(0)}" y="${(noxY1 - 8).toFixed(0)}" font-family="monospace" font-size="${fz}" fill="#38bdf8">α=${attackAngle}°</text>`

  // 矢印
  svg += `<defs><marker id="farr" markerWidth="5" markerHeight="5" refX="2.5" refY="2.5" orient="auto">
    <path d="M0,0 L5,2.5 L0,5 Z" fill="#38bdf8"/>
  </marker></defs>`

  // タイトル
  svg += `<text x="12" y="18" font-family="monospace" font-size="10" fill="#fb923c" font-weight="bold">クロスフロー水車　断面概略図</text>`
  svg += `<text x="12" y="30" font-family="monospace" font-size="8" fill="#475569">ブレード数:${numBlades}枚　B/D比:${cf.aspectRatio.toFixed(2)}</text>`

  svg += `</svg>`
  return svg
}
