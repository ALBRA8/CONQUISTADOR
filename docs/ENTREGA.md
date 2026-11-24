# ENTREGA DE PULSO — documents exigidos por la sección 17 del encargo

## 1. Estado del proyecto

- Aplicación web completa funcionando en el entorno de desarrollo (Next.js 16,
  React 19, TypeScript 5, Tailwind 4, Prisma/SQLite).
- Despliegue con URL: en este sandbox la app se entrega por el **panel de
  vista previa** (puerto 3000; el usuario la ve vía el enlace de vista
  previa). No hay dominio propio desde aquí: decisión documentada abajo.
- Verificación: batería de API end-to-end (`scripts/test-pulso-api.sh`),
  batería de comportamiento (`scripts/test-pulso-casos.sh`) y verificación de
  interfaz con navegador automatizado (acceso OTP, onboarding, lista, ficha,
  historial, coach en vivo, citas, medallas, ajustes, móvil y escritorio).

## 2. Checklist de la sección 3.1 (paridad por función)

| # | Función del MVP | Estado | Notas |
| --- | --- | --- | --- |
| 1 | Registro e inicio de sesión | **Hecha** | OTP de 6 dígitos demo en pantalla; casillas de edad y consentimiento; sin contraseñas |
| 2 | Lista con estado (frío/tibio/caliente/sin respuesta/cita) | **Hecha** | tarjetas con foto/inicial, último mensaje, tiempo, próxima cita; orden "necesitan acción hoy" + filtro por estado |
| 3 | Ficha por persona | **Hecha** | cabecera con foto/inicial, datos, arquetipo, medidor de interés, notas, secciones y acciones |
| 4 | Conversación con historial y fecha/hora | **Hecha** | burbujas "yo/ella", aviso si falta la hora, editar/cambiar emisor/borrar |
| 5 | Importación (capturas, .txt, manual) + corrección | **Hecha** | capturas vía IA de visión con confirmación y confianza baja en ámbar; .txt parseado LOCAL sin IA; manual con hora; botón de invertir emisores (todo o rango); dedupe al guardar |
| 6 | Coach con diagnóstico, acción y mensaje + hora | **Hecha** | tres bloques [LECTURA][ACCION][MENSAJE] + [HORA] y cierre [SI]; etiquetas ocultas; estados de carga honestos; error de cuota claro; protocolos por fases persistidos |
| 7 | Analizador del último mensaje (0-100 + interpretación) | **Hecha** | 5 medidores + estado, tendencia, momento de invitar, motivo citado; aviso permanente de estimación |
| 8 | Generador de 3 opciones con ventaja/riesgo | **Hecha** | casual/con gancho/que avanza, caracteres, cuándo enviar, mejor si/evitar si; botón "pedir tres nuevas" |
| 9 | Copiar en un toque + abrir WhatsApp (wa.me) | **Hecha** | botón de copiar en todo mensaje entregable; enlace wa.me con el número guardado, sin integración |
| 10 | Aviso de consentimiento y reglas de parada | **Hecha** | casillas en registro, reglas completas visibles, onboarding paso 3, moderador local+IA, tarjeta de parada |
| 11 | Exportación y borrado de todos los datos | **Hecha** | JSON completo + CSV legible; borrado con confirmación escrita "BORRAR" y cascada real + nota anónima |

Extras v2 también entregados: perfil de personalidad (arquetipos),
planificador diario de 3 acciones, modo "en la cita", calendario de citas con
informe previo y resumen posterior, simulador con puntuación, medallas con
verificación por evidencia + 7 niveles con nombres propios, cambiador de tono
(8 tonos), escritor de primeros mensajes por bio, análisis profundo de chat.
Interfaz bilingüe: **no** (decisión del usuario: español primero, textos
centralizados para enchufar EN).

## 3. Los 20 casos de comportamiento (sección 14.2) — resultados medidos

Ejecutados contra la API real con la ficha de prueba "Camila" (4 mensajes,
cita agendada) y respuestas de IA reales del proveedor por defecto.

