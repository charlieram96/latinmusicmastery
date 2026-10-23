# Final audio mix: music bed with voice ducking, voiceover, frame-locked sound effects.
# usage: python3 mix.py <timeline.json> <sfx.json> <vo_dir> <music.wav> <out.wav> [--sfx 0.35] [--music -6] [--duck 8]
import sys, json, os, argparse
import numpy as np, soundfile as sf, librosa, pyloudnorm as pyln
from scipy.signal import butter, sosfilt, sosfiltfilt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sfx_synth

ap = argparse.ArgumentParser()
ap.add_argument('timeline'); ap.add_argument('sfx'); ap.add_argument('vo_dir'); ap.add_argument('music'); ap.add_argument('out')
ap.add_argument('--sfx-level', type=float, default=0.32)
ap.add_argument('--music-db', type=float, default=-6.0)
ap.add_argument('--duck-db', type=float, default=6.5)
ap.add_argument('--mid-extra-db', type=float, default=6.0)
ap.add_argument('--target-lufs', type=float, default=-14.0)
ap.add_argument('--stems', action='store_true')
ap.add_argument('--jam-stems', default=None)
ap.add_argument('--jam-offset', type=float, default=104.0)
ap.add_argument('--sfx-duck-db', type=float, default=4.0)
ap.add_argument('--tail-db', type=float, default=-9.0)
a = ap.parse_args()

SR = 48000
TL = json.load(open(a.timeline)); CUES = json.load(open(a.sfx))
dur = TL['duration'] + 0.1
N = int(np.ceil(dur * SR))

def db(x): return 10 ** (x / 20)

# ---------------- voiceover track
vo = np.zeros(N)
TRIM = {'L01': 1.5, 'L05': -1.0, 'L11': 2.5, 'L12': -0.5, 'L13': 1.0, 'L21': 1.0, 'L22': 0.5}
def load_line(i):
    p = os.path.join(a.vo_dir, i + '.wav')
    if not os.path.exists(p): p = p[:-4] + '.flac'
    y, sr = sf.read(p, dtype='float64')
    y = y * db(TRIM.get(i, 0.0))
    if y.ndim > 1: y = y.mean(1)
    if sr != SR: y = librosa.resample(y, orig_sr=sr, target_sr=SR)
    return y

def place(buf, y, t):
    i = int(round(t * SR))
    if i < 0: y = y[-i:]; i = 0
    n = min(len(y), len(buf) - i)
    buf[i:i + n] += y[:n]

spans = []
for line in TL['vo']:
    y = load_line(line['id'])
    if 'split' in line:
        # cut at energy minima between words, place each word on its beat
        hop = int(0.005 * SR)
        rms = librosa.feature.rms(y=y, frame_length=hop * 4, hop_length=hop)[0]
        dbv = 20 * np.log10(rms + 1e-9); pk = dbv.max()
        words = line['split']
        quiet = dbv < pk - 42
        runs, i = [], 0
        while i < len(quiet):
            if quiet[i]:
                j = i
                while j < len(quiet) and quiet[j]: j += 1
                if (j - i) * hop / SR >= 0.05 and i > 0 and j < len(quiet): runs.append((i, j))
                i = j
            else: i += 1
        runs = sorted(sorted(runs, key=lambda r: r[1] - r[0], reverse=True)[:len(words) - 1])
        cuts = [0] + [((r0 + r1) / 2) * hop / SR for r0, r1 in runs]
        cuts.append(len(y) / SR)
        for wi, w in enumerate(words):
            s0, s1 = cuts[wi], cuts[wi + 1]
            seg = y[int(s0 * SR):int(s1 * SR)].copy()
            f = int(0.008 * SR); seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
            r2 = librosa.feature.rms(y=seg, frame_length=hop * 4, hop_length=hop)[0]
            on = np.argmax(20 * np.log10(r2 + 1e-9) > pk - 30) * hop / SR
            st = w['at'] - on
            place(vo, seg, st)
            spans.append((st + on, st + len(seg) / SR))
        continue
    place(vo, y, line['start'])
    spans.append((line['start'], line['start'] + len(y) / SR))

