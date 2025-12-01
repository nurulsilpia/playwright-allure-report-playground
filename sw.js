self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
  console.log("[SW] Activated and claiming clients.");
});

let fileCache = new Map();

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "FILE_LIST") {
    fileCache = event.data.files;
    console.log(
      `[SW] Received ${fileCache.size} normalized files. Ready to serve.`
    );
  }
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.includes("/__view__/")) {
    event.respondWith(
      (async () => {
        let path = url.pathname.split("/__view__/")[1];
        path = decodeURIComponent(path);

        const file = fileCache.get(path);

        if (file) {
          let contentType = file.type || "application/octet-stream";
          if (path.endsWith(".html")) contentType = "text/html";
          else if (path.endsWith(".css")) contentType = "text/css";
          else if (path.endsWith(".js")) contentType = "application/javascript";
          else if (path.endsWith(".json")) contentType = "application/json";
          else if (path.endsWith(".png")) contentType = "image/png";
          else if (path.endsWith(".jpg") || path.endsWith(".jpeg"))
            contentType = "image/jpeg";
          else if (path.endsWith(".svg")) contentType = "image/svg+xml";

          return new Response(file, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "no-cache",
            },
          });
        } else {
          console.warn(`[SW] File not found in cache: ${path}`);
          return new Response(`File not found in local drop: ${path}`, {
            status: 404,
          });
        }
      })()
    );
  }
});
