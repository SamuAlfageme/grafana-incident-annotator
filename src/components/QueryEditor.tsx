import React, { ChangeEvent } from 'react';
import { QueryEditorProps } from '@grafana/data';
import { Field, InlineField, Input, Switch } from '@grafana/ui';
import { DataSource } from '../datasource';
import { StatusIQDataSourceOptions, StatusIQQuery } from '../types';

type Props = QueryEditorProps<DataSource, StatusIQQuery, StatusIQDataSourceOptions>;

export function QueryEditor({ query, onChange, onRunQuery }: Props) {
  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, queryText: event.target.value });
    onRunQuery();
  };

  const onIncludeResolvedChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({ ...query, includeResolved: event.target.checked });
    onRunQuery();
  };

  const onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value.trim();
    if (raw === '') {
      onChange({ ...query, limit: undefined });
    } else {
      const parsed = Number.parseInt(raw, 10);
      onChange({ ...query, limit: Number.isFinite(parsed) ? parsed : undefined });
    }
    onRunQuery();
  };

  return (
    <div>
      <Field
        label="Filter text"
        description="Optional text filter for incident title/component/status (panel queries and annotations)."
      >
        <Input
          width={80}
          value={query.queryText ?? ''}
          placeholder="database"
          onChange={onQueryTextChange}
        />
      </Field>

      <InlineField label="Include resolved incidents" labelWidth={24}>
        <Switch value={query.includeResolved ?? true} onChange={onIncludeResolvedChange} />
      </InlineField>

      <InlineField
        label="Row limit"
        labelWidth={24}
        tooltip="Optional. Leave empty for no cap (bounded by Max pages in datasource settings)."
      >
        <Input
          type="number"
          width={20}
          min={1}
          max={5000}
          placeholder="—"
          value={query.limit !== undefined ? String(query.limit) : ''}
          onChange={onLimitChange}
        />
      </InlineField>
    </div>
  );
}
