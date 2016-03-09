var bower = require('bower');
var cint = require('cint');
var bowerJson = require('bower-json');
var semverUtils = require('semver-utils');
var Table = require('cli-table');

function getDependenciesInfo() {
  return new Promise(function (resolve, reject) {
    bower.commands.list()
      .on('end', function (results) {
        var dependencies = cint.mapObject(results.dependencies, function (key, value) {
            return cint.keyValue(key, value.pkgMeta);
        });
        resolve(dependencies);
      })
      .on('error', function(e) {
        console.info('Bower list error...', e);
        reject();
      });
  });
}

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

function bowerInstall() {
  return new Promise(function (resolve, reject) {
    bower.commands.install([], { forceLatest: true })
      .on('end', function (results) {
        resolve();
      })
      .on('error', function(e) {
        console.info('Bower install error...', e);
        reject();
      });
  });
}

function obtainData() {
  var dependenciesInfoPromise = getDependenciesInfo();
  var localBowerPromise = parseLocalBower();
  return Promise.all([dependenciesInfoPromise, localBowerPromise]);
}

function mapVersionInfo(dependenciesInfo, localInfo) {
  var versionInfo = [];

  for (key in dependenciesInfo) {
    var localInfoVersion = getDependencyVersion(localInfo[key]);

    versionInfo.push({
      name: key,
      lastVersion: dependenciesInfo[key].version,
      localTarget: localInfoVersion
    });
  }

  return versionInfo;
}

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

function compareVersions(localVersion, lastVersion) {
  var localVersion = semverUtils.parse(localVersion);
  var lastVersion = semverUtils.parse(lastVersion);
  var versionResult = localVersion;

  if (localVersion.major < lastVersion.major || localVersion.minor < lastVersion.minor) {
    versionResult = lastVersion;
    versionResult.patch = '0';
  }

  versionResult = semverUtils.stringify(versionResult);
  return versionResult;
}

function programRun() {
  bowerInstall().then(function() {
    obtainData().then(function(results) {
      var versionInfo = mapVersionInfo(results[0], results[1]);
      versionInfo.forEach(function(component) {
        if (component.localTarget) {
          var correctVersion = compareVersions(component.localTarget, component.lastVersion);
          if (component.localTarget !== correctVersion) {
            table.push([component.name, '~' + correctVersion, component.localTarget]);
          }
        }
      });
      console.log(table.toString());
    });
  });
}

var table = new Table({
    head: ['Component name', 'New version', 'Local version'],
    colWidths: [40, 20, 20]
});

module.exports = {
  run: function (opts) {
    options = opts || {};
    programRun();
  }
};
