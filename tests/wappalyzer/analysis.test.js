'use strict';

const {
  Wappalyzer,
  setupTestEnv,
  buildTechnology,
  buildPattern
} = require('../helpers/setup');
const { pickTechnologies } = require('../helpers/fixtures');

describe('Wappalyzer.analyzeOneToOne', () => {
  test('detects matching pattern', () => {
    const tech = buildTechnology('Test', 'url', [
      buildPattern(/example\.com/i)
    ]);
    const r = Wappalyzer.analyzeOneToOne(tech, 'url', 'https://example.com');
    expect(r).toHaveLength(1);
    expect(r[0].technology.name).toBe('Test');
  });

  test('returns empty for non-match', () => {
    const tech = buildTechnology('Test', 'url', [buildPattern(/nope/i)]);
    expect(
      Wappalyzer.analyzeOneToOne(tech, 'url', 'https://x.com')
    ).toHaveLength(0);
  });

  test('extracts version', () => {
    const tech = buildTechnology('jQ', 'scriptSrc', [
      buildPattern(/jquery-([0-9.]+)\.js/i, { version: '\\1' })
    ]);
    const r = Wappalyzer.analyzeOneToOne(tech, 'scriptSrc', 'jquery-3.6.0.js');
    expect(r[0].version).toBe('3.6.0');
  });
});

describe('Wappalyzer.analyzeOneToMany', () => {
  test('matches against array of values', () => {
    const tech = buildTechnology('jQ', 'scriptSrc', [buildPattern(/jquery/i)]);
    const r = Wappalyzer.analyzeOneToMany(tech, 'scriptSrc', [
      'react.js',
      'jquery.min.js'
    ]);
    expect(r).toHaveLength(1);
  });

  test('returns empty for no matches', () => {
    const tech = buildTechnology('T', 'scriptSrc', [buildPattern(/nope/i)]);
    expect(
      Wappalyzer.analyzeOneToMany(tech, 'scriptSrc', ['a.js'])
    ).toHaveLength(0);
  });

  test('handles empty items', () => {
    const tech = buildTechnology('T', 'scriptSrc', [buildPattern(/x/i)]);
    expect(Wappalyzer.analyzeOneToMany(tech, 'scriptSrc', [])).toEqual([]);
  });
});

describe('Wappalyzer.analyzeManyToMany', () => {
  test('matches keyed patterns against keyed values', () => {
    const tech = buildTechnology('WP', 'headers', {
      'x-powered-by': [buildPattern(/wordpress/i)]
    });
    const r = Wappalyzer.analyzeManyToMany(tech, 'headers', {
      'x-powered-by': ['WordPress 5.9']
    });
    expect(r).toHaveLength(1);
  });

  test('returns empty when key missing from items', () => {
    const tech = buildTechnology('T', 'headers', {
      'x-custom': [buildPattern(/val/i)]
    });
    expect(Wappalyzer.analyzeManyToMany(tech, 'headers', {})).toHaveLength(0);
  });
});

describe('Wappalyzer.analyze (full pipeline)', () => {
  beforeEach(setupTestEnv);

  test('detects from URL pattern', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const d = Wappalyzer.analyze({ url: 'https://my.wordpress.com/blog' });
    expect(d.length).toBeGreaterThanOrEqual(1);
  });

  test('detects from meta generator with version', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const d = Wappalyzer.analyze({ meta: { generator: ['WordPress 6.2'] } });
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0].version).toBe('6.2');
  });

  test('detects from headers', () => {
    Wappalyzer.setTechnologies(pickTechnologies('Express', 'Node.js'));
    const d = Wappalyzer.analyze({ headers: { 'x-powered-by': ['Express'] } });
    expect(d.length).toBeGreaterThanOrEqual(1);
  });

  test('detects from cookies', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const d = Wappalyzer.analyze({ cookies: { wp_lang: ['en_US'] } });
    expect(d.length).toBeGreaterThanOrEqual(1);
  });

  test('returns empty for no matches', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    expect(Wappalyzer.analyze({ url: 'https://example.com' })).toHaveLength(0);
  });
});
