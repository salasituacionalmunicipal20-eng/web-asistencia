# Manual técnico — Plataformas de la Alcaldía de Cristóbal Rojas

> **Para quien lea esto: eres una IA asistente de programación.** Este documento te explica
> cómo funcionan las dos plataformas del municipio para que puedas hacer cambios sin romper
> nada. Léelo completo antes de tocar código. Está escrito en español porque **todo el
> proyecto es en español** y así debe mantenerse.

Última actualización: agosto de 2026.

---

## 1. Panorama general

Son **dos plataformas independientes**, con tecnologías y bases de datos distintas.
No comparten código. Lo único que comparten es una Edge Function de consulta de cédulas.

| | **Sala Situacional** | **Web Asistencia** |
|---|---|---|
| Carpeta local | `C:\Users\carlo\Documents\alcaldia-admin` | `C:\Users\carlo\Documents\web-asistencia` |
| Repo GitHub | `salasituacionalmunicipal20-eng/registro-alcaldia` | `salasituacionalmunicipal20-eng/web-asistencia` |
| Dominio | `salasituacional.alcaldiadecharallave.com` | `asistencia.alcaldiadecharallave.com` |
| Tecnología | HTML estático suelto, sin build | React 19 + Vite |
| Base de datos | Firebase Realtime Database | Supabase (PostgreSQL) |
| Publicar | `git push origin main` → **se publica solo** | `npm run deploy` → **manual, obligatorio** |
| Para qué sirve | Censo territorial, emergencias, encuestas | Control de personal y asistencia |

> ⚠️ **La diferencia más importante y la que más errores causa:**
> En **Sala Situacional**, hacer `git push` publica a producción inmediatamente.
> En **Web Asistencia**, `git push` NO publica nada: hay que correr `npm run deploy` aparte.

---

## 2. Reglas de trabajo que no se negocian

1. **Todo en español.** Interfaz, comentarios del código, mensajes de commit. Sin excepción.
2. **Los mensajes de commit** se escriben en primera persona describiendo el cambio que el
   usuario va a notar. Ejemplo real: *"Campamento Temporal: el Excel sale completo, derivado
   de las mismas listas del PDF"*. Mira `git log` para tomar el tono.
3. **No hay pruebas automáticas, ni linter, ni build** en Sala Situacional. Verificar significa
   abrir el HTML en un navegador o correr su lógica aparte con Node.
4. **Antes de publicar algo que dependa de configuración externa** (una regla de Firebase, una
   tabla nueva en Supabase, un enlace corto), deja lista esa configuración primero. Si publicas
   antes, la función sale rota en producción, que es un sitio público real en uso.
5. **Nunca escribas claves ni tokens en el código ni en documentos.** Ver sección 8.

---

## 3. Sala Situacional (`alcaldia-admin`)

### 3.1 Cómo está construida

**58 páginas HTML sueltas.** Cada una es autónoma: trae su propio `<style>` y su propio
`<script type="module">` embebidos. No hay bundler, no hay `npm install`, no hay carpeta `src`.
Para probar: abrir el archivo en el navegador o servir la carpeta con cualquier servidor estático.

Cada página **reimporta Firebase desde el CDN** (`https://www.gstatic.com/firebasejs/9.23.0/`) y
**vuelve a declarar el mismo objeto `firebaseConfig`** adentro. No existe un archivo de configuración
compartido. Consecuencia práctica: **cambiar credenciales o subir de versión el SDK obliga a editar
las 58 páginas.**

### 3.2 Autenticación y permisos

- Firebase Auth con **correos sintéticos**: el usuario escribe un nombre de usuario y la página
  inicia sesión como `{usuario}@alcaldia.com`.
- Hay **un super-admin fijo**: `carlos.admin@alcaldia.com`. Varias páginas comparan el correo
  contra ese texto literal para dar acceso. No lo refactorices sin revisar todas las páginas.
- El resto de permisos sale de `/operadores/{uid}`, campo `rol` (`"admin"` u operador).
- `index.html` después del login lee `/operadores/{uid}` y decide a dónde mandar al usuario:
  `password.html` (cambio obligatorio), `admin.html` (si es admin) o `registro.html`.
  **El chequeo de cambio obligatorio va ANTES que el de rol.** Ese orden es intencional
  (busca el comentario "REGLA DE ORO" en `index.html`).

