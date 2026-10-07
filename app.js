'use strict';

/* ---------- storage ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};

const state = {
  data: null,
  route: store.get('route', 'alt'),
  tab: 'route',
  date: null,
  personal: store.get('personal', {}),
  editing: false,
  hintClosed: store.get('hintClosed', false),
  theme: store.get('theme', 'light'),
};

/* ---------- dom helpers ---------- */
const IS_IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Тактильная кнопка: на iPhone палец попадает в невидимый системный переключатель iOS,
// и iOS даёт короткий отклик Taptic Engine (Web API для вибрации в Safari нет).
function hapticSwitch() {
  const i = document.createElement('input');
  i.type = 'checkbox';
  i.setAttribute('switch', '');
  i.className = 'haptic';
  i.tabIndex = -1;
  i.setAttribute('aria-hidden', 'true');
  return i;
}

function h(tag, attrs, ...kids) {
  const haptic = attrs && attrs.haptic;
  if (haptic && tag === 'button') tag = 'div';
  const el = document.createElement(tag);
  if (haptic) {
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.classList.add('tap');
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === 'haptic') continue;
    if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false || kid === '') continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  if (haptic && IS_IOS) el.append(hapticSwitch());
  return el;
}

const ICONS = {
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"/>',
  doc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><circle cx="12" cy="10" r="3"/><path d="M9 16h6"/>',
  walk: '<circle cx="13" cy="4.5" r="1.6"/><path d="M10 21l2-6 3 3v3M8.5 12.5l2.5-4 3 .8 2 2.7h2.5M12 15l-1-6.5"/>',
  transit: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M8.5 21l1.5-4M15.5 21l-1.5-4"/><circle cx="9" cy="13.5" r=".6"/><circle cx="15" cy="13.5" r=".6"/>',
  car: '<path d="M4 16l1.8-5.5A2 2 0 0 1 7.7 9h8.6a2 2 0 0 1 1.9 1.5L20 16v3H4z"/><circle cx="8" cy="16" r=".8"/><circle cx="16" cy="16" r=".8"/>',
  train: '<rect x="6" y="3" width="12" height="14" rx="4"/><path d="M6 11h12M9 21l1.5-4M15 21l-1.5-4"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  food: '<path d="M7 3v7a2 2 0 0 0 4 0V3M9 12v9M16 21V3c-2 1.5-3 4-3 7h3"/>',
  sunset: '<path d="M7.5 17a4.5 4.5 0 0 1 9 0"/><path d="M3 17h18M5.5 21h13M12 3v6M9 6.5l3 2.5 3-2.5M4.8 11.5l1.4 1.4M19.2 11.5l-1.4 1.4"/>',
  sunrise: '<path d="M7.5 17a4.5 4.5 0 0 1 9 0"/><path d="M3 17h18M5.5 21h13M12 9V3M9 5.5L12 3l3 2.5M4.8 11.5l1.4 1.4M19.2 11.5l-1.4 1.4"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  taxi: '<path d="M3.5 16.5v-3l1.9-4.6A2 2 0 0 1 7.2 7.7h9.6a2 2 0 0 1 1.8 1.2l1.9 4.6v3z"/><path d="M3.5 13.5h17M10 7.7l.6-2.2h2.8l.6 2.2"/><path d="M6 16.5V19M18 16.5V19"/>',
  share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 12v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7"/>',
  phone: '<path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 6 6L15 14l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0z"/><path d="M12 12v6.5a2 2 0 0 1-4 0M12 3v0"/>',
};
function icon(name) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', 'i');
  s.innerHTML = ICONS[name] || '';
  return s;
}

/* ---------- time ---------- */
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WEEKDAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const FAKE_NOW = new URLSearchParams(location.search).get('now'); // проверка: ?now=2026-10-16T13:10 (время Кореи)
function kstNow() {
  if (FAKE_NOW) {
    const [date, time = '09:00'] = FAKE_NOW.split('T');
    return { date, min: toMin(time) };
  }
  const d = new Date(Date.now() + 9 * 3600e3);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function toMin(t) { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; }
function span(it) {
  const s = toMin(it.t);
  let e = it.e ? toMin(it.e) : s;
  if (e < s) e += 1440;
  return [s, e];
}
function longDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
function daysBetween(a, b) { return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5); }
function inMinutes(n) {
  if (n < 60) return `через ${n} мин`;
  const hh = Math.floor(n / 60), mm = n % 60;
  return `через ${hh} ч${mm ? ' ' + mm + ' мин' : ''}`;
}

/* ---------- data ---------- */
function days() { return state.data.routes[state.route] || state.data.routes.alt; }
function currentDay() { return days().find(d => d.date === state.date) || days()[0]; }
function doneKey(date, idx) { return `done:${state.route}:${date}:${idx}`; }
function isDone(date, idx) { return store.get(doneKey(date, idx), false); }
function homeOf(key) { return (state.personal.homes || {})[key] || {}; }

