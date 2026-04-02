import { extractIncidentWindows } from './extractIncidents';
import type { StatusHistoryComponent } from './types';

describe('extractIncidentWindows', () => {
  const resources: StatusHistoryComponent[] = [
    {
      display_name: 'API',
      status_history: {
        day_wise_status_history: [
          {
            date: '2026-01-01T00:00:00+0000',
            outage_list: [
              {
                start_time: '2026-01-01T10:00:00+0000',
                end_time: '2026-01-01T11:00:00+0000',
                ongoing: false,
                status: 5,
                associated_incident_info: { enc_inc_id: 'inc-1', inc_title: 'Partial outage' },
              },
            ],
          },
        ],
      },
    },
  ];

  it('extracts an incident overlapping the range', () => {
    const seen = new Set<string>();
    const fromMs = new Date('2026-01-01T09:00:00Z').getTime();
    const toMs = new Date('2026-01-01T12:00:00Z').getTime();
    const windows = extractIncidentWindows(
      resources,
      { fromMs, toMs, includeResolved: true, nowMs: toMs },
      seen
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].component).toBe('API');
    expect(windows[0].title).toBe('Partial outage');
    expect(windows[0].statusLabel).toBe('partial_outage');
    expect(windows[0].ongoing).toBe(false);
  });

  it('filters by queryText', () => {
    const seen = new Set<string>();
    const fromMs = new Date('2026-01-01T09:00:00Z').getTime();
    const toMs = new Date('2026-01-01T12:00:00Z').getTime();
    const none = extractIncidentWindows(
      resources,
      { fromMs, toMs, queryText: 'database', includeResolved: true, nowMs: toMs },
      seen
    );
    expect(none).toHaveLength(0);
  });

  it('dedupes repeated windows', () => {
    const seen = new Set<string>();
    const fromMs = new Date('2026-01-01T09:00:00Z').getTime();
    const toMs = new Date('2026-01-01T12:00:00Z').getTime();
    extractIncidentWindows(resources, { fromMs, toMs, includeResolved: true, nowMs: toMs }, seen);
    const again = extractIncidentWindows(resources, { fromMs, toMs, includeResolved: true, nowMs: toMs }, seen);
    expect(again).toHaveLength(0);
  });
});
