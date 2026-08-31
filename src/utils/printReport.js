/**
 * A4 报告打印：在独立 iframe 中输出，图表先按固定尺寸导出为 PNG。
 */
import { getInstanceByDom } from 'echarts/core'

const PRINT_CONTENT_WIDTH = 680
const CHART_ARC_HEIGHT = 200
const CHART_SPEED_HEIGHT = 220

const PRINT_CSS = `
@page { size: A4 portrait; margin: 10mm; }
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  background: #fff; color: #1f2d3d;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-size: 11pt; line-height: 1.5;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.report-paper {
  width: 100%; max-width: 100%;
  padding: 0; margin: 0;
  background: #fff; color: #1f2d3d;
}
.rpt-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  border-bottom: 2px solid #3488d9;
  padding-bottom: 10px; margin-bottom: 14px;
}
.rpt-title { font-size: 16pt; font-weight: 700; }
.rpt-sub { font-size: 10pt; color: #5c6b7f; margin-top: 4px; }
.rpt-meta { font-size: 9pt; color: #5c6b7f; text-align: right; }
.rpt-section { margin-bottom: 12px; }
.rpt-section h3 {
  font-size: 11pt; font-weight: 600; color: #3488d9;
  margin: 0 0 8px; padding-left: 8px;
  border-left: 3px solid #3488d9;
}
.rpt-h4 { font-size: 10pt; font-weight: 600; margin: 0 0 4px; }
.rpt-caption { font-size: 9pt; color: #5c6b7f; margin: 0 0 6px; }
.rpt-conclusions { margin: 0; padding-left: 18px; }
.rpt-conclusions li { margin-bottom: 4px; }
.rpt-table {
  width: 100%; border-collapse: collapse;
  font-size: 9pt; table-layout: fixed;
}
.rpt-table th, .rpt-table td {
  border: 1px solid #d0d7e5;
  padding: 4px 6px; text-align: left; vertical-align: top;
  word-break: break-all;
}
.rpt-table th { background: #f5f8fc; font-weight: 600; }
.rpt-table tr { break-inside: avoid; page-break-inside: avoid; }
.danger { color: #d33; }
.rpt-rec { color: #5c6b7f; }
.rpt-empty { color: #5c6b7f; font-size: 9pt; }
.tag-both {
  margin-left: 4px; font-size: 8pt; color: #b45309;
  background: #fff7ed; border: 1px solid #fdba74;
  border-radius: 2px; padding: 0 3px;
}
.rpt-chart-grid { display: block; width: 100%; }
.rpt-chart-block {
  width: 100%; margin-bottom: 10px;
  break-inside: avoid; page-break-inside: avoid;
}
.rpt-chart-wrap {
  width: 100%; border: 1px solid #d0d7e5;
  border-radius: 3px; overflow: hidden; background: #fff;
}
.rpt-print-img {
  display: block; width: 100%; height: auto; max-width: 100%;
}
.rpt-footer {
  margin-top: 14px; padding-top: 10px;
  border-top: 1px dashed #d0d7e5;
  font-size: 8pt; color: #8aa0c8; text-align: center;
}
.g-excellent { color: #2c9e5b; }
.g-good { color: #3488d9; }
.g-mid { color: #d98a18; }
.g-bad { color: #d33; }
.no-print { display: none !important; }
`

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function findChartIn(wrap) {
  let chartEl = null
  wrap.querySelectorAll('div').forEach((el) => {
    if (!chartEl && getInstanceByDom(el)) chartEl = el
  })
  return chartEl ? getInstanceByDom(chartEl) : null
}

function resizeCharts(root) {
  root.querySelectorAll('div').forEach((el) => {
    try {
      const c = getInstanceByDom(el)
      if (c) c.resize()
    } catch {
      /* ignore */
    }
  })
  window.dispatchEvent(new Event('resize'))
}

function waitImages(doc) {
  const imgs = [...doc.querySelectorAll('img')]
  if (!imgs.length) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) resolve()
          else {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }
        }),
    ),
  )
}

function printInIframe(bodyHtml) {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
      visibility: 'hidden',
    })
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument
    const win = iframe.contentWindow
    doc.open()
    doc.write(
      `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>检测报告</title>`
        + `<style>${PRINT_CSS}</style></head><body>${bodyHtml}</body></html>`,
    )
    doc.close()

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove()
        resolve()
      }, 400)
    }

    waitImages(doc).then(() => {
      setTimeout(() => {
        win.focus()
        win.print()
        win.addEventListener('afterprint', cleanup, { once: true })
        setTimeout(cleanup, 4000)
      }, 200)
    })
  })
}

/**
 * @param {HTMLElement} paperEl  #a4-report-paper
 */
export async function printReportElement(paperEl) {
  if (!paperEl) return false

  const origPaper = {
    width: paperEl.style.width,
    maxWidth: paperEl.style.maxWidth,
    boxSizing: paperEl.style.boxSizing,
  }
  const wraps = [...paperEl.querySelectorAll('.rpt-chart-wrap')]
  const wrapSaved = wraps.map((wrap) => ({
    width: wrap.style.width,
    height: wrap.style.height,
    overflow: wrap.style.overflow,
  }))

  try {
    paperEl.style.width = `${PRINT_CONTENT_WIDTH + 72}px`
    paperEl.style.maxWidth = `${PRINT_CONTENT_WIDTH + 72}px`
    paperEl.style.boxSizing = 'border-box'

    wraps.forEach((wrap) => {
      const h = wrap.classList.contains('rpt-chart-speed') ? CHART_SPEED_HEIGHT : CHART_ARC_HEIGHT
      wrap.style.width = `${PRINT_CONTENT_WIDTH}px`
      wrap.style.height = `${h}px`
      wrap.style.overflow = 'hidden'
    })

    await delay(80)
    resizeCharts(paperEl)
    await delay(500)
    resizeCharts(paperEl)
    await delay(300)

    const imageUrls = wraps.map((wrap) => {
      const chart = findChartIn(wrap)
      if (!chart) return null
      try {
        return chart.getDataURL({
          type: 'png',
          pixelRatio: 2,
          backgroundColor: '#fff',
        })
      } catch {
        return null
      }
    })

    const clone = paperEl.cloneNode(true)
    clone.removeAttribute('id')
    clone.querySelectorAll('.no-print').forEach((n) => n.remove())

    const cloneWraps = [...clone.querySelectorAll('.rpt-chart-wrap')]
    cloneWraps.forEach((wrap, i) => {
      const url = imageUrls[i]
      if (!url) {
        const block = wrap.closest('.rpt-chart-block')
        if (block) block.remove()
        else wrap.remove()
        return
      }
      wrap.innerHTML = ''
      const img = document.createElement('img')
      img.className = 'rpt-print-img'
      img.src = url
      img.alt = 'chart'
      wrap.appendChild(img)
      wrap.style.height = 'auto'
      wrap.style.overflow = 'visible'
      wrap.style.width = '100%'
    })

    // 去掉克隆里残留的空白 v-chart 容器
    clone.querySelectorAll('.rpt-chart').forEach((el) => {
      if (!el.querySelector('img')) el.remove()
    })

    await printInIframe(clone.outerHTML)
    return true
  } finally {
    wraps.forEach((wrap, i) => {
      const s = wrapSaved[i]
      wrap.style.width = s.width
      wrap.style.height = s.height
      wrap.style.overflow = s.overflow
    })
    paperEl.style.width = origPaper.width
    paperEl.style.maxWidth = origPaper.maxWidth
    paperEl.style.boxSizing = origPaper.boxSizing
    await delay(50)
    resizeCharts(paperEl)
  }
}
