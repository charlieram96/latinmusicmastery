# Procedural sound effects for the promo (48 kHz stereo float arrays).
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env_ad(n, a=0.005, d=0.3, curve=4.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / max(d, 1e-4) * (curve / 4.0) * 4.0 / 1.0 * 0.25)
    return e


def expdecay(n, tau):
    return np.exp(-np.arange(n) / SR / tau)


def bp(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], 'bandpass', fs=SR, output='sos')
    return sosfilt(sos, x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, 'highpass', fs=SR, output='sos'), x)


def noise(n):
    return rng.standard_normal(n)


def sweep_bp_noise(d, f0, f1, q=0.35, shape='rise-fall'):
    """Noise through a time-varying band-pass (processed in short blocks)."""
    n = int(d * SR); x = noise(n); y = np.zeros(n)
    blk = 512
    for i in range(0, n, blk):
        k = i / max(1, n - 1)
        f = f0 * (f1 / f0) ** k
        lo, hi = max(40, f * (1 - q)), min(SR / 2 - 100, f * (1 + q))
        seg = x[max(0, i - 2048):i + blk]
        yy = bp(seg, lo, hi)
        y[i:i + blk] = yy[-len(x[i:i + blk]):]
    t = np.linspace(0, 1, n)
    if shape == 'rise-fall':
        e = np.sin(np.pi * t) ** 1.5
    elif shape == 'rise':
        e = t ** 2.2
    else:
        e = (1 - t) ** 2
    return y * e


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x / m * peak


def tone(f, d, kind='sine', tau=0.3, attack=0.004, harm=None):
    t = t_(d); n = len(t)
    if kind == 'sine':
        y = np.sin(2 * np.pi * f * t)
    elif kind == 'tri':
        y = 2 / np.pi * np.arcsin(np.sin(2 * np.pi * f * t))
    elif kind == 'bell':
        y = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / (tau * dd)) for r, a, dd in [(1, 1, 1), (2.76, .45, .5), (5.4, .25, .3), (8.93, .12, .2)])
    else:
        y = np.sin(2 * np.pi * f * t)
    if harm:
        y = y + sum(a * np.sin(2 * np.pi * f * r * t) for r, a in harm)
    e = np.minimum(1, t / attack) * np.exp(-t / tau)
    return y * e


def stereo(x, width=0.0):
    if width <= 0:
        return np.stack([x, x], 1)
    d = int(0.012 * SR * width)
    l = x; r = np.concatenate([np.zeros(d), x[:-d]]) if d > 0 else x
    return np.stack([l, r], 1)


def reverb(x, decay=1.2, mix=0.25, pre=0.01):
    n = int(decay * SR)
    ir_l = noise(n) * np.exp(-np.arange(n) / SR / (decay / 5.5))
    ir_r = noise(n) * np.exp(-np.arange(n) / SR / (decay / 5.5))
    ir_l = lp(ir_l, 7000); ir_r = lp(ir_r, 7000)
    ir_l[:int(pre * SR)] = 0; ir_r[:int(pre * SR)] = 0
    ir_l /= np.sqrt(np.sum(ir_l ** 2)) + 1e-9; ir_r /= np.sqrt(np.sum(ir_r ** 2)) + 1e-9
    mono = x.mean(1) if x.ndim == 2 else x
    L = len(mono) + n
    wl = np.zeros(L); wr = np.zeros(L)
    cl = fftconvolve(mono, ir_l); cr = fftconvolve(mono, ir_r)
    wl[:min(L, len(cl))] = cl[:L]; wr[:min(L, len(cr))] = cr[:L]
    dry = x if x.ndim == 2 else stereo(x)
    out = np.zeros((len(mono) + n, 2)); out[:len(mono)] += dry * (1 - mix)
    out[:, 0] += wl * mix * 0.6; out[:, 1] += wr * mix * 0.6
    return out


def semis(p):
    return 2 ** (p / 12)


