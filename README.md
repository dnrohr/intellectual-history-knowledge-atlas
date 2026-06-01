# Intellectual History Knowledge Atlas

An interactive atlas for exploring thinkers, timelines, influence relationships, topics, and externally sourced import candidates.

## Run In GitHub Codespaces

1. Open the repository on GitHub.
2. Choose **Code** -> **Codespaces** -> **Create codespace on main**.
3. Wait for dependencies to install.
4. Run:

```bash
npm run dev
```

Codespaces will forward port `3000`. Open the forwarded URL to use the app.

## Run Locally

Prerequisite: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm run start
```

## Notes

- Local additions and edits are stored in browser `localStorage`.
- The Workbench includes review flows for links, tags, imports, and duplicates.
- Wikidata import search is available through the local Express backend.
