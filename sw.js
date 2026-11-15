// =====================================================
// SERVICE WORKER: un "ayudante" que el navegador instala junto a la app.
// Estrategia "primero la red": siempre intenta traer la versión más nueva
// desde internet; solo si no hay conexión usa la copia guardada.
// =====================================================

// Si algún día hay problemas con versiones viejas, cambia v1 por v2, v3...
const NOMBRE_CACHE = "gastos-v1";

const ARCHIVOS_APP = [
  "./",
  "index.html",
  "estilos.css",
  "config.js",
  "app.js",
  "manifest.json",
  "icono-192.png",
  "icono-512.png",
];

// 1) Al instalarse: guardar una copia de los archivos de la app.
self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches.open(NOMBRE_CACHE).then((cache) => cache.addAll(ARCHIVOS_APP))
  );
  self.skipWaiting();   // empezar a funcionar sin esperar a que se cierre la app
});

// 2) Al activarse: borrar copias de versiones anteriores (v0, v1...).
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) =>
      Promise.all(
        nombres.filter((n) => n !== NOMBRE_CACHE).map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});

// 3) Cada vez que la app pide un archivo.
self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);

  // Solo nos metemos con archivos de NUESTRA página (no con Supabase
  // ni con la librería), y solo con lecturas (GET).
  if (pedido.method !== "GET" || url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(pedido)
      .then((respuesta) => {
        // Llegó de internet: actualizamos la copia y la entregamos.
        const copia = respuesta.clone();
        caches.open(NOMBRE_CACHE).then((cache) => cache.put(pedido, copia));
        return respuesta;
      })
      .catch(() => caches.match(pedido))   // sin internet: usamos la copia
  );
});
