import { IndyVdrPoolConfig } from '@credo-ts/indy-vdr'

import _ledgers from './ledgers.json'

// type-check the json
const ledgers = _ledgers as IndyVdrPoolConfig[]

export default ledgers
