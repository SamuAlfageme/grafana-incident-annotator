import React, { ChangeEvent } from 'react';
import { AnnotationQuery, QueryEditorProps } from '@grafana/data';
import { Field, InlineField, Input, Switch } from '@grafana/ui';
import { StatusIQQuery } from '../types';

type Props = QueryEditorProps<any, StatusIQQuery> & {
  annotation?: AnnotationQuery<StatusIQQuery>;
  onAnnotationChange?: (annotation: AnnotationQuery<StatusIQQuery>) => void;
};

export function AnnotationQueryEditor({ annotation, onAnnotationChange }: Props) {
  const target = (annotation?.target ?? {}) as StatusIQQuery;

  const updateTarget = (patch: Partial<StatusIQQuery>) => {
    if (!annotation || !onAnnotationChange) {
      return;
    }

    onAnnotationChange({
      ...annotation,
      target: {
        ...target,
        ...patch,
      },
    });
  };

  const onQueryTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateTarget({ queryText: event.target.value });
  };

  const onIncludeResolvedChange = (event: ChangeEvent<HTMLInputElement>) => {
    updateTarget({ includeResolved: event.target.checked });
  };

  return (
    <div>
      <Field
        label="Filter text"
        description="Optional text filter for incident title/component/status."
      >
        <Input
          width={70}
          value={target.queryText ?? ''}
          placeholder="database"
          onChange={onQueryTextChange}
        />
      </Field>

      <InlineField label="Include resolved incidents" labelWidth={24}>
        <Switch value={target.includeResolved ?? true} onChange={onIncludeResolvedChange} />
      </InlineField>
    </div>
  );
}
