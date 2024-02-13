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

        return {
          uri: create.uri,
          cid: create.cid,
          text: create.record.text,
          replyParent: create.record?.reply?.parent.uri ?? null,
          replyRoot: create.record?.reply?.root.uri ?? null,
          indexedAt: new Date().toISOString(),
          media: media,
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
