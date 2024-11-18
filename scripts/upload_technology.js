/* eslint-disable no-console */
// A script to upload technologies and their categories to BigQuery.

const fs = require('fs')
const path = require('path')
const { BigQuery } = require('@google-cloud/bigquery')

const readJsonFiles = (directory) => {
  const files = fs.readdirSync(directory)
  return files.reduce((mergedData, file) => {
    const filePath = path.join(directory, file)
    const data = fs.readFileSync(filePath, 'utf8')
    return { ...mergedData, ...JSON.parse(data) }
  }, {})
}

const getArray = (value) =>
  typeof value === 'string' ? [value] : Array.isArray(value) ? value : []

const getRuleObject = (value) => {
  if (typeof value === 'string') {
    return [{ name: value, value: null }]
  }
  if (Array.isArray(value)) {
    return value.map((key) => ({ name: key, value: null }))
  }
  if (typeof value === 'object') {
    return Object.keys(value).map((key) => ({
      name: key,
      value:
        typeof value[key] === 'object'
          ? JSON.stringify(value[key])
          : value[key].toString(),
    }))
  }
  return []
}

const loadToBigQuery = async (
  data,
  tableName = 'apps',
  datasetName = 'wappalyzer',
  writeDisposition = 'WRITE_TRUNCATE',
  sourceFormat = 'NEWLINE_DELIMITED_JSON'
) => {
  if (!data) {
    throw new Error(`No data to load to \`${datasetName}.${tableName}\`.`)
  }

  const bigquery = new BigQuery({
    keyFilename: '/tmp/gcp_key.json',
  })
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
        name: 'cookies',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      {
        name: 'dom',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      {
        name: 'dns',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      {
        name: 'js',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      {
        name: 'headers',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      { name: 'text', type: 'STRING', mode: 'REPEATED' },
      { name: 'css', type: 'STRING', mode: 'REPEATED' },
      {
        name: 'probe',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      { name: 'robots', type: 'STRING', mode: 'REPEATED' },
      { name: 'url', type: 'STRING', mode: 'REPEATED' },
      { name: 'xhr', type: 'STRING', mode: 'REPEATED' },
      {
        name: 'meta',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: [
          { name: 'name', type: 'STRING' },
          { name: 'value', type: 'STRING' },
        ],
      },
      { name: 'scriptSrc', type: 'STRING', mode: 'REPEATED' },
      { name: 'script', type: 'STRING', mode: 'REPEATED' },
      { name: 'html', type: 'STRING', mode: 'REPEATED' },
    ],
  }

  const options = { schema, sourceFormat, writeDisposition }
  const [job] = await bigquery
    .dataset(datasetName)
    .table(tableName)
    .load(data, options)

  if (job.status.errors && job.status.errors.length > 0) {
    console.error('Errors encountered:', job.status.errors)
    throw new Error('Error loading data into BigQuery')
  }

  console.log(
    `Loaded ${job.numRowsLoaded} rows into ${datasetName}.${tableName}...`
  )
}

const main = async () => {
  const technologies = readJsonFiles('./src/technologies')
  const categories = JSON.parse(
    fs.readFileSync('./src/categories.json', 'utf8')
  )

  const transformedTechnologies = Object.keys(technologies).map((key) => {
    const app = {
      name: key,
      categories: technologies[key].cats.map(
        (category) => categories[category].name
      ),
    }

    ;[
      'implies',
      'requires',
      'requiresCategory',
      'excludes',
      'text',
      'css',
      'robots',
      'url',
      'xhr',
      'scriptSrc',
      'script',
      'html',
    ].forEach((field) => {
      app[field] = getArray(technologies[key][field])
    })
    ;['cookies', 'dom', 'dns', 'js', 'headers', 'probe', 'meta'].forEach(
      (field) => {
        app[field] = getRuleObject(technologies[key][field])
      }
    )
    ;[
      'website',
      'description',
      'icon',
      'cpe',
      'saas',
      'oss',
      'pricing',
    ].forEach((field) => {
      app[field] = technologies[key][field]
    })

    return app
  })

  const transformedTechnologiesJsonL = transformedTechnologies
    .map((line) => JSON.stringify(line))
    .join('\n')
  const filePath = './transformedTechnologies.jsonl'
  fs.writeFileSync(filePath, transformedTechnologiesJsonL)

  await loadToBigQuery(filePath, 'apps')

  // cleanup file
  fs.unlinkSync(filePath)
}

main().catch(console.error)
