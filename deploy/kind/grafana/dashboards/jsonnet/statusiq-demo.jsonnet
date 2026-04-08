local grafonnet = import 'github.com/grafana/grafonnet/gen/grafonnet-latest/main.libsonnet';
local dashboard = grafonnet.dashboard;
local ts = grafonnet.panel.timeSeries;
local ann = dashboard.annotation;
local q = grafonnet.query.testData;

local statusiqDsType = 'statusiq-incident-annotations-datasource';
local statusiqDsUid = 'statusiq-local';

dashboard.new('StatusIQ annotations (demo)')
+ dashboard.withUid('statusiq-annotations-demo')
+ dashboard.withDescription('TestData Random Walk with StatusIQ incident region annotations from the plugin datasource (uid: %s).' % statusiqDsUid)
+ dashboard.withTags(['statusiq', 'annotations', 'demo'])
+ dashboard.time.withFrom('now-30d')
+ dashboard.time.withTo('now')
+ dashboard.withRefresh('30s')
+ dashboard.withAnnotations([
    ann.withBuiltIn(1)
    + ann.withDatasource({ type: 'grafana', uid: '-- Grafana --' })
    + ann.withEnable(true)
    + ann.withHide(true)
    + ann.withIconColor('rgba(0, 211, 255, 1)')
    + ann.withName('Annotations & Alerts')
    + ann.withType('dashboard'),
    ann.withDatasource({ type: statusiqDsType, uid: statusiqDsUid })
    + ann.withEnable(true)
    + ann.withHide(false)
    + ann.withIconColor('rgba(255, 152, 48, 1)')
    + ann.withName('StatusIQ incidents')
    + ann.withTarget({
      refId: 'Anno',
      queryText: '',
      includeResolved: true,
    }),
  ])
+ dashboard.withPanels([
    ts.new('Random Walk')
    + ts.panelOptions.withGridPos(h=10, w=24, x=0, y=0)
    + ts.queryOptions.withTargets([
        q.withScenarioId('random_walk')
        + q.withRefId('A')
        + q.withDatasource(),
      ]),
  ])
