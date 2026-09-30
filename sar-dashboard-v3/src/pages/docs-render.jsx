import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import { assetMap, slugify, shimMath } from './docs-md'

function waitForKatex(timeout = 10000) {
    return new Promise((resolve) => {
        if (window.katex) return resolve(window.katex)
        const started = Date.now()
        const poll = setInterval(() => {
            if (window.katex) {
                clearInterval(poll)
                resolve(window.katex)
            } else if (Date.now() - started > timeout) {
                clearInterval(poll)
                resolve(null)
            }
        }, 120)
    })
}

function renderMathInto(root, katex) {
    root.querySelectorAll('.doc-math, .doc-math-inline').forEach(el => {
        const source = el.getAttribute('data-math') || ''
        if (katex) {
            try {
                katex.render(source, el, {
                    displayMode: el.classList.contains('doc-math'),
                    throwOnError: false,
                })
                return
            } catch {
                /* fall through to plain text */
            }
        }
        const fallback = document.createElement('span')
        fallback.className = 'doc-math-fallback'
        fallback.textContent = source
        el.replaceWith(fallback)
    })
}

function wireCodeBlocks(root) {
    root.querySelectorAll('pre').forEach(pre => {
        if (pre.dataset.docWired) return
        pre.dataset.docWired = '1'
        const code = pre.querySelector('code')
        const bar = document.createElement('div')
        bar.className = 'doc-codebar'
        const label = document.createElement('span')
        label.className = 'doc-codebar-label'
        const lang = (code && code.className || '').replace(/^language-/, '')
        label.textContent = lang || 'code'
        const btn = document.createElement('button')
        btn.className = 'doc-codebar-copy'
        btn.type = 'button'
        btn.textContent = 'Copy'
        btn.addEventListener('click', () => {
            const text = code ? code.innerText : ''
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(() => {
                    btn.textContent = 'Copied'
                    setTimeout(() => { btn.textContent = 'Copy' }, 1600)
                })
            }
        })
        bar.appendChild(label)
        bar.appendChild(btn)
        pre.insertBefore(bar, code)
    })
}

export default function MarkdownRenderer({ src }) {
    const rootRef = useRef(null)

    const html = useMemo(() => {
        const headingCounter = new Map()

        const renderer = {
            heading({ tokens, depth }) {
                const rawText = tokens.map(t => t.text).join('') || this.parser.parseInline(tokens)
                const base = slugify(rawText.replace(/<[^>]+>/g, ''))
                const count = headingCounter.get(base) || 0
                headingCounter.set(base, count + 1)
                const id = count === 0 ? base : `${base}-${count}`
                return `<h${depth} id="${id}" class="doc-md-heading" data-doc-depth="${depth}">${this.parser.parseInline(tokens)}</h${depth}>`
            },
            image({ href, title, text }) {
                const resolved = assetMap[href] || href
                const alt = (text || '').replace(/"/g, '&quot;')
                return `<figure class="doc-figure"><img src="${resolved}" alt="${alt}"${title ? ` title="${title}"` : ''}><figcaption>${alt}</figcaption></figure>`
            },
        }
        marked.use({ renderer, gfm: true, breaks: false })

        let out = marked.parse(shimMath(src))
        out = out.replace(/<blockquote>\s*<p>\[!(TIP|NOTE|WARNING|SUCCESS|INFERENCE)\]\s*/g, (_, type) => {
            const label = type.charAt(0) + type.slice(1).toLowerCase()
            return `<blockquote class="doc-alert doc-alert-${type.toLowerCase()}"><p class="doc-alert-badge">${label}</p><p>`
        })
        return out
    }, [src])

    useEffect(() => {
        let cancelled = false
        const root = rootRef.current
        if (!root) return undefined
        waitForKatex().then(katex => {
            if (!cancelled) renderMathInto(root, katex)
        })
        wireCodeBlocks(root)
        return () => { cancelled = true }
    }, [html])

    return <article ref={rootRef} className="docs-md" dangerouslySetInnerHTML={{ __html: html }} />
}