const schedule = require('node-schedule');

const isInteger = function (obj) {
  return Math.floor(obj) === obj;
};

module.exports = {
  scheduleJob: (cron, callback) => {
    if (cron) {
      if (isInteger(cron)) {
        return setInterval(callback, cron);
      }
      return schedule.scheduleJob(cron, callback);
    }
  },
  cancelJob: (job) => {
    if (job) {
      if (job instanceof schedule.Job) {
        return job.cancel();
      }

      return clearInterval(job);

    }
  },
};
