const assert = require('assert');
const { describe, test, beforeEach } = require('@jest/globals');
const Wappalyzer = require('../src/js/wappalyzer.js');

describe('Wappalyzer hardening and sanitization', () => {
  beforeEach(() => {
    Wappalyzer.technologies = [
      {
        name: 'WordPress',
        slug: 'wordpress',
        categories: [1],
        implies: [],
        excludes: []
      },
      {
        name: 'React',
        slug: 'react',
        categories: [12],
        implies: [],
        excludes: []
      }
    ];

    Wappalyzer.categories = [
      { id: 1, name: 'CMS', priority: 1, slug: 'cms' },
      {
        id: 12,
        name: 'JavaScript libraries',
        priority: 2,
        slug: 'javascript-libraries'
      }
    ];
  });

  describe('resolve', () => {
    test('filters out null, undefined, and empty technology detections', () => {
      const detections = [
        { technology: null },
        { technology: undefined },
        { technology: { name: null } },
        { technology: { name: '' } },
        { technology: { name: '   ' } },
        {
          technology: {
            name: 'WordPress',
            slug: 'wordpress',
            categories: [1]
          },
          pattern: { confidence: 100 }
        }
      ];

      const resolved = Wappalyzer.resolve(detections);
      assert.strictEqual(resolved.length, 1);
      assert.strictEqual(resolved[0].name, 'WordPress');
    });

    test('filters out null or invalid categories in resolved technologies', () => {
      const detections = [
        {
          technology: {
            name: 'CustomTech',
            slug: 'custom-tech',
            categories: [1, 999, null, undefined]
          },
          pattern: { confidence: 100 }
        }
      ];

      const resolved = Wappalyzer.resolve(detections);
      assert.strictEqual(resolved.length, 1);
      assert.strictEqual(resolved[0].categories.length, 1);
      assert.strictEqual(resolved[0].categories[0].name, 'CMS');
    });

    test('handles string and integer category IDs properly', () => {
      assert.strictEqual(Wappalyzer.getCategory('1')?.name, 'CMS');
      assert.strictEqual(Wappalyzer.getCategory(1)?.name, 'CMS');
      assert.strictEqual(Wappalyzer.getCategory(null), null);
      assert.strictEqual(Wappalyzer.getCategory(undefined), null);
    });
  });

  describe('resolveVersion', () => {
    test('strips punctuation-only version strings like ".", "..", and "-beta"', () => {
      const pattern = {
        version: '\\1',
        regex: /jquery[-.]([\w.]+)?/
      };

      assert.strictEqual(Wappalyzer.resolveVersion(pattern, 'jquery-.'), '');
      assert.strictEqual(Wappalyzer.resolveVersion(pattern, 'jquery-..'), '');
    });

    test('trims leading and trailing punctuation from versions', () => {
      const pattern = {
        version: '\\1',
        regex: /app[-.]([\w.]+)/
      };

      assert.strictEqual(Wappalyzer.resolveVersion(pattern, 'app-.2k'), '2k');
      assert.strictEqual(
        Wappalyzer.resolveVersion(pattern, 'app-3.7.1.'),
        '3.7.1'
      );
    });

    test('rejects version strings with HTML markup or invalid characters', () => {
      const pattern = {
        version: '\\1',
        regex: /<script[^>]*version="([^"]+)"/
      };

      assert.strictEqual(
        Wappalyzer.resolveVersion(
          pattern,
          '<script version="<div class="test">"'
        ),
        ''
      );
    });
  });

  describe('resolveImplies and resolveExcludes resilience', () => {
    test('does not throw when an implied technology is missing', () => {
      const resolved = [
        {
          technology: {
            name: 'MysteryTech',
            implies: [{ name: 'NonExistentTech', confidence: 100 }],
            excludes: []
          },
          confidence: 100
        }
      ];

      assert.doesNotThrow(() => {
        Wappalyzer.resolveImplies(resolved);
      });
    });

    test('does not throw when an excluded technology is missing', () => {
      const resolved = [
        {
          technology: {
            name: 'MysteryTech',
            implies: [],
            excludes: [{ name: 'NonExistentTech' }]
          },
          confidence: 100
        }
      ];

      assert.doesNotThrow(() => {
        Wappalyzer.resolveExcludes(resolved);
      });
    });
  });
});
