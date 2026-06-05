# Deployment Guide

The current deployment target is Render, using `render.yaml`.

## Local Production Check

Before deploying:

```bash
npm ci
npm test
npm run lint
npm run build
npm run start
```

Open:

```text
http://localhost:3000/api/health
http://localhost:3000
```

Use `npm.cmd` on Windows PowerShell if needed.

## Render

The repository includes a Render Blueprint:

```text
render.yaml
```

It defines:

- Node web service
- `npm ci && npm run build`
- `npm run start`
- `NODE_ENV=production`
- auto-deploy enabled

Render should set `PORT` automatically. The server reads `process.env.PORT` and falls back to `3000` locally.

Recommended Render setup:

1. Connect the GitHub repository.
2. Create from Blueprint.
3. Confirm the service uses the `main` branch.
4. Confirm auto-deploy is enabled.
5. Deploy.
6. Check `/api/health`.
7. Open the app and confirm the Demo or Local data badge matches the intended build.

## Public Demo Mode

For public demo builds, set:

```text
VITE_PUBLIC_DEMO_MODE=true
```

Demo mode starts from the bundled canonical sample data on each page load, clears persisted atlas state for that browser, skips atlas-state writes, and shows a Demo badge. Public demo edits are session-only; users should use export/restore in normal local mode when they want changes to travel between browsers or deployments.

## Local Data

Normal mode stores edits in browser `localStorage`. Public hosted instances should explain that data is browser-local unless users export and restore JSON.

## Future Targets

Railway can run the current Node server with minimal changes. Fly.io is a good fit if the app moves toward container-first deployment. Vercel and Netlify are possible if the Express API is refactored into serverless handlers.
