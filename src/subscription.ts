import {
  OutputSchema as RepoEvent,
  isCommit,
} from './lexicon/types/com/atproto/sync/subscribeRepos'
import { FirehoseSubscriptionBase, getOpsByType } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: RepoEvent) {
    if (!isCommit(evt)) return;
    const ops = await getOpsByType(evt);

    const postsToDelete = ops.posts.deletes.map((del) => del.uri);
    const postsToCreate = ops.posts.creates
      .filter((create) => {
        const text = create.record.text;
        // メギドと絵、またはメギドとイラストを両方含む投稿のみを取り込む
        return (text.includes('メギド') && (text.includes('絵') || text.includes('イラスト'))) ||
          text.includes('ブフサタ') ||
          text.includes('estampie.work') ||
          text.includes('エウルベ');
      })
      .map((create) => {
        const media = create.record.embed && create.record.embed.$type === 'app.bsky.embed.images' ? 'image' : null;
        let labelsValue = null; 
        if (create.record.labels && Array.isArray(create.record.labels.values) && create.record.labels.values.length > 0) {
          labelsValue = create.record.labels.values[0].val; // 最初の label の val を使用
        }

        return {
          uri: create.uri,
          cid: create.cid,
          did: create.author.did,
          text: create.record.text,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
          media: media,
          labels: labelsValue, // 修正された変数を使用
        };
      });

    if (postsToDelete.length > 0) {
      await this.db
        .deleteFrom('post')
        .where('uri', 'in', postsToDelete)
        .execute();
    }
    if (postsToCreate.length > 0) {
      await this.db
        .insertInto('post')
        .values(postsToCreate)
        .onConflict((oc) => oc.doNothing())
        .execute();
    }
  }
}
