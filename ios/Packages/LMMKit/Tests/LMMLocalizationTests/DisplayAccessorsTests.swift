import XCTest

@testable import LMMLocalization
import LMMModels

/// Smoke tests proving the `display*(_:)` accessors wire the right en/es field pairs into
/// `Localize.pick`/`pickValue` for each A2 model. `LocalizeTests` already covers the pick/
/// pickValue edge cases exhaustively, so these only need one row per shape (es-present,
/// es-blank, quiz options substitution).
final class DisplayAccessorsTests: XCTestCase {
    func testCourseDisplayTitleAndDescription() throws {
        let course = try decode(Course.self, json: """
        {
          "id": "aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa",
          "musical_style_id": null,
          "title": "Bass Fundamentals",
          "title_es": "Fundamentos de Bajo",
          "slug": "bass-fundamentals",
          "description": "Learn the basics",
          "description_es": "   ",
          "difficulty": null,
          "instrument": "Bass",
          "is_fundamentals": true,
          "is_master_class": false,
          "is_published": true,
          "order_index": 0,
          "preview_video_url": null,
          "thumbnail_url": null,
          "teacher_id": null,
          "teacher_name": null,
          "teacher_bio": null,
          "teacher_image_url": null,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(course.displayTitle(.es), "Fundamentos de Bajo")
        XCTAssertEqual(course.displayTitle(.en), "Bass Fundamentals")
        // description_es is blank, so both locales fall back to the English description.
        XCTAssertEqual(course.displayDescription(.es), "Learn the basics")
        XCTAssertEqual(course.displayDescription(.en), "Learn the basics")
    }

    func testMusicalStyleDisplayNameAndDescription() throws {
        let style = try decode(MusicalStyle.self, json: """
        {
          "id": "bbbbbbbb-0000-4bbb-8bbb-bbbbbbbbbbbb",
          "country_id": "cccccccc-0000-4ccc-8ccc-cccccccccccc",
          "name": "Danzon",
          "name_es": "Danzón",
          "slug": "danzon",
          "description": null,
          "description_es": null,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(style.displayName(.es), "Danzón")
        XCTAssertEqual(style.displayName(.en), "Danzon")
        XCTAssertNil(style.displayDescription(.es))
    }

    func testCountryDisplayNameAndDescription() throws {
        let country = try decode(Country.self, json: """
        {
          "id": "dddddddd-0000-4ddd-8ddd-dddddddddddd",
          "name": "Colombia",
          "name_es": "Colombia",
          "slug": "colombia",
          "description": "Home of cumbia",
          "description_es": "Cuna de la cumbia",
          "image_url": null,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(country.displayName(.es), "Colombia")
        XCTAssertEqual(country.displayDescription(.es), "Cuna de la cumbia")
        XCTAssertEqual(country.displayDescription(.en), "Home of cumbia")
    }

    func testCourseSectionDisplayTitleAndDescription() throws {
        let section = try decode(CourseSection.self, json: """
        {
          "id": "eeeeeeee-0000-4eee-8eee-eeeeeeeeeeee",
          "course_id": "aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa",
          "title": "Welcome",
          "title_es": "Bienvenida",
          "description": null,
          "description_es": null,
          "order_index": 0,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(section.displayTitle(.es), "Bienvenida")
        XCTAssertEqual(section.displayTitle(.en), "Welcome")
    }

    func testCourseClassDisplayTitleAndDescription() throws {
        let courseClass = try decode(CourseClass.self, json: """
        {
          "id": "ffffffff-0000-4fff-8fff-ffffffffffff",
          "section_id": "eeeeeeee-0000-4eee-8eee-eeeeeeeeeeee",
          "title": "Intro",
          "title_es": "",
          "description": null,
          "description_es": null,
          "order_index": 0,
          "is_free": true,
          "created_at": null,
          "updated_at": null
        }
        """)

        // title_es is an empty string, so es falls back to English too.
        XCTAssertEqual(courseClass.displayTitle(.es), "Intro")
        XCTAssertEqual(courseClass.displayTitle(.en), "Intro")
    }

    func testClassItemDisplayTitleAndDescription() throws {
        let item = try decode(ClassItem.self, json: """
        {
          "id": "11111111-0000-4111-8111-111111111111",
          "class_id": "ffffffff-0000-4fff-8fff-ffffffffffff",
          "item_type": "VIDEO",
          "title": "Cascara Basics",
          "title_es": "Cáscara Básica",
          "description": "Watch closely",
          "description_es": null,
          "order_index": 0,
          "rich_content": null,
          "video_url": null,
          "video_duration_seconds": null,
          "audio_url": null,
          "soundslice_embed_url": null,
          "subtitles": [],
          "bpm": null,
          "key_signature": null,
          "score_document_id": null,
          "active_time_map_id": null,
          "exercise_time_map_id": null,
          "exercise_video_url": null,
          "exercise_video_start_seconds": 0,
          "question": null,
          "question_type": null,
          "options": null,
          "correct_answer": null,
          "explanation": null,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(item.displayTitle(.es), "Cáscara Básica")
        // description_es is nil, so both locales fall back to the English description.
        XCTAssertEqual(item.displayDescription(.es), "Watch closely")
    }

    func testQuizQuestionDisplayQuestionExplanationAndOptions() throws {
        let question = try decode(QuizQuestion.self, json: """
        {
          "id": "22222222-0000-4222-8222-222222222222",
          "class_item_id": "11111111-0000-4111-8111-111111111111",
          "order_index": 0,
          "question": "Which hand plays clave?",
          "question_es": "¿Qué mano toca la clave?",
          "question_type": "multiple_choice",
          "options": { "choices": [{ "id": "r", "text": "Right hand" }] },
          "options_es": { "choices": [{ "id": "r", "text": "Mano derecha" }] },
          "correct_answer": "r",
          "explanation": "The right hand traditionally plays clave.",
          "explanation_es": null,
          "image_url": null,
          "audio_url": null,
          "created_at": null,
          "updated_at": null
        }
        """)

        XCTAssertEqual(question.displayQuestion(.es), "¿Qué mano toca la clave?")
        XCTAssertEqual(question.displayQuestion(.en), "Which hand plays clave?")
        // explanation_es is nil, so both locales fall back to the English explanation.
        XCTAssertEqual(question.displayExplanation(.es), "The right hand traditionally plays clave.")

        let optionsEs = try XCTUnwrap(question.displayOptions(.es))
        XCTAssertEqual(optionsEs.choices?.first?.text, "Mano derecha")
        let optionsEn = try XCTUnwrap(question.displayOptions(.en))
        XCTAssertEqual(optionsEn.choices?.first?.text, "Right hand")
    }

    private func decode<T: Decodable>(_ type: T.Type, json: String) throws -> T {
        try JSONDecoder.lmm.decode(T.self, from: Data(json.utf8))
    }
}
