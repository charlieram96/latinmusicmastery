# Generic OpenRouter TTS with optional instructions. usage: tts2.py model voice out.mp3 "text" ["instructions"]
import json, sys, urllib.request, os
model, voice, out, text = sys.argv[1:5]
instr = sys.argv[5] if len(sys.argv) > 5 else None
key = os.environ['OPENROUTER_API_KEY']  # never commit the key
fmt = os.environ.get("FMT", "mp3")
body = {"model": model, "input": text, "voice": voice, "response_format": fmt}
if instr: body["instructions"] = instr
req = urllib.request.Request('https://openrouter.ai/api/v1/audio/speech', data=json.dumps(body).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req, timeout=600) as r:
        data = r.read()
        if fmt == 'pcm':
            import subprocess
            rate = os.environ.get('RATE', '24000')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', rate, '-ac', '1', '-i', '-', '-b:a', '192k', out], input=data, check=True)
        else:
            open(out, 'wb').write(data)
        print('ok', out, len(data), r.headers.get('Content-Type'))
except urllib.error.HTTPError as e:
    print('HTTP', out, e.code, e.read().decode()[:400])
