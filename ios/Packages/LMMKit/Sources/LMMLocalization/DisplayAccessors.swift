import LMMModels

// NOTE: subtitle tracks are never overlaid. `ClassItem.subtitlesEnUrl`/`subtitlesEsUrl` are not
// a canonical/`_es` overlay pair like the fields below — both language tracks must stay
// simultaneously available to the video player (for in-player track switching), so there is no
// `displaySubtitlesUrl(_:)` accessor here. Mirrors the comment on `ITEM_FIELDS` in
// `lib/i18n/localize.ts`.

public extension Course {
    func displayTitle(_ locale: AppLocale) -> String {
        Localize.pick(locale, title, titleEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension MusicalStyle {
    func displayName(_ locale: AppLocale) -> String {
        Localize.pick(locale, name, nameEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension Country {
    func displayName(_ locale: AppLocale) -> String {
        Localize.pick(locale, name, nameEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension CourseSection {
    func displayTitle(_ locale: AppLocale) -> String {
        Localize.pick(locale, title, titleEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension CourseClass {
    func displayTitle(_ locale: AppLocale) -> String {
        Localize.pick(locale, title, titleEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension ClassItem {
    func displayTitle(_ locale: AppLocale) -> String {
        Localize.pick(locale, title, titleEs)
    }

    func displayDescription(_ locale: AppLocale) -> String? {
        Localize.pick(locale, description, descriptionEs)
    }
}

public extension QuizQuestion {
    func displayQuestion(_ locale: AppLocale) -> String {
        Localize.pick(locale, question, questionEs)
    }

    func displayExplanation(_ locale: AppLocale) -> String? {
        Localize.pick(locale, explanation, explanationEs)
    }

    func displayOptions(_ locale: AppLocale) -> QuizOptions? {
        Localize.pickValue(locale, options, optionsEs)
    }
}
