var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var schedule = require('node-schedule');
var moment = require('moment');

module.exports = Qnode;
module.exports.default = Qnode;


function Qnode(options) {
    if (!(this instanceof Qnode)) {
        return new Qnode(options)
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
    this.cron = options.cron || '0 */1 * * * ?';
    this.callback = options.callback;
    this.status = 'create';
}

inherits(Qnode, EventEmitter);

Qnode.prototype.exec = function (params) {
    var self = this;
    if (self.status === 'pause') {
        return Promise.reject();
    }
    self.status = 'start';
    self.params = params;
    var p;
    if (self.delay) {
        p = new Promise(function (resolve, reject) {
            setTimeout(resolve, self.delay);
        })
    } else {
        p = Promise.all([])
    }

    return p.then(function () {
        try {
            Promise.resolve(self.inspect.call(self, params, true)).then(function (result) {
                if(result === true){
                    return Promise.resolve(self.callback.call(self, params)).then(function (result) {
                        if (self.status === 'start') {
                            self.status = 'end';
                            self.emit('end', result);
                        }
                        return result;
                    });
                } else {
                    if (self.status === 'start' && self.retry) {
                        if (self.schedule) self.schedule.cancel();
                        self.schedule = schedule.scheduleJob(self.cron, function () {
                            self.resume();
                        });
                    }
                }
            });
        } catch (e) {
            if (self.status === 'start' && self.retry) {
                if (self.schedule) self.schedule.cancel();
                self.schedule = schedule.scheduleJob(self.cron, function () {
                    self.resume();
                });
            }
        }
    })
};

Qnode.prototype.resume = function () {
    var self = this;
    if (self.status === 'end') return;
    if (self.status === 'pause') {
        self.checking = false;
        self.status = 'check';
        self.schedule = schedule.scheduleJob(self.cron, function () {
            self.resume();
        });
    }
    var params = self.params;

    if (!self.checking) {
        self.checking = true;
        self.status = 'check';
        Promise.resolve(self.inspect.call(self, params)).then(function (result) {
            self.checking = false;
            if (result === true) {
                if (self.schedule) self.schedule.cancel();
                self.exec(params);
            }
        })
    }
};

Qnode.prototype.pause = function () {
    var self = this;
    if (self.status === 'end') return;
    self.status = 'pause';
    if (self.schedule) self.schedule.cancel();
};

Qnode.prototype.restore = function () {
    var self = this;
    return new Qnode(self.options);
};
