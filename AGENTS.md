# Repository Guidelines

## Project Structure & Module Organization
This repository is currently in a bootstrap state and contains only:
- `README.md`: top-level project description.
- `.agents/` and `.codex/`: local 智能体/工具元数据。

When adding code, use a predictable layout:
- `src/` for application code.
- `tests/` for automated tests (mirror `src/` paths where practical).
- `assets/` for static files (images, fixtures, sample data).
- `docs/` for design notes and architecture decisions.

Example:
`src/auth/login.py` -> `tests/auth/test_login.py`

## Build, Test, and Development Commands
No build system is configured yet. If you introduce one, document commands in `README.md` and keep them scriptable.

Recommended baseline commands to add:
- `make test` or `npm test` / `pytest`: run full test suite.
- `make lint` or `npm run lint` / `ruff check .`: static analysis.
- `make format` or `npm run format` / `ruff format .`: formatting.
- `make dev` or `npm run dev`: local development entrypoint.

Prefer a single canonical command per task so CI and local workflows stay consistent.

## Coding Style & Naming Conventions
- Use 4-space indentation unless the selected language standard differs.
- Keep files and functions focused; avoid large multi-purpose modules.
- Naming:
  - `snake_case` for Python files/functions.
  - `camelCase` for JavaScript/TypeScript variables/functions.
  - `PascalCase` for classes/components.
- Run formatter/linter before committing.

## Testing Guidelines
- Place tests under `tests/`, matching source structure.
- Name tests by behavior (examples: `test_login_rejects_invalid_password`).
- Add regression tests for every bug fix.
- Target meaningful coverage on critical paths (auth, data handling, external integrations).

## Commit & Pull Request Guidelines
Current history has a single `first commit`; adopt clear, imperative commit messages going forward.

Suggested format:
- `<type>: <short summary>` (for example: `feat: add session validation middleware`)
- Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

Pull requests should include:
- What changed and why.
- Test evidence (command + result).
- Linked issue/task (if available).
- Screenshots/log snippets for UI or behavior changes.

## 智能体沟通规范
- Default language for 智能体与用户协作 in this repository is Chinese (`简体中文`).
- Use Chinese for plans, progress updates, review comments, and final summaries unless the user explicitly requests another language.
- Keep code identifiers, CLI commands, and config keys in their original technical form (typically English), but explain them in Chinese.