**Patrón de acceso en los tableros** (cópialo tal cual al crear uno nuevo):

```js
onAuthStateChanged(auth, async (user) => {
    if (!user) { location.href = 'index.html'; return; }
    const esSuper = user.email === 'carlos.admin@alcaldia.com';
    let permitido = esSuper;
    if (!esSuper) {
        try {
            const snap = await get(child(ref(database), `operadores/${user.uid}`));
            permitido = snap.exists() && snap.val().rol === 'admin';
        } catch (e) { permitido = false; }
    }
    $('loader').classList.add('hidden');
    if (!permitido) { $('acceso-restringido').classList.remove('hidden'); return; }
    $('contenido').classList.remove('hidden');
    onValue(ref(database, NODO), (snap) => { /* cargar y pintar */ });
});
```

### 3.3 Control por comuna

Los operadores solo ven las filas cuya `comuna` esté en su lista `comunas_asignadas`. **Se controla
en el navegador**, no en el servidor. Toda página que lea `/habitantes` debe repetir este filtro:

```js
let misComunas = window.perfilOperador.comunas_asignadas
                 || (window.perfilOperador.comuna_asignada ? [window.perfilOperador.comuna_asignada] : []);
if (!esAdmin && misComunas.length > 0 && !misComunas.includes('TODAS')) {
    if (!misComunas.includes(h.comuna)) continue;
}
```

`'TODAS'` significa sin restricción. El campo viejo `comuna_asignada` (singular) todavía se lee
por compatibilidad: no lo quites.

### 3.4 Nodos de la base de datos (41)

**Censo y estructura**
`habitantes` · `operadores` · `equipos` · `filtros_territoriales` · `config` · `visitas`

**Movilización 1x10** — siete variantes, cada una con dos nodos (jefes y afines):
`jefes_1x10` / `afines_1x10`, y los sufijos `_abuelos`, `_cristianos`, `_cristianos_abuelos`,
`_educacion`, `_empleados`, `_salud`.

**Emergencia sismo 2026**
`refugiados` + `refugiados_fotos` + `refugiados_cedulas` · `hogares_solidarios` +
`hogares_solidarios_cedulas` + `hogares_solidarios_contador` · `zamurera` + `zamurera_fotos` +
`zamurera_contador` (Campamento Temporal) · `informes_empleados` · `acopio` · `carnets`

**Alerta temprana (lluvias)**
`alerta_temprana` + `alerta_temprana_fotos`

**Encuestas**
`encuestas_consulta_popular` · `encuestas_percepcion_gestion` · `encuestas_reorganizacion_gobierno`

**Operación**
`presencia` · `historial_sesiones` · `historial_cambios` · `tickets`

> **Las fotos siempre van en un nodo aparte** (`*_fotos`), guardadas como dataURL JPEG.
> Se hace así para que el tablero pueda listar cientos de registros sin descargar las imágenes.
> El registro principal solo lleva una bandera `tiene_fotos`.

### 3.5 Archivos JavaScript compartidos

Estos sí son compartidos entre páginas. Se cargan con `<script src="...">`:

| Archivo | Para qué sirve |
|---|---|
| `territorio-data.js` | 226 comunidades, 23 comunas y 51 UBCH del municipio. Define `window.TERRITORIO`. Se usa para las cascadas parroquia → comuna → comunidad. |
| `cne-dateas.js` | Consulta de cédula al CNE. Se activa poniendo `data-cne` en el input. Opcional `data-cne-nombre="#idDelCampoNombre"` para que autocomplete el nombre. Muestra botón "dónde vota" y enlace a Dateas. |
| `pdf-header.js` | `dibujarHeaderPDF(doc, {titulo, subtitulo})` y `dibujarFooterPDF(doc)`. Cintillo institucional con los tres logos. **Úsalo siempre en PDFs nuevos.** |
| `autofresh.js` | Recarga la página si hay versión nueva publicada. **Toda página nueva debe incluirlo.** No recarga si el usuario ya empezó a escribir. |
| `municipios-data.js`, `parroquias-data.js` | Listas de municipios y parroquias de Venezuela. |
| `logos-base64.js`, `carnet-fondo.js`, `print-header.js`, `cne-autocompletar.js` | Recursos gráficos y utilidades de impresión. |

