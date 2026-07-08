#ifndef PLAYSENSE_REALTIME_H
#define PLAYSENSE_REALTIME_H

#include <stdint.h>
#include <stdatomic.h>

/*
 * Lock-free single-producer / single-consumer ring of fixed-size audio slots.
 *
 * The one producer is the AVAudioEngine input-tap callback (a realtime thread): it does nothing but
 * memcpy the buffer's samples into the next free slot and publish the write index with a RELEASE
 * store. No locks, no allocation, no Objective-C, no logging. The one consumer is a dedicated
 * high-priority drain queue that reads with an ACQUIRE load. All storage is malloc'd up front in
 * psr_ring_create(); push/pop never allocate. If the consumer falls behind, the producer DROPS the
 * incoming buffer (returns 0) rather than block — an overrun is preferable to a glitch/priority
 * inversion on the audio thread.
 */
typedef struct psr_ring {
    float *samples;             /* capacity * slotFrames floats */
    uint64_t *hostTimes;        /* capacity host-time stamps (AVAudioTime.hostTime) */
    uint32_t *frameCounts;      /* capacity valid frame counts */
    uint32_t capacity;          /* number of slots (power of two) */
    uint32_t slotFrames;        /* max frames a slot can hold */
    _Atomic uint32_t writeIndex;
    _Atomic uint32_t readIndex;
    _Atomic uint64_t dropCount; /* buffers dropped due to a full ring (diagnostics) */
} psr_ring;

/* Allocate a ring with `capacity` slots (rounded up to a power of two) each holding `slotFrames`
 * floats. Returns NULL on allocation failure. NOT realtime-safe — call before installing the tap. */
psr_ring *psr_ring_create(uint32_t capacity, uint32_t slotFrames);

/* Free a ring. NOT realtime-safe — call after removing the tap and draining. */
void psr_ring_destroy(psr_ring *ring);

/* Producer (realtime tap thread). Copies min(frames, slotFrames) samples + hostTime into the next
 * slot. Returns 1 on success, 0 if the ring was full (buffer dropped, dropCount incremented).
 *
 * IMPORTANT: if frames > slotFrames, this SILENTLY TRUNCATES to slotFrames — the extra samples at the
 * tail of `src` are dropped with no signal to the caller (no return-code distinction from the
 * full-ring case). This is safe today because the tap buffer size is always configured well under
 * slotFrames (see AudioSampleRing.push's debug-only assert in Swift, which guards this at the call
 * site), but it is a silent-data-loss footgun for any future caller that changes that relationship. */
int psr_ring_push(psr_ring *ring, const float *src, uint32_t frames, uint64_t hostTime);

/* Consumer (drain thread). If a slot is available, copies its samples into `dst` (must hold at least
 * slotFrames floats), sets *outFrames and *outHostTime, and returns 1. Returns 0 if empty. */
int psr_ring_pop(psr_ring *ring, float *dst, uint32_t *outFrames, uint64_t *outHostTime);

/* Diagnostics: number of buffers dropped because the ring was full. */
uint64_t psr_ring_drop_count(const psr_ring *ring);

#endif /* PLAYSENSE_REALTIME_H */
