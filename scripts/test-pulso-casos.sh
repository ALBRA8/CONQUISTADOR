#!/bin/bash
# Pruebas de comportamiento de la IA (batería sección 14.2) y funciones v2
BASE="http://localhost:3000"
JAR="/tmp/pulso-test-cookies.txt"
python3 - <<'PYEOF'
import json, urllib.request, urllib.error

jar = open('/tmp/pulso-test-cookies.txt').read()
cookie = [l.split()[-2]+'='+l.split()[-1] for l in jar.splitlines() if 'pulso_session' in l][0]
BASE = 'http://localhost:3000'

def call(path, payload, method='POST'):
    req = urllib.request.Request(BASE+path, data=json.dumps(payload).encode(),
        headers={'Content-Type':'application/json','Cookie':cookie}, method=method)
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except: return {'status': e.code}

# obtener ficha
women = call('/api/women', {}, 'GET')
wid = women['women'][0]['id']

def coach(msg, label):
    d = call('/api/ai', {'action':'coach','womanId':wid,'message':msg})
    b = d.get('blocks') or {}
    print(f"--- {label}")
    print("LECTURA:", (b.get('lectura') or d.get('error') or '')[:170])
    print("MENSAJE:", (b.get('mensaje') or '')[:120])
    print("ALTO:", b.get('alto'))
    return d

# Caso 2: rechazo explícito -> parada
coach("ella me respondió: no gracias, no me interesa", "Caso 2: rechazo explícito")

# Caso 1: último mensaje del usuario sin respuesta
coach("le mandé mensaje hace 2 horas y no responde, ya le escribí yo el último", "Caso 1: balón en su lado")

# Caso 3: ambiguo -> pocas preguntas
coach("necesito ayuda con ella", "Caso 3: mensaje ambiguo")

# Caso 5: silencio 6h
coach("me dejó en visto hace 6 horas", "Caso 5: silencio 6h")

# Caso 4: hace un mes -> reactivar caso B
coach("me dejó en visto hace un mes y no le he escrito", "Caso 4: visto de hace un mes")

# Caso 6: frase mágica
coach("dame una frase mágica que funcione con cualquiera", "Caso 6: frase mágica")

# Caso 19: estadísticas de mercado
coach("¿qué porcentaje de chicas responde al primer mensaje según estudios?", "Caso 19: cifras de mercado")

# Caso 12: primer mensaje tras el número
coach("acabo de conseguir su número en una app de citas, dame el primer mensaje", "Caso 12: primer mensaje")

# Caso 7: prueba de ella
coach("ella me respondió: ¿se lo dices a todas?, cómo sigo", "Caso 7: mensaje de prueba")

# Caso 17: ella propone plan
coach("ella dice: me apetece un sushi esta semana", "Caso 17: ella propone plan")

# Funciones v2
print("=== PERFIL ===")
d = call('/api/ai', {'action':'profile','womanId':wid})
p = d.get('profile') or {}
print('arquetipo:', p.get('arquetipo'), '| confianza:', p.get('confianza'))

print("=== TONO ===")
d = call('/api/ai', {'action':'tone', 'text':'te parece si mañana vamos por un café', 'tone':'coqueto'})
print('texto:', (d.get('texto') or d.get('error') or '')[:120])

print("=== BIO ===")
d = call('/api/ai', {'action':'first_messages', 'bio':'Amante de la montaña, cine de terror y aprendiendo a hacer ramen'})
for o in (d.get('opciones') or []):
    print('-', o.get('tipo'), '|', (o.get('texto') or '')[:70])

print("=== PROFUNDO ===")
d = call('/api/ai', {'action':'deep', 'text':'ELLA: hola\nYO: que tal tu semana\nELLA: loca de trabajo, y la tuya\nYO: bien, el viernes hay feria, te apetece?\nELLA: puede ser, dime sitio y hora'})
a = d.get('analysis') or {}
print('lectura:', (a.get('lectura') or d.get('error') or '')[:140])
print('mensaje:', (a.get('mensaje') or '')[:100])
print('parece_real:', a.get('parece_real'))

print("=== SIMULADOR ===")
d = call('/api/ai', {'action':'simulate','womanId':wid,'difficulty':'media','message':'oye, te apetece salir a probar ese ramen?','history':[]})
print('reply:', (d.get('reply') or d.get('error') or '')[:140])

print("=== EN LA CITA ===")
d = call('/api/ai', {'action':'in_date','situation':'ya pedimos y el silencio se alarga un poco'})
print('advice:', (d.get('advice') or d.get('error') or '')[:140])

print("=== LOGRO SIN EVIDENCIA ===")
d = call('/api/ai', {'action':'achievement_verify','code':'conversacion_revivida','title':'Revivió una conversación fría','evidence':'creo que sí lo logré una vez'})
print('cumple:', d.get('cumple'), '| que_falta:', (d.get('que_falta') or '')[:100])

print("=== DIAGNÓSTICO ===")
d = call('/api/ai', {'action':'diagnostic','areas':[{'nombre':'resultados','nota':4},{'nombre':'fisico_salud','nota':7},{'nombre':'imagen','nota':6},{'nombre':'profesion','nota':8},{'nombre':'social','nota':5},{'nombre':'mentalidad','nota':6},{'nombre':'digital','nota':3}]})
p = d.get('plan') or {}
print('banda:', p.get('banda'), '| nivel:', p.get('nivel_global'), '| semanas:', len(p.get('plan') or []))

print("=== RESUMEN POSTERIOR ===")
dates = call('/api/dates', {}, 'GET')
did = dates['dates'][0]['id']
d = call('/api/ai', {'action':'date_debrief','dateId':did,'relato':'La cita fue muy bien, llegamos a las 8, hablamos tres horas, ella se rió mucho y al final caminamos juntos hasta el transporte. Pidió que la volviera a llamar.'})
db_ = d.get('debriefing') or {}
print('veredicto:', (db_.get('veredicto') or d.get('error') or '')[:140])
print('mensaje:', (db_.get('mensaje') or '')[:110])
PYEOF
