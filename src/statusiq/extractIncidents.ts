import { STATUS_LABELS } from './statusLabels';
import type { IncidentWindow, StatusHistoryComponent } from './types';
import { toUnixMillis } from './time';

export function flattenComponents(resources: StatusHistoryComponent[]): StatusHistoryComponent[] {
  const flattened: StatusHistoryComponent[] = [];
  for (const resource of resources) {
    flattened.push(resource);
    for (const child of resource.componentgroup_components || []) {
      flattened.push(child);
    }
  }
  return flattened;
}

export interface ExtractIncidentsOptions {
  fromMs: number;
  toMs: number;
  queryText?: string;
  includeResolved: boolean;
  /** For ongoing outages without end_time, use this as end (e.g. Date.now()). */
  nowMs: number;
}

/**
 * Turn StatusIQ `resource_list` JSON into deduplicated incident windows overlapping the range.
 */
export function extractIncidentWindows(
  resources: StatusHistoryComponent[],
  options: ExtractIncidentsOptions,
  seen: Set<string>
): IncidentWindow[] {
  const { fromMs, toMs, queryText, includeResolved, nowMs } = options;
  const q = queryText?.trim().toLowerCase();
  const components = flattenComponents(resources);
  const out: IncidentWindow[] = [];

  for (const component of components) {
    const componentName = component.display_name || component.componentgroup_display_name || 'unknown-component';
    const dayHistory = component.status_history?.day_wise_status_history || [];

    for (const day of dayHistory) {
      for (const outage of day.outage_list || []) {
        const startMs = toUnixMillis(outage.start_time);
        if (startMs === null) {
          continue;
        }

        const ongoing = Boolean(outage.ongoing);
        if (!includeResolved && !ongoing) {
          continue;
        }

        let endMs = toUnixMillis(outage.end_time);
        if (endMs === null) {
          endMs = ongoing ? nowMs : startMs;
        }

        if (endMs < fromMs || startMs > toMs) {
          continue;
        }

        const statusCode = outage.status ?? 0;
        const statusLabel = STATUS_LABELS[statusCode] || `status_${statusCode}`;
        const title = outage.associated_incident_info?.inc_title || 'StatusIQ incident';
        const incidentEncId = outage.associated_incident_info?.enc_inc_id || 'n/a';

        const searchable = `${componentName} ${title} ${statusLabel}`.toLowerCase();
        if (q && !searchable.includes(q)) {
          continue;
        }

        const dedupeKey = `${componentName}|${incidentEncId}|${startMs}|${endMs}|${statusCode}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);

        out.push({
          startMs,
          endMs,
          ongoing,
          component: componentName,
          title,
          statusCode,
          statusLabel,
          incidentEncId,
        });
      }
    }
  }

  return out;
}
