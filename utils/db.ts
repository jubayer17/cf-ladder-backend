import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";

let dbInstance: Database | null = null;

// Open SQLite database (singleton pattern)
export const openDB = async (): Promise<Database> => {
    if (dbInstance) {
        return dbInstance;
    }

    const db = await open({
        filename: "./cf-contests.sqlite",
        driver: sqlite3.Database,
    });

    // Create contests table with all Codeforces contest fields
    await db.exec(`
    CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT,
      phase TEXT,
      frozen INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      start_time_seconds INTEGER,
      relative_time_seconds INTEGER,
      prepared_by TEXT,
      website_url TEXT,
      description TEXT,
      difficulty INTEGER,
      kind TEXT,
      icpc_region TEXT,
      country TEXT,
      city TEXT,
      season TEXT,
      synced_at INTEGER NOT NULL
    )
  `);

    // Create problems table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      index_name TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT,
      points REAL,
      rating INTEGER,
      tags TEXT,
      FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE,
      UNIQUE(contest_id, index_name)
    )
  `);

    // Create index for faster queries
    await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_contests_phase ON contests(phase);
    CREATE INDEX IF NOT EXISTS idx_contests_start_time ON contests(start_time_seconds);
    CREATE INDEX IF NOT EXISTS idx_problems_contest_id ON problems(contest_id);
    CREATE INDEX IF NOT EXISTS idx_problems_rating ON problems(rating);
  `);

    dbInstance = db;
    return db;
};
