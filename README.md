# axe-test-fixtures

Fixtures for testing integrations of axe-core. All fixtures can be found in the `/fixture` directory.

## Tests

Using the fixtures, the following tests should be applied to the project (code written using a JavaScript Selenium-like framework). For testing axe.run 'legacy' code path, any axe-core version prior to 4.3.0 will work.

```js
const axeSource = fs.readFileSync('axe-core@4.3.2.js', 'utf8');
const legacyAxeSource = fs.readFileSync('fixtures/axe-core@legacy.js', 'utf8');
const axeCrasherSource = fs.readFileSync('fixtures/axe-crasher.js', 'utf8');

describe('analyze', () => {
  // ...

  it('throws if axe errors out on the top window', (done) => {
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

  it('throws when injecting a problematic source', (done) => {
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

  it('throws when a setup fails', (done) => {
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
    await driver.get('${addr}/isolated-finish.html');
    assert.isFulfilled(new AxeBuilder(driver).analyze());
  });

  it('returns correct results metadata', async () => {
    await driver.get(`${addr}/index.html`);
    const results = await new AxeBuilder(driver).analyze();
    assert.isDefined(results.testEngine.name);
    assert.isDefined(results.testEngine.version);
    assert.isDefined(results.testEnvironment.orientationAngle);
    assert.isDefined(results.testEnvironment.orientationType);
    assert.isDefined(results.testEnvironment.userAgent);
    assert.isDefined(results.testEnvironment.windowHeight);
    assert.isDefined(results.testEnvironment.windowWidth);
    assert.isDefined(results.testRunner.name);
    assert.isDefined(results.toolOptions.reporter);
    assert.equal(results.url, `${addr}/index.html`);
  });
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
      'input',
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
      'input',
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
      'input',
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
    assert.deepEqual(results.incomplete[0].nodes[0].target, ['#ifr-crash']);
    assert.equal(results.violations[0].id, 'label');
    assert.lengthOf(results.violations[0].nodes, 2);
    assert.deepEqual(results.violations[0].nodes[0].target, [
      '#ifr-bar',
      '#bar-baz',
      'input',
    ]);
    assert.deepEqual(results.violations[0].nodes[1].target, [
      '#ifr-baz',
      'input',
    ]);
  });

  it('returns the same results from runPartial as from legacy mode', async () => {
    await driver.get(`${addr}/nested-iframes.html`);
    const legacyResults = await new AxeBuilder(
      driver,
      axeSource + axeForceLegacy
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

  it('throws if the top level errors', (done) => {
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
    const results = await new AxeBuilder(
      driver,
      legacyAxeSource + axeCrasherSource
    )
      .options({ runOnly: ['label', 'frame-tested'] })
      .analyze();

    assert.equal(results.incomplete[0].id, 'frame-tested');
    assert.lengthOf(results.incomplete[0].nodes, 1);
    assert.equal(results.violations[0].id, 'label');
    assert.lengthOf(results.violations[0].nodes, 2);
  });

  it('tests cross-origin pages', async () => {
    await driver.get(`${addr}/cross-origin.html`);
    const results = await new AxeBuilder(driver, axe403Source)
      .withRules(['frame-tested'])
      .analyze();

    const frameTested = results.incomplete.find(
      ({ id }) => id === 'frame-tested'
    );
    assert.isUndefined(frameTested);
  });
});

describe('with a custom ruleset', () => {
  // These test should only be added to integrations that support .configure()
  // Not all integrations do. Do NOT add .configure() support to integrations
  // that do not have it.

  const dylangConfig = require('./fixtures/dylang-config.json');

  it('should find violations with customized helpUrl', async () => {
    await page.goto(`${addr}/index.html`);
    const { violations, passes } = await new AxePuppeteer(page)
      .configure(dylangConfig)
      .analyze();

    assert.lengthOf(passes, 0);
    assert.lengthOf(violations, 1);
    assert.equal(violations[0].id, 'dylang');
    assert.lengthOf(violations[0].nodes, 1);
  });

  it('configures in nested frames', async () => {
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
    await page.goto(`${addr}/nested-iframes.html`);
    const { violations } = await new AxePuppeteer(page, legacyAxeSource)
      .configure(dylangConfig)
      .analyze();

    assert.lengthOf(violations, 1);
    assert.equal(violations[0].id, 'dylang');
    assert.lengthOf(violations[0].nodes, 8);
  });

  describe('with include and exclude', () => {
    // helper function that returns all of the pass node targets within an array
    // so we can easily check if the node was included or excluded during analysis
    const flatPassesTargets = (results) => {
      return results.passes
        .reduce((acc, pass) => {
          return acc.concat(pass.nodes);
        }, [])
        .reduce((acc, node) => {
          return acc.concat(node.target.flat(1));
        }, []);
    };

    it('with only include', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
        .include('.include')
        .include('.include2')
        .analyze();

      assert.isTrue(flatPassesTargets(results).includes('.include'));
      assert.isTrue(flatPassesTargets(results).includes('.include2'));
    });

    it('with only exclude', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
        .exclude('.exclude')
        .exclude('.exclude2')
        .analyze();

      assert.isFalse(flatPassesTargets(results).includes('.exclude'));
      assert.isFalse(flatPassesTargets(results).includes('.exclude2'));
    });

    it('with include and exclude', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
        .include('.include')
        .include('.include2')
        .exclude('.exclude')
        .exclude('.exclude2')
        .analyze();

      assert.isTrue(flatPassesTargets(results).includes('.include'));
      assert.isTrue(flatPassesTargets(results).includes('.include2'));
      assert.isFalse(flatPassesTargets(results).includes('.exclude'));
      assert.isFalse(flatPassesTargets(results).includes('.exclude2'));
    });

    it('with include and exclude iframes', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
        .include(['#ifr-inc-excl', 'html'])
        .exclude(['#ifr-inc-excl', '#foo-bar'])
        .include(['#ifr-inc-excl', '#foo-baz', 'html'])
        .exclude(['#ifr-inc-excl', '#foo-baz', 'input'])
        .analyze();

      const labelResult = results.violations.find(
        (r: Axe.Result) => r.id === 'label'
      );

      assert.isFalse(flatPassesTargets(results).includes('#foo-bar'));
      assert.isFalse(flatPassesTargets(results).includes('input'));
      expect(labelResult).to.be.undefined;
    });

    it('with include iframes', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
          .include(['#ifr-inc-excl', '#foo-baz', 'html'])
          .include(['#ifr-inc-excl', '#foo-baz', 'input'])
          // does not exist
          .include(['#hazaar', 'html'])
          .analyze();

        const labelResult = results.violations.find(
          (r: Axe.Result) => r.id === 'label'
        );

        assert.isTrue(flatPassesTargets(results).includes('#ifr-inc-excl'));
        assert.isTrue(flatPassesTargets(results).includes('#foo-baz'));
        assert.isTrue(flatPassesTargets(results).includes('input'));
        assert.isFalse(flatPassesTargets(results).includes('#foo-bar'));
        // does not exist
        assert.isFalse(flatPassesTargets(results).includes('#hazaar'));
        expect(labelResult).not.to.be.undefined;
    });

    it('with labelled frame', async () => {
      await page.goto(`${addr}/context-include-exclude.html`);
      const results = await new AxePuppeteer(page)
        .include({ fromFrames: ['#ifr-inc-excl', 'html'] })
        .exclude({ fromFrames: ['#ifr-inc-excl', '#foo-bar'] })
        .include({ fromFrames: ['#ifr-inc-excl', '#foo-baz', 'html'] })
        .exclude({ fromFrames: ['#ifr-inc-excl', '#foo-baz', 'input'] })
        .analyze();

      const labelResult = results.violations.find(
        (r: Axe.Result) => r.id === 'label'
      );

      assert.isFalse(flatPassesTargets(results).includes('#foo-bar'));
      assert.isFalse(flatPassesTargets(results).includes('input'));
      expect(labelResult).to.be.undefined;
    });

    it('with include shadow DOM', async () => {
      await page.goto(`${addr}/shadow-dom.html`);
      const results = await new AxePuppeteer(page)
        .include([['#shadow-root-1', '#shadow-button-1']])
        .include([['#shadow-root-2', '#shadow-button-2']])
        .analyze();

      assert.isTrue(flatPassesTargets(results).includes('#shadow-button-1'));
      assert.isTrue(flatPassesTargets(results).includes('#shadow-button-2'));
    });

    it('with exclude shadow DOM', async () => {
      await page.goto(`${addr}/shadow-dom.html`);
      const results = await new AxePuppeteer(page)
        .exclude([['#shadow-root-1', '#shadow-button-1']])
        .exclude([['#shadow-root-2', '#shadow-button-2']])
        .analyze();

      assert.isFalse(flatPassesTargets(results).includes('#shadow-button-1'));
      assert.isFalse(flatPassesTargets(results).includes('#shadow-button-2'));
    });

    it('with labelled shadow DOM', async () => {
      await page.goto(`${addr}/shadow-dom.html`);
      const results = await new AxePuppeteer(page)
        .include({ fromShadowDom: ['#shadow-root-1', '#shadow-button-1'] })
        .exclude({ fromShadowDom: ['#shadow-root-2', '#shadow-button-2'] })
        .analyze();

      assert.isTrue(flatPassesTargets(results).includes('#shadow-button-1'));
      assert.isFalse(flatPassesTargets(results).includes('#shadow-button-2'));
    });

    it('with labelled iframe and shadow DOM', async () => {
        await driver.get(`${addr}/shadow-frames.html`);
        const results = await new AxeBuilder(driver)
          .exclude({
            fromFrames: [
              {
                fromShadowDom: ['#shadow-root', '#shadow-frame']
              },
              'input'
            ]
          })
          .analyze();

        assert.equal(violations[0].id, 'label');
        assert.lengthOf(violations[0].nodes, 2);

        const nodes = violations[0].nodes;
        assert.deepEqual(nodes[0].target, ['#light-frame', 'input']);
        assert.deepEqual(nodes[1].target, ['#slotted-frame', 'input']);
      });
    })
  });
});

describe('setLegacyMode', () => {
  const runPartialThrows = `;axe.runPartial = () => { throw new Error('No runPartial')}`;
  it('runs legacy mode when used', async () => {
    await driver.get(`${addr}/index.html`);
    const results = await new AxeBuilder(driver, axeSource + runPartialThrows)
      .setLegacyMode()
      .analyze();
    assert.isNotNull(results);
  });

  it('prevents cross-origin frame testing', async () => {
    await driver.get(`${addr}/cross-origin.html`);
    const results = await new AxeBuilder(driver, axeSource + runPartialThrows)
      .withRules(['frame-tested'])
      .setLegacyMode()
      .analyze();

    const frameTested = results.incomplete.find(
      ({ id }) => id === 'frame-tested'
    );
    assert.ok(frameTested);
  });

  it('can be disabled again', async () => {
    await driver.get(`${addr}/cross-origin.html`);
    const results = await new AxeBuilder(driver)
      .withRules(['frame-tested'])
      .setLegacyMode()
      .setLegacyMode(false)
      .analyze();

    const frameTested = results.incomplete.find(
      ({ id }) => id === 'frame-tested'
    );
    assert.isUndefined(frameTested);
  });
});

describe('axe.finishRun errors', () => {
  const windowOpenThrows = `;window.open = () => { throw new Error('No window.open')}`;
  const finishRunThrows = `;axe.finishRun = () => { throw new Error('No finishRun')}`;
  it('throws an error if window.open throws', async () => {
    await driver.get(`${addr}/index.html`);
    try {
      await new AxeBuilder(driver, axeSource + windowOpenThrows).analyze();
      assert.fail('Should have thrown');
    } catch (err) {
      assert.match(err.message, /switchToWindow failed/);
    }
  });

  it('throws an error if axe.finishRun throws', async () => {
    await driver.get(`${addr}/index.html`);
    try {
      await new AxeBuilder(driver, axeSource + finishRunThrows).analyze();
      assert.fail('Should have thrown');
    } catch (err) {
      assert.match(err.message, /finishRun failed/);
    }
  });
});

describe('allowedOrigins', () => {
  async function getAllowedOrigins(){
    return await page.evaluate('axe._audit.allowedOrigins')
  }

  it('should not set when running runPartial and not legacy mode', async () => {
    await page.goto(`${addr}/index.html`);
    await new AxeBuilder(page)
      .analyze()
    const allowedOrigins = await getAllowedOrigins()
    assert.deepEqual(allowedOrigins, [addr])
  })

  it('should not set when running runPartial and legacy mode', async () => {
    await page.goto(`${addr}/index.html`);
    await new AxeBuilder(page)
      .setLegacyMode(true)
      .analyze()
    const allowedOrigins = await getAllowedOrigins()
    assert.deepEqual(allowedOrigins, [addr])
  })

  it('should not set when running legacy source and legacy mode', async () => {
    await page.goto(`${addr}/index.html`);
    await new AxeBuilder(page, legacyAxeSource)
      .setLegacyMode(true)
      .analyze()
    const allowedOrigins = await getAllowedOrigins()
    assert.deepEqual(allowedOrigins, [addr])
  })

  it('should set when running legacy source and not legacy mode', async () => {
    await page.goto(`${addr}/index.html`);
    await new AxeBuilder(page, legacyAxeSource)
      .analyze()
    const allowedOrigins = await getAllowedOrigins()
    assert.deepEqual(allowedOrigins, ['*'])
  })
})
```
