var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;

module.exports = Queue;
module.exports.default = Queue;

function Queue(options) {
    if (!(this instanceof Queue)) {
        return new Queue(options)
    }

    EventEmitter.call(this);
    options = options || {};
    this.autostart = options.autostart || false;
    this.results = [];
    this.completed = 0;
    this.status = 'create';
    this.jobs = [];
    this.olds = [];
}

inherits(Queue, EventEmitter);

var arrayMethods = [
    'pop',
    'shift',
    'indexOf',
    'lastIndexOf'
];

arrayMethods.forEach(function (method) {
    Queue.prototype[method] = function () {
        return Array.prototype[method].apply(this.jobs, arguments)
    }
});

Queue.prototype.slice = function (begin, end) {
    this.jobs = this.jobs.slice(begin, end);
    return this
};

Queue.prototype.reverse = function () {
    this.jobs.reverse();
    return this
};

var arrayAddMethods = [
    'push',
    'unshift',
    'splice'
];

arrayAddMethods.forEach(function (method) {
    Queue.prototype[method] = function () {
        var methodResult = Array.prototype[method].apply(this.jobs, arguments);
        if (this.autostart) {
            this.start()
        }
        return methodResult
    }
});

Object.defineProperty(Queue.prototype, 'length', {
    get: function () {
        return this.jobs.length
    }
});

Queue.prototype.start = function (params, hiddenProcess) {
    var self = this;
    if (this.jobs.length === 0) {
        self.status = 'end';
        return params;
    }
    self.status = 'start';

    if (!hiddenProcess) {
        self.emit('process', {
            completed: self.completed,
            total: self.jobs.length + self.completed,
        });
    }

    return new Promise(function (resolve, reject) {
        var job = self.jobs.shift();
        var onend = function (result) {
            if (self.status === 'start') {
                self.completed++;
                self.olds.push(job);
                self.results.push(result);
                self.emit('process', {
                    completed: self.completed,
                    total: self.jobs.length + self.completed,
                });
                resolve(result);
            }
        };

        job.on('end', onend);
        var onerror = function (result) {
            resolve(result);
        };
        job.on('error', onerror);
        job.on('back', onerror);
        job.exec(params);
        self.job = job;

    }).then(function (result) {
        return self.start(result, true);
    });
};

Queue.prototype.resume = function () {
    var self = this;
    if (self.status === 'end') return;
    self.status = 'start';
    if (self.job) self.job.resume();
};

Queue.prototype.pause = function () {
    var self = this;
    if (self.status === 'end') return;
    self.status = 'pause';
    if (self.job) self.job.pause();
};

Queue.prototype.back = function (index) {
    index = index || 1;
    var self = this;
    if (self.job) {
        self.job.pause();
        self.jobs.unshift(self.job.restore());
    }
    for (var i = 0; i < index; i++) {
        var job = self.olds.pop();
        self.jobs.unshift(job.restore());
        self.results.pop();
    }
    self.completed -= index;
    self.job.emit('back', self.results[self.results.length - 1]);
};

Queue.prototype.stop = function () {
    var self = this;
    self.jobs = [];
    if (self.job) {
        self.job.pause();
        self.job.emit('error', {error: true, msg: 'stop queue'});
    }
};
