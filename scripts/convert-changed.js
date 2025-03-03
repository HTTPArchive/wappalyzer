const fs = require('fs');
const path = require('path');
const { createConverter } = require('convert-svg-to-png');

const ICONS_DIR = path.join(__dirname, '../src/images/icons');
const TEMP_DIR = path.join(__dirname, '../tmp/icons');

async function convertChangedIcons() {
  // Get list of changed files from env
  const changedFiles = process.env.CHANGED_FILES?.split(' ') || [];

  // Filter for SVG files only
  const changedIcons = changedFiles.filter(file =>
    file.startsWith('src/images/icons/') && file.endsWith('.svg')
  );

  if (!changedIcons.length) {
    console.log('No icons changed, skipping conversion');
    return;
  }

  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const converter = createConverter();

  try {
    for (const iconPath of changedIcons) {
      const filename = path.basename(iconPath, '.svg');
      const outputPath = path.join(TEMP_DIR, `${filename}.png`);

      const svg = fs.readFileSync(iconPath, 'utf8');
      await converter.convert(svg, {
        width: 128,
        height: 128,
        outputFilePath: outputPath
      });

      console.log(`Converted ${filename}.svg to PNG`);
    }
  } finally {
    await converter.destroy();
  }
}

convertChangedIcons().catch(console.error);
