export function escapeMapHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function buildMapPdfHtml(eventId: string, imageBase64: string, lines: string[]) {
  const summary = lines.map((line) => `<div>${escapeMapHtml(line)}</div>`).join('');
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
      h1 { font-size: 20px; margin-bottom: 12px; }
      .meta { font-size: 12px; color: #4B5563; margin-bottom: 16px; }
      .image-wrap { border: 1px solid #E5E7EB; border-radius: 8px; padding: 8px; margin-bottom: 16px; }
      img { width: 100%; max-width: 100%; height: auto; }
      .summary { font-size: 11px; line-height: 1.45; }
    </style>
  </head>
  <body>
    <h1>Mapa visual das mesas</h1>
    <div class="meta">Evento: ${escapeMapHtml(eventId)}</div>
    <div class="image-wrap"><img src="data:image/png;base64,${imageBase64}" /></div>
    <div class="summary">${summary}</div>
  </body>
</html>`;
}
