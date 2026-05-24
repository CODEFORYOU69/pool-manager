/**
 * electron-builder afterSign hook — notarise le .app via notarytool directement.
 *
 * On n'utilise pas @electron/notarize : il fait un preflight `codesign --verify
 * --strict` qui échoue toujours sur macOS Sequoia/Tahoe à cause de la race
 * com.apple.FinderInfo. La signature sur disque est correcte — notarytool
 * elle-même l'accepte une fois qu'on lui donne un zip.
 *
 * Procédure :
 *   1. ditto le .app dans un zip (le format zip ne préserve PAS les xattrs).
 *   2. xcrun notarytool submit zip --keychain-profile AC_NOTARY --wait.
 *   3. Si Accepted → xcrun stapler staple le .app.
 *
 * Credentials dans le keychain sous le profil "AC_NOTARY" :
 *   xcrun notarytool store-credentials "AC_NOTARY" \
 *     --apple-id "y.ouasmi@gmail.com" \
 *     --team-id "VRA2ZFJM88" \
 *     --password "<app-specific-password>"
 *
 * Skip via : SKIP_NOTARIZATION=true npm run dist:mac
 */
const path = require("path");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");

function run(cmd, args, opts = {}) {
  console.log(
    `  $ ${cmd} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`
  );
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} → exit ${r.status}`);
  }
}

exports.default = async function notarize(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== "darwin") return;

  if (process.env.SKIP_NOTARIZATION === "true") {
    console.log("  • notarization  skipped (SKIP_NOTARIZATION=true)");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`  • notarizing    ${appPath}`);
  console.log("  • profile       AC_NOTARY (via notarytool)");

  // 1. Zip via ditto (pas de FinderInfo dans le zip)
  const zipPath = path.join(
    os.tmpdir(),
    `${appName.replace(/\s+/g, "_")}-${Date.now()}.zip`
  );
  console.log(`  • zip via ditto ${zipPath}`);
  run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath]);

  // 2. Submit + wait (1-5 min)
  console.log("  • submit + wait (this can take 1-5 min)");
  try {
    run("xcrun", [
      "notarytool",
      "submit",
      zipPath,
      "--keychain-profile",
      "AC_NOTARY",
      "--wait",
    ]);
  } finally {
    try {
      fs.unlinkSync(zipPath);
    } catch {
      /* ignore */
    }
  }

  // 3. Staple le ticket sur le .app pour vérification offline par Gatekeeper
  console.log("  • stapling ticket");
  run("xcrun", ["stapler", "staple", appPath]);
  run("xcrun", ["stapler", "validate", appPath]);

  console.log("  • notarization  done");
};
