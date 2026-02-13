import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

/* ────────────────────────────────────────────────────────────
 *  Inject temporary stylesheet to enhance visual clarity
 *  specifically for PNG/PDF exports.
 * ──────────────────────────────────────────────────────────── */
function injectExportStyles() {
    const style = document.createElement('style');
    style.id = '__export_styles__';
    style.textContent = `
        /* ── Week column borders: bold & visible ── */
        [class*="border-r"][class*="border-slate-50"],
        [class*="border-r"][class*="border-slate-100"] {
            border-right: 1.5px solid #cbd5e1 !important;
        }

        /* ── Row bottom borders visible ── */
        [class*="border-b"][class*="border-slate-50"] {
            border-bottom: 1.5px solid #e2e8f0 !important;
        }

        /* ── Task name: remove truncation, ensure full text visible ── */
        .truncate {
            overflow: visible !important;
            text-overflow: unset !important;
            white-space: normal !important;
            word-break: break-word !important;
        }

        /* ── Task name column: wider for export ── */
        [style*="min-width: 350"] {
            min-width: 420px !important;
            width: 420px !important;
        }

        /* ── Make all task text slightly bolder ── */
        input[class*="font-medium"] {
            font-weight: 700 !important;
            color: #1e293b !important;
        }

        /* ── Header text: bolder ── */
        [class*="font-heading"], [class*="font-bold"] {
            font-weight: 800 !important;
        }

        /* ── Month header row borders ── */
        [class*="border-r"][class*="border-slate-200"] {
            border-right: 2px solid #94a3b8 !important;
        }

        /* ── Task bars: darker / more saturated for export ── */
        [data-taskbar="true"] {
            filter: saturate(1.4) brightness(0.85) !important;
        }
        [data-taskbar="true"] > div {
            filter: saturate(1.2) !important;
        }

        /* ── Payment diamonds: bolder ── */
        .bg-amber-500 {
            background-color: #d97706 !important;
        }
    `;
    document.head.appendChild(style);
    return () => {
        const el = document.getElementById('__export_styles__');
        if (el) el.remove();
    };
}

/* ────────────────────────────────────────────────────────────
 *  Expand scrollable container so html2canvas can
 *  capture the FULL content (not just the visible viewport).
 * ──────────────────────────────────────────────────────────── */
function unlockOverflow(el) {
    const originals = [];

    // Walk up to unlock every ancestor with hidden/auto overflow
    let node = el;
    while (node && node !== document.body) {
        const cs = getComputedStyle(node);
        if (cs.overflow !== 'visible' || cs.maxHeight !== 'none') {
            originals.push({
                node,
                overflow: node.style.overflow,
                overflowX: node.style.overflowX,
                overflowY: node.style.overflowY,
                height: node.style.height,
                maxHeight: node.style.maxHeight,
                flex: node.style.flex,
            });
            node.style.overflow = 'visible';
            node.style.overflowX = 'visible';
            node.style.overflowY = 'visible';
            node.style.height = 'auto';
            node.style.maxHeight = 'none';
            node.style.flex = 'none';
        }
        node = node.parentElement;
    }

    // Un-stick any sticky headers so they render in-flow
    const stickies = el.querySelectorAll('.sticky');
    const stickyBackup = [];
    stickies.forEach(s => {
        stickyBackup.push({ el: s, pos: s.style.position, left: s.style.left, top: s.style.top });
        s.style.position = 'relative';
        s.style.left = 'auto';
        s.style.top = 'auto';
    });

    // Reset scroll so capture starts at 0,0
    const scrollX = el.scrollLeft;
    const scrollY = el.scrollTop;
    el.scrollLeft = 0;
    el.scrollTop = 0;

    return () => {
        originals.forEach(o => {
            o.node.style.overflow = o.overflow;
            o.node.style.overflowX = o.overflowX;
            o.node.style.overflowY = o.overflowY;
            o.node.style.height = o.height;
            o.node.style.maxHeight = o.maxHeight;
            o.node.style.flex = o.flex;
        });
        stickyBackup.forEach(({ el: s, pos, left, top }) => {
            s.style.position = pos;
            s.style.left = left;
            s.style.top = top;
        });
        el.scrollLeft = scrollX;
        el.scrollTop = scrollY;
    };
}

/* ────────────────────────────────────────────────────────────
 *  CRITICAL: html2canvas cannot render <input> values properly.
 *  Temporarily swap every <input> with a visible <span>.
 * ──────────────────────────────────────────────────────────── */
function swapInputsToSpans(container) {
    const inputs = container.querySelectorAll('input[type="text"], input:not([type])');
    const restores = [];

    inputs.forEach(inp => {
        const text = inp.value || inp.placeholder || '';
        if (!text) return;

        // Create a span that visually replaces the input
        const span = document.createElement('span');
        span.textContent = text;
        span.className = inp.className; // copy Tailwind classes
        // Override input-specific styles
        span.style.display = 'inline-block';
        span.style.width = '100%';
        span.style.fontWeight = '700';
        span.style.fontSize = getComputedStyle(inp).fontSize;
        span.style.color = getComputedStyle(inp).color;
        span.style.lineHeight = getComputedStyle(inp).lineHeight;
        span.style.whiteSpace = 'nowrap';
        span.style.overflow = 'visible';
        span.style.textOverflow = 'unset';
        span.setAttribute('data-export-span', '1');

        // Hide the input, insert the span after it
        inp.style.display = 'none';
        inp.parentElement.insertBefore(span, inp.nextSibling);

        restores.push(() => {
            inp.style.display = '';
            span.remove();
        });
    });

    return () => restores.forEach(fn => fn());
}

