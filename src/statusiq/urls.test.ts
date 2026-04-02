import {
  buildStatusHistoryPath,
  buildStatusHistoryUrl,
  normalizeStatusPageBaseUrl,
  statusHistoryApiBaseUrl,
  toAbsoluteUrl,
} from './urls';

describe('normalizeStatusPageBaseUrl', () => {
  it('trims trailing slashes', () => {
    expect(normalizeStatusPageBaseUrl('https://status.example.com/')).toBe('https://status.example.com');
  });

  it('throws on empty', () => {
    expect(() => normalizeStatusPageBaseUrl('  ')).toThrow(/required/);
  });
});

describe('buildStatusHistoryPath', () => {
  it('keeps trailing = unencoded in path (StatusIQ requires raw id)', () => {
    const path = buildStatusHistoryPath('abc=', 'Europe/Zurich', 1);
    expect(path).toContain('/sp/api/public/status_history/abc=');
    expect(path).not.toContain('%3D');
    expect(path).toContain('timezone=Europe%2FZurich');
    expect(path).toContain('page=1');
  });

  it('rejects id with query chars', () => {
    expect(() => buildStatusHistoryPath('bad?id', 'UTC', 1)).toThrow(/Invalid/);
  });
});

describe('buildStatusHistoryUrl', () => {
  it('joins base and API path', () => {
    const u = buildStatusHistoryUrl('https://status.example.com', 'id=', 'UTC', 2);
    expect(u).toBe('https://status.example.com/sp/api/public/status_history/id=?timezone=UTC&period=27&page=2');
  });
});

describe('toAbsoluteUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(toAbsoluteUrl('https://a.com', 'https://other.com/p')).toBe('https://other.com/p');
  });
});

describe('statusHistoryApiBaseUrl', () => {
  it('returns origin only (strips path)', () => {
    expect(statusHistoryApiBaseUrl('https://status.example.com/customer/page/')).toBe('https://status.example.com');
  });

  it('preserves non-default port', () => {
    expect(statusHistoryApiBaseUrl('http://localhost:18080/foo')).toBe('http://localhost:18080');
  });
});
