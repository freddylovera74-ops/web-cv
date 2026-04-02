const puppeteer = require('puppeteer');

// OWASP-FIX: A10 — Block all network requests during PDF generation.
// The CV HTML is self-contained (all CSS inline), so no external requests are needed.
// This prevents SSRF if malicious content somehow reached the HTML template.
const LOCAL_NET_PATTERN = /^(file:|data:|javascript:|https?:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.))/i;

async function generatePdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let page;
  try {
    page = await browser.newPage();

    // OWASP-FIX: A10 — Intercept and block requests to local/internal networks and non-data URIs
    await page.setRequestInterception(true);
    page.on('request', (interceptedReq) => {
      const url = interceptedReq.url();
      if (url === 'about:blank' || url.startsWith('data:')) {
        interceptedReq.continue();
        return;
      }
      if (LOCAL_NET_PATTERN.test(url)) {
        console.error(`[SECURITY] Puppeteer blocked request to: ${url}`);
        interceptedReq.abort();
        return;
      }
      interceptedReq.abort();
    });

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePdf };
