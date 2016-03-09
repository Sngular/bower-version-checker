var bower = require('bower');
var cint = require('cint');
var bowerJson = require('bower-json');
var semverUtils = require('semver-utils');
var Table = require('cli-table');

var table = new Table({
    head: ['Component name', 'New version', 'Local version'],
    colWidths: [40, 20, 20]
});

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

  for (key in localDependencies) {
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
  if (link.indexOf('#') > -1 || link.indexOf('^') > -1 || link.indexOf('~') > -1) {
    var version = link.split('#');
    version = version[version.length - 1];
    version = version.split('^');
    version = version[version.length - 1];
    version = version.split('~');
    version = version[version.length - 1];
    return version;
  } else {
    return false;
  }
}

/**
 * Compare two versions and return bigger
 */

function compareVersions(localVersion, lastVersion) {
  var localVersion = semverUtils.parse(localVersion);
  var lastVersion = semverUtils.parse(lastVersion);
  var versionResult = localVersion;

  if (localVersion.major < lastVersion.major || localVersion.minor < lastVersion.minor) {
    versionResult = lastVersion;
  }

  versionResult = semverUtils.stringify(versionResult);
  return versionResult;
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

      versionInfo.forEach(function(component) {
        if (component.localTarget) {
          var correctVersion = compareVersions(component.localTarget, component.lastVersion);
          if (component.localTarget !== correctVersion) {
            table.push([component.name, '~' + correctVersion, component.localTarget]);
          }
        }
      });

      console.log('Dependencies that you can update :-)');
      console.log(table.toString());
    });

  });
}

module.exports = {
  run: function (opts) {
    options = opts || {};
    programRun();
  }
};
