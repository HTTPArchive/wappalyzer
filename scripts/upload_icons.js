/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const { Storage } = require('@google-cloud/storage')
const crypto = require('crypto');

console.log('Starting icon upload...')

// Configuration
const BUCKET_NAME = 'httparchive'
const ICONS_DIR = path.resolve(__dirname, '../src/images/icons/converted') // Local directory where your PNG icons are stored

const storage = new Storage({
  keyFilename: '/Users/maxostapenko/Downloads/httparchive-329b67659ab7.json',
  //credentials: JSON.parse(process.env.GCP_SA_KEY),
})

async function syncIcons() {
  const bucket = storage.bucket(BUCKET_NAME)

  console.log(`Syncing icons from ${ICONS_DIR} to bucket ${BUCKET_NAME}`)

  // Get list of files in the bucket
  const [filesInBucket] = await bucket.getFiles()
  const bucketFilesMap = new Map(
    filesInBucket.map((file) => [
      file.name,
      new Date(file.metadata.updated).getTime(),
    ])
  )

  console.log(`Found ${filesInBucket.length} files in the bucket.`)

  // Read all files from the local icons directory
  const localFiles = fs
    .readdirSync(ICONS_DIR)
    .filter((file) => file.endsWith('.png'))

  // Process files in parallel with a concurrency limit
  const CONCURRENCY_LIMIT = 100; // Adjust based on your needs
  const chunks = [];

  console.log(`Found ${localFiles.length} local files and ${filesInBucket.length} files in the bucket.`);

  // Split files into chunks for controlled parallelism
  for (let i = 0; i < localFiles.length; i += CONCURRENCY_LIMIT) {
    chunks.push(localFiles.slice(i, i + CONCURRENCY_LIMIT));
  }

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (file) => {
      const filePath = path.join(ICONS_DIR, file);
      const fileMetadata = fs.statSync(filePath);
      const fileInBucketUpdatedTime = bucketFilesMap.get(file);

      // Upload file if it's new or has been updated
      if (
        !fileInBucketUpdatedTime ||
        fileMetadata.mtime.getTime() > fileInBucketUpdatedTime
      ) {
        try {
          // Check if file content is different before uploading
          const fileExists = bucketFilesMap.has(file);
          let shouldUpload = true;

          if (fileExists) {
            // Calculate hash of local file
            const localContent = fs.readFileSync(filePath);
            const localHash = crypto.createHash('md5').update(localContent).digest('hex');

            // Download the remote file hash
            const [metadata] = await bucket.file('static/icons/' + file).getMetadata();
            const remoteHash = metadata.md5Hash ? Buffer.from(metadata.md5Hash, 'base64').toString('hex') : null;

            // Compare hashes
            shouldUpload = !remoteHash || localHash !== remoteHash;
          }

          if (shouldUpload) {
            await bucket.upload(filePath, {
              destination: 'static/icons/' + file,
              metadata: {
                contentType: 'image/png',
              },
            });
            console.log(`Uploaded: ${file} (content changed)`);
          } else {
            console.log(`${file} has the same content, skipping upload`);
          }
        } catch (err) {
          console.error(`Error uploading file ${file}:`, err);
        }
      } else {
        console.log(`${file} already exists and is up to date: ${file}`);
      }
    }));
  }
}

syncIcons().catch(console.error)
