import { describe, expect, it } from "vitest";
import { ITERM_SCRIPT, TERMINAL_SCRIPT, openCommand, promptCommand, resumeCommand } from "@/lib/open";
import type { Settings } from "@/lib/types";

const S = (x: Partial<Settings> = {}) => ({ terminal: "iterm", editor_app: "Visual Studio Code", agent_command: "claude", ...x }) as Settings;
const D = "/w/projects/it's \"odd\" $(rm)";

describe("openCommand", () => {
  it("finder", () => expect(openCommand("finder", D, S(), "darwin")).toEqual({ file: "open", args: [D] }));
  it("finder on linux", () => expect(openCommand("finder", D, S(), "linux")).toEqual({ file: "xdg-open", args: [D] }));
  it("editor", () => expect(openCommand("editor", D, S())).toEqual({ file: "open", args: ["-a", "Visual Studio Code", D] }));
  it("no editor configured", () => expect(openCommand("editor", D, S({ editor_app: "" }))).toBeNull());
  it("iTerm: folder as an argument, never inside the script", () => {
    expect(openCommand("terminal", D, S())).toEqual({ file: "osascript", args: ["-e", ITERM_SCRIPT, D] });
    expect(ITERM_SCRIPT).toContain("quoted form of (item 1 of argv)");
  });
  it("Terminal.app", () => expect(openCommand("terminal", D, S({ terminal: "terminal" }))).toEqual({ file: "osascript", args: ["-e", TERMINAL_SCRIPT, D] }));
  it("terminal none: nothing runs", () => {
    expect(openCommand("terminal", D, S({ terminal: "none" }))).toBeNull();
    expect(openCommand("agent", D, S({ terminal: "none" }))).toBeNull();
  });
  it("agent: configured command as is", () => expect(openCommand("agent", D, S({ agent_command: "claude --model opus" }))!.args.slice(-2))
    .toEqual([D, "claude --model opus"]));
});

describe("promptCommand", () => {
  it("reads the prompt from a quoted file, never from the text", () => {
    const f = "/tmp/it's $(rm).txt";
    const { args } = promptCommand(D, f, S({ agent_command: "claude --model opus" }))!;
    expect(args.slice(0, 3)).toEqual(["-e", ITERM_SCRIPT, D]);
    expect(args[3]).toBe(`claude --model opus "$(cat -- '/tmp/it'\\''s $(rm).txt'; rm -f -- '/tmp/it'\\''s $(rm).txt')"`);
  });
  it("none", () => expect(promptCommand(D, "/tmp/p.txt", S({ terminal: "none" }))).toBeNull());
  it.each(["zsh", "bash"])("a pasted email reaches the agent intact in %s, and the file is deleted", async (shell) => {
    const { execFileSync } = await import("node:child_process");
    const { existsSync, mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const path = await import("node:path");
    const f = path.join(mkdtempSync(path.join(tmpdir(), "it's ")), "prompt.txt");
    const email = "Hi,\n\n\tOK for the numbering ; « l'envoi » $(rm -rf /) `x` \"y\"\n\nFrédéric";
    writeFileSync(f, email);
    const cmd = promptCommand(D, f, S({ agent_command: "printf %s" }))!.args[3];
    expect(execFileSync(shell, ["-c", cmd], { encoding: "utf8" })).toBe(email);
    expect(existsSync(f)).toBe(false);
  });
});

describe("resumeCommand", () => {
  it("resumes by id", () => expect(resumeCommand(D, "0aa229a4-a2e8-43d4-9bea-a1e888e7247d", S())!.args.slice(-3))
    .toEqual([D, "claude --resume", "0aa229a4-a2e8-43d4-9bea-a1e888e7247d"]));
  it("refuses a non-UUID id", () => expect(() => resumeCommand(D, "x; rm -rf /", S())).toThrow());
  it("none", () => expect(resumeCommand(D, "0aa229a4-a2e8-43d4-9bea-a1e888e7247d", S({ terminal: "none" }))).toBeNull());
});
