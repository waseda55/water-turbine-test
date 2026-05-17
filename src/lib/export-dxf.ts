/**
 * フランシス水車 DXF エクスポート
 *
 * 生成レイヤー構成:
 *   CENTER     中心線（細線、一点鎖線）
 *   OUTLINE    外形線（太線、実線）
 *   GUIDE      ガイドベーンリング（細線、実線）
 *   RUNNER     ランナーブレード（中線、実線）
 *   CASING     スパイラルケーシング（中線、実線）
 *   DRAFTTUBE  吸出し管（細線、破線）
 *   DIM        寸法線・引出線（細線）
 *   TEXT       寸法テキスト（細線）
 *   TITLE      表題欄
 *
 * 座標系: mm単位、原点=ランナー中心
 */

import type { TurbineResults } from '@/types'

// ── dxf-writer は純 CommonJS / ブラウザ未対応のため
//    クライアント側ではダイナミックインポートで呼び出す
//    本モジュールは generateFrancisDxfString() を export し、
//    呼び出し元で Blob → download する。

export async function exportFrancisDxf(
  results: TurbineResults,
  caseName: string = 'francis'
): Promise<void> {
  const dxfStr = buildFrancisDxf(results)
  const blob = new Blob([dxfStr], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${caseName}_フランシス水車概略図.dxf`
  a.click()
  URL.revokeObjectURL(url)
}

// ────────────────────────────────────────────────────────────
//  DXF 文字列生成（ブラウザ対応の素の文字列操作版）
// ────────────────────────────────────────────────────────────
export function buildFrancisDxf(results: TurbineResults): string {
  const f   = results.dimensions.francis!
  const D2e = results.dimensions.runnerDiameter * 1000   // mm
  const D01 = f.inletDiameter                * 1000
  const Bd  = f.guideVaneHeight              * 1000
  const Dsc = f.spiralCaseInlet              * 1000
  const numBlades = f.numBlades
  const numGV     = f.numGuideVanes

  const r2e = D2e / 2
  const r01 = D01 / 2
  const rsc = Dsc / 2

  // 吸出し管
  const dtTopY   =  r2e * 0.30
  const dtBotY   =  r2e * 0.30 + r2e * 1.40
  const dtTopHW  =  r2e * 0.85
  const dtBotHW  =  r2e * 1.25

  // スパイラルケーシング中心（右上にオフセット）
  const scCx = r01 * 0.55
  const scCy = -r01 * 0.05

  // ガイドベーン半径
  const gvR = (r2e + r01) / 2

  // ハブ半径
  const hubR = r2e * 0.15

  const lines: string[] = []

  // ─── DXF ヘッダー ───────────────────────────────────────────
  lines.push(
    '  0\nSECTION',
    '  2\nHEADER',
    '  9\n$ACADVER',
    '  1\nAC1015',
    '  9\n$INSUNITS',
    ' 70\n4',          // 4=mm
    '  0\nENDSEC',
  )

  // ─── TABLES ─────────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nTABLES')

  // LTYPE（線種）
  lines.push(
    '  0\nTABLE', '  2\nLTYPE', ' 70\n3',
    // CONTINUOUS
    '  0\nLTYPE', '  2\nCONTINUOUS', ' 70\n0',
    '  3\nSolid line', ' 72\n65', ' 73\n0', ' 40\n0.0',
    // DASHED
    '  0\nLTYPE', '  2\nDASHED', ' 70\n0',
    '  3\nDashed', ' 72\n65', ' 73\n2', ' 40\n12.0',
    ' 49\n8.0', ' 74\n0', ' 49\n-4.0', ' 74\n0',
    // CENTER
    '  0\nLTYPE', '  2\nCENTER', ' 70\n0',
    '  3\nCenter line', ' 72\n65', ' 73\n4', ' 40\n40.0',
    ' 49\n25.0', ' 74\n0', ' 49\n-5.0', ' 74\n0',
    ' 49\n5.0',  ' 74\n0', ' 49\n-5.0', ' 74\n0',
    '  0\nENDTAB',
  )

  // LAYER
  const layerDefs = [
    { name: 'CENTER',    color: 8,  ltype: 'CENTER'     },
    { name: 'OUTLINE',   color: 7,  ltype: 'CONTINUOUS' },
    { name: 'GUIDE',     color: 3,  ltype: 'CONTINUOUS' },
    { name: 'RUNNER',    color: 2,  ltype: 'CONTINUOUS' },
    { name: 'CASING',    color: 5,  ltype: 'CONTINUOUS' },
    { name: 'DRAFTTUBE', color: 4,  ltype: 'DASHED'     },
    { name: 'DIM',       color: 8,  ltype: 'CONTINUOUS' },
    { name: 'TEXT',      color: 7,  ltype: 'CONTINUOUS' },
    { name: 'TITLE',     color: 7,  ltype: 'CONTINUOUS' },
  ]
  lines.push('  0\nTABLE', '  2\nLAYER', ` 70\n${layerDefs.length}`)
  for (const l of layerDefs) {
    lines.push(
      '  0\nLAYER', `  2\n${l.name}`,
      ' 70\n0', ' 62\n' + l.color, `  6\n${l.ltype}`,
    )
  }
  lines.push('  0\nENDTAB', '  0\nENDSEC')

  // ─── ENTITIES ───────────────────────────────────────────────
  lines.push('  0\nSECTION', '  2\nENTITIES')

  // ── helper functions ──
  function line(x1: number, y1: number, x2: number, y2: number, layer: string) {
    lines.push('  0\nLINE', `  8\n${layer}`,
      ` 10\n${x1.toFixed(3)}`, ` 20\n${y1.toFixed(3)}`, ' 30\n0.0',
      ` 11\n${x2.toFixed(3)}`, ` 21\n${y2.toFixed(3)}`, ' 31\n0.0')
  }
  function circle(cx: number, cy: number, r: number, layer: string) {
    lines.push('  0\nCIRCLE', `  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`, ` 20\n${cy.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${r.toFixed(3)}`)
  }
  function arc(cx: number, cy: number, r: number, startDeg: number, endDeg: number, layer: string) {
    lines.push('  0\nARC', `  8\n${layer}`,
      ` 10\n${cx.toFixed(3)}`, ` 20\n${cy.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${r.toFixed(3)}`,
      ` 50\n${startDeg.toFixed(3)}`, ` 51\n${endDeg.toFixed(3)}`)
  }
  function text(x: number, y: number, h: number, str: string, layer: string, angle = 0) {
    lines.push('  0\nTEXT', `  8\n${layer}`,
      ` 10\n${x.toFixed(3)}`, ` 20\n${y.toFixed(3)}`, ' 30\n0.0',
      ` 40\n${h.toFixed(3)}`, `  1\n${str}`,
      ` 50\n${angle.toFixed(1)}`,
      ' 72\n1')  // center-align
  }
  function dimLinear(
    x1: number, y1: number, x2: number, y2: number,
    dimLineY: number, label: string, layer: string
  ) {
    // 簡易寸法線：引出線＋寸法線＋テキスト
    const midX = (x1 + x2) / 2
    line(x1, y1, x1, dimLineY, layer)
    line(x2, y2, x2, dimLineY, layer)
    line(x1, dimLineY, x2, dimLineY, layer)
    // 矢頭（簡易）
    const sz = r2e * 0.02
    line(x1, dimLineY, x1 + sz * 2, dimLineY + sz, layer)
    line(x1, dimLineY, x1 + sz * 2, dimLineY - sz, layer)
    line(x2, dimLineY, x2 - sz * 2, dimLineY + sz, layer)
    line(x2, dimLineY, x2 - sz * 2, dimLineY - sz, layer)
    text(midX, dimLineY + sz * 1.5, r2e * 0.04, label, 'TEXT')
  }

  // ── 中心線 ──
  const clExt = r01 * 1.3
  line(-clExt, 0, clExt, 0, 'CENTER')
  line(0, -clExt, 0, dtBotY + r2e * 0.2, 'CENTER')

  // ── 吸出し管（破線台形） ──
  line(-dtTopHW, dtTopY, -dtBotHW, dtBotY, 'DRAFTTUBE')
  line( dtTopHW, dtTopY,  dtBotHW, dtBotY, 'DRAFTTUBE')
  line(-dtBotHW, dtBotY,  dtBotHW, dtBotY, 'DRAFTTUBE')
  text(0, dtBotY - r2e * 0.08, r2e * 0.04, '吸出し管', 'TEXT')

  // ── スパイラルケーシング（円） ──
  circle(scCx, -scCy, rsc, 'CASING')

  // ── ガイドベーンリング ──
  circle(0, 0, gvR + Bd / 2, 'GUIDE')
  circle(0, 0, gvR - Bd / 2, 'GUIDE')

  // ── ガイドベーン（放射線分） ──
  for (let i = 0; i < numGV; i++) {
    const angle = (i / numGV) * 2 * Math.PI
    const lean  = 0.18
    const x1 = (gvR + Bd / 2) * Math.cos(angle)
    const y1 = (gvR + Bd / 2) * Math.sin(angle)
    const x2 = (gvR - Bd / 2) * Math.cos(angle + lean)
    const y2 = (gvR - Bd / 2) * Math.sin(angle + lean)
    line(x1, y1, x2, y2, 'GUIDE')
  }

  // ── ランナーブレード ──
  for (let i = 0; i < numBlades; i++) {
    const angle = (i / numBlades) * 2 * Math.PI
    const sweep = 0.45
    const x1 = r2e * 0.95 * Math.cos(angle)
    const y1 = r2e * 0.95 * Math.sin(angle)
    const x2 = r2e * 0.35 * Math.cos(angle + sweep)
    const y2 = r2e * 0.35 * Math.sin(angle + sweep)
    line(x1, y1, x2, y2, 'RUNNER')
  }

  // ── ランナー外周・入口・ハブ ──
  circle(0, 0, r2e, 'OUTLINE')
  circle(0, 0, r01, 'OUTLINE')
  circle(0, 0, hubR, 'OUTLINE')

  // ── 寸法線 ──
  const dimGap = r2e * 0.15
  // D2e（水平、上側）
  dimLinear(-r2e, 0, r2e, 0, -r2e - dimGap, `D2e = ${D2e.toFixed(1)} mm`, 'DIM')
  // D01（下側）
  dimLinear(-r01, 0, r01, 0, -(r01 + dimGap * 2.5), `D01 = ${D01.toFixed(1)} mm`, 'DIM')
  // Bd（縦、右側）
  const bdX = gvR + r2e * 0.18
  line(bdX, -Bd / 2, bdX, Bd / 2, 'DIM')
  line(gvR - Bd / 2, Bd / 2, bdX, Bd / 2, 'DIM')
  line(gvR - Bd / 2, -Bd / 2, bdX, -Bd / 2, 'DIM')
  text(bdX + r2e * 0.05, 0, r2e * 0.04, `Bd=${Bd.toFixed(1)}mm`, 'TEXT')
  // Dsc（ケーシング）
  text(scCx, -scCy - rsc - r2e * 0.08, r2e * 0.04, `Dsc=${Dsc.toFixed(1)}mm`, 'TEXT')

  // ── 表題欄 ──
  const tw = r01 * 3.2
  const th = r2e * 0.45
  const tx = r01 * 1.6
  const ty = -(r2e + dimGap + th + r2e * 0.15)
  // 外枠
  line(tx - tw / 2, ty,      tx + tw / 2, ty,      'TITLE')
  line(tx - tw / 2, ty + th, tx + tw / 2, ty + th, 'TITLE')
  line(tx - tw / 2, ty,      tx - tw / 2, ty + th, 'TITLE')
  line(tx + tw / 2, ty,      tx + tw / 2, ty + th, 'TITLE')
  // 仕切り線
  line(tx - tw / 2, ty + th * 0.5, tx + tw / 2, ty + th * 0.5, 'TITLE')
  // テキスト
  const th1 = r2e * 0.05
  text(tx, ty + th * 0.75, th1 * 1.2, 'フランシス水車　概略断面図', 'TITLE')
  text(tx - tw * 0.2, ty + th * 0.25, th1,
    `D2e=${D2e.toFixed(1)}  D01=${D01.toFixed(1)}  Bd=${Bd.toFixed(1)}  Dsc=${Dsc.toFixed(1)}  [mm]`, 'TITLE')
  text(tx + tw * 0.25, ty + th * 0.25, th1,
    `ブレード:${numBlades}枚  GV:${numGV}枚`, 'TITLE')

  lines.push('  0\nENDSEC', '  0\nEOF')
  return lines.join('\n')
}
