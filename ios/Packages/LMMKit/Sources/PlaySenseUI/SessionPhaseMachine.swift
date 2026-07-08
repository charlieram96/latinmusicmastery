import PlaySenseCore

/// The audio mode a take runs in — port of `use-exercise-session.ts`'s `AudioMode`. `playsense` (BLE) is
/// the D25 seam; it is present in the vocabulary so the mode picker and calibration source-type selection
/// leave room for it, but D23 only wires the two mic modes.
public enum SessionAudioMode: String, Equatable, Sendable, CaseIterable {
    case headphones
    case speakerSafe = "speaker-safe"
    case playsense

    /// Whether backing stems + onset detection should apply the speaker-bleed-rejection overlays.
    public var isSpeakerSafe: Bool { self == .speakerSafe }
}

/// Why an in-flight take was aborted — mirrors ``CalibrationInterruptionReason`` but for a graded session.
public enum SessionInterruption: Equatable, Sendable {
    case audioInterruption
    case routeChanged
    case backgrounded
}

/// The session state machine's phase — the D23 exit-gate flow:
/// `idle → modeSelect → calibrationCheck → ready → countdown(beat) → playing → results | interrupted`,
/// with `bluetoothBlocked` reachable from `ready` (a Bluetooth output route can't be trusted for a graded
/// take; the sheet offers a practice-mode escape hatch).
public enum SessionPhase: Equatable, Sendable {
    case idle
    case modeSelect
    /// Offer the calibration wizard when no record exists for the current route; `hasRecord` lets the UI
    /// auto-advance when one already does.
    case calibrationCheck(hasRecord: Bool)
    case ready
    case countdown(beat: Int)
    case playing
    case results(AttemptStats)
    case interrupted(SessionInterruption)
    /// A Bluetooth output route was detected before a graded take — the blocking sheet is shown.
    case bluetoothBlocked
}

/// Pure state machine for a PlaySense session, lifted out of ``SessionCoordinator`` so every transition —
/// including interruption from each phase, the Bluetooth-blocked path, and practice-mode propagation — is
/// unit-testable without a live `GameAudioEngine`. The coordinator owns one of these, drives it from real
/// audio/session events, and republishes `phase` for SwiftUI.
///
/// `isPracticeMode` is sticky within a take: once the player accepts the Bluetooth practice-mode escape it
/// stays set through `results`, so the results view can flag the attempt as unranked (persistence is D26's
/// concern — nothing is written here).
public struct SessionPhaseMachine: Equatable, Sendable {
    public private(set) var phase: SessionPhase = .idle
    public private(set) var isPracticeMode = false

    public init() {}

    /// `true` while a take is actively running (count-in or playing) — the only phases an interruption or
    /// route change can abort.
    public var isActive: Bool {
        switch phase {
        case .countdown, .playing: return true
        default: return false
        }
    }

    // MARK: - Forward flow

    public mutating func beginModeSelect() {
        guard phase == .idle else { return }
        phase = .modeSelect
    }

    /// Mode chosen → move to the calibration gate. `hasRecord` reflects whether a stored calibration exists
    /// for the current (source, route); the UI advances straight to `ready` when it does.
    public mutating func selectMode(hasCalibrationRecord: Bool) {
        guard phase == .modeSelect else { return }
        phase = .calibrationCheck(hasRecord: hasCalibrationRecord)
    }

    /// Calibration satisfied (a record already existed, or the wizard was just completed/skipped).
    public mutating func calibrationResolved() {
        guard case .calibrationCheck = phase else { return }
        phase = .ready
    }

    /// Attempt to start a graded take. A Bluetooth output route diverts to the blocking sheet unless the
    /// player is already in practice mode.
    public mutating func requestStart(isBluetoothOutput: Bool) {
        guard phase == .ready else { return }
        if isBluetoothOutput, !isPracticeMode {
            phase = .bluetoothBlocked
        } else {
            phase = .countdown(beat: 0)
        }
    }

    /// Accept the practice-mode escape hatch from the Bluetooth-blocked sheet: the take runs, grades are
    /// computed, but the attempt is flagged unranked.
    public mutating func acceptPracticeMode() {
        guard phase == .bluetoothBlocked else { return }
        isPracticeMode = true
        phase = .countdown(beat: 0)
    }

    /// Dismiss the Bluetooth-blocked sheet without practicing — back to `ready` to fix the route.
    public mutating func dismissBluetoothBlock() {
        guard phase == .bluetoothBlocked else { return }
        phase = .ready
    }

    public mutating func updateCountdown(beat: Int) {
        guard case .countdown = phase else { return }
        phase = .countdown(beat: beat)
    }

    public mutating func beginPlaying() {
        guard case .countdown = phase else { return }
        phase = .playing
    }

    /// Take finished normally (progress ≥ 1 or manual stop while playing) → results.
    public mutating func finish(stats: AttemptStats) {
        guard case .playing = phase else { return }
        phase = .results(stats)
    }

    // MARK: - Disruptions

    /// Abort an in-flight take. Only `countdown`/`playing` are abortable; a disruption arriving in any other
    /// phase (idle, results, already interrupted) is ignored, so a completed attempt is never retroactively
    /// discarded.
    public mutating func interrupt(_ reason: SessionInterruption) {
        guard isActive else { return }
        phase = .interrupted(reason)
    }

    // MARK: - Reset / retry

    /// Retry after results or an interruption — re-arm to `ready`. Clears the practice-mode flag so the next
    /// take re-evaluates the route from scratch.
    public mutating func retry() {
        switch phase {
        case .results, .interrupted:
            isPracticeMode = false
            phase = .ready
        default:
            break
        }
    }

    /// Full reset back to `idle` (leaving the flow).
    public mutating func reset() {
        isPracticeMode = false
        phase = .idle
    }
}
