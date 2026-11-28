# PULSO — Coach de conversación

![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma 6](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)
![Tailwind 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

Aplicación web de coaching de conversación asistida por IA. Producto propio,
construido desde cero con identidad propia: no copia apariencia, textos ni
recursos de ningún producto de referencia. Se inspira solo en FUNCIONES.

**Límites del producto (resumen):** Pulso es una herramienta de apoyo. No se
conecta a WhatsApp ni a ninguna red; no escribe por ti; no garantiza
resultados; si la otra persona dice que no o se incomoda, el coach se para.
Mayores de 18. El documento completo de límites está en
`docs/LIMITES.md` y también dentro de la app (pantalla de acceso y ajustes).

---

## Cómo arrancarlo

```bash
# 1. Dependencias
bun install

# 2. Base de datos (SQLite en el sandbox; ver "Modelo de datos")
bun run db:push

# 3. Desarrollo (puerto 3000)
bun run dev
```

- `bun run lint` — ESLint.
- `bun run db:push` — sincroniza el esquema Prisma.
- La app vive en una única ruta (`/`); el backend son rutas API bajo `/api/*`.

## Variables de entorno

| Variable | Defecto | Qué hace |
| --- | --- | --- |
| `DATABASE_URL` | `file:./db/custom.db` | Ubicación de la base SQLite |
| `AI_PROVIDER` | `zai` | `zai` (SDK del entorno, con visión) u `openai` (cualquier endpoint OpenAI-compatible) |
| `OPENAI_API_KEY` | — | Clave cuando `AI_PROVIDER=openai` (solo servidor) |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Endpoint compatible con OpenAI |
| `OPENAI_MODEL` | `gpt-4o-mini` / `gpt-4o` | Modelo rápido por defecto; `gpt-4o` para análisis profundo (`quality: "best"`) |
| `AUTH_SECRET` | `pulso-local-secret-v1` | Firma HMAC de la cookie de sesión (cámbiala en producción) |
| `DAILY_AI_LIMIT` | `40` | Límite de llamadas de IA por usuario y día (plan base) |

**La clave de la IA vive solo en el servidor.** El navegador llama siempre a
`/api/ai` (proxy) y nunca a un proveedor directamente.

## Cómo cambiar de proveedor de IA

Todo pasa por `src/lib/ai/provider.ts`. El adaptador expone
`aiComplete({ messages, images, quality })` y dos implementaciones: `zai`
(por defecto, usa el SDK del entorno con visión) y `openai` (fetch genérico a
un endpoint compatible). Para cambiar proveedor:

1. `AI_PROVIDER=openai` en `.env` (sin cambiar código).
2. Pon `OPENAI_API_KEY` (y opcionalmente `OPENAI_BASE_URL`, `OPENAI_MODEL`).
3. Para añadir un tercero: crea una función `callX(req)` en `provider.ts`,
   únela al switch y documenta la variable. Nada más depende de la marca.

## Despliegue en Vercel

La app se despliega en Vercel sin cambiar código de la app, con dos ajustes:

**1. Base de datos: SQLite no persiste en Vercel.** El filesystem de las
funciones serverless es efímero: la base `file:./db/custom.db` se vaciaría en
cada despliegue. Para producción, migra Prisma a una base gestionada:

1. Crea una base Postgres (Neon, Supabase o Vercel Postgres — todos con plan
   gratuito).
2. En `prisma/schema.prisma` cambia `provider = "sqlite"` por
   `provider = "postgresql"`.
3. Usa la cadena de conexión del proveedor como `DATABASE_URL`.
4. Crea las tablas una sola vez, desde tu máquina:
   `DATABASE_URL="<cadena>" npx prisma db push`.

**2. Proveedor de IA en producción.** En Vercel usa
`AI_PROVIDER=openai` con `OPENAI_API_KEY` propia (cualquier endpoint
compatible con OpenAI sirve: OpenAI, OpenRouter, Groq...). El adaptador
`zai` está pensado para el entorno del sandbox.

**Pasos en Vercel:**

1. Repo en GitHub: `github.com/ALBRA8/CONQUISTADOR`.
2. Vercel → *Add New... → Project* → importa el repo.
3. En *Settings → Build & Output Settings*, pon como *Build Command*
   `next build` (el paso extra de `cp` del script `build` local es solo para
   autoalojamiento con `output: "standalone"`).
4. En *Environment Variables*, añade:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | cadena de conexión Postgres |
   | `AUTH_SECRET` | secreto largo y aleatorio (obligatorio en producción) |
   | `AI_PROVIDER` | `openai` |
   | `OPENAI_API_KEY` | tu clave del proveedor de IA |
   | `OPENAI_BASE_URL` | solo si el endpoint no es el estándar de OpenAI |
   | `OPENAI_MODEL` | opcional; por defecto `gpt-4o-mini` |
   | `DAILY_AI_LIMIT` | opcional; por defecto `40` |

5. Deploy. El cliente Prisma se genera en la instalación
   (`postinstall: prisma generate`).

**Correo del OTP:** en producción el código de acceso se muestra en pantalla
(modo demo, ver "Autenticación"). Antes de abrir a usuarios reales, conecta
el envío real por SMTP/SMS en `POST /api/auth/request-code`; el resto del
flujo de sesión no cambia.

## Autenticación (decisión documentada)

Acceso sin contraseña por código de un solo uso (OTP de 6 dígitos, 15 min,
máx. 3 códigos/15 min y 5 intentos por código). **Este sandbox no envía
correos reales**, así que el código se devuelve en la respuesta de
`POST /api/auth/request-code` y se muestra en pantalla ("Modo demo"). En
producción se sustituye por envío SMTP/SMS sin tocar el resto del flujo.
La sesión es una cookie httpOnly firmada con HMAC (30 días). En el registro
se exigen dos casillas: mayor de edad y aceptación de las reglas de uso.

## Modelo de datos

SQLite por medio de Prisma (esquema portable a Postgres cambiando
`provider = "postgresql"` en `prisma/schema.prisma`). El acceso por fila se
garantiza en la capa de API: cada consulta filtra por `userId` de la sesión.

```
User          cuenta, consentimiento, cuota diaria, preferencias
LoginCode     códigos OTP de un solo uso
Woman         ficha (nombre, edad, ciudad, foto, arquetipo, interés, etapa, teléfono, canal, notas, estado)
Message       mensajes (emisor me|her, texto, fecha/hora, origen manual|screenshot|txt_import, confianza)
Analysis      radiografías, perfiles y análisis profundos (métricas en JSON)
CoachThread   hilo de coach por persona (protocolo activo + paso)
CoachTurn     turnos del coach (contenido, bloques, prompt enviado, modelo, tokens)
Suggestion    mensajes entregados por el coach (marcado como enviado + resultado)
DateEntry     citas (fecha, lugar, estado, informe previo, resumen posterior)
Achievement   medallas (código, evidencia, verificación)
AuditLog      acciones del usuario (exportable)
DeletionLog   nota anónima de cuentas borradas (queda tras el borrado)
```

## Rutas API

```
POST /api/auth/request-code   pide código OTP (demo: lo devuelve)
POST /api/auth/verify         verifica código y crea sesión/cuenta
POST /api/auth/logout         cierra sesión
GET  /api/me                  usuario + cuota + métricas medidas
GET/POST   /api/women         lista (orden "necesitan acción hoy") / crear ficha
GET/PATCH/DELETE /api/women/[id]     ficha + historial + hilo / editar / archivar
GET/POST   /api/women/[id]/messages   mensajes de una ficha / añadir a mano
POST  /api/women/[id]/messages/invert  invertir emisores (todo o rango)
PATCH/DELETE /api/messages/[id]      editar / cambiar emisor / borrar mensaje
POST /api/import/txt          parseo LOCAL de .txt de WhatsApp (sin IA)
POST /api/import/screenshots  extracción con IA de visión (capturas)
POST /api/import/save         guarda lista confirmada, sin duplicados
POST /api/ai                  proxy de IA: coach, analyze, options, deep, profile,
                              planner, simulate, date_brief, date_debrief, in_date,
                              first_messages, tone, moderate, achievement_verify, diagnostic
GET/POST   /api/dates         citas / agendar
PATCH/DELETE /api/dates/[id]  estado de cita
GET/PATCH  /api/suggestions   marcar como enviado / resultado
GET/POST/PUT /api/achievements medallas + reclamación con evidencia
GET  /api/export?format=json|csv   exportar todo
DELETE /api/account           borrar cuenta y datos (requiere escribir "BORRAR")
PATCH /api/settings           idioma, tono, longitud, fin de onboarding
```

## Reglas técnicas implementadas

- Límite diario de IA por usuario (40/día por defecto) con mensaje claro al agotarse.
- Toda salida de IA que se pinta como tarjeta se pide en JSON con esquema;
  si falla, **un** reintento con el error incluido en el prompt y luego
  degradación a texto o error humano (nunca un volcado técnico).
- Respuestas del coach en cinco etiquetas fijas (`[LECTURA] [ACCION]
  [MENSAJE] [HORA] [SI]`) que el servidor parsea en tarjetas; los marcadores
  internos de fase (`[FASE n]`) se consumen y **jamás** se muestran.
- Validación de longitud de los mensajes sugeridos en el servidor; si se
  pasa, se pide acortar una vez antes de mostrar.
- Historial recortado: últimos 16 mensajes completos (modo normal) o 80
  (análisis); los viejos se resumen con su primera parte.
- Moderación en dos capas: regex local (rápida, gratis) + reglas en el
  prompt del coach. Ante coerción, insistencia tras rechazo, menores o
  agresividad: tarjeta de parada y fin.
- Detector de protocolos por regex bilingüe (no IA) + fases persistidas:
  salir y volver no pierde el punto.
- Registro del prompt enviado y la respuesta en `CoachTurn.promptSent`
  (depuración), dentro del borrado real de la cuenta.

## Estructura del código

```
src/lib/ai/            provider (adaptador dual), instrucciones propias del coach,
                       protocolos, moderador, constructor de prompts (7 piezas), parser de bloques
src/lib/import/        parseador local de .txt de WhatsApp
src/lib/               sesión, helpers de API (cuota, auditoría), stats "medido en tu cuenta", logros
src/app/api/           rutas del backend
src/components/pulso/  vistas (acceso, onboarding, contactos, ficha, conversación,
                       importación, coach, hoy, citas, herramientas, medallas, ajustes)
docs/                  entrega: checklist, casos de prueba, decisiones, límites
```
