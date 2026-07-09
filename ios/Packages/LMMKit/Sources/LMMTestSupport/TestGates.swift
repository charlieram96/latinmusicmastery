import Foundation

/// Shared opt-in test gate check for every `RUN_*=1`-style gated test in this package (the live-audio
/// smokes, the notation goldens, the stage screenshots, the session smoke) — replaces 6 scattered
/// `ProcessInfo.processInfo.environment["RUN_X"] == "1"` checks with one helper.
///
/// ## D27 tooling fix + what was actually verified
/// Every one of those gates used to check only the bare env var name, which is correct for a plain
/// `swift test` invocation but never opens under `xcodebuild test -destination 'platform=iOS
/// Simulator,…'`: the documented `RUN_AUDIO_SMOKE=1 xcodebuild test …` invocation sets the var in the
/// HOST process running `xcodebuild`, and — verified empirically for this package (D27 report has the
/// full transcript) — `xcodebuild test` does not forward ANY custom env var into the simulator's
/// `xctest` process for this configuration (a headless "logic test" bundle, no host app): not the bare
/// name, not a `SIMCTL_CHILD_`-prefixed name, not a `TEST_RUNNER_*` build-setting override, and not even
/// a hand-edited `.xctestrun`'s `EnvironmentVariables`/`CommandLineArguments`. So every one of these
/// gates skipped unconditionally under `xcodebuild test`, with no error surfaced.
///
/// What DOES work, confirmed empirically: `xcrun simctl spawn <udid> <xctest> … <bundle>` (i.e. driving
/// the already-built test bundle directly, bypassing `xcodebuild test`'s own launch path) honors env
/// vars prefixed `SIMCTL_CHILD_` on the invoking shell — `simctl` strips the prefix before the spawned
/// process sees it, so the process itself only ever observes the BARE name. `ios/README.md` documents
/// this as the actual working local recipe (`xcodebuild build-for-testing` once, then `simctl spawn` per
/// gated run) now that `xcodebuild test` alone is a confirmed dead end for these gates.
///
/// This helper checks BOTH the bare name and the still-`SIMCTL_CHILD_`-prefixed name anyway — the bare
/// check is what actually fires under the `simctl spawn` recipe above (the prefix never survives to the
/// process), and the prefixed check is defensive insurance for any other transport that might one day
/// deliver it unstripped (e.g. a future Xcode/CoreSimulator revision, or a different CI runner). Neither
/// spelling ever reaches the process under plain `xcodebuild test`, so this fix is behavior-neutral for
/// CI — every gate still skips there, with the same visible skip message.
public enum TestGates {
    /// Whether the opt-in gate named `name` (e.g. `"RUN_AUDIO_SMOKE"`) is enabled — bare env var OR its
    /// `SIMCTL_CHILD_`-prefixed form, either one set to exactly `"1"`.
    public static func isEnabled(
        _ name: String,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> Bool {
        value(name, environment: environment) == "1"
    }

    /// The raw value of an env var that may only have reached this process under its `SIMCTL_CHILD_`
    /// spelling — e.g. `STAGE_SHOT_DIR`, which isn't itself a boolean gate but rides alongside
    /// `RUN_STAGE_SHOTS` and has the exact same host-to-simulator forwarding problem. Bare spelling wins
    /// when (unusually) both are set, matching `isEnabled`'s precedence.
    public static func value(
        _ name: String,
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> String? {
        environment[name] ?? environment["SIMCTL_CHILD_\(name)"]
    }
}
