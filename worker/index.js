import { resolveStates, normaliseRecord, isUsable, key } from './normalize.js';

const BASE = 'appR5jvXshfmt42zA';

const TABLES = {
  'Affirming Homeless Shelters': 'Shelters',
  'Food Resources':              'Food',
  'Affirming Hospitals':         'Hospitals',
  'Healthcare Resources':        'Healthcare',
  'Mental Health Resources':     'Mental health',
  'LGBTQ+ Centers':              'LGBTQ+ centers',
  'Other Resources':             'Other',
  'National Help':               'National',
};

const CACHE_SECONDS = 300;

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Content-Type',
  'Vary': 'Origin',
});

function allowedOrigin(request, env) {
  const configured = (env.ALLOWED_ORIGINS || 'https://themilitaryhub.org,https://www.themilitaryhub.org')
    .split(',').map(s => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  if (configured.includes(origin)) return origin;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return configured[0];
}

async function fetchTable(env, table) {
  const out = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(table)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${env.AIRTABLE_TOKEN}` } });
    if (!res.ok) throw new Error(`${table}: airtable ${res.status}`);
    const page = await res.json();
    out.push(...page.records);
    offset = page.offset;
  } while (offset);
  return out;
}

async function build(env) {
  const states = {};
  const national = [];
  let read = 0, skipped = 0;

  const pages = await Promise.all(
    Object.keys(TABLES).map(t => fetchTable(env, t).then(r => [t, r]))
  );

  for (const [table, records] of pages) {
    const category = TABLES[table];
    for (const rec of records) {
      read++;
      const entry = normaliseRecord(rec, category, table);
      if (!isUsable(entry)) { skipped++; continue; }

      const loc = resolveStates((rec.fields || {}).Location);
      if (table === 'National Help' || loc.national || !loc.states.length) {
        national.push(entry);
        continue;
      }
      for (const st of loc.states) {
        (states[key(st)] ||= { state: st, items: [] }).items.push(entry);
      }
    }
  }

  for (const s of Object.values(states)) {
    s.items.sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name));
  }

  return {
    states,
    national,
    meta: { read, skipped, states: Object.keys(states).length, generated: new Date().toISOString() },
  };
}

async function handle(request, env, ctx) {
  const origin = allowedOrigin(request, env);
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + '/api/state-resources');
  const hit = await cache.match(cacheKey);
  if (hit) {
    const r = new Response(hit.body, hit);
    Object.entries(cors(origin)).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }

  let body, status = 200;
  try {
    body = JSON.stringify(await build(env));
  } catch (err) {
    body = JSON.stringify({ error: String(err.message || err) });
    status = 502;
  }

  const res = new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? `public, max-age=60, s-maxage=${CACHE_SECONDS}` : 'no-store',
      ...cors(origin),
    },
  });
  if (status === 200) ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allowedOrigin(request, env)) });
    }
    if (pathname === '/api/state-resources') return handle(request, env, ctx);
    return new Response('Not found', { status: 404 });
  },
};
