// Service worker do app de campo: com internet sempre busca a versão mais nova; sem internet abre do celular
const CACHE = "rdo-campo-v4";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => fetch(new Request(u, {cache: "reload"})).then(r => r.ok && c.put(u, r)).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
function idbGet(k){
  return new Promise(res => {
    const r = indexedDB.open("campo-blobs", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("b");
    r.onerror = () => res(null);
    r.onsuccess = () => { try { const t = r.result.transaction("b", "readonly"); const q = t.objectStore("b").get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (e) { res(null); } };
  });
}
const VAZIA = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#eeeeec"/><text x="50%" y="50%" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#666">Foto guardada na central</text></svg>`;
const comPrazo = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("tempo")), ms))]);
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (u.origin !== location.origin || e.request.method !== "GET") return;
  const i = u.pathname.indexOf("/_blob/");
  if (i >= 0) {
    const id = decodeURIComponent(u.pathname.slice(i + 7));
    e.respondWith(idbGet(id).then(b => b ? new Response(b, {headers: {"Content-Type": b.type || "image/jpeg"}}) : new Response(VAZIA, {headers: {"Content-Type": "image/svg+xml"}})));
    return;
  }
  // páginas: tenta a internet primeiro (versão mais nova); sem sinal, usa a cópia do celular
  e.respondWith(caches.open(CACHE).then(async c => {
    const nav = e.request.mode === "navigate" || /index\.html$|\/$/.test(u.pathname);
    const chave = nav ? "./index.html" : e.request;
    try {
      const r = await comPrazo(fetch(e.request, {cache: "no-store"}), nav ? 5000 : 8000);
      if (r && r.ok) { c.put(chave, r.clone()); return r; }
      throw new Error("http");
    } catch (err) {
      return (await c.match(chave, {ignoreSearch: true})) || (await c.match("./index.html")) || new Response("Sem internet", {status: 503});
    }
  }));
});
