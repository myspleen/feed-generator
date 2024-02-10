// フィード作成前の投稿もDBに追加するスクリプト
import https from 'https';
import { createDb, Database } from './db'; // 正確なパスに注意
import dotenv from 'dotenv';
dotenv.config();

function fetchSearchResults(query: string, limit: number = 100): Promise<any[]> {
    return new Promise((resolve, reject) => {
        // クエリパラメータにlimitを追加
        const url = `https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=${limit}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    resolve(result.posts);
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
        // まず、同じuriを持つレコードがデータベースに存在するか確認
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
                })
                .execute();
        }
    }
}


async function main() {
    try {
        const dbLocation = "./db/mydatabase.db"; // データベースファイルのパス
        const db = createDb(dbLocation);
        const queries = ['クエリ1', 'クエリ2']; // 検索クエリのリスト

        for (const query of queries) {
            const searchResults = await fetchSearchResults(query);
            await saveSearchResultsToDb(db, searchResults);
            console.log(`Search results for query "${query}" saved to database.`);
        }
    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1); // エラーが発生した場合にプログラムを終了させる
    }
}

main();
//ビルド後 `node searchtodb.js`　で実行