# ------------------------------------------------------------------ sound designs
def riser(dur=2.2, **_):
    t = t_(dur); n = len(t)
    nz = sweep_bp_noise(dur, 300, 6000, q=0.5, shape='rise')
    f = 120 * (8 ** (t / dur) ** 1.6)
    ph = 2 * np.pi * np.cumsum(f) / SR
    sw = (np.sin(ph) + 0.5 * np.sin(2 * ph)) * (t / dur) ** 2.5 * 0.5
    y = norm(nz) * 0.7 + sw
    y *= np.minimum(1, (dur - t) / 0.02)  # hard stop into the hit
    return reverb(stereo(norm(y), 0.6), 1.0, 0.25)


def impact(**_):
    d = 1.6; t = t_(d)
    f = 70 * np.exp(-t * 5) + 38
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.45)
    nz = lp(noise(len(t)), 900) * np.exp(-t / 0.08)
    crack = hp(noise(len(t)), 2500) * np.exp(-t / 0.03) * 0.5
    y = np.tanh((sub * 1.2 + nz * 0.6 + crack * 0.6) * 1.0)
    return reverb(stereo(norm(hp(y, 45)), 0.5), 1.8, 0.3)


def sub_boom(**_):
    d = 2.0; t = t_(d)
    f = 62 * np.exp(-t * 3) + 34
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.7)
    y = np.tanh(y * 2.2) + lp(noise(len(t)), 300) * np.exp(-t / 0.05) * 0.4
    return stereo(norm(y))


def shimmer(**_):
    d = 2.0; n = int(d * SR); y = np.zeros(n)
    for k in range(26):
        f = rng.uniform(2200, 7800); st = rng.uniform(0, 0.5); dd = rng.uniform(0.3, 1.2)
        seg = tone(f, dd, 'sine', tau=dd / 3, attack=0.01)
        i = int(st * SR); y[i:i + len(seg)] += seg[:n - i] * rng.uniform(0.3, 1)
    y *= np.exp(-np.arange(n) / SR / 0.8)
    return reverb(stereo(norm(y), 1.0), 2.2, 0.45)


def whoosh(d=0.75, f0=350, f1=3200, **_):
    return reverb(stereo(norm(hp(sweep_bp_noise(d, f0, f1, q=0.45), 140)), 0.8), 0.8, 0.2)


def whoosh_short(**_):
    return whoosh(0.32, 800, 5000)


def whoosh_big(**_):
    y = sweep_bp_noise(1.1, 200, 4200, q=0.6)
    t = t_(1.1)
    rum = lp(noise(len(t)), 160) * np.sin(np.pi * t / 1.1) ** 2
    return reverb(stereo(norm(hp(norm(y) + rum * 0.5, 70)), 1.0), 1.2, 0.25)


def whoosh_up(**_):
    return reverb(stereo(norm(hp(sweep_bp_noise(0.85, 250, 6000, q=0.4, shape='rise'), 140)), 0.7), 0.9, 0.25)


def card_swoosh(**_):
    return whoosh(0.28, 1200, 4500)


def swish_soft(**_):
    return whoosh(0.4, 900, 3500)


def ping(pitch=0, **_):
    f = 1244.5 * semis(pitch)
    y = tone(f, 1.0, 'bell', tau=0.35) * 0.8
    return reverb(stereo(norm(y), 0.4), 1.4, 0.35)


def error_soft(**_):
    a = tone(392, 0.22, 'tri', tau=0.12); b = tone(370, 0.3, 'tri', tau=0.15)
    y = np.zeros(int(0.5 * SR)); y[:len(a)] += a; i = int(0.16 * SR); y[i:i + len(b)] += b
    return reverb(stereo(norm(lp(y, 2500))), 0.5, 0.15)


def impact_bright(**_):
    a = impact(); d = 1.8; t = t_(d)
    crash = hp(noise(len(t)), 4000) * np.exp(-t / 0.6) * 0.35
    out = np.zeros((max(len(a), len(t)), 2)); out[:len(a)] += a; out[:len(t)] += stereo(crash, 1.0)
    return out


