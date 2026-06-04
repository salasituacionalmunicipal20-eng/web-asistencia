// Supabase Edge Function: consultar-cedula  (versión 2)
//
// Proxy CORS-friendly para api.cedula.com.ve con:
//   • POOL de N credenciales (escala más allá de las 200/hora por cuenta)
//   • FAILOVER: si una credencial falla, automáticamente prueba la siguiente
//   • CACHE en tabla Supabase (cedulas_cache): la misma cédula consultada dos
//     veces en 30 días NO consume cuota la segunda vez
//   • SINGLE-FLIGHT: dos requests concurrentes para la misma cédula comparten
//     una sola llamada al API en vez de gastar 2 créditos
//   • Soporte 'V' (venezolano) y 'E' (extranjero)
//
// Setup de credenciales (Supabase Dashboard → Edge Functions → Secrets):
//   CEDULA_APP_ID, CEDULA_TOKEN          (par #0, compat con v1)
//   CEDULA_APP_ID_1, CEDULA_TOKEN_1      (par #1, primer pool adicional)
//   CEDULA_APP_ID_2, CEDULA_TOKEN_2      (par #2)
//   ...hasta donde quieras
//
// El frontend la invoca con:
//   supabase.functions.invoke('consultar-cedula', { body: { cedula: '15234567', nacionalidad: 'V' } })

import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES Y TIPOS
// ─────────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

// TTL del cache (en segundos)
const CACHE_TTL_OK_SEC = 30 * 24 * 60 * 60      // 30 días para respuestas exitosas
const CACHE_TTL_NOTFOUND_SEC = 24 * 60 * 60      // 24h para RECORD_NOT_FOUND (corto por si se registra en CNE)

// Failover
const COLD_DURATION_MS = 60 * 60 * 1000          // 1 hora en "frío" tras RATE_LIMIT / 5xx
const INVALID_TOKEN_STRIKES = 3                  // INVALID_TOKEN seguidos antes de marcar como DEAD
const FETCH_TIMEOUT_MS = 8000                    // Timeout por llamada al API

// Pool scan
const POOL_MAX_INDEX = 50                        // Hasta CEDULA_APP_ID_50

interface Credencial {
  appId: string
  token: string
  label: number        // 0 para el par sin sufijo (compat v1), 1..N para los demás
}

interface Pool {
  creds: Credencial[]
  nextIdx: number
  dead: Set<number>
  coldUntil: Map<number, number>   // idx → timestamp en ms cuando vuelve a vivir
  tokenStrikes: Map<number, number> // idx → cuántos INVALID_TOKEN seguidos lleva
}

// ─────────────────────────────────────────────────────────────────────
// CARGA DEL POOL DE CREDENCIALES (al cold-start, una sola vez)
// ─────────────────────────────────────────────────────────────────────
function cargarPool(): Pool {
  const creds: Credencial[] = []
  // Par sin sufijo (compat con v1)
  const baseId = Deno.env.get("CEDULA_APP_ID") ?? ""
  const baseTk = Deno.env.get("CEDULA_TOKEN") ?? ""
  if (baseId && baseTk) creds.push({ appId: baseId, token: baseTk, label: 0 })

  // Escaneo completo 1..POOL_MAX_INDEX (NO break en primer gap; se permite gaps
  // para que rotar credenciales sea más flexible)
  for (let n = 1; n <= POOL_MAX_INDEX; n++) {
    const id = Deno.env.get(`CEDULA_APP_ID_${n}`) ?? ""
    const tk = Deno.env.get(`CEDULA_TOKEN_${n}`) ?? ""
    if (id && tk) creds.push({ appId: id, token: tk, label: n })
    else if (id || tk) console.warn(`[pool] Credencial #${n} incompleta, ignorada`)
  }

  console.log(`[pool] ${creds.length} credenciales cargadas: [${creds.map(c => c.label).join(", ")}]`)
  return { creds, nextIdx: 0, dead: new Set(), coldUntil: new Map(), tokenStrikes: new Map() }
}

const pool = cargarPool()

// ─────────────────────────────────────────────────────────────────────
// SELECCIÓN ROUND-ROBIN CON FAILOVER
// Avanza nextIdx SIEMPRE para que requests concurrentes peguen a distintas
// credenciales. Salta DEAD y COLD. Devuelve null si no queda ninguna viva.
// ─────────────────────────────────────────────────────────────────────
function elegirCredencial(): { cred: Credencial; idx: number } | null {
  const total = pool.creds.length
  if (total === 0) return null
  const ahora = Date.now()

  // Limpieza lazy de cold expirados (sin mutar el Map durante iteración)
  const expirados: number[] = []
  for (const [idx, hasta] of pool.coldUntil) {
    if (hasta <= ahora) expirados.push(idx)
  }
  for (const i of expirados) pool.coldUntil.delete(i)

  // Una vuelta completa al pool
  for (let probe = 0; probe < total; probe++) {
    const idx = pool.nextIdx % total
    pool.nextIdx = (pool.nextIdx + 1) % total
    if (pool.dead.has(idx)) continue
    if (pool.coldUntil.has(idx)) continue
    return { cred: pool.creds[idx], idx }
  }
  return null
}

