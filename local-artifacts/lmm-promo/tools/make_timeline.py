# Build the master timeline: VO schedule (absolute word times), beat grid and music energy for the promo engine.
import json, numpy as np, librosa, soundfile as sf, os
S = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 30
import sys
VODIR = sys.argv[1] if len(sys.argv) > 1 else f'{S}/audio/vo-latin'
OUT = sys.argv[2] if len(sys.argv) > 2 else f'{S}/source/data/timeline.json'
OVR = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
words = json.load(open(f'{VODIR}/words.json'))
info = json.load(open(f'{VODIR}/info.json'))
script = json.load(open(f'{S}/audio/script.json'))
starts = {'L01': 1.15, 'L03': 16.45, 'L04': 23.45, 'L05': 28.62, 'L06': 31.55, 'L07': 36.95, 'L08': 42.65,
          'L09': 48.75, 'L10': 57.45, 'L11': 65.3, 'L12': 68.45, 'L13': 78.1, 'L14': 83.7, 'L15': 89.95,
          'L16': 94.6, 'L17': 98.7, 'L18': 104.55, 'L19': 108.75, 'L20': 114.15, 'L21': 127.0, 'L22': 131.5, 'L23': 135.2}
starts.update(OVR)
# music analysis on the extended track
y, sr = librosa.load(f'{S}/audio/music-lyria3-extended.mp3', sr=22050, mono=True)
dur = len(y) / sr
hop = 256
oenv = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
ot = librosa.frames_to_time(np.arange(len(oenv)), sr=sr, hop_length=hop)
period, offset = 0.572009, 0.774133
def grid(k, shift=0.0): return offset + k * period + shift
def snap(t, w=0.09):
    m = (ot > t - w) & (ot < t + w)
    return float(ot[m][np.argmax(oenv[m])]) if m.any() else t
# beat grid: piecewise (orig before 55.952, shifted after the bridge repeat)
beats = []
k = 0
while True:
    t = grid(k)
    if t > 55.95: break
    beats.append(t); k += 1
k0 = k
while True:
    t = grid(k) - 0.0  # after the splice, the original grid continues shifted by 9.155 s
    tt = t + 9.155
    if t > 131.8: break
    if tt >= 55.95: beats.append(tt)
    k += 1
beats = sorted(set(round(b, 3) for b in beats if b < dur))
# L02: place each word on every second beat starting at the first beat >= 11.0
l02_words = words['L02']['words']
b0 = [b for b in beats if b >= 11.0][0]
bi = beats.index(b0)
l02_place = []
for i, w in enumerate(l02_words):
    t = snap(beats[bi + 2 * i])
    l02_place.append({'word': w[0].strip(',.'), 'src_start': w[1], 'src_end': (l02_words[i + 1][1] if i + 1 < len(l02_words) else info['L02']['dur']), 'at': round(t - 0.03, 3)})
vo = []
for ln in script['lines']:
    i = ln['id']
    if i == 'L02':
        vo.append({'id': i, 'text': ln['text'], 'split': l02_place, 'start': l02_place[0]['at'], 'end': l02_place[-1]['at'] + (l02_place[-1]['src_end'] - l02_place[-1]['src_start'])})
        continue
    st = starts[i]; d = info[i]['dur']
    ws = [{'w': w[0], 't': round(st + w[1], 3), 'e': round(st + w[2], 3)} for w in words[i]['words']]
    vo.append({'id': i, 'text': ln['text'], 'start': st, 'end': round(st + d, 3), 'words': ws})
# overlap check
vv = sorted(vo, key=lambda x: x['start'])
for a, b in zip(vv, vv[1:]):
    if b['start'] < a['end'] + 0.12: print('WARN overlap/tight', a['id'], a['end'], b['id'], b['start'])
# energy bands per video frame
Sx = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop)) ** 2
fr = librosa.fft_frequencies(sr=sr, n_fft=2048)
bands = {'low': (20, 180), 'mid': (180, 2000), 'high': (2000, 9000)}
et = librosa.frames_to_time(np.arange(Sx.shape[1]), sr=sr, hop_length=hop)
nF = int(np.ceil(142.6 * FPS))
energy = {}
for name, (a, b) in bands.items():
    e = Sx[(fr >= a) & (fr < b)].sum(0)
    e = 10 * np.log10(e + 1e-10)
    e = np.interp(np.arange(nF) / FPS, et, e)
    lo, hi = np.percentile(e, 5), np.percentile(e, 99)
    energy[name] = np.clip((e - lo) / (hi - lo), 0, 1).round(3).tolist()
onset_f = np.interp(np.arange(nF) / FPS, ot, oenv / np.percentile(oenv, 99))
energy['onset'] = np.clip(onset_f, 0, 1.5).round(3).tolist()
out = {'fps': FPS, 'duration': 142.6, 'musicEnd': round(dur, 3), 'beats': beats, 'period': period,
       'events': {'hit': 9.808, 'groove': 10.98, 'mainGroove': 28.384, 'bridge': 46.797, 'bridge2': 55.952, 'swell': 65.107,
                  'breakdown': 83.24, 'stab': 89.38, 'stab2': 89.82, 'brassBuild': 104.24, 'mambo': 108.25, 'finale': 126.535,
                  'rollBreak': 135.155, 'stinger': 136.531, 'tailEnd': 140.99},
       'introClicks': [0.80, 1.94, 3.09, 4.23, 5.24, 6.38, 7.52], 'vo': vo, 'energy': energy}
json.dump(out, open(OUT, 'w'))
print('dur', dur, 'beats', len(beats), 'L02', [(p['word'], p['at']) for p in l02_place])
for v in vo: print(v['id'], v['start'], v['end'])
