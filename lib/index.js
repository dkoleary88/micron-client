'use strict';

let buildConfig = require('./config_builder');
let fs = require('fs');
let _ = require('lodash');
let helpers = require('./helpers');
let genit = require('genit');

let toss = helpers.toss;

// Load clients
let clients = {};
let clientDir = fs.readdirSync(__dirname + '/clients');
_.each(clientDir, function (fileName) {
  if (/\.js$/.test(fileName) && fileName !== 'index.js') {
    clients[fileName.replace(/\.js$/, '')] = require('./clients/' + fileName);
  }
});

// Return client builder
module.exports = function (config) {
  config = buildConfig(config);
  let client = {};
  _.each(config.resources, function (settings, name) {
    if (_.isFunction(settings)) return;

    settings.method = settings.method || 'http';
    if (!_.isFunction(clients[settings.method])) toss('Attempted to use unsupported method [' + settings.method + ']');
    settings.timeout = settings.timeout || config.timeout;
    client[name] = clients[settings.method](settings);
  });

  client.status = function *(timeout) {
    let status = {};
    yield genit.each(client, function *(service, name) {
      if (name !== 'status') {
        let result;
        try {
          result = yield service.status(timeout);
        } catch (e) {
          result = 'Error';
          console.log(e.stack);
        }

        status[name] = result;
      }
    });

    return status;
  };

  return client;
};

module.exports.middleware = {
  koa : function (config) {
    let micron = module.exports(config);
    return function *(next) {
      this.micron = micron;
      yield next;
    };
  },
  express: function (config) {
    let micron = module.exports(config);
    return function (req, res, next) {
      req.micron = micron;
      return next();
    };
  }
};