# gentle VO polish: presence lift + soft compression
def peaking(x, f0, gain_db, q=0.9):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / SR; al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A]); aa = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    from scipy.signal import lfilter
    return lfilter(b / aa[0], aa / aa[0], x)
# de-esser: duck the 5.5-9 kHz band when it spikes
sib = sosfilt(butter(2, [5500, 9500], 'bandpass', fs=SR, output='sos'), vo)
se = np.sqrt(np.convolve(sib ** 2, np.ones(int(0.01 * SR)) / int(0.01 * SR), 'same')) + 1e-9
fe = np.sqrt(np.convolve(vo ** 2, np.ones(int(0.01 * SR)) / int(0.01 * SR), 'same')) + 1e-9
ratio_s = se / fe
red = np.clip((ratio_s - 0.32) / 0.3, 0, 1) * 0.6
vo = vo - sib * red
vo = peaking(vo, 3200, 1.5, 0.8)
vo = peaking(vo, 180, -1.5, 0.7)
env = np.sqrt(np.convolve(vo ** 2, np.ones(int(0.03 * SR)) / int(0.03 * SR), 'same')) + 1e-9
thr = db(-26); ratio = 3.0
gain = np.where(env > thr, (thr * (env / thr) ** (1 / ratio)) / env, 1.0)
vo *= gain

# ---------------- music with voice ducking
mus, sr = sf.read(a.music, dtype='float64')
if sr != SR: mus = librosa.resample(mus.T, orig_sr=sr, target_sr=SR).T
music = np.zeros((N, 2)); n = min(N, len(mus)); music[:n] = mus[:n]
# ---- jam session build-up: rebuild the band instrument by instrument (stems from Demucs)
if a.jam_stems:
    st = {}
    for k in ('bass', 'drums', 'other', 'vocals'):
        y, sr_ = sf.read(os.path.join(a.jam_stems, k + '.wav'), dtype='float64')
        if sr_ != SR: y = librosa.resample(y.T, orig_sr=sr_, target_sr=SR).T
        st[k] = y
    L19 = next(v for v in TL['vo'] if v['id'] == 'L19')['words']
    w = lambda pre: next(x['t'] for x in L19 if x['w'].lower().strip(',.').startswith(pre))
    tB, tP, tBo, tG, tW = w('bass'), w('piano'), w('bong'), w('gui'), w('whole') - 0.25
    # gains per state: (bass, other, drums)
    states = [(tB - 0.06, (1.0, 0.0, 0.22)), (tP - 0.06, (1.0, 1.0, 0.22)), (tBo - 0.06, (1.0, 1.0, 0.65)), (tG - 0.06, (1.0, 1.0, 1.0))]
    i0 = int(round(states[0][0] * SR)); i_end = int(round((tW - 0.04) * SR))
    off = int(round(a.jam_offset * SR))
    n_seg = i_end - i0 + int(0.06 * SR)
    seg_idx = np.arange(i0, i0 + n_seg) - off
    gb, go, gd = np.zeros(n_seg), np.zeros(n_seg), np.zeros(n_seg)
    for (ts, (b_, o_, d_)), nxt in zip(states, states[1:] + [(tW - 0.04, None)]):
        s0 = int(round(ts * SR)) - i0; s1 = int(round(nxt[0] * SR)) - i0
        gb[s0:s1], go[s0:s1], gd[s0:s1] = b_, o_, d_
    gb[i_end - i0:], go[i_end - i0:], gd[i_end - i0:] = 1, 1, 1
    k = int(0.04 * SR); ker = np.ones(k) / k
    gb, go, gd = [np.convolve(g, ker, 'same') for g in (gb, go, gd)]
    stem_mix = st['bass'][seg_idx] * gb[:, None] + st['other'][seg_idx] * go[:, None] + st['drums'][seg_idx] * gd[:, None] + st['vocals'][seg_idx] * gd[:, None]
    # crossfade from the full mix into the stem mix (40 ms), and back at "the whole band"
    xf = np.ones(n_seg); r = int(0.04 * SR)
    xf[:r] = np.linspace(0, 1, r); xf[-int(0.06 * SR):] = np.linspace(1, 0, int(0.06 * SR))
    orig = music[i0:i0 + n_seg].copy()
    music[i0:i0 + n_seg] = orig * (1 - xf[:, None]) + stem_mix * xf[:, None] * 1.12
    print('jam build-up', [round(x[0], 2) for x in states], 'full at', round(tW, 2))