### 3.6 Bibliotecas externas (por CDN, no hay npm)

```html
<script src="https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"></script>
```

También se usa Chart.js en `estadisticas.html` y `@supabase/supabase-js` en `respaldo.html`.
**No hay respaldo si el CDN se cae.**

### 3.7 Publicar cambios

```bash
cd C:/Users/carlo/Documents/alcaldia-admin
git add <archivos>
git commit -m "mensaje en español, primera persona"
git push origin main      # esto YA publica en producción
```

**Reglas de Firebase** (archivo `firebase-rules.json`) — se publican aparte:

```bash
cd C:/Users/carlo/Documents/alcaldia-admin
export GOOGLE_APPLICATION_CREDENTIALS="C:/Users/carlo/Documents/Alcaldia BDD/alcaldia-admin-firebase-adminsdk-fbsvc-207472a5bd.json"
firebase deploy --only database --project alcaldia-admin --non-interactive
```

**Publica las reglas ANTES de subir el código.** Si el formulario sale antes que la regla,
la gente intenta registrarse y le da `permission_denied`.

---

## 4. Web Asistencia (`web-asistencia`)

### 4.1 Cómo está construida

React 19 + Vite 8. Estilos **en línea dentro de los componentes** (no hay CSS modules ni Tailwind).
Íconos con `lucide-react`.

**No hay router.** La navegación es por estado: `App.jsx` guarda `vistaActual` y muestra u oculta
cada vista. La única excepción es la página pública del QR, que se detecta por el hash `#/registro`
(hash y no ruta real porque el sitio es estático en GitHub Pages y una ruta con `/` daría 404 al recargar).

```
src/
  App.jsx              ← menú, sesión, y qué vista se muestra
  supabase.js          ← cliente único de Supabase
  vistas/              ← 18 pantallas
  lib/                 ← auth, horas, pdfHeader, logosBase64, territorio
  hooks/               ← useInactividad, useIsMobile
  components/          ← ModalInactividad
sql/SUPABASE_DEFINITIVO.sql   ← TODO el esquema, en un solo archivo
```

### 4.2 Las 17 vistas del menú

`dashboard` Panel Principal · `empleados` Gestión de Personal · `asistencia_qr` Asistencia por QR ·
`carnets` Carnets · `justificaciones` · `memos` Memorándums · `reportes` · `vacaciones` ·
`timesheets` Hojas de tiempo · `tiempos` Tiempo por tarea · `nomina` Nómina · `cuadrillas` ·
`auditoria` · `administradores` · `radar` Radar tiempo real · `versiones` Versiones App · `configuracion`

Al agregar una vista hay que tocar **cuatro** puntos en `App.jsx`: el import, el arreglo `itemsMenu`,
el conjunto `idsVisibles` (control de permisos) y el bloque que la renderiza. **Si olvidas
`idsVisibles`, la vista aparece en el menú pero no abre.**

### 4.3 Tablas principales de Supabase (34 objetos)

| Tabla | Para qué |
|---|---|
| `empleados` | Ficha del personal. 26 columnas. **`id` es uuid, pero el cruce con la asistencia es por `cedula` (texto).** |
| `asistencia_registros` | Marcaje diario. `empleado_id` **es la cédula, no el uuid**. `hora_entrada`/`hora_salida` son texto. Trae GPS, `device_id` y `network_type`. |
| `asistencia_qr` | Asistencia de jornadas por QR. Independiente de la anterior. Tiene índice único `(cedula, fecha)`. |
| `administradores_web` | Quién entra al panel y con qué rol. |
| `oficinas`, `turnos`, `feriados` | Catálogos. |
| `justificaciones`, `memorandums`, `vacaciones`, `ausencias_diarias` | Gestión de personal. |
| `timesheets_aprobaciones`, `proyectos`, `tareas`, `registros_tiempo`, `nomina_config` | Módulos estilo Hubstaff. |
| `reportes_cuadrilla`, `tipos_actividad_cuadrilla`, `fcm_tokens` | Trabajos de campo + notificaciones push. |
| `ubicaciones_empleados` | Radar en tiempo real. |
| `vw_*` (8 vistas) | Consultas ya armadas: `vw_kpis_hoy`, `vw_ausentes_hoy`, `vw_radar_empleados`, `vw_ranking_puntualidad`, etc. |

