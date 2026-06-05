'use strict';

const { Wappalyzer } = require('../helpers/setup');

describe('Wappalyzer.slugify', () => {
  test('converts to lowercase with hyphens', () => {
    expect(Wappalyzer.slugify('WordPress')).toBe('wordpress');
  });

  test('replaces spaces and special chars with hyphens', () => {
    expect(Wappalyzer.slugify('My Cool App')).toBe('my-cool-app');
  });

  test('collapses consecutive hyphens into one', () => {
    expect(Wappalyzer.slugify('a--b---c')).toBe('a-b-c');
  });

  test('strips leading and trailing hyphens', () => {
    expect(Wappalyzer.slugify('-hello-')).toBe('hello');
  });

  test('preserves numbers', () => {
    expect(Wappalyzer.slugify('Vue.js 3')).toBe('vue-js-3');
  });

  test('handles empty string', () => {
    expect(Wappalyzer.slugify('')).toBe('');
  });

  test('handles string with only special characters', () => {
    expect(Wappalyzer.slugify('...')).toBe('');
  });

  test('handles already-slugified input', () => {
    expect(Wappalyzer.slugify('already-good')).toBe('already-good');
  });
});
