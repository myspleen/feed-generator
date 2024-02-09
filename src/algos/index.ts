import { AppContext } from '../config'
import {
  QueryParams,
  OutputSchema as AlgoOutput,
} from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import * as bubsata from './bubsata'
import * as eurube from './eurube'
import * as nijimiss from './nijimiss'

type AlgoHandler = (ctx: AppContext, params: QueryParams) => Promise<AlgoOutput>

const algos: Record<string, AlgoHandler> = {
  [bubsata.shortname]: bubsata.handler,
  [eurube.shortname]: eurube.handler,
  [nijimiss.shortname]: nijimiss.handler,
}

export default algos
