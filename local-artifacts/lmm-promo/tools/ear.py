# Ask an audio/video-capable model about media files.
# usage: python3 ear.py "<prompt>" file1 [file2 ...]  (env MODEL to override)
import json, sys, base64, urllib.request, os, time, mimetypes
prompt, files = sys.argv[1], sys.argv[2:]
model = os.environ.get('MODEL', 'google/gemini-4-argon')
key = os.environ['OPENROUTER_API_KEY']  # never commit the key
content = [{"type": "text", "text": prompt}]
for f in files:
    ext = f.rsplit('.', 1)[-1].lower()
    b = base64.b64encode(open(f, 'rb').read()).decode()
    content.append({"type": "text", "text": f"File: {os.path.basename(f)}"})
    if ext in ('mp3', 'wav', 'flac', 'ogg', 'm4a', 'aac'):
        content.append({"type": "input_audio", "input_audio": {"data": b, "format": ext}})
    elif ext in ('mp4', 'webm', 'mov'):
        content.append({"type": "video_url", "video_url": {"url": f"data:video/{ext};base64,{b}"}})
    elif ext in ('png', 'jpg', 'jpeg', 'webp'):
        content.append({"type": "image_url", "image_url": {"url": f"data:image/{'jpeg' if ext == 'jpg' else ext};base64,{b}"}})
body = {"model": model, "messages": [{"role": "user", "content": content}]}
if os.environ.get('REASONING'): body["reasoning"] = {"effort": os.environ['REASONING']}
req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
t0 = time.time()
try:
    with urllib.request.urlopen(req, timeout=900) as r:
        j = json.loads(r.read())
except urllib.error.HTTPError as e:
    print('HTTP', e.code, e.read().decode()[:800]); sys.exit(1)
msg = j['choices'][0]['message']
print(msg.get('content'))
print('\n[model', j.get('model'), 'cost', j.get('usage', {}).get('cost'), 'secs', round(time.time() - t0, 1), ']', file=sys.stderr)