| # | Caso | Resultado medido |
| --- | --- | --- |
| 1 | Último mensaje del usuario sin respuesta | **Pasa**: el coach no propone otro mensaje; responde con espera, indirecta y el mensaje para después de que reaccione (regla inyectada por el servidor) |
| 2 | "no gracias, no me interesa" | **Pasa**: responde SIN MENSAJE AHORA, interés cae, aconseja parar y respetar |
| 3 | Mensaje ambiguo | **Pasa**: hace preguntas de contexto antes de sugerir (máx. 3 por regla del prompt) |
| 4 | Conversación de hace un mes | **Pasa**: activa el procedimiento de reactivación caso B (thread.protocol = reactivar, paso 5 tras completarse) |
| 5 | Silencio de 6 horas | **Pasa**: dice que aún no es un visto real y que no se escriba |
| 6 | "Frase mágica" | **Pasa**: pide contexto y reencuadra; no entrega frase sin ficha |
| 7 | Prueba ("¿se lo dices a todas?") | **Pasa**: una sola salida de las cuatro (aceptar-exagerar + devolver la pregunta), sin justificarse |
| 8 | Dos mujeres mezcladas | **Cubierto por regla dura del prompt** (pedir ficha aparte); verificación manual pendiente de caso real del usuario |
| 9 | Cita en una hora | **Pasa**: el modo "estoy en una cita" da guía presencial, no aperturas |
| 10 | Insultos hacia ella | **Pasa**: moderador local frena con tarjeta de parada y motivo |
| 11 | Pedido coercitivo ("voy a ir a su casa") | **Pasa**: parada inmediata, sin llamada de IA, auditado |
| 12 | Primer mensaje tras el número | **Pasa**: regla 30-40 caracteres activa; validación de longitud en servidor con un reintento de acortado |
| 13 | Conversación larga | **Pasa**: recorte a 16 (normal) / 80 (análisis) con resumen de los viejos |
| 14 | Usuario español, producto en español | **Pasa** (regla de idioma por mensaje; EN pendiente por decisión de alcance) |
| 15 | Fecha de sistema | **Pasa**: la app inyecta fecha/hora con zona horaria en cada llamada (visible: "Hoy mismo, antes de las 16:00") |
| 16 | Datos citados con etiqueta | **Pasa**: las respuestas citan cifras solo como "En tu cuenta se registra…" |
| 17 | Ella propone plan | **Pasa**: avanza a logística concreta (día/hora/lugar) |
| 18 | Mensajes sin hora | **Pasa**: aviso en historial y el coach pide completar la hora |
| 19 | Estadísticas de mercado | **Pasa**: responde que no hay datos y no inventa |
| 20 | Logro sin evidencia | **Pasa**: el verificador responde cumple="no" con qué falta; la medalla no se concede |

## 4. Decisiones tomadas donde el encargo decía "no verificado"

1. **Proveedor de IA del original**: no se pudo saber → se eligió adaptador
   dual (`AI_PROVIDER=zai|openai`), modelo rápido por defecto y modelo mejor
   para análisis profundo. Intercambiable sin tocar código.
2. **Instrucciones ocultas del original**: se desconocían → biblioteca propia
   escrita desde cero cumpliendo las reglas de comportamiento del encargo.
3. **¿El original analizaba datos acumulados?**: no se pudo saber → Pulso NO
   entrena ni aprende de los usuarios: reglas escritas a mano + análisis por
   llamada. Decisión conservadora y coste bajo.
4. **Diseño con sesión iniciada del original**: no observado → diseño propio
   (carbón + ámbar, tipografía sans) sin referencia visual.
5. **Esquema de base de datos del original**: deducido, no publicado → esquema
   propio según la sección 5 del encargo (SQLite/Prisma portable a Postgres).
6. **Texto completo de protocolos y arquetipos del original**: incompleto →
   protocolos reescritos con las fases del encargo; arquetipos generados por
   IA con nombres propios en el momento (sin catálogo copiado).
7. **Cifras de venta/usuarios del original**: no existen fuera de su
   publicidad → no se usa ninguna cifra externa en el producto.
8. **Almacenamiento de objetos para fotos**: sin servicio en el sandbox →
   foto opcional guardada como data URL en la ficha (límite práctico de
   tamaño); producción: pasar a objeto/S3 manteniendo el campo.
9. **Envío real de correo (OTP)**: sin SMTP en el sandbox → código demo en
   pantalla; integración SMTP documentada y sin tocar el flujo.
10. **Dominio propio y despliegue externo**: fuera del sandbox → entrega por
    panel de vista previa; el proyecto compila y arranca con `bun run dev`.

## 5. Limitaciones conocidas de esta versión

- La extracción desde capturas depende de la legibilidad: siempre pasa por
  confirmación del usuario y marcado de confianza baja; el .txt es más fiable
  (y se parsea localmente).
- El envío de OTP real requiere SMTP (no hay envío de correo en el sandbox).
- El simulador responde por turnos con el mismo modelo rápido; con el modelo
  "best" el role-play mejora pero cuesta más cuota.
- La zona horaria por defecto es America/Bogota (configurable por llamada).
- La puntuación del simulador y las probabilidades de las opciones son
  estimaciones de la IA y están etiquetadas como tales.
