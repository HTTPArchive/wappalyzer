'use strict';

/**
 * Reusable technology definitions for tests.
 * Each fixture is a plain object matching the raw JSON schema
 * (pre-setTechnologies format).
 */

const technologies = {
  WordPress: {
    cats: [1],
    description: 'A content management system.',
    icon: 'WordPress.svg',
    meta: { generator: 'WordPress\\s([\\d.]+)\\;version:\\1' },
    cookies: { wp_lang: '' },
    implies: 'PHP',
    url: 'wordpress\\.com',
    website: 'https://wordpress.org'
  },

  PHP: {
    cats: [27],
    headers: { 'X-Powered-By': 'php/([\\d.]+)\\;version:\\1' },
    website: 'https://php.net'
  },

  jQuery: {
    cats: [59],
    js: { 'jQuery.fn.jquery': '' },
    scriptSrc: 'jquery-([0-9.]+)\\.js\\;version:\\1',
    website: 'https://jquery.com'
  },

  Express: {
    cats: [18],
    headers: { 'X-Powered-By': 'Express' },
    implies: 'Node.js',
    website: 'https://expressjs.com'
  },

  'Node.js': {
    cats: [27],
    website: 'https://nodejs.org'
  },

  Apache: {
    cats: [22],
    excludes: 'Nginx',
    headers: { Server: 'Apache' },
    website: 'https://httpd.apache.org'
  },

  Nginx: {
    cats: [22],
    excludes: 'Apache',
    headers: { Server: 'Nginx' },
    website: 'https://nginx.org'
  },

  // Technology that requires another technology
  WPTheme: {
    cats: [1],
    requires: 'WordPress',
    dom: { 'link[href*="themes/flavor"]': { exists: '' } },
    website: 'https://flavor.dev'
  },

  // Technology that requires a category
  ShopPlugin: {
    cats: [1],
    requiresCategory: 1,
    website: 'https://shop-plugin.example.com'
  }
};

/**
 * Sample category definitions matching src/categories.json structure.
 */
const categories = {
  1: { name: 'CMS', priority: 1, groups: [3] },
  10: { name: 'Analytics', priority: 9, groups: [8] },
  12: { name: 'JavaScript frameworks', priority: 8, groups: [9] },
  18: { name: 'Web frameworks', priority: 7, groups: [9] },
  22: { name: 'Web servers', priority: 8, groups: [7] },
  27: { name: 'Programming languages', priority: 5, groups: [9] },
  59: { name: 'JavaScript libraries', priority: 9, groups: [9] }
};

/**
 * Pick a subset of technologies by name.
 * @param {...string} names
 * @returns {object} Filtered technologies map
 */
function pickTechnologies(...names) {
  return names.reduce((acc, name) => {
    if (!technologies[name]) {
      throw new Error(`Fixture technology "${name}" not found`);
    }
    acc[name] = technologies[name];
    return acc;
  }, {});
}

module.exports = {
  technologies,
  categories,
  pickTechnologies
};
