// Supabase Edge Function: consultar-cedula
//
// Proxy CORS-friendly para api.cedula.com.ve (servicio de consulta del CNE
// venezolano). El servicio NO devuelve headers CORS, asi que el navegador
// bloquea las peticiones directas desde el frontend. Esta function corre en
// Deno dentro del dominio Supabase del proyecto y SI puede ser llamada
// desde React.
//
// Las credenciales (app_id + token) viven como secrets de Supabase,
// configurados con:
//   npx supabase secrets set CEDULA_APP_ID=9213
//   npx supabase secrets set CEDULA_TOKEN=afe098001cc4b836e26c5050d0e3d930
//
// El frontend la invoca con:
//   supabase.functions.invoke('consultar-cedula', { body: { cedula: '15234567' } })

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"

const APP_ID = Deno.env.get("CEDULA_APP_ID") ?? ""
const TOKEN = Deno.env.get("CEDULA_TOKEN") ?? ""

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  if (!APP_ID || !TOKEN) {
    return json({ error: true, error_str: "MISSING_CREDENTIALS", hint: "Configura CEDULA_APP_ID y CEDULA_TOKEN como secrets de Supabase." }, 500)
  }

  // Aceptamos cedula tanto por body JSON (POST) como por query string (GET).
  // Normalizamos a solo digitos (el API rechaza V12345 con DB_ERROR; solo
  // acepta el numero pelado).
  let cedula = ""
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      cedula = String((body as any).cedula ?? "").replace(/\D/g, "")
    } else {
      const url = new URL(req.url)
      cedula = String(url.searchParams.get("cedula") ?? "").replace(/\D/g, "")
    }
  } catch {
    return json({ error: true, error_str: "BAD_REQUEST" }, 400)
  }

  if (!cedula || cedula.length < 5 || cedula.length > 9) {
    return json({ error: true, error_str: "INVALID_CEDULA", hint: "La cedula debe tener entre 5 y 9 digitos." }, 400)
  }

  try {
    const apiUrl = `https://api.cedula.com.ve/api/v1?app_id=${encodeURIComponent(APP_ID)}&token=${encodeURIComponent(TOKEN)}&cedula=${cedula}`
    const resp = await fetch(apiUrl, { headers: { "Accept": "application/json" } })
    const text = await resp.text()
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = { raw: text } }
    // Pasamos el status original solo si el upstream marca error tecnico;
    // para errores logicos (cedula no existente, etc.) devolvemos 200 con el
    // error_str del API para que el frontend pueda diferenciar.
    return json(payload, 200)
  } catch (e) {
    return json({ error: true, error_str: "PROXY_ERROR", detail: String(e) }, 502)
  }
})
