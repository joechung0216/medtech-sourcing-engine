import { getDbPath, initDb } from "../lib/db.ts";

initDb();
console.log(`SQLite initialized at ${getDbPath()}`);
