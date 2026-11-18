// 船舶情報（ホーム画面アプリ版）：画面のファイルを iPhone に残して、電波がなくてもすぐ開く
//   ・画面のファイル（同じ場所のもの）は、残してある分をすぐ返し、裏で GitHub から取り直して入れ替える
//   ・取り直した画面が前と違えば、開いている画面に知らせる（「新しい画面があります」を出す）
//   ・船のデータ（Apps Script）にはさわらない
const CACHE = 'ship-shell-v1';
const SHELL = ['./', './manifest.json', './icon-180.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function keyOf(req) {
  const u = new URL(req.url);
  if (req.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('/index.html')) return new URL('./', self.registration.scope).href;
  u.search = '';
  return u.href;
}

async function refresh(key, url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return;
    const cache = await caches.open(CACHE);
    const old = await cache.match(key);
    const isPage = key === new URL('./', self.registration.scope).href;
    if (isPage && old) {
      const [a, b] = await Promise.all([old.clone().text(), res.clone().text()]);
      await cache.put(key, res);
      if (a !== b) (await self.clients.matchAll({ type: 'window' })).forEach(c => c.postMessage({ type: 'updated' }));
    } else {
      await cache.put(key, res);
    }
  } catch (e) { /* 圏外など：残してある分をそのまま使う */ }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // Apps Script などはそのまま
  const key = keyOf(req);
  const net = req.mode === 'navigate' ? new URL('./', self.registration.scope).href : req.url;
  e.respondWith((async () => {
    const hit = await caches.match(key);
    const upd = refresh(key, net);
    if (hit) { e.waitUntil(upd); return hit; }
    await upd;
    return (await caches.match(key)) || fetch(req);
  })());
});
