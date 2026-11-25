// Site-relative URL for files in public/ and for plain <a href> links. The site can be served from a
// sub-path (GitHub Pages: /NISAR_PRO/), so '/demo/runs.json' must become '/NISAR_PRO/demo/runs.json'.
// Router <Link to> paths do not need this: the router gets the same base as its basename.
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '')

export const site = (path) => (typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') ? BASE + path : path)
