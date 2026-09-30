import type { Settings } from "./types";

export type Target = "finder" | "editor" | "terminal" | "agent";
export interface Command { file: string; args: string[] }

// Folder, command and session id arrive as run-handler arguments, never interpolated into the script.
// The command (item 2) is built server-side from the config; the folder and the session id are shell-quoted here.
const BUILD = `set cmd to "cd " & quoted form of (item 1 of argv)
  if (count of argv) > 1 then set cmd to cmd & " && " & (item 2 of argv)
  if (count of argv) > 2 then set cmd to cmd & " " & quoted form of (item 3 of argv)`;

export const ITERM_SCRIPT = `on run argv
  ${BUILD}
  tell application "iTerm"
    activate
    if (count of windows) = 0 then
      create window with default profile
    else
      tell current window to create tab with default profile
    end if
    tell current session of current window to write text cmd
  end tell
end run`;

export const TERMINAL_SCRIPT = `on run argv
  ${BUILD}
  tell application "Terminal"
    activate
    do script cmd
  end tell
end run`;

function inTerminal(settings: Settings, args: string[]): Command | null {
  if (settings.terminal === "none") return null;
  return { file: "osascript", args: ["-e", settings.terminal === "terminal" ? TERMINAL_SCRIPT : ITERM_SCRIPT, ...args] };
}

/** null: the action is disabled by the configuration. */
export function openCommand(target: Target, folderAbs: string, settings: Settings,
  platform: string = process.platform): Command | null {
  switch (target) {
    case "finder": return { file: platform === "darwin" ? "open" : "xdg-open", args: [folderAbs] };
    case "editor": return settings.editor_app ? { file: "open", args: ["-a", settings.editor_app, folderAbs] } : null;
    case "terminal": return inTerminal(settings, [folderAbs]);
    case "agent": return inTerminal(settings, [folderAbs, settings.agent_command]);
  }
}

const shellQuote = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** Starts the agent with the prompt read from a file, deleted as soon as it is read. Typing the prompt itself into
 * the terminal breaks on pasted text: every line becomes a continuation prompt and a tab triggers completion. */
export function promptCommand(folderAbs: string, promptFile: string, settings: Settings): Command | null {
  const f = shellQuote(promptFile);
  return inTerminal(settings, [folderAbs, `${settings.agent_command} "$(cat -- ${f}; rm -f -- ${f})"`]);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Resumes a past Claude Code session in a new terminal tab, in the folder it was started from. */
export function resumeCommand(folderAbs: string, sessionId: string, settings: Settings): Command | null {
  if (!UUID.test(sessionId)) throw new Error(`Invalid session id: ${sessionId}`);
  return inTerminal(settings, [folderAbs, `${settings.agent_command} --resume`, sessionId]);
}
