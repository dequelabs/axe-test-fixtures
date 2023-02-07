function getNode() {
  return {
    any: [
      {
        id: 'duplicate-id',
        data: 'fixture',
        result: true,
        relatedNodes: []
      }
    ],
    all: [],
    none: [],
    node: {
      selector: [ '#fixture' ],
      source: '<div id="fixture"></div>',
      xpath: ['/div[@id="fixture"]'],
      ancestry: ['html > body > div:nth-child(1)'],
      nodeIndexes: [11]
    }
  };
}

const ruleResult = {
  id: 'duplicate-id',
  impact: 'serious',
  pageLevel: false,
  result: 'inapplicable',
  nodes: []
};
for (let i = 0; i < 200_000; i++) {
  ruleResult.nodes.push(getNode());
};

const partialResult = {
  environmentData: {
    testEngine: {
      name: 'axe-core',
      version: '4.6.3'
    },
    testRunner: {
      name: 'axe'
    },
    testEnvironment: {
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
        windowWidth: 1109,
        windowHeight: 946,
        orientationAngle: 0,
        orientationType: 'landscape-primary'
    },
    timestamp: '2023-02-01T22:53:38.103Z',
    url: 'http://localhost:9876/test/playground.html'
  },
  frames: [],
  results: [ruleResult]
};

window.axe.runPartial = async function() {
  return partialResult;
}