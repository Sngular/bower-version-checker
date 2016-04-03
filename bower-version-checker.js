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
 * @return a promise
 */

function createDependenciesTable(versionInfo) {
  return new Promise(function(resolve, reject) {
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
      resolve();
    } else {
      askUpdateDependencies(versionInfo, questions).then(function(){
        resolve();
      });
    }
  });
}

/**
 * Prompt to user the questions that are passed as a parameter
 * @return a promise that is resolved when, taking into account the
 * responses, the bower.json is updated
 */

function askUpdateDependencies(versionInfo, questions) {
  return new Promise(function(resolve, reject){
    inquirer.prompt(questions, function(answers) {
      updateBowerJson(versionInfo, answers).then(function() {
        resolve();
      });
    });
});
}

/**
 * Update bower.json file
 * @return a promise that is resolved when the preferences about saving files
 * have been answered, hence update bower.json
 */

function updateBowerJson(versionInfo, answers) {
  return new Promise(function(resolve, reject) {
    var cont = fs.readFileSync("bower.json", 'utf8').split(/\n/);
    var currentComponentToUpdate;
    var k;
    var line;
    var tmp;
    var willChange;
    versionInfo.forEach(function(component) {
      if (component.localTarget) {
        k = component.name;
        if ( answers[k] ) {
          currentComponentToUpdate = new RegExp('"'+k+'"');
          cont = cont.map(function(bowerLine){
            if ( bowerLine.match(currentComponentToUpdate) ) {
              willChange = true;
              return bowerLine.replace(/#(\^?\~?)[0-9]*\.[0-9]*\.[0-9]*/, "#$1"+component.lastVersion);
            } else {
              return bowerLine;
            }
          });
        }
      }
    });

    cont = cont.join("\n");
    if (!willChange) {
      console.log('..Skipping changes');
      return resolve();
    }
    console.log( "NEW BOWER:" );
    console.log(cont);

    inquirer.prompt([{ type:"confirm", name:"savebower", message:"Do you want to save a new 'bower.json'?", default:false}], function(answers) {
      if ( answers.savebower ) {
        var currentDir = process.cwd().replace("tmp","");
        console.log("\ncurrentDir " + currentDir);
        inquirer.prompt([{ type:"confirm", name:"saveoldbower", message:"Do you want to save actual bower.json like '_bower.json.old' ?", default:false}], function(answers2) {
          if ( answers2.saveoldbower ) {
            console.log("move bower.json to _bower.json.old" );
            fs.renameSync(currentDir+"bower.json", currentDir+"_bower.json.old");
          }
          if ( answers.savebower ){
            console.log("...new bower.json saved");
            fs.writeFileSync(currentDir + "bower.json", cont);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

/**
 * Script starting function
 * @return a promise
 */

function programRun() {
  console.log('Doing bower install...');
  return bowerInstall().then(function() {
    console.log('Obtaining bower data...');
    return obtainBowerData().then(function(results) {
      var versionInfo = mapVersionInfo(results[0], results[1]);
      console.log('Creating updates table...');
      return createDependenciesTable(versionInfo);
    });
  });
}

/**
 * Create a temporal environment on 'tmp' folder
 * @return a promise that could be either resolved or rejected if cannot create ./tmp folder
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
 * @return a promise that could be either resolved or rejected if cannot remove ./tmp folder
 */

function finishEnvironment() {
  console.log('Cleaning environment...');
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

    initEnvironment()
    .then(function() {
      return programRun();
    })
    .then(function() {
      return finishEnvironment();
    })
    .catch(function(){
      //but control+c still needs to be captured
      return finishEnvironment();
    })
    .then(function(){
      process.exit();
    });
  }
};
