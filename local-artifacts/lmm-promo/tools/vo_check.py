# Transcribe VO lines with word timestamps; report speech start/end and text.
import sys, json, os, glob
from faster_whisper import WhisperModel
d = json.load(open(sys.argv[1])); folder = sys.argv[2]
model = WhisperModel(os.environ.get('WM', 'small'), device='cpu', compute_type='int8', cpu_threads=4)
out = {}
for ln in d['lines']:
    f = None
    for ext in ('wav', 'mp3'):
        p = os.path.join(folder, ln['id'] + '.' + ext)
        if os.path.exists(p): f = p; break
    if not f: continue
    import librosa; aud, _ = librosa.load(f, sr=16000, mono=True)
    segs, info = model.transcribe(aud, language='en', word_timestamps=True, vad_filter=False, beam_size=5)
    words = [w for s in segs for w in s.words]
    txt = ''.join(w.word for w in words).strip()
    out[ln['id']] = {'file': f, 'start': round(words[0].start, 3) if words else None, 'end': round(words[-1].end, 3) if words else None,
                     'words': [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for w in words], 'heard': txt}
    print(f"{ln['id']} {out[ln['id']]['start']}-{out[ln['id']]['end']} | {txt}\n      want: {ln['text']}")
json.dump(out, open(os.path.join(folder, 'words.json'), 'w'), indent=1, ensure_ascii=False)
