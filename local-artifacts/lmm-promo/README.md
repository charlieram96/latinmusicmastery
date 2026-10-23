# Latin Music Mastery — promo video

A 2:22 (142.6 s) promotional video for Latin Music Mastery, rendered at 1920×1080, 30 fps, H.264 + AAC.

| File | What it is |
| --- | --- |
| `LMM-promo.mp4` | **Main cut.** Narrated by a warm, Latin-accented male voice (Gemini 3.8 Flash TTS, voice "Orus", directed as a Puerto Rican salsa musician and host). |
| `LMM-promo-elevenlabs-voice.mp4` | Same cut narrated by ElevenLabs v4 (stock voice "Brian"). Visuals are re-timed to that voice. |
| `poster.jpg` | Thumbnail / poster frame. |
| `storyboard.jpg` | One frame from each beat of the video. |
| `source/` | The motion-graphics project (HTML/CSS/GSAP) and the deterministic frame renderer. |
| `audio/` | Final voice lines (both voices, with word timings), the extended Lyria 3 music track and the jam-session stems. |
| `tools/` | Scripts used for voice, music, analysis, sound design, capture, mixing and review. |

## The story

| Time | Narration | On screen |
| --- | --- | --- |
| 0:01 | "In Latin music… everything starts with the clave." | Clave pattern lights up on the beat, then the logo slams in over the real band footage. |
| 0:11 | "Son. Salsa. Mambo. Timba. Bolero." | One genre per beat, with its origin. |
| 0:16 | "Music with history, with soul. You feel it in your body before you understand it." | A map of where the styles come from; "Feel it". |
| 0:23 | "But learning it? Most videos just talk at you. They never listen back." | A wall of generic video tutorials that never listen back. |
| 0:28 | "Latin Music Mastery changes that." | The logo, then a course page in a browser window. |
| 0:31 | "Learn from real maestros…" | Leo García, Manuel Orza, Niuver, Rolando Morejón, Yan Carlos Artime. |
| 0:37 | "Timbales, congas, bongó, piano, bass, the Cuban tres, and more." | "Take your seat in the orquesta": each instrument lights up as it is named. |
| 0:42 | "Every course is a path…" | The course path from the first beat to the first solo. |
| 0:48 | "Short lessons. Playful exercises. Quizzes, daily streaks, and rewards…" | The game loop: lesson, perfect hits, combo, quiz, streak, badges, level up. |
| 0:57 | "Even for kids, with Corcheita as their guide." | Corcheita and the kids' worlds (note garden, pulse train, pitch sky, dinosaur valley), English/Spanish. |
| 1:05 | "And then… there's PlaySense." | PlaySense reveal. |
| 1:08 | "Grab your instrument, press play, and PlaySense listens to you…" | The score, the listening microphone, the 3D stage; perfect / early / late in real time. |
| 1:18 | "It's like having your own maestro by your side." | Live coaching tips, 100% accuracy run. |
| 1:23 | "After every take, you see exactly what to improve." | Results and the bars to work on. |
| 1:30 | "Track your progress, set your goals, and get smart tips…" | Practice calendar, weekly goal, stats, smart tips. |
| 1:34 | "Send your maestro a clip, and get real, personal feedback." | A take sent to the maestro, with a reply. |
| 1:38 | "And join our Discord community…" | Community channels and messages. |
| 1:44 | "Then comes the best part: jam sessions." | Jam-session reveal. |
| 1:48 | "Bass, piano, bongó, güiro… the whole band plays with you." | The band enters instrument by instrument — the music does the same (rebuilt from stems). |
| 1:54 | "You're not just practicing anymore. You're playing in the orquesta." | The real band. |
| 1:58 | — | Beat-cut montage: Learn it. Play it. Feel it. Live it. |
| 2:07 | "The band is ready. Your part is missing." | Stage plot with one empty seat — yours — which ignites into the logo. |
| 2:11 | "Latin Music Mastery." | Logo and tagline. |
| 2:15 | "¡Tu turno!" | End card: Join the waitlist · Founding-member pricing · latinmusicmastery.com. |

## What is real and what is recreated

