import session from './generated/session-remote.mjs';
import workspace from './generated/workspace-remote.mjs';
import commands from './generated/commands-remote.mjs';
import permissions from './generated/permission-presets-remote.mjs';
import agentPresets from './generated/agent-presets-remote.mjs';
import goals from './generated/goals-remote.mjs';
import subagents from './generated/subagents-remote.mjs';
import messageFeedback from './generated/message-feedback-remote.mjs';
import sessionFeedback from './generated/session-feedback-remote.mjs';

// 仅供离线回放；正式入口从已认证电脑的模块图加载 api-remotes。
export async function loadTestRemotes() {
  return { async apply(ctx) {
    await ctx.remote.$mount(session);
    await ctx.remote.$mount(workspace);
    await ctx.remote.$mount(commands);
    await ctx.remote.$mount(permissions);
    await ctx.remote.$mount(agentPresets);
    await ctx.remote.$mount(goals);
    await ctx.remote.$mount(subagents);
    await ctx.remote.$mount(messageFeedback);
    await ctx.remote.$mount(sessionFeedback);
  } };
}

export { RemoteModel } from '../../src/remote-model.mjs';
export { RemoteTransport } from '../../src/remote-transport.mjs';
