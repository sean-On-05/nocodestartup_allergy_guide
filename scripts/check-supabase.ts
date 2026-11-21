import { loadEnv } from 'vite'
import { loadSupabaseCatalog } from '../src/lib/supabase'
const env = { ...loadEnv('development', process.cwd(), 'VITE_'), ...process.env }
const url = env.VITE_SUPABASE_URL
const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !publishableKey) {
  console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local first.')
  process.exit(1)
}
try {
  const catalog = await loadSupabaseCatalog(undefined, { url, publishableKey })
  const statuses = Object.fromEntries(['verified','needs_review','unknown'].map(s => [s,catalog.ingredient_master.filter(i => i.verification_status === s).length]))
  console.log(JSON.stringify({ connected:true, ingredients:catalog.ingredient_master.length, ingredientTags:catalog.allergen_master.length, verificationStatuses:statuses }, null, 2))
} catch {
  console.error('Connection check failed. Check network, public key and RLS SELECT permissions. No database writes were attempted.')
  process.exit(1)
}
