# consultar-cedula v2

Edge Function de Supabase que sirve de proxy a `api.cedula.com.ve` con:

- **Pool de N credenciales** — escala más allá de las 200/hora por cuenta
- **Failover automático** — si una credencial falla, prueba la siguiente
- **Cache** en tabla Supabase — segunda consulta de la misma cédula no consume cuota
- **Single-flight** — requests concurrentes para la misma cédula comparten 1 llamada
- **Soporte V (venezolano) y E (extranjero)**

## ¿Cómo se ve un cliente llamando?

```js
const { data } = await supabase.functions.invoke('consultar-cedula', {
  body: { cedula: '15234567', nacionalidad: 'V' }
})

// data.data → datos del CNE
// data._meta → { cache_hit, credential_used, attempts, latency_ms }
```

---

## Setup de cero (paso a paso)

### Paso 1 — Crear la tabla cache

Supabase Dashboard → **SQL Editor** → **New query** → pega el contenido de
[`schema.sql`](./schema.sql) → **Run**.

Debe decir "Success. No rows returned". Eso crea:
- Tabla `cedulas_cache`
- RLS que niega lectura/escritura desde el cliente (solo Edge Function puede)
- Función `limpiar_cache_cedulas()` opcional para limpieza periódica

### Paso 2 — Guardar las credenciales del API como secrets

Dashboard → **Project Settings** → **Edge Functions** → **Manage secrets** →
agregar las siguientes (puedes ir agregando más cuentas con el tiempo):

| Nombre del secret | Valor |
|---|---|
| `CEDULA_APP_ID` | `9213` (tu primera cuenta) |
| `CEDULA_TOKEN` | `afe098001cc4b836e26c5050d0e3d930` |

Cuando registres una segunda cuenta en cedula.com.ve, agregas:

| Nombre del secret | Valor |
|---|---|
| `CEDULA_APP_ID_1` | (app id de la segunda cuenta) |
| `CEDULA_TOKEN_1` | (token de la segunda cuenta) |

Y así sucesivamente con `_2`, `_3`, etc. La function escanea hasta `_50` y
permite gaps (si dejas `_3` vacío y pones `_4`, igual lo encuentra).

### Paso 3 — Deployar la function

#### Opción A: Dashboard (sin instalar nada)

1. **Edge Functions** → **Create a new function**
2. Nombre: `consultar-cedula`
3. Pega el contenido de [`index.ts`](./index.ts) → **Deploy**

#### Opción B: CLI (recomendado a largo plazo)

```powershell
npm i -g supabase
npx supabase login
npx supabase link --project-ref <TU_PROJECT_REF>
npx supabase functions deploy consultar-cedula
```

### Paso 4 — Verificar que todo está vivo

Visita en el navegador (reemplazá `<TU_PROJECT_REF>`):

```
https://<TU_PROJECT_REF>.supabase.co/functions/v1/consultar-cedula?health=1
```

Te debe devolver algo como:

```json
{
  "ok": true,
  "pool_size": 1,
  "labels": [0],
  "dead": [],
  "cold": []
}
```

Si `pool_size: 0` → faltan los secrets, repetir paso 2.

---

## Cómo agregar la cuenta N+1 más adelante

1. Registrate en https://cedula.com.ve con un email distinto y crea una app
2. Dashboard → **Edge Functions** → **Manage secrets** → agregar:
   - `CEDULA_APP_ID_N` = (app id de la cuenta nueva)
   - `CEDULA_TOKEN_N` = (token de la cuenta nueva)
3. **Re-deploy** la function (los secrets se leen al cold-start; instancias
   warm siguen usando el pool viejo hasta que naturalmente se duermen y
   despiertan, o hasta que fuerces un deploy).
4. Verifica con `?health=1` que `pool_size` subió.

---

## Cómo rotar una credencial comprometida

1. Generar nuevo token en cedula.com.ve para esa cuenta
2. Dashboard → **Edge Functions** → **Manage secrets** → editar
   `CEDULA_TOKEN_N` con el nuevo valor
3. Re-deploy la function

---

## Troubleshooting

### El botón da "Function returned an error"
Hace 99% de los casos es que falta deployar la function o faltan los secrets.
Visita `?health=1` para diagnosticar.

### `pool_size: 0` en health
Los secrets `CEDULA_APP_ID` y `CEDULA_TOKEN` no existen o están vacíos.

### `error_str: NO_CREDENTIALS_CONFIGURED`
Mismo problema que el anterior pero llegó hasta el cliente.

### `error_str: ALL_QUOTAS_EXHAUSTED`
Todas las credenciales del pool están marcadas DEAD o COLD. Posibles causas:
- Pegaste mal todos los tokens (DEAD por INVALID_TOKEN x 3)
- Consumiste las 200/hora de todas las cuentas (COLD por 60 min)

Solución corta: redeploya la function (resetea el estado del pool).
Solución larga: agrega más cuentas o espera 1h.

### `error_str: RECORD_NOT_FOUND`
La cédula no existe en el CNE. No es error del sistema — es respuesta válida.
Se cachea por 24h por si esa cédula se registra después.

### El `_meta.cache_hit` siempre es false
La tabla `cedulas_cache` no existe o el RLS está mal configurado. Revisa el
paso 1.

---

## Limites conocidos (best-effort)

- **Round-robin per-isolate**: el contador del pool vive en memoria de cada
  isolate de Deno. Bajo carga muy alta y múltiples isolates, la distribución
  entre credenciales NO es perfectamente uniforme entre isolates (cada isolate
  hace su propio round-robin). En la práctica, con 5+ credenciales y carga
  moderada, esto es despreciable.
- **Estado del pool por instancia**: si marcas una credencial DEAD en un
  isolate, otra isolate puede aún intentar usarla la primera vez (hasta que
  también la marque DEAD). Self-healing.
- **Sin rate-limit por IP**: se eliminó del v2 porque era ineficaz (los
  isolates no comparten state y los IPs son spoofables vía proxies). Si
  necesitas rate limiting real, usa Cloudflare WAF o pgRLS con un contador
  por usuario autenticado.

---

## Limpieza del cache

Cuando quieras (o programado mensual):

```sql
SELECT public.limpiar_cache_cedulas();
```

Devuelve cuántas filas borró (las que tienen `ttl_until` vencido hace más
de 7 días).
