/* ===== KONTRAKT Z NODE-RED =====
 WS  /ws  (serwer→front):
   {topic:'zigbee2mqtt/<friendly_name>', payload:{...}}   surowe wiadomości Z2M (payload jako obiekt)
   {topic:'zigbee2mqtt/<friendly_name>/availability', payload:{state:'online'|'offline'}}
   {type:'auth', username, level}      czytnik przyznał dostęp -> logowanie (level 1-3)
   {type:'event'}                      dowolne nowe zdarzenie (front odświeży listę)
 WS  (front→serwer): {type:'cmd', device:'listwa', payload:{state_l1:'TOGGLE'}}  => zigbee2mqtt/<device>/set
 REST /api (GET, JSON):
   /latest | /devices | /events?limit=100 | /heat?from=ISO | /users
   /history?device=&key=&from=ISO&to=ISO&agg=raw|hour  -> [{time,value}]
   /access?user=&from=&to=                             -> [{time,username,granted,reason,reader}]
 REST /api (POST): /users {username,access_level,uid,valid_from,valid_to}  /users/<id>/deactivate  /users/<id>/level {access_level}
   /users/<id>/cards {uid,label,valid_from,valid_to}  /cards/<id>/deactivate  /cards/<id>/validity {valid_from,valid_to}
   GET /users zwraca też karty: [{id,username,access_level,is_active,cards:[{id,label,is_active,valid_from,valid_to}]}]
================================= */
const MOCK = /[?&]mock/.test(location.search) || location.protocol == 'file:';
const WSU = (location.protocol == 'https:' ? 'wss' : 'ws') + '://' + location.host + '/ws';
/* Nazwy urządzeń = friendly_name w Zigbee2MQTT (i w tabeli devices). Zmień tu, jeśli się różnią. */
const DEV = {
  temp: 'termometr_higrometr',
  occ: 'czujnik_obecnosci',
  strip: 'listwa',
  btn: 'przycisk',
  remote: 'pilot',
  alarm: 'alarm',
  aq: 'jakosc_powietrza',
  rfid: 'czytnik_rfid',
  heat: 'cieplomierz',
  bulb: 'zarowka'
};
/* Klucze w payloadzie, których nazw nie znamy na pewno (dopasowanie po wyrażeniu). Sprawdź na stronie Urządzenia -> klik w nazwę = surowy payload. */
const K = {
  uid: /uid|analog_input.*10$/i,
  eDay: /energia_dzienna|analog_input.*11$/i,
  alarm: /alarm|vibration/i
};
const val = (n, re) => {
  const d = S.dev[n] || {},
    k = Object.keys(d).find(q => q[0] != '_' && re.test(q));
  return k == null ? undefined : d[k];
};
const S = {
  dev: {},
  uid: null,
  user: '',
  lvl: 0,
  on: false,
  col: (() => {
    try {
      return JSON.parse(localStorage.col);
    } catch {
      return null;
    }
  })() || { ok: '#5aa86b', no: '#d4573f', exp: '#e0a526', wait: '#4f8fd1' }
};
let ws;

async function api(p, o) {
  if (MOCK) return mock(p, o);
  const r = await fetch(
    '/api' + p,
    o && { method: o.method, headers: { 'Content-Type': 'application/json' }, body: o.body }
  );
  if (!r.ok) throw Error(r.status);
  return r.json();
}
const post = (p, b) => api(p, { method: 'POST', body: JSON.stringify(b || {}) });

function send(o) {
  if (MOCK) return mockCmd(o);
  if (ws && ws.readyState == 1) ws.send(JSON.stringify(o));
  else toast('Brak połączenia z serwerem');
}
const cmd = (device, payload) => send({ type: 'cmd', device, payload });

function connect() {
  if (MOCK) {
    S.on = true;
    stat();
    mockStart();
    return;
  }
  ws = new WebSocket(WSU);
  ws.onopen = () => {
    S.on = true;
    stat();
  };
  ws.onclose = () => {
    S.on = false;
    stat();
    setTimeout(connect, 2000);
  };
  ws.onmessage = e => {
    try {
      onMsg(JSON.parse(e.data));
    } catch {}
  };
}