function stopTitle(it) {
  if (it.home) return it.home === 'seoul' ? 'Дом · Сеул' : 'Дом · Пусан';
  return it.title;
}
function legIcon(kind) { return { walk: 'walk', transit: 'transit', taxi: 'car', car: 'car', train: 'train', cable: 'train' }[kind] || 'transit'; }
function routineIcon(it) {
  if (it.home) return 'home';
  if (/Завтрак|Обед|Ужин/.test(it.routine || '')) return 'food';
  if (/Дорога/.test(it.routine || '') || it.type === 'Транспорт') return 'transit';
  return null;
}
function nextUp(day) {
  const now = kstNow();
  if (now.date !== day.date) return null;
  const items = day.items;
  for (let i = 0; i < items.length; i++) {
    const [s, e] = span(items[i]);
    if (now.min >= s && now.min < e) return { idx: i, it: items[i], now: true };
    if (now.min < s) return { idx: i, it: items[i], now: false, wait: s - now.min };
  }
  return null;
}

/* ---------- render: route ---------- */
function goDay(date) {
  const list = days();
  const from = list.findIndex(x => x.date === state.date), to = list.findIndex(x => x.date === date);
  if (to < 0 || from === to) return;
  state.anim = to > from ? 'next' : 'prev';
  state.date = date;
  render();
  window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' });
}
function stepDay(delta) {
  const list = days(), i = list.findIndex(x => x.date === state.date) + delta;
  if (i >= 0 && i < list.length) goDay(list[i].date);
}

function renderRoute(root) {
  const list = days();
  const day = currentDay();
  const today = kstNow().date;

  const header = h('header', { class: 'top' },
    h('div', { class: 'top-row' },
      h('div', {},
        h('h1', { class: 'day-title' }, longDate(day.date)),
        h('div', { class: 'day-sub' }, [day.city, day.title].filter(Boolean).join(' · '), rainPill(day))),
      sunToggle(day)),
    h('div', { class: 'days', id: 'days' },
      list.map(d => {
        const dd = new Date(d.date + 'T00:00:00Z');
        return h('button', {
          class: 'day-chip' + (d.date === day.date ? ' sel' : '') + (d.date === today ? ' today' : ''),
          haptic: true,
          onClick: () => goDay(d.date),
        }, h('b', {}, dd.getUTCDate()), h('span', {}, d.dow));
      })));

  const wrap = h('div', { class: 'wrap' });
  const trip = state.data.trip;
  if (today < trip.from) {
    const n = daysBetween(today, trip.from);
    add(wrap, h('div', { class: 'hint' }, `До поездки ${n} ${plural(n, 'день', 'дня', 'дней')}. Всё сохранено в телефоне и откроется без интернета.`));
  }
  if (!isStandalone() && /iPhone|iPad/.test(navigator.userAgent) && !state.hintClosed) {
    add(wrap, h('div', { class: 'hint' },
      h('div', {}, 'Чтобы приложение работало без интернета, добавьте его на экран «Домой»: «Поделиться» → «На экран Домой».'),
      h('button', { onClick: () => { state.hintClosed = true; store.set('hintClosed', true); render(); }, 'aria-label': 'Скрыть' }, icon('close'))));
  }

  const nu = nextUp(day);
  if (nu) add(wrap, nextCard(day, nu));

  const ol = h('ol', { class: 'tl' });
  day.items.forEach((it, idx) => {
    if (it.leg && idx > 0) {
      add(ol, h('li', { class: 'leg' }, icon(legIcon(it.leg.kind)), it.leg.text));
    }
    add(ol, h('li', {}, stopRow(day, it, idx, nu && nu.now && nu.idx === idx)));
  });
  add(wrap, ol);
  add(root, header, wrap);
  requestAnimationFrame(() => {
    const sel = document.querySelector('.day-chip.sel');
    if (sel) sel.scrollIntoView({ inline: 'center', block: 'nearest' });
  });
}

function rainPill(day) {
  const p = dayRain(day);
  if (p == null || p < RAIN_P) return null;
  return h('span', { class: 'rain-note', title: 'Вероятность дождя' }, icon('umbrella'), `дождь ${p}%`);
}

function sunToggle(day) {
  const dark = state.theme === 'dark';
  const time = dark ? day.sunrise : day.sunset;
  if (!time) return null;
  return h('button', {
    class: 'pill sun-toggle',
    'aria-label': dark ? `Восход ${time}. Включить светлую тему` : `Закат ${time}. Включить тёмную тему`,
    title: dark ? 'Восход' : 'Закат',
    haptic: true,
    onClick: () => { state.spinSun = true; setTheme(dark ? 'light' : 'dark', true); },
  }, h('span', { class: 'sun-ico' + (state.spinSun ? ' spin' : '') }, icon(dark ? 'sunrise' : 'sunset')), h('span', { class: state.spinSun ? 'fade-in' : '' }, time));
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', state.theme === 'dark' ? '#171614' : '#f6f3ee');
}
function setTheme(theme, animate) {
  state.theme = theme;
  store.set('theme', theme);
  const root = document.documentElement;
  if (animate) {
    root.classList.add('theme-anim');
    setTimeout(() => root.classList.remove('theme-anim'), 400);
  }
  applyTheme();
  render();
  state.spinSun = false;
}