**El RLS está abierto** en la mayoría de tablas: el navegador escribe directo con la clave anónima.
No es un descuido a corregir sin avisar; es como está diseñado hoy.

### 4.4 El archivo SQL

`sql/SUPABASE_DEFINITIVO.sql` contiene **el esquema completo**, no parches. Está escrito para
correrse entero cuantas veces haga falta (todo con `IF NOT EXISTS`). Cuando agregues una tabla o
columna, **agrégala a este archivo**, no crees un archivo de migración aparte.

Ejecutarlo: pegarlo en el **SQL Editor de Supabase**. También se puede por API de administración
(`POST https://api.supabase.com/v1/projects/{ref}/database/query` con un token `sbp_`), pero ese
token lo tiene el usuario y hay que pedírselo, no está guardado en el repo.

Proyecto Supabase: `tfbzghjjfcaqmkzsxrrs`.

### 4.5 Publicar cambios

```bash
cd C:/Users/carlo/Documents/web-asistencia
npm run build          # verifica que compile
git add . && git commit -m "..." && git push origin main
npm run deploy         # ESTE es el que publica (gh-pages -d dist)
```

**`git push` no publica.** Si solo haces push, el sitio sigue con la versión vieja.

---

## 5. Recetas

### 5.1 Agregar un módulo nuevo a Sala Situacional

Toma como plantilla un módulo reciente y completo: **`alerta-temprana.html` + `alerta-temprana-resultados.html`**.

1. **Formulario público** `mi-modulo.html`
   - Copia la estructura y estilos de `alerta-temprana.html`.
   - Incluye `<script src="autofresh.js"></script>`.
   - Si pides cédula, ponle `data-cne` y carga `cne-dateas.js` al final.
   - Si pides ubicación, carga `territorio-data.js` y usa la cascada.
   - Guarda con `push(ref(database, 'mi_nodo'))`. Las fotos van a `mi_nodo_fotos/{id}`.

2. **Tablero** `mi-modulo-resultados.html`
   - Copia `alerta-temprana-resultados.html`: ya trae el control de acceso, el QR, los filtros,
     la paginación, el Excel con encabezado congelado y el PDF.

3. **Reglas de Firebase** en `firebase-rules.json`:

```json
"mi_nodo": {
  ".read": "auth.token.email === 'carlos.admin@alcaldia.com' || root.child('operadores').child(auth.uid).child('rol').val() === 'admin'",
  "$id": {
    ".write": "(!data.exists() && newData.exists()) || auth.token.email === 'carlos.admin@alcaldia.com' || root.child('operadores').child(auth.uid).child('rol').val() === 'admin'",
    ".validate": "newData.hasChildren(['campo_obligatorio'])"
  }
}
```
   Esa regla permite que **cualquiera cree** un registro nuevo pero solo un admin lo **modifique o lea**.
   Es lo que hace posible un formulario público sin login.

4. **Enlace corto**: usar **TinyURL con alias propio**, no da.gd (ver trampa 10.6):
```bash
curl -s "https://tinyurl.com/api-create.php?url=<URL_CODIFICADA>&alias=mialias"
```

5. **Tarjeta en `admin.html`** copiando el patrón de las existentes.

6. Publicar reglas → luego `git push`.

### 5.2 Agregar un campo a un módulo existente

El error más común es agregarlo solo al formulario. Hay que tocar **toda la cadena**:

1. El `<input>` o `<select>` en el formulario.
2. El objeto que se guarda (`payload`).
3. La lista de campos que usa la carga al editar (en Campamento Temporal son `JF_FIELDS` e `IF_FIELDS`).
4. La lista del tablero (`JEFE`, `INTEG`, `INM`, etc.) — de ahí salen la ficha, el PDF **y el Excel**.
5. Verificar que el Excel siga cuadrado (ver trampa 10.1).

