const assert = require('assert');
const { runWPTTest } = require('./wpt.js');
const { beforeAll, test, describe } = require('@jest/globals');

const hasWptConfig = Boolean(
  process.env.WPT_SERVER &&
  process.env.WPT_API_KEY &&
  !isNaN(parseInt(process.env.PR_NUMBER, 10))
);

const describeWpt = hasWptConfig ? describe : describe.skip;

describeWpt('wappalyzer WPT test', () => {
  const testWebsite = 'https://almanac.httparchive.org/en/2022/';

  let responseData, firstView;
  beforeAll(async () => {
    responseData = await runWPTTest(testWebsite);
    firstView = responseData.runs['1'].firstView;
  }, 400000);

  test('wappalyzer successful', () => {
    assert(
      firstView.wappalyzer_failed === undefined,
      'wappalyzer_failed key is present'
    );
    assert(
      typeof firstView.detected === 'object' &&
        typeof firstView.detected_apps === 'object' &&
        typeof firstView.detected_technologies === 'object',
      'not all technology lists are present'
    );
    assert(
      Object.keys(firstView.detected_technologies).length > 1,
      'number of technologies detected <=1'
    );
  });
});
