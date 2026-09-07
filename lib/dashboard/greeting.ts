export type GreetingKey = 'morning' | 'afternoon' | 'evening'

/** Buckets an hour (0–23) into the greeting used on the dashboard. */
export function greetingKey(hour: number): GreetingKey {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}
