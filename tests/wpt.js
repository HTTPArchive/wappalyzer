const fs = require('fs')
const { argv } = require('node:process')
const WebPageTest = require('webpagetest')

const isDirectRun = require.main === module

const wptServer = process.env.WPT_SERVER
const wptApiKey = process.env.WPT_API_KEY
const prNumber = 35 // parseInt(process.env.PR_NUMBER)
const wpt = new WebPageTest(wptServer, wptApiKey)

/**
 * Runs a WebPageTest (WPT) test for a given URL.
 *
 * @param {string} url - The URL to run the test on.
 * @returns {Promise<object>} A promise that resolves with a test result JSON.
 * @throws {Error} If the test run fails or the response status code is not 200.
 */
function runWPTTest(url) {
  const options = { key: wptApiKey, wappalyzerPR: prNumber }

  return new Promise((resolve, reject) => {
    wpt.runTestAndWait(url, options, (error, response) => {
      if (error || response.statusCode !== 200) {
        console.error(`WPT test run for ${url} failed:`)
        console.error(error || response)
        reject(error || response)
      } else {
        const technologies = {
          detected: response.data.runs['1'].firstView.detected,
          detected_apps: response.data.runs['1'].firstView.detected_apps,
          detected_technologies:
            response.data.runs['1'].firstView.detected_technologies,
          detected_raw: response.data.runs['1'].firstView.detected_raw,
        }

        fs.appendFileSync(
          'test-results.md',
          `<details>
<summary><strong>WPT test run for ${url}</strong></summary>

WPT test run results: ${response.data.summary}
Detected technologies:
\`\`\`json
${JSON.stringify(technologies, null, 4)}
\`\`\`
</details>\n\n`
        )

        resolve(response.data)
      }
    })
  })
}

if (isDirectRun) {
  const url = argv[2]
  runWPTTest(url)
}

module.exports = { runWPTTest }
