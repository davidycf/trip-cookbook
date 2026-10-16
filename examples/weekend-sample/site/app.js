// Weekend sample. Bookings, facts and decisions come from ledger.json (copied here by the
// build step, never edited by hand); everything else comes from plan.json. Every view is a
// hash route on this one page, so relative URLs work at any deployment path.

const view = document.getElementById('view');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (date, opts) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...opts });
const longDate = d => fmt(d, { weekday: 'long', day: 'numeric', month: 'long' });
const shortDate = d => fmt(d, { day: 'numeric', month: 'short', year: 'numeric' });

let ledger, plan;
const commitment = id => ledger.commitments.find(c => c.id === id);
const fact = id => ledger.facts.find(f => f.id === id);

// ---- pieces derived from the ledger

const statusBadge = c => c.status === 'confirmed'
  ? '<span class="badge booked">Booked</span>'
  : '<span class="badge tentative">Tentative</span>';

function factLine(f) {
  const label = f.status === 'sourced'
    ? `<a class="src" href="${esc(f.source)}" rel="noopener">source, checked ${esc(shortDate(f.checked))}</a>`
    : f.status === 'estimate' ? '<span class="label estimate">Estimate</span>' : '<span class="label verify">To verify</span>';
  return `<p class="fact" data-ledger="${esc(f.id)}">${esc(f.claim)} ${label}</p>`;
}

function fixedList(items) {
  return `<ul class="fixed-list">${items.map(c => `
    <li data-ledger="${esc(c.id)}">
      <span class="when">${esc(fmt(c.date, { weekday: 'short' }))} ${esc(c.time ?? '')}</span>
      <span>${esc(c.what)}</span>
      ${statusBadge(c)}
    </li>`).join('')}</ul>`;
}

// ---- views

function overview() {
  const days = plan.days;
  const todayIso = (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })();
  const today = days.find(d => d.date === todayIso);
  const sorted = [...ledger.commitments].sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
  const decided = ledger.decisions.filter(d => d.status === 'approved');
  const proposed = ledger.decisions.filter(d => d.status === 'proposed');
  return `
    <p class="kicker">${esc(fmt(days[0].date, { day: 'numeric' }))}–${esc(fmt(days.at(-1).date, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    <h1>${esc(plan.title)}</h1>
    <p class="lede">${esc(plan.subtitle)}</p>
    ${today ? `<a class="card today daylink" href="#/day/${today.date}"><strong>Today: ${esc(today.title)}</strong><span>Open today's timeline →</span></a>` : ''}
    <h2>Fixed this weekend</h2>
    <div class="card">${fixedList(sorted)}</div>
    <h2>The two days</h2>
    <div class="daylinks">${days.map(d => `
      <a class="daylink" href="#/day/${d.date}"><strong>${esc(longDate(d.date))}</strong><span>${esc(d.title)}</span></a>`).join('')}
    </div>
    <h2>Good to know</h2>
    <div class="card">${ledger.facts.map(factLine).join('')}</div>
    <h2>Settled</h2>
    <div class="card">
      ${decided.map(d => `<p data-ledger="${esc(d.id)}">${esc(d.decision)}</p>`).join('')}
      ${proposed.map(d => `<p data-ledger="${esc(d.id)}"><span class="label estimate">Proposed</span> ${esc(d.decision)}</p>`).join('')}
    </div>`;
}

function day(date) {
  const i = plan.days.findIndex(d => d.date === date);
  if (i < 0) return overview();
  const d = plan.days[i];
  const prev = plan.days[i - 1], next = plan.days[i + 1];
  const rows = d.items.map(item => {
    const c = item.ledger ? commitment(item.ledger) : null;
    const facts = (item.facts ?? []).map(fact).filter(Boolean).map(factLine).join('');
    const place = item.place ? `<a class="meta" href="#/places">${esc(plan.places.find(p => p.id === item.place)?.name ?? '')}</a>` : '';
    if (c) {
      return `<li class="${c.status === 'confirmed' ? 'is-fixed' : 'is-tentative'}" data-ledger="${esc(c.id)}">
        <span class="time">${esc(c.time ?? '')}</span>
        <div class="body"><span class="title">${esc(c.what)}</span> ${statusBadge(c)}<br>${place}${facts}</div>
      </li>`;
    }
    return `<li>
      <span class="time">${esc(item.time ?? '')}</span>
      <div class="body"><span class="title">${esc(item.text)}</span>${item.flex ? ' <span class="label flex">Flexible</span>' : ''}<br>${place}${facts}</div>
    </li>`;
  }).join('');
  return `
    <p class="kicker">${esc(longDate(d.date))}</p>
    <h1>${esc(d.title)}</h1>
    <p class="lede">${esc(d.summary)}</p>
    <section data-day="${esc(d.date)}" aria-label="Timeline">
      <ol class="timeline">${rows}</ol>
    </section>
    ${backToStay()}
    <p>${prev ? `<a href="#/day/${prev.date}">← ${esc(fmt(prev.date, { weekday: 'long' }))}</a>` : ''}
       ${next ? `<a href="#/day/${next.date}">${esc(fmt(next.date, { weekday: 'long' }))} →</a>` : ''}</p>`;
}

function backToStay() {
  const h = plan.help;
  return `
    <h2>Back to the ${esc(h.stay_name.toLowerCase())}</h2>
    <div class="card">
      <p><strong>${esc(h.stay_name)}</strong><br>${esc(h.stay_address)}</p>
      <ol class="steps">${h.return.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${factLine(fact('station-walk'))}
      <p class="net"><a href="${esc(h.directions_url)}" rel="noopener">Live directions</a> (needs a connection)</p>
    </div>`;
}

function places() {
  const passes = id => plan.days.filter(d => d.items.some(it => it.place === id)).map(d => fmt(d.date, { weekday: 'short' }));
  const areas = [...new Set(plan.places.map(p => p.area))];
  return `
    <h1>Places</h1>
    <p class="lede">Each place once, grouped by area, with the days the plan passes it.</p>
    <div class="places">${areas.map(area => `
      <h3>${esc(area)}</h3>
      ${plan.places.filter(p => p.area === area).map(p => {
        const on = passes(p.id);
        return `<div class="place"><strong>${esc(p.name)}</strong> <span class="kind">· ${esc(p.kind)}</span><br>${esc(p.note)}${on.length ? `<br><span class="days">On the plan: ${esc(on.join(', '))}</span>` : ''}</div>`;
      }).join('')}`).join('')}
    </div>`;
}

function prepare() {
  const todos = [...plan.todos].sort((a, b) => a.due.localeCompare(b.due));
  return `
    <h1>Before you go</h1>
    <h2>Make it work offline</h2>
    <div class="card">
      <ol class="steps">
        <li>On Wi-Fi, open this site on each phone you'll take.</li>
        <li>Open each tab once: Weekend, both days, Places, Before you go and Help.</li>
        <li>Check it: switch on airplane mode, close the browser, reopen the site and tap through.</li>
        <li>After the last update before you leave, tap "Update" if the site offers it, then repeat steps 2 and 3.</li>
      </ol>
    </div>
    <h2>To do</h2>
    <div class="card">${todos.map(t => `
      <div class="todo"><span class="due">${esc(shortDate(t.due))}</span><span>${esc(t.text)}${t.ledger ? ` <span data-ledger="${esc(t.ledger)}">${statusBadge(commitment(t.ledger))}</span>` : ''}<br><span class="owner">${esc(t.owner)}</span></span></div>`).join('')}
    </div>`;
}

function help() {
  return `
    <h1>Help</h1>
    ${backToStay()}
    <h2>If something goes wrong</h2>
    <div class="card"><p>${esc(plan.help.emergency)}</p><p>Booking references are in your email and in the private notes, not on this site.</p></div>`;
}

// ---- routing

const TABS = () => [
  ['#/', 'Weekend'],
  ...plan.days.map(d => [`#/day/${d.date}`, d.short]),
  ['#/places', 'Places'],
  ['#/prepare', 'Before you go'],
  ['#/help', 'Help'],
];

