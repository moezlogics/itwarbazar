// Field-by-field compare — replaces lodash `isEqual(pick, pick)` so the
// full lodash bundle stays out of the checkout client chunk.
const COMPARE_FIELDS = [
  "first_name",
  "last_name",
  "address_1",
  "company",
  "postal_code",
  "city",
  "country_code",
  "province",
  "phone",
] as const

export default function compareAddresses(address1: any, address2: any) {
  return COMPARE_FIELDS.every(
    (f) => (address1?.[f] ?? undefined) === (address2?.[f] ?? undefined)
  )
}
