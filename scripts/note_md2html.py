"""Turn TECHNICAL_NOTE.md into IEEE-style two-column HTML (printed to PDF by build_note_pdf.sh).

Markdown used by the note:
  # Title, then author lines           -> title block across both columns
  ## Abstract / ## References          -> unnumbered sections
  ## Other heading                     -> I. OTHER HEADING (Roman numerals)
  > formula                            -> centred equation with number (1), (2) ...
  Table: caption  / Table*: caption    -> TABLE I caption; * = table across both columns
  ![Fig. N. caption](path)             -> figure across both columns
  1. item, | table | (<br> allowed in cells), **bold**, `code`, [n] reference lines
"""
import html
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read().split("\n")
base = sys.argv[3] if len(sys.argv) > 3 else ""


def inl(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", t)
    return t.replace("&lt;br&gt;", "<br>")


def roman(n):
    vals = [(10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    out = ""
    for v, r in vals:
        while n >= v:
            out += r
            n -= v
    return out


head, cols = [], []
out = cols
i, para, sec, eq, tab = 0, [], 0, 0, 0
pending_table = None


def flush():
    global para
    if para:
        out.append("<p>" + inl(" ".join(para)) + "</p>")
        para = []


while i < len(src):
    line = src[i]
    if line.startswith("# "):
        head.append("<h1>" + inl(line[2:]) + "</h1>")
        i += 1
        while i < len(src) and not src[i].strip():
            i += 1
        blk = []
        while i < len(src) and src[i].strip():
            blk.append(inl(src[i].strip()))
            i += 1
        head.append('<p class="meta">' + "<br>".join(blk) + "</p>")
        continue
    if line.startswith("## "):
        flush()
        name = line[3:].strip()
        if name == "Abstract":
            out.append(f'<h2 class="plain">{inl(name)}</h2>')
        elif name == "References":
            out.append(f"<h2>{inl(name)}</h2>")
        else:
            sec += 1
            out.append(f"<h2>{roman(sec)}. {inl(name)}</h2>")
    elif line.startswith("Index Terms:"):
        flush()
        out.append('<p class="terms"><i><b>Index Terms</b></i>—' + inl(line.split(":", 1)[1].strip()) + "</p>")
    elif line.startswith("!["):
        flush()
        m = re.match(r"!\[(.*)\]\((.*)\)", line)
        cap = inl(m[1])
        cap = re.sub(r"^(Fig\. \d+\.)", r"<b>\1</b>", cap)
        out.append(f'<figure class="float"><img src="{base}{m[2]}"><figcaption>{cap}</figcaption></figure>')
    elif re.match(r"^Table\*?:", line):
        flush()
        wide = line.startswith("Table*")
        tab += 1
        pending_table = (wide, f'<div class="tcap">TABLE {roman(tab)}<br>{inl(line.split(":", 1)[1].strip())}</div>')
    elif line.startswith("|"):
        flush()
        rows = []
        while i < len(src) and src[i].startswith("|"):
            rows.append(src[i])
            i += 1
        cells = lambda r: [c.strip() for c in r.strip().strip("|").split("|")]
        hdr = cells(rows[0])
        al = ["r" if c.endswith(":") else "" for c in cells(rows[1])]
        t = "<table><tr>" + "".join(f"<th>{inl(c)}</th>" for c in hdr) + "</tr>"
        for r in rows[2:]:
            t += "<tr>" + "".join(f'<td class="{a}">{inl(c)}</td>' for c, a in zip(cells(r), al)) + "</tr>"
        t += "</table>"
        wide, cap = pending_table if pending_table else (False, "")
        pending_table = None
        out.append(f'<div class="tbl{" float" if wide else ""}">{cap}{t}</div>')
        continue
    elif re.match(r"^\d+\. ", line):
        flush()
        items = []
        while i < len(src) and (re.match(r"^\d+\. ", src[i]) or (src[i].startswith("   ") and items)):
            if re.match(r"^\d+\. ", src[i]):
                items.append(re.sub(r"^\d+\. ", "", src[i]).strip())
            else:
                items[-1] += " " + src[i].strip()
            i += 1
        out.append("<ol>" + "".join(f"<li>{inl(t)}</li>" for t in items) + "</ol>")
        continue
    elif line.startswith("> "):
        flush()
        eq += 1
        e = inl(line[2:])
        e = re.sub(r"_(km²|acres|after|before|seed|Otsu|B)", r"<sub>\1</sub>", e)
        out.append(f'<div class="eq"><span>{e}</span><span class="eqn">({eq})</span></div>')
    elif line.startswith("["):
        flush()
        out.append('<p class="ref">' + inl(line) + "</p>")
    elif not line.strip():
        flush()
    else:
        para.append(line.strip())
    i += 1
flush()

body = "\n".join(cols)
# Abstract paragraph in IEEE style: "Abstract—text" in bold
body = re.sub(r'<h2 class="plain">Abstract</h2>\n<p>(.*?)</p>',
              r'<p class="abstract"><i><b>Abstract</b></i>—<b>\1</b></p>', body, count=1, flags=re.S)

css = """
@page { size: A4; margin: 0; }
body { font-family: 'Times New Roman', 'Liberation Serif', 'DejaVu Serif', serif; font-size: 9.6pt;
       line-height: 1.22; color: #000; margin: 0; }
.page { width: 210mm; height: 297mm; padding: 15mm 14mm 13mm; box-sizing: border-box; display: flex;
        flex-direction: column; overflow: hidden; position: relative; break-after: page; }
.page:last-child { break-after: auto; }
.pno { position: absolute; bottom: 7mm; left: 0; right: 0; text-align: center; font-size: 8pt; }
.cols { column-count: 2; column-gap: 6mm; column-fill: auto; flex: 1 1 auto; min-height: 0; }
#src { width: 182mm; }
h1 { font-size: 20pt; font-weight: normal; text-align: center; line-height: 1.15; margin: 0 0 8px; }
.meta { text-align: center; font-size: 10pt; margin: 0 0 10px; text-indent: 0; }
p { margin: 0 0 3px; text-align: justify; text-indent: 1em; hyphens: auto; }
p.cont { text-indent: 0; }
.abstract, .terms { text-indent: 0; font-size: 9pt; }
.terms { margin-bottom: 6px; }
h2 { font-size: 9.6pt; font-weight: normal; font-variant: small-caps; text-align: center;
     margin: 8px 0 4px; letter-spacing: 0.3px; }
h2.plain { display: none; }
.eq { white-space: nowrap; display: flex; justify-content: space-between; align-items: center; margin: 4px 0 5px; font-style: italic; }
.eq span:first-child { flex: 1; text-align: center; }
.eqn { font-style: normal; padding-left: 6px; }
ol { margin: 2px 0 4px 16px; padding: 0; }
li { margin: 1px 0; text-align: justify; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 7.9pt; }
.tbl { margin: 6px 0 8px; break-inside: avoid; }
.tcap { text-align: center; font-size: 8pt; font-variant: small-caps; margin-bottom: 3px; line-height: 1.25; }
table { border-collapse: collapse; margin: 0 auto; font-size: 7.8pt; width: 100%; }
.tbl.float table { width: auto; }
th { border-top: 1px solid #000; border-bottom: 0.6px solid #000; padding: 2px 4px; font-weight: bold; }
td { padding: 1.5px 4px; }
tr:last-child td { border-bottom: 1px solid #000; }
td.r { text-align: right; white-space: nowrap; }
.float { flex: 0 0 auto; margin: 0 0 9px; }
figure { text-align: center; }
figure img { width: 84%; display: block; margin: 0 auto; }
figcaption { font-size: 8pt; text-align: justify; margin-top: 3px; }
.ref { text-indent: -2.2em; padding-left: 2.2em; font-size: 7.8pt; margin: 1px 0; text-align: left; }
"""

# Page layout: IEEE style. Figures and wide tables float to the top of the next page;
# text flows through two columns per page and paragraphs split across pages.
js = r"""
function layout() {
  const src = document.getElementById('src');
  const blocks = [...src.children];
  src.remove();
  const head = blocks.shift();            // title block
  let page = null, cols = null, n = 0;
  const queue = [];
  const over = () => cols.scrollWidth > cols.clientWidth + 2;
  function room() { return cols.clientHeight; }
  function newPage() {
    page = document.createElement('div'); page.className = 'page';
    document.body.appendChild(page);
    n += 1;
    const pno = document.createElement('div'); pno.className = 'pno'; pno.textContent = n;
    page.appendChild(pno);
    if (n === 1) page.appendChild(head);
    cols = document.createElement('div'); cols.className = 'cols'; page.appendChild(cols);
    if (n > 1) placeFloats();
    // narrow tables that did not fit on the last page start this page's text
    while (held.length) cols.appendChild(held.shift());
  }
  const held = [];
  let textDone = false;
  function placeFloats() {
    let placed = 0;
    const minText = textDone ? 1 : page.clientHeight * 0.2;
    while (queue.length) {
      const f = queue[0];
      page.insertBefore(f, cols);
      if (placed > 0 && room() < minText) { page.removeChild(f); break; }
      queue.shift(); placed += 1;
    }
  }
  function tryBottom(f) {
    // put a float at the bottom of the current page if the text above still fits
    if (queue.length) return false;
    page.appendChild(f);
    if (over() || room() < 40) { page.removeChild(f); return false; }
    return true;
  }
  function tokens(htmlText) {
    const out = []; let cur = '', depth = 0;
    for (let i = 0; i < htmlText.length; i++) {
      const ch = htmlText[i];
      if (ch === '<') depth++;
      if (ch === '>') depth--;
      if (ch === ' ' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  }
  function joinFix(words) {
    // close tags left open at the cut, reopen them in the remainder
    const html = words.join(' ');
    const stack = [];
    html.replace(/<(\/?)(b|i|code)>/g, (m, close, tag) => { if (close) stack.pop(); else stack.push(tag); return m; });
    return [html + stack.slice().reverse().map(t => '</' + t + '>').join(''), stack.map(t => '<' + t + '>').join('')];
  }
  function splitPara(b) {
    const words = tokens(b.innerHTML);
    let lo = 0, hi = words.length - 1, best = 0;
    const probe = b.cloneNode(false);
    cols.appendChild(probe);
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      probe.innerHTML = joinFix(words.slice(0, mid))[0];
      if (over()) hi = mid - 1; else { best = mid; lo = mid + 1; }
    }
    if (best < 4) { cols.removeChild(probe); return false; }
    const [first, reopen] = joinFix(words.slice(0, best));
    probe.innerHTML = first;
    const rest = b.cloneNode(false);
    rest.classList.add('cont');
    rest.innerHTML = reopen + words.slice(best).join(' ');
    newPage();
    place(rest);
    return true;
  }
  function place(b) {
    cols.appendChild(b);
    if (!over()) return;
    cols.removeChild(b);
    if (b.classList.contains('tbl') && cols.children.length > 0) { held.push(b); return; }
    if (b.tagName === 'P' && !b.classList.contains('ref') && splitPara(b)) return;
    if (b.tagName === 'OL' && b.children.length > 1) {
      const items = [...b.children];
      const part = b.cloneNode(false); cols.appendChild(part);
      let k = 0;
      for (; k < items.length; k++) { part.appendChild(items[k]); if (over()) { part.removeChild(items[k]); break; } }
      if (k === 0) cols.removeChild(part);
      if (k < items.length) {
        const rest = b.cloneNode(false); rest.start = (b.start || 1) + k;
        items.slice(k).forEach(li => rest.appendChild(li));
        if (k > 0) { newPage(); place(rest); return; }
        b = rest;
      } else return;
    }
    const carry = [];
    const prev = cols.lastElementChild;
    if (prev && prev.tagName === 'H2') { cols.removeChild(prev); carry.push(prev); }
    const wasEmpty = cols.children.length === 0;
    if (wasEmpty && carry.length === 0) { cols.appendChild(b); return; }   // too tall: leave it
    newPage();
    carry.forEach(x => cols.appendChild(x));
    cols.appendChild(b);
  }
  newPage();
  for (const b of blocks) {
    if (b.classList.contains('float')) { if (!tryBottom(b)) queue.push(b); } else place(b);
  }
  textDone = true;
  if (held.length) newPage();
  // fill the free space of the last text page first, then new pages
  while (queue.length && tryBottomFinal()) {}
  while (queue.length) newPage();
  function tryBottomFinal() {
    const f = queue[0];
    page.appendChild(f);
    if (over() || room() < 2) { page.removeChild(f); return false; }
    queue.shift(); return true;
  }
}
window.addEventListener('load', layout);
"""
head_html = "\n".join(head)
html_out = (f'<!doctype html><html lang="en"><meta charset="utf-8"><style>{css}</style><body>'
            f'<div id="src"><div class="head">{head_html}</div>{body}</div>'
            f'<script>{js}</script></body></html>')
open(sys.argv[2], "w", encoding="utf-8").write(html_out)
