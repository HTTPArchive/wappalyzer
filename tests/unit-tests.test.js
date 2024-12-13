const assert = require('assert')
const { runWPTTest } = require('./wpt.js')
const testWebsite = 'https://almanac.httparchive.org/en/2022/'

let responseData, firstView
beforeAll(async () => {
  responseData = await runWPTTest(testWebsite)
  firstView = responseData.runs['1'].firstView
}, 400000)

test('wappalyzer successful', () => {
  assert(
    firstView.wappalyzer_failed === undefined,
    'wappalyzer_failed key is present'
  )
  assert(
    typeof firstView.detected === 'object' &&
      typeof firstView.detected_apps === 'object' &&
      typeof firstView.detected_technologies === 'object',
    'not all technology lists are present'
  )
  assert(
    Object.keys(firstView.detected_technologies).length > 1,
    'number of technologies detected <=1'
  )
})
