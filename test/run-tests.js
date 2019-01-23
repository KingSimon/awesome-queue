'use strict';
const assert = require('assert');
const {Queue, Qnode, Qfunnel} = require('../lib/index');
const moment = require('moment');

// 创建普通节点
var node = new Qnode({
    callback: function () {
        // 计数器
        let count = 0;
        console.log(moment().format('HH:mm:ss') + ':执行普通节点');
        count++;
        console.log('执行结果：' + count);
        return count;
    },
});

// 创建延迟节点
var node2 = new Qnode({
    delay: 3000,
    callback: function (count) {
        console.log(moment().format('HH:mm:ss') + ':执行延迟节点');
        count++;
        console.log('执行结果：' + count);
        return count;
    },
});

// 创建并行节点
var node3 = new  Qnode({
    callback: function (count) {
        return Promise.all([
            new Promise(function (resolve, reject) {
                setTimeout(function () {
                    console.log(moment().format('HH:mm:ss') + ':执行并行节点1');
                    resolve(1)
                }, 1000)
            }),
            new Promise(function (resolve, reject) {
                setTimeout(function () {
                    console.log(moment().format('HH:mm:ss') + ':执行并行节点2');
                    resolve(1)
                }, 2000)
            }),
            new Promise(function (resolve, reject) {
                setTimeout(function () {
                    console.log(moment().format('HH:mm:ss') + ':执行并行节点3');
                    resolve(1)
                }, 3000)
            }),
        ]).then(function (list) {
            list.forEach(function (item) {
                count += item;
            });
            console.log('执行结果：' + count);
            return count;
        });
    },
});

let checked = false;

setTimeout(function () {
    checked = true;
}, 15 * 1000);

//创建漏斗
var funnel = new Qfunnel({
    cron: '*/15 * * * * ?',
    callback: function () {
        // 填满漏斗至10
        this.set(10);
    }
});
// 打开漏斗
funnel.open();
// 创建容错节点
var node4 = new Qnode({
    retry: true,
    inspect: function () {
        // 从漏斗中获取一个
        return funnel.get(1);
    },
    cron: '*/5 * * * * ?',
    callback: function (count) {
        console.log(moment().format('HH:mm:ss') + ':执行容错节点');
        if (!checked) {
            console.log('执行错误');
            throw new Error('执行错误');
        }
        count++;
        console.log('执行结果：' + count);
        return count;
    },
});

var q = new Queue();

q.push(node);
q.push(node2);
q.push(node3);
q.push(node4);

q.on('process', function (process) {
    console.log(process);
});

q.start().then(function (result) {
    console.log(moment().format('HH:mm:ss') + ':完成任务');
    console.log(result);
    // 关闭漏斗
    funnel.close();
});

