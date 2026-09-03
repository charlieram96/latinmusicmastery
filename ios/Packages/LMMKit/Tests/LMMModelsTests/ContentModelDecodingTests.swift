import XCTest

@testable import LMMModels

/// Decoding tests for the content-side models (countries, musical styles, courses,
/// course sections, classes, class items) against fixtures captured from the live
/// PostgREST API (or synthetic fixtures where anon RLS returned nothing).
final class ContentModelDecodingTests: XCTestCase {
    func testCountriesDecodeFromLiveFixture() throws {
        let countries = try FixtureLoader.decode([Country].self, from: "countries.json")
        XCTAssertGreaterThanOrEqual(countries.count, 3)

        let colombia = try XCTUnwrap(countries.first { $0.slug == "colombia" })
        XCTAssertEqual(colombia.name, "Colombia")
        XCTAssertEqual(colombia.nameEs, "Colombia")
        XCTAssertNotNil(colombia.descriptionEs)
        XCTAssertNotNil(colombia.createdAt)
        XCTAssertNotNil(colombia.updatedAt)
    }

    func testMusicalStylesDecodeFromLiveFixture() throws {
        let styles = try FixtureLoader.decode([MusicalStyle].self, from: "musical_styles.json")
        XCTAssertGreaterThanOrEqual(styles.count, 3)

        let danzon = try XCTUnwrap(styles.first { $0.slug == "danzon" })
        XCTAssertEqual(danzon.nameEs, "Danzón")
        XCTAssertNil(danzon.description)
        XCTAssertNotNil(danzon.createdAt)
    }

    func testCoursesDecodeFromLiveFixture() throws {
        let courses = try FixtureLoader.decode([Course].self, from: "courses.json")
        XCTAssertGreaterThanOrEqual(courses.count, 3)

        let bass = try XCTUnwrap(courses.first { $0.slug == "latin-jazz-bass" })
        XCTAssertEqual(bass.titleEs, "Jazz Latino Bajo")
        XCTAssertEqual(bass.isFundamentals, false)
        XCTAssertEqual(bass.isMasterClass, false)
        XCTAssertEqual(bass.isPublished, true)
        XCTAssertNotNil(bass.createdAt)
    }

    func testClassesDecodeFromLiveFixture() throws {
        let classes = try FixtureLoader.decode([CourseClass].self, from: "classes.json")
        XCTAssertGreaterThanOrEqual(classes.count, 3)

        let first = classes[0]
        XCTAssertEqual(first.title, "Course Introduction and Platform Overview")
        XCTAssertEqual(first.isFree, false)
        XCTAssertNotNil(first.createdAt)

        // Exact-value check (not just non-nil): the fixture's `created_at` is
        // "2026-06-23T14:34:42.305486+00:00" — pin every component in UTC so a decoder
        // regression that silently shifts by a timezone or truncates fractional seconds
        // to the wrong second would actually fail this test.
        let createdAt = try XCTUnwrap(first.createdAt)
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = try XCTUnwrap(TimeZone(identifier: "UTC"))
        let components = utc.dateComponents([.year, .month, .day, .hour, .minute, .second], from: createdAt)
        XCTAssertEqual(components.year, 2026)
        XCTAssertEqual(components.month, 6)
        XCTAssertEqual(components.day, 23)
        XCTAssertEqual(components.hour, 14)
        XCTAssertEqual(components.minute, 34)
        XCTAssertEqual(components.second, 42)

        let withSpanishTitle = try XCTUnwrap(classes.first { $0.titleEs != nil })
        XCTAssertEqual(withSpanishTitle.titleEs, "Ritmo básico de la cáscara (mano derecha)")
    }

    func testCourseSectionsDecodeWithEmbeddedClassesAndItems() throws {
        let sections = try FixtureLoader.decode(
            [CourseSection].self,
            from: "course_sections_embedded.json"
        )
        XCTAssertEqual(sections.count, 2)

        let welcome = try XCTUnwrap(sections.first { $0.title == "Course Welcome" })
        XCTAssertEqual(welcome.titleEs, "Trabajo de Gullu - Prueba")
        XCTAssertNotNil(welcome.createdAt)

        let embeddedClasses = try XCTUnwrap(welcome.classes)
        XCTAssertEqual(embeddedClasses.count, 1)
        XCTAssertEqual(embeddedClasses[0].items, [])

        let noClassesSection = try XCTUnwrap(sections.first { $0.title == "Expanding the Musical Language" })
        XCTAssertEqual(noClassesSection.classes, [])
    }

    func testClassItemsDecodeFromSyntheticFixture() throws {
        let items = try FixtureLoader.decode([ClassItem].self, from: "class_items.synthetic.json")
        XCTAssertEqual(items.count, 5)

        let video = try XCTUnwrap(items.first { $0.itemType == .video })
        XCTAssertEqual(video.titleEs, "Cáscara Básica — Interpretación")
        XCTAssertNotNil(video.createdAt)
        XCTAssertEqual(video.bpm, 96)
        XCTAssertEqual(ClassItemSubtitle.parse(video.subtitles).map(\.lang), ["en", "es"])

        let exercise = try XCTUnwrap(items.first { $0.itemType == .exercise })
        XCTAssertEqual(exercise.keySignature, "C")
        XCTAssertEqual(exercise.exerciseVideoStartSeconds, 12.5)
        XCTAssertNotNil(exercise.scoreDocumentId)
        XCTAssertNotNil(exercise.activeTimeMapId)

        let jam = try XCTUnwrap(items.first { $0.itemType == .jamSession })
        XCTAssertNotNil(jam.richContent)

        let quiz = try XCTUnwrap(items.first { $0.itemType == .quiz })
        XCTAssertEqual(quiz.question, "Which hand plays the cascara pattern?")
        XCTAssertNotNil(quiz.options)
    }

    func testClassItemTypeUnknownRawValueFallsBackInsteadOfThrowing() throws {
        let items = try FixtureLoader.decode([ClassItem].self, from: "class_items.synthetic.json")
        let future = try XCTUnwrap(items.first { $0.title == "Not-yet-invented item type" })
        XCTAssertEqual(future.itemType, .unknown("FUTURE_TYPE"))
        XCTAssertEqual(future.itemType.rawValue, "FUTURE_TYPE")
    }
}
