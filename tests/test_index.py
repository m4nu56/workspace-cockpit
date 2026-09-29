from conftest import TODAY, write
from cockpit.index import render_index


def test_sections(config, root):
    write(root / "research/logs/CLAUDE.md", "---\nstatus: active\nsummary: Logs | infra\nwaiting_on: me\nupdated: 2026-09-28\n---\n")
    text = render_index(config, today=TODAY)
    mine = text.split("## Waiting on me")[1].split("\n## ")[0]
    assert "alpha" in mine and "beta" in mine and "logs" in mine and "gamma" not in mine   # beta: due in 2 days
    assert "Logs \\| infra" in text
    assert "## research — active (1)" in text and "## projects — no status (1)" in text
    assert "[`old`](projects/_archive/2026/old/)" in text
    assert "(due 2026-09-30)" in text and "| Next step |" in text
