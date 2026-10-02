// Incrementally syncs SVG/PNG icons from src/images/icons/ to GCS.
//
// For each source file, a SHA-256 hash is computed and compared against the
// hash stored in the GCS object's custom metadata (source-hash). Files whose
// hash hasn't changed are skipped. SVGs are converted to PNG via rsvg-convert
// before uploading; source PNGs are uploaded as-is. Objects previously
// uploaded by this script whose source icon has been removed are deleted.
//
// Usage:
//   npm run sync_icons          — incremental (skip unchanged files)
//   npm run sync_icons -- --all — force re-convert and re-upload everything

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Storage } = require('@google-cloud/storage');

const ICONS_DIR = './src/images/icons';
const GCS_BUCKET = 'httparchive';
const GCS_PREFIX = 'icons_temp';
// Objects are overwritten in place when an icon changes, so they must not be
// cached as immutable.
const CACHE_CONTROL = 'public, max-age=86400';
const FORCE_ALL = process.argv.includes('--all');
// Guard against a broken checkout wiping the bucket.
const MAX_PRUNE = 50;

const storage = new Storage();
const bucket = storage.bucket(GCS_BUCKET);

/**
 * Compute the SHA-256 hex digest of a file's contents.
 * @param {string} filePath
 * @returns {string}
 */
function sha256(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * List the source-hash of every object under GCS_PREFIX in one paginated call.
 * Objects without a stored hash map to null.
 * @returns {Promise<Map<string, string|null>>} object name → source-hash
 */
async function listGcsHashes() {
  const [files] = await bucket.getFiles({ prefix: `${GCS_PREFIX}/` });
  return new Map(
    files.map((file) => [
      file.name,
      file.metadata?.metadata?.['source-hash'] || null
    ])
  );
}

/**
 * Convert an SVG file to a PNG fitting in 128×128 (aspect ratio preserved)
 * using rsvg-convert. Writes the PNG to tmpDir and returns its path.
 * @param {string} svgPath
 * @param {string} tmpDir
 * @returns {string} path to the generated PNG
 */
function convertSvgToPng(svgPath, tmpDir) {
  const tmpPng = path.join(
    tmpDir,
    `${path.basename(svgPath, path.extname(svgPath))}.png`
  );
  execFileSync(
    'rsvg-convert',
    [svgPath, '-o', tmpPng, '-w', '128', '-h', '128', '--keep-aspect-ratio'],
    { stdio: 'inherit' }
  );
  return tmpPng;
}

/**
 * Upload a local file to GCS, storing the source hash in custom metadata.
 * @param {string} localPath
 * @param {string} gcsPath
 * @param {string} sourceHash
 */
async function uploadToGcs(localPath, gcsPath, sourceHash) {
  await bucket.upload(localPath, {
    destination: gcsPath,
    metadata: {
      cacheControl: CACHE_CONTROL,
      metadata: {
        'source-hash': sourceHash
      }
    }
  });
}

async function main() {
  const allFiles = fs.readdirSync(ICONS_DIR);
  const iconFiles = allFiles.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return (ext === '.svg' || ext === '.png') && !f.startsWith('.');
  });

  if (iconFiles.length === 0) {
    throw new Error(`No icons found in ${ICONS_DIR}`);
  }

  // Foo.svg and Foo.png would both map to icons/Foo.png and overwrite each
  // other on every run.
  const byGcsPath = new Map();
  for (const file of iconFiles) {
    const gcsPath = `${GCS_PREFIX}/${path.basename(file, path.extname(file))}.png`;
    if (byGcsPath.has(gcsPath)) {
      throw new Error(
        `${byGcsPath.get(gcsPath)} and ${file} both map to ${gcsPath}`
      );
    }
    byGcsPath.set(gcsPath, file);
  }

  console.log(
    `Found ${iconFiles.length} icon files (--all=${FORCE_ALL}). Processing...`
  );

  const gcsHashes = await listGcsHashes();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync_icons-'));

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let processed = 0;

  try {
    for (const [gcsPath, file] of byGcsPath) {
      processed++;
      if (processed % 100 === 0) {
        console.log(
          `[Progress] Processed ${processed}/${iconFiles.length} files (uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed})`
        );
      }

      const filePath = path.join(ICONS_DIR, file);
      const ext = path.extname(file).toLowerCase();

      try {
        const localHash = sha256(filePath);

        if (!FORCE_ALL && gcsHashes.get(gcsPath) === localHash) {
          skipped++;
          consecutiveFailures = 0;
          continue;
        }

        const pngPath =
          ext === '.svg' ? convertSvgToPng(filePath, tmpDir) : filePath;

        await uploadToGcs(pngPath, gcsPath, localHash);
        console.log(`  ✓ ${file} → gs://${GCS_BUCKET}/${gcsPath}`);
        uploaded++;
        consecutiveFailures = 0;
      } catch (e) {
        console.error(`  ✗ ${file}: ${e.message}`);
        failed++;
        consecutiveFailures++;
        if (consecutiveFailures >= 10) {
          console.error(
            `\n[Abort] Encountered ${consecutiveFailures} consecutive failures. Aborting sync to prevent endless retries.`
          );
          break;
        }
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // Delete objects this script uploaded (they carry a source-hash) whose source
  // icon no longer exists. Skipped after failures so a partial run never prunes.
  let deleted = 0;
  if (failed === 0) {
    const orphans = [...gcsHashes]
      .filter(([name, hash]) => hash && !byGcsPath.has(name))
      .map(([name]) => name);

    if (orphans.length > MAX_PRUNE) {
      throw new Error(
        `Refusing to delete ${orphans.length} objects (limit ${MAX_PRUNE}); run locally after checking ${ICONS_DIR}.`
      );
    }

    for (const name of orphans) {
      await bucket.file(name).delete();
      console.log(`  🗑 gs://${GCS_BUCKET}/${name}`);
      deleted++;
    }
  }

  console.log(
    `\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Deleted: ${deleted}, Failed: ${failed}`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
