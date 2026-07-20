const fs = require('fs');
const dns = require('dns').promises;
const path = require('path');
const http = require('http');
const https = require('https');
const puppeteer = require('puppeteer');
const Wappalyzer = require('../js/wappalyzer');

const { setTechnologies, setCategories, analyze, analyzeManyToMany, resolve } =
  Wappalyzer;

const { CHROMIUM_BIN, CHROMIUM_DATA_DIR, CHROMIUM_WEBSOCKET, CHROMIUM_ARGS } =
  process.env;

const chromiumArgs = CHROMIUM_ARGS
  ? CHROMIUM_ARGS.split(' ')
  : [
      '--headless',
      '--single-process',
      '--no-sandbox',
      '--no-zygote',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--allow-running-insecure-content',
      '--disable-web-security',
      `--user-data-dir=${CHROMIUM_DATA_DIR || '/tmp/chromium'}`
    ];

const extensions = /^([^.]+$|\.(asp|aspx|cgi|htm|html|jsp|php)$)/;

const categoriesPath = path.resolve(`${__dirname}/../categories.json`);

const categories = JSON.parse(fs.readFileSync(categoriesPath));

let technologies = {};

const technologiesDir = path.resolve(`${__dirname}/../technologies`);

for (const index of Array(27).keys()) {
  const character = index ? String.fromCharCode(index + 96) : '_';

  technologies = {
    ...technologies,
    ...JSON.parse(
      fs.readFileSync(path.resolve(`${technologiesDir}/${character}.json`))
    )
  };
}

setTechnologies(technologies);
setCategories(categories);

const xhrDebounce = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getJs(page, technologies = Wappalyzer.technologies) {
  return page.evaluate((technologies) => {
    return technologies
      .filter(({ js }) => Object.keys(js).length)
      .map(({ name, js }) => ({ name, chains: Object.keys(js) }))
      .reduce((technologies, { name, chains }) => {
        chains.forEach((chain) => {
          chain = chain.replace(/\[([^\]]+)\]/g, '.$1');

          const parts = chain.split('.');

          const root = /^[a-z_$][a-z0-9_$]*$/i.test(parts[0])
            ? new Function(
                `return typeof ${
                  parts[0]
                } === 'undefined' ? undefined : ${parts.shift()}`
              )()
            : window;

          const value = parts.reduce(
            (value, method) =>
              value &&
              value instanceof Object &&
              Object.prototype.hasOwnProperty.call(value, method)
                ? value[method]
                : '__UNDEFINED__',
            root || '__UNDEFINED__'
          );

          if (value !== '__UNDEFINED__') {
            technologies.push({
              name,
              chain,
              value:
                typeof value === 'string' || typeof value === 'number'
                  ? value
                  : !!value
            });
          }
        });

        return technologies;
      }, []);
  }, technologies);
}

function analyzeJs(js, technologies = Wappalyzer.technologies) {
  return js
    .map(({ name, chain, value }) => {
      return analyzeManyToMany(
        technologies.find(({ name: _name }) => name === _name),
        'js',
        { [chain]: [value] }
      );
    })
    .flat();
}

