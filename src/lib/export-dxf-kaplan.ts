/**
 * カプラン水車 DXF エクスポート（縦断面図）
 *
 * レイヤー構成:
 *   CENTER     中心線（一点鎖線）
 *   OUTLINE    外形線（実線）
 *   RUNNER     ランナーブレード翼断面（実線）
 *   HUB        ハブ（実線）
 *   CASING     流路外壁・スクロールケーシング（実線）
 *   DRAFTTUBE  吸出し管（破線）
 *   DIM        寸法線・引出線
 *   TEXT       寸法テキスト
 *   TITLE      表題欄
 *
 * 座標系: mm単位、ランナー中心が原点、下流方向が +Y
 */

import type { TurbineResults } from '@/types'

export async function exportKaplanDxf(
  results: TurbineResults,
  caseName: string = 'kaplan'
): Promise<void> {
  const dxfStr = buildKaplanDxf(results)
  const blob = new Blob([dxfStr], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${caseName}_カプラン水車縦断面図.dxf`
  a.click()
  URL.revokeObjectURL(url)
}

export function buildKaplanDxf(results: TurbineResults): string {
  const k  = results.dimensions.kaplan!
  const D  = results.dimensions.runnerDiameter * 1000   // mm
  const Dh = k.hubDiameter                    * 1000   // mm
  const numBlades = k.numBlades
  const numGV     = k.numGuideVanes

  const R  = D  / 2
  const rh = Dh / 2

  // 流路高さ（上流側のみ描画）
  const caseH  = R * 1.8    // 上流側流路高
  const caseW  = R * 0.55   // 流路半幅

  // スクロールケーシング（左右外壁）
  const scW    = R * 0.65

  // ガイドベーン帯（上流）
  const gvY    = -R * 0.42  // GV中心 Y（上流側）
  const gvH    = R * 0.22   // GV帯高さ

  // ランナー位置
  const bladeY = 0.0

  // 吸出し管
  const dtTopW = R * 0.88
  const dtBotW = R * 1.28
  const dtBotY = R * 2.0

  const lines: string[] = []

  // ─── ヘッダー ──────────────────────────────────────────────
  lines.push(
    '  0\nSECTION', '  2\nHEADER',
    '  9\n$ACADVER', '  1\nAC1015',
    '  9\n$INSUNITS', ' 70\n4',
    '  0\nENDSEC',
  )

  // ─── TABLES ────────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nTABLES')
  lines.push(
    '  0\nTABLE', '  2\nLTYPE', ' 70\n3',
    '  0\nLTYPE', '  2\nCONTINUOUS', ' 70\n0', '  3\nSolid line', ' 72\n65', ' 73\n0', ' 40\n0.0',
    '  0\nLTYPE', '  2\nDASHED',     ' 70\n0', '  3\nDashed',     ' 72\n65', ' 73\n2', ' 40\n12.0',
    ' 49\n8.0', ' 74\n0', ' 49\n-4.0', ' 74\n0',
    '  0\nLTYPE', '  2\nCENTER',     ' 70\n0', '  3\nCenter line', ' 72\n65', ' 73\n4', ' 40\n40.0',
    ' 49\n25.0', ' 74\n0', ' 49\n-5.0', ' 74\n0', ' 49\n5.0', ' 74\n0', ' 49\n-5.0', ' 74\n0',
    '  0\nENDTAB',
  )

  const layerDefs = [
    { name: 'CENTER',    color: 8,  ltype: 'CENTER'     },
    { name: 'OUTLINE',   color: 7,  ltype: 'CONTINUOUS' },
    { name: 'RUNNER',    color: 2,  ltype: 'CONTINUOUS' },
    { name: 'HUB',       color: 3,  ltype: 'CONTINUOUS' },
    { name: 'CASING',    color: 5,  ltype: 'CONTINUOUS' },
    { name: 'DRAFTTUBE', color: 4,  ltype: 'DASHED'     },
    { name: 'DIM',       color: 8,  ltype: 'CONTINUOUS' },
    { name: 'TEXT',      color: 7,  ltype: 'CONTINUOUS' },
    { name: 'TITLE',     color: 7,  ltype: 'CONTINUOUS' },
  ]
  lines.push('  0\nTABLE', '  2\nLAYER', ` 70\n${layerDefs.length}`)
  for (const l of layerDefs) {
    lines.push('  0\nLAYER', `  2\n${l.name}`, ' 70\n0', ' 62\n' + l.color, `  6\n${l.ltype}`)
  }
  lines.push('  0\nENDTAB', '  0\nENDSEC')

  // ─── ENTITIES ──────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nENTITIES')

  function ln(x1: number, y1: number, x2: number, y2: number, layer: string) {
    lines.push('  0\nLINE', `  8\n${layer}`,
      ` 10\n${x1.toFixed(3)}`, ` 20\n${y1.toFixed(3)}`, ' 30\n0.0',
      ` 11\n${x2.toFixed(3)}`, ` 21\n${y2.toFixed(3)}`, ' 31\n0.0')
  }
  function circ(cx: number, cy: number, r: number, layer: string) {
    lines.push('  0\nCIRCLE', `  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`, ` 20\n${cy.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${r.toFixed(3)}`)
  }
  function txt(x: number, y: number, h: number, str: string, layer: string) {
    lines.push('  0\nTEXT', `  8\n${layer}`,
      ` 10\n${x.toFixed(3)}`, ` 20\n${y.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${h.toFixed(3)}`, `  1\n${str}`, ' 72\n1')
  }

  // 中心線（鉛直）
  ln(0, -caseH - 20, 0, dtBotY + 20, 'CENTER')
  // 中心線（水平、ランナー位置）
  ln(-R - scW - 20, bladeY, R + scW + 20, bladeY, 'CENTER')

  // ── 流路外壁（上流側、左右）──────────────────────────────
  ln(-caseW, -caseH, -caseW,  bladeY - rh * 0.2, 'CASING')
  ln( caseW, -caseH,  caseW,  bladeY - rh * 0.2, 'CASING')
  ln(-caseW, -caseH,  caseW, -caseH,              'CASING')  // 上端

  // スクロールケーシング外壁（水平方向）
  ln(-R - scW, -caseH * 0.15, -R - scW, bladeY + R * 0.35, 'CASING')
  ln( R + scW, -caseH * 0.15,  R + scW, bladeY + R * 0.35, 'CASING')
  ln(-caseW, -caseH * 0.15, -R - scW, -caseH * 0.15, 'CASING')
  ln( caseW, -caseH * 0.15,  R + scW, -caseH * 0.15, 'CASING')

  // ランナー外周（左右接続線）
  ln(-R - scW, bladeY - R * 0.25, -R, bladeY - R * 0.25, 'OUTLINE')
  ln( R + scW, bladeY - R * 0.25,  R, bladeY - R * 0.25, 'OUTLINE')
  ln(-R - scW, bladeY + R * 0.35, -R, bladeY + R * 0.35, 'OUTLINE')
  ln( R + scW, bladeY + R * 0.35,  R, bladeY + R * 0.35, 'OUTLINE')
  // ランナー外周（縦線）
  ln(-R, bladeY - R * 0.25, -R, bladeY + R * 0.35, 'OUTLINE')
  ln( R, bladeY - R * 0.25,  R, bladeY + R * 0.35, 'OUTLINE')

  // ── ガイドベーン（水平断面の翼型、上流側）──────────────
  const gvSpacing = caseW * 1.6 / (numGV / 2 + 1)
  for (let i = 0; i < Math.min(Math.floor(numGV / 2), 6); i++) {
    const gx = -caseW * 0.7 + i * gvSpacing
    const lean = 6
    // 翼型近似（先端・後端の線）
    ln(gx - 5, gvY - gvH / 2,       gx + 5 + lean, gvY + gvH / 2, 'CASING')
    ln(gx - 5 + lean, gvY - gvH / 2, gx + 5,        gvY + gvH / 2, 'CASING')
  }
  // GV帯の水平線（上下）
  ln(-caseW, gvY - gvH / 2, caseW, gvY - gvH / 2, 'CASING')
  ln(-caseW, gvY + gvH / 2, caseW, gvY + gvH / 2, 'CASING')

  // ── ランナーブレード（軸流翼断面、左右対称）──────────
  const bladeHalf = Math.min(numBlades, 6)
  for (let i = 0; i < bladeHalf; i++) {
    const frac = (i + 0.5) / bladeHalf
    const bx   = rh + (R - rh) * frac   // 左側はマイナス符号
    const bW   = (R - rh) * 0.28
    const bH   = 20
    const twist = 12

    // 右側ブレード
    ln( bx - bW / 2, bladeY - bH / 2 + twist / 2,
        bx + bW / 2, bladeY + bH / 2 - twist / 2, 'RUNNER')
    // 左側ブレード（対称）
    ln(-bx - bW / 2, bladeY - bH / 2 + twist / 2,
       -bx + bW / 2, bladeY + bH / 2 - twist / 2, 'RUNNER')
  }
  // ブレード帯の上下ライン
  ln(-R, bladeY - 12, R, bladeY - 12, 'RUNNER')
  ln(-R, bladeY + 12, R, bladeY + 12, 'RUNNER')

  // ── ハブ（縦断面楕円 → 矩形近似）────────────────────
  ln(-rh, bladeY - rh * 1.5, rh, bladeY - rh * 1.5, 'HUB')
  ln(-rh, bladeY + rh * 1.5, rh, bladeY + rh * 1.5, 'HUB')
  ln(-rh, bladeY - rh * 1.5, -rh, bladeY + rh * 1.5, 'HUB')
  ln( rh, bladeY - rh * 1.5,  rh, bladeY + rh * 1.5, 'HUB')

  // ── 吸出し管（台形）─────────────────────────────────
  ln(-dtTopW, bladeY + R * 0.55,  dtTopW, bladeY + R * 0.55, 'DRAFTTUBE')
  ln(-dtTopW, bladeY + R * 0.55, -dtBotW, dtBotY,            'DRAFTTUBE')
  ln( dtTopW, bladeY + R * 0.55,  dtBotW, dtBotY,            'DRAFTTUBE')
  ln(-dtBotW, dtBotY,             dtBotW, dtBotY,            'DRAFTTUBE')

  // ── 寸法線 ───────────────────────────────────────────
  const dimGap = R * 0.15
  const sz = R * 0.022

  // D（ランナー径）
  const dY = bladeY + R * 0.35 + dimGap
  ln(-R, dY, R, dY, 'DIM')
  ln(-R, bladeY + R * 0.35, -R, dY + sz, 'DIM')
  ln( R, bladeY + R * 0.35,  R, dY + sz, 'DIM')
  ln(-R, dY, -R + sz * 2, dY + sz, 'DIM'); ln(-R, dY, -R + sz * 2, dY - sz, 'DIM')
  ln( R, dY,  R - sz * 2, dY + sz, 'DIM'); ln( R, dY,  R - sz * 2, dY - sz, 'DIM')
  txt(0, dY + sz * 2, R * 0.04, `D = ${D.toFixed(1)} mm`, 'TEXT')

  // Dh（ハブ径）
  const dhY = bladeY - rh * 1.5 - dimGap * 0.8
  ln(-rh, dhY, rh, dhY, 'DIM')
  ln(-rh, bladeY - rh * 1.5, -rh, dhY - sz, 'DIM')
  ln( rh, bladeY - rh * 1.5,  rh, dhY - sz, 'DIM')
  ln(-rh, dhY, -rh + sz * 2, dhY + sz, 'DIM'); ln(-rh, dhY, -rh + sz * 2, dhY - sz, 'DIM')
  ln( rh, dhY,  rh - sz * 2, dhY + sz, 'DIM'); ln( rh, dhY,  rh - sz * 2, dhY - sz, 'DIM')
  txt(0, dhY - sz * 3.5, R * 0.04, `Dh = ${Dh.toFixed(1)} mm`, 'TEXT')

  // ハブ比
  txt(R + scW + 10, bladeY, R * 0.04, `ハブ比 ${k.hubRatio.toFixed(3)}`, 'TEXT')

  // ── 表題欄 ───────────────────────────────────────────
  const tw = R * 3.2, th = R * 0.45
  const tx = R * 1.6, tyBase = -(caseH + dimGap + th + R * 0.15)
  ln(tx - tw / 2, tyBase,      tx + tw / 2, tyBase,      'TITLE')
  ln(tx - tw / 2, tyBase + th, tx + tw / 2, tyBase + th, 'TITLE')
  ln(tx - tw / 2, tyBase,      tx - tw / 2, tyBase + th, 'TITLE')
  ln(tx + tw / 2, tyBase,      tx + tw / 2, tyBase + th, 'TITLE')
  ln(tx - tw / 2, tyBase + th * 0.5, tx + tw / 2, tyBase + th * 0.5, 'TITLE')
  txt(tx, tyBase + th * 0.75, R * 0.05, 'カプラン水車　縦断面概略図', 'TITLE')
  txt(tx - tw * 0.2, tyBase + th * 0.25, R * 0.038,
    `D=${D.toFixed(1)}  Dh=${Dh.toFixed(1)}  [mm]`, 'TITLE')
  txt(tx + tw * 0.22, tyBase + th * 0.25, R * 0.038,
    `ブレード:${numBlades}枚  GV:${numGV}枚`, 'TITLE')

  lines.push('  0\nENDSEC', '  0\nEOF')
  return lines.join('\n')
}
