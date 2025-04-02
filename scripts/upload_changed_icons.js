const path = require('path')
const fs = require('fs')
const { Storage } = require('@google-cloud/storage')

const TEMP_DIR = path.join(__dirname, '../tmp/icons')
const BUCKET_NAME = 'technology_detections'

async function uploadChangedIcons() {
  // Initialize GCP storage with credentials from GitHub secrets
  const storage = new Storage({
    credentials: JSON.parse(process.env.GCP_SA_KEY),
  })

  const bucket = storage.bucket(BUCKET_NAME)

  // Get all PNGs from temp directory
  const files = fs.readdirSync(TEMP_DIR).filter((file) => file.endsWith('.png'))

  for (const file of files) {
    const filePath = path.join(TEMP_DIR, file)
    await bucket.upload(filePath, {
      destination: `icons/${file}`,
      metadata: {
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    })
    // eslint-disable-next-line no-console
    console.log(`Uploaded ${file} to Cloud Storage`)
  }
}

// eslint-disable-next-line no-console
uploadChangedIcons().catch(console.error)
