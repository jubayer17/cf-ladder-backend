import sqlite3 from "sqlite3";
import { open } from "sqlite";

// Open SQLite database
export const openDB = async () => {
    const db = await open({
        filename: "./cf-contests.sqlite",
        driver: sqlite3.Database,
    });

    // Create contests table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS contests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `);

    // Create problems table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS problems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contest_id INTEGER NOT NULL,
      problem_name TEXT NOT NULL,
      FOREIGN KEY (contest_id) REFERENCES contests(id) ON DELETE CASCADE
    )
  `);

    return db;
};
