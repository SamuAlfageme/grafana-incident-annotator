import { parseEncodedStatusPageIdFromHtml } from './parseHtml';

describe('parseEncodedStatusPageIdFromHtml', () => {
  it('reads enc_statuspage_id from StatusIQ globals JSON (Switch-style)', () => {
    const html = `var statuspages = {"globals":{"enc_statuspage_id":"-fIX8sNu-ilFX5UtJzmCzRoWA9Mb89Oct4U5DiVXdUw="}};`;
    expect(parseEncodedStatusPageIdFromHtml(html)).toBe('-fIX8sNu-ilFX5UtJzmCzRoWA9Mb89Oct4U5DiVXdUw=');
  });

  it('reads encodedStatuspageId in backticks (Site24x7-style)', () => {
    const html = 'statuspages.globals.encodedStatuspageId =`7Ca9wFlVF-AlbjpE2tzER6FUegHamCQNyZF5CbAffCs=`;';
    expect(parseEncodedStatusPageIdFromHtml(html)).toBe('7Ca9wFlVF-AlbjpE2tzER6FUegHamCQNyZF5CbAffCs=');
  });

  it('extracts id from logo/favicon API path when globals JSON is absent', () => {
    const html = `<link rel="icon" href="/sp/api/public/statuspages/favicon/abc123XYZ=?default=1" />`;
    expect(parseEncodedStatusPageIdFromHtml(html)).toBe('abc123XYZ=');
  });

  it('reads encodedStatuspageId as JSON string', () => {
    const html = '{"encodedStatuspageId":"jsonStyleId="}';
    expect(parseEncodedStatusPageIdFromHtml(html)).toBe('jsonStyleId=');
  });

  it('reads entity-encoded enc_statuspage_id', () => {
    const html = '&quot;enc_statuspage_id&quot;:&quot;entityId=&quot;';
    expect(parseEncodedStatusPageIdFromHtml(html)).toBe('entityId=');
  });

  it('returns null when missing', () => {
    expect(parseEncodedStatusPageIdFromHtml('<html><body>no id</body></html>')).toBeNull();
  });
});
