const inherits = require('inherits');
const EventEmitter = require('events').EventEmitter;
const schedule = require('./schedule');

const Qnode = function (options) {
  if (!(this instanceof Qnode)) {
    return new Qnode(options);
  }

  EventEmitter.call(this);
  options = options || {};
  this.options = options;
  this.name = options.name || '';
  this.delay = options.delay;
  this.retry = options.retry;
  this.inspect = options.inspect || function (params) {
    return true;
  };
  this.cron = options.cron || '*/1 * * * * ?';
  this.callback = options.callback;
  this.status = 'create';
};

inherits(Qnode, EventEmitter);

const cb = function (self) {
  if (self.status === 'start') {
    Promise.resolve(self.inspect.call(self, self.params, true)).then(function (result) {
      if (result === true) {
        return Promise.resolve(self.callback.call(self, self.params)).then(function (result) {
          if (self.status === 'start') {
            self.status = 'end';
            schedule.cancelJob(self.schedule);
            self.resolve(result);
          }
        })
          .catch(function (result) {
            if (!self.retry) {
              schedule.cancelJob(self.schedule);
              self.reject(result);
            } else {
              schedule.cancelJob(self.schedule);
              self.schedule = schedule.scheduleJob(self.cron, function () {
                cb(self);
              });
            }
          });
      }
      schedule.cancelJob(self.schedule);
      self.schedule = schedule.scheduleJob(self.cron, function () {
        cb(self);
      });

    });
  }
};

Qnode.prototype.exec = function (params) {
  const self = this;
  if (self.status === 'pause') {
    return Promise.resolve(params);
  }
  self.status = 'start';
  self.params = params;
  let p;
  if (self.delay) {
    p = new Promise(function (resolve, reject) {
      setTimeout(resolve, self.delay);
    });
  } else {
    p = Promise.resolve();
  }

  return p.then(function () {
    return new Promise(function (resolve, reject) {
      self.resolve = resolve;
      self.reject = reject;
      schedule.cancelJob(self.schedule);
      cb(self);
    });
  });
};

Qnode.prototype.resume = function () {
  const self = this;
  if (self.status === 'end') return;
  self.status = 'start';
  schedule.cancelJob(self.schedule);
  cb(self);
};

Qnode.prototype.pause = function () {
  const self = this;
  if (self.status === 'end') return;
  self.status = 'pause';
  schedule.cancelJob(self.schedule);
};

Qnode.prototype.restore = function () {
  const self = this;
  return new Qnode(self.options);
};

Qnode.prototype.stop = function () {
  const self = this;
  self.status = 'end';
  schedule.cancelJob(self.schedule);
  if (self.reject) self.reject(Qnode.prototype.errorResult);
};

Qnode.prototype.errorResult = {error: true, msg: 'stop queue'};

module.exports = Qnode;
module.exports.default = Qnode;
