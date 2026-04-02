/**
 * Extract encoded status page id from StatusIQ HTML (varies by page template).
 *
 * Order: explicit JS/JSON keys first, then public asset URLs that embed the id
 * (`/sp/api/public/statuspages/logo|favicon/{id}?`), which appear on many tenants
 * even when globals JSON is loaded later or minified differently.
 */

function capture(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  const raw = m?.[1]?.trim();
  if (!raw || /[?#]/.test(raw)) {
    return null;
  }
  return raw;
}

export function parseEncodedStatusPageIdFromHtml(html: string): string | null {
  if (!html?.trim()) {
    return null;
  }

  const patterns: RegExp[] = [
    // Site24x7-style: statuspages.globals.encodedStatuspageId = `...`;
    /encodedStatuspageId\s*=\s*`([^`]+)`/i,
    /encodedStatusPageId\s*=\s*`([^`]+)`/,
    /encodedStatuspageId\s*[:=]\s*["']([^"']+)["']/i,
    /encodedStatusPageId\s*[:=]\s*["']([^"']+)["']/,
    // JSON / config blobs (Switch, embedded __NEXT_DATA__, etc.)
    /"enc_statuspage_id"\s*:\s*"([^"]+)"/,
    /'enc_statuspage_id'\s*:\s*'([^']+)'/,
    /"encodedStatuspageId"\s*:\s*"([^"]+)"/i,
    /"encodedStatusPageId"\s*:\s*"([^"]+)"/,
    // HTML-entity–encoded JSON (some proxies / templates)
    /&quot;enc_statuspage_id&quot;\s*:\s*&quot;([^&]+)&quot;/,
    // Public asset URLs — reliable fallback when id is not in inline script text
    /\/sp\/api\/public\/statuspages\/(?:favicon|logo)\/([^?\s"'<>]+)\?/,
    // Same path but closing quote instead of query (rare)
    /\/sp\/api\/public\/statuspages\/(?:favicon|logo)\/([^?\s"'<>]+)"/,
  ];

  for (const re of patterns) {
    const id = capture(html, re);
    // Real StatusIQ ids are long; keep a small floor to avoid junk matches and allow unit tests.
    if (id && id.length >= 6) {
      return id;
    }
  }

  return null;
}
