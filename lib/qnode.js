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
    this.delay = options.delay;
    this.retry = options.retry;
    this.inspect = options.inspect || function (params) {
        return true;
    };
    this.cron = options.cron || '0 */1 * * * ?';
    this.callback = options.callback;
}

inherits(Qnode, EventEmitter);

Qnode.prototype.exec = function (params) {
    var self = this;
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
            return Promise.resolve(self.callback.call(self, params)).then(function (result) {
                self.emit('end', result);
                return result;
            });
        } catch (e) {
            if (self.retry) {
                if (self.schedule) self.schedule.cancel();
                self.schedule = schedule.scheduleJob(self.cron, function () {
                    self.redo();
                });
            }
        }
    })
};

Qnode.prototype.redo = function () {
    var self = this;
    var params = self.params;

    if (!self.checking) {
        self.checking = true;
        Promise.resolve(self.inspect.call(self, params)).then(function (result) {
            self.checking = false;
            if (result === true) {
                if (self.schedule) self.schedule.cancel();
                self.exec(params);
            }
        })
    }
};
