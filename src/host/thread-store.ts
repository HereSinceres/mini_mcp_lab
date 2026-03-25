import path from "node:path";
import { readJsonFile, writeJsonFile, rid, nowIso } from "../shared/utils";

const STORE_FILE = path.resolve(process.cwd(), ".agent-state/threadson");

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  turns: any[];
}

interface Database {
  threads: Thread[];
}

export class ThreadStore {
  async load(): Promise<Database> {
    return readJsonFile(STORE_FILE, { threads: [] });
  }

  async save(data: Database): Promise<void> {
    await writeJsonFile(STORE_FILE, data);
  }

  async createThread(title: string = "Untitled Thread"): Promise<Thread> {
    const db = await this.load();
    const thread: Thread = {
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

  async appendTurn(threadId: string, turn: any): Promise<any> {
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

  async listThreads(): Promise<Thread[]> {
    const db = await this.load();
    return db.threads;
  }
}
