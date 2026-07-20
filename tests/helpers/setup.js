'use strict';

const Wappalyzer = require('../../src/js/wappalyzer');

/**
 * Resets all Wappalyzer state to a clean baseline.
 * Call in beforeEach() to ensure test isolation.
 */
function resetWappalyzer() {
  Wappalyzer.categories = [];
  Wappalyzer.technologies = [];
  Wappalyzer.requires = [];
  Wappalyzer.categoryRequires = [];
}

/**
 * Loads a minimal set of categories that cover the most common
 * category IDs used across technology definitions.
 * Call after resetWappalyzer() when tests need category resolution.
 */
function loadDefaultCategories() {
  Wappalyzer.setCategories({
    1: { name: 'CMS', priority: 1, groups: [3] },
    12: { name: 'JavaScript frameworks', priority: 8, groups: [9] },
    18: { name: 'Web frameworks', priority: 7, groups: [9] },
    22: { name: 'Web servers', priority: 8, groups: [7] },
    27: { name: 'Programming languages', priority: 5, groups: [9] },
    59: { name: 'JavaScript libraries', priority: 9, groups: [9] }
  });
}

/**
 * Full environment setup: reset + load default categories.
 * Convenience wrapper for most test suites.
 */
function setupTestEnv() {
  resetWappalyzer();
  loadDefaultCategories();
}

/**
 * Helper to build a minimal parsed technology object
 * suitable for analyzeOneToOne / analyzeOneToMany / analyzeManyToMany.
 *
 * @param {string} name - Technology name
 * @param {string} type - Signal type (e.g. 'url', 'headers', 'scriptSrc')
 * @param {*} patterns - Already-parsed patterns for the given type
 * @returns {object} A minimal technology-like object
 */
function buildTechnology(name, type, patterns) {
  return { name, [type]: patterns };
}

/**
 * Helper to create a parsed pattern object (matching wappalyzer internal format).
 *
 * @param {string|RegExp} regex - The regex to match against
 * @param {object} [opts] - Optional overrides
 * @param {number} [opts.confidence=100]
 * @param {string} [opts.version='']
 * @returns {object} A pattern object
 */
function buildPattern(regex, { confidence = 100, version = '' } = {}) {
  const re = regex instanceof RegExp ? regex : new RegExp(regex, 'i');
  return { regex: re, confidence, version, value: re.source };
}

module.exports = {
  Wappalyzer,
  resetWappalyzer,
  loadDefaultCategories,
  setupTestEnv,
  buildTechnology,
  buildPattern
};
