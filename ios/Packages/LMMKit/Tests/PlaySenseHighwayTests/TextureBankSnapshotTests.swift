import SnapshotTesting
import UIKit
import XCTest

@testable import PlaySenseHighway

/// Snapshot of the baked ``TextureBank`` output (one lane color), locking the GlassStyle constants
/// and pill-baking math. Light-only, deterministic (no randomness in the pill bake). A gradient/CG
/// bake is stable across simulator OS versions, but a small tolerance guards against sub-pixel drift.
final class TextureBankSnapshotTests: XCTestCase {

    func testCongaPillTexture() {
        let bank = TextureBank()
        // Conga lane amber (0xF2A12C) — the debug exercise's second lane color.
        let image = bank.pillImage(0xF2A12C)
        assertSnapshot(
            of: image,
            as: .image(precision: 0.98, perceptualPrecision: 0.98),
            named: "conga-pill"
        )
    }
}
