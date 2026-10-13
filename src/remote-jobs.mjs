const empty = Object.freeze([]);

/** 新版任务来自原 ClientJobs 服务；旧版仍使用 session/control，不改原 Session store。 */
export function remoteJobs(state, sessionId) {
  return state.jobs ? state.jobs.rows[sessionId] ?? empty : state.list?.jobsBySession?.[sessionId] ?? empty;
}
