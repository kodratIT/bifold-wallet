import * as openid4vp from '@openid4vc/openid4vp'

import { openId4VpPackageName } from '../src'

describe('@bifold/openid4vp package scaffold', () => {
  it('exports a public package marker', () => {
    expect(openId4VpPackageName).toBe('@bifold/openid4vp')
  })

  it('can import @openid4vc/openid4vp in the test environment', () => {
    expect(openid4vp).toBeDefined()
    expect(Object.keys(openid4vp).length).toBeGreaterThan(0)
  })
})