function nextCard(day, nu) {
  const it = nu.it;
  const label = nu.now ? 'Сейчас' : `Далее · ${inMinutes(nu.wait)}`;
  return h('div', { class: 'card next' },
    h('button', { class: 'next-main', onClick: () => openSheet(day, nu.idx) },
      h('div', { class: 'label' }, label),
      h('div', { class: 't' }, stopTitle(it)),
      it.ko ? h('div', { class: 'k ko' }, it.ko) : null,
      h('div', { class: 'meta' }, `${it.t}${it.e ? '–' + it.e : ''}`, !nu.now && it.leg ? ' · ' + it.leg.text : '')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary', haptic: true, onClick: () => openTaxi(it) }, icon('taxi'), 'Таксисту'),
      it.naver ? h('button', { class: 'btn', onClick: () => openNaver(it) }, 'Naver') : null));
}

/* ---------- forecast ---------- */
const RAIN_P = 30; // показываем план на дождь, если вероятность дождя ≥1 мм не ниже 30%
const FC_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble?latitude=37.5665,35.1796&longitude=126.978,129.0756'
  + '&daily=precipitation_sum&models=ecmwf_ifs025&timezone=Asia%2FSeoul&forecast_days=15';
function rainProb(city, date) {
  const live = store.get('forecast', null);
  if (live && live.p && live.p[city] && live.p[city][date] != null) return live.p[city][date];
  const base = (state.data.forecast || {}).p || {};
  return base[city] && base[city][date] != null ? base[city][date] : null;
}
function isRainy(it, day) { const p = rainProb(it.city, day.date); return p != null && p >= RAIN_P; }
function dayRain(day) {
  const ps = [...new Set(day.items.map(it => it.city).filter(Boolean))].map(c => rainProb(c, day.date)).filter(p => p != null);
  return ps.length ? Math.max(...ps) : null;
}
async function refreshForecast() {
  const cached = store.get('forecast', null);
  if (cached && Date.now() - cached.at < 6 * 3600e3) return;
  if (!navigator.onLine) return;
  try {
    const res = await fetch(FC_URL);
    if (!res.ok) return;
    const arr = await res.json();
    const p = {};
    ['Сеул', 'Пусан'].forEach((city, ci) => {
      const d = arr[ci].daily, members = Object.keys(d).filter(k => k.startsWith('precipitation_sum_member'));
      p[city] = {};
      d.time.forEach((t, k) => {
        const vals = members.map(m => d[m][k]).filter(v => v != null);
        if (vals.length) p[city][t] = Math.round(100 * vals.filter(v => v >= 1).length / vals.length);
      });
    });
    store.set('forecast', { at: Date.now(), p });
    render();
  } catch (e) { /* offline or blocked: keep last forecast */ }
}

function planList(it, day) {
  const alts = it.alts || [];
  const out = alts.map((a, k) => ({ kind: 'alt', a, label: alts.length > 1 ? `План Б · ${k + 1}/${alts.length}` : 'План Б' }));
  if (it.planB && isRainy(it, day)) out.push({ kind: 'rain', label: 'План Б · дождь' });
  return out;
}

function stopRow(day, it, idx, now) {
  const done = isDone(day.date, idx);
  const clock = kstNow();
  const past = !done && !now && (day.date < clock.date || (day.date === clock.date && span(it)[1] <= clock.min));
  const ri = routineIcon(it);
  const plans = planList(it, day);
  const chips = [];
  (it.warn || []).forEach(w => chips.push(h('span', { class: 'chip warn' }, w)));
  if (it.hours === 'выходной' && !(it.warn || []).some(w => w.includes('выходной'))) chips.push(h('span', { class: 'chip warn' }, 'выходной'));
  const sub = [it.ko, it.home ? null : it.district].filter(Boolean).join(' · ');
  const main = h('button', { class: 'body main' + (plans.length ? ' tagged' : ''), onClick: () => openSheet(day, idx) },
    plans.length ? h('span', { class: 'plan-tag' }, 'План А') : null,
    h('div', { class: 'title' }, ri ? icon(ri) : null, stopTitle(it)),
    sub ? h('div', { class: 'sub ko' }, sub) : null,
    it.what ? h('div', { class: 'what' }, it.what) : null,
    it.tnote ? h('div', { class: 'tnote' }, it.tnote) : null,
    chips.length ? h('div', { class: 'chips' }, chips) : null);
  return h('div', { class: 'stop' + (done ? ' done' : '') + (past ? ' past' : '') + (now ? ' now' : '') },
    h('div', { class: 'time' }, it.t, it.e ? h('small', {}, it.e) : null),
    h('div', { class: 'rail' }, h('span', { class: 'dot' })),
    plans.length
      ? h('div', { class: 'plans', 'data-key': `${day.date}:${idx}` }, main, plans.map(p => planPane(day, idx, it, p)))
      : h('div', { class: 'single' }, main));
}

