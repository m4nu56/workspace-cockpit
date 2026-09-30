"use server";

import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { revalidatePath } from "next/cache";
import { isInside } from "@/lib/files";
import { cli, invalidate, listFolders, sessions, settings } from "@/lib/cockpit";
import { openCommand, promptCommand, resumeCommand, type Command, type Target } from "@/lib/open";
import type { Folder, Result, Todo } from "@/lib/types";

const run = promisify(execFile);
const TARGETS: readonly Target[] = ["finder", "editor", "terminal", "agent"];
const MAX_PROMPT = 200_000;

async function attempt<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function write<T = Folder>(args: string[]): Promise<Result<T>> {
  return attempt(async () => {
    try {
      return await cli<T>(args);
    } finally {
      invalidate();
      revalidatePath("/", "layout");
    }
  });
}

async function launch(command: Command | null): Promise<void> {
  if (!command) throw new Error("This action is disabled in cockpit.toml");
  await run(command.file, command.args, { timeout: 15_000 });
}

export async function setHeader(p: string, fields: Record<string, string>) {
  return write(["header", p, ...Object.entries(fields).map(([k, v]) => `--set=${k}=${v}`)]);
}
export async function archiveFolder(p: string) { return write(["archive", p]); }
export async function unarchiveFolder(p: string) { return write(["unarchive", p]); }
export async function createFolder(collection: string, name: string, summary: string) {
  return write(["new", collection, name, `--summary=${summary}`]);
}

export async function addTodo(text: string) { return write<Todo>(["todo", "add", "--", text]); }
/** The expected text makes the CLI refuse if the inbox file changed since the page was rendered. */
export async function actOnTodo(action: "done" | "undo" | "delete", n: number, expected: string) {
  return write<Todo>(["todo", action, String(n), `--expected=${expected}`]);
}
export async function promoteTodo(n: number, expected: string, name: string) {
  return write(["todo", "promote", String(n), name, `--expected=${expected}`]);
}

/** Only folders listed by the CLI can be opened. */
async function knownFolder(p: string): Promise<string> {
  if (!(await listFolders()).some((f) => f.path === p)) throw new Error(`Unknown folder: ${p}`);
  return realpath(path.join((await settings()).root, p));
}

export async function openFolder(p: string, target: Target): Promise<Result<void>> {
  return attempt(async () => {
    if (!TARGETS.includes(target)) throw new Error(`Unknown target: ${target}`);
    await launch(openCommand(target, await knownFolder(p), await settings()));
  });
}

export async function openFile(p: string, file: string): Promise<Result<void>> {
  return attempt(async () => {
    const folder = await knownFolder(p);
    const target = await realpath(path.join(folder, file));
    if (!isInside(folder, target)) throw new Error("File outside the folder");
    await run(process.platform === "darwin" ? "open" : "xdg-open", [target], { timeout: 15_000 });
  });
}

/** Starts the configured agent command with this prompt in a new terminal tab, in a known folder or else at
 * the workspace root. */
export async function startAgent(prompt: string, p?: string): Promise<Result<void>> {
  return attempt(async () => {
    if (prompt.length > MAX_PROMPT) throw new Error("Prompt too long");
    const s = await settings();
    const folder = p ? await knownFolder(p) : await realpath(s.root);
    const text = prompt.trim();
    if (!text) return launch(openCommand("agent", folder, s));
    if (s.terminal === "none") throw new Error("This action is disabled in cockpit.toml");
    const file = path.join(tmpdir(), `cockpit-prompt-${randomUUID()}.txt`);
    await writeFile(file, text, { mode: 0o600, flag: "wx" });
    try {
      await launch(promptCommand(folder, file, s));
    } catch (e) {
      await rm(file, { force: true });
      throw e;
    }
  });
}

/** Only sessions listed by the CLI; only closed ones can be resumed (an open one would run twice). */
async function knownSession(id: string) {
  const s = (await sessions()).find((x) => x.id === id);
  if (!s) throw new Error("Unknown session");
  return s;
}

export async function resumeSession(id: string): Promise<Result<void>> {
  return attempt(async () => {
    const s = await knownSession(id);
    if (s.open) throw new Error(`Session still open (${s.name || `pid ${s.pid}`}): find its terminal tab`);
    await launch(resumeCommand(await realpath(s.cwd), s.id, await settings()));
  });
}

export async function terminalAtSession(id: string): Promise<Result<void>> {
  return attempt(async () => {
    const s = await knownSession(id);
    await launch(openCommand("terminal", await realpath(s.cwd), await settings()));
  });
}