act = np.zeros(N)
sp = sorted(spans)
merged = []
for s0, s1 in sp:
    if merged and s0 - merged[-1][1] < 1.1: merged[-1][1] = max(merged[-1][1], s1)
    else: merged.append([s0, s1])
for s0, s1 in merged:
    i0, i1 = int(max(0, s0 - 0.12) * SR), int(min(dur, s1 + 0.08) * SR); act[i0:i1] = 1.0
# smooth: fast attack, slow release
att, rel = np.exp(-1 / (0.15 * SR)), np.exp(-1 / (0.8 * SR))
sm = np.zeros(N); v = 0.0
for i in range(0, N, 32):
    x = act[i]
    c = att if x > v else rel
    v = x + (v - x) * c ** 32
    sm[i:i + 32] = v
lift = np.zeros(N)
for t0_, t1_, gdb in [(117.9, 126.4, 2.0), (136.5, 143.0, 1.0)]:
    i0, i1 = int(t0_ * SR), int(min(t1_, dur) * SR); r = int(0.3 * SR)
    lift[i0:i1] = gdb
    lift[i0:i0 + r] = np.linspace(0, gdb, r); lift[max(i0, i1 - r):i1] = np.linspace(gdb, 0, len(lift[max(i0, i1 - r):i1]))
g_all = db(a.music_db) * db(-a.duck_db * sm) * db(lift)
g_mid = db(-a.mid_extra_db * sm)
sos = butter(2, [900, 4000], 'bandpass', fs=SR, output='sos')
mid = sosfiltfilt(sos, music, axis=0)
rest = music - mid
music_out = (rest + mid * g_mid[:, None]) * g_all[:, None]

