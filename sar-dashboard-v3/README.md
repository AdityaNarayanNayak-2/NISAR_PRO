# SAR Dashboard v3 (Frontend)

React + Vite frontend for SAR Analyzer with mock workflow data suitable for standalone static deployment.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

A GitHub Actions workflow is included at:

- `.github/workflows/deploy-frontend-gh-pages.yml`

It will:

1. Build `sar-dashboard-v3`.
2. Publish static assets to GitHub Pages.
3. Add `404.html` fallback for SPA routes.

> Note: the app uses `HashRouter` so routes work on GitHub Pages with mock data and no backend.