function getDom(page, technologies = Wappalyzer.technologies) {
  return page.evaluate((technologies) => {
    return technologies
      .filter(({ dom }) => dom && dom.constructor === Object)
      .reduce((technologies, { name, dom }) => {
        const toScalar = (value) =>
          typeof value === 'string' || typeof value === 'number'
            ? value
            : !!value;

        Object.keys(dom).forEach((selector) => {
          let nodes = [];

          try {
            nodes = document.querySelectorAll(selector);
          } catch (error) {
            // Continue
          }

          if (!nodes.length) {
            return;
          }

          dom[selector].forEach(({ exists, text, properties, attributes }) => {
            nodes.forEach((node) => {
              if (
                technologies.filter(({ name: _name }) => _name === name)
                  .length >= 50
              ) {
                return;
              }

              if (
                exists &&
                technologies.findIndex(
                  ({ name: _name, selector: _selector, exists }) =>
                    name === _name && selector === _selector && exists === ''
                ) === -1
              ) {
                technologies.push({
                  name,
                  selector,
                  exists: ''
                });
              }

              if (text) {
                const value = (
                  node.textContent ? node.textContent.trim() : ''
                ).slice(0, 1000000);

                if (
                  value &&
                  technologies.findIndex(
                    ({ name: _name, selector: _selector, text }) =>
                      name === _name && selector === _selector && text === value
                  ) === -1
                ) {
                  technologies.push({
                    name,
                    selector,
                    text: value
                  });
                }
              }

              if (properties) {
                Object.keys(properties).forEach((property) => {
                  if (
                    Object.prototype.hasOwnProperty.call(node, property) &&
                    technologies.findIndex(
                      ({
                        name: _name,
                        selector: _selector,
                        property: _property,
                        value
                      }) =>
                        name === _name &&
                        selector === _selector &&
                        property === _property &&
                        value === toScalar(value)
                    ) === -1
                  ) {
                    const value = node[property];

                    if (typeof value !== 'undefined') {
                      technologies.push({
                        name,
                        selector,
                        property,
                        value: toScalar(value)
                      });
                    }
                  }
                });
              }

              if (attributes) {
                Object.keys(attributes).forEach((attribute) => {
                  if (
                    node.hasAttribute(attribute) &&
                    technologies.findIndex(
                      ({
                        name: _name,
                        selector: _selector,
                        attribute: _atrribute,
                        value
                      }) =>
                        name === _name &&
                        selector === _selector &&
                        attribute === _atrribute &&
                        value === toScalar(value)
                    ) === -1
                  ) {
                    const value = node.getAttribute(attribute);

                    technologies.push({
                      name,
                      selector,
                      attribute,
                      value: toScalar(value)
                    });
                  }
                });
              }
            });
          });
        });

        return technologies;
      }, []);
  }, technologies);
}

function analyzeDom(dom, technologies = Wappalyzer.technologies) {
  return dom
    .map(({ name, selector, exists, text, property, attribute, value }) => {
      const technology = technologies.find(({ name: _name }) => name === _name);

      if (typeof exists !== 'undefined') {
        return analyzeManyToMany(technology, 'dom.exists', {
          [selector]: ['']
        });
      }

      if (typeof text !== 'undefined') {
        return analyzeManyToMany(technology, 'dom.text', {
          [selector]: [text]
        });
      }

      if (typeof property !== 'undefined') {
        return analyzeManyToMany(technology, `dom.properties.${property}`, {
          [selector]: [value]
        });
      }

      if (typeof attribute !== 'undefined') {
        return analyzeManyToMany(technology, `dom.attributes.${attribute}`, {
          [selector]: [value]
        });
      }
    })
    .flat();
}

function get(url, options = {}) {
  const timeout =
    options.timeout ||
    (this.options.fast
      ? this.Math.min(this.options.maxWait, 3000)
      : this.options.maxWait);

  if (['http:', 'https:'].includes(url.protocol)) {
    const { get } = url.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) =>
      get(
        url,
        {
          rejectUnauthorized: false,
          headers: {
            'User-Agent': options.userAgent
          }
        },
        (response) => {
          if (response.statusCode >= 300) {
            return reject(
              new Error(`${response.statusCode} ${response.statusMessage}`)
            );
          }

          response.setEncoding('utf8');

          let body = '';

          response.on('data', (data) => (body += data));
          response.on('error', (error) => reject(new Error(error.message)));
          response.on('end', () => resolve(body));
        }
      )
        .setTimeout(timeout, () =>
          reject(new Error(`Timeout (${url}, ${timeout}ms)`))
        )
        .on('error', (error) => reject(new Error(error.message)))
    );
  } else {
    throw new Error(`Invalid protocol: ${url.protocol}`);
  }
}

