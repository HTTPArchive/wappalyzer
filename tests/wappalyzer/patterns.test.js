'use strict';

const { Wappalyzer } = require('../helpers/setup');

describe('Wappalyzer.parsePattern', () => {
  test('parses simple string into pattern object', () => {
    const p = Wappalyzer.parsePattern('wordpress');

    expect(p.value).toBe('wordpress');
    expect(p.regex).toBeInstanceOf(RegExp);
    expect(p.confidence).toBe(100);
    expect(p.version).toBe('');
  });

  test('extracts confidence tag', () => {
    const p = Wappalyzer.parsePattern('wp\\;confidence:50');

    expect(p.value).toBe('wp');
    expect(p.confidence).toBe(50);
  });

  test('extracts version tag', () => {
    const p = Wappalyzer.parsePattern('jquery-([0-9.]+)\\.js\\;version:\\1');

    expect(p.version).toBe('\\1');
    expect(p.confidence).toBe(100);
  });

  test('extracts both confidence and version tags', () => {
    const p = Wappalyzer.parsePattern(
      'example-([0-9]+)\\;confidence:75\\;version:\\1'
    );

    expect(p.confidence).toBe(75);
    expect(p.version).toBe('\\1');
  });

  test('handles numeric input', () => {
    const p = Wappalyzer.parsePattern(42);

    expect(p.value).toBe(42);
    expect(p.regex).toBeInstanceOf(RegExp);
  });

  test('recursively parses object patterns', () => {
    const p = Wappalyzer.parsePattern({ exists: '', text: 'hello' });

    expect(p.exists).toBeDefined();
    expect(p.text).toBeDefined();
    expect(p.text.value).toBe('hello');
    expect(p.text.regex).toBeInstanceOf(RegExp);
  });

  test('produces case-insensitive regex', () => {
    const p = Wappalyzer.parsePattern('WordPress');

    expect(p.regex.flags).toContain('i');
    expect(p.regex.test('WORDPRESS')).toBe(true);
  });

  test('optimises unescaped + quantifier to {1,250}', () => {
    const p = Wappalyzer.parsePattern('a+b');

    expect(p.regex.source).toContain('{1,250}');
  });

  test('preserves escaped \\+ literal', () => {
    const p = Wappalyzer.parsePattern('a\\+b');

    expect(p.regex.source).toContain('\\+');
    expect(p.regex.source).not.toContain('{1,250}');
  });

  test('optimises * quantifier to {0,250}', () => {
    const p = Wappalyzer.parsePattern('a*b');

    expect(p.regex.source).toContain('{0,250}');
  });

  test('with isRegex=false produces empty regex', () => {
    const p = Wappalyzer.parsePattern('anything', false);

    expect(p.regex.source).toBe('(?:)');
  });
});

describe('Wappalyzer.transformPatterns', () => {
  test('returns empty array for null/undefined/empty', () => {
    expect(Wappalyzer.transformPatterns(null)).toEqual([]);
    expect(Wappalyzer.transformPatterns(undefined)).toEqual([]);
    expect(Wappalyzer.transformPatterns('')).toEqual([]);
  });

  test('wraps single string into array of one pattern', () => {
    const result = Wappalyzer.transformPatterns('wordpress');

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('wordpress');
  });

  test('transforms array of strings into array of patterns', () => {
    const result = Wappalyzer.transformPatterns(['foo', 'bar']);

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe('foo');
    expect(result[1].value).toBe('bar');
  });

  test('transforms keyed object, lowercasing keys by default', () => {
    const result = Wappalyzer.transformPatterns({
      'X-Powered-By': 'Express'
    });

    expect(result).not.toBeInstanceOf(Array);
    expect(result['x-powered-by']).toBeDefined();
    expect(result['x-powered-by'][0].value).toBe('Express');
  });

  test('preserves key case when caseSensitive=true', () => {
    const result = Wappalyzer.transformPatterns({ MyKey: 'val' }, true);

    expect(result['MyKey']).toBeDefined();
    expect(result['mykey']).toBeUndefined();
  });

  test('transforms number input', () => {
    const result = Wappalyzer.transformPatterns(42);

    expect(Array.isArray(result)).toBe(true);
    expect(result[0].value).toBe(42);
  });

  test('handles object with array values', () => {
    const result = Wappalyzer.transformPatterns({
      generator: ['WordPress', 'Drupal']
    });

    expect(result.generator).toHaveLength(2);
    expect(result.generator[0].value).toBe('WordPress');
    expect(result.generator[1].value).toBe('Drupal');
  });
});
