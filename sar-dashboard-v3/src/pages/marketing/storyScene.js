// Scroll-driven story engine: dam release -> city flood -> 3D orbit -> SAR capture -> pipeline -> affected area.
// createStory(canvas, getProgress) -> { destroy }. Progress 0..1. Chapters 1-2 & the orbit are an ILLUSTRATIVE SCENARIO;
// chapters 4-6 are built on a real NISAR Pro GCOV crop and a real optical basemap crop (see assets.js).
import { SAR_DATA_URI, OPTICAL_DATA_URI } from './assets.js'

const TAU = Math.PI * 2, AC = '#63cabe', OC = '#d2a46a', INK = '#e9e7e1'
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const sm = t => { t = clamp(t); return t * t * (3 - 2 * t) }
const lerp = (a, b, k) => a + (b - a) * k
const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s) }
const ASPECT = 1 // real crops are square

// Irregular flood-extent blob, hand-tuned polar radii around a river-shaped core (normalized to a unit panel).
const FLOOD_PTS = [.30, .34, .30, .24, .18, .22, .30, .40, .52, .58, .50, .40, .30, .22, .16, .20, .26, .32, .28, .22, .18, .24, .30, .34]
const BUILDUP = [[.36, .30], [.62, .34], [.30, .52], [.66, .55], [.42, .70], [.58, .68]] // normalized positions near the blob edge

function loadImg(src) { const im = new Image(); im.decoding = 'sync'; im.src = src; return im }

