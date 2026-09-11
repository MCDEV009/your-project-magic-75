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
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: 'say OK' }],
      max_tokens: 5,
    }),
  })
  const text = await r.text()
  return new Response(JSON.stringify({ status: r.status, body: text.slice(0, 400) }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
