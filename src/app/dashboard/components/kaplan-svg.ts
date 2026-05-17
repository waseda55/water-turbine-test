// ============================================================
// カプラン水車 — SVG 縦断面図生成ロジック
// ============================================================
import type { TurbineResults } from '@/types'

export function buildKaplanSvg(results: TurbineResults): string {
  const k = results.dimensions.kaplan!
  const D  = results.dimensions.runnerDiameter    // ランナー径 [m]
  const Dh = k.hubDiameter                        // ハブ径 [m]
  const numBlades = k.numBlades
  const numGV     = k.numGuideVanes

  const W = 520, H = 480
  const cx = W / 2, cy = H / 2 - 10

  const scale = (H * 0.32) / ((D / 2) * 1000)

  const R  = (D / 2)  * 1000 * scale
  const rh = (Dh / 2) * 1000 * scale

  // 上下流方向 (鉛直下向き = 正)
  const caseTop    = cy - R * 1.8
  const caseBot    = cy + R * 0.8
  const caseWidth  = R * 0.55

  const dtTop  = cy + R * 0.6
  const dtBot  = cy + R * 2.2
  const dtTopW = R * 0.9
  const dtBotW = R * 1.3

  // スクロールケーシング幅
  const scW = R * 0.7

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`
  svg += `<rect width="${W}" height="${H}" fill="var(--bg,#0f1117)"/>`

  for (let x = 0; x < W; x += 40)
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`
  for (let y = 0; y < H; y += 40)
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`

  // スクロールケーシング（上部）
  svg += `<path d="
    M${cx - caseWidth} ${caseTop}
    L${cx - caseWidth} ${cy}
    L${cx - R} ${cy}
    M${cx + caseWidth} ${caseTop}
    L${cx + caseWidth} ${cy}
    L${cx + R} ${cy}
  " fill="none" stroke="#34d399" stroke-width="1.5"/>`

  // 外壁
  svg += `<rect x="${cx - R - scW}" y="${caseTop - 20}" width="${scW}" height="${caseBot - caseTop + 20}" fill="color-mix(in srgb,#34d399 8%,transparent)" stroke="#34d399" stroke-width="1.2" opacity="0.7"/>`
  svg += `<rect x="${cx + R}" y="${caseTop - 20}" width="${scW}" height="${caseBot - caseTop + 20}" fill="color-mix(in srgb,#34d399 8%,transparent)" stroke="#34d399" stroke-width="1.2" opacity="0.7"/>`

  // ガイドベーン（横断面で放射状に描画）
  const gvR = (R + caseWidth) / 2 + R * 0.1
  const gvY = cy - R * 0.4
  for (let i = 0; i < numGV; i++) {
    const angle = (i / numGV) * 2 * Math.PI
    // 左右対称の縦断面表現
    const gvX   = cx + gvR * Math.cos(angle)
    const leanY = gvY + 14 * Math.sin(angle)
    if (Math.abs(Math.cos(angle)) > 0.1) {
      svg += `<line x1="${gvX.toFixed(1)}" y1="${(gvY - 8).toFixed(1)}"
        x2="${(gvX + 6 * Math.sin(angle)).toFixed(1)}" y2="${(leanY + 8).toFixed(1)}"
        stroke="#64748b" stroke-width="2" stroke-linecap="round" opacity="0.8"/>`
    }
  }

  // ランナーブレード（軸流翼断面）
  const bladeY = cy + R * 0.1
  for (let i = 0; i < numBlades; i++) {
    const frac = (i + 0.5) / numBlades
    const sign = frac < 0.5 ? 1 : -1
    const bladeX = cx + sign * (rh + (R - rh) * Math.abs(2 * frac - 1) * 0.9)
    const bladeW = (R - rh) * 0.32
    const bladeH = 18

    // 翼型（楕円 + ねじり）
    const twist = sign * 8
    svg += `<ellipse cx="${bladeX.toFixed(1)}" cy="${bladeY.toFixed(1)}" rx="${bladeW / 2}" ry="${bladeH / 2}"
      transform="rotate(${twist},${bladeX.toFixed(1)},${bladeY.toFixed(1)})"
      fill="color-mix(in srgb,#34d399 25%,transparent)" stroke="#34d399" stroke-width="1.8"/>`
  }

  // ランナーケーシング（円筒）
  svg += `<line x1="${cx - R}" y1="${cy - R * 0.25}" x2="${cx - R}" y2="${cy + R * 0.35}" stroke="#34d399" stroke-width="2"/>`
  svg += `<line x1="${cx + R}" y1="${cy - R * 0.25}" x2="${cx + R}" y2="${cy + R * 0.35}" stroke="#34d399" stroke-width="2"/>`

  // ハブ（縦断面の楕円）
  svg += `<ellipse cx="${cx}" cy="${bladeY}" rx="${rh}" ry="${rh * 1.5}" fill="color-mix(in srgb,#34d399 15%,transparent)" stroke="#34d399" stroke-width="1.5"/>`

  // 吸出し管
  svg += `<path d="M${cx - dtTopW} ${dtTop} L${cx - dtBotW} ${dtBot} L${cx + dtBotW} ${dtBot} L${cx + dtTopW} ${dtTop} Z"
    fill="color-mix(in srgb,#38bdf8 8%,transparent)" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="5 3"/>`
  svg += `<text x="${cx}" y="${dtBot - 6}" text-anchor="middle" font-family="monospace" font-size="8" fill="#38bdf8" opacity="0.7">吸出し管</text>`

  // 中心線
  svg += `<line x1="${cx}" y1="${caseTop - 25}" x2="${cx}" y2="${dtBot + 10}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`

  // 寸法注記
  const annColor = '#94a3b8'
  const fz = 9
  // D
  svg += `<line x1="${cx}" y1="${bladeY + 5}" x2="${cx + R}" y2="${bladeY + 5}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${cx + R / 2}" y="${bladeY + 17}" text-anchor="middle" font-family="monospace" font-size="${fz}" fill="${annColor}">D=${(D * 1000).toFixed(0)}mm</text>`
  // Dh
  svg += `<line x1="${cx}" y1="${bladeY - rh * 1.5 - 6}" x2="${cx + rh}" y2="${bladeY - rh * 1.5 - 6}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${cx + rh / 2}" y="${bladeY - rh * 1.5 - 9}" text-anchor="middle" font-family="monospace" font-size="${fz}" fill="${annColor}">Dh=${(Dh * 1000).toFixed(0)}mm</text>`
  // ハブ比
  svg += `<text x="${cx - R - scW - 4}" y="${bladeY + 4}" text-anchor="end" font-family="monospace" font-size="${fz}" fill="${annColor}">ハブ比${k.hubRatio.toFixed(3)}</text>`

  // タイトル
  svg += `<text x="12" y="18" font-family="monospace" font-size="10" fill="#34d399" font-weight="bold">カプラン水車　縦断面概略図</text>`
  svg += `<text x="12" y="30" font-family="monospace" font-size="8" fill="#475569">ブレード数:${numBlades}枚　GV数:${numGV}枚</text>`

  svg += `</svg>`
  return svg
}
