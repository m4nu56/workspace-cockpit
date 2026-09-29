#!/usr/bin/env python3
"""Builds a fictional demo: examples/demo-workspace (tracked folders) and examples/demo-claude
(Claude Code transcripts for the Sessions view). Dates are relative to today, so the demo always looks alive.

    python3 examples/make-demo.py
    CLAUDE_CONFIG_DIR=examples/demo-claude bin/cockpit start --config examples/demo-workspace/cockpit.toml
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent

CONFIG = """root = "."
collections = [ { dir = "projects", label = "project" }, { dir = "research", label = "research" } ]
terminal = "iterm"
agent_command = "claude"
port = 8767
"""

# name -> (collection, header fields with day offsets, body, extra files {name: (content, days ago)}, created days ago)
FOLDERS = {
    "website-redesign": ("projects", {"status": "active", "summary": "New marketing site: design system, CMS migration, SEO redirects",
                          "next_step": "Review the homepage mockups and pick one", "waiting_on": "me", "due": 3, "updated": -1},
                         "## Status\n\n| Page | Design | Build |\n|---|---|---|\n| Home | ✅ | in progress |\n| Pricing | ✅ | ⏳ |\n| Blog | ⏳ | — |\n\n"
                         "## Decisions\n\n- Headless CMS, static export\n- Keep the old URLs through 301 redirects\n",
                         {"mockups-review.md": ("# Mockups review\n\nThree directions, **B** is the team favourite.\n", 1),
                          "redirects.csv": ("old_url;new_url\n/about-us;/about\n/blog/2019;/blog\n/contact.php;/contact\n", 6),
                          "report.html": ("<!doctype html><html><body style='font-family:sans-serif'><h1>Lighthouse report</h1>"
                                          "<p>Performance <b>92</b> · Accessibility <b>98</b> · SEO <b>100</b></p></body></html>", 4)}, 60),
    "billing-migration": ("projects", {"status": "active", "summary": "Move subscriptions to the new payment provider without double charges",
                           "next_step": "Wait for the sandbox credentials", "waiting_on": "someone", "who": "Payment provider support",
                           "due": 12, "updated": -2},
                          "## Plan\n\n1. Dual-write invoices\n2. Migrate active subscriptions in batches of 500\n3. Switch webhooks\n",
                          {"runbook.md": ("# Runbook\n\nRollback: re-enable the old webhook endpoint.\n", 2)}, 45),
    "mobile-app-beta": ("projects", {"status": "active", "summary": "Public beta of the mobile app on both stores",
                         "next_step": "Submit the build for store review", "waiting_on": "me", "due": -2, "updated": -3},
                        "## Checklist\n\n- [x] Crash reporting\n- [x] Beta testers list\n- [ ] Store screenshots\n",
                        {"release-notes.md": ("# Beta 0.9\n\n- Offline mode\n- Dark theme\n", 3)}, 90),
    "data-pipeline": ("projects", {"status": "paused", "summary": "Nightly export of product analytics to the warehouse",
                       "next_step": "Resume after the schema freeze", "waiting_on": "nobody", "updated": -20},
                      "Paused until the analytics schema is frozen.\n", {"schema.sql": ("CREATE TABLE events (id bigint, name text, at timestamptz);\n", 25)}, 120),
    "conference-talk": ("projects", {"status": "active", "summary": "Talk proposal and slides for the autumn developer conference",
                         "next_step": "Rehearse with the team", "waiting_on": "me", "updated": -30},
                        "Abstract accepted. Slides are 80 % done.\n", {"outline.md": ("# Outline\n\n1. Why\n2. How\n3. Demo\n", 30)}, 75),
    "onboarding-docs": ("projects", None, "# onboarding-docs\n\nNotes for new team members (no header yet).\n",
                        {"first-week.md": ("# First week\n\n- Laptop setup\n- Meet the team\n", 9)}, 15),
    "user-interviews": ("research", {"status": "active", "summary": "Twelve interviews with power users about the reporting features",
                         "next_step": "Synthesize the last four interviews", "waiting_on": "me", "due": 6, "updated": 0},
                        "## Themes so far\n\n- Exports are the most used feature\n- Nobody finds the filters\n",
                        {"interview-07.md": ("# Interview 7\n\n> I export everything to a spreadsheet anyway.\n", 0),
                         "interview-08.md": ("# Interview 8\n\nWants saved filters.\n", 1)}, 20),
    "pricing-study": ("research", {"status": "paused", "summary": "Benchmark of competitor pricing pages and plan limits",
                       "next_step": "Get last quarter's churn numbers", "waiting_on": "someone", "who": "Finance team", "updated": -8},
                      "| Competitor | Entry plan | Seats |\n|---|---|---|\n| A | 9 | 3 |\n| B | 12 | 5 |\n", {}, 40),
}
ARCHIVED = {"legacy-api-shutdown": ("projects", {"status": "done", "summary": "Turned off the v1 API after the migration window",
                                                 "updated": -50}, "Done. All clients moved to v2.\n", 150)}

SESSIONS = [
    ("projects/website-redesign", "Homepage mockups comparison", ["Compare the three homepage mockups against our brand guide",
     "Go with B, list what we need to change"], 0, True, "busy"),
    ("projects/website-redesign", "Redirect map for old URLs", ["Build the redirect table from the old sitemap"], 6, False, None),
    ("projects/billing-migration", "Dual-write invoices plan", ["Draft a plan to migrate subscriptions without double charges"], 2, True, "idle"),
    ("research/user-interviews", "Interview synthesis", ["Summarize interviews 7 and 8 into themes"], 1, False, None),
    ("", "Weekly review of all projects", ["What is waiting on me this week?"], 3, False, None),
    ("projects/mobile-app-beta", "Store listing copy", ["Write the store description for the beta"], 4, False, None),
    ("projects/conference-talk", "Talk outline", ["Help me outline a 25 minute talk"], 30, False, None),
]


def header(fields: dict, today: dt.date) -> str:
    out = ["---"]
    for k, v in fields.items():
        out.append(f"{k}: {(today + dt.timedelta(days=v)).isoformat() if isinstance(v, int) else v}")
    return "\n".join(out + ["---", ""])


def touch(path: Path, days_ago: float) -> None:
    t = (dt.datetime.now() - dt.timedelta(days=days_ago)).timestamp()
    os.utime(path, (t, t))


def build_workspace(target: Path, today: dt.date) -> None:
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    (target / "cockpit.toml").write_text(CONFIG)
    d = lambda days: (today - dt.timedelta(days=days)).isoformat()  # noqa: E731
    (target / "INBOX.md").write_text(
        "# Inbox\n\nSmall to-dos that do not deserve a folder. Managed by the cockpit and `bin/cockpit todo`;"
        " safe to edit by hand.\n\n## To do\n\n"
        f"- [ ] {d(2)} · Renew the domain name before it expires\n"
        f"- [ ] {d(1)} · Ask the agency for the final logo files\n"
        f"- [ ] {d(0)} · Reply to the newsletter tool about the invoice\n\n## Done\n\n"
        f"- [x] {d(4)} → {d(1)} · Share the Q3 numbers with the team\n")
    items = [(n, c, f, b, extra, created, False) for n, (c, f, b, extra, created) in FOLDERS.items()]
    items += [(n, c, f, b, {}, created, True) for n, (c, f, b, created) in ARCHIVED.items()]
    for name, collection, fields, body, extra, created_ago, archived in items:
        folder = target / collection / ("_archive/" + str(today.year) if archived else "") / name
        folder.mkdir(parents=True)
        claude = folder / "CLAUDE.md"
        created = (today - dt.timedelta(days=created_ago)).isoformat()
        text = (header({**fields, "created": created}, today) if fields else "") + (f"\n# {name}\n\n" if fields else "") + body
        claude.write_text(text)
        updated = -fields["updated"] if fields and "updated" in fields else 9
        # A trail of past activity, so the calendar shows more than one dot per folder.
        for i, ago in enumerate(range(created_ago, max(updated, 0), -max(created_ago // 6, 1))):
            f = folder / "notes" / f"note-{i:02d}.md"
            f.parent.mkdir(exist_ok=True)
            f.write_text(f"# Note {i}\n\nWorking notes.\n")
            touch(f, ago)
        for fname, (content, ago) in extra.items():
            (folder / fname).write_text(content)
            touch(folder / fname, ago)
        touch(claude, max(updated, 0))


def build_claude(target: Path, workspace: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    (target / "sessions").mkdir(parents=True)
    now = dt.datetime.now(dt.timezone.utc)
    for i, (folder, title, prompts, days_ago, is_open, state) in enumerate(SESSIONS):
        cwd = str(workspace / folder) if folder else str(workspace)
        sid = str(uuid.UUID(int=i + 1))
        start = now - dt.timedelta(days=days_ago, hours=2)
        lines, t = [], start
        for j, prompt in enumerate(prompts):
            lines.append({"type": "user", "cwd": cwd, "timestamp": t.isoformat().replace("+00:00", "Z"), "gitBranch": "main",
                          "message": {"role": "user", "content": prompt}})
            t += dt.timedelta(minutes=7)
            lines.append({"type": "assistant", "timestamp": t.isoformat().replace("+00:00", "Z"), "message": {
                "id": f"m{i}-{j}", "model": "claude-model",
                "usage": {"input_tokens": 1200, "output_tokens": 800, "cache_read_input_tokens": 40000, "cache_creation_input_tokens": 3000},
                "content": [{"type": "tool_use", "id": f"t{i}-{j}", "name": "Edit", "input": {"file_path": cwd + "/CLAUDE.md"}},
                            {"type": "text", "text": f"Done: **{title.lower()}**, step {j + 1}.\n\n- Updated the notes\n- Next: review"}]}})
            t += dt.timedelta(minutes=3)
        lines.append({"type": "ai-title", "aiTitle": title})
        lines.append({"type": "last-prompt", "lastPrompt": prompts[-1]})
        path = target / "projects" / cwd.replace("/", "-") / f"{sid}.jsonl"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("".join(json.dumps(x) + "\n" for x in lines))
        if is_open:
            # pid 1 always exists, so the demo session reads as open.
            (target / "sessions" / f"demo-{i}.json").write_text(json.dumps({
                "pid": 1, "sessionId": sid, "cwd": cwd, "status": state, "name": f"{Path(cwd).name}-{i}",
                "startedAt": int(start.timestamp() * 1000)}))


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--out", type=Path, default=HERE)
    a = p.parse_args()
    workspace = (a.out / "demo-workspace").resolve()
    build_workspace(workspace, dt.date.today())
    build_claude((a.out / "demo-claude").resolve(), workspace)
    print(f"Demo written to {workspace} and {(a.out / 'demo-claude').resolve()}")


if __name__ == "__main__":
    main()
