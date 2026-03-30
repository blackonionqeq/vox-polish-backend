# CLAUDE.md

This repository uses `AGENTS.md` as the primary shared instruction file for coding agents.

Start with `AGENTS.md`, then consult the detailed rule files under `.claude/rules/` as needed:

- `.claude/rules/commands.md`
- `.claude/rules/environment.md`
- `.claude/rules/conventions.md`
- `.claude/rules/architecture-glossary-api.md`
- `.claude/rules/architecture-llm-pipeline.md`
- `.claude/rules/architecture-data-import.md`

Keep `CLAUDE.md` thin and compatible. Shared guidance should live in `AGENTS.md` to avoid duplicated instructions drifting over time.
