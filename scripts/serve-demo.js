// Serve the demo (and the library it imports) over HTTP: npm run demo
// Browsers block module imports on file:// pages, so the demo needs a server.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = {
  ".css": "text/css",
  ".js": "text/javascript",
  ".html": "text/html; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  const path = normalize(new URL(req.url, "http://x").pathname).replace(/^([/.])+/, "");
  // redirect rather than alias: the demo's relative module imports
  // (./query.js) only resolve at the page's true path
  if (path === "" || path === "demo") {
    res.writeHead(302, { location: "/demo/" });
    return res.end();
  }
  const file = path === "demo/" ? "demo/index.html" : path;
  try {
    const body = await readFile(join(root, file));
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "text/plain" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found\n");
  }
});

// PORT=0 asks the OS for a free port (the actual URL is printed on startup)
const port = process.env.PORT === undefined ? 8080 : Number(process.env.PORT);
server.listen(port, "127.0.0.1", () => {
  console.log(`tabelle demo running at http://127.0.0.1:${server.address().port}/demo/`);
});
