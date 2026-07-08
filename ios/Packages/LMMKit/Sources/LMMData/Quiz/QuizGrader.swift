import Foundation
import LMMLocalization
import LMMModels

/// Literal Swift port of `lib/quiz/grading.ts` — pure, no UI, no I/O. Every function here must
/// keep exact parity with the TS source (including `shuffleStable`'s floating-point quirks) so a
/// quiz built on the web behaves identically when taken on iOS.
///
/// `grade`/`correctAnswerLabel` take a `locale` and read `question.displayOptions(locale)` rather
/// than the raw `question.options`. This mirrors a genuine (if easy-to-miss) web behavior: the web
/// never calls a locale accessor inside `gradeQuestion`/`QuestionInput` at all — instead,
/// `components/class-viewer/class-item-renderer.tsx` calls `localizeRows(questions, locale,
/// QUIZ_FIELDS)` *before* handing questions to `QuizRunner`, which overwrites `row.options` in
/// place with `options_es` when present. By the time `gradeQuestion` runs, `q.options` already
/// *is* the locale-resolved value. That only changes grading outcomes for `fill_in_blank`
/// (`blanks[].answer`) and `matching_pairs` (`pairs[].right`) — the two option shapes that carry
/// literal answer *text* rather than a locale-invariant id — but reading `displayOptions(locale)`
/// uniformly (instead of forking behavior per question type) keeps this simpler and is a no-op
/// for the id-keyed types (`correctAnswer` itself has no `_es` column, so it's never overlaid,
/// same as the web).
public enum QuizGrader {
    // MARK: - norm

