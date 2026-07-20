// Incrementally syncs SVG/PNG icons from src/images/icons/ to GCS.
//
// For each source file, a SHA-256 hash is computed and compared against the
// hash stored in the GCS object's custom metadata (source-hash). Files whose
// hash hasn't changed are skipped. SVGs are converted to PNG via rsvg-convert
// before uploading; source PNGs are uploaded as-is.
//
// Usage:
//   npm run sync_icons          — incremental (skip unchanged files)
//   npm run sync_icons -- --all — force re-convert and re-upload everything

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { Storage } = require('@google-cloud/storage');

const ICONS_DIR = './src/images/icons';
const GCS_BUCKET = 'httparchive';
const GCS_PREFIX = 'icons_temp';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const FORCE_ALL = process.argv.includes('--all');

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
 * Retrieve the source-hash stored in a GCS object's custom metadata.
 * Returns null if the object doesn't exist or has no hash stored.
 * @param {string} gcsPath
 * @returns {Promise<string|null>}
 */
async function getGcsHash(gcsPath) {
  try {
    const file = bucket.file(gcsPath);
    const [metadata] = await file.getMetadata();
    return metadata?.metadata?.['source-hash'] || null;
  } catch (e) {
    if (e.code === 404) return null;
    throw e;
  }
}

/**
 * Convert an SVG file to a 128×128 PNG using rsvg-convert.
 * Writes the PNG to a temporary path and returns it.
 * @param {string} svgPath
 * @returns {string} path to the generated PNG
 */
function convertSvgToPng(svgPath) {
  const tmpPng = svgPath.replace(/\.svg$/i, `._tmp_${process.pid}.png`);
  execSync(`rsvg-convert "${svgPath}" -o "${tmpPng}" -w 128 -h 128`, {
    stdio: 'inherit'
  });
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

  console.log(
    `Found ${iconFiles.length} icon files (--all=${FORCE_ALL}). Processing...`
  );

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let processed = 0;

  for (const file of iconFiles) {
    processed++;
    if (processed % 100 === 0) {
      console.log(
        `[Progress] Processed ${processed}/${iconFiles.length} files (uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed})`
      );
    }

    const filePath = path.join(ICONS_DIR, file);
    const basename = path.basename(file, path.extname(file));
    const gcsPath = `${GCS_PREFIX}/${basename}.png`;
    const ext = path.extname(file).toLowerCase();

    let tmpPng = null;

    try {
      const localHash = sha256(filePath);

      if (!FORCE_ALL) {
        const gcsHash = await getGcsHash(gcsPath);
        if (gcsHash === localHash) {
          skipped++;
          consecutiveFailures = 0;
          continue;
        }
      }

      let pngPath;
      if (ext === '.svg') {
        tmpPng = convertSvgToPng(filePath);
        pngPath = tmpPng;
      } else {
        pngPath = filePath;
      }

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
    } finally {
      if (tmpPng && fs.existsSync(tmpPng)) {
        fs.unlinkSync(tmpPng);
      }
    }
  }

  console.log(
    `\nDone. Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`
  );

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
