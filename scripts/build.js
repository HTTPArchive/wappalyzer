const Zip = require('adm-zip')
const zip = new Zip()

zip.addLocalFolder('./src', '')
zip.writeZip('./build/webextension.zip')
