import path from "node:path";
import { readJsonFile, writeJsonFile, rid, nowIso } from "../shared/utils.js";

const STORE_FILE = path.resolve(process.cwd(), ".agent-state/threads.json");

export class ThreadStore {
  async load() {
    return readJsonFile(STORE_FILE, { threads: [] });
  }

  async save(data) {
    await writeJsonFile(STORE_FILE, data);
  }

  async createThread(title = "Untitled Thread") {
    const db = await this.load();
    const thread = {
      id: rid("thread"),
      title,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      turns: [],
    };
    db.threads.push(thread);
    await this.save(db);
    return thread;
  }

  async getThread(threadId) {
    const db = await this.load();
    return db.threads.find((t) => t.id === threadId) || null;
  }

  async listThreads() {
    const db = await this.load();
    return db.threads;
  }

  async appendTurn(threadId, turn) {
    const db = await this.load();
    const thread = db.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error(`Thread not found: ${threadId}`);

    const item = {
      id: rid("turn"),
      createdAt: nowIso(),
      ...turn,
    };

    thread.turns.push(item);
    thread.updatedAt = nowIso();

    await this.save(db);
    return item;
  }
}
