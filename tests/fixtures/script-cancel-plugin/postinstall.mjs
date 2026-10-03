// 只输出自身 PID 并有限等待；不访问文件、环境变量或网络。
// 验收必须先确认此进程存活，再从手机取消，避免把下载取消当作脚本取消。
console.log(`DSHM_CANCEL_SCRIPT_STARTED:${process.pid}`);
await new Promise(resolve => setTimeout(resolve, 90000));
console.log('DSHM_CANCEL_SCRIPT_FINISHED');
