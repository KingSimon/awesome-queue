'use strict';
const assert = require('assert');
const {Queue, Qnode, Qfunnel} = require('../lib/index');
const moment = require('moment');
const colors = require('colors/safe');

const log = (title, msg) => {
	console.log('[' + colors.green(moment().format('HH:mm:ss SSS')) + ']'
		+ colors.cyan(title)
		+ (msg !== undefined ? (colors.cyan(': ') + colors.yellow(msg)) : ''))
};


// 创建普通节点
const node = new Qnode({
	callback: function () {
		// 计数器
		let count = 0;
		log('执行普通节点');
		count++;
		log('执行结果', count);
		return count;
	},
});

// 创建延迟节点
const node2 = new Qnode({
	delay: 3000,
	callback: function (count) {
		log('执行延迟节点');
		count++;
		log('执行结果', count);
		return count;
	},
});

// 创建并行节点
const node3 = new Qnode({
	callback: function (count) {
		return Promise.all([
			new Promise(function (resolve, reject) {
				setTimeout(function () {
					log('执行并行节点1');
					resolve(1)
				}, 1000)
			}),
			new Promise(function (resolve, reject) {
				setTimeout(function () {
					log('执行并行节点2');
					resolve(1)
				}, 2000)
			}),
			new Promise(function (resolve, reject) {
				setTimeout(function () {
					log('执行并行节点3');
					resolve(1)
				}, 3000)
			}),
		]).then(function (list) {
			list.forEach(function (item) {
				count += item;
			});
			log('执行结果', count);
			return count;
		});
	},
});

let checked = false;

// setTimeout(function () {
//     checked = true;
// }, 15 * 1000);

//创建漏斗
const funnel = new Qfunnel({
	// cron: '*/30 * * * * ?',
	// cron: 30 * 1000,
	callback: function () {
		// 填满漏斗至10
		log('填满漏斗至10');
		this.set(10);
	}
});
let timeout;
// 创建容错节点
const node4 = new Qnode({
	retry: true,
	inspect: function (param, frist) {
		if (frist && !timeout) {
			// 打开漏斗
			funnel.open();
			timeout = setTimeout(function () {
					log('填满漏斗至10');
					funnel.set(10);
				// log('返回上面节点');
				// q.back(2);
				// log('结束队列');
				// q.stop();
				// log('暂停队列');
				// q.pause();
				// setTimeout(function () {
				//     log('重启队列');
				//     q.resume();
				// }, 10000)

			}, 10000);
		}
		// 从漏斗中获取一个
		checked = funnel.get(1);
		log('检查容错节点');
		log('检查结果', checked);
		return checked;
	},
	// cron: '*/5 * * * * ?',
	cron: 5 * 1000,
	callback: function (count) {
		log('执行容错节点');
		count++;
		log('执行结果', count);
		return count;
	},
});

const q = new Queue();

q.push(node);
q.push(node2);
q.push(node3);
q.push(node4);

q.on('process', function (process) {
	log('当前进度', process);
});

q.start().then(function (result) {
	log('完成任务');
	log('最终结果', result);
	// 关闭漏斗
	funnel.close();

	log('队列状态', q.status);
	log('当前进度', q.process);
}).catch(function (result) {
	log('意外终止', result);
});