- **Real footage and captures:** the band and stage videos from `public/videos` and `public/marketing`, the maestros' photos, the kids' world screens, the score editor and the PlaySense 3D stage (recorded from `/playsense-preview` with the conga and piano demo exercises). In the score capture, the preview's internal "PlaySense Studio Test Fixture" label was replaced with the default "LMM" credit, and the stage recordings are cropped so their score readout is not cut off at the frame edge.
- **Recreated as motion graphics** in the app's visual language, polished for the video: the course page and path, game-loop cards, progress dashboard, results, maestro feedback, community chat and jam-session screens. Numbers such as practice time, streaks and scores are illustrative.
- The CTA uses the site's existing copy: "Join the waitlist", "Founding-member pricing" and latinmusicmastery.com.

## How it was made

- **Voice:** both narrations were generated through OpenRouter's speech endpoint. ElevenLabs on OpenRouter only offers stock voices (no voice library or cloning), and none of them has a Latin accent, so the main cut uses Gemini TTS with directed delivery. Every line was checked by a second model and with Whisper word timings; weak takes were regenerated. The direction is in `audio/script.json`.
- **Music:** an original salsa track from Lyria 3 Pro (through OpenRouter), extended by repeating its bridge so the edit lands on the downbeats. For the jam session, the music was separated into stems with Demucs, so the band audibly enters instrument by instrument.
- **Sound design:** every effect (risers, hits, whooshes, chimes, timing ticks, notification pings, the level-up and the ignite) is synthesised in `tools/sfx_synth.py`, tuned to the track's key, and placed frame-accurately from cues the scenes emit.
- **Mix:** `tools/mix.py` ducks the music and effects under the voice, carves the voice's frequency range, de-esses, adds the jam stem build-up and the reverb blooms, and masters to −14 LUFS with a −1 dBFS limiter. The final encode trims the audio by 0.6 dB so AAC peaks stay near −1 dBTP (about −15 LUFS integrated).
- **Picture:** each scene is a GSAP timeline in `source/js/scenes-*.js`, driven by the voice's word timings and the music's beat grid (`source/data/timeline.json`). `source/render.mjs` seeks the page to every frame time in headless Chromium, so the render is deterministic. The frames are then encoded with ffmpeg.
- **Review:** several full-video passes by audio/video-capable models (`tools/ear.py`), with every reported issue checked against the actual frames before fixing.

## Rebuilding

Requirements: Node 18+, Python 3.10+ (numpy, scipy, librosa, soundfile, pyloudnorm), ffmpeg, and Playwright with Chromium (`npm install` in `source/` adds the package; the scripts in `tools/` find it through the `PLAYWRIGHT` environment variable, for example `PLAYWRIGHT=$PWD/source/node_modules/playwright/index.mjs`).

```bash
cd local-artifacts/lmm-promo
bash tools/extract_seq.sh                 # rebuild source/assets/seq from the repo videos and clips
(cd source && npm install)                # gsap + fonts
(cd source && python3 -m http.server 8765) &

# ElevenLabs variant: add ?tl=timeline_el.json to the URL
node tools/cues.mjs source/data/sfx.json  # export the sound-effect cues from the scenes
python3 tools/mix.py source/data/timeline.json source/data/sfx.json audio/vo-latin \
  audio/music-lyria3-extended.mp3 work/mix.wav --jam-stems audio/jam-stems-wav --jam-offset 104.0
cd source && node render.mjs ../work/frames 0 142.6 4 30
ffmpeg -framerate 30 -i ../work/frames/f_%05d.jpg -i ../work/mix.wav -c:v libx264 -preset slow -crf 25 \
  -pix_fmt yuv420p -af volume=-0.6dB -c:a aac -b:a 192k -movflags +faststart -shortest ../work/LMM-promo.mp4
```

Notes:

- `tools/mix.py` reads `bass.wav`, `drums.wav`, `other.wav` and `vocals.wav` from `--jam-stems`; convert `audio/jam-stems/*.mp3` to WAV in a folder (for example `audio/jam-stems-wav`) first.
- `tools/preview.mjs out_dir 12.5 40.2 …` renders single frames for checking a change; the renderer only re-renders the time range you give it.
- Generation and review scripts read the API key from `OPENROUTER_API_KEY`. Do not commit keys.
- `tools/record.mjs` with `tools/rec_ps_*.json` recorded the PlaySense stage from a local dev server (`tools/fake-supabase.mjs` supplies demo data). `audio/script.json` lists the original take files that were picked; only the final processed lines are kept here.
