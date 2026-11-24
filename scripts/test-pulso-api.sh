#!/bin/bash
# Prueba de flujo completo de la API de Pulso con usuario de prueba
set -e
BASE="http://localhost:3000"
JAR="/tmp/pulso-test-cookies.txt"
rm -f "$JAR"

echo "=== 1. Health ==="
curl -s "$BASE/api" | head -c 200; echo

echo "=== 2. Pedir código OTP (mayor de edad + consentimiento) ==="
RES=$(curl -s -c "$JAR" -X POST "$BASE/api/auth/request-code" -H 'Content-Type: application/json' \
  -d '{"email":"pulso-test@demo.com","ageOk":true,"consentOk":true}')
echo "$RES"
CODE=$(echo "$RES" | python3 -c "import sys,json;print(json.load(sys.stdin)['demoCode'])")

echo "=== 3. Verificar código -> sesión ==="
curl -s -c "$JAR" -X POST "$BASE/api/auth/verify" -H 'Content-Type: application/json' \
  -d "{\"email\":\"pulso-test@demo.com\",\"code\":\"$CODE\"}"; echo

echo "=== 4. /api/me ==="
curl -s -b "$JAR" "$BASE/api/me" | python3 -m json.tool | head -25

echo "=== 5. Crear ficha ==="
curl -s -b "$JAR" -X POST "$BASE/api/women" -H 'Content-Type: application/json' \
  -d '{"name":"Camila","age":27,"city":"Bogotá","occupation":"Diseñadora","metWhere":"Por amigos en un concierto","channel":"noche","phone":"+573001234567","notes":"Le gusta el cine de terror y el ramen"}'; echo

WID=$(curl -s -b "$JAR" "$BASE/api/women" | python3 -c "import sys,json;print(json.load(sys.stdin)['women'][0]['id'])")
echo "womanId=$WID"

echo "=== 6. Añadir mensajes manualmente ==="
curl -s -b "$JAR" -X POST "$BASE/api/women/$WID/messages" -H 'Content-Type: application/json' -d '{"messages":[
  {"sender":"me","body":"Conseguiste el ramen secreto que te dijeron o sigo siendo el único que lo ha probado?","sentAt":"2026-11-24T21:30:00"},
  {"sender":"her","body":"jajaja qué vanidad, cuál es la dirección de ese lugar entonces","sentAt":"2026-11-24T21:37:00"},
  {"sender":"me","body":"te lo paso, pero con condición: me cuentas si le ganó al de tu abuela","sentAt":"2026-11-24T21:39:00"},
  {"sender":"her","body":"hecho, acepto el reto. vamos el jueves?","sentAt":"2026-11-24T21:45:00"}
]}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('guardados:',len(d['messages']))"

echo "=== 7. Parseo .txt de WhatsApp ==="
python3 - <<'PYEOF'
import json, urllib.request
text = open('/tmp/wa.txt').read() if False else "24/11/26, 21:30 - Yo: hola que tal\n24/11/26, 21:32 - Ella: bien y tu\n24/11/26, 21:40 - Yo: vamos por un cafe\n"
jar = open('/tmp/pulso-test-cookies.txt').read()
cookie = [l.split()[-2]+'='+l.split()[-1] for l in jar.splitlines() if 'pulso_session' in l][0]
req = urllib.request.Request('http://localhost:3000/api/import/txt', data=json.dumps({'text': text}).encode(), headers={'Content-Type':'application/json','Cookie':cookie})
print(json.dumps(json.load(urllib.request.urlopen(req)), indent=1)[:600])
PYEOF

echo "=== 8. Guardar importados (dedupe) ==="
curl -s -b "$JAR" -X POST "$BASE/api/import/save" -H 'Content-Type: application/json' \
  -d "{\"womanId\":\"$WID\",\"source\":\"txt_import\",\"authorMap\":{\"Yo\":\"me\",\"Ella\":\"her\"},\"messages\":[{\"sender\":\"me\",\"body\":\"hola que tal\",\"sentAt\":\"2026-11-24T21:30:00\"},{\"sender\":\"her\",\"body\":\"bien y tu\",\"sentAt\":\"2026-11-24T21:32:00\"},{\"sender\":\"me\",\"body\":\"vamos por un cafe\",\"sentAt\":\"2026-11-24T21:40:00\"},{\"sender\":\"me\",\"body\":\"Conseguiste el ramen secreto que te dijeron o sigo siendo el único que lo ha probado?\",\"sentAt\":\"2026-11-24T21:30:00\"}]}" | python3 -c "import sys,json;d=json.load(sys.stdin);print('added:',d.get('added'),'total:',len(d.get('messages',[])))"