export function createStory(cv, getP) {
  const g = cv.getContext('2d')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const sarImg = loadImg(SAR_DATA_URI), optImg = loadImg(OPTICAL_DATA_URI)
  const stars = Array.from({ length: 110 }, (_, i) => [hash(i, 1), hash(i, 2), hash(i, 3)])
  const blocks = []
  for (let i = -4; i <= 4; i++) for (let j = 0; j < 4; j++) blocks.push({ x: i * 1.9, y: 7.2 + j * 1.9, h: .35 + hash(i, j) * 1.5 })
  blocks.sort((a, b) => a.x + a.y - (b.x + b.y))
  let W = 0, H = 0, raf = 0, on = false, pd = getP(), ga = 1, floodPath = null, floodPathKey = ''
  const al = x => { g.globalAlpha = x * ga }
  const text = (s, x, y, size = 10, color = INK, a = 1, align = 'left') => { al(a); g.fillStyle = color; g.font = `500 ${size}px 'IBM Plex Mono',ui-monospace,monospace`; g.textAlign = align; g.fillText(s, x, y) }
  const poly = (pts, fill, a = 1, stroke, lw = 1) => {
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath()
    if (fill) { al(a); g.fillStyle = fill; g.fill() } if (stroke) { al(a); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke() }
  }
  function size() {
    const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2)
    W = r.width; H = r.height; cv.width = W * d; cv.height = H * d; g.setTransform(d, 0, 0, d, 0, 0)
  }
  // Panel sits low enough to clear a fixed site header plus the story's own top badge (see StoryScroll.jsx).
  const HEAD_CLEAR = () => Math.max(H * .24, 168)
  const panelRect = () => {
    const top = HEAD_CLEAR(), avail = H - top - H * .30
    const ph = Math.min(avail, W * .58 / ASPECT), pw = ph * ASPECT
    return [W / 2 - pw / 2, top + (avail - ph) / 2, pw, ph]
  }
  const brackets = (x, y, w, h, c, a) => { al(a); g.strokeStyle = c; g.lineWidth = 1.5; const L = 16
    for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { g.beginPath(); g.moveTo(px, py + sy * L); g.lineTo(px, py); g.lineTo(px + sx * L, py); g.stroke() } }
  const cover = (img, x, y, w, h) => { // object-fit: cover
    if (!img.complete || !img.naturalWidth) { al(1); g.fillStyle = '#141b20'; g.fillRect(x, y, w, h); return }
    const ir = img.naturalWidth / img.naturalHeight, r = w / h
    let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight
    if (ir > r) { sw = sh * r; sx = (img.naturalWidth - sw) / 2 } else { sh = sw / r; sy = (img.naturalHeight - sh) / 2 }
    g.drawImage(img, sx, sy, sw, sh, x, y, w, h)
  }
  function getFloodPath(x, y, w, h) {
    const key = `${x | 0},${y | 0},${w | 0},${h | 0}`
    if (floodPathKey === key && floodPath) return floodPath
    floodPathKey = key; const p = new Path2D(); const cx = x + w * .5, cy = y + h * .5, R = Math.min(w, h) * .62
    FLOOD_PTS.forEach((r, i) => { const a = (i / FLOOD_PTS.length) * TAU, px = cx + Math.cos(a) * R * r * 1.6, py = cy + Math.sin(a) * R * r * 1.9
      i ? p.lineTo(px, py) : p.moveTo(px, py) })
    p.closePath(); floodPath = p; return p
  }

  // ---------- chapters 1-2: isometric dam + city (illustrative) ----------
  function sceneDam(p, t) {
    const k2 = sm((p - .1) / .2), ty = lerp(-1, 8.5, k2), S = Math.min(W / 16, H / 10) * lerp(1.3, 1, k2)
    const ox = W / 2 + ty * .866 * S, oy = H * .5 - ty * .5 * S
    const P = (x, y, z = 0) => [ox + (x - y) * .866 * S, oy + (x + y) * .5 * S - z * S]
    poly([P(-9, -10), P(9, -10), P(9, 15), P(-9, 15)], '#10161b')
    g.lineWidth = 1; for (let k = -8; k <= 8; k += 2) { poly([P(k, -10), P(k, 15)].concat([P(k, 15)]), null, .06, INK); poly([P(-9, k * 1.4), P(9, k * 1.4)].concat([P(9, k * 1.4)]), null, .06, INK) }
    poly([P(-4.5, -9), P(4.5, -9), P(3.6, -.4), P(-3.6, -.4)], '#123c46', 1, 'rgba(99,202,190,.4)')
    const fy = lerp(.3, 12.8, sm((p - .03) / .28)), hw = y => .9 + y * .28
    if (p > .02) {
      const L = [], R = []; for (let y = .4; y < fy; y += .4) { L.push(P(-hw(y), y)); R.unshift(P(hw(y), y)) }
      L.push(P(-hw(fy), fy)); R.unshift(P(hw(fy), fy))
      poly(L.concat(R), AC, .5, AC, 1.5)
      if (!reduced) for (let i = 0; i < 26; i++) { const y = ((i * .53 + t * 1.6) % fy) + .2, x = (hash(i, 9) - .5) * 2 * hw(y) * .9; const q = P(x, y); al(.35); g.fillStyle = '#d9fffb'; g.fillRect(q[0], q[1], 2, 1) }
    }
    const top = [P(-3.2, -.4, 2.2), P(3.2, -.4, 2.2), P(3.2, .4, 2.2), P(-3.2, .4, 2.2)]
    poly([P(-3.2, .4, 0), P(3.2, .4, 0), P(3.2, .4, 2.2), P(-3.2, .4, 2.2)], '#39434c'); poly([P(3.2, -.4, 0), P(3.2, .4, 0), P(3.2, .4, 2.2), P(3.2, -.4, 2.2)], '#242c33'); poly(top, '#55616c')
    for (const gx of [-1.6, 0, 1.6]) { poly([P(gx - .35, .41, 0), P(gx + .35, .41, 0), P(gx + .35, .41, .9), P(gx - .35, .41, .9)], '#0b0f13')
      if (p > .02) poly([P(gx - .3, .42, 0), P(gx + .3, .42, 0), P(gx + .45, 1.6, 0), P(gx - .45, 1.6, 0)], '#d9fffb', .7 + (reduced ? 0 : .2 * Math.sin(t * 8 + gx))) }
    for (const b of blocks) {
      const wet = b.y < fy && Math.abs(b.x) < hw(b.y), w = 1.15, h = b.h
      poly([P(b.x, b.y + w, 0), P(b.x + w, b.y + w, 0), P(b.x + w, b.y + w, h), P(b.x, b.y + w, h)], wet ? '#1f4650' : '#2a343c')
      poly([P(b.x + w, b.y, 0), P(b.x + w, b.y + w, 0), P(b.x + w, b.y + w, h), P(b.x + w, b.y, h)], wet ? '#173840' : '#1c242a')
      poly([P(b.x, b.y, h), P(b.x + w, b.y, h), P(b.x + w, b.y + w, h), P(b.x, b.y + w, h)], wet ? '#2d6a72' : '#3d4954')
    }
    const a1 = 1 - sm((p - .12) / .04), a2 = sm((p - .17) / .04)
    let q = P(-4, -1, 2.8); text('DAM · SPILLWAY RELEASE', q[0], q[1], 11, OC, a1)
    q = P(-6.6, 11, 1); text('DOWNSTREAM CITY', q[0], q[1], 11, OC, a2)
  }

  // ---------- chapters 3-4: 3D orbit (illustrative) + a real SAR crop as the capture ----------
  function sceneSpace(p, t) {
    const Re = Math.min(W, H) * .27, cx = W / 2, cy = H * .44, T = .38
    const rot = .4 + 1.1 * clamp((p - .32) / .2), spin = reduced ? 0 : t * .02
    const proj = (x, y, z, r = rot) => { const x1 = x * Math.cos(r) + z * Math.sin(r), z1 = -x * Math.sin(r) + z * Math.cos(r), y2 = y * Math.cos(T) - z1 * Math.sin(T), z2 = y * Math.sin(T) + z1 * Math.cos(T); return [cx + x1 * Re, cy - y2 * Re, z2] }
    for (const s of stars) { al(.3 + .4 * s[2]); g.fillStyle = '#cfe6ff'; g.fillRect(s[0] * W, s[1] * H, 1.2, 1.2) }
    const gr = g.createRadialGradient(cx, cy, Re * .96, cx, cy, Re * 1.18); gr.addColorStop(0, 'rgba(99,202,190,.4)'); gr.addColorStop(1, 'rgba(99,202,190,0)')
    al(1); g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, Re * 1.18, 0, TAU); g.fill()
    const eg = g.createRadialGradient(cx + Re * .4, cy - Re * .4, Re * .1, cx, cy, Re); eg.addColorStop(0, '#1d5364'); eg.addColorStop(1, '#06121a')
    al(1); g.fillStyle = eg; g.beginPath(); g.arc(cx, cy, Re, 0, TAU); g.fill()
    g.lineWidth = 1; g.strokeStyle = AC
    for (let la = -60; la <= 60; la += 30) { const y = Math.sin(la * Math.PI / 180), r0 = Math.cos(la * Math.PI / 180); g.beginPath(); let pen = false
      for (let a = 0; a <= 360; a += 6) { const q = proj(r0 * Math.cos(a * Math.PI / 180), y, r0 * Math.sin(a * Math.PI / 180), rot + spin); if (q[2] > 0) { pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = true } else pen = false } al(.22); g.stroke() }
    for (let lo = 0; lo < 360; lo += 30) { g.beginPath(); let pen = false
      for (let a = -90; a <= 90; a += 6) { const y = Math.sin(a * Math.PI / 180), r0 = Math.cos(a * Math.PI / 180), l = lo * Math.PI / 180; const q = proj(r0 * Math.cos(l), y, r0 * Math.sin(l), rot + spin); if (q[2] > 0) { pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = true } else pen = false } al(.22); g.stroke() }
    const inc = .9, orb = th => { const x = 1.5 * Math.cos(th), z = 1.5 * Math.sin(th); return proj(x, z * Math.sin(inc), z * Math.cos(inc), 0) }
    const th = 1 + 9 * sm((p - .34) / .2)
    for (const front of [false, true]) { g.beginPath(); let pen = false
      for (let a = 0; a <= 360; a += 4) { const q = orb(a * Math.PI / 180); if ((q[2] > 0) === front) { pen ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); pen = true } else pen = false }
      al(front ? .6 : .18); g.strokeStyle = OC; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]) }
    const sp = orb(th), tgt = orb(1 + 9), d = Math.hypot(tgt[0] - cx, tgt[1] - cy), k = (Re * .98) / d
    const mk = [cx + (tgt[0] - cx) * k, cy + (tgt[1] - cy) * k]
    al(.9); g.fillStyle = OC; g.beginPath(); g.arc(mk[0], mk[1], 3.5, 0, TAU); g.fill(); text('AREA OF INTEREST', mk[0] + 10, mk[1] - 8, 9, OC, .9)
    const hidden = sp[2] < 0 && Math.hypot(sp[0] - cx, sp[1] - cy) < Re
    if (!hidden) {
      const sc = 1 + sp[2] * .18, cap = sm((p - .48) / .04) * (1 - sm((p - .62) / .03))
      if (cap > 0) { const w = 26 * cap + 8; poly([[sp[0], sp[1]], [mk[0] - w, mk[1]], [mk[0] + w, mk[1]]], AC, .22 * cap); const sw = ((p * 30) % 1); al(.9 * cap); g.strokeStyle = '#d9fffb'; g.beginPath(); g.moveTo(mk[0] - w, mk[1] + (sw - .5) * 14); g.lineTo(mk[0] + w, mk[1] + (sw - .5) * 14); g.stroke() }
      g.save(); g.translate(sp[0], sp[1]); g.scale(sc, sc); al(1)
      g.fillStyle = '#2a63d8'; g.fillRect(-30, -3, 22, 6); g.fillRect(8, -3, 22, 6); g.fillStyle = '#d9a445'; g.fillRect(-8, -7, 16, 14); g.fillStyle = '#cfd8e0'; g.beginPath(); g.ellipse(-2, 12, 11, 4, .3, 0, TAU); g.fill(); g.restore()
      if (p < .5) text('SAR SATELLITE · L-BAND', sp[0] + 16, sp[1] - 12, 9, INK, .8)
    }
    // captured frame — a real NISAR Pro GCOV crop fades in as the "capture"
    const c = sm((p - .52) / .05); if (c > 0) {
      const [, , w, h] = panelRect(), cw = w * c, ch = h * c, px = W / 2 - cw / 2, py = HEAD_CLEAR() + ((H - HEAD_CLEAR() - H * .30) - ch) / 2
      al(c); cover(sarImg, px, py, cw, ch); brackets(px, py, cw, ch, AC, c)
      const fl = 1 - sm((p - .52) / .02); if (fl > 0) { al(.7 * fl); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H) }
      if (c > .9) text('NISAR L2 GCOV · REAL PRODUCT CROP', px, py - 10, 10, AC, 1)
    }
  }

  // ---------- chapters 5-6: pipeline + output, on the real SAR crop ----------
  function sceneData(p) {
    const stages = ['BASELINE', 'ACTIVE', 'LOG-RATIO + OTSU', 'REGION GROWING', 'REPORT'], q = clamp((p - .64) / .16)
    const y0 = Math.max(H * .13, 96), bw = Math.min(W * .17, 150), gap = (W * .84 - bw * 5) / 4
    stages.forEach((s, i) => { const x = W * .08 + i * (bw + gap), lit = q > i / 5 + .02
      al(1); g.strokeStyle = lit ? AC : 'rgba(233,231,225,.25)'; g.fillStyle = lit ? 'rgba(99,202,190,.14)' : 'rgba(233,231,225,.03)'; g.lineWidth = 1; g.fillRect(x, y0 - 17, bw, 34); g.strokeRect(x, y0 - 17, bw, 34)
      text(s, x + bw / 2, y0 + 3, Math.max(8, Math.min(10, W / 90)), lit ? INK : '#8b9594', 1, 'center')
      if (i < 4) { al(.4); g.strokeStyle = AC; g.beginPath(); g.moveTo(x + bw, y0); g.lineTo(x + bw + gap, y0); g.stroke() } })
    const px0 = W * .08 + (q * 4) * (bw + gap); if (q > 0 && q < 1) { al(1); g.fillStyle = '#d9fffb'; g.fillRect(Math.min(px0, W * .92), y0 - 2, 6, 4) }
    const [x, y, w, h] = panelRect(), q1 = sm((p - .66) / .05), q2 = sm((p - .73) / .10), q3 = sm((p - .84) / .09)
    al(q1); cover(q2 > .05 ? optImg : sarImg, x, y, w, h)
    if (q2 > 0) { // flood extent: one soft irregular blob, revealed top-to-bottom, not a pixel grid
      const fp = getFloodPath(x, y, w, h)
      g.save(); g.beginPath(); g.rect(x, y, w, h * clamp(q2 * 1.08)); g.clip()
      al(.85 * q2); g.fillStyle = 'rgba(99,202,190,.34)'; g.fill(fp)
      al(.95 * q2); g.lineWidth = 1.4; g.strokeStyle = AC; g.stroke(fp)
      g.restore()
    }
    if (q3 > 0) { // affected built-up area: soft glowing markers, not grid squares
      BUILDUP.forEach(([u, v], i) => { const mx = x + u * w, my = y + v * h, a = clamp(q3 * 5 - i, 0, 1); if (a <= 0) return
        al(.9 * a); const rg = g.createRadialGradient(mx, my, 0, mx, my, 13); rg.addColorStop(0, 'rgba(210,164,106,.9)'); rg.addColorStop(1, 'rgba(210,164,106,0)')
        g.fillStyle = rg; g.beginPath(); g.arc(mx, my, 13, 0, TAU); g.fill()
        al(a); g.fillStyle = OC; g.beginPath(); g.arc(mx, my, 3, 0, TAU); g.fill() })
    }
    brackets(x, y, w, h, AC, q1)
    text(q3 > .5 ? 'OUTPUT · AFFECTED AREA · ILLUSTRATIVE OVERLAY' : q2 > .05 ? 'BASELINE · REAL OPTICAL CONTEXT CROP' : 'INPUT · REAL SAR PRODUCT CROP', x, y - 10, 10, AC, q1)
    if (q2 > .3) { al(1); g.fillStyle = AC; g.beginPath(); g.arc(x, y + h + 22, 4, 0, TAU); g.fill(); text('FLOOD EXTENT (ILLUSTRATIVE OVERLAY)', x + 14, y + h + 26, 9, INK, 1)
      if (q3 > .3) { al(q3); g.fillStyle = OC; g.beginPath(); g.arc(x + 230, y + h + 22, 4, 0, TAU); g.fill(); text('AFFECTED BUILT-UP AREA', x + 244, y + h + 26, 9, INK, 1) } }
  }

  function draw() {
    pd += (getP() - pd) * (reduced ? 1 : .14); const p = pd, t = performance.now() / 1000
    g.globalAlpha = 1; g.fillStyle = '#0b0f13'; g.fillRect(0, 0, W, H)
    const a1 = 1 - sm((p - .32) / .04), a2 = sm((p - .32) / .04) * (1 - sm((p - .62) / .04)), a3 = sm((p - .62) / .04) * (1 - sm((p - .92) / .03))
    if (a1 > .01) { ga = a1; sceneDam(p, t) } if (a2 > .01) { ga = a2; sceneSpace(p, t) } if (a3 > .01) { ga = a3; sceneData(p) }
    ga = 1; g.globalAlpha = 1
  }
  const loop = () => { if (!on) return; draw(); raf = requestAnimationFrame(loop) }
  const io = new IntersectionObserver(e => { on = e[0].isIntersecting; cancelAnimationFrame(raf); if (on) loop() }, { threshold: 0 })
  const ro = new ResizeObserver(() => { size(); draw() })
  size(); io.observe(cv); ro.observe(cv)
  sarImg.onload = optImg.onload = () => { if (!on) draw() }
  return { destroy() { on = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect() } }
}
