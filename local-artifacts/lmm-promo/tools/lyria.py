# Stream a Lyria 3 generation from OpenRouter and save the audio.
# usage: python3 lyria.py <prompt.txt> <out_basename> [model] [format]
import json, sys, base64, urllib.request, os, time
prompt = open(sys.argv[1]).read()
out = sys.argv[2]
model = sys.argv[3] if len(sys.argv) > 3 else 'google/lyria-3-pro-preview'
fmt = sys.argv[4] if len(sys.argv) > 4 else 'wav'
key = os.environ['OPENROUTER_API_KEY']  # never commit the key
body = {"model": model, "stream": True, "modalities": ["text", "audio"], "audio": {"format": fmt},
        "messages": [{"role": "user", "content": prompt}]}
req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                             headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
chunks, texts, other = [], [], []
t0 = time.time()
with urllib.request.urlopen(req, timeout=900) as r:
    for raw in r:
        line = raw.decode('utf-8', 'replace').strip()
        if not line.startswith('data:'):
            continue
        data = line[5:].strip()
        if data == '[DONE]':
            break
        try:
            j = json.loads(data)
        except Exception:
            continue
        if 'error' in j:
            print('ERROR', j['error']); break
        for ch in j.get('choices', []):
            d = ch.get('delta', {})
            a = d.get('audio')
            if a and a.get('data'):
                chunks.append(a['data'])
            if a and a.get('transcript'):
                texts.append(a['transcript'])
            if d.get('content'):
                texts.append(d['content'] if isinstance(d['content'], str) else json.dumps(d['content']))
            for k in d:
                if k not in ('audio', 'content', 'role'):
                    other.append((k, str(d[k])[:200]))
        if j.get('usage'):
            print('usage', j['usage'].get('cost'))
audio = b''.join(base64.b64decode(c) for c in chunks)
open(out + '.' + fmt, 'wb').write(audio)
open(out + '.txt', 'w').write(''.join(texts))
print('secs', round(time.time() - t0, 1), 'bytes', len(audio), 'chunks', len(chunks))
print('text:', ''.join(texts)[:1500])
print('other:', other[:10])
