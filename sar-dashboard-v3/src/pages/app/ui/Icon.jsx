// Small inline icons (stroke, 16 px) so the app needs no icon font.
const P = {
  rail: 'M3 4h10M3 8h10M3 12h10',
  panel: 'M2.5 3.5h11v9h-11zM10 3.5v9',
  plus: 'M8 3v10M3 8h10',
  more: 'M4 8h.01M8 8h.01M12 8h.01',
  close: 'M4 4l8 8M12 4l-8 8',
  play: 'M5 3.5l7 4.5-7 4.5z',
  pause: 'M5 3.5v9M11 3.5v9',
  replay: 'M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.3h2.3',
  download: 'M8 3v7M5 7.5l3 3 3-3M3.5 13h9',
  layers: 'M8 2.5l5.5 3-5.5 3-5.5-3zM2.5 8.5l5.5 3 5.5-3',
  log: 'M3 4h10M3 8h7M3 12h9',
  chevron: 'M6 4l4 4-4 4',
  back: 'M10 4L6 8l4 4',
  brief: 'M4 13.5V2.5M4 3h7.5l-1.5 2.5L11.5 8H4',
  analysis: 'M2.5 13.5h11M4.5 11V8M8 11V4.5M11.5 11V6.5',
  check: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM5.5 8l1.8 1.8L10.8 6.3',
  sliders: 'M3 4.5h6M12 4.5h1M3 11.5h1M7 11.5h6M10.5 3v3M5.5 10v3',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5',
  copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  external: 'M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5',
  box: 'M3 3h10v10H3z',
  target: 'M8 13.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM8 1v3M8 12v3M1 8h3M12 8h3',
  report: 'M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12M6 8h4M6 10.5h4',
  globe: 'M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM2 8h12M8 2c1.8 1.8 1.8 10.2 0 12M8 2c-1.8 1.8-1.8 10.2 0 12',
  search: 'M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.5 10.5l3 3',
  home: 'M2.5 7.5L8 3l5.5 4.5M4 6.5V13h8V6.5',
  down: 'M4 6l4 4 4-4',
  up: 'M4 10l4-4 4 4',
  compare: 'M8 2.5v11M3 5h3M3 11h3M10 5h3M10 11h3',
  warn: 'M8 2.5l6 11H2zM8 6.5v3.5M8 12h.01',
}
export default function Icon({ name, size = 16, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <path d={P[name]} />
    </svg>
  )
}
