'use strict';

const { Wappalyzer, setupTestEnv } = require('../helpers/setup');
const { pickTechnologies } = require('../helpers/fixtures');

describe('Wappalyzer.setTechnologies', () => {
  beforeEach(setupTestEnv);

  test('loads technologies into Wappalyzer.technologies', () => {
    Wappalyzer.setTechnologies(pickTechnologies('jQuery'));

    const jq = Wappalyzer.technologies.find((t) => t.name === 'jQuery');
    expect(jq).toBeDefined();
    expect(jq.slug).toBe('jquery');
    expect(jq.categories).toEqual([59]);
  });

  test('assigns default icon when none specified', () => {
    Wappalyzer.setTechnologies(pickTechnologies('PHP'));

    const php = Wappalyzer.technologies.find((t) => t.name === 'PHP');
    expect(php.icon).toBe('default.svg');
  });

  test('preserves explicit icon', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));

    const wp = Wappalyzer.technologies.find((t) => t.name === 'WordPress');
    expect(wp.icon).toBe('WordPress.svg');
  });

  test('separates "requires" techs into Wappalyzer.requires', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP', 'WPTheme'));

    expect(Wappalyzer.requires).toHaveLength(1);
    expect(Wappalyzer.requires[0].name).toBe('WordPress');
    expect(Wappalyzer.requires[0].technologies[0].name).toBe('WPTheme');

    // WPTheme should NOT be in main technologies list
    const inMain = Wappalyzer.technologies.find((t) => t.name === 'WPTheme');
    expect(inMain).toBeUndefined();
  });

  test('separates "requiresCategory" techs into categoryRequires', () => {
    Wappalyzer.setTechnologies(
      pickTechnologies('WordPress', 'PHP', 'ShopPlugin')
    );

    expect(Wappalyzer.categoryRequires).toHaveLength(1);
    expect(Wappalyzer.categoryRequires[0].categoryId).toBe(1);
  });

  test('throws when requires references non-existent technology', () => {
    expect(() => {
      Wappalyzer.setTechnologies({
        Broken: {
          cats: [1],
          requires: 'DoesNotExist',
          website: 'https://example.com'
        }
      });
    }).toThrow(/does not exist/);
  });

  test('transforms implies into structured array', () => {
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP'));

    const wp = Wappalyzer.technologies.find((t) => t.name === 'WordPress');
    expect(wp.implies).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'PHP' })])
    );
  });

  test('transforms excludes into structured array', () => {
    Wappalyzer.setTechnologies(pickTechnologies('Apache', 'Nginx'));

    const apache = Wappalyzer.technologies.find((t) => t.name === 'Apache');
    expect(apache.excludes).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Nginx' })])
    );
  });
});

describe('Wappalyzer.getTechnology', () => {
  beforeEach(() => {
    setupTestEnv();
    Wappalyzer.setTechnologies(pickTechnologies('WordPress', 'PHP', 'WPTheme'));
  });

  test('finds technology in main list', () => {
    const wp = Wappalyzer.getTechnology('WordPress');
    expect(wp).toBeDefined();
    expect(wp.name).toBe('WordPress');
  });

  test('finds technology in requires list', () => {
    const theme = Wappalyzer.getTechnology('WPTheme');
    expect(theme).toBeDefined();
    expect(theme.name).toBe('WPTheme');
  });

  test('returns undefined for unknown technology', () => {
    expect(Wappalyzer.getTechnology('Nonexistent')).toBeUndefined();
  });
});
