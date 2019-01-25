var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var schedule = require('node-schedule');
var moment = require('moment');

module.exports = Qfunnel;
module.exports.default = Qfunnel;


function Qfunnel(options) {
    if (!(this instanceof Qfunnel)) {
        return new Qfunnel(options)
    }

    EventEmitter.call(this);
    options = options || {};
    this.max = options.max || Infinity;
    this.volume = options.volume || 0;
    this.cron = options.cron || '0 0/1 * * * ?';
    this.callback = options.callback;
}

Qfunnel.prototype.open = function () {
    var self = this;
    if (self.schedule) self.schedule.cancel();
    self.schedule = schedule.scheduleJob(self.cron, function () {
        self.callback.call(self);
    });
};

Qfunnel.prototype.set = function (volume) {
    var self = this;
    self.volume = volume;
};

Qfunnel.prototype.add = function (rate) {
    var self = this;
    if ((self.max === Infinity) || (volume + rate > self.max)) {
        self.volume = volume + rate;
    } else {
        self.volume = self.max;
    }

};

Qfunnel.prototype.get = function (rate) {
    var self = this;
    var result = self.volume - rate;
    if (result > 0) {
        self.volume = result;
        return true;
    } else {
        return false;
    }
};

Qfunnel.prototype.close = function () {
    var self = this;
    if (self.schedule) self.schedule.cancel();
};
