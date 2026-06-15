# PlaySense Touch — Device Integration Specification

**Version:** 1.0 · 2026-06-11
**Audience:** PlaySense Touch firmware/hardware team
**Owner:** Latin Music Mastery (PlaySense app)

---

## 1. System overview

PlaySense Touch is a sensor hub (ESP32, 6 piezo inputs) mounted on a student's
percussion setup (congas, timbales). When the student strikes a drum, the device
detects the hit and transmits one event to the PlaySense web app over Bluetooth
Low Energy. The app runs a falling-notes "rhythm highway" game: it compares each
received hit against the expected notes of the exercise and grades the student's
timing (perfect / good / ok / miss) and drum choice in real time.

```
 piezo 0..5 ──► ESP32 firmware ──► BLE notify (JSON) ──► Chrome/Edge browser
 (one per       (threshold,                              (PlaySense app:
  drum/surface)  debounce,                                timestamps on receipt,
                 classify hit)                            grades vs. exercise)
```

Two integration facts drive everything below:

1. **The app timestamps hits when they arrive.** The device does not send
   timestamps, so the radio path must be fast and, above all, *consistent*
   (see §6 — latency vs. jitter).
2. **The app maps piezo channel index → drum surface, and a hit on the wrong
   drum is graded as a miss.** Channel assignment must be deterministic and
   physically labeled (see §5).

The app is a browser application using **Web Bluetooth** (Chrome/Edge on
desktop and Android). There is currently **no USB-C data path** in the app —
see §10 (open questions).

---

## 2. BLE GATT contract

| Item | Value | Notes |
|---|---|---|
| Advertised device name | `PlaySense` | The app's device picker filters on this exact name. Must match byte-for-byte. A serial suffix (e.g. `PlaySense-A3F2`) is possible — coordinate with us first so we switch our filter to a name *prefix*. |
| Service UUID | `12345678-1234-1234-1234-123456789abc` | Primary GATT service. |
| Characteristic UUID | `abcd1234-5678-1234-5678-abcdef123456` | Properties: **NOTIFY** (required). The app subscribes and never writes (v1 is receive-only). |
| Payload encoding | UTF-8 JSON text | One complete JSON document per notification. |
| MTU | Support ATT MTU negotiation to ≥ 185 bytes | Payloads exceed the 23-byte default MTU. Chrome negotiates automatically; the firmware must accept it (ESP32 NimBLE / Bluedroid both can). **The app performs no fragment reassembly** — a split JSON is silently dropped. |
| Connection interval | Request 7.5–15 ms | Directly bounds delivery jitter (§6). |
| Reconnect behavior | Device should resume advertising immediately after a link drop | The app auto-reconnects once to the same device without re-prompting the user. |

> The two UUIDs above are the current placeholders in the app. If you prefer to
> generate proper random (v4) UUIDs for production, send them to us — updating
> the app is a two-line change. Whatever ships in firmware and in the app
> **must match exactly**; agree on final values before firmware freeze.

---

## 3. Event payload — schema v1.0 (required)

Send **one notification per hit event**, only when at least one channel
registered a hit. Do not stream periodic packets of zeros.

