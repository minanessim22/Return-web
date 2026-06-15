/**
 * Person-type categories for identification profiles.
 * These receive medical-notes, age, and relation-aware UI on the public identify page.
 */
const PERSON_CATEGORIES = new Set([
  'child',
  'adult',
  'elderly',
  'person',
  'pet'
]);

/**
 * Returns `true` when the profile represents a person (or pet with medical needs),
 * `false` when it represents a property item (wallet, laptop, bag, etc.).
 *
 * Defaults to `true` (person) when no category is provided, because the
 * original system defaulted to "Child".
 */
export function isPersonProfile(category?: string | null): boolean {
  if (!category) return true;
  return PERSON_CATEGORIES.has(category.trim().toLowerCase());
}
