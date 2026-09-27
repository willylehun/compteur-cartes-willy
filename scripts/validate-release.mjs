import { readdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const REQUIRED_RUNTIME_FILES = [
  "index.html",
  "privacy.html",
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

function sha384Integrity(content) {
  return `sha384-${createHash("sha384").update(content).digest("base64")}`;
}

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

const [indexHtml, privacyHtml, bootstrapJs, appJs, styleCss, manifestText, serviceWorker, versionText] = await Promise.all([
  read("index.html"),
  read("privacy.html"),
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
assert(privacyHtml.includes(`<small>v${version}</small>`), "Version visible de la page de confidentialité désynchronisée.");
assert(privacyHtml.includes(`bootstrap.js?v=${version}`), "Version bootstrap de la page de confidentialité désynchronisée.");
assert(privacyHtml.includes(`style.css?v=${version}`), "Version CSS de la page de confidentialité désynchronisée.");
assert(bootstrapJs.includes(`const BUILD = "${version}"`), "Version bootstrap interne désynchronisée.");
assert(appJs.includes(`window.__COUNTER_BUILD__ || "${version}"`), "Version de secours de l'application désynchronisée.");
assert(serviceWorker.includes(`const APP_VERSION = "${version}"`), "Version du Service Worker désynchronisée.");
assert(manifest.start_url === `./?app=v${version}`, "Version start_url désynchronisée.");

const requiredCspDirectives = [
  "default-src 'none'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src-attr 'none'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "trusted-types counter-renderer",
  "require-trusted-types-for 'script'"
];
for (const directive of requiredCspDirectives) {
  assert(indexHtml.includes(directive), `Directive CSP absente : ${directive}`);
  assert(privacyHtml.includes(directive), `Directive CSP absente de la page de confidentialité : ${directive}`);
  assert(serviceWorker.includes(directive), `Directive CSP absente du Service Worker : ${directive}`);
}
assert(serviceWorker.includes("frame-ancestors 'none'"), "Protection CSP frame-ancestors absente du Service Worker.");
assert(!indexHtml.includes("frame-ancestors 'none'"), "frame-ancestors est invalide dans une CSP livrée par balise meta.");
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(indexHtml), "Un script inline empêcherait une CSP stricte.");
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(privacyHtml), "Un script inline est présent sur la page de confidentialité.");
assert(!/\son[a-z]+\s*=/i.test(indexHtml + privacyHtml), "Gestionnaire d'événement HTML inline détecté.");
assert(!(indexHtml + privacyHtml).includes("'unsafe-inline'"), "La CSP ne doit pas autoriser le code ou les styles inline.");
assert(!/\sstyle\s*=/i.test(indexHtml + privacyHtml + appJs), "Style HTML inline détecté.");
assert(!/\.style(?:\.|\[|\s*=)/.test(appJs + bootstrapJs), "Modification de style inline détectée.");
assert(!/\b(?:eval|Function)\s*\(/.test(appJs + bootstrapJs + serviceWorker), "Exécution JavaScript dynamique interdite.");
assert(!/document\.write\s*\(/.test(appJs + bootstrapJs), "document.write est interdit.");
assert((appJs.match(/\.innerHTML\s*=/g) || []).length === 1, "Tout rendu HTML doit passer par l'unique garde Trusted Types.");
assert(appJs.includes('createPolicy("counter-renderer"'), "La politique Trusted Types de rendu est absente.");
assert(appJs.includes("value.length > 2_000_000"), "La taille des données locales non fiables doit être bornée avant JSON.parse.");
assert(serviceWorker.includes('headers.set("X-Content-Type-Options", "nosniff")'), "Protection nosniff absente.");
assert(serviceWorker.includes('headers.set("X-Frame-Options", "DENY")'), "Protection anti-iframe absente.");
assert(serviceWorker.includes('headers.set("Permissions-Policy"'), "Permissions-Policy absente.");
assert(serviceWorker.includes('headers.set("Cross-Origin-Embedder-Policy", "require-corp")'), "Isolation COEP absente.");
assert(serviceWorker.includes('headers.set("Origin-Agent-Cluster", "?1")'), "Isolation Origin-Agent-Cluster absente.");
assert(serviceWorker.includes("hasExpectedContentType"), "Validation MIME du Service Worker absente.");
assert(serviceWorker.includes("key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME"), "Le nettoyage du cache n'est pas limité à l'application.");
assert(serviceWorker.includes("PRIVACY_URL") && serviceWorker.includes("pathname === new URL(PRIVACY_URL).pathname"), "La navigation confidentialité doit conserver son propre cache.");

for (const [asset, content] of [["bootstrap.js", bootstrapJs], ["app.js", appJs], ["style.css", styleCss]]) {
  const integrity = sha384Integrity(content);
  assert(indexHtml.includes(`integrity="${integrity}"`), `Empreinte SRI absente ou invalide pour ${asset}.`);
  if (asset !== "app.js") {
    assert(privacyHtml.includes(`integrity="${integrity}"`), `Empreinte SRI absente ou invalide pour ${asset} dans privacy.html.`);
  }
}

assert(indexHtml.includes('href="privacy.html"'), "Lien vers la confidentialité absent de l'application.");
assert(privacyHtml.includes('rel="noopener noreferrer"'), "Le lien externe de confidentialité doit neutraliser opener et referrer.");

const runtimeBundle = [indexHtml, privacyHtml, bootstrapJs, appJs, styleCss, manifestText, serviceWorker, versionText].join("\n");
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

for (const workflowPath of [".github/workflows/pages.yml", ".github/workflows/security.yml", ".github/workflows/codeql.yml", ".github/workflows/android.yml"]) {
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
assert(pagesWorkflow.includes("index.html privacy.html bootstrap.js"), "La page de confidentialité doit faire partie de la liste blanche Pages.");

const androidBuild = await read("android/app/build.gradle");
const androidManifest = await read("android/app/src/main/AndroidManifest.xml");
const androidStrings = await read("android/app/src/main/res/values/strings.xml");
const networkSecurity = await read("android/app/src/main/res/xml/network_security_config.xml");
const assetlinksGenerator = await read("scripts/render-assetlinks.mjs");
const playListing = await read("play-store/listing-fr.md");

assert(androidBuild.includes('applicationId "fr.bywilly.counter"'), "Identifiant Android inattendu.");
assert(androidBuild.includes("compileSdk 36") && androidBuild.includes("targetSdk 36"), "Le projet Android doit cibler l'API 36.");
assert(androidBuild.includes('androidbrowserhelper:2.7.3'), "Version Android Browser Helper inattendue.");
assert(!androidBuild.includes("signingConfigs") && !androidBuild.includes("storePassword"), "La signature Android ne doit pas être configurée dans le dépôt.");
const androidPermissions = [...androidManifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map(match => match[1]);
assert(androidPermissions.length === 1 && androidPermissions[0] === "android.permission.INTERNET", "Android ne doit demander que la permission Internet.");
assert(androidManifest.includes('android:usesCleartextTraffic="false"'), "Le trafic Android en clair doit être bloqué.");
assert(androidManifest.includes('android:allowBackup="false"'), "Les sauvegardes Android doivent être désactivées.");
assert(networkSecurity.includes('cleartextTrafficPermitted="false"'), "La configuration réseau Android doit refuser HTTP.");
assert(androidStrings.includes(`?app=v${version}`), "La TWA ne pointe pas vers la version PWA publiée.");
assert(assetlinksGenerator.includes('const PACKAGE_NAME = "fr.bywilly.counter"'), "Le générateur Asset Links utilise un paquet inattendu.");
assert(playListing.includes("/privacy.html"), "La fiche Play doit référencer la politique de confidentialité publique.");

const featureGraphic = await readFile(path.join(ROOT, "play-store/feature-graphic.png"));
assert(featureGraphic.subarray(1, 4).toString("ascii") === "PNG", "Le visuel promotionnel doit être un PNG.");
assert(featureGraphic.readUInt32BE(16) === 1024 && featureGraphic.readUInt32BE(20) === 500, "Le visuel promotionnel doit mesurer 1024 × 500.");

console.log(`Validation de sécurité réussie pour Counter By Willy v${version}.`);