> En Campamento Temporal el Excel ya **deriva sus columnas** de esas listas, así que agregar el
> campo a la lista lo hace aparecer solo. En otros módulos todavía puede estar escrito a mano:
> **revísalo siempre**.

---

## 6. Cómo verificar sin poder abrir el navegador

Estas técnicas se usan constantemente en este proyecto. Son la diferencia entre publicar algo
sano y publicar algo roto.

**Sintaxis del JavaScript embebido en un HTML:**
```bash
python -c "
import re, io, subprocess
s = io.open('pagina.html', encoding='utf-8').read()
js = '\n'.join(re.findall(r'<script[^>]*type=[\"\x27]module[\"\x27][^>]*>(.*?)</script>', s, re.S))
io.open('t.mjs','w',encoding='utf-8').write(js)
print(subprocess.run(['node','--check','t.mjs'], capture_output=True, text=True))
"
```

**Probar la lógica real del PDF o del Excel:** extraer la función del HTML con una expresión
regular y correrla en Node con las mismas versiones de las bibliotecas
(`npm i jspdf@2.5.1 jspdf-autotable@3.8.2`), alimentándola con datos reales.

**Ver el PDF resultante:** convertirlo a imagen con PyMuPDF y mirarlo.
```python
import fitz
d = fitz.open('salida.pdf')
d[0].get_pixmap(dpi=100).save('pagina1.png')
```

**Leer los datos reales de Firebase** (para no trabajar a ciegas):
```js
import { initializeApp, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
// la clave de servicio está en C:/Users/carlo/Documents/Alcaldia BDD/
```
Ojo: en ESM hay que importar así. `import admin from 'firebase-admin'` **no expone `credential`**.

**Probar una página en teléfono:** servirla y abrirla con Puppeteer en un viewport de 375px,
midiendo que no haya scroll horizontal, que los campos midan al menos 44px de alto y que la
letra de los inputs sea de 16px.

---

## 7. Convenciones de los documentos generados

- **PDF**: siempre con `dibujarHeaderPDF` / `dibujarFooterPDF`. Fechas en formato largo con año
  **y** numérico (`sábado 1 de agosto de 2026 · 01/08/2026`). Nunca dejes fechas en formato
  `2026-08-01` de cara al usuario.
- **Excel**: título en la primera fila, línea de "Generado el…" en la segunda, encabezados en la
  tercera con filtro y panel congelado. La función `guardarXlsx(wb, nombre)` hace el congelado
  (SheetJS no sabe hacerlo solo; se abre el zip y se le inyecta el `<pane>`).
- **Completitud**: cuando el usuario pide un reporte, quiere **todos** los datos, no un resumen.
  Ha sido explícito en esto varias veces.

---

## 8. Credenciales — dónde están (NO las copies a ningún archivo)

| Qué | Dónde |
|---|---|
| Config de Firebase (cliente) | En línea dentro de cada HTML. Es pública por diseño, no es un secreto. |
| Clave de servicio de Firebase | `C:/Users/carlo/Documents/Alcaldia BDD/alcaldia-admin-firebase-adminsdk-*.json` |
| URL y clave anónima de Supabase | `web-asistencia/.env.local` |
| Token de administración de Supabase (`sbp_`) | **No está guardado.** Pídeselo al usuario cuando haga falta, y recuérdale rotarlo después. |

**Nunca pegues una clave dentro de un archivo del repo, de un commit o de un documento.**

---

## 9. APIs para configurar y consultar las bases de datos

Todo lo de esta sección está **probado y funcionando**. Son los mecanismos reales que se usan
para administrar ambas plataformas sin entrar a las consolas web.

### 9.1 Firebase — publicar las reglas de la base de datos

Es la forma de crear o cambiar permisos de un nodo. **Se hace desde la terminal, no hace falta
entrar a la consola de Firebase.**

