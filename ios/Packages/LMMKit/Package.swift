// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "LMMKit",
    defaultLocalization: "en",
    platforms: [
        .iOS(.v17)
    ],
    products: [
        .library(name: "LMMFeatures", targets: ["LMMFeatures"]),
        .library(name: "LMMDesignSystem", targets: ["LMMDesignSystem"]),
        .library(name: "LMMData", targets: ["LMMData"])
    ],
    dependencies: [
        .package(url: "https://github.com/supabase/supabase-swift", from: "2.0.0"),
        .package(url: "https://github.com/pointfreeco/swift-snapshot-testing", from: "1.17.0")
    ],
    targets: [
        // MARK: - Core

        .target(name: "LMMModels", dependencies: []),
        .target(name: "LMMLocalization", dependencies: ["LMMModels"]),
        .target(
            name: "LMMData",
            dependencies: [
                "LMMModels",
                "LMMLocalization",
                "ScoreModel",
                "TimeMapKit",
                "PlaySenseCore",
                .product(name: "Supabase", package: "supabase-swift")
            ]
        ),
        .target(
            name: "LMMDesignSystem",
            dependencies: ["LMMModels"],
            resources: [.process("Resources")]
        ),

        // MARK: - Notation

        .target(name: "ScoreModel", dependencies: []),
        .target(name: "TimeMapKit", dependencies: ["ScoreModel"]),
        .target(
            name: "NotationEngraving",
            dependencies: ["ScoreModel"],
            resources: [
                .copy("Resources/Bravura.otf"),
                .copy("Resources/bravura_metadata.json"),
                .copy("Resources/OFL.txt")
            ]
        ),
        .target(name: "NotationUI", dependencies: ["NotationEngraving", "TimeMapKit", "ScoreModel"]),

        // MARK: - PlaySense

        .target(name: "PlaySenseCore", dependencies: ["ScoreModel"]),
        .target(name: "PlaySenseRealtime"),
        .target(name: "PlaySenseAudio", dependencies: ["PlaySenseCore", "PlaySenseRealtime"]),
        // `PlaySenseAudio` dependency: `BLEOnsetSource` stamps onsets with `GameClock.hostSeconds` (the
        // same host-time domain `t0`/mic onsets use) — `GameClock` is a pure, stateless enum living in
        // PlaySenseAudio (D20). Rather than duplicate/relocate it behind a new seam, PlaySenseBLE takes
        // the same dependency PlaySenseUI already has on PlaySenseAudio; `GameClock` itself has zero
        // dependency back on anything audio-engine-specific, so this doesn't pull in unwanted coupling.
        .target(name: "PlaySenseBLE", dependencies: ["PlaySenseCore", "PlaySenseAudio"]),
        .target(name: "PlaySenseHighway", dependencies: ["PlaySenseCore"]),
        .target(
            name: "PlaySenseUI",
            dependencies: [
                "PlaySenseCore", "PlaySenseAudio", "PlaySenseBLE", "PlaySenseHighway", "ScoreModel", "LMMDesignSystem"
            ]
        ),

        // MARK: - App layer

        .target(
            name: "LMMFeatures",
            dependencies: [
                "LMMData", "LMMDesignSystem", "NotationUI", "PlaySenseUI", "PlaySenseCore", "LMMLocalization"
            ],
            resources: [.process("Resources")]
        ),
        .target(name: "LMMTestSupport", dependencies: ["LMMModels"]),

        // MARK: - Tests

        .testTarget(
            name: "LMMModelsTests",
            dependencies: [
                "LMMModels",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "LMMDataTests",
            dependencies: [
                "LMMData",
                "LMMModels",
                "ScoreModel",
                "TimeMapKit",
                "PlaySenseCore",
                .product(name: "Supabase", package: "supabase-swift"),
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "ScoreModelTests",
            dependencies: [
                "ScoreModel",
                "LMMModels"
            ]
        ),
        .testTarget(
            name: "PlaySenseCoreTests",
            dependencies: [
                "PlaySenseCore",
                "ScoreModel"
            ]
        ),
        .testTarget(
            name: "PlaySenseAudioTests",
            dependencies: [
                "PlaySenseAudio",
                "PlaySenseCore",
                "LMMTestSupport"
            ]
        ),
        .testTarget(
            name: "PlaySenseBLETests",
            dependencies: [
                "PlaySenseBLE",
                "PlaySenseCore",
                "PlaySenseAudio"
            ]
        ),
        .testTarget(
            name: "PlaySenseUITests",
            dependencies: [
                "PlaySenseUI",
                "PlaySenseCore",
                "PlaySenseBLE",
                "PlaySenseHighway",
                "ScoreModel",
                "LMMTestSupport"
            ]
        ),
        .testTarget(
            name: "PlaySenseHighwayTests",
            dependencies: [
                "PlaySenseHighway",
                "PlaySenseCore",
                "ScoreModel",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "TimeMapKitTests",
            dependencies: [
                "TimeMapKit",
                "ScoreModel"
            ]
        ),
        .testTarget(
            name: "NotationEngravingTests",
            dependencies: [
                "NotationEngraving",
                "ScoreModel",
                "LMMTestSupport",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "NotationUITests",
            dependencies: [
                "NotationUI",
                "NotationEngraving",
                "ScoreModel"
            ]
        ),
        .testTarget(
            name: "LMMLocalizationTests",
            dependencies: [
                "LMMLocalization",
                "LMMModels"
            ]
        ),
        .testTarget(
            name: "LMMFeaturesTests",
            dependencies: [
                "LMMFeatures",
                "LMMData",
                "LMMModels",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "LMMDesignSystemTests",
            dependencies: [
                "LMMDesignSystem",
                "LMMModels",
                .product(name: "SnapshotTesting", package: "swift-snapshot-testing")
            ]
        ),
        .testTarget(
            name: "LMMTestSupportTests",
            dependencies: [
                "LMMTestSupport"
            ]
        )
    ]
)
