const schedule = require('./schedule');
const AsyncLock = require('async-lock');

const Qfunnel = function (options) {
    if (!(this instanceof Qfunnel)) {
        return new Qfunnel(options);
    }

    options = options || {};
    this.max = options.max || Infinity;
    this.volume = options.volume || 0;
    this.cron = options.cron;
    this.callback = options.callback;
    this.lock = new AsyncLock();
};

Qfunnel.prototype.open = function () {
    const self = this;
    schedule.cancelJob(self.schedule);
    self.schedule = schedule.scheduleJob(self.cron, function () {
        self.callback.call(self);
    });
};


Qfunnel.prototype.set = function (volume) {
    const self = this;
    return self.lock.acquire('volume', function () {
        self.volume = Math.min(volume, self.max);
        return self.volume;
    });
};

Qfunnel.prototype.add = function (rate) {
    const self = this;
    return self.lock.acquire('volume', function () {
        self.volume = Math.min(self.volume + rate, self.max);
        return self.volume;
    });
};

Qfunnel.prototype.size = function () {
    const self = this;
    return self.volume;
};

Qfunnel.prototype.get = function (rate) {
    const self = this;
    const result = self.volume - rate;
    if (result >= 0) {
        return self.lock.acquire('volume', function () {
            self.volume = result;
            return true;
        }).catch(function () {
            return false;
        });
    }
    return Promise.resolve(false);
};

Qfunnel.prototype.close = function () {
    const self = this;
    schedule.cancelJob(self.schedule);
};

module.exports = Qfunnel;
module.exports.default = Qfunnel;
