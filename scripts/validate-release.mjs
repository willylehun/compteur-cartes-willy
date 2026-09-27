import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REQUIRED_RUNTIME_FILES = [
  "index.html",
  "bootstrap.js",
  "app.js",
  "style.css",
  "manifest.json",
  "sw.js",
  "version.json",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];
const TEXT_EXTENSIONS = new Set(["", ".css", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml"]);
const IGNORED_DIRECTORIES = new Set([".git", "_site", "coverage", "node_modules"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), "utf8");
}

async function walk(directory = ROOT) {
  const results = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...await walk(absolutePath));
    else if (entry.isFile()) results.push(absolutePath);
  }
  return results;
}

for (const relativePath of REQUIRED_RUNTIME_FILES) {
  const info = await stat(path.join(ROOT, relativePath));
  assert(info.isFile() && info.size > 0, `Fichier d'exécution absent ou vide : ${relativePath}`);
}

const [indexHtml, bootstrapJs, appJs, styleCss, manifestText, serviceWorker, versionText] = await Promise.all([
  read("index.html"),
  read("bootstrap.js"),
  read("app.js"),
  read("style.css"),
  read("manifest.json"),
  read("sw.js"),
  read("version.json")
]);
const manifest = JSON.parse(manifestText);
const versionDocument = JSON.parse(versionText);
const version = String(versionDocument.version ?? "");

assert(/^\d{1,6}$/.test(version), "La version publiée doit être un entier court.");
assert(indexHtml.includes(`bootstrap.js?v=${version}`), "Version bootstrap désynchronisée.");
assert(indexHtml.includes(`style.css?v=${version}`), "Version CSS désynchronisée.");
assert(indexHtml.includes(`app.js?v=${version}`), "Version JavaScript désynchronisée.");
assert(indexHtml.includes(`manifest.json?v=${version}`), "Version du manifeste désynchronisée.");
assert(indexHtml.includes(`<small>v${version}</small>`), "Version visible désynchronisée.");
assert(bootstrapJs.includes(`const BUILD = "${version}"`), "Version bootstrap interne désynchronisée.");
assert(appJs.includes(`window.__COUNTER_BUILD__ || "${version}"`), "Version de secours de l'application désynchronisée.");
assert(serviceWorker.includes(`const APP_VERSION = "${version}"`), "Version du Service Worker désynchronisée.");
assert(manifest.start_url === `./?app=v${version}`, "Version start_url désynchronisée.");

const requiredCspDirectives = [
  "default-src 'none'",
  "script-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'"
];
for (const directive of requiredCspDirectives) {
  assert(indexHtml.includes(directive), `Directive CSP absente : ${directive}`);
  assert(serviceWorker.includes(directive), `Directive CSP absente du Service Worker : ${directive}`);
}
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml), "Un script inline empêcherait une CSP stricte.");
assert(!/\son[a-z]+\s*=/i.test(indexHtml), "Gestionnaire d'événement HTML inline détecté.");
assert(!indexHtml.includes("'unsafe-inline'"), "La CSP ne doit pas autoriser le code ou les styles inline.");
assert(!/\sstyle\s*=/i.test(indexHtml + appJs), "Style HTML inline détecté.");
assert(!/\.style(?:\.|\[|\s*=)/.test(appJs + bootstrapJs), "Modification de style inline détectée.");
assert(!/\b(?:eval|Function)\s*\(/.test(appJs + bootstrapJs + serviceWorker), "Exécution JavaScript dynamique interdite.");
assert(!/document\.write\s*\(/.test(appJs + bootstrapJs), "document.write est interdit.");
assert(serviceWorker.includes('headers.set("X-Content-Type-Options", "nosniff")'), "Protection nosniff absente.");
assert(serviceWorker.includes('headers.set("X-Frame-Options", "DENY")'), "Protection anti-iframe absente.");
assert(serviceWorker.includes('headers.set("Permissions-Policy"'), "Permissions-Policy absente.");
assert(serviceWorker.includes("key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME"), "Le nettoyage du cache n'est pas limité à l'application.");

const runtimeBundle = [indexHtml, bootstrapJs, appJs, styleCss, manifestText, serviceWorker, versionText].join("\n");
assert(!/\bhttp:\/\//i.test(runtimeBundle), "Ressource HTTP non sécurisée détectée dans l'application.");
assert(!/(?:src|href)=["']https?:\/\//i.test(indexHtml), "Ressource externe détectée dans index.html.");

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{20,}\b/i
];
const suspiciousNames = /(^|\/)(?:\.env(?:\..+)?|id_rsa|credentials[^/]*\.json|secrets?[^/]*\.json|[^/]+\.(?:jks|key|keystore|p12|pem|pfx))$/i;

for (const absolutePath of await walk()) {
  const relativePath = path.relative(ROOT, absolutePath).replaceAll(path.sep, "/");
  assert(!suspiciousNames.test(relativePath) || relativePath === ".env.example", `Fichier sensible suivi : ${relativePath}`);
  if (!TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase())) continue;
  const content = await readFile(absolutePath, "utf8");
  for (const pattern of secretPatterns) {
    assert(!pattern.test(content), `Secret potentiel détecté dans ${relativePath}`);
  }
}

for (const workflowPath of [".github/workflows/pages.yml", ".github/workflows/security.yml"]) {
  const workflow = await read(workflowPath);
  assert(!workflow.includes("pull_request_target"), `${workflowPath} ne doit pas utiliser pull_request_target.`);
  assert(!workflow.includes("write-all"), `${workflowPath} accorde des permissions excessives.`);
  assert(!workflow.includes("secrets."), `${workflowPath} ne doit pas exposer de secret.`);
  const uses = [...workflow.matchAll(/\buses:\s*[^\s@]+@([^\s#]+)/g)].map(match => match[1]);
  assert(uses.length > 0 && uses.every(ref => /^[a-f0-9]{40}$/.test(ref)), `Action non épinglée par SHA dans ${workflowPath}.`);
}

const pagesWorkflow = await read(".github/workflows/pages.yml");
assert(pagesWorkflow.includes('path: "_site"'), "Pages doit publier uniquement le répertoire préparé.");
assert(!pagesWorkflow.includes('path: "."'), "Le dépôt entier ne doit pas être publié.");

console.log(`Validation de sécurité réussie pour Counter By Willy v${version}.`);
