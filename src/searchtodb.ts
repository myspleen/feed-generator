// フィード作成前の投稿もDBに追加するスクリプト
import https from 'https';
import dotenv from 'dotenv';
import { createDb, Database } from './db';

dotenv.config();

async function fetchSearchResults(query: string, limit: number = 100, cursor: string = ''): Promise<any[]> {
    let url = `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', async () => {
                try {
                    const result = JSON.parse(data);
                    if (result.cursor && result.posts.length > 0) {
                        const nextResults = await fetchSearchResults(query, limit, result.cursor);
                        resolve([...result.posts, ...nextResults]);
                    } else {
                        resolve(result.posts);
                    }
                } catch (error) {
                    reject(error);
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

async function saveSearchResultsToDb(db: Database, posts: any[]) {
    for (const post of posts) {
        // 画像の添付があればmediaカラムにimageを挿入
        const media = post.record.embed && post.record.embed.$type === 'app.bsky.embed.images' ? 'image' : null;
        // 同じuriを持つレコードがデータベースに存在するか確認
        const exists = await db
            .selectFrom('post')
            .select('uri')
            .where('uri', '=', post.uri)
            .execute();

        // レコードが存在しない場合のみ挿入を実行
        if (exists.length === 0) {
            await db
                .insertInto('post')
                .values({
                    uri: post.uri,
                    cid: post.cid,
                    text: post.record.text,
                    indexedAt: post.indexedAt,
                    media: media,
                })
                .execute();
            // 取り込めたtextを表示(消してもOK)
            console.log(`Added post to database: ${post.record.text}`);
        }
    }
}

async function main() {
    try {
        const dbLocation = maybeStr(process.env.FEEDGEN_SQLITE_LOCATION);
        if (!dbLocation) {
            console.error('Database location is not defined.');
            process.exit(1);
        }
        const db = createDb(dbLocation);
        const queries = ['ブフサタ', 'エウルベ', 'メギド イラスト', 'メギド 絵']; // 検索クエリのリスト

        for (const query of queries) {
            const searchResults = await fetchSearchResults(query);
            await saveSearchResultsToDb(db, searchResults);
            console.log(`Search results for query "${query}" saved to database.`);
        }
    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1); // エラーが発生した場合終了
    }
}

const maybeStr = (val?: string) => val;

main();