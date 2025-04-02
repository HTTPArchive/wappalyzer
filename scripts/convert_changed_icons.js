const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { createConverter } = require('convert-svg-to-png')

// const ICONS_DIR = path.join(__dirname, '../src/images/icons')
const TEMP_DIR = path.join(__dirname, '../tmp/icons')

const appPaths = () => {
  const fileDir = path.dirname(require.main.filename).split('/')
  // Remove current bin directory
  fileDir.pop()
  const appDir = fileDir.join('/')

  return {
    basePath: fileDir,
    appPath: appDir,
    iconPath: appDir + '/src/images/icons',
    convertPath: appDir + '/src/images/icons/converted',
  }
}

async function convertChangedIcons() {
  // Get list of changed files from env or from git if not in CI
  let changedIcons

  if (process.env.CHANGED_ICONS) {
    changedIcons = process.env.CHANGED_ICONS.split(' ')
  } else {
    // Get changed files compared to HEAD
    try {
      const output = execSync('git diff --name-only HEAD || git diff --name-only', { encoding: 'utf-8' })
      changedIcons = output.trim().split('\n').filter(Boolean)
    } catch (error) {
      console.error('Error getting changed files:', error)
      changedIcons = []
    }
  }

  // Filter for SVG files only
  changedIcons = changedIcons.filter(
    (file) => file.startsWith('src/images/icons/') && file.endsWith('.svg')
  )

  if (!changedIcons.length) {
    // eslint-disable-next-line no-console
    console.log('No icons changed, skipping conversion')
    return
  }

  // Ensure directory exists
  if (!fs.existsSync(appPaths().convertPath)) {
    fs.mkdirSync(appPaths().convertPath, { recursive: true })
  }

  const converter = createConverter()

  try {
    await Promise.all(changedIcons.map(async (iconPath) => {
      const filename = path.basename(iconPath, '.svg')
      const outputPath = path.join(appPaths().convertPath, `${filename}.png`)

      const svg = fs.readFileSync(iconPath, 'utf8')
      await converter.convert(svg, {
        width: 128,
        height: 128,
        outputFilePath: outputPath,
      })

      // eslint-disable-next-line no-console
      console.log(`Converted ${filename}.svg to PNG`)
    }))
  } finally {
    await converter.destroy()
  }
}

// eslint-disable-next-line no-console
convertChangedIcons().catch(console.error)
