import { buildDcqlVpToken, evaluateDcqlQuery } from '../src'

import { dcqlQueryFixture, walletCredentialsFixture } from '../__fixtures__/dcql-queries'

describe('DCQL evaluator', () => {
  it('matches wallet credentials by format and claims', () => {
    const result = evaluateDcqlQuery(dcqlQueryFixture, walletCredentialsFixture)

    expect(result.can_be_satisfied).toBe(true)
    expect(result.matches.identity_sd_jwt).toHaveLength(1)
    expect(result.matches.identity_mdoc).toHaveLength(1)
    expect(result.credential_sets?.[0]).toMatchObject({
      required: true,
      satisfied: true,
    })
  })

  it('marks unsatisfied queries when claims are missing', () => {
    const result = evaluateDcqlQuery(dcqlQueryFixture, [
      {
        format: 'vc+sd-jwt',
        id: 'sd-jwt-1',
        presentation: 'sd-jwt-presentation',
      },
    ])

    expect(result.can_be_satisfied).toBe(false)
    expect(result.matches.identity_sd_jwt).toHaveLength(0)
    expect(result.matches.identity_mdoc).toHaveLength(0)
  })

  it('handles optional credential sets and credentials without claim constraints', () => {
    const result = evaluateDcqlQuery(
      {
        credential_sets: [
          {
            options: [],
            required: false,
          },
        ],
        credentials: [
          {
            format: ['jwt_vc_json', 'ldp_vc'],
            id: 'w3c_credential',
          },
        ],
      },
      [
        {
          credentialFormat: 'jwt_vc_json',
          raw: {
            jwt: 'raw-jwt-vc',
          },
        },
      ]
    )

    expect(result.can_be_satisfied).toBe(true)
    expect(result.matches.w3c_credential[0].presentation).toEqual({
      jwt: 'raw-jwt-vc',
    })
  })

  it('handles JSON bracket paths and empty claim definitions', () => {
    const result = evaluateDcqlQuery(
      {
        credentials: [
          {
            claims: [
              {
                path: ["$['credentialSubject']['given_name']"],
              },
              {},
            ],
            format: 'ldp_vc',
            id: 'ldp_identity',
          },
        ],
      },
      [
        {
          credentialSubject: {
            given_name: 'Kodrat',
          },
          format: 'ldp_vc',
          vpToken: {
            proof: 'ldp-proof',
          },
        },
      ]
    )

    expect(result.can_be_satisfied).toBe(true)
    expect(result.matches.ldp_identity[0].presentation).toEqual({
      proof: 'ldp-proof',
    })
  })

  it('matches jwt vc json credentials with root, segment, string, and relative claim paths', () => {
    const queryForPath = (path: Array<string | number | null>) => ({
      credentials: [
        {
          claims: [{ path }],
          format: 'jwt_vc_json' as const,
          id: 'UniversityDegree',
        },
      ],
    })
    const rawCredential = {
      credentialSubject: {
        degree: 'Bachelor of Science',
      },
      format: 'jwt_vc_json',
      id: 'degree-raw',
      presentation: 'degree-raw-presentation',
    }
    const recordCredential = {
      firstCredential: {
        jsonCredential: {
          credentialSubject: {
            degree: 'Bachelor of Science',
          },
          type: ['VerifiableCredential', 'UniversityDegree'],
        },
      },
      id: 'degree-record',
      type: 'W3cCredentialRecord',
    }

    for (const path of [
      ['$', 'credentialSubject', 'degree'],
      ['credentialSubject', 'degree'],
      ['$.credentialSubject.degree'],
      ['degree'],
    ]) {
      const rawResult = evaluateDcqlQuery(queryForPath(path), [rawCredential])
      const recordResult = evaluateDcqlQuery(queryForPath(path), [recordCredential])

      expect(rawResult.can_be_satisfied).toBe(true)
      expect(recordResult.can_be_satisfied).toBe(true)
      expect(rawResult.matches.UniversityDegree).toHaveLength(1)
      expect(recordResult.matches.UniversityDegree).toHaveLength(1)
      expect(recordResult.credential_matches.UniversityDegree.valid_credentials?.[0]).toMatchObject({
        record: recordCredential,
        claims: {
          valid_claim_sets: [
            {
              output: {
                credentialSubject: {
                  degree: 'Bachelor of Science',
                },
              },
            },
          ],
        },
      })
    }

    const missingResult = evaluateDcqlQuery(queryForPath(['$', 'credentialSubject', 'missing']), [rawCredential])
    expect(missingResult.can_be_satisfied).toBe(false)
    expect(missingResult.matches.UniversityDegree).toHaveLength(0)
  })

  it('builds vp_token values keyed by credential query id', () => {
    expect(
      buildDcqlVpToken({
        identity_mdoc: [walletCredentialsFixture[1]],
        identity_sd_jwt: [walletCredentialsFixture[0]],
      })
    ).toEqual({
      identity_mdoc: [
        {
          deviceResponse: 'mdoc-presentation',
        },
      ],
      identity_sd_jwt: ['sd-jwt-presentation'],
    })
  })

  it('passes through string presentations when building vp_token values', () => {
    expect(
      buildDcqlVpToken({
        identity_sd_jwt: ['already-presented'],
      })
    ).toEqual({
      identity_sd_jwt: ['already-presented'],
    })
  })
})
