const fs = require('fs');
const path = require('path');

const link = (src, dest) => {
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(dest)) {
    fs.unlinkSync(dest);
  }

  fs.linkSync(src, dest);
};

link('./src/js/wappalyzer.js', './src/drivers/npm/wappalyzer.js');
link('./src/categories.json', './src/drivers/npm/categories.json');

for (const index of Array(27).keys()) {
  const character = index ? String.fromCharCode(index + 96) : '_';

  link(
    `./src/technologies/${character}.json`,
    `./src/drivers/npm/technologies/${character}.json`
  );
}
