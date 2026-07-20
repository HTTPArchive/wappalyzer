'use strict';

const { Wappalyzer, resetWappalyzer } = require('../helpers/setup');
const { categories } = require('../helpers/fixtures');

describe('Wappalyzer.setCategories', () => {
  beforeEach(resetWappalyzer);

  test('parses category IDs as integers', () => {
    Wappalyzer.setCategories({ 1: categories['1'] });

    expect(Wappalyzer.categories).toHaveLength(1);
    expect(Wappalyzer.categories[0].id).toBe(1);
  });

  test('generates slug from category name', () => {
    Wappalyzer.setCategories({ 12: categories['12'] });

    expect(Wappalyzer.categories[0].slug).toBe('javascript-frameworks');
  });

  test('preserves original properties', () => {
    Wappalyzer.setCategories({ 1: categories['1'] });

    const cat = Wappalyzer.categories[0];
    expect(cat.name).toBe('CMS');
    expect(cat.priority).toBe(1);
    expect(cat.groups).toEqual([3]);
  });

  test('sorts categories by priority descending', () => {
    Wappalyzer.setCategories({
      1: categories['1'], // priority 1
      10: categories['10'] // priority 9
    });

    expect(Wappalyzer.categories[0].name).toBe('Analytics');
    expect(Wappalyzer.categories[1].name).toBe('CMS');
  });

  test('handles multiple categories', () => {
    Wappalyzer.setCategories(categories);

    expect(Wappalyzer.categories.length).toBe(Object.keys(categories).length);
  });
});

describe('Wappalyzer.getCategory', () => {
  beforeEach(() => {
    resetWappalyzer();
    Wappalyzer.setCategories(categories);
  });

  test('finds category by numeric ID', () => {
    const cat = Wappalyzer.getCategory(1);
    expect(cat).not.toBeNull();
    expect(cat.name).toBe('CMS');
  });

  test('returns null for non-existent ID', () => {
    expect(Wappalyzer.getCategory(999)).toBeNull();
  });

  test('finds different categories correctly', () => {
    expect(Wappalyzer.getCategory(10).name).toBe('Analytics');
    expect(Wappalyzer.getCategory(22).name).toBe('Web servers');
  });
});