def sparkle(**_):
    d = 1.0; n = int(d * SR); y = np.zeros(n)
    for k, p in enumerate([0, 4, 7, 12, 16, 19]):
        seg = tone(1244.5 * semis(p), 0.5, 'bell', tau=0.18)
        i = int(k * 0.045 * SR); y[i:i + len(seg)] += seg[:n - i] * (0.9 - k * 0.08)
    return reverb(stereo(norm(y), 1.0), 1.6, 0.4)


def pluck(pitch=0, **_):
    f = 622.25 * semis(pitch)
    t = t_(0.7)
    y = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t / 0.05) + 0.2 * np.sin(2 * np.pi * f * 2 * t)) * np.exp(-t / 0.22) * np.minimum(1, t / 0.002)
    return reverb(stereo(norm(y), 0.3), 1.0, 0.25)


def pop(pitch=0, **_):
    t = t_(0.16); base = 466.2 * semis(pitch)
    f = base * (1 + 1.6 * np.exp(-t / 0.012))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.045)
    y += hp(noise(len(t)), 3000) * np.exp(-t / 0.004) * 0.25
    return reverb(stereo(norm(y)), 0.4, 0.12)


def chime(pitch=0, **_):
    d = 1.5; n = int(d * SR); y = np.zeros(n)
    for k, p in enumerate([0, 4, 7, 12]):
        seg = tone(1244.5 * semis(p + pitch), 1.2, 'bell', tau=0.45)
        i = int(k * 0.02 * SR); y[i:i + len(seg)] += seg[:n - i]
    return reverb(stereo(norm(y), 0.8), 1.6, 0.35)


def success(**_):
    d = 1.6; n = int(d * SR); y = np.zeros(n)
    for k, p in enumerate([0, 4, 7, 12]):
        seg = tone(622.25 * semis(p), 0.9, 'bell', tau=0.35) + tone(622.25 * semis(p), 0.9, 'tri', tau=0.25) * 0.25
        i = int(k * 0.085 * SR); y[i:i + len(seg)] += seg[:n - i]
    sh = shimmer()[:n]
    out = stereo(norm(y), 0.6); out[:len(sh)] += sh * 0.35
    return reverb(out, 1.4, 0.3)


def correct(**_):
    a = tone(932.3, 0.35, 'bell', tau=0.15); b = tone(1244.5, 0.6, 'bell', tau=0.3)
    y = np.zeros(int(0.8 * SR)); y[:len(a)] += a; i = int(0.11 * SR); y[i:i + len(b)] += b * 1.1
    return reverb(stereo(norm(y), 0.4), 1.0, 0.25)


def flame(**_):
    t = t_(0.8)
    body = lp(noise(len(t)), 1800) * np.sin(np.pi * np.minimum(1, t / 0.8)) ** 0.8
    crackle = np.zeros(len(t))
    for k in range(40):
        i = rng.integers(0, len(t) - 200); crackle[i:i + 120] += hp(noise(120), 3000) * np.exp(-np.arange(120) / 25) * rng.uniform(0.2, 1)
    return reverb(stereo(norm(body * 0.8 + crackle * 0.5), 0.7), 0.7, 0.2)


def unlock(pitch=0, **_):
    a = tone(1244.5 * semis(pitch), 0.6, 'bell', tau=0.2)
    s = sparkle()[:len(a)] * 0.35
    out = stereo(norm(a), 0.3); out[:len(s)] += s
    return out


def levelup(**_):
    d = 1.6; n = int(d * SR); y = np.zeros(n)
    notes = [0, 4, 7, 12, 16]
    for k, p in enumerate(notes):
        seg = tone(622.25 * semis(p), 0.5 if k < 4 else 1.2, 'tri', tau=0.18 if k < 4 else 0.5)
        i = int(k * 0.07 * SR); y[i:i + len(seg)] += seg[:n - i]
    chord = sum(tone(1244.5 * semis(p), 1.1, 'bell', tau=0.5) for p in [0, 4, 7])
    i = int(0.3 * SR); y[i:i + len(chord)] += chord[:n - i] * 0.6
    return reverb(stereo(norm(y), 0.6), 1.5, 0.3)


def boing(**_):
    t = t_(0.7)
    f = 180 + 90 * np.exp(-t / 0.25) * np.sin(2 * np.pi * 14 * t) + 60 * np.exp(-t / 0.1)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.25)
    return reverb(stereo(norm(y)), 0.6, 0.15)


