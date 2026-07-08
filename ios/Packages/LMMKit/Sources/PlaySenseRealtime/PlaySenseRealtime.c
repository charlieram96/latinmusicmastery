#include "PlaySenseRealtime.h"

#include <stdlib.h>
#include <string.h>

static uint32_t next_pow2(uint32_t v) {
    if (v < 2) return 2;
    v--;
    v |= v >> 1; v |= v >> 2; v |= v >> 4; v |= v >> 8; v |= v >> 16;
    return v + 1;
}

psr_ring *psr_ring_create(uint32_t capacity, uint32_t slotFrames) {
    if (slotFrames == 0) return NULL;
    uint32_t cap = next_pow2(capacity);
    psr_ring *ring = (psr_ring *)calloc(1, sizeof(psr_ring));
    if (!ring) return NULL;
    ring->samples = (float *)calloc((size_t)cap * slotFrames, sizeof(float));
    ring->hostTimes = (uint64_t *)calloc(cap, sizeof(uint64_t));
    ring->frameCounts = (uint32_t *)calloc(cap, sizeof(uint32_t));
    if (!ring->samples || !ring->hostTimes || !ring->frameCounts) {
        psr_ring_destroy(ring);
        return NULL;
    }
    ring->capacity = cap;
    ring->slotFrames = slotFrames;
    atomic_store_explicit(&ring->writeIndex, 0, memory_order_relaxed);
    atomic_store_explicit(&ring->readIndex, 0, memory_order_relaxed);
    atomic_store_explicit(&ring->dropCount, 0, memory_order_relaxed);
    return ring;
}

void psr_ring_destroy(psr_ring *ring) {
    if (!ring) return;
    free(ring->samples);
    free(ring->hostTimes);
    free(ring->frameCounts);
    free(ring);
}

int psr_ring_push(psr_ring *ring, const float *src, uint32_t frames, uint64_t hostTime) {
    uint32_t w = atomic_load_explicit(&ring->writeIndex, memory_order_relaxed);
    uint32_t r = atomic_load_explicit(&ring->readIndex, memory_order_acquire);
    uint32_t next = (w + 1) & (ring->capacity - 1);
    if (next == r) {
        atomic_fetch_add_explicit(&ring->dropCount, 1, memory_order_relaxed);
        return 0; /* full — drop rather than block the audio thread */
    }
    uint32_t n = frames < ring->slotFrames ? frames : ring->slotFrames;
    memcpy(ring->samples + (size_t)w * ring->slotFrames, src, (size_t)n * sizeof(float));
    ring->frameCounts[w] = n;
    ring->hostTimes[w] = hostTime;
    atomic_store_explicit(&ring->writeIndex, next, memory_order_release);
    return 1;
}

int psr_ring_pop(psr_ring *ring, float *dst, uint32_t *outFrames, uint64_t *outHostTime) {
    uint32_t r = atomic_load_explicit(&ring->readIndex, memory_order_relaxed);
    uint32_t w = atomic_load_explicit(&ring->writeIndex, memory_order_acquire);
    if (r == w) return 0; /* empty */
    uint32_t n = ring->frameCounts[r];
    memcpy(dst, ring->samples + (size_t)r * ring->slotFrames, (size_t)n * sizeof(float));
    *outFrames = n;
    *outHostTime = ring->hostTimes[r];
    uint32_t next = (r + 1) & (ring->capacity - 1);
    atomic_store_explicit(&ring->readIndex, next, memory_order_release);
    return 1;
}

uint64_t psr_ring_drop_count(const psr_ring *ring) {
    return atomic_load_explicit(&ring->dropCount, memory_order_relaxed);
}
