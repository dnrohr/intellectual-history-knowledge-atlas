# Codespaces Guide

Use Codespaces when you want a browser-based development environment with the same repository workflow.

## Open The Codespace

1. Open the GitHub repository.
2. Choose **Code**.
3. Choose **Codespaces**.
4. Create or resume a codespace on `main`.

The repo includes a `.devcontainer` directory for Codespaces setup.

## Install And Run

```bash
npm ci
npm run dev
```

Open the forwarded port for `3000`.

Check:

```text
/api/health
```

## Update An Existing Codespace

Before pulling:

```bash
git status
```

If the worktree is clean:

```bash
git pull --ff-only
npm ci
npm test
npm run lint
npm run build
```

If dependencies changed, `npm ci` keeps the install aligned with `package-lock.json`.

## Preserve Local Atlas Data

Browser `localStorage` belongs to the browser session, not the repository. Before switching environments or rebuilding a hosted demo:

1. Open **Import**.
2. Use **Export JSON**.
3. Store the exported file somewhere durable.
4. Use **Restore JSON** in the new environment.

## Development Seed Tools

To create an importable seed snapshot:

```bash
npm run seed:reset
```

To validate a snapshot:

```bash
npm run seed:check -- path/to/state.json
```

To import and normalize a snapshot into the dev seed output:

```bash
npm run seed:import -- path/to/state.json
```

## Commit And Push

```bash
git status
git add <files>
git commit -m "Concise message"
git push origin main
```

Run the relevant checks before pushing. For UI changes, include Playwright:

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```
