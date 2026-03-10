# SAR Dashboard v3 Frontend

This folder contains the standalone React + Vite frontend for the SAR Dashboard.

The app currently runs with mock/demo workflow data in the `/app/*` flow, so it can be deployed as a static site without the backend.

## Run locally

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

## Production build

```bash
npm run build
npm run preview
```

## GitHub Pages deploy

A workflow is provided at:

- `.github/workflows/deploy-frontend-gh-pages.yml`

It does the following:

1. Builds only `sar-dashboard-v3`
2. Copies `index.html` to `404.html` (SPA fallback)
3. Publishes `dist/` to the `gh-pages` branch

### One-time GitHub repo setup

In your repository settings:

1. Go to **Settings → Pages**
2. Under **Build and deployment**, choose:
   - **Source**: *Deploy from a branch*
   - **Branch**: `gh-pages` / `/ (root)`
3. Save

If your Actions are restricted, also check:

- **Settings → Actions → General → Workflow permissions**
- Set to: **Read and write permissions**

After that, each push to `main` that changes `sar-dashboard-v3/**` will redeploy the frontend.

## Routing note

The app uses `HashRouter` so client-side routes work reliably on GitHub Pages project sites.
