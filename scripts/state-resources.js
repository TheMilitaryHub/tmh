(() => {
  const ENDPOINT = window.TMH_RESOURCES_API
    || 'https://tmh-resources-api.rennygadewarrior.workers.dev/api/state-resources';

  const panel = document.querySelector('[data-role="state-directory"]');
  if (!panel) return;

  const titleEl = panel.querySelector('[data-role="dir-title"]');
  const statusEl = panel.querySelector('[data-role="dir-status"]');
  const listEl = panel.querySelector('[data-role="dir-list"]');

  let data = null;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const telHref = (p) => 'tel:' + String(p).replace(/[^\d+]/g, '');

  function detail(label, value) {
    if (!value) return '';
    return `<div class="res__row"><span class="res__label">${esc(label)}</span><span>${esc(value)}</span></div>`;
  }

  function card(item) {
    const bits = [];
    if (item.website) {
      let host = item.website;
      try { host = new URL(item.website).hostname.replace(/^www\./, ''); } catch {}
      bits.push(`<div class="res__row"><span class="res__label">Website</span><span><a href="${esc(item.website)}" target="_blank" rel="noopener noreferrer">${esc(host)}</a></span></div>`);
    }
    if (item.phone) {
      bits.push(`<div class="res__row"><span class="res__label">Phone</span><span><a href="${esc(telHref(item.phone))}">${esc(item.phone)}</a></span></div>`);
    }
    if (item.email) {
      bits.push(`<div class="res__row"><span class="res__label">Email</span><span><a href="mailto:${esc(item.email)}">${esc(item.email)}</a></span></div>`);
    }
    bits.push(detail('Address', item.address));
    bits.push(detail('Services', item.services));
    bits.push(detail('Care', item.careTypes));
    bits.push(detail('Ages', item.ages));
    bits.push(detail('Hours', item.hours));
    bits.push(detail('Beds', item.beds));
    bits.push(detail('Insurance', item.insurance));
    bits.push(detail('Restrictions', item.restrictions));
    bits.push(detail('Faith based', item.faithBased));

    const note = item.description || item.notes;
    return `<li class="res">
      <div class="res__head">
        <span class="res__name">${esc(item.name)}</span>
        <span class="res__cat">${esc(item.category)}</span>
      </div>
      ${bits.filter(Boolean).join('')}
      ${note ? `<p class="res__note">${esc(note)}</p>` : ''}
    </li>`;
  }

  let shownItems = [];
  let activeCat = null;

  function paintList() {
    const items = activeCat ? shownItems.filter((i) => i.category === activeCat) : shownItems;
    const total = shownItems.length;
    const counts = new Map();
    for (const i of shownItems) counts.set(i.category, (counts.get(i.category) || 0) + 1);

    const chips = [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cat, n]) => {
        const on = cat === activeCat;
        return `<button type="button" class="cat-filter${on ? ' is-on' : ''}" data-cat="${esc(cat)}" aria-pressed="${on}">` +
          `${esc(cat)} <span class="cat-filter__n">${n}</span></button>`;
      }).join('');

    const allOn = !activeCat;
    statusEl.innerHTML =
      `<span class="dir-count">${activeCat ? items.length + ' of ' + total : total + ' listing' + (total === 1 ? '' : 's')}</span>` +
      `<span class="cat-filters">` +
        `<button type="button" class="cat-filter${allOn ? ' is-on' : ''}" data-cat="" aria-pressed="${allOn}">All</button>` +
        chips +
      `</span>`;

    listEl.innerHTML = items.map(card).join('');
  }

  statusEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.cat-filter');
    if (!btn) return;
    const cat = btn.dataset.cat || null;
    activeCat = (cat && cat !== activeCat) ? cat : null;
    paintList();
  });

  function render(stateName) {
    if (!data) return;
    const key = String(stateName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const bucket = data.states[key];
    const items = bucket ? bucket.items : [];

    titleEl.textContent = stateName || 'Select a state';
    activeCat = null;
    shownItems = items;

    if (!items.length) {
      statusEl.textContent = 'Nothing listed for this state yet.';
      listEl.innerHTML = '';
      return;
    }
    paintList();
  }

  function renderNational() {
    if (!data || !data.national.length) return;
    const host = document.querySelector('[data-role="national-list"]');
    const status = document.querySelector('[data-role="national-status"]');
    if (!host) return;
    if (status) status.textContent = `${data.national.length} nationwide listings`;
    host.innerHTML = data.national.map(card).join('');
  }

  statusEl.textContent = 'Loading resources…';

  fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((json) => {
      if (!json || !json.states) throw new Error('unexpected response');
      data = json;

      const flat = {};
      for (const [k, v] of Object.entries(json.states)) {
        flat[k] = v.items.map((i) => ({ name: i.name, path: i.website || '#' }));
      }
      window.STATE_RESOURCE_FILES = flat;
      document.dispatchEvent(new CustomEvent('tmh:state-resources'));

      statusEl.textContent = 'Select a state on the map.';
      renderNational();
    })
    .catch((err) => {
      statusEl.textContent = 'Could not load the resource list right now.';
      console.warn('[state-resources]', err.message);
    });

  document.addEventListener('tmh:state-selected', (e) => render(e.detail && e.detail.state));
})();
