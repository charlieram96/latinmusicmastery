import Foundation

/// Port of `ScoreDocumentValidationError` (`serialization.ts`). Aggregates every semantic
/// violation found by ``ScoreDocument/parse(_:decoder:)`` — mirrors Zod's `safeParse`
/// collecting every issue in one pass rather than failing on the first one.
public struct ScoreDocumentValidationError: Error, Equatable, Sendable {
    /// Port of one Zod `ZodIssue` — just `path` + `message`, the two fields every caller
    /// of the TS error actually reads.
    public struct Issue: Equatable, Sendable {
        public let path: [String]
        public let message: String

        public init(path: [String], message: String) {
            self.path = path
            self.message = message
        }
    }

    public let issues: [Issue]

    public init(issues: [Issue]) {
        self.issues = issues
    }

    /// Convenience for the single-issue case (e.g. the `schemaVersion` hard-fail).
    public init(path: [String], message: String) {
        self.issues = [Issue(path: path, message: message)]
    }

    /// True when the failure is specifically an unrecognized/future `schemaVersion` — the
    /// one case downstream UI should render as "update the app" rather than a generic
    /// "this score is corrupt" error, mirroring the TS `migrateToCurrentVersion` special-case.
    public var isUnsupportedSchemaVersion: Bool {
        issues.contains { $0.path == ["schemaVersion"] }
    }
}

extension ScoreDocumentValidationError: LocalizedError {
    public var errorDescription: String? {
        "ScoreDocument validation failed: \(issues.count) issue(s)"
    }
}
