const PACKAGE_NAME = "fr.bywilly.counter";
const fingerprint = String(process.argv[2] || process.env.PLAY_APP_SIGNING_SHA256 || "")
  .trim()
  .toUpperCase();

if (!/^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fingerprint)) {
  console.error("Fournissez l'empreinte SHA-256 Play App Signing (32 octets séparés par des deux-points).");
  process.exitCode = 1;
} else {
  const document = [{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE_NAME,
      sha256_cert_fingerprints: [fingerprint]
    }
  }];
  process.stdout.write(`${JSON.stringify(document, null, 2)}\n`);
}
