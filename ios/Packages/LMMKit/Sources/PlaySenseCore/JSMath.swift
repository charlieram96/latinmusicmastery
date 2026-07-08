import Foundation

/// Replica of JavaScript's `Math.round`: nearest integer, halves toward +∞. Differs from
/// Swift's `rounded()` (halves away from zero) on every negative half — e.g.
/// `Math.round(-2.5) === -2` but `(-2.5).rounded() == -3`. Every rounding site ported
/// from `lib/play-sense` MUST use this.
///
/// Implemented via the exact fraction (`x - floor(x)` is exact for all finite doubles —
/// Sterbenz's lemma covers `|x| >= 1`, and the subtraction is trivially exact below
/// that), NOT the folk `floor(x + 0.5)`, which is wrong for 0.49999999999999994 (the
/// largest double below 0.5: adding 0.5 rounds up to exactly 1.0).
func jsRound(_ value: Double) -> Double {
    guard value.isFinite else { return value }
    let floorValue = value.rounded(.down)
    let fraction = value - floorValue
    return fraction < 0.5 ? floorValue : floorValue + 1
}

extension Array {
    /// Stable sort (matching JS `Array.prototype.sort`, spec-stable since ES2019).
    /// Swift's `sorted(by:)` is NOT guaranteed stable, and the scoring code sorts arrays
    /// that routinely contain ties (chord notes share a timestamp), where original order
    /// is observable through `eventIndex`.
    func stableSorted(by areInIncreasingOrder: (Element, Element) -> Bool) -> [Element] {
        enumerated()
            .sorted { lhs, rhs in
                if areInIncreasingOrder(lhs.element, rhs.element) { return true }
                if areInIncreasingOrder(rhs.element, lhs.element) { return false }
                return lhs.offset < rhs.offset
            }
            .map(\.element)
    }
}
