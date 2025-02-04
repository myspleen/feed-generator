// フィード作成前の投稿もDBに追加するスクリプト
import https from 'https';
import dotenv from 'dotenv';
import { createDb, Database } from './db';

dotenv.config();

async function fetchSearchResults(query: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        let url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}`;

        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
            },
        };

        https.get(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    // HTMLの場合はここで失敗する
                    const json = JSON.parse(data);
                    // 念のため posts がなければ空配列に
                    resolve(json.posts || []);
                } catch (error) {
                    // 何が返ってきてるか表示
                    console.error('Response body:', data);
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
        let labelsValue = null;
        if (post.record.labels && Array.isArray(post.record.labels.values) && post.record.labels.values.length > 0) {
            labelsValue = post.record.labels.values[0].val; // 最初の label の val を使用
        }
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
                    did: post.author.did,
                    text: post.record.text,
                    indexedAt: post.indexedAt,
                    media: media,
                    labels: labelsValue, // 修正された変数を使用
                })
                .execute();
            // 取り込めたtextを表示(消してもOK)

            console.log(`Added post to database: ${labelsValue}`);
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