import React, { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings, Field, InlineField, Input } from '@grafana/ui';
import { StatusIQDataSourceOptions } from '../types';

type Props = DataSourcePluginOptionsEditorProps<StatusIQDataSourceOptions>;

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData } = options;

  const updateJsonData = (patch: Partial<StatusIQDataSourceOptions>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        ...patch,
      },
    });
  };

  const onEncodedIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateJsonData({ encodedStatusPageId: event.target.value });
  };

  const onTimezoneChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateJsonData({ timezone: event.target.value });
  };

  const onMaxPagesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseInt(event.target.value, 10);
    updateJsonData({ maxPages: Number.isFinite(value) ? value : undefined });
  };

  return (
    <>
      <DataSourceHttpSettings
        defaultUrl="https://status.site24x7.com"
        dataSourceConfig={options}
        onChange={onOptionsChange}
        showAccessOptions={true}
      />

      <Field
        label="Encoded Status Page ID (optional)"
        description="If empty, the plugin auto-discovers it from the status page HTML."
      >
        <Input
          width={80}
          value={jsonData.encodedStatusPageId || ''}
          onChange={onEncodedIdChange}
          placeholder="7Ca9wFlVF-AlbjpE2tzER6FUegHamCQNyZF5CbAffCs="
        />
      </Field>

      <InlineField
        label="Timezone"
        labelWidth={24}
        tooltip="Timezone passed to StatusIQ status history API (defaults to UTC)."
      >
        <Input width={20} value={jsonData.timezone || 'UTC'} onChange={onTimezoneChange} />
      </InlineField>

      <InlineField
        label="Max pages"
        labelWidth={24}
        tooltip="How many history pages to query each annotation run (default 5)."
      >
        <Input type="number" width={20} value={jsonData.maxPages ?? 5} onChange={onMaxPagesChange} min={1} max={60} />
      </InlineField>
    </>
  );
}
