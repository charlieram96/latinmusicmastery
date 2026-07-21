import ScoreModel

/// Namespace anchor for the NotationEngraving module.
///
/// As of task C13 this module owns the Bravura/SMuFL glyph catalog (`Glyph`), font loading
/// (`BravuraFont`) and metrics (`GlyphMetrics`), and pure staff geometry (`StaffGeometry`,
/// `ScaleContext`) — plus a static-staff proof (`drawStaffSample`). It does not yet consume
/// `ScoreDocument` (the `ScoreModel` dependency is wired for later tasks); measure layout,
/// beaming, and spacing land in C14+.
public enum NotationEngravingModule {}