echo "=== 9. Invertir emisores (rango) y revertir ==="
curl -s -b "$JAR" -X POST "$BASE/api/women/$WID/messages/invert" -H 'Content-Type: application/json' -d '{"fromIndex":6,"toIndex":7}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('inverted:',d.get('inverted'))"
curl -s -b "$JAR" -X POST "$BASE/api/women/$WID/messages/invert" -H 'Content-Type: application/json' -d '{"fromIndex":6,"toIndex":7}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('re-inverted:',d.get('inverted'))"

echo "=== 10. COACH (IA real) ==="
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d "{\"action\":\"coach\",\"womanId\":\"$WID\",\"message\":\"ella me propuso vernos el jueves por el ramen, que hago\"}" \
  --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
b=d.get('blocks',{})
print('LECTURA:',(b.get('lectura') or '')[:150])
print('ACCION:',(b.get('accion') or '')[:150])
print('MENSAJE:',(b.get('mensaje') or '')[:150])
print('HORA:',b.get('hora'))
print('SI:',(b.get('si') or '')[:150])
print('thread:',d.get('thread'))
"

echo "=== 11. RADIOGRAFÍA ==="
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d "{\"action\":\"analyze\",\"womanId\":\"$WID\"}" --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
m=d.get('metrics',{})
print({k:m.get(k) for k in ['interes','atraccion','estado','tendencia','momento_cita']})
print('motivo:',(m.get('motivo') or '')[:160])
"

echo "=== 12. 3 OPCIONES ==="
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d "{\"action\":\"options\",\"womanId\":\"$WID\"}" --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
for o in d.get('opciones',[]):
    print('-',o.get('tipo'),'|',(o.get('texto') or '')[:60],'| chars:',o.get('caracteres'))
"

echo "=== 13. Moderación: mensaje coercitivo ==="
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d "{\"action\":\"coach\",\"womanId\":\"$WID\",\"message\":\"si no contesta voy a ir a su casa a hablar directo\"}" \
  --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
b=d.get('blocks',{})
print('ALTO:',b.get('alto'),'motivo:',(b.get('motivoAlto') or '')[:120])
"

echo "=== 14. Agendar cita + informe previo ==="
DID=$(curl -s -b "$JAR" -X POST "$BASE/api/dates" -H 'Content-Type: application/json' \
  -d "{\"womanId\":\"$WID\",\"scheduledAt\":\"2026-11-27T20:00:00\",\"place\":\"El ramen del barrio\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['date']['id'])")
echo "dateId=$DID"
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d "{\"action\":\"date_brief\",\"dateId\":\"$DID\"}" --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
b=d.get('briefing',{})
print('tono:',(b.get('tono') or '')[:100])
print('frase:',(b.get('frase') or '')[:100])
"

echo "=== 15. Logros ==="
curl -s -b "$JAR" "$BASE/api/achievements" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print('level:',d['level'])
print('medallas:',[a['code'] for a in d['achievements']])
"

echo "=== 16. Export JSON ==="
curl -s -b "$JAR" "$BASE/api/export" --max-time 30 -o /tmp/pulso-export.json && python3 -c "import json;d=json.load(open('/tmp/pulso-export.json'));print('claves:',list(d.keys())[:8],'fichas:',len(d['fichas']))"

echo "=== 17. Export CSV ==="
curl -s -b "$JAR" "$BASE/api/export?format=csv" --max-time 30 | head -8

echo "=== 18. Planificador ==="
curl -s -b "$JAR" -X POST "$BASE/api/ai" -H 'Content-Type: application/json' \
  -d '{"action":"planner"}' --max-time 90 | python3 -c "
import sys,json
d=json.load(sys.stdin)
for a in d.get('acciones',[]):
    print('-',a.get('mujer'),'|',a.get('tipo'),'|',(a.get('diagnostico') or '')[:80])
"

echo "=== FIN PRUEBAS (sin borrar cuenta, para poder seguir en el navegador) ==="
