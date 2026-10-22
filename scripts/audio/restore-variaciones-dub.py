"""Offline local repair: original mix minus Spanish voice plus English voice.
Requires numpy and ffmpeg. No API calls; uses already generated two-stem PCM.
Never normalize the combined track: that would change the instrument again.
"""
from pathlib import Path
import json, os, subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / 'local-artifacts/elevenlabs-variaciones-full'
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
RATE = 44100
SOURCE = ROOT / 'public/local-course-assets/codex-variaciones/preview.mp4'
DEST = ROOT / 'public/local-course-assets/codex-variaciones/dub-en-original-percussion.flac'

def decode(path):
    return np.frombuffer(subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(path),
        '-vn', '-f', 'f32le', '-ac', '2', '-ar', str(RATE), '-']), dtype='<f4').reshape(-1, 2).copy()

def voice(lang, length):
    data = np.fromfile(WORK / f'stems-{lang}/vocals.pcm', dtype='<i2').reshape(-1, 2).astype(np.float32) / 32768
    assert abs(len(data) - length) < RATE * .1, 'Stem duration does not match source'
    return np.pad(data[:length], ((0, max(0, length-len(data))), (0, 0)))

def voice_gate(data):
    # Suppress separator leakage in quiet/instrumental passages, with soft edges.
    block = 2205  # 50 ms
    padded = np.pad(data, ((0, (-len(data)) % block), (0, 0)))
    rms = np.sqrt(np.mean(padded.reshape(-1, block, 2)**2, axis=(1, 2)))
    active = rms > 10**(-55/20)
    expanded = np.convolve(active.astype(float), np.ones(5), mode='same') > 0
    centers = (np.arange(len(expanded)) + .5) * block
    return np.interp(np.arange(len(data)), centers, expanded.astype(float)).astype(np.float32)

original = decode(SOURCE)
spanish, english = voice('es', len(original)), voice('en', len(original))
# Match narration level using the opening, before percussion demonstration begins.
region = slice(3 * RATE, 24 * RATE)
gain = float(np.sqrt(np.mean(spanish[region]**2) / np.mean(english[region]**2)))
sg, eg = voice_gate(spanish), voice_gate(english)
# Authored final demonstration: count ends at 297.03, first hit 297.384,
# final hit ends 374.84, closing narration starts 374.97. Keep it untouched.
start, end, fade = int(297.3*RATE), int(374.84*RATE), int(.02*RATE)
for gate in (sg, eg):
    gate[start-fade:start] *= np.linspace(1, 0, fade)
    gate[start:end] = 0
    gate[end:end+fade] *= np.linspace(0, 1, fade)
bed = original - spanish * sg[:, None]
translated = english * eg[:, None]
# Reserve headroom by reducing ONLY the translated voice, never the original bed.
nonzero = np.abs(translated) > 1e-5
limits = (.98 - np.sign(translated[nonzero]) * bed[nonzero]) / np.abs(translated[nonzero])
gain = min(gain, float(np.min(limits)))
mixed = bed + translated * gain
assert np.max(np.abs(mixed)) < 1, 'Clipping: adjust voice only, never normalize percussion'
subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '2',
    '-i', '-', '-c:a', 'flac', '-sample_fmt', 's32', str(DEST)], input=mixed.astype('<f4').tobytes(), check=True)
verified = decode(DEST)
# Long instrumental demonstration must retain the actual source samples, not a separated approximation.
region = slice(300 * RATE, 360 * RATE)
assert np.all(sg[region] == 0) and np.all(eg[region] == 0), 'Unexpected speech in instrumental validation window'
error = float(np.max(np.abs(verified[region] - original[region])))
assert error < 2e-7, 'Original percussion changed'
report = {
    'method': 'Original decoded mix minus gated original vocal stem plus gated translated vocal stem; no background gain, compression or normalization.',
    'source': str(SOURCE.relative_to(ROOT)), 'output': str(DEST.relative_to(ROOT)),
    'sampleRate': RATE, 'durationSeconds': len(mixed)/RATE,
    'englishVoiceGainDb': float(20*np.log10(gain)), 'peak': float(np.max(np.abs(mixed))),
    'instrumentalCheckSeconds': [300, 360], 'maxSampleError': error,
    'limitation': 'Simultaneous speech and percussion rely on source separation; small separation artifacts remain possible. Instrument-only intervals bypass separation.',
}
(WORK / 'percussion-restoration.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))
