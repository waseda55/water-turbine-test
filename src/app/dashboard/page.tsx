// 認証チェックは middleware.ts に一本化済み。
// SSR では何もしない（DB クエリなし）。
import DashboardClient from './DashboardClient'

export default function DashboardPage() {
  return <DashboardClient />
}
