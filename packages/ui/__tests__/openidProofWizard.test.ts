import { pickSelectedClaims } from '../src/helpers/openidProofWizard'

describe('pickSelectedClaims', () => {
  const output = {
    given_name: 'Alice',
    family_name: 'Doe',
    name: { first: 'Alice', last: 'Doe' },
    address: [
      { street: 'Main St', city: 'Springfield' },
      { street: 'Second St', city: 'Shelbyville' },
    ],
  }

  it('discloses only the selected subset of claims', () => {
    expect(pickSelectedClaims(output, { given_name: true, family_name: true })).toEqual({
      given_name: 'Alice',
      family_name: 'Doe',
    })
  })

  it('never includes unselected claims', () => {
    const result = pickSelectedClaims(output, { given_name: true, family_name: false })
    expect(result).toEqual({ given_name: 'Alice' })
    expect(result).not.toHaveProperty('family_name')
  })

  it('returns an empty payload for an empty selection, never the full output', () => {
    expect(pickSelectedClaims(output, {})).toEqual({})
    // All claims unchecked must also yield nothing — no send-all fallback.
    expect(pickSelectedClaims(output, { given_name: false, family_name: false })).toEqual({})
  })

  it('resolves nested claim paths (name.first) and omits unselected siblings', () => {
    expect(pickSelectedClaims(output, { 'name.first': true })).toEqual({ name: { first: 'Alice' } })
    expect(pickSelectedClaims(output, { 'name.first': true, 'name.last': true })).toEqual({
      name: { first: 'Alice', last: 'Doe' },
    })
  })

  it('normalizes numeric array paths (address.0.street)', () => {
    expect(pickSelectedClaims(output, { 'address.0.street': true })).toEqual({
      address: [{ street: 'Main St' }],
    })
  })

  it('normalizes wildcard array paths (address.city)', () => {
    expect(pickSelectedClaims(output, { 'address.city': true })).toEqual({
      address: { city: ['Springfield', 'Shelbyville'] },
    })
  })

  it('normalizes a wildcard array path with a nested tail (address.city.zip)', () => {
    const nestedOutput = {
      address: [
        { city: { zip: '12345', name: 'A' } },
        { city: { zip: '67890', name: 'B' } },
      ],
    }
    expect(pickSelectedClaims(nestedOutput, { 'address.city.zip': true })).toEqual({
      address: { city: { zip: ['12345', '67890'] } },
    })
  })

  it('drops undefined/null elements from wildcard array resolution instead of leaking null placeholders', () => {
    const sparseOutput = { address: [{ city: 'X' }, null, { street: 'no-city' }] }
    expect(pickSelectedClaims(sparseOutput, { 'address.city': true })).toEqual({
      address: { city: ['X'] },
    })
  })

  it('does not clobber a container when indexed and wildcard paths target the same array', () => {
    // Selection order is preserved from the object; whichever claim is processed
    // first wins, the conflicting sibling is omitted — never a full-payload leak.
    const indexedFirst = pickSelectedClaims(output, { 'address.0.street': true, 'address.city': true })
    expect(indexedFirst.address).toHaveProperty('0')
    expect(indexedFirst).not.toHaveProperty('given_name')

    const wildcardFirst = pickSelectedClaims(output, { 'address.city': true, 'address.0.street': true })
    expect(wildcardFirst.address).toHaveProperty('city')
    // No key from the other selection ever broadens into the payload.
    expect(Object.keys(indexedFirst).sort()).toEqual(['address'])
    expect(Object.keys(wildcardFirst).sort()).toEqual(['address'])
  })

  it('omits unresolvable claim paths instead of broadening the disclosure', () => {
    // Multi-credential mismatch scenario: query-derived keys that do not resolve
    // against this credential's output must NOT fall back to sending all claims.
    expect(pickSelectedClaims(output, { no_such_claim: true })).toEqual({})
    const result = pickSelectedClaims(output, { given_name: true, no_such_claim: true })
    expect(result).toEqual({ given_name: 'Alice' })
  })
})
