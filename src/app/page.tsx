import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function RootPage() {
  const supabase = createClient()
  // getUser()はSupabaseサーバー往復で遅い → getSession()でローカル検証
  const { data: { session } } = await supabase.auth.getSession()
  if (session) redirect('/dashboard')
  else redirect('/auth/login')
}
