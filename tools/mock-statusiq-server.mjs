import http from 'node:http';
import { URL } from 'node:url';

const port = Number(process.env.PORT || 18080);

function nowIso() {
  return new Date().toISOString().replace('Z', '+0000');
}

function hoursAgo(hours) {
  const d = new Date(Date.now() - hours * 60 * 60 * 1000);
  return d.toISOString().replace('Z', '+0000');
}

function payload() {
  return {
    code: 0,
    message: 'success',
    data: {
      resource_list: [
        {
          enc_component_id: 'demo-component',
          display_name: 'Demo API',
          status_history: {
            day_wise_status_history: [
              {
                date: nowIso(),
                status: 5,
                daywise_outage_count: 2,
                daywise_total_incident_time: '01:30',
                daywise_uptime_perc: 99.2,
                outage_list: [
                  {
                    start_time: hoursAgo(3),
                    end_time: hoursAgo(2),
                    ongoing: false,
                    status: 5,
                    severity: 3,
                    associated_incident_info: {
                      enc_inc_id: 'inc-001',
                      inc_title: 'High error rate',
                    },
                  },
                  {
                    start_time: hoursAgo(1),
                    end_time: nowIso(),
                    ongoing: true,
                    status: 6,
                    severity: 4,
                    associated_incident_info: {
                      enc_inc_id: 'inc-002',
                      inc_title: 'Database latency spike',
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
    },
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/') {
    const html = `<!doctype html>
<html>
  <head><title>Local StatusIQ Mock</title></head>
  <body>
    <script>var statuspages = { globals: { encodedStatuspageId: 'demo-status-page-id' } };</script>
    <h1>Local StatusIQ Mock</h1>
  </body>
</html>`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (url.pathname.startsWith('/sp/api/public/status_history/')) {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload()));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Mock StatusIQ API listening on http://0.0.0.0:${port}`);
});
