import { prepareEnv } from './env.mjs';
import { run,root } from './process.mjs';
import path from 'node:path';
await prepareEnv();
if(process.env.NODE_ENV==='production')throw new Error('Integration tests must not run in production.');
const mariadb=(await import('mariadb')).default;
const name=`${process.env.DB_NAME}_test`,user=process.env.DB_USER;
if(!/^[a-zA-Z0-9_]+_test$/.test(name) || !/^[a-zA-Z0-9_]+$/.test(user))throw new Error('Invalid test database name.');
const db=await mariadb.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:'root',password:process.env.DB_ROOT_PASSWORD});
try { await db.query(`CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);await db.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO ?@?`,[user,'127.0.0.1']); }finally{await db.end();}
const env={...process.env,NODE_ENV:'test',DB_NAME:name,PROVIDER_MODE:'development'};
const tsx=path.join(root,'node_modules/tsx/dist/cli.mjs');
await run(process.execPath,[tsx,'apps/api/src/database/migrate.ts'],{env});
await run(process.execPath,[tsx,'--test','--test-concurrency=1','tests/integration/*.test.ts'],{env});
