"use client";

import { Bot } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { startAgent } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tilde } from "@/lib/format";
import { useSettings } from "./settings";

export function AgentPrompt() {
  const settings = useSettings();
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  if (settings.terminal === "none") return null;

  const start = async () => {
    setSending(true);
    const r = await startAgent(prompt);
    setSending(false);
    if (r.ok) { toast.success("Agent started in a new terminal tab"); setPrompt(""); } else toast.error(r.error);
  };

  return (
    <form className="space-y-2 rounded-lg border p-3" onSubmit={(e) => { e.preventDefault(); void start(); }}>
      <Textarea rows={2} value={prompt} className="resize-y border-0 p-1 shadow-none focus-visible:ring-0"
        placeholder={`Ask an agent, in ${tilde(settings.root, settings.home)}…  (Enter to start, Shift+Enter for a new line)`}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void start(); } }} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Opens a terminal tab and runs <code>{settings.agent_command}</code> with this prompt (empty: no prompt).</span>
        <Button type="submit" size="sm" className="ml-auto gap-1.5" disabled={sending}><Bot className="size-4" /> {sending ? "Starting…" : "Start agent"}</Button>
      </div>
    </form>
  );
}
