// TypeScript Worker: calcFrancisEfficiencyCurve を直接インポートして実行
// turbine-calc.ts と完全に同一のコードを使うため移植ミスがない

import { calcFrancisEfficiencyCurve } from './turbine-calc'

self.onmessage = function(e: MessageEvent) {
  try {
    const { detail, head, ratedRpm } = e.data
    const pts = calcFrancisEfficiencyCurve(detail, head, ratedRpm)
    self.postMessage({ ok: true, data: pts })
  } catch(err) {
    self.postMessage({ ok: false, error: String(err) })
  }
}
