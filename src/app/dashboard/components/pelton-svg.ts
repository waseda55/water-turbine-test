// ============================================================
// ペルトン水車 — SVG 断面図生成ロジック（正面図）
// ============================================================
import type { TurbineResults } from '@/types'

export function buildPeltonSvg(results: TurbineResults): string {
  const p = results.dimensions.pelton!
  const D  = results.dimensions.runnerDiameter   // ランナーピッチ径 [m]
  const d  = p.jetDiameter                       // ジェット径 [m]
  const B2 = p.bucketWidth                       // バケット内幅 [m]
  const numJets    = p.numJets
  const numBuckets = p.numBuckets

  const W = 520, H = 480
  const cx = W / 2, cy = H / 2

  const maxR  = (D / 2) * 1000 * 1.35
  const scale = (W * 0.35) / maxR

  const R    = (D / 2)  * 1000 * scale   // ランナー半径 px
  const djet = d        * 1000 * scale   // ジェット径 px
  const bw   = B2       * 1000 * scale   // バケット幅 px
  const bh   = bw * 0.75                 // バケット高さ

  let svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">`
  svg += `<rect width="${W}" height="${H}" fill="var(--bg,#0f1117)"/>`

  // グリッド
  for (let x = 0; x < W; x += 40)
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`
  for (let y = 0; y < H; y += 40)
    svg += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border,#1e2433)" stroke-width="0.5"/>`

  // 中心線
  svg += `<line x1="${cx - R - 30}" y1="${cy}" x2="${cx + R + 30}" y2="${cy}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`
  svg += `<line x1="${cx}" y1="${cy - R - 30}" x2="${cx}" y2="${cy + R + 30}" stroke="#334155" stroke-width="0.8" stroke-dasharray="8 4"/>`

  // バケット（放射状）
  for (let i = 0; i < numBuckets; i++) {
    const angle = (i / numBuckets) * 2 * Math.PI
    const bCx = cx + R * Math.cos(angle)
    const bCy = cy + R * Math.sin(angle)
    const deg = (angle * 180) / Math.PI

    // バケット形状（楕円っぽい矩形）
    svg += `<g transform="translate(${bCx.toFixed(1)},${bCy.toFixed(1)}) rotate(${deg.toFixed(1)})">`
    svg += `<ellipse rx="${bh / 2}" ry="${bw / 2}" fill="color-mix(in srgb,#a78bfa 18%,transparent)" stroke="#a78bfa" stroke-width="1.2"/>`
    // バケット中央分割線
    svg += `<line x1="${-bh / 2}" y1="0" x2="${bh / 2}" y2="0" stroke="#7c3aed" stroke-width="0.7"/>`
    svg += `</g>`
  }

  // ランナーリム
  svg += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#a78bfa" stroke-width="2.5"/>`
  // ハブ
  svg += `<circle cx="${cx}" cy="${cy}" r="${R * 0.12}" fill="color-mix(in srgb,#a78bfa 25%,transparent)" stroke="#a78bfa" stroke-width="1.5"/>`
  // スポーク
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    svg += `<line x1="${(cx + R * 0.12 * Math.cos(a)).toFixed(1)}" y1="${(cy + R * 0.12 * Math.sin(a)).toFixed(1)}"
      x2="${(cx + R * 0.78 * Math.cos(a)).toFixed(1)}" y2="${(cy + R * 0.78 * Math.sin(a)).toFixed(1)}"
      stroke="#6d28d9" stroke-width="1.5" opacity="0.7"/>`
  }

  // ジェット管（numJets本）
  const jetAngles: number[] = []
  for (let j = 0; j < numJets; j++) jetAngles.push((j / numJets) * 2 * Math.PI - Math.PI / 2)

  for (const ja of jetAngles) {
    // ジェット方向（接線方向）
    const tangentAngle = ja + Math.PI / 2
    const jetLen = R * 0.55
    const nozzleX = cx + (R + jetLen) * Math.cos(ja)
    const nozzleY = cy + (R + jetLen) * Math.sin(ja)
    const tipX    = cx + (R + djet * 0.5) * Math.cos(ja)
    const tipY    = cy + (R + djet * 0.5) * Math.sin(ja)

    // ノズル本体
    const nx1 = nozzleX + djet * Math.cos(tangentAngle)
    const ny1 = nozzleY + djet * Math.sin(tangentAngle)
    const nx2 = nozzleX - djet * Math.cos(tangentAngle)
    const ny2 = nozzleY - djet * Math.sin(tangentAngle)
    const tx1 = tipX + (djet / 2) * Math.cos(tangentAngle)
    const ty1 = tipY + (djet / 2) * Math.sin(tangentAngle)
    const tx2 = tipX - (djet / 2) * Math.cos(tangentAngle)
    const ty2 = tipY - (djet / 2) * Math.sin(tangentAngle)

    svg += `<path d="M${nx1.toFixed(1)},${ny1.toFixed(1)} L${tx1.toFixed(1)},${ty1.toFixed(1)} L${tx2.toFixed(1)},${ty2.toFixed(1)} L${nx2.toFixed(1)},${ny2.toFixed(1)} Z"
      fill="color-mix(in srgb,#38bdf8 20%,transparent)" stroke="#38bdf8" stroke-width="1.5"/>`
    // 水流
    svg += `<line x1="${tipX.toFixed(1)}" y1="${tipY.toFixed(1)}" x2="${(cx + R * Math.cos(ja)).toFixed(1)}" y2="${(cy + R * Math.sin(ja)).toFixed(1)}"
      stroke="#38bdf8" stroke-width="${djet}" opacity="0.5" stroke-linecap="round"/>`
  }

  // 寸法注記
  const annColor = '#94a3b8'
  const fz = 9
  // D
  svg += `<line x1="${cx}" y1="${cy + 4}" x2="${cx + R}" y2="${cy + 4}" stroke="${annColor}" stroke-width="0.8"/>`
  svg += `<text x="${cx + R / 2}" y="${cy + 16}" text-anchor="middle" font-family="monospace" font-size="${fz}" fill="${annColor}">D=${(D * 1000).toFixed(0)}mm</text>`
  // d (jet)
  const jaRef = jetAngles[0]
  const jRefX = cx + (R + R * 0.35) * Math.cos(jaRef)
  const jRefY = cy + (R + R * 0.35) * Math.sin(jaRef)
  svg += `<text x="${(jRefX + 14).toFixed(0)}" y="${(jRefY - 6).toFixed(0)}" font-family="monospace" font-size="${fz}" fill="#38bdf8">d=${(d * 1000).toFixed(1)}mm</text>`

  // タイトル
  svg += `<text x="12" y="18" font-family="monospace" font-size="10" fill="#a78bfa" font-weight="bold">ペルトン水車　正面概略図</text>`
  svg += `<text x="12" y="30" font-family="monospace" font-size="8" fill="#475569">ジェット数:${numJets}　バケット数:${numBuckets}枚</text>`

  svg += `</svg>`
  return svg
}
