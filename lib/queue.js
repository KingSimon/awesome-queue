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
    this.running = false;
    this.jobs = [];
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
    this.running = true;
    var self = this;
    if (this.jobs.length === 0) {
        this.running = false;
        return params;
    }

    if(!hiddenProcess) {
        self.emit('process' ,{
            completed: self.completed,
            total: self.jobs.length + self.completed,
        });
    }

    return new Promise(function (resolve, reject) {
        var job = self.jobs.shift();
        job.on('end', function (result) {
            self.completed ++;
            self.results.push(result);
            self.emit('process' ,{
                completed: self.completed,
                total: self.jobs.length + self.completed,
            });
            resolve(result);
        });
        job.exec(params);
    }).then(function (result) {
        return self.start(result, true);
    });
};

