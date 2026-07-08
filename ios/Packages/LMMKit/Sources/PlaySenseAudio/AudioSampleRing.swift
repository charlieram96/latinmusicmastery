import Foundation
import PlaySenseRealtime

/// Thin Swift wrapper over the lock-free SPSC ring (`PlaySenseRealtime`). One producer (the audio tap
/// thread) calls ``push(_:frames:hostTime:)``; one consumer (the drain queue) calls ``pop(into:)``.
/// The backing storage is allocated once here; push/pop are allocation-free and lock-free.
final class AudioSampleRing {
    private let ring: UnsafeMutablePointer<psr_ring>
    let slotFrames: Int

    init?(capacity: Int, slotFrames: Int) {
        guard let ring = psr_ring_create(UInt32(capacity), UInt32(slotFrames)) else { return nil }
        self.ring = ring
        self.slotFrames = slotFrames
    }

    deinit { psr_ring_destroy(ring) }

    /// Producer side (realtime tap thread). Returns false if the ring was full (buffer dropped).
    @discardableResult
    func push(_ src: UnsafePointer<Float>, frames: Int, hostTime: UInt64) -> Bool {
        psr_ring_push(ring, src, UInt32(frames), hostTime) == 1
    }

    /// Consumer side (drain thread). Copies the next slot into `dst` (must hold ≥ `slotFrames` floats);
    /// returns the valid frame count + hostTime, or nil if empty.
    func pop(into dst: UnsafeMutablePointer<Float>) -> (frames: Int, hostTime: UInt64)? {
        var frames: UInt32 = 0
        var hostTime: UInt64 = 0
        guard psr_ring_pop(ring, dst, &frames, &hostTime) == 1 else { return nil }
        return (Int(frames), hostTime)
    }

    var dropCount: UInt64 { psr_ring_drop_count(ring) }
}