class Driver {
  constructor(options = {}) {
    this.options = {
      batchSize: 5,
      debug: false,
      delay: 500,
      htmlMaxCols: 2000,
      htmlMaxRows: 3000,
      maxDepth: 3,
      maxUrls: 10,
      maxWait: 30000,
      recursive: false,
      probe: false,
      proxy: false,
      noScripts: false,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.97 Safari/537.36',
      extended: false,
      ...options
    };

    this.options.debug = Boolean(+this.options.debug);
    this.options.fast = Boolean(+this.options.fast);
    this.options.recursive = Boolean(+this.options.recursive);
    this.options.probe =
      String(this.options.probe || '').toLowerCase() === 'basic'
        ? 'basic'
        : String(this.options.probe || '').toLowerCase() === 'full'
          ? 'full'
          : Boolean(+this.options.probe) && 'full';
    this.options.delay = parseInt(this.options.delay, 10);
    this.options.maxDepth = parseInt(this.options.maxDepth, 10);
    this.options.maxUrls = parseInt(this.options.maxUrls, 10);
    this.options.maxWait = parseInt(this.options.maxWait, 10);
    this.options.htmlMaxCols = parseInt(this.options.htmlMaxCols, 10);
    this.options.htmlMaxRows = parseInt(this.options.htmlMaxRows, 10);
    this.options.noScripts = Boolean(+this.options.noScripts);
    this.options.extended = Boolean(+this.options.extended);

    if (this.options.proxy) {
      chromiumArgs.push(`--proxy-server=${this.options.proxy}`);
    }

    this.destroyed = false;
  }

  async init() {
    for (let attempt = 1; attempt <= 2; attempt++) {
      this.log(`Launching browser (attempt ${attempt})...`);

      try {
        if (CHROMIUM_WEBSOCKET) {
          this.browser = await puppeteer.connect({
            ignoreHTTPSErrors: true,
            acceptInsecureCerts: true,
            browserWSEndpoint: CHROMIUM_WEBSOCKET
          });
        } else {
          this.browser = await puppeteer.launch({
            ignoreHTTPSErrors: true,
            acceptInsecureCerts: true,
            args: chromiumArgs,
            executablePath: CHROMIUM_BIN,
            timeout: this.options.fast
              ? Math.min(this.options.maxWait, 10000)
              : this.options.maxWait
          });
        }

        break;
      } catch (error) {
        this.log(error);

        if (attempt >= 2) {
          throw new Error(error.message || error.toString());
        }
      }
    }

    this.browser.on('disconnected', () => {
      this.browser = undefined;

      this.log('Browser disconnected');
    });
  }

  async destroy() {
    if (this.browser) {
      try {
        await sleep(1);

        await this.browser.close();

        this.log('Browser closed');
      } catch (error) {
        throw new Error(error.toString());
      }
    }
  }

  async open(url, headers = {}, storage = {}) {
    const site = new Site(url.split('#')[0], headers, this);

    if (storage.local || storage.session) {
      this.log('Setting storage...');

      const page = await site.newPage(site.originalUrl);

      await page.setRequestInterception(true);

      page.on('request', (request) =>
        request.respond({
          status: 200,
          contentType: 'text/plain',
          body: 'ok'
        })
      );

      await page.goto(url);

      await page.evaluate((storage) => {
        ['local', 'session'].forEach((type) => {
          Object.keys(storage[type] || {}).forEach((key) => {
            window[`${type}Storage`].setItem(key, storage[type][key]);
          });
        });
      }, storage);

      try {
        await page.close();
      } catch {
        // Continue
      }
    }

    return site;
  }

  log(message, source = 'driver') {
    if (this.options.debug) {
      console.log(`log | ${source} |`, message);
    }
  }
}

class Site {
  constructor(url, headers = {}, driver) {
    ({
      options: this.options,
      browser: this.browser,
      init: this.initDriver
    } = driver);

    this.options.headers = {
      ...this.options.headers,
      ...headers
    };

    this.driver = driver;

    try {
      this.originalUrl = new URL(url);
    } catch (error) {
      throw new Error(error.toString());
    }

    this.analyzedUrls = {};
    this.analyzedXhr = {};
    this.analyzedRequires = {};
    this.detections = [];

    this.listeners = {};

    this.pages = [];

    this.cache = {};

    this.probed = false;
  }

  log(message, source = 'driver', type = 'log') {
    if (this.options.debug) {
      console[type](`${type} | ${source} |`, message);
    }

    this.emit(type, { message, source });
  }