function render(focus) {
  const h = location.hash || '#/';
  const m = h.match(/^#\/day\/(\d{4}-\d{2}-\d{2})$/);
  view.innerHTML = m ? day(m[1]) : h === '#/places' ? places() : h === '#/prepare' ? prepare() : h === '#/help' ? help() : overview();
  document.getElementById('tabs').innerHTML = TABS().map(([href, label]) =>
    `<a href="${href}"${(href === h || (href === '#/' && !TABS().some(t => t[0] === h))) ? ' aria-current="page"' : ''}>${esc(label)}</a>`).join('');
  if (focus) { window.scrollTo(0, 0); view.focus(); }
}

// ---- status line: offline notice and update button (both excluded from the offline comparison)

let updateAction = null;
function renderStatus() {
  const el = document.getElementById('status');
  const parts = [];
  if (!navigator.onLine) parts.push('<span>Offline: showing the copy saved on this phone.</span>');
  if (updateAction) parts.push('<span>A new version is ready.</span><button type="button" id="update">Update</button>');
  el.innerHTML = parts.join('');
  document.getElementById('update')?.addEventListener('click', () => updateAction());
}
addEventListener('online', renderStatus);
addEventListener('offline', renderStatus);

// ---- start

Promise.all([fetch('ledger.json'), fetch('plan.json')])
  .then(rs => Promise.all(rs.map(r => { if (!r.ok) throw new Error(r.url + ' ' + r.status); return r.json(); })))
  .then(([l, p]) => {
    ledger = l;
    plan = p;
    document.getElementById('foot').textContent = plan.sample_note;
    render(false);
    renderStatus();
    addEventListener('hashchange', () => render(true));
  })
  .catch(() => { view.innerHTML = '<p>The plan could not be loaded. If you are offline, open the site once on Wi-Fi first.</p>'; });

// Service worker, as in cookbook/build.md: first install takes control; updates wait for the traveller.
function showUpdateButton(go) { updateAction = go; renderStatus(); }
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = () => {
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateButton(() => reg.waiting.postMessage('activate-update'));
    };
    offer();
    reg.addEventListener('updatefound', () => reg.installing?.addEventListener('statechange', offer));
  });
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (controlled) location.reload();
    controlled = true;
  });
}