function marcarCold(idx: number) {
  pool.coldUntil.set(idx, Date.now() + COLD_DURATION_MS)
  console.warn(`[pool] Credencial #${pool.creds[idx]?.label} marcada FRÍA por 60min`)
}

function notarStrikeToken(idx: number) {
  const n = (pool.tokenStrikes.get(idx) ?? 0) + 1
  pool.tokenStrikes.set(idx, n)
  if (n >= INVALID_TOKEN_STRIKES) {
    pool.dead.add(idx)
    console.error(`[pool] Credencial #${pool.creds[idx]?.label} MUERTA tras ${n} INVALID_TOKEN seguidos. Reemplaza el secret.`)
  } else {
    console.warn(`[pool] Credencial #${pool.creds[idx]?.label} INVALID_TOKEN strike ${n}/${INVALID_TOKEN_STRIKES}`)
  }
}

function resetStrikes(idx: number) {
  if (pool.tokenStrikes.has(idx)) pool.tokenStrikes.delete(idx)
}

// ─────────────────────────────────────────────────────────────────────
// CLIENTE SUPABASE PARA TABLA cedulas_cache
// Usa SERVICE_ROLE_KEY (bypassa RLS, solo accesible desde dentro de la function)
// ─────────────────────────────────────────────────────────────────────
function clienteSupabase() {
  const url = Deno.env.get("SUPABASE_URL")
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !key) return null
  try {
    return createClient(url, key, { auth: { persistSession: false } })
  } catch (e) {
    console.error("[supabase] No se pudo crear cliente:", e)
    return null
  }
}

const supa = clienteSupabase()

// ─────────────────────────────────────────────────────────────────────
// CACHE: lookup + upsert
// ─────────────────────────────────────────────────────────────────────
async function cacheLookup(cedulaKey: string): Promise<unknown | null> {
  if (!supa) return null
  try {
    const { data, error } = await supa
      .from("cedulas_cache")
      .select("payload, ttl_until")
      .eq("cedula", cedulaKey)
      .maybeSingle()
    if (error || !data) return null
    if (new Date(data.ttl_until as string).getTime() <= Date.now()) return null
    return data.payload
  } catch (e) {
    console.warn("[cache] lookup falló:", e)
    return null
  }
}

async function cacheUpsert(cedulaKey: string, payload: unknown, ttlSec: number, credIdx: number | null) {
  if (!supa) return
  try {
    const ttlUntil = new Date(Date.now() + ttlSec * 1000).toISOString()
    await supa.from("cedulas_cache").upsert({
      cedula: cedulaKey,
      payload,
      fetched_at: new Date().toISOString(),
      ttl_until: ttlUntil,
      credential_used: credIdx,
    })
  } catch (e) {
    console.warn("[cache] upsert falló (no fatal):", e)
  }
}

// ─────────────────────────────────────────────────────────────────────
// SINGLE-FLIGHT: si ya hay una request in-flight para la misma cédula,
// las nuevas comparten esa Promise en vez de disparar otra llamada al API.
// Critico para reducir consumo de cuota cuando varios admins miran al mismo
// empleado simultáneamente.
// ─────────────────────────────────────────────────────────────────────
const enVuelo = new Map<string, Promise<{ payload: unknown; credIdx: number | null; ttlSec: number | null }>>()

