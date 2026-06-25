import type { DcqlQuery, WalletCredential } from '../src'

export const dcqlQueryFixture: DcqlQuery = {
  credential_sets: [
    {
      options: [['identity_sd_jwt'], ['identity_mdoc']],
      required: true,
    },
  ],
  credentials: [
    {
      claims: [
        {
          path: ['$.given_name'],
        },
      ],
      format: 'vc+sd-jwt',
      id: 'identity_sd_jwt',
    },
    {
      claims: [
        {
          claim_name: 'given_name',
          namespace: 'org.iso.18013.5.1',
        },
      ],
      format: 'mso_mdoc',
      id: 'identity_mdoc',
    },
  ],
}

export const walletCredentialsFixture: WalletCredential[] = [
  {
    format: 'vc+sd-jwt',
    given_name: 'Kodrat',
    id: 'sd-jwt-1',
    presentation: 'sd-jwt-presentation',
  },
  {
    format: 'mso_mdoc',
    id: 'mdoc-1',
    namespaces: {
      'org.iso.18013.5.1': {
        family_name: 'Example',
        given_name: 'Kodrat',
      },
    },
    presentation: {
      deviceResponse: 'mdoc-presentation',
    },
  },
]
