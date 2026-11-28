#!/bin/bash
# Test E2E del fix de importación .txt (bug "no pasa nada" + emisores + horario p. m.)
set -e
BASE="http://localhost:3000"
JAR="/tmp/pulso-import-test-cookies.txt"
EMAIL="test-import@pulso.local"

echo "== 1. OTP demo =="
CODE=$(curl -s -X POST "$BASE/api/auth/request-code" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"ageOk\":true,\"consentOk\":true}" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('demoCode') or '')")
if [ -z "$CODE" ]; then echo "FAIL: no devolvió código"; exit 1; fi
echo "código obtenido: $CODE"

echo "== 2. Verificar sesión =="
curl -s -c "$JAR" -X POST "$BASE/api/auth/verify" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"code\":\"$CODE\"}" | python3 -c "import sys,json;d=json.load(sys.stdin);print('user:', d.get('user',{}).get('email') or d)"

echo "== 3. Crear ficha Deicy Perez =="
WOMAN_ID=$(curl -s -b "$JAR" -X POST "$BASE/api/women" -H "Content-Type: application/json" \
  -d '{"name":"Deicy Perez","age":27,"city":"Bogotá","channel":"WhatsApp"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('woman',d).get('id',''))")
echo "womanId: $WOMAN_ID"
if [ -z "$WOMAN_ID" ]; then echo "FAIL: no womanId"; exit 1; fi

echo "== 4. Parsear .txt formato es-CO con p. m. =="
cat > /tmp/chat-test.txt <<'EOF'
Los mensajes y las llamadas están cifrados de extremo a extremo. Nadie fuera de este chat puede leerlos ni enviarles mensajes.
02 ene. 2025, 3:37 p. m. - Johan Bravo: Eliminaste este mensaje.
05 ene. 2025, 11:21 p. m. - Deicy Perez: Yo sigo sin entender el por que tu adiós!!
26 ene. 2025, 2:31 a. m. - Deicy Perez: Hola mi vida
22 feb. 2025, 6:59 p. m. - Johan Bravo: Vida mía
22 feb. 2025, 7:03 p. m. - Deicy Perez: Hoy si será el día que corresponda mi saludo?
22 feb. 2025, 7:05 p. m. - Deicy Perez: Siempre me deja en azul la verdad
y sigo esperando que me de un espacio de explicación
EOF
python3 - <<'PYEOF'
import json
text = open('/tmp/chat-test.txt').read()
json.dump({"text": text}, open('/tmp/txt-payload.json','w'))
PYEOF
PARSE=$(curl -s -b "$JAR" -X POST "$BASE/api/import/txt" -H "Content-Type: application/json" -d @/tmp/txt-payload.json)
echo "$PARSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('authors:', d.get('authors'))
print('mensajes:', len(d.get('messages', [])))
for m in d.get('messages', []):
    print(' ', m['sender'], '|', m['sentAt'], '|', m['body'][:50].replace(chr(10),' / '))
"
echo "$PARSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert len(d.get('messages', [])) == 6, 'FAIL: se esperaban 6 mensajes'
assert d.get('authors') == ['Johan Bravo', 'Deicy Perez'], 'FAIL: autores mal'
json.dump(d, open('/tmp/parsed.json','w'))
print('OK parseo')
"

echo "== 5. Guardar como Johan Bravo (yo) =="
echo "{\"id\":\"$WOMAN_ID\"}" > /tmp/woman_id.json
python3 - <<'PYEOF'
import json
d = json.load(open('/tmp/parsed.json'))
me = "Johan Bravo"
author_map = {a: ("me" if a == me else "her") for a in d["authors"]}
msgs = [{"sender": ("me" if m["sender"] == me else "her"), "author": m["sender"], "body": m["body"], "sentAt": m["sentAt"]} for m in d["messages"]]
json.dump({"womanId": json.load(open('/tmp/woman_id.json'))["id"], "source": "txt_import", "authorMap": author_map, "messages": msgs}, open('/tmp/save-payload.json','w'))
print("authorMap:", author_map)
PYEOF
SAVE=$(curl -s -b "$JAR" -X POST "$BASE/api/import/save" -H "Content-Type: application/json" -d @/tmp/save-payload.json)
echo "$SAVE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('added:', d.get('added'))
assert d.get('added') == 6, 'FAIL: esperados 6 añadidos'
print('OK guardado')
"

echo "== 6. Verificar emisores y horas en DB =="
node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
(async()=>{
  const msgs=await p.message.findMany({where:{womanId:'$WOMAN_ID'},orderBy:{sentAt:'asc'}});
  for(const m of msgs){
    const h=m.sentAt ? m.sentAt.toISOString().slice(11,16)+' Z' : 'sin hora';
    console.log(m.sender.padEnd(4),'|',h,'|',m.body.slice(0,45).replace(/\n/g,' / '));
  }
  const me=msgs.filter(m=>m.sender==='me').length;
  const her=msgs.filter(m=>m.sender==='her').length;
  console.log('YO:',me,'| ELLA:',her);
  if(me!==2||her!==4){console.error('FAIL: emisores mal');process.exit(1)}
  const t=msgs.map(m=>m.sentAt?m.sentAt.toISOString().slice(11,16):'');
  console.log('horas:',t.join(', '));
  // 3:37 p. m. -> 15:37 (no 03:37); 11:21 p. m. -> 23:21; 2:31 a. m. -> 02:31
  if(!t.includes('15:37')||!t.includes('23:21')||!t.includes('02:31')){console.error('FAIL: ajuste p. m./a. m. mal');process.exit(1)}
  if(!msgs[5].body.includes('espacio de explicación')){console.error('FAIL: línea continuada no se unió');process.exit(1)}
  console.log('OK emisores + horario p. m. + multilinea');
  await p.\$disconnect();
})().catch(e=>{console.error('DB ERR',e.message);process.exit(1)});
"

echo "== 7. Re-guardar = mismos mensajes -> dedupe =="
SAVE2=$(curl -s -b "$JAR" -X POST "$BASE/api/import/save" -H "Content-Type: application/json" -d @/tmp/save-payload.json)
echo "$SAVE2" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('added') == 0, 'FAIL: dedupe no funciona'
print('OK dedupe (added: 0)')
"

echo "== 8. Fallback: sender con NOMBRE crudo + authorMap (compatibilidad) =="
python3 - <<'PYEOF'
import json
d = json.load(open('/tmp/parsed.json'))
author_map = {"Johan Bravo": "me", "Deicy Perez": "her"}
msgs = [{"sender": m["sender"], "body": "[X] " + m["body"], "sentAt": m["sentAt"]} for m in d["messages"]]
p = json.load(open('/tmp/save-payload.json'))
p["messages"] = msgs
json.dump(p, open('/tmp/save-payload2.json','w'))
PYEOF
SAVE3=$(curl -s -b "$JAR" -X POST "$BASE/api/import/save" -H "Content-Type: application/json" -d @/tmp/save-payload2.json)
echo "$SAVE3" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('added:', d.get('added'))
me = [m for m in d.get('messages',[]) if m['sender']=='me' and m['body'].startswith('[X]')]
her = [m for m in d.get('messages',[]) if m['sender']=='her' and m['body'].startswith('[X]')]
assert len(me) == 2 and len(her) == 4, f'FAIL fallback: me={len(me)} her={len(her)}'
print('OK fallback authorMap con nombre crudo (2 YO / 4 ELLA)')
"

echo
echo "TODOS LOS TESTS PASARON"
