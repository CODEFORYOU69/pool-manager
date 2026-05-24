/**
 * electron-builder afterPack hook — signe manuellement le bundle pour
 * contourner la race com.apple.FinderInfo de macOS Sequoia/Tahoe.
 *
 * Pourquoi : macOS ré-applique com.apple.FinderInfo aux dossiers .app dans
 * les microsecondes qui suivent le strip. La seule façon de gagner la race
 * est de faire `xattr -d` + `codesign` dans le MÊME process shell, et de
 * retry plusieurs fois si nécessaire.
 *
 * `mac.identity: null` dans package.json → electron-builder ne signe pas,
 * c'est ce hook qui prend la main.
 *
 * Adapté de /Users/younesouasmi/Documents/dev/taekwondo-analyse-ia/tagger/scripts/afterPack.js
 */
const { execSync, spawnSync } = require("child_process");
const path = require("path");

const SIGN_IDENTITY =
  process.env.CSC_NAME ||
  "Developer ID Application: younes ouasmi (VRA2ZFJM88)";
const ENTITLEMENTS = path.resolve(
  __dirname,
  "../build-resources/entitlements.mac.plist"
);

/**
 * Strip xattrs + codesign dans 1 seul process shell, retry jusqu'à 8 fois.
 *
 * Pour le bundle racine, on fait un strip RÉCURSIF de tous les FinderInfo
 * dans le même process shell juste avant le codesign. Sinon les sub-bundles
 * voient leur FinderInfo revenir entre leur sign et le sign racine, et le
 * codesign racine échoue avec "resource fork, Finder information, or similar
 * detritus not allowed".
 */
function atomicStripAndSign(p, { deep = false, recursiveStrip = false } = {}) {
  const deepFlag = deep ? "--deep" : "";
  const escaped = p.replace(/'/g, `'\\''`);
  const recursiveStripCmd = recursiveStrip
    ? `find '${escaped}' -print0 | xargs -0 -P 8 -n 50 sh -c 'for f in "$@"; do xattr -d com.apple.FinderInfo "$f" 2>/dev/null; xattr -d com.apple.fileprovider.fpfs#P "$f" 2>/dev/null; done' _`
    : "";
  const cmd = `
    for i in 1 2 3 4 5 6 7 8; do
      ${recursiveStripCmd}
      xattr -c '${escaped}' 2>/dev/null
      xattr -d com.apple.FinderInfo '${escaped}' 2>/dev/null
      xattr -d com.apple.fileprovider.fpfs#P '${escaped}' 2>/dev/null
      if codesign --sign '${SIGN_IDENTITY}' --force --timestamp --options runtime --entitlements '${ENTITLEMENTS}' ${deepFlag} '${escaped}' 2>&1; then
        exit 0
      fi
      echo "  retry attempt $i for $(basename '${escaped}')"
    done
    exit 1
  `.trim();
  const r = spawnSync("sh", ["-c", cmd], { stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(
      `atomic sign failed for ${p} after 8 retries (exit ${r.status})`
    );
  }
}

function disableSpotlight(appPath) {
  spawnSync("mdutil", ["-i", "off", appPath], { stdio: "ignore" });
}

function findSignableBundles(appPath) {
  const out = execSync(
    `find "${appPath}" -type d \\( -name "*.app" -o -name "*.framework" \\) -mindepth 1 -depth`,
    { encoding: "utf8" }
  );
  return out.split("\n").filter(Boolean);
}

function findInnerBinaries(appPath) {
  // .dylib + .node (Prisma engines, native modules…)
  const dylibs = execSync(
    `find "${appPath}" -type f \\( -name "*.dylib" -o -name "*.node" \\) -print`,
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);

  const extras = [];
  try {
    const frameworksDir = `${appPath}/Contents/Frameworks`;
    const candidates = execSync(
      `find "${frameworksDir}" -type f -perm +111 ! -name "*.dylib" ! -name "*.node"`,
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean);

    for (const c of candidates) {
      const tail = c.slice(frameworksDir.length + 1);
      if (tail.includes(".app/")) continue;
      try {
        const out = execSync(`file -b "${c}"`, { encoding: "utf8" });
        if (/Mach-O/.test(out)) extras.push(c);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no Frameworks dir */
  }

  // Aussi : binaires Mach-O dans Resources/ (api/node_modules contient
  // des binaires Prisma engines, esbuild, etc. SANS extension).
  try {
    const resourcesDir = `${appPath}/Contents/Resources`;

    // 1. .dylib / .node explicites
    const resLibs = execSync(
      `find "${resourcesDir}" -type f \\( -name "*.dylib" -o -name "*.node" \\) -print`,
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean);
    extras.push(...resLibs);

    // 2. Tous les fichiers exécutables sans extension reconnaissables comme
    //    Mach-O (Prisma schema-engine-*, esbuild, etc.)
    const resCandidates = execSync(
      `find "${resourcesDir}" -type f -perm +111 ! -name "*.dylib" ! -name "*.node" ! -name "*.js" ! -name "*.json" ! -name "*.md" ! -name "*.html" ! -name "*.css" ! -name "*.ts" ! -name "*.txt" ! -name "*.yaml" ! -name "*.yml" ! -name "*.lock" ! -name "*.sh" ! -name "*.py"`,
      { encoding: "utf8" }
    )
      .split("\n")
      .filter(Boolean);

    for (const c of resCandidates) {
      try {
        const out = execSync(`file -b "${c}"`, { encoding: "utf8" });
        if (/Mach-O/.test(out)) extras.push(c);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  const all = [...dylibs, ...extras];
  // Dédup + tri du plus profond au moins profond
  const unique = Array.from(new Set(all));
  return unique.sort((a, b) => b.split("/").length - a.split("/").length);
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log(`  • manual sign     ${appPath}`);
  console.log(`  • identity        ${SIGN_IDENTITY}`);

  disableSpotlight(appPath);
  console.log("  • spotlight       disabled on .app");

  // 1er pass best-effort : strip tout
  spawnSync(
    "sh",
    [
      "-c",
      `find "${appPath}" -print0 | xargs -0 xattr -c 2>/dev/null`,
    ],
    { stdio: "ignore" }
  );

  // 1. Signer chaque binaire interne (.dylib, .node, Mach-O lâches)
  const innerBinaries = findInnerBinaries(appPath);
  console.log(`  • inner binaries  ${innerBinaries.length} dylibs/Mach-Os to sign`);
  for (const bin of innerBinaries) {
    atomicStripAndSign(bin);
    console.log(`    ✓ ${path.basename(bin)}`);
  }

  // 2. Signer chaque .app/.framework imbriqué (du plus profond au moins profond)
  const bundles = findSignableBundles(appPath);
  console.log(`  • bundles         ${bundles.length} nested .app/.framework to sign`);
  for (const bundle of bundles) {
    atomicStripAndSign(bundle, { deep: true });
    console.log(`    ✓ ${path.basename(bundle)}`);
  }

  // 3. Signer le bundle principal en dernier — strip RÉCURSIF avant chaque
  //    tentative pour battre la ré-application FinderInfo sur les sub-bundles.
  atomicStripAndSign(appPath, { recursiveStrip: true });
  console.log("  • main bundle     signed");
};
