/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const { Storage } = require('@google-cloud/storage')

// Configuration
const BUCKET_NAME = 'technology_detections'
const ICONS_DIR = path.resolve(__dirname, '../src/images/icons/converted') // Local directory where your PNG icons are stored

const storage = new Storage({
  keyFilename: '/tmp/gcp_key.json',
})

async function syncIcons() {
  const bucket = storage.bucket(BUCKET_NAME)

  // Get list of files in the bucket
  const [filesInBucket] = await bucket.getFiles()
  const bucketFilesMap = new Map(
    filesInBucket.map((file) => [
      file.name,
      new Date(file.metadata.updated).getTime(),
    ])
  )

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
      try {
        await bucket.upload(filePath, {
          destination: 'icons/' + file,
          metadata: {
            contentType: 'image/png',
          },
        })
        console.log(`Uploaded: ${file}`)
      } catch (err) {
        console.error(`Error uploading file ${file}:`, err)
      }
    } else {
      console.log(`File already exists and is up to date: ${file}`)
    }
  }
}

syncIcons().catch(console.error)
