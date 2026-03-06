import fs from "node:fs/promises";
import path from "node:path";

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJsonFile(file, fallback) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file, data) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function nowIso() {
  return new Date().toISOString();
}

export function rid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pretty(v) {
  return JSON.stringify(v, null, 2);
}