```bash
cd C:/Users/carlo/Documents/alcaldia-admin
export GOOGLE_APPLICATION_CREDENTIALS="C:/Users/carlo/Documents/Alcaldia BDD/alcaldia-admin-firebase-adminsdk-fbsvc-207472a5bd.json"
firebase deploy --only database --project alcaldia-admin --non-interactive
```

Lee el archivo `firebase-rules.json` de la carpeta (lo indica `firebase.json`). Respuesta buena:

```
+ database: rules syntax for database alcaldia-admin-default-rtdb is valid
+ database: rules for database alcaldia-admin-default-rtdb released successfully
+ Deploy complete!
```

Valida la sintaxis antes de publicar, así que si el JSON está mal no rompe nada en producción.

### 9.2 Firebase — leer y escribir datos con el SDK de administrador

Sirve para auditar datos, corregir registros o hacer cargas masivas. **Salta las reglas de
seguridad** (es una credencial de servidor), así que hay que tener cuidado.

⚠️ **En ESM hay que importar así.** `import admin from 'firebase-admin'` **no funciona**:
deja `admin.credential` en `undefined`.

```js
import { initializeApp, cert } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import fs from 'fs'

initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(
    'C:/Users/carlo/Documents/Alcaldia BDD/alcaldia-admin-firebase-adminsdk-fbsvc-207472a5bd.json', 'utf-8'))),
  databaseURL: 'https://alcaldia-admin-default-rtdb.firebaseio.com'
})
const db = getDatabase()

// LEER un nodo completo
const snap = await db.ref('zamurera').once('value')
const registros = Object.entries(snap.val() || {}).map(([id, r]) => ({ id, ...r }))

// ESCRIBIR una sola clave (no pisa las hermanas)
await db.ref('zamurera_fotos/<id>/f0_i0').set(dataUrlJpeg)

// ACTUALIZAR varias rutas de golpe, de forma atómica
await db.ref().update({
  'zamurera/<id>/familias/0/jefe/medicamento': 'LOSARTAN 50 MG',
  'zamurera/<id>/editado_en': Date.now()
})

process.exit(0)   // hace falta: el SDK deja la conexión abierta
```

**Reglas de oro al escribir:**
- Usa `.set()` sobre la **ruta hija exacta**, no sobre el padre. Un `set` en el padre **borra**
  todo lo que no incluyas.
- Escribir `{}` o `null` **borra el nodo**.
- Después de escribir, **vuelve a leer de la base** y compara. No confíes en que no hubo error.

### 9.3 Supabase — ejecutar SQL por la API de administración

Es como se crean tablas, columnas, índices y vistas sin entrar al panel.

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/tfbzghjjfcaqmkzsxrrs/database/query" \
  -H "Authorization: Bearer <TOKEN_sbp_DEL_USUARIO>" \
  -H "Content-Type: application/json" \
  --data '{"query": "ALTER TABLE asistencia_qr ADD COLUMN IF NOT EXISTS sexo text;"}'
```

- Respuesta `[]` con **HTTP 201** = salió bien (los DDL no devuelven filas).
- Un `SELECT` devuelve un arreglo JSON de objetos.
- Si algo falla devuelve `{"message": "Failed to run sql query: ERROR: ..."}`.

**El token `sbp_` no está guardado en ningún lado.** Pídeselo al usuario cuando lo necesites y
recuérdale rotarlo después (Supabase → Account → Access Tokens).

**Truco para consultas largas o con comillas:** escribe el JSON a un archivo con Python y pásalo
con `--data @archivo.json`. Meter SQL largo directo en la línea de comandos se rompe con el
escapado de comillas.

```python
import io, json
q = """SELECT ... ;"""
io.open('q.json','w',encoding='utf-8').write(json.dumps({'query': q}))
```

**Consultas útiles para orientarse:**

```sql
-- Qué tablas hay y cuántas columnas tiene cada una
SELECT table_name, count(*) FROM information_schema.columns
WHERE table_schema='public' GROUP BY 1 ORDER BY 1;