function onMsg(m) {
  if (m.type == 'auth') {
    S.user = m.username;
    S.lvl = Math.min(3, Math.max(1, +m.level || 1));
    pg = 'ov';
    show();
    return;
  }
  if (m.type == 'event') {
    setTimeout(() => {
      if (pg == 'ac' || pg == 'ov') show();
    }, 600);
    return;
  }
  if (m.topic) {
    const n = m.topic.replace(/^zigbee2mqtt\//, ''),
      p = m.payload;
    if (n.endsWith('/availability')) {
      const k = n.split('/')[0];
      (S.dev[k] = S.dev[k] || {})._on = ((p && p.state) || p) == 'online';
    } else if (p && typeof p == 'object') {
      Object.assign((S.dev[n] = S.dev[n] || {}), p, { _t: Date.now(), _on: true });
      if (n == DEV.rfid) {
        const k = Object.keys(p).find(q => K.uid.test(q));
        if (k && p[k]) {
          S.uid = String(p[k]);
          const u = $('#uid');
          if (u) u.textContent = S.uid;
        }
      }
    }
  }
  live();
}

/* ---------- MOCK (?mock lub otwarcie z pliku) ---------- */
const MD = [
  [DEV.remote, 'binary_input', '4 button portable remote control'],
  [DEV.btn, 'binary_input', 'Sonoff SNZB-01P'],
  [DEV.temp, 'env_sensor', 'NOUS E5'],
  [DEV.alarm, 'env_sensor', 'Vibration alarm sensor'],
  [DEV.strip, 'binary_output', 'NOUS A11Z'],
  [DEV.heat, 'heat_meter', 'własny moduł'],
  [DEV.rfid, 'rfid_keypad', 'własny moduł'],
  [DEV.occ, 'env_sensor', 'Sonoff SNZB-06P'],
  [DEV.aq, 'other', 'własny moduł'],
  [DEV.bulb, 'light', 'E27 RGB light bulb']
];
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
let cid = 10;
const mc = b => ({
  id: ++cid,
  label: 'karta',
  is_active: true,
  valid_from: b.valid_from,
  valid_to: b.valid_to
});
const MU = [
  {
    id: 1,
    username: 'admin',
    access_level: 3,
    is_active: true,
    cards: [{ id: 1, label: 'karta', is_active: true }]
  },
  {
    id: 2,
    username: 'j.kowalski',
    access_level: 2,
    is_active: true,
    cards: [{ id: 2, label: 'karta', is_active: true, valid_to: new Date(Date.now() + 30 * 864e5) }]
  },
  { id: 3, username: 'a.nowak', access_level: 1, is_active: true, cards: [] }
];
const ME = [
  ['j.kowalski', 'granted', ''],
  ['a.nowak', 'granted', ''],
  ['nieznana karta', 'denied', 'unknown_card'],
  ['admin', 'granted', ''],
  ['a.nowak', 'denied', 'expired']
].map((e, i) => ({
  time: new Date(Date.now() - i * 36e5),
  source: 'dostęp',
  type: e[1],
  subject: e[0],
  details: e[2]
}));

function mock(p, o) {
  const [path, q] = p.split('?'),
    Q = new URLSearchParams(q || ''),
    m = path.match(/^\/users\/(\d+)\/(\w+)/);
  if (o && o.method == 'POST') {
    const b = JSON.parse(o.body || '{}');
    if (path == '/users')
      MU.push({
        id: MU.length + 1,
        username: b.username,
        access_level: b.access_level,
        is_active: true,
        cards: b.uid ? [mc(b)] : []
      });
    else if (m) {
      const u = MU.find(x => x.id == m[1]);
      if (m[2] == 'deactivate') u.is_active = false;
      else if (m[2] == 'cards') u.cards.push(mc(b));
      else u.access_level = b.access_level;
    } else {
      const c = path.match(/^\/cards\/(\d+)\/(\w+)/);
      if (c)
        MU.forEach(u =>
          u.cards.forEach(k => {
            if (k.id == c[1]) {
              if (c[2] == 'deactivate') k.is_active = false;
              else {
                k.valid_from = b.valid_from;
                k.valid_to = b.valid_to;
              }
            }
          })
        );
    }
    return Promise.resolve({ ok: 1 });
  }
  let r = [];
  if (path == '/history') {
    const n = 60,
      a = Q.get('key') == 'humidity' ? 5 : 1.3,
      b = Q.get('key') == 'humidity' ? 46 : 22.4,
      s = (new Date(Q.get('to')) - new Date(Q.get('from'))) / n;
    r = Array.from({ length: n }, (_, i) => ({
      time: new Date(Date.now() - (n - i) * s),
      value: b + a * Math.sin((i / n) * 12) + (rnd() - 0.5) * a * 0.4
    }));
  } else if (path == '/heat')
    r = Array.from({ length: 30 }, (_, i) => ({
      day: new Date(Date.now() - (29 - i) * 864e5),
      energy_used_kwh: 55 + 15 * Math.sin(i / 4) + rnd() * 6
    }));
  else if (path == '/events') r = ME.slice(0, +Q.get('limit') || 100);
  else if (path == '/access')
    r = ME.filter(e => e.source == 'dostęp').map(e => ({
      time: e.time,
      username: e.subject,
      granted: e.type == 'granted',
      reason: e.details,
      reader: 'czytnik_rfid'
    }));
  else if (path == '/users') r = MU;
  else if (path == '/devices')
    r = MD.map(d => ({
      friendly_name: d[0],
      type: d[1],
      model: d[2],
      is_online: true,
      battery_pct: 90,
      link_quality: 200,
      last_seen: new Date()
    }));
  return new Promise(ok => setTimeout(() => ok(r), 120));
}
const zm = (n, p) => onMsg({ topic: 'zigbee2mqtt/' + n, payload: p });

function mockCard() {
  zm(DEV.rfid, { analog_input_10: Math.floor(1e7 + rnd() * 9e7) });
}

function mockStart() {
  const tick = () => {
    const t = Date.now() / 6e4;
    zm(DEV.temp, {
      temperature: +(22.4 + Math.sin(t) * 1.2 + rnd() * 0.3).toFixed(1),
      humidity: Math.round(46 + Math.sin(t / 2) * 4),
      battery: 100,
      linkquality: 127
    });
    zm(DEV.strip, {
      power: +(120 + rnd() * 15).toFixed(1),
      voltage: 236,
      current: 0.01,
      energy: 0,
      linkquality: 127
    });
    zm(DEV.occ, { occupancy: rnd() > 0.6, illumination: 'bright', linkquality: 189 });
    zm(DEV.heat, {
      energia_suma: +(22 + (t % 10)).toFixed(1),
      energia_dzienna: 21.5,
      linkquality: 222
    });
    zm(DEV.aq, { analog_input_1: 70, binary_input_2: 'ON', linkquality: 131 });
  };
  tick();
  setInterval(tick, 3000);
  zm(DEV.bulb, { state: 'ON', brightness: 150, color_temp: 300, linkquality: 105 });
  zm(DEV.alarm, { alarm: 'normal', battery_state: 'high', linkquality: 167 });
  zm(DEV.btn, { battery: 100, voltage: 3000, action: '', linkquality: 105 });
  zm(DEV.remote, { battery: 90, voltage: 2900, linkquality: 174 });
  zm(DEV.rfid, { analog_input_10: 0, linkquality: 218 });
  $('#devbar').hidden = false;
  $('#devb').innerHTML =
    [1, 2, 3]
      .map(
        l =>
          `<button onclick="onMsg({type:'auth',username:'${['', 'a.nowak', 'j.kowalski', 'admin'][l]}',level:${l}})">${LV[l]}</button>`
      )
      .join('') + '<button onclick="mockCard()">skanuj nową kartę</button>';
}

function mockCmd(o) {
  const p = o.payload || {};
  if (o.device == DEV.strip) {
    const k = Object.keys(p)[0];
    setTimeout(() => zm(DEV.strip, { [k]: D(DEV.strip, k) == 'ON' ? 'OFF' : 'ON' }), 300);
  } else if (o.device == DEV.bulb) {
    const q = { ...p };
    if (q.state == 'TOGGLE') q.state = D(DEV.bulb, 'state') == 'ON' ? 'OFF' : 'ON';
    setTimeout(() => zm(DEV.bulb, q), 300);
  }
}