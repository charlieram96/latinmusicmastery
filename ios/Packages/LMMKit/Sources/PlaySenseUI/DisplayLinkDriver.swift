import QuartzCore

/// Small `NSObject` proxy so a non-`NSObject` `@Observable` ``SessionCoordinator`` can be a `CADisplayLink`
/// target. Fires `onFrame` on the main run loop each display refresh; the coordinator does its own ~10 Hz
/// HUD throttling on top.
@MainActor
final class DisplayLinkDriver: NSObject {
    private var displayLink: CADisplayLink?
    private let onFrame: () -> Void

    init(onFrame: @escaping () -> Void) {
        self.onFrame = onFrame
    }

    func start() {
        guard displayLink == nil else { return }
        let link = CADisplayLink(target: self, selector: #selector(tick))
        link.add(to: .main, forMode: .common)
        displayLink = link
    }

    func stop() {
        displayLink?.invalidate()
        displayLink = nil
    }

    @objc private func tick() {
        onFrame()
    }
}
