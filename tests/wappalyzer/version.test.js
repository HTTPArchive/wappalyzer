'use strict';

const { Wappalyzer } = require('../helpers/setup');

describe('Wappalyzer.resolveVersion', () => {
  test('extracts version via \\1 back reference', () => {
    const pattern = { version: '\\1', regex: /jquery-([0-9.]+)\.js/i };

    expect(Wappalyzer.resolveVersion(pattern, 'jquery-3.6.0.js')).toBe('3.6.0');
  });

  test('returns empty string when version tag is empty', () => {
    const pattern = { version: '', regex: /wordpress/i };

    expect(Wappalyzer.resolveVersion(pattern, 'wordpress')).toBe('');
  });

  test('handles ternary — match present returns truthy branch', () => {
    const pattern = { version: '\\1?yes:no', regex: /(found)/i };

    expect(Wappalyzer.resolveVersion(pattern, 'found')).toBe('yes');
  });

  test('handles ternary — match absent returns falsy branch', () => {
    const pattern = { version: '\\1?yes:no', regex: /(found)?/i };

    expect(Wappalyzer.resolveVersion(pattern, 'nothing')).toBe('no');
  });

  test('prepends static text to captured version', () => {
    const pattern = { version: 'v\\1', regex: /version[: ]+([0-9.]+)/i };

    expect(Wappalyzer.resolveVersion(pattern, 'version: 2.1')).toBe('v2.1');
  });

  test('skips match longer than 10 chars (cleaned to empty)', () => {
    const pattern = { version: '\\1', regex: /id=([a-z0-9]+)/i };

    // The >10 char guard skips replacement; cleanup strips the unmatched \\1
    expect(Wappalyzer.resolveVersion(pattern, 'id=abcdefghijklmnop')).toBe('');
  });

  test('handles multiple back references', () => {
    const pattern = {
      version: '\\1.\\2',
      regex: /v([0-9]+)\.([0-9]+)/i
    };

    expect(Wappalyzer.resolveVersion(pattern, 'v3.14')).toBe('3.14');
  });

  test('trims whitespace from result', () => {
    const pattern = { version: '\\1', regex: /ver\s+([0-9.]+)\s*/i };

    expect(Wappalyzer.resolveVersion(pattern, 'ver  4.2  ')).toBe('4.2');
  });
});