-- Columnas y tipos de una tabla
SELECT column_name, data_type, is_nullable FROM information_schema.columns
WHERE table_name='empleados' ORDER BY ordinal_position;
```

⚠️ **Cuidado con los tipos.** `empleados.hora_entrada` es de tipo `time`, no texto:
`COALESCE(e.hora_entrada,'')` **falla**. Hay que hacer `COALESCE(e.hora_entrada::text,'')`.

⚠️ **Los CTE que modifican datos ven la foto anterior.** Un
`WITH upd AS (UPDATE ... RETURNING) SELECT count(*) FROM tabla` devuelve el conteo de **antes**
del UPDATE. Para verificar el resultado hay que hacer un `SELECT` aparte, después.

### 9.4 Supabase — activar el tiempo real en una tabla

Sin esto, las suscripciones por websocket **no reciben nada y fallan en silencio**.

```sql
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                   WHERE pubname = 'supabase_realtime' AND tablename = 'mi_tabla')
    THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE mi_tabla;
    END IF;
END $$;
```

Comprobar que quedó:
```sql
SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime';
```

### 9.5 Supabase — leer y escribir desde el navegador o desde Node

El cliente `@supabase/supabase-js`. En la app ya está creado en `src/supabase.js`.

```js
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(URL, ANON_KEY)   // están en web-asistencia/.env.local

const { data, error } = await supabase.from('asistencia_qr').select('*').eq('fecha', '2026-08-14')
const { error } = await supabase.from('asistencia_qr').insert({ nombre: '...', cedula: '...' })
const { error } = await supabase.from('asistencia_qr').update({ sexo: 'Femenino' }).eq('id', id)
const { error } = await supabase.from('asistencia_qr').delete().eq('id', id)
```

**Suscripción en tiempo real** (así funcionan los contadores en vivo del panel de Asistencia por QR):

```js
const canal = supabase
  .channel('nombre_del_canal')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia_qr' },
      () => recargar())
  .subscribe((estado) => setEnVivo(estado === 'SUBSCRIBED'))
// al desmontar:
supabase.removeChannel(canal)
```

Códigos de error útiles: **`23505`** es violación de índice único (ejemplo real: la misma cédula
intentando registrarse dos veces el mismo día). Convierte ese código en un mensaje en cristiano,
no muestres el error crudo.

**Cómo probar el tiempo real de punta a punta antes de publicar:** suscribirse desde Node,
insertar una fila de prueba, comprobar que llegue el evento, y **borrar la fila al terminar**.

### 9.6 Consulta de cédulas al CNE (la comparten las dos plataformas)

Es una Edge Function alojada en el proyecto de Supabase, pero **la usan los formularios de las
dos plataformas**.

```
POST https://tfbzghjjfcaqmkzsxrrs.supabase.co/functions/v1/consultar-cedula
Content-Type: application/json

