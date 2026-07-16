/**
 * Branded certificate HTML (§5.8) — DextaLearning blue/amber palette, Righteous
 * display font. A Handlebars template string; the renderer injects escaped data
 * and a QR-code data URI, then Puppeteer prints it to a landscape A4 PDF.
 * Self-contained (fonts via Google Fonts @import, everything else inline) so the
 * headless browser needs no local assets.
 */
export const CERTIFICATE_TEMPLATE = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Righteous&family=Inter:wght@400;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 297mm; height: 210mm; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    color: #0f172a;
    background: #ffffff;
    padding: 14mm;
  }
  .frame {
    height: 100%;
    border: 3px solid #1d4ed8;
    border-radius: 10px;
    padding: 12mm 16mm;
    position: relative;
    background:
      radial-gradient(circle at 0% 0%, rgba(29,78,216,0.06), transparent 40%),
      radial-gradient(circle at 100% 100%, rgba(245,158,11,0.08), transparent 40%);
    display: flex;
    flex-direction: column;
  }
  .accent { height: 6px; width: 96px; background: #f59e0b; border-radius: 999px; }
  .brand { font-family: 'Righteous', cursive; font-size: 22px; color: #1d4ed8; letter-spacing: .5px; margin-top: 10px; }
  .kicker { margin-top: 26mm; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; color: #64748b; }
  .name { font-family: 'Righteous', cursive; font-size: 46px; color: #0f172a; margin-top: 6px; }
  .subtitle { margin-top: 14px; font-size: 16px; color: #334155; }
  .title { font-size: 26px; font-weight: 600; color: #1d4ed8; margin-top: 6px; }
  .footer { margin-top: auto; display: flex; align-items: flex-end; justify-content: space-between; }
  .meta { font-size: 13px; color: #64748b; }
  .meta strong { color: #0f172a; }
  .verify { text-align: center; }
  .verify img { width: 96px; height: 96px; }
  .verify .code { margin-top: 4px; font-size: 10px; color: #94a3b8; letter-spacing: 1px; }
  .verify .label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
</style>
</head>
<body>
  <div class="frame">
    <div class="accent"></div>
    <div class="brand">{{platformName}}</div>

    <div class="kicker">Certificate of Completion</div>
    <div class="subtitle">This certifies that</div>
    <div class="name">{{learnerName}}</div>
    <div class="subtitle">has successfully completed the {{contentTypeLabel}}</div>
    <div class="title">{{contentTitle}}</div>

    <div class="footer">
      <div class="meta">
        Issued <strong>{{issuedDate}}</strong><br />
        Verify at <strong>{{verifyUrl}}</strong>
      </div>
      <div class="verify">
        <div class="label">Scan to verify</div>
        <img src="{{qrDataUri}}" alt="Verification QR code" />
        <div class="code">{{verifyToken}}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
