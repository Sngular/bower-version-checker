var bower = require('bower');
var cint = require('cint');
var bowerJson = require('bower-json');
var semver = require('semver');
var semverUtils = require('semver-utils');
var Table = require('cli-table');
var copyDir = require('copy-dir');
var process = require('process');
var rmdir = require('rmdir');
var inquirer = require("inquirer");
var fs = require('fs');
var path = require('path');

/**
 * Return a Promise that resolves when 'bower list' command is finished.
 * Promise returns the result of the command.
 */

function getDependenciesInfo() {
  return new Promise(function (resolve, reject) {
    bower.commands.list()
      .on('end', function (results) {
        var dependencies = cint.mapObject(results.dependencies, function (key, value) {
            return cint.keyValue(key, value.pkgMeta);
        });
        resolve(results.dependencies);
      })
      .on('error', function(e) {
        console.error('Bower list error...', e);
        reject();
      });
  });
}

/**
 * Return a Promise that returns bower dependencies that we have inside
 * our local bower.json
 */

function parseLocalBower() {
  return new Promise(function (resolve, reject) {
    bowerJson.read('./bower.json', function (err, json) {
        if (err) {
            console.error('There was an error reading the file');
            console.error(err.message);
            reject();
        }

        var deps = json.dependencies;
        if (json.devDependencies) {
          Object.assign(deps, json.devDependencies);
        }

        resolve(deps);
    });
  });
}

/**
 * Return a Promise that revolves when 'bower install' command is finished
 */

function bowerInstall() {
  return new Promise(function (resolve, reject) {
    bower.commands.install([], { forceLatest: true })
      .on('end', function (results) {
        resolve();
      })
      .on('error', function(e) {
        console.error('Bower install error...', e);
        reject();
      });
  });
}

/**
 * Launch functions which obtain information about dependencies that our
 * package uses. This information is used to calculate last version of dependencies.
 * obtainBowerData() returns a promise that is resolved when all data is obtained.
 */

function obtainBowerData() {
  var remoteBowerPromise = getDependenciesInfo();
  var localBowerPromise = parseLocalBower();
  return Promise.all([localBowerPromise, remoteBowerPromise]);
}

/**
 * Transform data obtained to an object with local versions and last versions of our
 * components.
 */

function mapVersionInfo(localDependencies, remoteDependencies) {
  var versionInfo = [];

  for (var key in localDependencies) {
    var localInfoVersion = getDependencyVersion(localDependencies[key]);

    versionInfo.push({
      name: key,
      lastVersion: remoteDependencies[key].versions[0],
      localTarget: localInfoVersion
    });
  }

  return versionInfo;
}

/**
 * Extract version of bower dependency link
 */

function getDependencyVersion(link) {
  if (link.indexOf('#') > -1) {
    var version = link.split('#');
    version = version[version.length - 1];
    return version;
  } else {
    return false;
  }
}

/**
 * Generate a table with versions that can be updated on bower
 */

function createDependenciesTable(versionInfo) {
  var table = new Table({
      head: ['Dependency name', 'New version', 'Local version'],
      colWidths: [40, 20, 20]
  });
  var questions = [];
  var updatedDeps = 0;
  var counter = 0;

  versionInfo.forEach(function(component) {
    if (component.localTarget) {
      counter++;
      if (!semver.satisfies(component.lastVersion, component.localTarget)) {
        table.push([component.name, '~' + component.lastVersion, component.localTarget]);
        questions.push({ type:"confirm", name:component.name, message:"Do you want to update dependency "+ component.name +" in bower.json with " + component.lastVersion + " version?", default:false});
      } else {
        table.push([component.name, 'UPDATED', component.localTarget]);
        updatedDeps++;
      }
    }
  });

  console.log('Dependencies to update');
  console.log(table.toString());

  if ( updatedDeps === counter ) {
    console.log("\nbower.json has its dependencies at the latest's version");
  } else {
    askUpdateDependencies(versionInfo, questions);
  }
}

function askUpdateDependencies(versionInfo, questions) {
  inquirer.prompt(questions, function(answers) {
    updateBowerJson(versionInfo, answers);
  });
}

function updateBowerJson(versionInfo, answers) {
  var cont = fs.readFileSync("bower.json", 'utf8').split(/\n/);
  var regExp;
  var k;
  var line;
  var tmp;
  versionInfo.forEach(function(component) {
    if (component.localTarget) {
      k = component.name;
      if ( answers[k] ) {
        regExp = new RegExp('"'+k+'"');
        cont = cont.map(function(a,b,c){
          if ( c[b].match(regExp) ) {
            return c[b].replace(/#(\^?\~?)[0-9]*\.[0-9]*\.[0-9]*/, "#$1"+component.lastVersion);
          } else {
            return c[b];
          }
        });
      }
    }
  });

  cont = cont.join("\n");
  console.log( "NEW BOWER:" );
  console.log(cont);

  inquirer.prompt([{ type:"confirm", name:"savebower", message:"Do you want to save a new 'bower.json'?", default:false}], function(answers) {
    if (answers.savebower ) {
      var currentDir = process.cwd().replace("tmp","");
      console.log("currentDir " + currentDir);
      inquirer.prompt([{ type:"confirm", name:"saveoldbower", message:"Do you want to save actual bower.json like '_bower.json.old' ?", default:false}], function(answers2) {
        if ( answers2.saveoldbower ) {
          console.log("move bower.json to _bower.json.old" );
          fs.renameSync(currentDir+"bower.json", currentDir+"_bower.json.old");
        }
        if ( answers.savebower ){
          console.log("...new bower.json saved");
          fs.writeFileSync(currentDir + "bower.json", cont);
        }

        finishEnvironment().then(function() {
          process.exit();
        });
      });
    }
  });
}

/**
 * Script starting function
 */

function programRun() {
  console.log('Doing bower install...');

  bowerInstall().then(function() {
    console.log('Obtaining bower data...');

    obtainBowerData().then(function(results) {
      var versionInfo = mapVersionInfo(results[0], results[1]);
      console.log('Creating updates table...');
      createDependenciesTable(versionInfo);
    });

  });
}

/**
 * Create a temporal environment on 'tmp' folder
 */

function initEnvironment() {
  console.log('Creating environment...');
  return new Promise(function(resolve, reject) {
    copyDir.sync(process.cwd(), './tmp');
    try {
      process.chdir('./tmp');
      resolve();
    }
    catch (err) {
      reject();
    }
  });
}

/**
 * Destroy temporal environment
 */

function finishEnvironment() {
  return new Promise(function(resolve, reject) {
    try {
      process.chdir('../');
      rmdir('./tmp', function() {
        resolve();
      });
    }
    catch (err) {
      reject();
    }
  });
}

module.exports = {
  run: function (opts) {
    options = opts || {};
    initEnvironment().then(function() {
      programRun();
    });
  }
};
