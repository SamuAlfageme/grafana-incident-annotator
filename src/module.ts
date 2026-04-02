import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { StatusIQDataSourceOptions, StatusIQQuery } from './types';

export const plugin = new DataSourcePlugin<DataSource, StatusIQQuery, StatusIQDataSourceOptions>(DataSource).setConfigEditor(
  ConfigEditor
).setQueryEditor(QueryEditor);
