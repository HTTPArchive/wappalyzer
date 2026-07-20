'use strict';

const { Wappalyzer, setupTestEnv } = require('../helpers/setup');
const { pickTechnologies } = require('../helpers/fixtures');

describe('Wappalyzer.resolveImplies', () => {
  beforeEach(setupTestEnv);

  test('adds implied technology to resolved list', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const wp = Wappalyzer.getTechnology('WordPress');
    const resolved = [
      { technology: wp, confidence: 100, version: '', lastUrl: '' }
    ];
    Wappalyzer.resolveImplies(resolved);

    expect(resolved).toHaveLength(2);
    expect(resolved[1].technology.name).toBe('PHP');
  });

  test('implied confidence is min of parent and tag', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const wp = Wappalyzer.getTechnology('WordPress');
    const resolved = [
      { technology: wp, confidence: 40, version: '', lastUrl: '' }
    ];
    Wappalyzer.resolveImplies(resolved);

    // WordPress implies PHP at confidence:100, but parent is 40 → min = 40
    expect(resolved[1].confidence).toBeLessThanOrEqual(40);
  });

  test('does not duplicate already-present technology', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));
    const wp = Wappalyzer.getTechnology('WordPress');
    const php = Wappalyzer.getTechnology('PHP');
    const resolved = [
      { technology: wp, confidence: 100, version: '', lastUrl: '' },
      { technology: php, confidence: 100, version: '', lastUrl: '' }
    ];
    Wappalyzer.resolveImplies(resolved);

    expect(resolved).toHaveLength(2);
  });

  test('chains: Express → Node.js', () => {
    Wappalyzer.setTechnologies(pickTechnologies('Express', 'Node.js'));
    const express = Wappalyzer.getTechnology('Express');
    const resolved = [
      { technology: express, confidence: 100, version: '', lastUrl: '' }
    ];
    Wappalyzer.resolveImplies(resolved);

    expect(resolved).toHaveLength(2);
    expect(resolved[1].technology.name).toBe('Node.js');
  });
});

describe('Wappalyzer.resolveExcludes', () => {
  beforeEach(setupTestEnv);

  test('removes excluded technology from resolved', () => {
    Wappalyzer.setTechnologies(pickTechnologies('Apache', 'Nginx'));
    const apache = Wappalyzer.getTechnology('Apache');
    const nginx = Wappalyzer.getTechnology('Nginx');
    const resolved = [
      { technology: apache, confidence: 100, version: '' },
      { technology: nginx, confidence: 100, version: '' }
    ];
    Wappalyzer.resolveExcludes(resolved);

    expect(resolved).toHaveLength(1);
    expect(resolved[0].technology.name).toBe('Apache');
  });

  test('does nothing when excluded tech is absent', () => {
    Wappalyzer.setTechnologies(pickTechnologies('Apache', 'Nginx'));
    const apache = Wappalyzer.getTechnology('Apache');
    const resolved = [{ technology: apache, confidence: 100, version: '' }];
    Wappalyzer.resolveExcludes(resolved);

    expect(resolved).toHaveLength(1);
  });
});

describe('Wappalyzer.resolve', () => {
  beforeEach(setupTestEnv);

  test('aggregates confidence from multiple detections', () => {
    Wappalyzer.setTechnologies(pickTechnologies('jQuery'));
    const tech = Wappalyzer.getTechnology('jQuery');
    const resolved = Wappalyzer.resolve([
      { technology: tech, pattern: { confidence: 50 }, version: '' },
      { technology: tech, pattern: { confidence: 50 }, version: '' }
    ]);

    expect(resolved[0].confidence).toBe(100);
  });

  test('caps confidence at 100', () => {
    Wappalyzer.setTechnologies(pickTechnologies('jQuery'));
    const tech = Wappalyzer.getTechnology('jQuery');
    const resolved = Wappalyzer.resolve([
      { technology: tech, pattern: { confidence: 80 }, version: '' },
      { technology: tech, pattern: { confidence: 80 }, version: '' }
    ]);

    expect(resolved[0].confidence).toBe(100);
  });

  test('selects longest valid version string', () => {
    Wappalyzer.setTechnologies(pickTechnologies('jQuery'));
    const tech = Wappalyzer.getTechnology('jQuery');
    const resolved = Wappalyzer.resolve([
      { technology: tech, pattern: { confidence: 100 }, version: '3' },
      { technology: tech, pattern: { confidence: 100 }, version: '3.6.0' }
    ]);

    expect(resolved[0].version).toBe('3.6.0');
  });

  test('output contains all expected fields', () => {
    Wappalyzer.setTechnologies(pickTechnologies('jQuery'));
    const tech = Wappalyzer.getTechnology('jQuery');
    const resolved = Wappalyzer.resolve([
      { technology: tech, pattern: { confidence: 100 }, version: '1.0' }
    ]);

    expect(resolved[0]).toHaveProperty('name', 'jQuery');
    expect(resolved[0]).toHaveProperty('slug', 'jquery');
    expect(resolved[0]).toHaveProperty('confidence', 100);
    expect(resolved[0]).toHaveProperty('version', '1.0');
    expect(resolved[0]).toHaveProperty('categories');
    expect(resolved[0]).toHaveProperty('icon');
    expect(resolved[0]).toHaveProperty('website');
  });

  test('returns empty array for empty detections', () => {
    expect(Wappalyzer.resolve([])).toEqual([]);
  });
});
