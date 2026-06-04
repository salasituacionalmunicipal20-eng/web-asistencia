# consultar-cedula

Edge Function que proxiya `api.cedula.com.ve` (servicio de consulta CNE
venezolano). Necesario porque ese API **no devuelve headers CORS** — el
navegador bloquea llamadas directas desde React. La function corre en el
dominio de Supabase del proyecto y sí responde con CORS habilitado.

## Deploy (primera vez)

Necesitas Supabase CLI. Si no la tienes:

```powershell
npm i -g supabase
```

Luego, **desde la raíz del repo `web-asistencia/`**:

```powershell
# 1. Login (si no estás logueado)
npx supabase login

# 2. Link al proyecto (solo la primera vez)
npx supabase link --project-ref <PROJECT_REF>
# El project-ref está en el URL de Supabase Studio:
# https://supabase.com/dashboard/project/<PROJECT_REF>

# 3. Guardar credenciales del API como secrets (NO van en el repo)
npx supabase secrets set CEDULA_APP_ID=9213
npx supabase secrets set CEDULA_TOKEN=afe098001cc4b836e26c5050d0e3d930

# 4. Deploy de la function
npx supabase functions deploy consultar-cedula
```

Listo. Apenas el deploy termine, el botón "🆔 CNE" en la pantalla de
Empleados va a funcionar.

## Deploy alternativo (sin CLI — vía Dashboard)

1. Dashboard → **Edge Functions** → **Create a new function**
2. Nombre: `consultar-cedula`
3. Pega el contenido de `index.ts` y guarda
4. **Project Settings → Edge Functions → Secrets** → agregar:
   - `CEDULA_APP_ID` = `9213`
   - `CEDULA_TOKEN` = `afe098001cc4b836e26c5050d0e3d930`

## Rotar credenciales

Si en algún momento sospechas que las credenciales se filtraron (o tu
quota de 200/hora se está consumiendo rápido sin que tus admins estén
consultando), regenera el token en https://cedula.com.ve y luego:

```powershell
npx supabase secrets set CEDULA_TOKEN=nuevo_token_aqui
```

No necesitas re-deployar la function, los secrets se aplican al instante.

## Endpoint

Una vez deployada, queda en:
```
https://<PROJECT_REF>.supabase.co/functions/v1/consultar-cedula
```

Llamada desde el cliente React:
```js
const { data, error } = await supabase.functions.invoke('consultar-cedula', {
  body: { cedula: '15234567' }
})
```

Respuesta exitosa:
```json
{
  "error": false,
  "data": {
    "nacionalidad": "V",
    "cedula": 15234567,
    "fecha_nac": "1952-08-27",
    "rif": "V152345670",
    "primer_nombre": "AQUYILINO",
    "primer_apellido": "TRESPALACIOS",
    "segundo_apellido": "PALMERA",
    "cne": {
      "estado": "MERIDA",
      "municipio": "TOVAR",
      "parroquia": "TOVAR",
      "centro_electoral": "UNIDAD EDUCATIVA COLEGIO FE Y ALEGRIA"
    }
  }
}
```

Errores posibles (en `error_str`):
- `RECORD_NOT_FOUND`: cédula no existe en el CNE
- `INVALID_TOKEN`: credenciales mal configuradas
- `MISSING_CREDENTIALS`: faltan los secrets
- `INVALID_CEDULA`: formato no válido (debe ser solo dígitos, 5–9)
- `PROXY_ERROR`: problema de red al contactar a cedula.com.ve