```json
{"piezos":[0,0,3120,0,0,0],"mic":0}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `piezos` | array of 6 numbers | yes | Index = channel (§5). `0` = no hit on that channel. `> 0` = hit, value = hit energy/velocity on a **0–4095** scale (12-bit ADC full scale; the app normalizes against 4095). |
| `mic` | number | no (default 0) | Optional onboard mic level, same 0–4095 scale. Parsed and stored; not currently graded. |

Rules:

- **Simultaneous hits** (e.g. both hands): set multiple channels non-zero in the
  *same* packet. Two packets ≈ two separate hits.
- **Exactly one packet per physical stroke** (see debounce, §7). Duplicate
  packets are graded as extra hits and lower the student's score.
- Unknown extra fields are ignored by the app, so additive extensions are safe
  (see §4).

## 4. Schema v1.1 — optional technique extension (additive)

The app's grading engine already models *how* a drum is struck (technique:
`open`, `slap`, `mute`, `bass`, `touch`, `rim`, `shell`, `bell`, `tip`, `heel`)
and reserves a per-hit "technique correct?" slot that is currently unused
because microphone-only detection can't classify strokes reliably. **If the
firmware can classify stroke type from the piezo waveform** (even only
sometimes), add a parallel array:

```json
{"piezos":[0,3120,0,0,0,0],"techs":[null,"slap",null,null,null,null],"mic":0}
```

| Field | Type | Meaning |
|---|---|---|
| `techs` | array of 6 (string \| null) | Per-channel stroke classification for THIS hit. `null` / omitted = unknown (never penalized). Vocabulary for congas: `open`, `slap`, `mute`, `bass`, `touch`. |

This is fully backward compatible: app versions that don't understand `techs`
ignore it. Classification confidence below your threshold → send `null`, not a
guess; an unknown technique is neutral, a wrong one would penalize the student.

---

## 5. Channel mapping (piezo index → drum surface)

The app translates channel index to a named drum surface per instrument kit.
**A hit on the wrong surface is a miss**, so the physical jack/channel
assignment must be deterministic, repeatable across units, and labeled on the
enclosure.

| Index | Conga kit | Timbale kit |
|---|---|---|
| 0 | quinto | macho |
| 1 | conga | hembra |
| 2 | tumba | campana |
| 3 | — | cencerro |
| 4 | — | jamblock |
| 5 | — | cascara |

Unused channels simply stay `0`. If the same hardware serves both kits, the
student selects the instrument in the app — firmware does not need to know.

---

## 6. Timing requirements

The app stamps each hit at the moment the notification arrives and compares it
to the expected note time. Grading windows (± around the expected time):

| Difficulty | Perfect | Good | Ok (beyond = miss) |
|---|---|---|---|
| Beginner | 40 ms | 70 ms | 110 ms |
| Intermediate | 30 ms | 55 ms | 85 ms |
| Advanced | 20 ms | 40 ms | 65 ms |

Consequences for the device:

- **Constant latency is acceptable** up to ~100 ms total (strike →
  notification received). The app has a calibration wizard that measures the
  student's full chain latency and subtracts it from every hit.
- **Jitter is the enemy.** Calibration can only compensate a *constant* delay.
  End-to-end variance must stay within **±10 ms** (the app widens windows by
  only 15 ms when it detects high jitter — beyond that, accurate students get
  graded as sloppy). Practical implications:
  - request a 7.5–15 ms BLE connection interval;
  - send the notification immediately on detection — **no batching, no
    coalescing window, no retry queues that reorder events**;
  - keep detection-side processing time constant (fixed-length analysis
    window, not "until classification converges"). If technique
    classification (§4) needs more time, send the hit first and *don't* delay
    it for the classifier — at 200 BPM sixteenth notes are 75 ms apart.
- **Target budget** (guideline): piezo detection ≤ 5 ms + radio ≤ 15 ms +
  margin ≈ **≤ 30 ms typical, ≤ ±10 ms variance**. Please report your measured
  strike-to-notification figures (mean and spread) with the prototype.

---

## 7. On-device signal processing requirements

| Requirement | Spec | Why |
|---|---|---|
| Per-channel threshold | Tunable per channel (at least at provisioning) | Heads/piezo coupling vary per drum; a fixed global threshold either misses soft touches or fires on vibration. |
| Debounce / refractory | One packet per stroke; ~50–80 ms per-channel refractory | Head ringing after a stroke must not re-trigger. Duplicates are graded as *extra hits* and reduce the score. |
| Crosstalk rejection | A strike on drum A must not register on drum B's channel | Wrong surface = miss; cross-triggering directly fails students. Mechanical isolation + per-channel thresholds; if needed, compare channel energies within a small window and keep the dominant channel. |
| Velocity scale | Report energy 0–4095, monotonic with strike strength | Used for the input meter and per-hit energy records. Linearity is not critical; monotonicity is. |
| Idle behavior | Silence (no packets) | The app treats every notification as potentially containing hits. |

---

## 8. Connection lifecycle expected by the app

1. Device powers on → advertises as `PlaySense` continuously.
2. User clicks "Connect" in the app → browser shows a device picker filtered to
   that name → user selects the unit.
3. App connects, discovers the service/characteristic, calls
   `startNotifications()`. From then on, every notification is processed.
4. If the link drops mid-exercise, the app attempts **one** silent reconnect to
   the same device; the device must be advertising again for this to succeed.
5. Multiple units in one room: acceptable (the picker disambiguates), but a
   per-unit suffix in the advertised name is preferred — coordinate with us
   (see §2, name row).

---

## 9. Nice-to-haves (low effort on your side, future value for us)

- **Battery Service** (standard GATT `0x180F`): lets the app warn on low battery.
- **Device Information Service** (`0x180A`): firmware revision string, so the
  app can surface "update available" messaging later.
- A documented **firmware update path** (USB-C DFU is fine).
- A **provisioning/config story** for per-channel thresholds (§7) — even a
  serial console command set is acceptable for v1.

---

## 10. Open questions to resolve together

1. **USB-C: charging/flashing only, or also data?** The app's only data path
   today is Web Bluetooth. If USB data is wanted, the simplest contract is the
   same JSON, newline-delimited, over USB CDC serial at 115200 baud — the app
   would add a WebSerial path. Decide which transport is primary.
2. **iOS/iPadOS**: Web Bluetooth (and WebSerial) are not available in Safari.
   If students will use iPads, this affects platform strategy on our side, not
   firmware — but flag your constraints early.
3. **Final UUIDs and device name** (§2) — confirm before firmware freeze.
4. **Technique classification feasibility** (§4) — even partial (slap vs. open
   on congas) is valuable; tell us what the piezo waveform supports.
5. **Prototype + measurements**: we need one unit early plus your measured
   strike-to-notification latency (mean ± spread) to validate against our
   calibration tooling before firmware freeze.

---

## 11. Acceptance checklist (how we'll validate a unit)

- [ ] Advertises as agreed name; appears in Chrome's device picker.
- [ ] Service/characteristic UUIDs match; notifications start on subscribe.
- [ ] MTU negotiation: a full v1.0 payload arrives in one notification.
- [ ] Single soft and hard strokes on each channel → exactly one packet each,
      correct channel index, energy monotonic with strength.
- [ ] Fast alternating strokes at 200 BPM sixteenths (75 ms apart) → no merged
      or dropped events.
- [ ] Simultaneous two-hand hit → one packet with two non-zero channels.
- [ ] No packets while idle / during ambient vibration (footsteps, speaker).
- [ ] Strike drum A hard → no event on adjacent channels (crosstalk).
- [ ] Measured strike-to-notification: ≤ 30 ms typical, ≤ ±10 ms variance.
- [ ] Link drop + device re-advertise → app's single auto-reconnect succeeds.

---

## 12. Glossary (plain language)

- **GATT**: the "menu system" of a BLE device — services are folders,
  characteristics are files inside them.
- **Service / Characteristic UUID**: the fixed ID numbers of that folder and
  file, so the app can find them without guessing.
- **Notification (NOTIFY)**: the device pushing a new value to the app the
  moment it changes — no polling.
- **MTU**: maximum size of one BLE message. Below it, a message arrives whole;
  above it, it gets cut into pieces (which this app does not reassemble).
- **Connection interval**: how often the radio link exchanges data. A packet
  ready between exchanges waits for the next slot — so a shorter interval means
  less waiting and less timing wobble.
- **Latency**: the constant delay from drumstick contact to the app hearing
  about it. Removable by calibration.
- **Jitter**: the variation of that delay from hit to hit. Not removable —
  must be engineered out.
- **Debounce / refractory period**: after one detected stroke, ignore that
  channel briefly so the drumhead's ringing doesn't count as more strokes.
- **Crosstalk**: vibration from one drum leaking into another drum's sensor.
