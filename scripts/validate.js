const fs = require('fs');

const iconPath = './src/images/icons';

const categories = JSON.parse(fs.readFileSync('./src/categories.json'));

let technologies = {};

for (const index of Array(27).keys()) {
  const charCode = index ? index + 96 : 95;
  const character = String.fromCharCode(charCode);

  const _technologies = JSON.parse(
    fs.readFileSync(`./src/technologies/${character}.json`)
  );

  Object.keys(_technologies).forEach((name) => {
    const _charCode = name.toLowerCase().charCodeAt(0);

    if (charCode !== _charCode) {
      if (_charCode < 97 || _charCode > 122) {
        if (charCode !== 95) {
          throw new Error(
            `${name} should be moved from ./src/technologies/${character}.json to ./src/technologies/_.json`
          );
        }
      } else {
        throw new Error(
          `${name} should be moved from ./src/technologies/${character}.json to ./src/technologies/${String.fromCharCode(
            _charCode
          )}.json`
        );
      }
    }
  });

  technologies = {
    ...technologies,
    ..._technologies
  };
}

// Flatten a pattern field (string, array or nested object, as in `dom`)
// into its leaf patterns, keeping the key path for error messages.
const getPatterns = (value, path = '') => {
  if (typeof value === 'string' || typeof value === 'number') {
    return [{ path, pattern: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      getPatterns(item, `${path}[${index}]`)
    );
  }

  return Object.keys(value).flatMap((key) =>
    getPatterns(value[key], `${path}[${key}]`)
  );
};

// Parse `\\;key:value` flags the same way Wappalyzer.parsePattern does.
const parseFlags = (flags) =>
  flags.map((flag) => {
    const [key, ...value] = flag.split(':');

    return [key, value.join(':')];
  });

const validateConfidence = (value, id) => {
  if (
    !/^\d+$/.test(value) ||
    parseInt(value, 10) < 0 ||
    parseInt(value, 10) > 99
  ) {
    throw new Error(
      `Confidence value must a number between 0 and 99: ${value} (${id})`
    );
  }
};

const validatePattern = (pattern, id, type) => {
  const [regex, ...flags] = pattern.split('\\;');

  let maxGroups = 0;

  parseFlags(flags).forEach(([key, value]) => {
    if (key === 'version') {
      const refs = value.match(/\\(\d+)/g) || [];

      maxGroups = Math.max(0, ...refs.map((ref) => parseInt(ref.slice(1), 10)));
    } else if (key === 'confidence') {
      validateConfidence(value, id);
    } else {
      throw new Error(`Invalid flag: ${key} (${id})`);
    }
  });

  try {
    new RegExp(regex);
  } catch (error) {
    throw new Error(`${error.message} (${id})`);
  }

  // Count capture groups
  const groups = new RegExp(`${regex}|`).exec('').length - 1;

  // A reference to a missing group resolves to an empty version.
  if (groups < maxGroups) {
    console.warn(
      `Version references group ${maxGroups} but pattern has ${groups}: ${regex} (${id})`
    );
  }

  // Unused groups don't affect detection; prefer (?:...) in new patterns.
  if (groups > maxGroups) {
    console.warn(
      `Unused capturing groups, expected at most ${maxGroups}: ${regex} (${id})`
    );
  }

  if (type === 'html' && !/[<>]/.test(regex)) {
    throw new Error(`HTML pattern must include < or >: ${regex} (${id})`);
  }
};

Object.keys(technologies).forEach((name) => {
  const technology = technologies[name];

  // Validate regular expressions
  [
    'certIssuer',
    'cookies',
    'css',
    'dns',
    'dom',
    'headers',
    'html',
    'js',
    'meta',
    'probe',
    'robots',
    'scriptSrc',
    'scripts',
    'text',
    'url',
    'xhr'
  ].forEach((type) => {
    const value = technology[type];

    // String/array `dom` values are CSS selectors, not patterns
    if (
      !value ||
      (type === 'dom' && (typeof value === 'string' || Array.isArray(value)))
    ) {
      return;
    }

    getPatterns(value).forEach(({ path, pattern }) =>
      validatePattern(String(pattern), `${name}: ${type}${path}`, type)
    );
  });

  // Validate categories
  technology.cats.forEach((id) => {
    if (!categories[id]) {
      throw new Error(`No such category: ${id} (${name})`);
    }
  });

  // Validate icons
  if (!technology.icon) {
    console.warn(`Missing icon attribute (${name})`);
  } else {
    if (!/\.(png|svg)$/i.test(technology.icon)) {
      throw new Error(
        `Icon must be a PNG or SVG file: ${technology.icon} (${name})`
      );
    }

    if (!fs.existsSync(`${iconPath}/${technology.icon}`)) {
      throw new Error(`No such icon: ${technology.icon} (${name})`);
    }
  }

  // Validate website URLs
  try {
    const { protocol } = new URL(technology.website);

    if (protocol !== 'http:' && protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch (error) {
    throw new Error(`Invalid website URL: ${technology.website} (${name})`);
  }

  // Validate implies and excludes
  const { implies, excludes } = technology;

  if (implies) {
    (Array.isArray(implies) ? implies : [implies]).forEach((implied) => {
      const [_name, ...flags] = implied.split('\\;');

      const id = `${name}: implies[${implied}]`;

      if (!technologies[_name]) {
        throw new Error(`Implied technology does not exist: ${_name} (${id})`);
      }

      parseFlags(flags).forEach(([key, value]) => {
        if (key === 'confidence') {
          validateConfidence(value, id);
        } else if (key !== 'version') {
          throw new Error(`Invalid flag: ${key} (${id})`);
        }
      });
    });
  }

  if (excludes) {
    (Array.isArray(excludes) ? excludes : [excludes]).forEach((excluded) => {
      const id = `${name}: excludes[${excluded}]`;

      if (!technologies[excluded]) {
        throw new Error(
          `Excluded technology does not exist: ${excluded} (${id})`
        );
      }
    });
  }
});

// Validate icons
fs.readdirSync(iconPath).forEach((file) => {
  const filePath = `${iconPath}/${file}`;

  if (fs.statSync(filePath).isFile() && !file.startsWith('.')) {
    if (!/^(png|svg)$/i.test(file.split('.').pop())) {
      throw new Error(`Incorrect file type, expected PNG or SVG: ${filePath}`);
    }

    if (
      !Object.values(technologies).some(({ icon }) => icon === file) &&
      file !== 'default.svg'
    ) {
      throw new Error(`Extraneous file: ${filePath}`);
    }
  }
});

console.log('Validation completed successfully.');
