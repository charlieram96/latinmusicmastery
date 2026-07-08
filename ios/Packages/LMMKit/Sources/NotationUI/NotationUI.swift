@_exported import NotationEngraving
import TimeMapKit

/// Namespace anchor for the NotationUI module. SwiftUI notation rendering views land here in later tasks.
///
/// `NotationEngraving` is re-exported because NotationUI's public API speaks its vocabulary
/// (`StaffLayoutMode`, `ScoreLayout`) — a `import NotationUI` consumer shouldn't also have to
/// import the engraving layer just to name the layout mode.
public enum NotationUIModule {}
