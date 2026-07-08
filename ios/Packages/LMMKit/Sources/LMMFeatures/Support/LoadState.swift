import Foundation

/// A tiny async-content state machine used by the screens' `.task` loaders.
enum LoadState<Value> {
    case loading
    case loaded(Value)
    case failed

    var value: Value? {
        if case .loaded(let value) = self { return value }
        return nil
    }
}
