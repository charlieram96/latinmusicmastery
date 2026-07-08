import AVFoundation
import AVKit
import SwiftUI
import UIKit

/// A `UIView` whose backing layer is an `AVPlayerLayer` — the surface the video renders on.
final class PlayerLayerUIView: UIView {
    override static var layerClass: AnyClass { AVPlayerLayer.self }
    var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer } // swiftlint:disable:this force_cast

    var player: AVPlayer? {
        get { playerLayer.player }
        set { playerLayer.player = newValue }
    }
}

/// Hosts an `AVPlayerLayer` for the player model.
///
/// `role` guarantees exactly one live layer at a time: the inline layer detaches whenever the
/// fullscreen cover is up (and vice versa), so a single `AVPlayer` never drives two layers.
struct PlayerLayerView: UIViewRepresentable {
    enum Role { case inline, fullscreen }

    let model: LessonVideoPlayerModel
    let role: Role

    func makeUIView(context: Context) -> PlayerLayerUIView {
        let view = PlayerLayerUIView()
        view.playerLayer.videoGravity = .resizeAspect
        view.backgroundColor = .black
        return view
    }

    func updateUIView(_ view: PlayerLayerUIView, context: Context) {
        let shouldBeActive = (role == .fullscreen) == model.isFullscreen
        view.player = shouldBeActive ? model.player : nil
    }
}

/// The system AirPlay route picker, tinted to match the player's white-on-scrim controls.
struct AirPlayRoutePicker: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let picker = AVRoutePickerView()
        picker.tintColor = .white
        picker.activeTintColor = UIColor(red: 0.94, green: 0.62, blue: 0.22, alpha: 1) // brand amber
        picker.prioritizesVideoDevices = true
        return picker
    }

    func updateUIView(_ view: AVRoutePickerView, context: Context) {}
}