def toggle(**_):
    y = np.zeros(int(0.15 * SR))
    for i0 in [0, int(0.06 * SR)]:
        c = hp(noise(240), 2000) * np.exp(-np.arange(240) / 30); y[i0:i0 + 240] += c
    return stereo(norm(y))


def click(**_):
    y = hp(noise(480), 1500) * np.exp(-np.arange(480) / 50)
    t = t_(0.05); y2 = np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.006)
    out = np.zeros(len(t)); out[:480] += y; out += y2 * 0.5
    return stereo(norm(out))


def tick(pitch=0, **_):
    t = t_(0.08); y = np.sin(2 * np.pi * 2489 * semis(pitch) * t) * np.exp(-t / 0.012)
    return stereo(norm(y))


def tick_perfect(**_):
    return reverb(stereo(norm(tone(932.3, 0.5, 'bell', tau=0.18)), 0.3), 0.9, 0.3)


def tick_early(**_):
    return reverb(stereo(norm(tone(784.0, 0.45, 'bell', tau=0.16)), 0.3), 0.9, 0.3)


def tick_late(**_):
    return reverb(stereo(norm(tone(622.25, 0.45, 'bell', tau=0.16)), 0.3), 0.9, 0.3)


def notify(pitch=0, **_):
    a = tone(932.3 * semis(pitch), 0.3, 'sine', tau=0.08); b = tone(1244.5 * semis(pitch), 0.45, 'sine', tau=0.14)
    y = np.zeros(int(0.6 * SR)); y[:len(a)] += a; i = int(0.09 * SR); y[i:i + len(b)] += b
    return reverb(stereo(norm(y), 0.3), 0.8, 0.2)


def star(pitch=0, **_):
    t = t_(0.6); f = 2489 * semis(pitch) * (1 + 0.01 * np.sin(2 * np.pi * 9 * t))
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.18) * np.minimum(1, t / 0.003)
    return reverb(stereo(norm(y), 0.5), 1.2, 0.35)


def sent(**_):
    w = whoosh_up()[: int(0.5 * SR)] * 0.6
    d = stereo(norm(tone(1244.5, 0.5, 'bell', tau=0.18)))
    out = np.zeros((int(0.9 * SR), 2)); out[:len(w)] += w; i = int(0.3 * SR); out[i:i + len(d)] += d[:len(out) - i]
    return out


def msg(pitch=0, **_):
    t = t_(0.2); f = 932.3 * semis(pitch)
    y = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.05)
    return reverb(stereo(norm(y)), 0.5, 0.15)


def ignite(**_):
    t = t_(1.4)
    rush = sweep_bp_noise(1.4, 200, 2500, q=0.7, shape='decay')
    thump = np.sin(2 * np.pi * np.cumsum(80 * np.exp(-t * 4) + 40) / SR) * np.exp(-t / 0.3)
    y = norm(rush) * 0.7 + thump * 0.9
    out = stereo(norm(y), 0.6)
    sp = sparkle(); out[:min(len(out), len(sp))] += sp[:len(out)] * 0.35
    return reverb(out, 1.6, 0.3)


def room_tone(**_):
    return np.zeros((10, 2))


DESIGNS = {k: v for k, v in globals().items() if callable(v) and not k.startswith('_') and k not in (
    't_', 'env_ad', 'expdecay', 'bp', 'lp', 'hp', 'noise', 'sweep_bp_noise', 'norm', 'tone', 'stereo', 'reverb', 'semis', 'butter', 'sosfilt', 'fftconvolve')}


def render(name, **opts):
    fn = DESIGNS[name]
    y = fn(**{k: v for k, v in opts.items() if k in ('pitch', 'dur')})
    y = np.asarray(y, dtype=np.float64)
    if y.ndim == 1:
        y = stereo(y)
    fi = int(0.002 * SR); y[:fi] *= np.linspace(0, 1, fi)[:, None]
    fo = int(0.02 * SR); y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return y / (np.max(np.abs(y)) + 1e-9) * 0.9
