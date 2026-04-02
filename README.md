# StatusIQ Incident Annotations for Grafana

This repository contains a Grafana data source plugin that converts public StatusIQ outage windows into dashboard annotations (including start/end regions).

## What It Uses

The plugin reads the unauthenticated StatusIQ endpoint:

- `/sp/api/public/status_history/{encodedStatusPageId}?timezone=UTC&period=27&page=1`

and maps each `outage_list` entry (`start_time`, `end_time`, `ongoing`, `status`) into Grafana annotation events.

> [!WARNING]
> This plugin uses **web scraping** of StatusIQ's public status-history API and page HTML.
> If you have **API-based (authenticated) access** to your StatusIQ account, we aim to provide a more robust, API-integrated version on a parallel branch in the future.
> _For now, this plugin is meant only for public/unauthenticated StatusIQ pages and may break if StatusIQ changes public endpoints or HTML structure._

## Features

- No API token required (public status pages only)
- Auto-discovery of `encodedStatusPageId` from status page HTML
- Region annotations (`time` + `timeEnd`) for incident windows
- Tags for filtering: `statusiq`, status label, component name, and `ongoing`/`resolved`

## Local Development

**Node version:** Prefer **Node 22 LTS** (see `.nvmrc`). If you use **Node 25+**, `npm install` may print `EBADENGINE` warnings from older transitive packages (e.g. `eslint-plugin-jsdoc`) whose `engines` field was never updated for new Node releases. Those are usually **warnings only**—if `npm run build` and `npm run typecheck` succeed, you can ignore them or switch to Node 22 to silence them.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build plugin:

   ```bash
   npm run build
   ```

3. Run Grafana plugin dev mode:

   ```bash
   npm run dev
   ```

## Kind Test Environment (Grafana in Kubernetes)

This repo includes a local Kind-based test setup that:

- builds this plugin,
- bakes it into a local Grafana image,
- deploys Grafana to a Kind cluster,
- pre-provisions a datasource (`StatusIQ Local`) pointing to a local endpoint (`http://host.docker.internal:18080`).

### Prerequisites

- Docker
- kind
- kubectl
- Node 22+

### Start local datasource endpoint

In one terminal, run:

```bash
npm run mock:statusiq
```

This starts a local mock StatusIQ API on port `18080`.

### Deploy Grafana into Kind

In another terminal, run:

```bash
npm run kind:up
```

Then open:

- `http://localhost:3000`
- user: `admin`
- password: `admin`

### What gets provisioned

- Namespace: `observability`
- Deployment/Service: `grafana`
- Datasource: `StatusIQ Local`
  - type: `statusiq-incident-annotations-datasource`
  - URL: `http://host.docker.internal:18080`
  - encoded status page ID: `demo-status-page-id`

### Tear down

```bash
npm run kind:down
```

### Use your real StatusIQ status page (instead of the mock)

The mock exists only so Grafana in Kind can hit a local API. For production-style testing, point the datasource at your **public** status page URL; Grafana (server-side) will fetch HTML and `/sp/api/public/status_history/...` over HTTPS.

1. **Stop the mock** (optional): you no longer need `npm run mock:statusiq`.

2. **In Grafana** (simplest): **Connections → Data sources → StatusIQ Local** (or add a new datasource):
   - **URL**: your status page root, e.g. `https://status.yourcompany.com` (same host users open in a browser; no `/sp/api/...` path).
   - **Access**: **Server** (default for this setup).
   - **Encoded Status Page ID** (optional): leave empty to auto-discover from the page HTML, or paste the value from **View Page Source** → search for `encodedStatuspageId` (the string inside backticks).
   - **Save & test**.

3. **If you use Kind provisioning** (`deploy/kind/grafana/grafana.yaml`): edit the `datasources` entry and re-apply:
   - Set `url:` to your HTTPS status page (not `host.docker.internal`).
   - Remove `encodedStatusPageId` from `jsonData` to use auto-discovery, or set it to your real ID.
   - Then: `kubectl apply -f deploy/kind/grafana/grafana.yaml` and restart Grafana if needed:
     `kubectl -n observability rollout restart deployment/grafana`

**Requirements:** the Grafana pod must reach that URL on the network (outbound HTTPS). Corporate pages that block non-browser clients may need allow-listing Grafana’s egress IP or User-Agent.

### Troubleshooting “unknown error” / Save & test failures

- Rebuild/redeploy the plugin after updates, then **Save & test** again — errors should now show **HTTP status** and Grafana’s **FetchError** body when something fails.
- The plugin calls **absolute** URLs on your status host (e.g. `https://status.example.com/sp/api/...`). Path-only URLs must not be used from the browser: they resolve against Grafana and return **HTML** instead of StatusIQ JSON.
- If you still see failures, try adding **Custom HTTP headers** on the datasource (e.g. `User-Agent: Mozilla/5.0`) in case a WAF blocks the default Grafana client.
- Set **Timezone** to `Europe/Zurich` for [status.cloud.switch.ch](https://status.cloud.switch.ch/) (matches the page’s configured timezone).
- **Encoded status page IDs** often end with `=` (base64). The StatusIQ API expects that character **literally** in the URL path; encoding it as `%3D` produces **HTTP 400** (“Invalid resource Id”). The plugin keeps the raw ID in the path.

## Grafana Configuration

1. Add a new datasource: **StatusIQ Incident Annotations**.
2. In HTTP settings, set **URL** to your public StatusIQ page (for example `https://status.site24x7.com`).
3. Optional: set **Encoded Status Page ID** manually. If left empty, the plugin parses it from the status page HTML. Some pages (for example [Switch Cloud status](https://status.cloud.switch.ch/)) embed it as `enc_statuspage_id` inside a `statuspages` JSON blob in the page source — search **View Page Source** for `enc_statuspage_id` and paste the value (e.g. `-fIX8sNu-ilFX5UtJzmCzRoWA9Mb89Oct4U5DiVXdUw=`) if discovery still fails (corporate proxies, different HTML for server requests).
4. Optional: set **Timezone** in datasource settings to match the status page (Switch uses `Europe/Zurich`).
5. Save & Test.

## Dashboard Annotation Setup

1. Dashboard settings -> **Annotations** -> **Add annotation query**.
2. Select this datasource.
3. Use query text (optional) to filter incidents by title/component/status.

## Debug Panel Query Mode

If annotation UI is problematic in your Grafana build, you can still test data fetching via a normal panel query:

1. Add a **Table** panel.
2. Select datasource: **StatusIQ Incident Annotations**.
3. In query editor:
   - Set **Mode** = `Debug (panel/table)`
   - Optional filter text / include resolved / row limit
4. Run query and inspect returned rows (`time`, `timeEnd`, `component`, `title`, `status`, `ongoing`).

## Notes

- Use **Server** access mode in datasource HTTP settings so Grafana proxies requests.
- `maxPages` controls how much history is scanned per annotation refresh.
- If your StatusIQ page blocks proxy/user-agent requests, configure allow-listing on that side.
