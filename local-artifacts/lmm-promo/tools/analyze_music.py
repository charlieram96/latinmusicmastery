# Plot a mel spectrogram + RMS + beat grid for a track, print tempo/sections.
import sys, numpy as np, librosa, librosa.display, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
path, out = sys.argv[1], sys.argv[2]
y, sr = librosa.load(path, sr=22050, mono=True)
dur = len(y) / sr
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
rms = librosa.feature.rms(y=y, frame_length=4096, hop_length=1024)[0]
t_rms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=1024)
S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, hop_length=512)
fig, ax = plt.subplots(3, 1, figsize=(22, 10), sharex=True, gridspec_kw={'height_ratios': [3, 1, 1]})
librosa.display.specshow(librosa.power_to_db(S, ref=np.max), sr=sr, hop_length=512, x_axis='time', y_axis='mel', ax=ax[0])
ax[1].plot(t_rms, 20 * np.log10(rms + 1e-6)); ax[1].set_ylabel('RMS dB')
# vocal-band energy proxy: 300-3400 Hz harmonic share
H, P = librosa.decompose.hpss(librosa.stft(y, n_fft=2048, hop_length=1024))
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
band = (freqs > 300) & (freqs < 3400)
harm = np.abs(H[band]).sum(0); perc = np.abs(P[band]).sum(0)
t_h = librosa.frames_to_time(np.arange(H.shape[1]), sr=sr, hop_length=1024)
ax[2].plot(t_h, harm / (harm + perc + 1e-9)); ax[2].set_ylabel('harm share 300-3.4k')
for a in ax:
    for s in range(0, int(dur) + 1, 10): a.axvline(s, color='w' if a is ax[0] else 'k', alpha=0.25, lw=0.6)
ax[2].set_xticks(np.arange(0, dur, 5))
plt.tight_layout(); plt.savefig(out, dpi=70)
print('duration', round(dur, 2), 'tempo', np.round(tempo, 2), 'nbeats', len(beats))
print('first beats', np.round(beats[:12], 3))
d = np.diff(beats); print('median beat period', round(float(np.median(d)), 4), '-> bpm', round(60 / float(np.median(d)), 2))
# per-5s loudness
for s in range(0, int(dur), 5):
    m = (t_rms >= s) & (t_rms < s + 5)
    print(f'{s:4d}s {20*np.log10(np.mean(rms[m])+1e-6):6.1f} dB', end=' | ' if (s // 5) % 6 != 5 else '\n')
print()
