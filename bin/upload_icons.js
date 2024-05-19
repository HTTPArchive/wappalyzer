const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const path = require('path');

// Configuration
const BUCKET_NAME = 'wappalizer-icons';
const ICONS_DIR = (() => {
  const fileDir = path.dirname(require.main.filename).split('/')
  fileDir.pop() // Remove current bin directory
  const appDir = fileDir.join('/')
  return appDir + '/src/images/icons/converted'; // Local directory where your PNG icons are stored
})()

const storage = new Storage();

async function syncIcons() {
  const bucket = storage.bucket(BUCKET_NAME);

  // Get list of files in the bucket
  let [filesInBucket] = await bucket.getFiles();
  filesInBucket = filesInBucket.map(file => ({
    name: file.name,
    updated: new Date(file.metadata.updated).getTime(),
  }));

  // Read all files from the local icons directory
  const files = fs.readdirSync(ICONS_DIR).filter(file => file.endsWith('.png'));

  for (const file of files) {
    const filePath = path.join(ICONS_DIR, file);
    const fileMetadata = fs.statSync(filePath);

    const fileInBucket = filesInBucket.find(f => f.name === file);

    // Upload file if it's new or has been updated
    if (!fileInBucket || fileMetadata.mtime.getTime() > fileInBucket.updated) {
      try {
        await bucket.upload(filePath, {
          destination: file,
          metadata: {
            contentType: 'image/png',
          },
        });
        console.log(`Uploaded: ${file}`);
      } catch (err) {
        console.error(`Error uploading file ${file}:`, err);
      }
    } else {
      console.log(`File already exists and is up to date: ${file}`);
    }
  }
}

syncIcons().catch(console.error);
