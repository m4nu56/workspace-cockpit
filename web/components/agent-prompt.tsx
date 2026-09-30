"use client";

import { Bot, Mail } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { startAgent } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tilde } from "@/lib/format";
import { useSettings } from "./settings";

const EMAIL_TEMPLATE = `Here is a reply I received by email. File it in this folder's notes, update the header \
(next_step, waiting_on, who, due), then draft a reply for me.

--- Email ---
`;

/** Without `path`, the agent starts at the workspace root; with it, in that folder. */
export function AgentPrompt({ path }: { path?: string }) {
  const settings = useSettings();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLTextAreaElement>(null);
  if (settings.terminal === "none") return null;
  const where = path ?? tilde(settings.root, settings.home);

  const start = async () => {
    setSending(true);
    const r = await startAgent(prompt, path);
    setSending(false);
    if (r.ok) { toast.success("Agent started in a new terminal tab"); setPrompt(""); } else toast.error(r.error);
  };

  const emailTemplate = () => {
    const text = prompt.startsWith(EMAIL_TEMPLATE) ? prompt : EMAIL_TEMPLATE + prompt;
    setPrompt(text);
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(text.length, text.length);
    });
  };

  return (
    <form className="space-y-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); void start(); }}>
      <Textarea ref={box} rows={path ? 3 : 2} value={prompt} className="max-h-96 resize-y border-0 p-1 shadow-none focus-visible:ring-0"
        placeholder={`Ask an agent, in ${where}…  (Enter to start, Shift+Enter for a new line)`}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void start(); } }} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Opens a terminal tab and runs <code>{settings.agent_command}</code> with this prompt (empty: no prompt).</span>
        <div className="ml-auto flex gap-2">
          {path && (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={emailTemplate}>
              <Mail className="size-4" /> Email reply
            </Button>
          )}
          <Button type="submit" size="sm" className="gap-1.5" disabled={sending}><Bot className="size-4" /> {sending ? "Starting…" : "Start agent"}</Button>
        </div>
      </div>
    </form>
  );
}