    /// Case/whitespace-insensitive comparison key. TS: `s.toLowerCase().trim()`.
    public static func norm(_ string: String) -> String {
        string.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - shuffleStable

    /// Stable shuffle seeded by a string so option order doesn't reshuffle on every render.
    ///
    /// TS:
    /// ```
    /// let h = 0
    /// for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    /// const a = [...arr]
    /// for (let i = a.length - 1; i > 0; i--) {
    ///   h = (h * 1103515245 + 12345) & 0x7fffffff
    ///   const j = h % (i + 1)
    ///   ;[a[i], a[j]] = [a[j], a[i]]
    /// }
    /// return a
    /// ```
    ///
    /// The seed-hash loop stays within `UInt32` range at every step (`>>> 0` truncates each
    /// iteration, and `h * 31` for `h < 2^32` never exceeds `2^53`), so it's exact integer
    /// arithmetic — `UInt32` with wrapping ops reproduces it precisely.
    ///
    /// The per-swap step is a different story: `h * 1103515245` routinely exceeds
    /// `Number.MAX_SAFE_INTEGER` (2^53) for `h` in the multi-billion range the seed loop can
    /// produce, so the *actual* JS runtime silently rounds that multiplication to the nearest
    /// representable `Double` before the `& 0x7fffffff` mask is applied. To stay bit-for-bit
    /// identical with the web (not just "an LCG with the same constants"), this port carries `h`
    /// as a `Double` through the swap loop too, using native Swift `Double` arithmetic — which is
    /// the same IEEE-754 binary64 as a JS `Number` — so the same rounding happens here.
    ///
    /// Single-letter names (`h`, `i`, `j`) deliberately mirror the TS source's own variable names
    /// 1:1 so the port stays auditable line-by-line against `grading.ts`, matching the convention
    /// `LMMColor`'s hsl math uses for the same reason.
    public static func shuffleStable<Element>(_ items: [Element], seed: String) -> [Element] {
        // swiftlint:disable identifier_name
        var hash: UInt32 = 0
        for unit in seed.utf16 { // matches JS `charCodeAt` (UTF-16 code units)
            hash = hash &* 31 &+ UInt32(unit)
        }

        var array = items
        var h = Double(hash)
        var i = array.count - 1
        while i > 0 {
            // Double `*`/`+` are IEEE-754 binary64, identical to a JS Number — this reproduces the
            // web's precision loss instead of avoiding it. See doc comment above.
            let stepped = h * 1_103_515_245.0 + 12_345.0
            // `& 0x7fffffff` in JS applies ToInt32 first; since `stepped` is always a non-negative
            // integer-valued Double here, taking it mod 2^32 as UInt64 and masking the low 31 bits
            // is equivalent (and always yields the same non-negative result the JS AND does).
            let masked = UInt64(stepped) & 0x7fff_ffff
            h = Double(masked)
            let j = Int(masked) % (i + 1)
            array.swapAt(i, j)
            i -= 1
        }
        return array
        // swiftlint:enable identifier_name
    }

    /// The seed `shuffleStable` is keyed by throughout the runner: the question's id, rendered
    /// exactly as Postgres/the JSON API would (lowercase) — `UUID.uuidString` is uppercase by
    /// default and would silently produce a *different* shuffle order than the web for the same
    /// question.
    public static func shuffleSeed(for question: QuizQuestion) -> String {
        question.id.uuidString.lowercased()
    }

    // MARK: - grade

    /// Grades a single question against the student's answer. TS: `gradeQuestion`. Broken into one
    /// private helper per question type — both to stay under a sane per-function complexity, and
    /// because it mirrors the TS source's own case-by-case structure more directly than one giant
    /// switch body would.
    public static func grade(_ question: QuizQuestion, locale: AppLocale, answer: QuizAnswer) -> Bool {
        let opts = question.displayOptions(locale)
        switch question.questionType {
        case "multiple_choice", "audio_choice":
            return gradeChoice(question, answer: answer)
        case "instrument_assembly":
            return gradeInstrumentAssembly(opts, answer: answer)
        case "true_false":
            return gradeTrueFalse(question, answer: answer)
        case "text_answer", "audio":
            return gradeText(question, answer: answer)
        case "fill_in_blank":
            return gradeFillInBlank(opts, answer: answer)
        case "matching_pairs":
            return gradeMatchingPairs(opts, answer: answer)
        case "ordering_sequence":
            return gradeOrderingSequence(opts, answer: answer)
        default:
            return false
        }
    }

    private static func gradeChoice(_ question: QuizQuestion, answer: QuizAnswer) -> Bool {
        guard case .choice(let value) = answer,
              let correct = question.correctAnswer, !correct.isEmpty else { return false }
        return value == correct
    }

    private static func gradeInstrumentAssembly(_ opts: QuizOptions?, answer: QuizAnswer) -> Bool {
        let parts = opts?.parts ?? []
        guard !parts.isEmpty else { return false }
        let placed: [String: String] = {
            if case .assembly(let value) = answer { return value }
            return [:]
        }()
        return parts.allSatisfy { part in
            guard let id = part.id else { return false }
            return placed[id] == part.correctZoneId
        }
    }

    private static func gradeTrueFalse(_ question: QuizQuestion, answer: QuizAnswer) -> Bool {
        guard case .bool(let value) = answer else { return false }
        return norm(value ? "true" : "false") == norm(question.correctAnswer ?? "")
    }

    private static func gradeText(_ question: QuizQuestion, answer: QuizAnswer) -> Bool {
        guard case .text(let value) = answer else { return false }
        return norm(value) == norm(question.correctAnswer ?? "")
    }

    private static func gradeFillInBlank(_ opts: QuizOptions?, answer: QuizAnswer) -> Bool {
        let blanks = opts?.blanks ?? []
        guard !blanks.isEmpty else { return false }
        let given: [String: String] = {
            if case .blanks(let value) = answer { return value }
            return [:]
        }()
        return blanks.allSatisfy { entry in
            guard let id = entry.id else { return false }
            return norm(given[id] ?? "") == norm(entry.answer ?? "")
        }
    }

    private static func gradeMatchingPairs(_ opts: QuizOptions?, answer: QuizAnswer) -> Bool {
        let pairs = opts?.pairs ?? []
        guard !pairs.isEmpty else { return false }
        let given: [String: String] = {
            if case .pairs(let value) = answer { return value }
            return [:]
        }()
        return pairs.allSatisfy { entry in
            guard let id = entry.id else { return false }
            return norm(given[id] ?? "") == norm(entry.right ?? "")
        }
    }

    private static func gradeOrderingSequence(_ opts: QuizOptions?, answer: QuizAnswer) -> Bool {
        let items = opts?.items ?? []
        guard case .ordering(let order) = answer else { return false }
        guard order.count == items.count, !items.isEmpty else { return false }
        var correctPositionById: [String: Int] = [:]
        for item in items {
            guard let id = item.id, let position = item.correctPosition else { continue }
            correctPositionById[id] = position
        }
        for (index, id) in order.enumerated() where correctPositionById[id] != index {
            return false
        }
        return true
    }

    // MARK: - hasAnswer

    /// Whether the student has provided enough of an answer to allow grading. TS: `hasAnswer`.
    public static func hasAnswer(_ question: QuizQuestion, answer: QuizAnswer) -> Bool {
        switch question.questionType {
        case "fill_in_blank":
            if case .blanks(let value) = answer { return !value.isEmpty }
            return false
        case "matching_pairs":
            if case .pairs(let value) = answer { return !value.isEmpty }
            return false
        case "instrument_assembly":
            if case .assembly(let value) = answer { return !value.isEmpty }
            return false
        case "ordering_sequence":
            return true
        default:
            return hasNonEmptyStringLikeAnswer(answer)
        }
    }

    /// The web's `hasAnswer` default branch: `typeof answer === 'string' && answer.trim().length
    /// > 0` — covers multiple_choice, true_false, text_answer, audio, audio_choice.
    private static func hasNonEmptyStringLikeAnswer(_ answer: QuizAnswer) -> Bool {
        switch answer {
        case .choice(let value), .text(let value):
            return !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case .bool:
            return true
        default:
            return false
        }
    }

    // MARK: - correctAnswerLabel

    /// Friendly label for the correct answer, used on the results review. TS: `correctAnswerLabel`.
    public static func correctAnswerLabel(_ question: QuizQuestion, locale: AppLocale) -> String {
        let opts = question.displayOptions(locale)
        switch question.questionType {
        case "multiple_choice":
            let choices = opts?.choices ?? []
            if let match = choices.first(where: { $0.id == question.correctAnswer }), let text = match.text {
                return text
            }
            return question.correctAnswer ?? ""

        case "audio_choice":
            let choices = opts?.choices ?? []
            guard let index = choices.firstIndex(where: { $0.id == question.correctAnswer }) else {
                return question.correctAnswer ?? ""
            }
            let trimmed = choices[index].text?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let trimmed, !trimmed.isEmpty { return trimmed }
            return "Clip \(index + 1)"

        case "instrument_assembly":
            let parts = opts?.parts ?? []
            let zones = opts?.zones ?? []
            var zoneLabelById: [String: String] = [:]
            for zone in zones {
                guard let id = zone.id else { continue }
                zoneLabelById[id] = zone.label ?? ""
            }
            return parts
                .map { part -> String in
                    let label = part.label ?? ""
                    let zoneLabel = zoneLabelById[part.correctZoneId ?? ""] ?? "?"
                    return "\(label) → \(zoneLabel)"
                }
                .joined(separator: ", ")

        default:
            return question.correctAnswer ?? ""
        }
    }
}
