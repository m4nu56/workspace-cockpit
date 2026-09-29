import { describe, expect, it } from "vitest";
import { ITERM_SCRIPT, TERMINAL_SCRIPT, openCommand, resumeCommand } from "@/lib/open";
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
    expect(openCommand("agent", D, S({ terminal: "none" }), "darwin", "hello")).toBeNull();
  });
  it("agent: configured command as is, prompt quoted separately", () => {
    const prompt = "Review it ; rm -rf / $(x)";
    expect(openCommand("agent", D, S({ agent_command: "claude --model opus" }), "darwin", prompt)!.args.slice(-3))
      .toEqual([D, "claude --model opus", prompt]);
    expect(ITERM_SCRIPT).toContain("quoted form of (item 3 of argv)");
    expect(TERMINAL_SCRIPT).toContain("quoted form of (item 3 of argv)");
  });
  it("agent without prompt", () => expect(openCommand("agent", D, S(), "darwin", "  ")!.args.slice(-2)).toEqual([D, "claude"]));
});

describe("resumeCommand", () => {
  it("resumes by id", () => expect(resumeCommand(D, "0aa229a4-a2e8-43d4-9bea-a1e888e7247d", S())!.args.slice(-3))
    .toEqual([D, "claude --resume", "0aa229a4-a2e8-43d4-9bea-a1e888e7247d"]));
  it("refuses a non-UUID id", () => expect(() => resumeCommand(D, "x; rm -rf /", S())).toThrow());
  it("none", () => expect(resumeCommand(D, "0aa229a4-a2e8-43d4-9bea-a1e888e7247d", S({ terminal: "none" }))).toBeNull());
});
