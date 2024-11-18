/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const { Storage } = require('@google-cloud/storage')

// Configuration
const BUCKET_NAME = 'httparchive' // CDN bucket, available as https://cdn.httparchive.org/
const BUCKET_PATH = 'static/icons/' // Path in the bucket where the icons should be uploaded
const ICONS_DIR = path.resolve(__dirname, '../src/images/icons/converted') // Local directory where your PNG icons are stored

const storage = new Storage()

async function syncIcons() {
  console.log('Syncing icons...')
  const bucket = storage.bucket(BUCKET_NAME)

  // Get list of files in the bucket
  const [filesInBucket] = await bucket.getFiles({
    prefix: BUCKET_PATH,
  })
  const bucketFilesMap = new Map(
    filesInBucket.map((file) => [
      file.name,
      new Date(file.metadata.updated).getTime(),
    ])
  )
  console.log(`Found ${bucketFilesMap.size} files in the bucket.`)


  // Read all files from the local icons directory
  const localFiles = fs
    .readdirSync(ICONS_DIR)
    .filter((file) => file.endsWith('.png'))

  for (const file of localFiles) {
    const filePath = path.join(ICONS_DIR, file)
    const fileMetadata = fs.statSync(filePath)
    const fileInBucketUpdatedTime = bucketFilesMap.get(file)

    // Upload file if it's new or has been updated
    if (
      !fileInBucketUpdatedTime ||
      fileMetadata.mtime.getTime() > fileInBucketUpdatedTime
    ) {
      await bucket.upload(filePath, {
        destination: BUCKET_PATH + file,
        metadata: {
          contentType: 'image/png',
        },
      })
      console.log(`Uploaded: ${file}`)
    } else {
      console.log(`File already exists and is up to date: ${file}`)
    }
  }
}

syncIcons()