{ "cedula": "12345678", "nacionalidad": "V" }
```

No requiere autenticación. Respuesta cuando encuentra a la persona:

```json
{ "data": {
    "primer_nombre": "...", "segundo_nombre": "...",
    "primer_apellido": "...", "segundo_apellido": "...",
    "cedula": "...", "nacionalidad": "V", "fecha_nac": "1990-01-01", "rif": "...",
    "cne": { "estado": "...", "municipio": "...", "parroquia": "...", "centro_electoral": "..." }
} }
```

Cuando no la encuentra: `{"error": true, "data": false, "error_str": "RECORD_NOT_FOUND"}`.

⚠️ **Los datos de `cne` son del registro electoral: dicen dónde VOTA la persona, no dónde vive.**
Suelen estar desactualizados. El usuario pidió expresamente **no** usarlos para autocompletar el
municipio. Del CNE se toman solo **nombre y apellido**.

En Sala Situacional no llames este endpoint a mano: usa `cne-dateas.js` poniendo `data-cne` en el
input, que ya trae el modal, el botón de "dónde vota" y el enlace a Dateas.

### 9.7 Servicios externos menores

**Acortar enlaces (TinyURL, con alias propio):**
```bash
curl -s "https://tinyurl.com/api-create.php?url=<URL_CODIFICADA>&alias=mialias"
```
Devuelve el enlace en texto plano. Ver trampa 10.6 sobre por qué **no** usar da.gd.

**Generar códigos QR** (así los hacen todos los tableros, no hace falta biblioteca):
```
https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<URL_CODIFICADA>
https://api.qrserver.com/v1/create-qr-code/?size=600x600&download=1&data=<URL_CODIFICADA>
```

**Compartir por WhatsApp:**
```
https://wa.me/?text=<TEXTO_CODIFICADO>
```

---

## 10. Trampas conocidas (léelas, todas causaron un error real)

**10.1 — El Excel se descuadra en silencio.** Si los encabezados, las filas y los anchos no tienen
la misma cantidad de elementos, los datos se corren de columna y el archivo sale con la
información equivocada bajo cada título, sin ningún error visible. **Siempre cuenta los tres.**

**10.2 — Las tablas del PDF se salen de la hoja.** El área útil en carta horizontal con los
márgenes de autoTable es de **~251 mm**. Suma los `cellWidth` antes de publicar. Si te pasas,
autoTable no falla: recorta o desborda.

**10.3 — Columnas demasiado angostas parten el texto.** Un teléfono como `0424-1234567` necesita
23 mm; con menos se corta en dos líneas. Los títulos de columna también se parten
("Entrad/a"): déjales al menos 17 mm.

**10.4 — Caracteres invisibles en expresiones regulares.** Escribir `/[\u0300-\u036f]/` con los
caracteres combinantes literales funciona, pero es frágil: cualquier editor puede romperlo.
Usa `\p{Diacritic}` con la bandera `u`, que deja el código en ASCII puro.

**10.5 — Buscar sin considerar mayúsculas.** Buscar `cneDatos` **no encuentra** `setCneDatos`.
Ya causó que quedaran llamadas huérfanas que reventaban el componente. Busca sin distinguir
mayúsculas cuando limpies código muerto.

**10.6 — El acortador da.gd muestra una advertencia.** A los enlaces recién creados les pone una
pantalla de "phishing y abuso" a cada visitante nuevo. En un canal oficial eso espanta a la gente.
**Usa TinyURL con alias con nombre**, que además se puede dictar por teléfono.

**10.7 — Los errores tragados en silencio.** Un `catch (e) {}` vacío al guardar fotos hacía que el
formulario dijera "registrado" aunque la foto nunca subió. **Nunca te tragues un error de guardado:
o lo muestras, o dejas una vía para reintentar.**

**10.8 — Las horas de asistencia engañan.** 19 de los 20 empleados tienen **90 minutos de
tolerancia**. Con entrada pactada a las 7:00, llegar 8:29 cuenta como "a tiempo". Si un reporte
muestra casi cero retardos, es por eso, no porque todos lleguen temprano. Menciónaselo al usuario.

**10.9 — El 68% de los marcajes no tiene hora de salida.** Cualquier cálculo de horas trabajadas
debe advertirlo, no promediar en silencio sobre datos incompletos.

**10.10 — Los textos escritos a mano llegan en variantes.** "ALERGIAS" y "ALERGIA", "ASMATICO" y
"ASMA AGUDA". Al contarlos hay que agrupar por raíz de palabra. **Pero solo lo que es
literalmente lo mismo**: nunca unas dosis ni tamaños distintos (gasa 3x3 ≠ 5x5, losartán 40 mg
y 50 mg son la misma medicina pero distinta presentación). Y muestra siempre el detalle de qué
se agrupó con qué, para que el usuario pueda auditarlo.

**10.11 — Los datos que faltan tienen dueño.** No inventes ni deduzcas datos de personas reales
(sexo a partir del nombre, corregir un apellido, adivinar una cédula). Pregúntale al usuario.

---

## 11. Cómo trabaja el usuario

- Escribe y lee **solo en español**. Explícale las cosas en lenguaje llano, sin tecnicismos
  innecesarios, y cuando uses uno, acláralo.
- Trabaja mucho **desde el teléfono**. Las páginas públicas se llenan en la calle: tienen que
  funcionar bien en pantallas de 375 px.
- Cuando pide un reporte, quiere **todos los datos completos**, no un resumen.
- Espera que **verifiques** lo que entregas, no que se lo entregues para que él lo descubra.
- Cuando encuentres un problema de fondo mientras haces otra cosa, **díselo**, aunque no lo
  haya preguntado. Le ha servido varias veces.
