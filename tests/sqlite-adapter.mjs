// Minimal adapter that gives a D1-shaped API (prepare/bind/all/first/run/batch)
// on top of node:sqlite, so Worker code can be exercised outside workerd.
import { DatabaseSync } from 'node:sqlite';

class Statement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql;
    this.params = [];
  }

  bind(...params) {
    this.params = params;
    return this;
  }

  async all() {
    return { results: this.db.prepare(this.sql).all(...this.params) };
  }

  async first() {
    return this.db.prepare(this.sql).get(...this.params) ?? null;
  }

  async run() {
    this.db.prepare(this.sql).run(...this.params);
    return { success: true };
  }
}

export class TestDatabase {
  constructor() {
    this.db = new DatabaseSync(':memory:');
  }

  prepare(sql) {
    return new Statement(this.db, sql);
  }

  async exec(sql) {
    this.db.exec(sql);
  }

  async batch(statements) {
    for (const statement of statements) await statement.run();
  }
}
