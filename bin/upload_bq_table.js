// A script to upload technologies and their groups and categories to BigQuery.

const fs = require('fs');
const path = require('path');
const { BigQuery } = require('@google-cloud/bigquery');

GCP_PROJECT = 'httparchive';

async function readJsonFiles(directory) {
  const files = fs.readdirSync(directory);
  let mergedData = {};
  files.forEach(file => {
    const filePath = path.join(directory, file);
    const data = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    mergedData = { ...mergedData, ...jsonData };
  });
  return mergedData;
}

function getString(value) {
  return {
    name: value,
    value: null,
  };
}

function getArray(value) {
  if (typeof value === 'string') {
    getString(value);
  } else if (typeof value === 'Array') {
    return value.map(key => {
      return {
        name: key,
        value: null,
      }
    })
  } else {
    return null;
  }
}

function getRuleObject(value) {
  if (typeof value === 'string') {
    getString(value);
  } else if (typeof value === 'Array') {
    return getArray(value);
  } else if (typeof value === 'object') {
    return Object.keys(value).map(key => {
      return {
        name: key,
        value: value[key],
      };
    });
  } else {
    return null;
  }
}

async function loadToBigQuery(data, tableName, datasetName = 'wappalyzer', writeDisposition = 'WRITE_TRUNCATE', sourceFormat = 'NEWLINE_DELIMITED_JSON') {
  try {
    if (!data) {
      throw new Error(`No data to load from \`${datasetName}.${tableName}\`.`);
    }

    const datasetDestination = `${datasetName}`;
    const tableDestination = `${datasetDestination}.${tableName}`;

    const bigquery = new BigQuery();

    const options = {
      autodetect: true,
      sourceFormat: sourceFormat,
      writeDisposition: writeDisposition,
    };

    const [job] = await bigquery
      .dataset(datasetDestination)
      .table(tableName)
      .load(data, options);

    if (job.status.errors && job.status.errors.length > 0) {
      console.error('Errors encountered:', job.status.errors);
      throw new Error('Error loading data into BigQuery');
    }

    console.log(`Loaded ${job.numRowsLoaded} rows into ${tableDestination}...`);
  } catch (err) {
    console.error('Error loading data into BigQuery:', err);
    throw err;
  }
}

async function main() {
  const technologies = await readJsonFiles('./src/technologies');
  const categories = JSON.parse(fs.readFileSync('./src/categories.json', 'utf8'));

  transformedTechnologies = Object.keys(technologies).map(key => {
    let app = {}
    app.name = key;
    app.cats = technologies[key].cats.map(category => categories[category].name);

    app.website = technologies[key].website;
    app.description = technologies[key].description;
    app.cpe = technologies[key].cpe;

    app.headers = getRuleObject(technologies[key].headers);
    app.xhr = getRuleObject(technologies[key].xhr);
    app.scriptSrc = getRuleObject(technologies[key].scriptSrc);

    return app;
  });

  let transformedTechnologiesJsonL = transformedTechnologies.map(line => JSON.stringify(line))
  transformedTechnologiesJsonL = transformedTechnologiesJsonL.join("\n");
  const filePath = './transformedTechnologies.jsonl';
  fs.writeFileSync(filePath, transformedTechnologiesJsonL);

  await loadToBigQuery(filePath, 'apps',);

  // cleanup file
  fs.unlinkSync(filePath);
}

main().catch(console.error);
