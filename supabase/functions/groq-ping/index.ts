import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) {
    return new Response(JSON.stringify({ ok: false, error: 'no key' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const r = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  })
  const data = await r.json()
  const ids = (data?.data || []).map((m: any) => m.id)
  return new Response(JSON.stringify({ status: r.status, ids }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
