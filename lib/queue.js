const inherits = require('inherits');
const EventEmitter = require('events').EventEmitter;


const Queue = function (options) {
  if (!(this instanceof Queue)) {
    return new Queue(options);
  }

  EventEmitter.call(this);
  options = options || {};
  this.autostart = options.autostart || false;
  this.name = options.name || '';
  this.results = [];
  this.completed = 0;
  this.status = 'create';
  this.jobs = [];
  this.olds = [];
};

inherits(Queue, EventEmitter);

const arrayMethods = [
  'pop',
  'shift',
  'indexOf',
  'lastIndexOf',
];

arrayMethods.forEach(function (method) {
  Queue.prototype[method] = function () {
    return Array.prototype[method].apply(this.jobs, arguments);
  };
});

Queue.prototype.slice = function (begin, end) {
  this.jobs = this.jobs.slice(begin, end);
  return this;
};

Queue.prototype.reverse = function () {
  this.jobs.reverse();
  return this;
};

const arrayAddMethods = [
  'push',
  'unshift',
  'splice',
];

arrayAddMethods.forEach(function (method) {
  Queue.prototype[method] = function () {
    const methodResult = Array.prototype[method].apply(this.jobs, arguments);
    if (this.autostart) {
      this.start();
    }

    return methodResult;
  };
});

Object.defineProperty(Queue.prototype, 'process', {
  get () {
    return `${this.processObj.completed}/${this.processObj.total}`;
  },
});

Object.defineProperty(Queue.prototype, 'length', {
  get () {
    return this.jobs.length;
  },
});

Queue.prototype.start = function (params, hiddenProcess) {
  const self = this;
  if (this.jobs.length === 0) {
    self.status = 'end';
    return Promise.resolve(params);
  }
  self.status = 'start';

  if (!hiddenProcess) {
    self.processObj = {
      status: self.status,
      completed: self.completed,
      total: self.jobs.length + self.completed,
    };
    self.emit('process', self.processObj);
  }

  return new Promise(function (resolve, reject) {
    const job = self.jobs.shift();
    const onSuccess = function (result) {
      if (self.status === 'start') {
        self.completed++;
        self.olds.push(job);
        self.results.push(result);
        self.processObj = {
          status: self.status,
          completed: self.completed,
          total: self.jobs.length + self.completed,
        };
        self.emit('process', self.processObj);
        resolve(result);
      }
    };

    const onError = function (result) {
      reject(result);
    };
    const onBack = function (result) {
      resolve(result);
    };
    job.on('back', onBack);
    job.exec(params).then(onSuccess)
      .catch(onError);
    self.job = job;

  }).then(function (result) {
    return self.start(result, true);
  })
    .catch(function (result) {
      return Promise.reject(result);
    });
};

Queue.prototype.resume = function () {
  const self = this;
  if (self.status === 'end') return;
  self.status = 'start';
  if (self.job) self.job.resume();
};

Queue.prototype.pause = function () {
  const self = this;
  if (self.status === 'end') return;
  self.status = 'pause';
  if (self.job) self.job.pause();
};

Queue.prototype.back = function (index) {
  index = index || 1;
  const self = this;
  if (self.job) {
    self.job.pause();
    self.jobs.unshift(self.job.restore());
  }
  for (let i = 0; i < index; i++) {
    const job = self.olds.pop();
    self.jobs.unshift(job.restore());
    self.results.pop();
  }
  self.completed -= index;
  self.job.emit('back', self.results[self.results.length - 1]);
};

Queue.prototype.stop = function () {
  const self = this;
  if (self.job) {
    self.job.stop();
  }
  self.status = 'end';
  self.jobs = [];
};

module.exports = Queue;
module.exports.default = Queue;