# ---- end card: let the final stinger bloom into a long Eb-major room tail instead of dead air
ev = TL.get('events', {})
if 'stinger' in ev and a.tail_db > -60:
    ts = ev['stinger']; i0 = int((ts - 0.02) * SR); i1 = min(N, int((ts + 1.1) * SR))
    send = music_out[i0:i1].mean(1)
    dec = 5.0; n_ir = int(dec * SR); rng_ = np.random.default_rng(7)
    irs = []
    for ch in range(2):
        ir = rng_.standard_normal(n_ir) * np.exp(-np.arange(n_ir) / SR / (dec / 6.0))
        ir = sosfilt(butter(2, 5200, 'lowpass', fs=SR, output='sos'), ir)
        ir[:int(0.03 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        irs.append(ir)
    from scipy.signal import fftconvolve
    wet = np.stack([fftconvolve(send, irs[0]), fftconvolve(send, irs[1])], 1)
    # warm pad on the stinger chord, fading in under the tail
    tp = np.arange(int((dur - ts) * SR)) / SR
    pad = np.zeros(len(tp))
    for f, g in [(155.56, 1.0), (233.08, 0.7), (311.13, 0.55), (392.0, 0.4), (466.16, 0.22)]:
        for det in (-0.12, 0.0, 0.12):
            pad += g * np.sin(2 * np.pi * f * (1 + det / 100) * tp + rng_.uniform(0, 6.28))
    pad = sosfilt(butter(2, 1100, 'lowpass', fs=SR, output='sos'), pad)
    pad *= np.clip(tp / 2.2, 0, 1) ** 2 * np.clip((dur - 0.3 - ts - tp) / 1.7, 0, 1)
    pad = pad / (np.abs(pad).max() + 1e-9) * db(-27)
    wet_n = min(len(wet), N - i0)
    tail = np.zeros((N, 2)); tail[i0:i0 + wet_n] = wet[:wet_n] * db(a.tail_db)
    tail[i0:i0 + len(pad)] += np.stack([pad, pad * 0.97], 1)[:N - i0]
    # fade everything out cleanly before the last frame
    fo = int(0.35 * SR); tail[N - fo:] *= np.linspace(1, 0, fo)[:, None]
    music_out = music_out + tail
    print('end tail from', round(ts, 2), 's')
# ---- opening logo hit: let it bloom under the first bar of the groove (ducked under the narrator)
if 'hit' in ev:
    th = ev['hit']; i0 = int((th - 0.02) * SR); i1 = int((th + 0.5) * SR)
    send = music_out[i0:i1].mean(1)
    dec = 2.6; n_ir = int(dec * SR); rng_ = np.random.default_rng(11)
    from scipy.signal import fftconvolve
    wet = []
    for ch in range(2):
        ir = rng_.standard_normal(n_ir) * np.exp(-np.arange(n_ir) / SR / (dec / 6.0))
        ir = sosfilt(butter(2, [180, 6000], 'bandpass', fs=SR, output='sos'), ir)
        ir[:int(0.02 * SR)] = 0; ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        wet.append(fftconvolve(send, ir))
    wet = np.stack(wet, 1) * db(-12.0)
    n_w = min(len(wet), N - i0)
    wet = wet[:n_w] * db(-6.0 * sm[i0:i0 + n_w])[:, None]
    music_out[i0:i0 + n_w] += wet
    print('hit bloom at', round(th, 2), 's')

# ---------------- sound effects
sfx = np.zeros((N, 2))
cache = {}
for c in CUES:
    if c['gain'] <= 0: continue
    key = (c['name'], c.get('pitch', 0), c.get('dur'))
    if key not in cache: cache[key] = sfx_synth.render(c['name'], pitch=c.get('pitch', 0), **({'dur': c['dur']} if c.get('dur') else {}))
    y = cache[key] * c['gain']
    p = max(-1, min(1, c.get('pan', 0))); th = (p + 1) * np.pi / 4
    y = y * np.array([np.cos(th), np.sin(th)]) * np.sqrt(2)
    i = int(round(c['t'] * SR)); m = min(len(y), N - i)
    if m > 0: sfx[i:i + m] += y[:m]
sfx *= a.sfx_level
# keep effects polite while the narrator speaks
sfx *= db(-a.sfx_duck_db * sm)[:, None]

# ---------------- master
mix = music_out + np.stack([vo, vo], 1) + sfx
meter = pyln.Meter(SR)
L = meter.integrated_loudness(mix)
mix *= db(a.target_lufs - L)
# lookahead peak limiter (ceiling -1 dBFS)
ceil_ = db(-1.0)
pk = np.abs(mix).max(1)
w = int(0.004 * SR)
from scipy.ndimage import maximum_filter1d, uniform_filter1d
pk = maximum_filter1d(pk, size=w * 2 + 1)
g = np.minimum(1.0, ceil_ / (pk + 1e-9))
g = np.minimum(g, maximum_filter1d(g, 1))
g = uniform_filter1d(g, size=w)  # smooth attack
relc = np.exp(-1 / (0.08 * SR)); out_g = np.empty_like(g); v = 1.0
for i in range(len(g)):
    v = g[i] if g[i] < v else g[i] + (v - g[i]) * relc
    out_g[i] = v
mix *= out_g[:, None]
mix = np.clip(mix, -0.999, 0.999)
sf.write(a.out, mix.astype(np.float32), SR, subtype='PCM_24')
print('integrated before norm', round(L, 2), 'after', round(meter.integrated_loudness(mix), 2), 'peak', round(20 * np.log10(np.abs(mix).max()), 2), 'dBFS', 'limiter min gain', round(20 * np.log10(out_g.min()), 2), 'dB')
if a.stems:
    base = a.out.rsplit('.', 1)[0]
    sf.write(base + '_vo.wav', np.stack([vo, vo], 1).astype(np.float32), SR)
    sf.write(base + '_music.wav', music_out.astype(np.float32), SR)
    sf.write(base + '_sfx.wav', sfx.astype(np.float32), SR)
