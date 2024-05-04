// Original Wappalyser Chrome extension https://chrome.google.com/webstore/detail/gppongmhjkpfnbhagpmjfkannfbllamg
const https = require('https')
const fs = require('fs')
const { exec } = require('child_process')

const extensionId = 'gppongmhjkpfnbhagpmjfkannfbllamg'
const url = `https://clients2.google.com/service/update2/crx?response=redirect&os=mac&arch=x86-64&nacl_arch=x86-64&prod=chromecrx&prodchannel=stable&prodversion=44.0.2403.130&x=id%3D${extensionId}%26uc&acceptformat=crx3`
const zipFileName = `${extensionId}.zip`
const tempDir = `src_${extensionId}`

// Download Chrome extension
const downloadExtension = (url, dest) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const request = https.get(url, (response) => {
      if (
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        console.log('Redirecting to', response.headers.location)
        downloadExtension(response.headers.location, dest)
          .then(resolve)
          .catch(reject)
      } else if (response.statusCode === 200) {
        response.pipe(file)
        file.on('finish', () => {
          console.log('Download completed')
          file.close(resolve)
        })
      } else {
        file.close()
        fs.unlink(dest, () => {
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`))
        })
      }
    })
    request.on('error', (error) => {
      fs.unlink(dest, () => reject(error))
    })
  })
}

const unzipExtension = (zipFile, dest) => {
  return new Promise((resolve, reject) => {
    try {
      exec(`unzip -o ${zipFile} -d ${dest}`, (error) => {
        if (error) {
          resolve()
        } else {
          resolve()
        }
      })
    } catch (error) {
      console.log(error)
    }
  })
}

const removeZipFile = (file) => {
  return new Promise((resolve, reject) => {
    fs.unlink(file, (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

const copyFiles = () => {
  return Promise.all([
    exec(`cp -f ${tempDir}/technologies/* src/technologies/`),
    exec(`cp -f ${tempDir}/categories.json src/categories.json`),
    exec(`cp -f ${tempDir}/groups.json src/groups.json`),
  ])
}

// Main function
const main = async () => {
  try {
    await downloadExtension(url, zipFileName)
    console.log('Unzipping Chrome extension...')

    await unzipExtension(zipFileName, tempDir)

    console.log('Removing downloaded zip file...')
    await removeZipFile(zipFileName)

    await copyFiles()
    console.log('Chrome extension downloaded and files copied successfully.')
  } catch (error) {
    console.error('An error occurred:', error)
    process.exit(1)
  }

  process.exit(0)
}

main()
