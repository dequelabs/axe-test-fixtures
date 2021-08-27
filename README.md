# axe-test-fixtures

Fixtures for testing integrations of axe-core. All fixtures can be found in the `/fixture` directory. 

## Tests

Using the fixtures, the following tests should be applied to the project (code written using a JavaScript Selenium-like framework). For testing axe.run "legacy" code path, any axe-core version prior to 4.3.0 will work.

```js
const axeSource = fs.readFileSync('axe-core@4.3.2.js', 'utf8');
const legacyAxeSource = fs.readFileSync('fixtures/axe-core@legacy.js', 'utf8');
const axeCrasherSource = fs.readFileSync('fixtures/axe-crasher.js', 'utf8');

describe('analyze', () => {
  // ...

  it('throws if axe errors out on the top window', done => {
    driver
      .get(`${addr}/crash.html`)
      .then(() => {
        return new AxeBuilder(driver, axeSource + axeCrasherSource).analyze();
      })
      .then(
        () => done(new Error('Expect async function to throw')),
        () => done()
      );
  });

  it('throws when injecting a problematic source', done => {
    driver
      .get(`${addr}/crash.html`)
      .then(() => {
        return new AxeBuilder(driver, 'throw new Error()').analyze();
      })
      .then(
        () => done(new Error('Expect async function to throw')),
        () => done()
      );
  });

  it('throws when a setup fails', done => {
    const brokenSource = axeSource + `;window.axe.utils = {}`;
    driver
      .get(`${addr}/index.html`)
      .then(() => {
        return new AxeBuilder(driver, brokenSource)
          .withRules('label')
          .analyze();
      })
      .then(
        () => done(new Error(`Expect async function to throw`)),
        () => done()
      );
  });

  // This test uses chai-as-promised for async assert.
  // Ensure it is set up.
  it('properly isolates the call to axe.finishRun', () => {
    await driver.get('${addr}/isolated-finish.html')
    assert.isFulfilled(new AxeBuilder(driver).analyze())
  })

  it('returns correct results metadata', async () => {
    await driver.get(`${addr}/index.html`);
    const results = await new AxeBuilder(driver).analyze();
    assert.isDefined(results.testEngine.name)
    assert.isDefined(results.testEngine.version)
    assert.isDefined(results.testEnvironment.orientationAngle)
    assert.isDefined(results.testEnvironment.orientationType)
    assert.isDefined(results.testEnvironment.userAgent)
    assert.isDefined(results.testEnvironment.windowHeight)
    assert.isDefined(results.testEnvironment.windowWidth)
    assert.isDefined(results.testRunner.name)
    assert.isDefined(results.toolOptions.reporter)
    assert.equal(results.url, `${addr}/index.html`)
  })
});

describe('frame tests', () => {
  it('injects into nested iframes', async () => {
    await driver.get(`${addr}/nested-iframes.html`);
    const { violations } = await new AxeBuilder(driver)
      .options({ runOnly: 'label' })
      .analyze();

    assert.equal(violations[0].id, 'label');
    const nodes = violations[0].nodes;
    assert.lengthOf(nodes, 4);
    assert.deepEqual(nodes[0].target, [
      '#ifr-foo',
      '#foo-bar',
      '#bar-baz',
      'input'
    ]);
    assert.deepEqual(nodes[1].target, ['#ifr-foo', '#foo-baz', 'input']);
    assert.deepEqual(nodes[2].target, ['#ifr-bar', '#bar-baz', 'input']);
    assert.deepEqual(nodes[3].target, ['#ifr-baz', 'input']);
  });

  it('injects into nested frameset', async () => {
    await driver.get(`${addr}/nested-frameset.html`);
    const { violations } = await new AxeBuilder(driver)
      .options({ runOnly: 'label' })
      .analyze();

    assert.equal(violations[0].id, 'label');
    assert.lengthOf(violations[0].nodes, 4);

    const nodes = violations[0].nodes;
    assert.deepEqual(nodes[0].target, [
      '#frm-foo',
      '#foo-bar',
      '#bar-baz',
      'input'
    ]);
    assert.deepEqual(nodes[1].target, ['#frm-foo', '#foo-baz', 'input']);
    assert.deepEqual(nodes[2].target, ['#frm-bar', '#bar-baz', 'input']);
    assert.deepEqual(nodes[3].target, ['#frm-baz', 'input']);
  });

  it('should work on shadow DOM iframes', async () => {
    await driver.get(`${addr}/shadow-frames.html`);
    const { violations } = await new AxeBuilder(driver)
      .options({ runOnly: 'label' })
      .analyze();

    assert.equal(violations[0].id, 'label');
    assert.lengthOf(violations[0].nodes, 3);

    const nodes = violations[0].nodes;
    assert.deepEqual(nodes[0].target, ['#light-frame', 'input']);
    assert.deepEqual(nodes[1].target, [
      ['#shadow-root', '#shadow-frame'],
      'input'
    ]);
    assert.deepEqual(nodes[2].target, ['#slotted-frame', 'input']);
  });

  it('reports erroring frames in frame-tested', async () => {
    await driver.get(`${addr}/crash-parent.html`);
    const results = await new AxeBuilder(driver, axeSource + axeCrasherSource)
      .options({ runOnly: ['label', 'frame-tested'] })
      .analyze();

    assert.equal(results.incomplete[0].id, 'frame-tested');
    assert.lengthOf(results.incomplete[0].nodes, 1);
    assert.deepEqual(results.incomplete[0].nodes[0].target, [
      '#ifr-crash'
    ]);
    assert.equal(results.violations[0].id, 'label');
    assert.lengthOf(results.violations[0].nodes, 2);
    assert.deepEqual(results.violations[0].nodes[0].target, [
      '#ifr-bar',
      '#bar-baz',
      'input'
    ]);
    assert.deepEqual(results.violations[0].nodes[1].target, [
      '#ifr-baz',
      'input'
    ]);
  });

  it('returns the same results from runPartial as from legacy mode', async () => {
    await driver.get(`${addr}/nested-iframes.html`);
    const legacyResults = await new AxeBuilder(
      driver, axeSource + axeForceLegacy
    ).analyze();
    assert.equal(legacyResults.testEngine.name, 'axe-legacy');

    const normalResults = await new AxeBuilder(driver, axeSource).analyze();
    normalResults.timestamp = legacyResults.timestamp;
    normalResults.testEngine.name = legacyResults.testEngine.name;
    assert.deepEqual(normalResults, legacyResults);
  });
});

describe('for versions without axe.runPartial', () => {
  it('can run', async () => {
    await driver.get(`${addr}/nested-iframes.html`);
    const results = await new AxeBuilder(driver, legacyAxeSource)
      .options({ runOnly: ['label'] })
      .analyze();

    assert.equal(results.violations[0].id, 'label');
    assert.lengthOf(results.violations[0].nodes, 4);
    assert.equal(results.testEngine.version, '4.0.3');
  });

  it('throws if the top level errors', done => {
    driver
      .get(`${addr}/crash.html`)
      .then(() => {
        return new AxeBuilder(
          driver,
          legacyAxeSource + axeCrasherSource
        ).analyze();
      })
      .then(
        () => done(new Error('Expect async function to throw')),
        () => done()
      );
  });

  it('reports frame-tested', async () => {
    await driver.get(`${addr}/crash-parent.html`);
    const results = await new AxeBuilder(driver, legacyAxeSource + axeCrasherSource)
      .options({ runOnly: ['label', 'frame-tested'] })
      .analyze();

    assert.equal(results.incomplete[0].id, 'frame-tested');
    assert.lengthOf(results.incomplete[0].nodes, 1);
    assert.equal(results.violations[0].id, 'label');
    assert.lengthOf(results.violations[0].nodes, 2);
  });
});

describe('with a custom ruleset', () => {
  // These test should only be added to integrations that support .configure()
  // Not all integrations do. Do NOT add .configure() support to integrations
  // that do not have it.

  const dylangConfig = require('./fixtures/dylang-config.json');

  it('should find violations with customized helpUrl', async function () {
    await page.goto(`${addr}/index.html`);
    const { violations, passes } = await new AxePuppeteer(page)
      .configure(dylangConfig).analyze();

    assert.lengthOf(passes, 0);
    assert.lengthOf(violations, 1);
    assert.equal(violations[0].id, 'dylang');
    assert.lengthOf(violations[0].nodes, 1);
  });

  it('configures in nested frames', async function () {
    await page.goto(`${addr}/nested-iframes.html`);
    const { violations } = await new AxePuppeteer(page)
      .configure(dylangConfig)
      .analyze();

    assert.lengthOf(violations, 1);
    assert.equal(violations[0].id, 'dylang');
    assert.lengthOf(violations[0].nodes, 8);
  });

  it('works without runPartial', async () => {
    const axePath = require.resolve('./fixtures/axe-core@legacy.js');
    const legacyAxeSource = fs.readFileSync(axePath, 'utf8');
    await page.goto(`${addr}/external/nested-iframes.html`);
    const { violations } = await new AxePuppeteer(page, legacyAxeSource)
      .configure(dylangConfig)
      .analyze();

    assert.lengthOf(violations, 1);
    assert.equal(violations[0].id, 'dylang');
    assert.lengthOf(violations[0].nodes, 8);
  });
})
```
