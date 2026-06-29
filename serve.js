#!/usr/bin/env node
/*
 * serve.js — zero-dependency static server for Black Hole Explorer.
 * Serves this folder with caching disabled (so edits always show up).
 *   node serve.js [port]        (default 8765)   ·   npm start
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || process.argv[2] || 8765;
const ROOT = __dirname;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const fp = path.join(ROOT, path.normalize(p));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end("Forbidden"); return; }
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("404 Not Found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(fp).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache"
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log("\n  ◉  Black Hole Explorer");
  console.log("     serving on  http://localhost:" + PORT);
  console.log("     press Ctrl+C to stop\n");
});
