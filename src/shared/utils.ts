import fs from "node:fs/promises";
import path from "node:path";

export function nowIso(): string {
  return new Date().toISOString();
}

export function rid(prefix: string = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function pretty(value: any): string {
  return JSON.stringify(value, null, 2);
}

export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function readJsonFile(
  file: string,
  fallback: any = null,
): Promise<any> {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function writeJsonFile(file: string, data: any): Promise<void> {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export function clipText(text: any, max: number = 6000): string {
  const s = String(text ?? "");
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n...[truncated]`;
}

export function safeJsonParse(text: string, fallback: any = null): any {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function stripMarkdownFence(text: string): string {
  const s = String(text || "").trim();
  if (!s.startsWith("```")) return s;
  return s
    .replace(/^```[a-zA-Z0-9_-]*\n?/, "")
    .replace(/```$/, "")
    .trim();
}
