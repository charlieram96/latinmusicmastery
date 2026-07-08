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
        .target(name: "NotationEngraving", dependencies: ["ScoreModel"]),
        .target(name: "NotationUI", dependencies: ["NotationEngraving", "TimeMapKit"]),

        // MARK: - PlaySense

        .target(name: "PlaySenseCore", dependencies: ["ScoreModel"]),
        .target(name: "PlaySenseAudio", dependencies: ["PlaySenseCore"]),
        .target(name: "PlaySenseBLE", dependencies: ["PlaySenseCore"]),
        .target(name: "PlaySenseHighway", dependencies: ["PlaySenseCore"]),
        .target(
            name: "PlaySenseUI",
            dependencies: ["PlaySenseCore", "PlaySenseAudio", "PlaySenseBLE", "PlaySenseHighway", "LMMDesignSystem"]
        ),

        // MARK: - App layer

        .target(
            name: "LMMFeatures",
            dependencies: ["LMMData", "LMMDesignSystem", "NotationUI", "PlaySenseUI", "LMMLocalization"],
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
            name: "TimeMapKitTests",
            dependencies: [
                "TimeMapKit",
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
        )
    ]
)