function planPane(day, idx, it, p) {
  if (p.kind === 'rain') {
    return h('button', { class: 'body plan-b tagged', onClick: () => openSheet(day, idx) },
      h('span', { class: 'plan-tag' }, p.label),
      h('div', { class: 'title' }, 'Если дождь'),
      h('div', { class: 'what' }, cap(it.planB)));
  }
  const a = p.a;
  const meta = [a.why, a.dist].filter(Boolean).join(' · ');
  return h('button', { class: 'body plan-b tagged', onClick: () => openAltSheet(a, it, p.label) },
    h('span', { class: 'plan-tag' }, p.label),
    h('div', { class: 'title' }, a.title),
    a.ko ? h('div', { class: 'sub ko' }, a.ko) : null,
    a.what ? h('div', { class: 'what' }, a.what) : null,
    meta ? h('div', { class: 'tnote' }, meta) : null);
}

/* ---------- sheet ---------- */
function openSheet(day, idx) {
  const it = day.items[idx];
  const done = isDone(day.date, idx);
  const extra = [];
  if (it.planB && isRainy(it, day)) extra.push(sec(`Если дождь · ${rainProb(it.city, day.date)}%`, h('p', {}, cap(it.planB))));
  planList(it, day).filter(p => p.kind === 'alt').forEach(p => extra.push(sec(p.label, altCard(p.a, it, p.label))));
  if (it.diff && state.route === 'alt') extra.push(sec('Отличие от основного', h('p', { class: 'soft' }, it.diff)));
  showSheet(it, {
    head: `${it.t}${it.e ? '–' + it.e : ''}${it.routine ? ' · ' + it.routine : ''}`,
    extra,
    footer: close => h('div', { class: 'toggle-done' },
      h('button', {
        class: 'btn block',
        haptic: true,
        onClick: () => { store.set(doneKey(day.date, idx), !done); close(); setTimeout(render, 240); },
      }, icon('check'), done ? 'Вернуть в план' : 'Отметить: были здесь')),
  });
}

function openAltSheet(a, parent, label) {
  const where = [a.why, a.dist ? `${a.dist} от «${stopTitle(parent)}»` : null].filter(Boolean).join(' · ');
  showSheet(a, {
    head: `${label}${a.t ? ' · ' + a.t + (a.e ? '–' + a.e : '') : ''}`,
    extra: [sec(a.gap ? 'Перед' : 'Вместо', h('p', {}, stopTitle(parent)), where ? h('p', { class: 'soft' }, where) : null)],
  });
}

function showSheet(it, opts) {
  const box = document.getElementById('sheet');
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    const sh = box.querySelector('.sheet');
    if (sh && !sh.classList.contains('fling')) sh.style.animation = '';
    box.classList.add('closing');
    setTimeout(() => { box.classList.remove('open', 'closing'); box.replaceChildren(); }, REDUCED ? 0 : 260);
  };
  const home = it.home ? homeOf(it.home) : null;
  const road = it.home ? (home.ko || '') : (it.road || '');

  const sections = [];
  if (it.what) sections.push(sec('Что делаем', h('p', {}, it.what)));
  const keep = [];
  (it.warn || []).forEach(w => keep.push(h('div', { class: 'chips', style: 'margin-top:0' }, h('span', { class: 'chip warn' }, w))));
  if (it.hours) keep.push(h('p', {}, `Часы на этот день: ${it.hours}`));
  if (it.note) keep.push(h('p', {}, it.note));
  if (it.rating) keep.push(h('p', { class: 'soft' }, `Naver ★ ${it.rating}`));
  if (it.tnote) keep.push(h('p', { class: 'soft' }, it.tnote));
  if (keep.length) sections.push(sec('Иметь в виду', ...keep));

  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'grab' }),
    h('div', { class: 'sheet-head' },
      h('span', {}, opts.head),
      h('button', { class: 'icon-btn', onClick: close, 'aria-label': 'Закрыть' }, icon('close'))),
    h('h2', {}, stopTitle(it)),
    it.ko ? h('div', { class: 'ko-big ko' }, it.ko) : null,
    road ? h('div', { class: 'addr ko' }, road) : null,
    it.home && !home.ko ? h('div', { class: 'addr' }, 'Адрес жилья добавьте во вкладке «Документы».') : null,
    h('div', { class: 'actions' },
      h('button', { class: 'btn primary block', haptic: true, onClick: () => openTaxi(it) }, icon('taxi'), 'Показать таксисту')),
    h('div', { class: 'row3' },
      it.naver ? h('button', { class: 'btn', onClick: () => openNaver(it) }, 'Naver') : null,
      it.google ? h('a', { class: 'btn', href: it.google, target: '_blank', rel: 'noopener' }, 'Google') : null,
      (it.ko || road) ? h('button', { class: 'btn', onClick: () => copy([it.ko, road].filter(Boolean).join('\n')) }, icon('copy'), 'Адрес') : null),
    sections,
    opts.extra || [],
    opts.footer ? opts.footer(close) : null);

  fill(box, h('div', { class: 'backdrop', onClick: close }), sheet);
  box.classList.remove('closing');
  box.classList.add('open');
  // после въезда снимаем анимацию, иначе она перекрывает перетаскивание пальцем
  sheet.addEventListener('animationend', e => { if (e.target === sheet && !box.classList.contains('closing')) sheet.style.animation = 'none'; });
  dragToDismiss(sheet, box.querySelector('.backdrop'), close);
}
// Свайп вниз закрывает карточку: лист идёт за пальцем, после отпускания либо уезжает, либо пружинит обратно.
function dragToDismiss(sheet, backdrop, close) {
  let y0 = null, t0 = 0, dy = 0;
  sheet.addEventListener('touchstart', e => {
    if (sheet.scrollTop > 0) { y0 = null; return; }
    y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0;
    sheet.style.transition = 'none';
  }, { passive: true });
  sheet.addEventListener('touchmove', e => {
    if (y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0) { dy = 0; sheet.style.transform = ''; return; }
    e.preventDefault();
    sheet.style.transform = `translateY(${dy}px)`;
    backdrop.style.opacity = String(Math.max(0, 1 - dy / 400));
  }, { passive: false });
  sheet.addEventListener('touchend', () => {
    if (y0 == null) return;
    const v = dy / Math.max(1, Date.now() - t0);
    y0 = null;
    sheet.style.transition = '';
    if (dy > 110 || v > 0.6) {
      sheet.style.transform = `translateY(${dy}px)`;
      requestAnimationFrame(() => { sheet.classList.add('fling'); sheet.style.transform = 'translateY(100%)'; backdrop.style.opacity = '0'; });
      close();
    } else {
      sheet.style.transform = '';
      backdrop.style.opacity = '';
    }
  });
}

