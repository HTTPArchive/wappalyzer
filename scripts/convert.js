const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const terminalOverwrite = require('terminal-overwrite');

// Fix memoryleak warning
const maxConvertProcesses = 1;
process.setMaxListeners(maxConvertProcesses + 1);

const appPaths = () => {
  const fileDir = path.dirname(require.main.filename).split('/');
  // Remove `scripts` directory
  fileDir.pop();
  const appDir = fileDir.join('/');

  return {
    iconPath: appDir + '/src/images/icons',
    convertPath: appDir + '/src/images/icons/converted'
  };
};

/**
 * Copy files from source to destination.
 * @param source
 * @param destination
 */
function copyFiles(source, destination) {
  fs.copyFileSync(source, destination);
}

/**
 * Get extension of image file.
 * @returns {string}
 */
function getFileExtension(filePath) {
  return path.extname(filePath);
}

/**
 * Get base name of image file.
 * @returns {string}
 */
function getFileName(filePath) {
  return path.basename(filePath, getFileExtension(filePath));
}

function getConvertFileName(filePath) {
  const name = getFileName(filePath);
  return `${appPaths().convertPath}/${name}.png`;
}

/**
 * Check if converted image exists
 * @returns {boolean}
 */
function checkFileExists(imagePath) {
  return fs.existsSync(imagePath);
}

/**
 * Check if path is a file
 * @param {*} filePath
 * @returns
 */
function checkIfFile(filePath) {
  return fs.statSync(filePath).isFile();
}

function dateModified(file) {
  return fs.statSync(file).mtime;
}

function dateDiff(file) {
  const now = new Date().getTime();
  const then = dateModified(file).getTime();
  return Math.round(Math.abs(((then - now) / 1000) * 60 * 60 * 24));
}

/**
 * Convert SVG to PNG
 * @param {string} inputPath
 * @param {string} outputPath
 * @returns {Promise}
 */
async function convertSvgToPng(page, inputPath, outputPath) {
  await page.goto(`file://${inputPath}`);

  await page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '16');
      svg.setAttribute('height', '16');
    }
  });

  const fileElement = await page.waitForSelector('svg');
  await fileElement.screenshot({
    path: outputPath
  });
}

(async () => {
  // Main script
  const files = fs.readdirSync(appPaths().iconPath);
  const totalFiles = files.length;
  const batchNum = Math.ceil(totalFiles / maxConvertProcesses);
  let batchCount = 1;

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Ensure convert directory exists
  if (!fs.existsSync(appPaths().convertPath)) {
    fs.mkdirSync(appPaths().convertPath, { recursive: true });
  }

  do {
    const percentComplete = `${
      100 - Math.round((100 / totalFiles) * files.length)
    }%`;
    terminalOverwrite(
      `Processing Batch: ${batchCount} of ${batchNum} (${percentComplete})`
    );

    await Promise.all(
      files.splice(0, maxConvertProcesses).map(async (fileName) => {
        const filePath = `${appPaths().iconPath}/${fileName}`;
        const outputFilePath = getConvertFileName(fileName);
        const ext = getFileExtension(filePath);

        if (ext === '.svg') {
          // Check if converted file exists.
          if (checkFileExists(outputFilePath)) {
            // Skip if destination file exists and source file hasn't changed in
            // 30 days or destination file was created in the last day
            const fileAgeA = dateDiff(filePath);
            const fileAgeB = dateDiff(outputFilePath);

            if (fileAgeA > 30 || fileAgeB < 1) {
              return;
            }
          }

          // Convert SVG to PNG
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await convertSvgToPng(page, filePath, outputFilePath);
              break;
            } catch (error) {
              if (attempt >= 3) {
                throw new Error(
                  `Failed to convert ${fileName}: ${error.message}`
                );
              } else {
                console.error(
                  `Error converting ${fileName}: ${error.message} (attempt ${attempt})`
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, 500 * attempt)
                );
              }
            }
          }
        } else if (ext === '.png') {
          // If PNG, just copy the file as-is.
          if (checkIfFile(filePath)) {
            copyFiles(filePath, outputFilePath);
          }
        }
      })
    );

    batchCount++;
  } while (files.length);

  await browser.close();

  console.log(`Converted ${totalFiles.toLocaleString()} files.`);
})();
