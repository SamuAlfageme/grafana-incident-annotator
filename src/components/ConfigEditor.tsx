import React, { ChangeEvent } from 'react';
import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { DataSourceHttpSettings, Field, InlineField, Input, Switch, SecretInput, FieldSet } from '@grafana/ui';
import { StatusIQDataSourceOptions, StatusIQSecureOptions } from '../types';

type Props = DataSourcePluginOptionsEditorProps<StatusIQDataSourceOptions, StatusIQSecureOptions>;

export function ConfigEditor({ options, onOptionsChange }: Props) {
  const { jsonData, secureJsonData, secureJsonFields } = options;

  const updateJsonData = (patch: Partial<StatusIQDataSourceOptions>) => {
    onOptionsChange({
      ...options,
      jsonData: {
        ...jsonData,
        ...patch,
      },
    });
  };

  const updateSecureJsonData = (patch: Partial<StatusIQSecureOptions>) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...(secureJsonData || {}),
        ...patch,
      },
    });
  };

  const resetSecureField = (field: keyof StatusIQSecureOptions) => {
    onOptionsChange({
      ...options,
      secureJsonData: {
        ...(secureJsonData || {}),
        [field]: '',
      },
      secureJsonFields: {
        ...(secureJsonFields || {}),
        [field]: false,
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

  const onUseZohoApiChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateJsonData({ useZohoApi: event.currentTarget.checked });
  };

  const onZohoAccountsBaseUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateJsonData({ zohoAccountsBaseUrl: event.target.value });
  };

  const onZohoClientIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateJsonData({ zohoClientId: event.target.value });
  };

  const onZohoClientSecretChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSecureJsonData({ zohoClientSecret: event.target.value });
  };

  const onZohoRefreshTokenChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateSecureJsonData({ zohoRefreshToken: event.target.value });
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

      <FieldSet label="Zoho OAuth API (Optional Fallback)">
        <InlineField
          label="Use Zoho API"
          labelWidth={24}
          tooltip="Enable authenticated Zoho StatusIQ API access instead of public API. Useful for private status pages."
        >
          <Switch value={jsonData.useZohoApi || false} onChange={onUseZohoApiChange} />
        </InlineField>

        {jsonData.useZohoApi && (
          <>
            <Field
              label="Zoho Accounts Base URL"
              description="E.g., https://accounts.zoho.eu or https://accounts.zoho.com (depends on your data center)"
            >
              <Input
                width={80}
                value={jsonData.zohoAccountsBaseUrl || ''}
                onChange={onZohoAccountsBaseUrlChange}
                placeholder="https://accounts.zoho.eu"
              />
            </Field>

            <Field
              label="Zoho Client ID"
              description="OAuth client ID from Zoho API Console"
            >
              <Input
                width={80}
                value={jsonData.zohoClientId || ''}
                onChange={onZohoClientIdChange}
                placeholder="1000.XXXXXXXXXXXXXXXXXXXXX"
              />
            </Field>

            <Field
              label="Zoho Client Secret"
              description="OAuth client secret from Zoho API Console"
            >
              <SecretInput
                width={80}
                value={secureJsonData?.zohoClientSecret || ''}
                isConfigured={Boolean(secureJsonFields?.zohoClientSecret)}
                placeholder="Enter client secret"
                onReset={() => resetSecureField('zohoClientSecret')}
                onChange={onZohoClientSecretChange}
              />
            </Field>

            <Field
              label="Zoho Refresh Token"
              description="OAuth refresh token obtained from initial authorization flow"
            >
              <SecretInput
                width={80}
                value={secureJsonData?.zohoRefreshToken || ''}
                isConfigured={Boolean(secureJsonFields?.zohoRefreshToken)}
                placeholder="Enter refresh token"
                onReset={() => resetSecureField('zohoRefreshToken')}
                onChange={onZohoRefreshTokenChange}
              />
            </Field>
          </>
        )}
      </FieldSet>
    </>
  );
}
