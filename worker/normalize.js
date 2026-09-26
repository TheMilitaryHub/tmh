const ABBR = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',DC:'District of Columbia',PR:'Puerto Rico'};
const STATES = new Set(Object.values(ABBR));
const key = (s) => String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const STATE_KEYS = new Map([...STATES].map(s => [key(s), s]));

const NULLISH = /^(n\/?a|none|null|-+|tbd|unknown)$/i;
function cleanText(v) {
  if (v == null) return '';
  const s = String(v).replace(/\r/g,'').replace(/\n{2,}/g,'\n').trim();
  return NULLISH.test(s) ? '' : s;
}

function cleanUrl(v) {
  let s = cleanText(v);
  if (!s) return '';
  const md = s.match(/\]\((https?:\/\/[^)]+)\)/);
  if (md) s = md[1];
  s = s.replace(/^<+/,'').replace(/>+$/,'').split(/\s+/)[0].replace(/[>,]+$/,'');
  return /^https?:\/\//i.test(s) ? s : '';
}

function cleanPhone(v) {
  let s = cleanText(v);
  if (!s) return '';
  s = s.replace(/\*\*|__|`/g, '');
  const md = s.match(/\[([^\]]+)\]\([^)]*\)/);
  if (md) s = md[1];
  return s.replace(/\s*\n.*$/s, '').trim();
}

function resolveStates(raw) {
  const s = cleanText(raw);
  if (!s) return { states: [], national: false, unresolved: '' };
  if (/^national$/i.test(s)) return { states: [], national: true, unresolved: '' };

  const parts = s.split(/[,;/]|\band\b/i).map(p => p.trim()).filter(Boolean);
  const out = new Set();
  for (const p of parts) {
    const k = key(p);
    if (STATE_KEYS.has(k)) { out.add(STATE_KEYS.get(k)); continue; }
    const up = p.toUpperCase();
    if (ABBR[up]) { out.add(ABBR[up]); continue; }
  }
  if (!out.size && STATE_KEYS.has(key(s))) out.add(STATE_KEYS.get(key(s)));
  return { states: [...out], national: false, unresolved: out.size ? '' : s };
}

const NAME_ORDER = {
  'Healthcare Resources': ["Doctor's Name", 'Clinic Name'],
  'default': ['Shelter Name','Organization Name','Hospital Name','Center Name','Clinic Name','Organization',"Doctor's Name"],
};
const MAX_NAME = 90;

const pick = (f, names) => { for (const n of names) if (f[n]) return f[n]; return ''; };

function chooseName(f, table) {
  const order = NAME_ORDER[table] || NAME_ORDER.default;
  const vals = order.map(n => cleanText(f[n])).filter(Boolean);
  const short = vals.find(v => v.length <= MAX_NAME);
  return { name: short || '', description: vals.find(v => v.length > MAX_NAME) || '' };
}

function normaliseRecord(rec, category, table) {
  const f = rec.fields || {};
  const { name, description } = chooseName(f, table);

  const rawAddr = cleanText(f['Address']);
  const addrIsUrl = /^<?https?:\/\//i.test(rawAddr);

  const entry = {
    id: rec.id,
    category,
    name: name || hostLabel(cleanUrl(f['Website']) || (addrIsUrl ? cleanUrl(rawAddr) : '')) || 'Unnamed',
    address: addrIsUrl ? '' : rawAddr,
    phone: cleanPhone(f['Phone Number']),
    website: cleanUrl(f['Website']) || (addrIsUrl ? cleanUrl(rawAddr) : ''),
    email: cleanText(f['Email']),
    services: cleanText(f['What They Give'] || f['How They Help'] || f['Some Services Provided'] || f['Type of Help'] || ''),
    description,
    hours: cleanText(f['When Available']),
    restrictions: cleanText(f['Restrictions']),
    beds: cleanText(f['Number of Beds']),
    ages: [].concat(f['Age of Patients'] || []).join(', '),
    careTypes: [].concat(f['Type of Care'] || []).join(', '),
    insurance: cleanText(f['Insurance Notes']),
    faithBased: [].concat(f['Faith Based'] || []).join(', '),
    notes: [cleanText(f['Notes']), cleanText(f['Notes 2'])].filter(Boolean).join('\n'),
  };
  for (const k of Object.keys(entry)) if (entry[k] === '') delete entry[k];
  return entry;
}

function hostLabel(url) {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./,''); } catch { return ''; }
}

const isUsable = (e) => (e.name && e.name !== 'Unnamed') || !!e.website || !!e.phone;

export { cleanText, cleanUrl, cleanPhone, resolveStates, normaliseRecord, isUsable, key };
