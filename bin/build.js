const fs = require('fs')
const Zip = require('adm-zip')

const currentVersion = JSON.parse(
  fs.readFileSync('./src/manifest-v3.json')
).version

version = process.argv[2]

if (!version) {
  // eslint-disable-next-line no-console
  console.warn(
    `No version number specified. Current version is ${currentVersion}: will it use it.`
  )
  version = currentVersion
}

;['./src/drivers/npm/package.json', './src/manifest-v2.json', './src/manifest-v3.json'].forEach((file) => {
  const json = JSON.parse(fs.readFileSync(file))

  json.version = version

  fs.writeFileSync(file, JSON.stringify(json, null, 2))
})

fs.copyFileSync(`./src/manifest.json`, './src/manifest.bak.json')

fs.copyFileSync(`./src/manifest-v2.json`, './src/manifest.json')

let zip = new Zip()

zip.addLocalFolder('./src', '')

zip.writeZip('./build/webextension-v2.zip')

fs.copyFileSync(`./src/manifest-v3.json`, './src/manifest.json')

zip = new Zip()

zip.addLocalFolder('./src', '')

zip.writeZip('./build/webextension-v3.zip')

fs.copyFileSync(`./src/manifest.bak.json`, './src/manifest.json')