function add(el, ...kids) { el.append(...kids.flat().filter(k => k != null && k !== false && k !== '')); }
function fill(el, ...kids) { el.replaceChildren(...kids.flat().filter(k => k != null && k !== false && k !== '')); }
function sec(title, ...kids) { return h('div', { class: 'sec' }, h('h3', {}, title), h('div', { class: 'card' }, kids)); }
function altCard(a, parent, label) {
  return h('div', {},
    h('p', {}, h('b', {}, a.title), a.t ? ` · ${a.t}${a.e ? '–' + a.e : ''}` : ''),
    a.ko ? h('p', { class: 'soft ko' }, a.ko) : null,
    a.why || a.dist ? h('p', { class: 'soft' }, [a.why, a.dist].filter(Boolean).join(' · ')) : null,
    a.what ? h('p', {}, a.what) : null,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onClick: () => openAltSheet(a, parent, label) }, 'Подробнее'),
      h('button', { class: 'btn', onClick: () => openTaxi(a) }, icon('taxi'), 'Таксисту')));
}

/* ---------- Naver Map app ---------- */
// Карточка места открывается сразу в приложении Naver Map (nmap://); если приложение не ответило — сайт.
const NMAP_APPNAME = encodeURIComponent(location.origin + location.pathname);
function naverAppUrl(it) {
  const id = /place\/(\d+)/.exec(it.naver || '');
  if (id) return `nmap://place?id=${id[1]}&appname=${NMAP_APPNAME}`;
  const q = /\/search\/([^/?#]+)/.exec(it.naver || '');
  const query = q ? decodeURIComponent(q[1]) : (it.ko || '');
  return query ? `nmap://search?query=${encodeURIComponent(query)}&appname=${NMAP_APPNAME}` : null;
}
function openNaver(it) {
  const app = naverAppUrl(it);
  if (!app) { window.open(it.naver, '_blank', 'noopener'); return; }
  let left = false;
  const mark = () => { left = true; };
  document.addEventListener('visibilitychange', mark, { once: true });
  window.addEventListener('pagehide', mark, { once: true });
  window.addEventListener('blur', mark, { once: true });
  window.location.href = app;
  setTimeout(() => {
    document.removeEventListener('visibilitychange', mark);
    window.removeEventListener('pagehide', mark);
    window.removeEventListener('blur', mark);
    if (!left && !document.hidden) window.open(it.naver, '_blank', 'noopener');
  }, 1800);
}

/* ---------- taxi / officer ---------- */
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    else if (wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
function openTaxi(it) {
  const box = document.getElementById('taxi');
  let name = it.ko || it.title, road = it.road || '', en = it.title;
  if (it.home) {
    const hm = homeOf(it.home);
    name = hm.ko || 'Адрес не заполнен';
    road = hm.phone ? `☎ ${hm.phone}` : '';
    en = hm.en || (it.home === 'seoul' ? 'Home · Seoul' : 'Home · Busan');
  }
  box.className = 'taxi open';
  fill(box,
    h('div', { class: 'phrase ko' }, '이 주소로 가 주세요'),
    h('div', { class: 'name ko' }, name),
    road ? h('div', { class: 'road ko' }, road) : null,
    h('div', { class: 'en' }, en, ' · Please take me to this address'),
    h('div', { class: 'close' }, 'Нажмите, чтобы закрыть'));
  box.onclick = () => closeTaxi(box);
  keepAwake(true);
}
function closeTaxi(box) {
  box.classList.add('closing');
  keepAwake(false);
  setTimeout(() => { box.className = 'taxi'; box.replaceChildren(); }, REDUCED ? 0 : 220);
}
function openOfficer() {
  const p = state.personal, box = document.getElementById('taxi');
  const homes = p.homes || {};
  const fmt = iso => { const d = new Date(iso + 'T00:00:00Z'); return `${d.getUTCDate()} Oct`; };
  const lines = [
    ['Purpose', 'Tourism (honeymoon)'],
    ['Dates', '15 – 27 October 2026'],
    p.travelers ? ['Travelers', p.travelers] : null,
    p.keta && p.keta.number ? ['K-ETA', `approved · ${p.keta.number}`] : null,
    ...state.data.stays.map(s => [`${s.en}, ${fmt(s.from)} – ${fmt(s.to)}`, [homes[s.key] && homes[s.key].en, homes[s.key] && homes[s.key].ko].filter(Boolean).join(' / ') || '—']),
    p.flights && p.flights.back ? ['Return flight', p.flights.back] : null,
    p.flights && p.flights.out ? ['Arrival flight', p.flights.out] : null,
  ].filter(Boolean);
  box.className = 'taxi officer open';
  fill(box, 
    h('div', { class: 'phrase' }, 'Travel information'),
    ...lines.map(([k, v]) => h('div', {}, h('div', { class: 'en', style: 'margin-top:16px' }, k), h('div', { class: 'road', style: 'margin-top:2px' }, v))),
    h('div', { class: 'close' }, 'Нажмите, чтобы закрыть'));
  box.onclick = () => closeTaxi(box);
  keepAwake(true);
}

/* ---------- documents ---------- */
const FIELDS = [
  ['travelers', 'Путешественники (латиницей, как в паспорте)', 'IVAN IVANOV, ANNA IVANOVA'],
  ['keta.number', 'K-ETA: номер одобрения', ''],
  ['keta.valid', 'K-ETA: действует до', ''],
  ['flights.out', 'Рейс туда', 'номер, дата, время'],
  ['flights.back', 'Рейс обратно', '27.10 01:15, Инчхон'],
  ['homes.seoul.ko', 'Жильё в Сеуле: адрес по-корейски', '서울 …'],
  ['homes.seoul.en', 'Жильё в Сеуле: адрес латиницей', ''],
  ['homes.seoul.phone', 'Жильё в Сеуле: телефон хозяина', ''],
  ['homes.busan.ko', 'Жильё в Пусане: адрес по-корейски', '부산 …'],
  ['homes.busan.en', 'Жильё в Пусане: адрес латиницей', ''],
  ['homes.busan.phone', 'Жильё в Пусане: телефон хозяина', ''],
  ['embassy', 'Посольство: телефон', ''],
  ['notes', 'Заметки', ''],
];
function getPath(o, path) { return path.split('.').reduce((a, k) => (a && a[k] != null ? a[k] : ''), o); }
function setPath(o, path, v) {
  const ks = path.split('.'); let cur = o;
  ks.slice(0, -1).forEach(k => { cur[k] = cur[k] && typeof cur[k] === 'object' ? cur[k] : {}; cur = cur[k]; });
  cur[ks[ks.length - 1]] = v;
}
function kv(k, v) { return h('div', { class: 'kv' }, h('span', { class: 'k' }, k), h('span', { class: 'v' + (v ? '' : ' empty') }, v || 'не заполнено')); }

function renderDocs(root) {
  const p = state.personal;
  const header = h('header', { class: 'top' },
    h('div', { class: 'top-row' },
      h('div', {}, h('h1', { class: 'day-title' }, 'Документы'), h('div', { class: 'day-sub' }, 'Хранятся только в этом телефоне')),
      h('button', { class: 'pill', onClick: () => { state.editing = !state.editing; render(); } }, icon('edit'), state.editing ? 'Готово' : 'Изменить')));
  const wrap = h('div', { class: 'wrap' });

  if (state.editing) {
    const form = h('div', { class: 'card' }, FIELDS.map(([path, label, ph]) =>
      h('label', { class: 'field' }, h('span', {}, label),
        h('input', { value: getPath(p, path), placeholder: ph, autocomplete: 'off', onInput: e => { setPath(p, path, e.target.value.trim()); store.set('personal', p); } }))));
    add(wrap, h('div', { class: 'doc' }, form));
  } else {
    add(wrap, 
      h('div', { class: 'doc' }, h('h3', {}, 'Граница'),
        h('div', { class: 'card' },
          kv('K-ETA', p.keta && p.keta.number ? `одобрена · ${p.keta.number}` : ''),
          kv('Действует до', p.keta && p.keta.valid),
          kv('Путешественники', p.travelers),
          h('p', { class: 'soft', style: 'margin:12px 0 0' }, 'С действующей K-ETA e-Arrival Card не нужна. Паспорт тот же, что в заявке K-ETA.'),
          h('div', { class: 'actions' }, h('button', { class: 'btn primary block', onClick: openOfficer }, 'Показать пограничнику')))),
      h('div', { class: 'doc' }, h('h3', {}, 'Рейсы'),
        h('div', { class: 'card' }, kv('Туда', p.flights && p.flights.out), kv('Обратно', p.flights && p.flights.back))),
      h('div', { class: 'doc' }, h('h3', {}, 'Жильё'),
        h('div', { class: 'card' }, state.data.stays.map(s => {
          const hm = homeOf(s.key);
          return h('div', { class: 'call' },
            h('div', {}, h('b', {}, s.city), h('div', { class: 'soft ko' }, hm.ko || 'адрес не заполнен'), hm.phone ? h('div', { class: 'soft' }, hm.phone) : null),
            h('button', { class: 'btn', onClick: () => openTaxi({ home: s.key, title: s.city }) }, icon('taxi')));
        }))),
      h('div', { class: 'doc' }, h('h3', {}, 'Экстренные номера'),
        h('div', { class: 'card' },
          callRow('Полиция', '112'), callRow('Скорая и пожарные', '119'),
          callRow('Туристическая линия (англ., рус.)', '1330'), callRow('Иммиграционная служба', '1345'),
          p.embassy ? callRow('Посольство', p.embassy) : null)),
      p.notes ? h('div', { class: 'doc' }, h('h3', {}, 'Заметки'), h('div', { class: 'card' }, h('p', { style: 'margin:0;white-space:pre-wrap' }, p.notes))) : null);
  }

  add(wrap, h('div', { class: 'doc' }, h('h3', {}, 'Настройки'),
    h('div', { class: 'card' },
      h('div', { class: 'soft', style: 'margin-bottom:8px' }, 'Маршрут'),
      h('div', { class: 'seg' },
        ['alt', 'main'].map(k => h('button', {
          class: state.route === k ? 'sel' : '',
          haptic: true,
          onClick: () => { state.route = k; store.set('route', k); render(); },
        }, k === 'alt' ? '10 из 10' : 'Основной'))),
      h('div', { class: 'kv', style: 'margin-top:12px' }, h('span', { class: 'k' }, 'Без интернета'), h('span', { class: 'v', id: 'offline-status' }, '…')),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Данные от'), h('span', { class: 'v' }, state.data.version)),
      h('div', { class: 'kv' }, h('span', { class: 'k' }, 'Прогноз дождя'), h('span', { class: 'v' }, forecastLabel())),
      h('div', { class: 'row2' },
        h('button', { class: 'btn', onClick: exportPersonal }, icon('share'), 'Сохранить'),
        h('label', { class: 'btn' }, 'Загрузить',
          h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onChange: importPersonal }))))));

  add(root, header, wrap);
  offlineStatus();
}
function forecastLabel() {
  const live = store.get('forecast', null);
  if (live && live.at) {
    const d = new Date(live.at);
    return `обновлён ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const f = state.data.forecast;
  return f ? `от ${f.issued.slice(8, 10)}.${f.issued.slice(5, 7)}` : 'нет';
}

function callRow(label, num) {
  return h('div', { class: 'call' }, h('div', {}, h('b', {}, num), h('div', { class: 'soft' }, label)),
    h('a', { class: 'btn', href: 'tel:' + num.replace(/[^\d+]/g, '') }, icon('phone')));
}
async function offlineStatus() {
  const el = document.getElementById('offline-status');
  if (!el) return;
  let ok = false;
  try { ok = !!(navigator.serviceWorker && navigator.serviceWorker.controller) && (await caches.keys()).some(k => k.startsWith('trip-')); } catch (e) { ok = false; }
  el.textContent = ok ? 'готово' : 'откройте один раз с интернетом';
}
async function exportPersonal() {
  const blob = new Blob([JSON.stringify(state.personal, null, 2)], { type: 'application/json' });
  const file = new File([blob], 'korea-personal.json', { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { /* share cancelled */ }
  const a = h('a', { href: URL.createObjectURL(blob), download: 'korea-personal.json' });
  document.body.append(a); a.click(); a.remove();
}
function importPersonal(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  f.text().then(t => {
    const obj = JSON.parse(t);
    state.personal = deepMerge(state.personal, obj);
    store.set('personal', state.personal);
    toast('Данные загружены');
    render();
  }).catch(() => toast('Не удалось прочитать файл'));
}
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a[k] || {}, v) : v;
  }
  return out;
}

/* ---------- misc ---------- */
function cap(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function isStandalone() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }
function copy(text) {
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Скопировано'), () => toast('Не получилось скопировать'));
}
let toastTimer;
function toast(msg) {
  let el = document.querySelector('.toast');
  if (!el) { el = h('div', { class: 'toast' }); document.body.append(el); }
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

/* ---------- shell ---------- */
function render() {
  const root = document.getElementById('view');
  const swiped = {};
  root.querySelectorAll('.plans').forEach(p => { if (p.scrollLeft > 0) swiped[p.dataset.key] = p.scrollLeft; });
  root.replaceChildren();
  if (state.tab === 'route') renderRoute(root); else renderDocs(root);
  if (state.anim && !REDUCED) {
    const wrap = root.querySelector('.wrap');
    if (wrap) {
      wrap.classList.add('enter-' + state.anim);
      wrap.querySelectorAll('.tl > li').forEach((li, k) => li.style.setProperty('--i', Math.min(k, 10)));
    }
    const chip = root.querySelector('.day-chip.sel');
    if (chip && state.anim !== 'fade') chip.classList.add('pop');
  }
  state.anim = null;
  root.querySelectorAll('.plans').forEach(p => { if (swiped[p.dataset.key]) p.scrollLeft = swiped[p.dataset.key]; });
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('sel', t.dataset.tab === state.tab));
}
function shell() {
  const app = document.getElementById('app');
  app.replaceChildren(
    h('main', { id: 'view' }),
    h('nav', { class: 'tabs' },
      h('button', { class: 'tab', 'data-tab': 'route', haptic: true, onClick: () => { if (state.tab !== 'route') { state.anim = 'fade'; state.tab = 'route'; render(); window.scrollTo(0, 0); } } }, icon('route'), 'Маршрут'),
      h('button', { class: 'tab', 'data-tab': 'docs', haptic: true, onClick: () => { if (state.tab !== 'docs') { state.anim = 'fade'; state.tab = 'docs'; state.editing = false; render(); window.scrollTo(0, 0); } } }, icon('doc'), 'Документы')));
}
function pickDate() {
  const today = kstNow().date, list = days();
  if (list.some(d => d.date === today)) return today;
  return today < list[0].date ? list[0].date : list[list.length - 1].date;
}
/* ---------- encrypted data ---------- */
const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const toB64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
async function loadEnc() {
  try {
    const res = await fetch('data/trip.enc.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const enc = await res.json();
    store.set('tripEnc', enc);
    return enc;
  } catch (e) {
    return store.get('tripEnc', null);
  }
}
async function deriveKey(pass, enc) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromB64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
}
async function decrypt(enc, key) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, key, fromB64(enc.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function unlockWithStoredKey(enc) {
  const saved = store.get('tripKey', null);
  if (!saved || saved.salt !== enc.salt) return null;
  try {
    const key = await crypto.subtle.importKey('raw', fromB64(saved.key), 'AES-GCM', false, ['decrypt']);
    return await decrypt(enc, key);
  } catch (e) {
    return null;
  }
}
function lockScreen(enc) {
  return new Promise(resolve => {
    const err = h('div', { class: 'lock-err' });
    const input = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Пароль', 'aria-label': 'Пароль' });
    const btn = h('button', { class: 'btn primary block', type: 'submit' }, 'Открыть');
    const form = h('form', {
      class: 'lock card',
      onSubmit: async e => {
        e.preventDefault();
        btn.disabled = true; err.textContent = '';
        try {
          const key = await deriveKey(input.value.trim(), enc);
          const data = await decrypt(enc, key);
          store.set('tripKey', { salt: enc.salt, key: toB64(await crypto.subtle.exportKey('raw', key)) });
          resolve(data);
        } catch (x) {
          err.textContent = 'Пароль не подошёл';
          btn.disabled = false;
          input.select();
        }
      },
    },
      h('div', { class: 'lock-title' }, 'Корея · маршрут'),
      h('p', { class: 'soft' }, 'Маршрут зашифрован. Пароль нужен один раз на этом телефоне, дальше всё работает без интернета.'),
      h('label', { class: 'field' }, input),
      err, btn);
    fill(document.getElementById('app'), h('div', { class: 'lock-wrap' }, form));
    setTimeout(() => input.focus(), 50);
  });
}

async function main() {
  applyTheme();
  try { localStorage.removeItem('tripCache'); } catch (e) { /* old plaintext cache */ }
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js').then(() => offlineStatus()).catch(() => {});
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const enc = await loadEnc();
  if (!enc) {
    fill(document.getElementById('app'), h('div', { class: 'wrap' }, h('div', { class: 'hint' }, 'Нет данных. Откройте приложение один раз с интернетом.')));
    return;
  }
  state.data = (await unlockWithStoredKey(enc)) || (await lockScreen(enc));
  shell();
  state.date = pickDate();
  render();
  document.addEventListener('touchstart', () => {}, { passive: true }); // включает :active на iOS
  let sx = null, sy = 0, sTarget = null;
  document.getElementById('view').addEventListener('touchstart', e => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; sTarget = e.target;
  }, { passive: true });
  document.getElementById('view').addEventListener('touchend', e => {
    if (sx == null || state.tab !== 'route') return;
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    const blocked = sTarget && sTarget.closest && sTarget.closest('.plans, .days, input, textarea');
    sx = null;
    if (!blocked && Math.abs(dx) > 70 && Math.abs(dy) < 45) stepDay(dx < 0 ? 1 : -1);
  }, { passive: true });
  refreshForecast();
  window.addEventListener('online', refreshForecast);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshForecast(); if (state.tab === 'route') render(); } });
  setInterval(() => { if (!document.hidden && state.tab === 'route' && !document.querySelector('.overlay.open, .taxi.open')) render(); }, 60e3);
}
main();
