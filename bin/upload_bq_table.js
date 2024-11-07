/* eslint-disable no-console */
// A script to upload technologies and their groups and categories to BigQuery.

const fs = require('fs')
const path = require('path')
const { BigQuery } = require('@google-cloud/bigquery')

function readJsonFiles(directory) {
  const files = fs.readdirSync(directory)
  let mergedData = {}
  files.forEach((file) => {
    const filePath = path.join(directory, file)
    const data = fs.readFileSync(filePath, 'utf8')
    const jsonData = JSON.parse(data)
    mergedData = { ...mergedData, ...jsonData }
  })
  return mergedData
}

function getString(value) {
  try {
    return value
  } catch (error) {
    return null
  }
}

function getArray(value) {
  if (typeof value === 'string') {
    return [value]
  } else if (Array.isArray(value)) {
    return value
  } else {
    return []
  }
}

function getRuleObject(value) {
  if (typeof value === 'string') {
    return {
      name: value,
      value: null,
    }
  } else if (Array.isArray(value)) {
    return value.map((key) => {
      return {
        name: key,
        value: null,
      }
    })
  } else if (typeof value === 'object') {
    return Object.keys(value).map((key) => {
      return {
        name: key,
        value: typeof value[key] === 'object' ? JSON.stringify(value[key]) : value[key].toString(),
      }
    })
  } else {
    return []
  }
}

async function loadToBigQuery(
  data,
  tableName,
  datasetName = 'wappalyzer',
  writeDisposition = 'WRITE_TRUNCATE',
  sourceFormat = 'NEWLINE_DELIMITED_JSON'
) {
  try {
    if (!data) {
      throw new Error(`No data to load from \`${datasetName}.${tableName}\`.`)
    }

    const datasetDestination = `${datasetName}`
    const tableDestination = `${datasetDestination}.${tableName}`

    const bigquery = new BigQuery()

    const schema = {
      fields: [
        { name: 'name', type: 'STRING' },
        { name: 'categories', type: 'STRING', mode: 'REPEATED' },
        { name: 'website', type: 'STRING' },
        { name: 'description', type: 'STRING' },
        { name: 'icon', type: 'STRING' },
        { name: 'cpe', type: 'STRING' },
        { name: 'saas', type: 'BOOLEAN' },
        { name: 'oss', type: 'BOOLEAN' },
        { name: 'pricing', type: 'STRING', mode: 'REPEATED' },
        { name: 'implies', type: 'STRING', mode: 'REPEATED' },
        { name: 'requires', type: 'STRING', mode: 'REPEATED' },
        { name: 'requiresCategory', type: 'STRING', mode: 'REPEATED' },
        { name: 'excludes', type: 'STRING', mode: 'REPEATED' },
        {
          name: 'cookies', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        {
          name: 'dom', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        {
          name: 'dns', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        {
          name: 'js', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        {
          name: 'headers', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        { name: 'text', type: 'STRING', mode: 'REPEATED' },
        { name: 'css', type: 'STRING', mode: 'REPEATED' },
        {
          name: 'probe', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        { name: 'robots', type: 'STRING', mode: 'REPEATED' },
        { name: 'url', type: 'STRING', mode: 'REPEATED' },
        { name: 'xhr', type: 'STRING', mode: 'REPEATED' },
        {
          name: 'meta', type: 'RECORD', mode: 'REPEATED', fields: [
            { name: 'name', type: 'STRING' },
            { name: 'value', type: 'STRING' }
          ]
        },
        { name: 'scriptSrc', type: 'STRING', mode: 'REPEATED' },
        { name: 'script', type: 'STRING', mode: 'REPEATED' },
        { name: 'html', type: 'STRING', mode: 'REPEATED' }
      ]
    }

    const options = {
      schema,
      sourceFormat,
      writeDisposition,
    }

    const [job] = await bigquery
      .dataset(datasetDestination)
      .table(tableName)
      .load(data, options)

    if (job.status.errors && job.status.errors.length > 0) {
      console.error('Errors encountered:', job.status.errors)
      throw new Error('Error loading data into BigQuery')
    }

    console.log(`Loaded ${job.numRowsLoaded} rows into ${tableDestination}...`)
  } catch (err) {
    console.error('Error loading data into BigQuery:', err)
    throw err
  }
}

async function main() {
  const technologies = await readJsonFiles('./src/technologies')
  const categories = JSON.parse(
    fs.readFileSync('./src/categories.json', 'utf8')
  )

  const transformedTechnologies = Object.keys(technologies).map((key) => {
    const app = {}
    app.name = key
    app.categories = technologies[key].cats.map(
      (category) => categories[category].name
    )
    app.website = technologies[key].website
    app.description = technologies[key].description
    app.icon = technologies[key].icon
    app.cpe = technologies[key].cpe
    app.saas = technologies[key].saas
    app.oss = technologies[key].oss
    app.pricing = technologies[key].pricing

    app.implies = getArray(technologies[key].implies)
    app.requires = getArray(technologies[key].requires)
    app.requiresCategory = getArray(technologies[key].requiresCategory)
    app.excludes = getArray(technologies[key].excludes)

    app.cookies = getRuleObject(technologies[key].cookies)
    app.dom = getRuleObject(technologies[key].dom)
    app.dns = getRuleObject(technologies[key].dns)
    app.js = getRuleObject(technologies[key].js)
    app.headers = getRuleObject(technologies[key].headers)
    app.text = getArray(technologies[key].text)
    app.css = getArray(technologies[key].css)
    app.probe = getRuleObject(technologies[key].probe)
    app.robots = getArray(technologies[key].robots)
    app.url = getArray(technologies[key].url)
    app.xhr = getArray(technologies[key].xhr)
    app.meta = getRuleObject(technologies[key].meta)
    app.scriptSrc = getArray(technologies[key].scriptSrc)
    app.script = getArray(technologies[key].script)
    app.html = getArray(technologies[key].html)

    return app
  })

  let transformedTechnologiesJsonL = transformedTechnologies.map((line) =>
    JSON.stringify(line)
  )
  transformedTechnologiesJsonL = transformedTechnologiesJsonL.join('\n')
  const filePath = './transformedTechnologies.jsonl'
  fs.writeFileSync(filePath, transformedTechnologiesJsonL)

  await loadToBigQuery(filePath, 'apps_current')

  // cleanup file
  fs.unlinkSync(filePath)
}

main().catch(console.error)