// ─────────────────────────────────────────────────────────────────────
// LLAMADA AL API cedula.com.ve CON TIMEOUT
// ─────────────────────────────────────────────────────────────────────
async function llamarAPI(cred: Credencial, cedulaNum: string): Promise<{ json: any; httpOk: boolean }> {
  const url = `https://api.cedula.com.ve/api/v1?app_id=${encodeURIComponent(cred.appId)}&token=${encodeURIComponent(cred.token)}&cedula=${cedulaNum}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } })
    const text = await resp.text()
    let json: any
    try { json = JSON.parse(text) } catch { json = { error: true, error_str: "INVALID_API_RESPONSE", raw: text.substring(0, 200) } }
    return { json, httpOk: resp.ok }
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────────────────────────────────────────────────
// LOOP DE INTENTOS: hasta agotar el pool entero
// ─────────────────────────────────────────────────────────────────────
async function consultarConFailover(cedulaNum: string): Promise<{ payload: any; credIdx: number | null; ttlSec: number | null }> {
  const maxIntentos = Math.max(pool.creds.length, 1)
  let ultimoError: any = { error: true, error_str: "UNKNOWN_ERROR" }
  for (let intento = 0; intento < maxIntentos; intento++) {
    const pick = elegirCredencial()
    if (!pick) {
      return { payload: { error: true, error_str: "ALL_QUOTAS_EXHAUSTED" }, credIdx: null, ttlSec: null }
    }
    try {
      const { json, httpOk } = await llamarAPI(pick.cred, cedulaNum)
      // Éxito definitivo (data presente)
      if (json && json.error === false && json.data) {
        resetStrikes(pick.idx)
        return { payload: json, credIdx: pick.cred.label, ttlSec: CACHE_TTL_OK_SEC }
      }
      // Errores LÓGICOS (la respuesta es válida, no hay que reintentar)
      if (json && json.error_str === "RECORD_NOT_FOUND") {
        resetStrikes(pick.idx)
        return { payload: json, credIdx: pick.cred.label, ttlSec: CACHE_TTL_NOTFOUND_SEC }
      }
      if (json && (json.error_str === "DB_ERROR" || json.error_str === "URL_ERROR")) {
        resetStrikes(pick.idx)
        return { payload: json, credIdx: pick.cred.label, ttlSec: null }  // no cachear
      }
      // Errores OPERACIONALES → failover
      if (json && json.error_str === "INVALID_TOKEN") {
        notarStrikeToken(pick.idx)
        ultimoError = json
        continue
      }
      if (json && (json.error_str === "RATE_LIMIT" || !httpOk)) {
        marcarCold(pick.idx)
        ultimoError = json
        continue
      }
      // Cualquier otro error: tratarlo como operacional defensivamente
      marcarCold(pick.idx)
      ultimoError = json
    } catch (e: any) {
      // Timeout o error de red → COLD
      marcarCold(pick.idx)
      ultimoError = { error: true, error_str: "NETWORK_ERROR", detail: String(e?.message || e) }
    }
  }
  return { payload: { ...ultimoError, _exhausted: true }, credIdx: null, ttlSec: null }
}

// ─────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
}

serve(async (req) => {
  const t0 = performance.now()
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS })

  // Endpoint de health para debug: GET ?health=1
  const url0 = new URL(req.url)
  if (req.method === "GET" && url0.searchParams.get("health") === "1") {
    return json({
      ok: true,
      pool_size: pool.creds.length,
      labels: pool.creds.map(c => c.label),
      dead: [...pool.dead].map(i => pool.creds[i]?.label),
      cold: [...pool.coldUntil.entries()].map(([i, t]) => ({ label: pool.creds[i]?.label, expires_in_sec: Math.max(0, Math.round((t - Date.now()) / 1000)) })),
    })
  }

  if (pool.creds.length === 0) {
    return json({ error: true, error_str: "NO_CREDENTIALS_CONFIGURED", hint: "Agrega secrets CEDULA_APP_ID y CEDULA_TOKEN (o pares numerados _1, _2, ...) y redeploya." }, 500)
  }

  // Parsear cedula y nacionalidad del body o query
  let cedulaRaw = "", nacionalidad = "V"
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}))
      cedulaRaw = String((body as any).cedula ?? "")
      const nac = String((body as any).nacionalidad ?? "V").toUpperCase()
      if (nac === "V" || nac === "E") nacionalidad = nac
    } else {
      cedulaRaw = String(url0.searchParams.get("cedula") ?? "")
      const nac = String(url0.searchParams.get("nacionalidad") ?? "V").toUpperCase()
      if (nac === "V" || nac === "E") nacionalidad = nac
    }
  } catch {
    return json({ error: true, error_str: "BAD_REQUEST" }, 400)
  }

  const cedulaNum = cedulaRaw.replace(/\D/g, "")
  if (!cedulaNum || cedulaNum.length < 4 || cedulaNum.length > 10) {
    return json({ error: true, error_str: "INVALID_CEDULA", hint: "Cédula debe tener entre 4 y 10 dígitos." }, 400)
  }

  // Clave de cache incluye nacionalidad (V y E pueden tener mismo número de cédula)
  const cacheKey = `${nacionalidad}${cedulaNum}`

  // 1) LOOKUP en cache
  const cached = await cacheLookup(cacheKey)
  if (cached) {
    const latency = Math.round(performance.now() - t0)
    return json({ ...(cached as any), _meta: { cache_hit: true, credential_used: null, attempts: 0, latency_ms: latency } })
  }

  // 2) SINGLE-FLIGHT: si ya hay alguien consultando esta cédula, esperar a esa promise
  let promesa = enVuelo.get(cacheKey)
  let attemptsCount = 0
  if (!promesa) {
    promesa = (async () => {
      attemptsCount = 1
      const r = await consultarConFailover(cedulaNum)
      // Fire-and-forget upsert solo si vale la pena cachear
      if (r.ttlSec !== null) {
        cacheUpsert(cacheKey, r.payload, r.ttlSec, r.credIdx).catch(() => {})
      }
      return r
    })()
    enVuelo.set(cacheKey, promesa)
    promesa.finally(() => enVuelo.delete(cacheKey))
  }

  const { payload, credIdx } = await promesa
  const latency = Math.round(performance.now() - t0)
  return json({ ...(payload as any), _meta: { cache_hit: false, credential_used: credIdx, attempts: attemptsCount || 1, latency_ms: latency } })
})
