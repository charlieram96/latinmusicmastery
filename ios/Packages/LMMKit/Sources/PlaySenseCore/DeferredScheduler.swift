import Foundation

/// A cancellable handle for one piece of deferred work scheduled on a ``DeferredScheduler``.
public protocol DeferredHandle: AnyObject {
    /// Cancel this work if it has not already run. Idempotent.
    func cancel()
}

/// The injection seam that lets ``LiveScorer`` schedule the web hook's two deferred grading paths — the
/// chord `setTimeout(…, CHORD_GRADE_DELAY_MS)` and the pitched-onset `setTimeout(…, 100)` — without a real
/// `Task.sleep`/`DispatchQueue.asyncAfter` in unit tests.
///
/// Production wires ``RealDeferredScheduler`` (a serial `DispatchQueue`); the determinism suite wires
/// ``ManualDeferredScheduler`` and advances a synthetic clock so every deferred callback fires at an exact,
/// reproducible instant. Mirrors the web's `pendingPitchTimersRef` set: individual items self-remove when
/// they fire, and ``cancelAll()`` clears the whole set at `finish`/stop.
public protocol DeferredScheduler: AnyObject {
    /// Schedule `work` to run once after `milliseconds`. The returned handle can cancel it before it fires.
    @discardableResult
    func schedule(afterMilliseconds milliseconds: Double, _ work: @escaping () -> Void) -> DeferredHandle

    /// Cancel every pending scheduled item (the `finish`/stop flush — port of clearing
    /// `pendingPitchTimersRef` and every `clearTimeout`).
    func cancelAll()
}

// MARK: - Manual (deterministic tests)

/// A ``DeferredScheduler`` driven by an explicit, injected clock. Nothing runs until ``advance(byMilliseconds:)``
/// (or ``runPending()``) crosses an item's fire time, so a scripted onset+clock timeline grades to an exact,
/// reproducible result with no wall-clock or `Task.sleep` involved.
public final class ManualDeferredScheduler: DeferredScheduler {
    private final class Item: DeferredHandle {
        let fireAtMs: Double
        var work: (() -> Void)?
        let sequence: Int
        weak var owner: ManualDeferredScheduler?

        init(fireAtMs: Double, sequence: Int, owner: ManualDeferredScheduler, work: @escaping () -> Void) {
            self.fireAtMs = fireAtMs
            self.sequence = sequence
            self.owner = owner
            self.work = work
        }

        func cancel() {
            work = nil
            owner?.remove(self)
        }
    }

    /// The synthetic clock, in milliseconds since construction.
    public private(set) var nowMilliseconds: Double = 0

    private var items: [Item] = []
    private var sequenceCounter = 0

    public init() {}

    @discardableResult
    public func schedule(afterMilliseconds milliseconds: Double, _ work: @escaping () -> Void) -> DeferredHandle {
        let item = Item(
            fireAtMs: nowMilliseconds + max(0, milliseconds),
            sequence: sequenceCounter,
            owner: self,
            work: work
        )
        sequenceCounter += 1
        items.append(item)
        return item
    }

    public func cancelAll() {
        for item in items { item.work = nil }
        items.removeAll()
    }

    /// Advance the synthetic clock by `milliseconds`, firing (in fire-time then schedule order) every item
    /// whose deadline is now at or before the new `nowMilliseconds`.
    public func advance(byMilliseconds milliseconds: Double) {
        nowMilliseconds += milliseconds
        runPending()
    }

    /// Fire every item whose deadline is at or before the current `nowMilliseconds`, without moving the clock.
    public func runPending() {
        // Re-scan after each fire: a callback may itself schedule further work (e.g. a deferred grade that
        // schedules nothing here, but keep the loop robust regardless).
        while let next = items
            .filter({ $0.fireAtMs <= nowMilliseconds && $0.work != nil })
            .min(by: { $0.fireAtMs != $1.fireAtMs ? $0.fireAtMs < $1.fireAtMs : $0.sequence < $1.sequence }) {
            remove(next)
            next.work?()
            next.work = nil
        }
    }

    /// Count of still-pending (unfired, uncancelled) items — test introspection.
    public var pendingCount: Int { items.count }

    private func remove(_ item: Item) {
        items.removeAll { $0 === item }
    }
}

// MARK: - Real (production)

/// A ``DeferredScheduler`` backed by a serial `DispatchQueue`, used in a live session. Each scheduled item
/// hops back onto `callbackQueue` (the owner's serial context — the main queue for ``SessionCoordinator``) so
/// the `LiveScorer`'s mutable state is only ever touched from one place.
public final class RealDeferredScheduler: DeferredScheduler {
    private final class Item: DeferredHandle {
        private let lock = NSLock()
        private var cancelled = false
        private var didRun = false

        func run(_ work: () -> Void) {
            lock.lock()
            let shouldRun = !cancelled && !didRun
            didRun = true
            lock.unlock()
            if shouldRun { work() }
        }

        func cancel() {
            lock.lock()
            cancelled = true
            lock.unlock()
        }

        var isLive: Bool {
            lock.lock(); defer { lock.unlock() }
            return !cancelled && !didRun
        }
    }

    private let callbackQueue: DispatchQueue
    private let timerQueue = DispatchQueue(label: "com.lmm.playsense.livescorer.scheduler")
    private let lock = NSLock()
    private var live: [Item] = []

    public init(callbackQueue: DispatchQueue = .main) {
        self.callbackQueue = callbackQueue
    }

    @discardableResult
    public func schedule(afterMilliseconds milliseconds: Double, _ work: @escaping () -> Void) -> DeferredHandle {
        let item = Item()
        lock.lock(); live.append(item); lock.unlock()
        timerQueue.asyncAfter(deadline: .now() + max(0, milliseconds) / 1000) { [weak self, weak item] in
            guard let self, let item else { return }
            self.callbackQueue.async {
                item.run(work)
                self.prune()
            }
        }
        return item
    }

    public func cancelAll() {
        lock.lock()
        let snapshot = live
        live.removeAll()
        lock.unlock()
        for item in snapshot { item.cancel() }
    }

    private func prune() {
        lock.lock()
        live.removeAll { !$0.isLive }
        lock.unlock()
    }
}
