// supabase/functions/enviar-notif-fcm-cuadrilla/index.ts
//
// Edge Function: envia push notifications via FCM HTTP v1 a empleados de cuadrilla.
// Deploy: npx supabase functions deploy enviar-notif-fcm-cuadrilla --no-verify-jwt
//
// Secrets requeridos (ya configurados):
//   FIREBASE_SERVICE_ACCOUNT_JSON: JSON crudo del service account de Firebase
//
// Body esperado:
//   { reporte_id: string, tipo_evento: "NUEVO_REPORTE" | "REPORTE_RECHAZADO" | "REPORTE_VALIDADO" }

import { createClient } from "npm:@supabase/supabase-js@2"
import { JWT } from "npm:google-auth-library@9"

// ---------- CORS ----------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ---------- Service account + cliente Supabase (singletons de modulo) ----------
const SERVICE_ACCOUNT_RAW = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON")
if (!SERVICE_ACCOUNT_RAW) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON no esta configurado")
}
let SA: { client_email: string; private_key: string; project_id: string }
try {
  SA = JSON.parse(SERVICE_ACCOUNT_RAW ?? "{}")
} catch (e) {
  console.error("FIREBASE_SERVICE_ACCOUNT_JSON malformado:", e)
  SA = {} as any
}

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
)

// ---------- Cache del access_token (55 min para evitar firmar JWT cada request) ----------
let cachedToken: { value: string; expiresAt: number } | null = null
async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.value
  }
  if (!SA.client_email || !SA.private_key) {
    throw new Error("Service account incompleto: faltan client_email/private_key")
  }
  const jwtClient = new JWT({
    email: SA.client_email,
    key: SA.private_key,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  })
  const { access_token, expiry_date } = await jwtClient.authorize()
  if (!access_token) throw new Error("No se obtuvo access_token de Google")
  cachedToken = {
    value: access_token,
    expiresAt: expiry_date ?? now + 55 * 60 * 1000,
  }
  return access_token
}

// ---------- Helpers DB ----------
async function getReporte(id: string) {
  const { data, error } = await supabase
    .from("reportes_cuadrilla")
    .select("id, trabajador_cedula, tipo_actividad_codigo, descripcion, direccion, observaciones_validacion, estado")
    .eq("id", id)
    .single()
  if (error) throw new Error(`No se pudo leer reporte ${id}: ${error.message}`)
  return data
}

async function getNombreTrabajador(cedula: string): Promise<string> {
  const { data } = await supabase
    .from("empleados")
    .select("nombres, apellidos")
    .eq("cedula", cedula)
    .maybeSingle()
  if (!data) return `Trabajador ${cedula}`
  return `${(data as any).nombres ?? ""} ${(data as any).apellidos ?? ""}`.trim() || `Trabajador ${cedula}`
}

async function getTokensDeRoles(roles: string[]): Promise<{ token: string; id: string }[]> {
  const { data: empleados, error: e1 } = await supabase
    .from("empleados")
    .select("cedula")
    .in("rol_principal", roles)
  if (e1) throw new Error(`Error leyendo empleados: ${e1.message}`)
  const cedulas = (empleados ?? []).map((r: any) => r.cedula)
  if (cedulas.length === 0) return []
  const { data: tokens, error: e2 } = await supabase
    .from("fcm_tokens")
    .select("id, token")
    .in("cedula", cedulas)
  if (e2) throw new Error(`Error leyendo fcm_tokens: ${e2.message}`)
  return (tokens ?? []).filter((t: any) => !!t.token) as any
}

async function getTokensDeCedula(cedula: string): Promise<{ token: string; id: string }[]> {
  const { data, error } = await supabase
    .from("fcm_tokens")
    .select("id, token")
    .eq("cedula", cedula)
  if (error) throw new Error(`Error leyendo fcm_tokens: ${error.message}`)
  return (data ?? []).filter((t: any) => !!t.token) as any
}

async function borrarTokenInvalido(id: string) {
  await supabase.from("fcm_tokens").delete().eq("id", id)
}

// ---------- Envio a FCM ----------
interface SendResult {
  sent: number
  failed: number
  errors: Array<{ token_id: string; error: string }>
}

async function enviarFCM(
  tokens: { token: string; id: string }[],
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<SendResult> {
  const result: SendResult = { sent: 0, failed: 0, errors: [] }
  if (tokens.length === 0) return result

  const accessToken = await getAccessToken()
  const url = `https://fcm.googleapis.com/v1/projects/${SA.project_id}/messages:send`

  await Promise.all(
    tokens.map(async ({ token, id }) => {
      const message = {
        message: {
          token,
          notification: { title, body },
          data,
          android: {
            priority: "HIGH",
            notification: {
              channel_id: "memos_channel",
              sound: "default",
            },
          },
        },
      }
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(message),
        })
        if (r.ok) {
          result.sent++
          return
        }
        const errBody = await r.text()
        const lower = errBody.toLowerCase()
        if (
          r.status === 404 ||
          r.status === 410 ||
          lower.includes("unregistered") ||
          lower.includes("invalid-argument") ||
          lower.includes("invalid_argument")
        ) {
          await borrarTokenInvalido(id)
        }
        result.failed++
        result.errors.push({ token_id: id, error: `HTTP ${r.status}: ${errBody}` })
      } catch (e) {
        result.failed++
        result.errors.push({ token_id: id, error: String(e) })
      }
    }),
  )

  return result
}

// ---------- Handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const { reporte_id, tipo_evento } = await req.json()
    if (!reporte_id || typeof reporte_id !== "string") {
      return new Response(JSON.stringify({ error: "reporte_id requerido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }
    if (!["NUEVO_REPORTE", "REPORTE_RECHAZADO", "REPORTE_VALIDADO"].includes(tipo_evento)) {
      return new Response(JSON.stringify({ error: "tipo_evento invalido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const reporte: any = await getReporte(reporte_id)
    const nombre = await getNombreTrabajador(reporte.trabajador_cedula)
    const tipo = reporte.tipo_actividad_codigo ?? "actividad"
    const direccion = reporte.direccion ?? "sin direccion"

    let title = ""
    let body = ""
    let tokens: { token: string; id: string }[] = []

    if (tipo_evento === "NUEVO_REPORTE") {
      title = "Nuevo reporte de campo"
      body = `${nombre} reporto ${tipo} en ${direccion}`
      tokens = await getTokensDeRoles(["supervisor_cuadrilla", "alcaldesa"])
    } else if (tipo_evento === "REPORTE_RECHAZADO") {
      title = "Tu reporte fue rechazado"
      body = `Motivo: ${reporte.observaciones_validacion ?? "sin observaciones"}`
      tokens = await getTokensDeCedula(reporte.trabajador_cedula)
    } else {
      // REPORTE_VALIDADO
      title = "Reporte validado"
      body = "Tu reporte fue validado por la Alcaldesa. Buen trabajo."
      tokens = await getTokensDeCedula(reporte.trabajador_cedula)
    }

    const data = {
      reporte_id: String(reporte.id),
      tipo_evento: String(tipo_evento),
      categoria: String(tipo_evento).toLowerCase(),
      estado: String(reporte.estado ?? ""),
      title,
      body,
    }

    const result = await enviarFCM(tokens, title, body, data)
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e: any) {
    console.error("[enviar-notif-fcm-cuadrilla] error:", e)
    return new Response(
      JSON.stringify({ error: String(e?.message ?? e), sent: 0, failed: 0, errors: [] }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
