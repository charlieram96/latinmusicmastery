# Assemble picked takes, trim leading noise/silence, normalize loudness. usage: vo_prep.py script.json srcdir outdir
import json, sys, os, numpy as np, librosa, soundfile as sf, pyloudnorm as pyln
from scipy.signal import butter, sosfilt
d = json.load(open(sys.argv[1])); src, out = sys.argv[2], sys.argv[3]
os.makedirs(out, exist_ok=True)
SR = 48000; meter = pyln.Meter(SR)
sos = butter(2, 75, 'highpass', fs=SR, output='sos')
info = {}
for ln in d['lines']:
    p = d.get('picks', {}).get(ln['id']) or next((os.path.join(src, ln['id'] + e) for e in ('.wav', '.mp3') if os.path.exists(os.path.join(src, ln['id'] + e))), None)
    if not os.path.isabs(p) and not os.path.exists(p): p = os.path.join(os.path.dirname(sys.argv[1]), p)
    y, _ = librosa.load(p, sr=SR, mono=True)
    y = sosfilt(sos, y)
    hop = int(0.01 * SR)
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-9); peak = db.max()
    # strip near-silence; drop an isolated leading blip (TTS click/grunt) that is followed by a silent gap
    above = np.where(db > peak - 45)[0]
    s0 = above[0]
    run_end = s0
    while run_end < len(db) and db[run_end] > peak - 45: run_end += 1
    gap_end = run_end
    while gap_end < len(db) and db[gap_end] <= peak - 42: gap_end += 1
    if run_end - s0 <= 8 and gap_end - run_end >= 8 and gap_end < len(db):
        s0 = gap_end
        while s0 > run_end and db[s0 - 1] > peak - 55: s0 -= 1
    e_above = np.where(db > peak - 55)[0]
    e0 = e_above[-1]
    start = max(0, s0 * hop - int(0.02 * SR)); end = min(len(y), (e0 + 1) * hop + int(0.12 * SR))
    seg = y[start:end].copy()
    fi, fo = int(0.006 * SR), int(0.1 * SR)
    seg[:fi] *= np.linspace(0, 1, fi); seg[-fo:] *= np.linspace(1, 0, fo)
    L = meter.integrated_loudness(seg) if len(seg) > SR * 0.4 else meter.integrated_loudness(np.concatenate([seg, seg]))
    seg = seg * 10 ** ((-19 - L) / 20)
    pk = np.abs(seg).max()
    if pk > 0.89: seg *= 0.89 / pk
    sf.write(os.path.join(out, ln['id'] + '.wav'), seg.astype(np.float32), SR, subtype='PCM_24')
    dropped = round(start / SR, 3)
    info[ln['id']] = {'dur': round(len(seg) / SR, 3), 'trim_start': dropped}
    print(ln['id'], info[ln['id']], 'src', os.path.basename(p))
json.dump(info, open(os.path.join(out, 'info.json'), 'w'), indent=1)