  error(error, source = 'driver') {
    this.log(error, source, 'error');
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }

    this.listeners[event].push(callback);
  }

  emit(event, params) {
    if (this.listeners[event]) {
      return Promise.allSettled(
        this.listeners[event].map((listener) => listener(params))
      );
    }
  }

  promiseTimeout(
    promise,
    fallback,
    errorMessage = 'Operation took too long to complete',
    maxWait = this.options.fast
      ? Math.min(this.options.maxWait, 2000)
      : this.options.maxWait
  ) {
    let timeout = null;

    if (!(promise instanceof Promise)) {
      return Promise.resolve(promise);
    }

    return Promise.race([
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          clearTimeout(timeout);

          const error = new Error(errorMessage);

          error.code = 'PROMISE_TIMEOUT_ERROR';

          if (fallback !== undefined) {
            this.error(error);

            resolve(fallback);
          } else {
            reject(error);
          }
        }, maxWait);
      }),
      promise.then((value) => {
        clearTimeout(timeout);

        return value;
      })
    ]);
  }

  async goto(url) {
    // Return when the URL is a duplicate or maxUrls has been reached
    if (this.analyzedUrls[url.href]) {
      return [];
    }

    this.log(`Navigate to ${url}`);

    this.analyzedUrls[url.href] = {
      status: 0
    };

    const page = await this.newPage(url);

    await page.setRequestInterception(true);

    let responseReceived = false;

    page.on('request', async (request) => {
      try {
        if (request.resourceType() === 'xhr') {
          let hostname;

          try {
            ({ hostname } = new URL(request.url()));
          } catch (error) {
            request.abort('blockedbyclient');

            return;
          }

          if (!xhrDebounce.includes(hostname)) {
            xhrDebounce.push(hostname);

            setTimeout(async () => {
              xhrDebounce.splice(xhrDebounce.indexOf(hostname), 1);

              this.analyzedXhr[url.hostname] =
                this.analyzedXhr[url.hostname] || [];

              if (!this.analyzedXhr[url.hostname].includes(hostname)) {
                this.analyzedXhr[url.hostname].push(hostname);

                await this.onDetect(url, analyze({ xhr: hostname }));
              }
            }, 1000);
          }
        }

        if (
          (responseReceived && request.isNavigationRequest()) ||
          request.frame() !== page.mainFrame() ||
          !['document', ...(this.options.noScripts ? [] : ['script'])].includes(
            request.resourceType()
          )
        ) {
          request.abort('blockedbyclient');
        } else {
          await this.emit('request', { page, request });

          if (Object.keys(this.options.headers).length) {
            const headers = {
              ...request.headers(),
              ...this.options.headers
            };

            request.continue({ headers });
          } else {
            request.continue();
          }
        }
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }
    });

    page.on('response', async (response) => {
      if (!page || page.__closed || page.isClosed()) {
        return;
      }

      try {
        if (
          response.status() < 300 &&
          response.frame().url() === url.href &&
          response.request().resourceType() === 'script'
        ) {
          const scripts = await response.text();

          await this.onDetect(response.url(), analyze({ scripts }));
        }
      } catch (error) {
        if (error.constructor.name !== 'ProtocolError') {
          error.message += ` (${url})`;

          this.error(error);
        }
      }

      try {
        if (response.url() === url.href) {
          this.analyzedUrls[url.href] = {
            status: response.status()
          };

          const rawHeaders = response.headers();
          const headers = {};

          Object.keys(rawHeaders).forEach((key) => {
            headers[key] = [
              ...(headers[key] || []),
              ...(Array.isArray(rawHeaders[key])
                ? rawHeaders[key]
                : [rawHeaders[key]])
            ];
          });

          // Prevent cross-domain redirects
          if (response.status() >= 300 && response.status() < 400) {
            if (headers.location) {
              const _url = new URL(headers.location.slice(-1), url);

              const redirects = Object.keys(this.analyzedUrls).length - 1;

              if (
                _url.hostname.replace(/^www\./, '') ===
                  this.originalUrl.hostname.replace(/^www\./, '') ||
                (redirects < 3 && !this.options.noRedirect)
              ) {
                url = _url;

                return;
              }
            }
          }

          responseReceived = true;

          const certIssuer = response.securityDetails()
            ? response.securityDetails().issuer()
            : '';

          await this.onDetect(url, analyze({ headers, certIssuer }));

          await this.emit('response', { page, response, headers, certIssuer });
        }
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }
    });

    try {
      await page.goto(url.href);

      if (page.url() === 'about:blank') {
        const error = new Error(`The page failed to load (${url})`);

        error.code = 'WAPPALYZER_PAGE_EMPTY';

        throw error;
      }

      if (!this.options.noScripts) {
        await sleep(this.options.fast ? 1000 : 3000);
      }

      // page.on('console', (message) => this.log(message.text()))

      // Cookies
      let cookies = [];

      try {
        cookies = (await page.cookies()).reduce(
          (cookies, { name, value }) => ({
            ...cookies,
            [name.toLowerCase()]: [value]
          }),
          {}
        );

        // Change Google Analytics 4 cookie from _ga_XXXXXXXXXX to _ga_*
        Object.keys(cookies).forEach((name) => {
          if (/_ga_[A-Z0-9]+/.test(name)) {
            cookies['_ga_*'] = cookies[name];

            delete cookies[name];
          }
        });
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }

      // HTML
      let html = await this.promiseTimeout(
        page.content(),
        '',
        'Timeout (html)'
      );

      if (this.options.htmlMaxCols && this.options.htmlMaxRows) {
        const batches = [];
        const rows = html.length / this.options.htmlMaxCols;

        for (let i = 0; i < rows; i += 1) {
          if (batches.length >= this.options.htmlMaxRows) {
            break;
          }

          batches.push(
            html.slice(
              i * this.options.htmlMaxCols,
              (i + 1) * this.options.htmlMaxCols
            )
          );
        }

        html = batches.join('\n');
      }

      // CSS
      let css = [];

      try {
        const styles = await page.evaluate(() =>
          Array.from(document.styleSheets)
            .map((styleSheet) => {
              try {
                return Array.from(styleSheet.cssRules)
                  .map(({ cssText }) => cssText)
                  .join(' ');
              } catch (error) {
                // Continue
              }
            })
            .filter(Boolean)
        );

        css = styles.map((style) => style.slice(0, 1000000));
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }

      // Script tags
      let scriptSrc = [];

      try {
        scriptSrc = await page.evaluate(() =>
          Array.from(document.scripts)
            .map(({ src }) => src)
            .filter(Boolean)
        );
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }

      // Meta tags
      let meta = {};

      try {
        meta = await page.evaluate(() =>
          Array.from(document.querySelectorAll('meta')).reduce((meta, node) => {
            const name =
              node.getAttribute('name') ||
              node.getAttribute('property') ||
              node.getAttribute('itemprop');
            const content = node.getAttribute('content');

            if (name && content) {
              meta[name.toLowerCase()] = meta[name.toLowerCase()] || [];

              meta[name.toLowerCase()].push(content.slice(0, 1000000));
            }

            return meta;
          }, {})
        );
      } catch (error) {
        error.message += ` (${url})`;

        this.error(error);
      }

      const js = await this.promiseTimeout(
        getJs(page),
        [],
        'Timeout (js evaluation)'
      );

      const dom = await this.promiseTimeout(
        getDom(page),
        [],
        'Timeout (dom evaluation)'
      );

      await this.onDetect(url, analyze({ html, css, scriptSrc, meta }));

      await this.onDetect(url, analyzeJs(js));

      await this.onDetect(url, analyzeDom(dom));

      await this.emit('goto', { page, url, html, cookies, js, dom });

      // Crawler
      if (this.options.recursive) {
        const links = await page.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]')).map(
            ({ href }) => href
          )
        );

        await Promise.all(
          links.map(async (link) => {
            let _url;

            try {
              _url = new URL(link);
            } catch (error) {
              return;
            }

            // Must be on the same domain
            if (
              _url.hostname.replace(/^www\./, '') ===
                url.hostname.replace(/^www\./, '') &&
              _url.protocol.startsWith('http') &&
              extensions.test(_url.pathname)
            ) {
              const redirects = Object.keys(this.analyzedUrls).length - 1;

              if (redirects < this.options.maxUrls) {
                const depth = url.pathname.split('/').length - 1;

                if (depth < this.options.maxDepth) {
                  await this.goto(_url);
                }
              }
            }
          })
        );
      }
    } catch (error) {
      if (error.code !== 'WAPPALYZER_PAGE_EMPTY') {
        error.message += ` (${url})`;

        this.error(error);
      }
    } finally {
      try {
        await page.close();
      } catch {
        // Continue
      }
    }
  }

  async analyze() {
    await this.goto(this.originalUrl);

    if (this.options.probe) {
      await this.probe();
    }

    const resolved = resolve(this.detections);

    return {
      urls: this.analyzedUrls,
      technologies: resolved.map((resolved) => {
        const technology = Wappalyzer.technologies.find(
          ({ name }) => name === resolved.name
        );

        const { name, slug, description, confidence, icon, website } =
          technology;

        const categories = technology.categories.map((id) =>
          Wappalyzer.categories.find((category) => category.id === id)
        );

        return {
          slug,
          name,
          description: description || null,
          confidence,
          version: resolved.version || null,
          icon,
          website,
          cpe: technology.cpe || null,
          categories: categories.map(({ id, slug, name }) => ({
            id,
            slug,
            name
          })),
          rootPath: resolved.rootPath || undefined
        };
      })
    };
  }

  async probe() {
    this.log(`Probe ${this.originalUrl}`);

    this.probed = true;

    // DNS
    const dnsResolvers = {
      txt: dns.resolveTxt(this.originalUrl.hostname),
      mx: dns.resolveMx(this.originalUrl.hostname)
    };

    const dnsResults = await Promise.allSettled(
      Object.values(dnsResolvers)
    ).then((results) =>
      results.reduce(
        (results, result, index) => ({
          ...results,
          [Object.keys(dnsResolvers)[index]]:
            result.status === 'fulfilled' ? result.value : []
        }),
        {}
      )
    );

    const dnsRecords = {
      txt: dnsResults.txt.flat(),
      mx: dnsResults.mx.map(({ exchange }) => exchange)
    };

    await this.onDetect(this.originalUrl, analyze({ dns: dnsRecords }));

    await this.emit('probe', { dns: dnsRecords });

    // Deeper paths
    const paths = Wappalyzer.technologies
      .filter(({ probe }) => probe)
      .reduce((paths, { probe }) => {
        probe.paths.forEach((path) => {
          path = path.replace(/^\//, '');

          if (!paths.includes(path)) {
            paths.push(path);
          }
        });

        return paths;
      }, []);

    const chunks = [];

    for (let i = 0; i < paths.length; i += this.options.batchSize) {
      chunks.push(paths.slice(i, i + this.options.batchSize));
    }

    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(async (path) => {
          const url = new URL(path, this.originalUrl);

          try {
            const body = await get.call(this, url, {
              userAgent: this.options.userAgent
            });

            await this.onDetect(url, analyze({ probe: { [path]: body } }));
          } catch (error) {
            // Continue
          }
        })
      );
    }
  }

  async onDetect(url, detections) {
    if (detections.length) {
      detections.forEach((detection) => {
        detection.rootPath =
          url.pathname === '/' ||
          url.pathname ===
            (this.analyzedUrls[this.originalUrl.href] || {}).pathname;

        this.log(
          `Detected ${detection.name}${
            detection.version ? ` ${detection.version}` : ''
          } (confidence ${detection.confidence}%)`,
          'driver'
        );

        this.emit('detected', { detection });
      });

      this.detections = this.detections.concat(detections);
    }
  }

  async newPage(url) {
    if (!this.browser) {
      await this.initDriver();
    }

    const page = await this.browser.newPage();

    this.pages.push(page);

    page.on('close', () => {
      page.__closed = true;

      this.pages = this.pages.filter((_page) => _page !== page);
    });

    await page.setUserAgent(this.options.userAgent);

    if (this.options.noScripts) {
      await page.setJavaScriptEnabled(false);
    }

    return page;
  }
}

module.exports = Driver;