/* ────────────────────────────────────────────────────────────
 *  Inject a temporary title banner at the top of the element.
 * ──────────────────────────────────────────────────────────── */
function injectTitleBanner(el, displayTitle) {
    if (!displayTitle) return () => { };
    const banner = document.createElement('div');
    banner.id = '__export_title_banner__';
    banner.textContent = displayTitle;
    banner.style.cssText = `
        font-size: 22px; font-weight: 900; text-align: center;
        padding: 14px 20px; background: linear-gradient(135deg, #eef2ff, #e0e7ff);
        color: #312e81; letter-spacing: 2px; border-bottom: 3px solid #818cf8;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    el.insertBefore(banner, el.firstChild);
    return () => banner.remove();
}

/* ────────────────────────────────────────────────────────────
 *  Capture the full element to a canvas (high-res).
 *  Creates an off-screen wrapper with optional title banner.
 * ──────────────────────────────────────────────────────────── */
async function capture(el, displayTitle, lang = 'vi') {
    // 1. Inject bold export styles
    const removeStyles = injectExportStyles();

    // 2. Unlock overflow
    const restoreOverflow = unlockOverflow(el);

    // 3. Swap <input> → <span> so text is visible in capture
    const restoreInputs = swapInputsToSpans(el);

    // 4. Scroll to top-left so content starts at origin
    const savedScrollTop = el.scrollTop;
    const savedScrollLeft = el.scrollLeft;
    el.scrollTop = 0;
    el.scrollLeft = 0;

    // Give the browser time to repaint with new styles
    await new Promise(r => setTimeout(r, 500));

    // 5. Create an off-screen wrapper with title banner + element content
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:absolute; left:-99999px; top:0; background:#ffffff;';

    // Title banner
    if (displayTitle) {
        const banner = document.createElement('div');
        banner.textContent = displayTitle;
        banner.style.cssText = `
            font-size: 22px; font-weight: 900; text-align: center;
            padding: 14px 20px; background: linear-gradient(135deg, #eef2ff, #e0e7ff);
            color: #312e81; letter-spacing: 2px; border-bottom: 3px solid #818cf8;
            font-family: system-ui, -apple-system, sans-serif;
        `;
        wrapper.appendChild(banner);
    }

    // Clone the element content to avoid moving DOM nodes
    const clone = el.cloneNode(true);
    clone.style.overflow = 'visible';
    clone.style.height = 'auto';
    clone.style.maxHeight = 'none';
    wrapper.appendChild(clone);

    // Legend footer
    const legend = document.createElement('div');
    legend.textContent = lang === 'vi'
        ? 'Chú thích:   O = Onsite   |   ◆ = Mốc thanh toán'
        : 'Legend:   O = Onsite   |   ◆ = Payment Milestone';
    legend.style.cssText = `
        font-size: 13px; font-style: italic; text-align: center;
        padding: 10px 20px; background: #f0f4f8;
        color: #555; letter-spacing: 1px; border-top: 2px solid #94a3b8;
        font-family: system-ui, -apple-system, sans-serif;
    `;
    wrapper.appendChild(legend);

    document.body.appendChild(wrapper);

    // Wait for clone to render
    await new Promise(r => setTimeout(r, 300));

    const w = wrapper.scrollWidth;
    const h = wrapper.scrollHeight;

    let canvas;
    try {
        canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: w,
            height: h,
            windowWidth: w + 100,
            windowHeight: h + 100,
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0,
        });
    } finally {
        // Clean up
        wrapper.remove();
        restoreInputs();
        restoreOverflow();
        removeStyles();
        el.scrollTop = savedScrollTop;
        el.scrollLeft = savedScrollLeft;
    }
    return canvas;
}

/* ════════════════════════════════════════════════════════════
 *   PUBLIC: Export PDF  (multi-page A4-Landscape)
 * ════════════════════════════════════════════════════════════ */
export async function exportPdf(element, title = 'MOST_Schedule', displayTitle = '', lang = 'vi') {
    if (!element) return;

    const canvas = await capture(element, displayTitle, lang);
    if (!canvas || canvas.width === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const m = 5;
    const usableW = pageW - m * 2;
    const usableH = pageH - m * 2;

    const imgW = canvas.width;
    const imgH = canvas.height;
    const scale = usableW / (imgW / 2);
    const totalH = (imgH / 2) * scale;

    if (totalH <= usableH) {
        doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, usableW, totalH);
    } else {
        const sliceH = Math.floor(imgH * (usableH / totalH));
        let srcY = 0;
        let page = 0;
        while (srcY < imgH) {
            if (page > 0) doc.addPage();
            const thisH = Math.min(sliceH, imgH - srcY);
            const tmp = document.createElement('canvas');
            tmp.width = imgW;
            tmp.height = thisH;
            tmp.getContext('2d').drawImage(canvas, 0, srcY, imgW, thisH, 0, 0, imgW, thisH);
            const renderH = (thisH / 2) * scale;
            doc.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, usableW, renderH);
            srcY += thisH;
            page++;
        }
    }

    const filename = `${title}_${new Date().toISOString().slice(0, 10)}.pdf`;
    const blob = doc.output('blob');
    saveAs(blob, filename);
}

/* ════════════════════════════════════════════════════════════
 *   PUBLIC: Export PNG  (high-res image)
 * ════════════════════════════════════════════════════════════ */
export async function exportImage(element, title = 'MOST_Schedule', displayTitle = '', lang = 'vi') {
    if (!element) return;

    const canvas = await capture(element, displayTitle, lang);
    if (!canvas || canvas.width === 0) return;

    const filename = `${title}_${new Date().toISOString().slice(0, 10)}.png`;

    canvas.toBlob(blob => {
        if (blob) saveAs(blob, filename);
    }, 'image/png');
}
