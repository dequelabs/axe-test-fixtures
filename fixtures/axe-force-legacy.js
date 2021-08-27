;
delete window.axe.runPartial; 
delete window.axe.finishRun; 
var origRun =  window.axe.run; 
window.axe.run = async function() { 
  if (typeof arguments[arguments.length - 1] === 'function') {
    const oldArg = arguments[arguments.length - 1];
    arguments[arguments.length - 1] = function(err, results) {
      if (results) {
        results.testEngine.name = 'axe-legacy';
      }
      oldArg(err, results);
    }
  }
  const results = await origRun.apply(window.axe, arguments);
  results.testEngine.name = 'axe-legacy';
  return results;
}
