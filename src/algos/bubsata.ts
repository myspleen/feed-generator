import { InvalidRequestError } from '@atproto/xrpc-server'
import { QueryParams } from '../lexicon/types/app/bsky/feed/getFeedSkeleton'
import { AppContext } from '../config'

export const shortname = 'bubsata'

export const handler = async (ctx: AppContext, params: QueryParams) => {
    let builder = ctx.db
        .selectFrom('post')
        .selectAll()
        .where('text', 'like', '%ブフサタ%')
        // .not メソッドの代わりに .where と SQL の NOT 演算子を使用
        .where('text', 'not like', '%サタブフ%')
        .where('text', 'not like', '%リバ%')
        .orderBy('indexedAt', 'desc')
        .orderBy('cid', 'desc')
        .limit(params.limit);

    if (params.cursor) {
        const [indexedAt, cid] = params.cursor.split('::')
        if (!indexedAt || !cid) {
            throw new InvalidRequestError('malformed cursor')
        }
        const timeStr = new Date(parseInt(indexedAt, 10)).toISOString()
        builder = builder
            .where('post.indexedAt', '<', timeStr)
            // 正しい条件のチェーン方法を使用
            .where('post.cid', '<', cid)
    }
    const res = await builder.execute()

    const feed = res.map((row) => ({
        post: row.uri,
    }))

    let cursor: string | undefined
    const last = res.at(-1)
    if (last) {
        cursor = `${new Date(last.indexedAt).getTime()}::${last.cid}`
    }

    return {
        cursor,
        feed,
    }
}
