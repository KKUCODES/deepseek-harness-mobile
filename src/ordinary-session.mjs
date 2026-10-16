import { OrdinaryHistory, completionMessages } from './ordinary-history.mjs';
import { ordinaryNative } from './ordinary-native.mjs';
import { OrdinaryTurn } from './ordinary-stream.mjs';
import { DEFAULT_MODEL, chatPreferences, isModel } from './ordinary-models.mjs';
import { cleanAttachments } from './ordinary-attachments.mjs';
import { requestOptions } from './ordinary-options.mjs';
import { deepseekProvider, providerOf, selectedModel, providerDraft } from './ordinary-providers.mjs';

/** 页面只订阅会话；请求归属在创建时固定，切页与继续输入不会改写正在生成的轮次。 */
export class OrdinarySession {
  #history;
  #native;
  #listeners = new Set();
  #queue = Promise.resolve();
  #drafts = new Map();
  #turn = null;
  #run = null;
  #stopRequested = false;
  #closing = false;
  #disposed = false;
  #defaultModel = DEFAULT_MODEL;
  #draftRevision = 0;
  #state = Object.freeze({ ready: false, configured: false, chat: null, draft: '', items: [], next: null,
    busy: false, owner: null, error: null, providers: [deepseekProvider(false)], defaultSelection: { model: DEFAULT_MODEL }, homePreferences: { model: DEFAULT_MODEL, thinking: false } });

  constructor({ history = new OrdinaryHistory(), native = ordinaryNative() } = {}) {
    this.#history = history;
    this.#native = native;
  }
  getSnapshot = () => this.#state;
  subscribe = listener => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  #publish(patch) {
    if (this.#disposed) return;
    const next = { ...this.#state, ...patch };
    if (['providers', 'chat', 'homePreferences'].some(key => Object.hasOwn(patch, key))) {
      next.configured = selectedModel(next.providers, next.chat ? chatPreferences(next.chat) : next.homePreferences).provider?.configured === true;
    }
    this.#state = Object.freeze(next);
    this.#listeners.forEach(listener => listener());
  }
  #serial(task) {
    const result = this.#queue.then(task);
    this.#queue = result.catch(() => {});
    return result;
  }
  async start() {
    try {
      await this.#history.open();
      await this.#history.recover();
      await this.#refresh();
      await this.refreshProviders();
      this.#publish({ ready: true });
    } catch (error) { this.#publish({ ready: true, error: error.code ?? error.message }); }
  }
  async #refresh() {
    const page = await this.#history.page();
    this.#publish({ items: page.items, next: page.next });
  }
  #show(chat) {
    this.#publish({ chat, draft: this.#drafts.get(chat.id) ?? chat.draft });
  }
  async #changed(id) {
    if (this.#state.chat?.id === id) this.#show(await this.#history.get(id));
    await this.#refresh();
  }
  clearError() { this.#publish({ error: null }); }
  setDefaultModel(model) {
    if (!isModel(model)) throw new Error('unsupported_model');
    this.#defaultModel = model;
    this.#publish({ defaultSelection: { model }, ...(!this.#state.chat && !this.#state.draft ? { homePreferences: { model, thinking: false } } : {}) });
  }
  async refreshProviders(catalog) {
    if (!catalog) catalog = this.#native.providers ? await this.#native.providers() : { providers: [deepseekProvider((await this.#native.status()).configured)] };
    const fallback = { model: this.#defaultModel };
    const selection = catalog.default && selectedModel(catalog.providers, catalog.default).model ? catalog.default : fallback;
    this.#publish({ providers: catalog.providers, defaultSelection: selection,
      ...(!this.#state.chat && !this.#state.draft ? { homePreferences: { ...selection, thinking: false } } : {}) });
  }
  saveProvider = async value => {
    if (this.#state.busy) throw new Error('request_busy');
    await this.refreshProviders(await this.#native.call('providers.save', providerDraft(value)));
  };
  removeProvider = async provider => {
    if (this.#state.busy) throw new Error('request_busy');
    await this.refreshProviders(await this.#native.call('providers.remove', { provider: provider.id, revision: provider.revision }));
  };
  setDefaultSelection = async selection => {
    if (this.#state.busy) throw new Error('request_busy');
    if (!selectedModel(this.#state.providers, selection).model) throw new Error('unsupported_model');
    await this.refreshProviders(await this.#native.call('providers.default', { provider: providerOf(selection), model: selection.model }));
  };
  configure = async (provider = providerOf(this.#state.chat ?? this.#state.homePreferences)) => {
    const result = await this.#native.configure(provider);
    if (this.#native.providers) await this.refreshProviders();
    else this.#publish({ providers: [deepseekProvider(result.configured)] });
    return result;
  };
  openRemote = () => this.#native.call('remote.open');
  notificationSettings = () => this.#native.call('notifications.settings');
  async pickAttachment(kind) {
    // 选择器打开前固定所属聊天，防止返回结果附到后来切换的聊天。
    const chat = await this.#serial(this.#ensureChat);
    const attachment = await this.#native.call('files.pick', { kind });
    return this.#serial(async () => {
      await this.#history.update(chat.id, value => { value.attachments = cleanAttachments([...(value.attachments ?? []), attachment]); });
      await this.#changed(chat.id);
    });
  }
  removeAttachment = attachmentId => this.#serial(async () => {
    const chat = this.#state.chat;
    if (!chat) return;
    await this.#history.update(chat.id, value => { value.attachments = (value.attachments ?? []).filter(item => item.id !== attachmentId); });
    await this.#changed(chat.id);
  });
  saveBackup = async () => this.#native.call('backup.save', { content: await this.export() });
  pickBackup = () => this.#native.call('files.pick', { kind: 'backup' });
  share = text => this.#native.call('share.text', { text });
  openLink = url => this.#native.call('links.open', { url });
  clearCache = () => this.#native.call('cache.clear');
  appInfo = () => this.#native.call('app.info');
  copyText = text => this.#native.call('clipboard.write', { text });
  stats = () => this.#history.stats();
  newChat = () => this.#serial(() => {
    this.#publish({ chat: null, draft: '', error: null, homePreferences: { ...this.#state.defaultSelection, thinking: false } });
  });
  select = id => this.#serial(async () => { this.#show(await this.#history.get(id)); this.clearError(); });
  search = options => this.#history.page(options);
  more = () => this.#serial(async () => {
    if (!this.#state.next) return;
    const page = await this.#history.page({ before: this.#state.next });
    const ids = new Set(this.#state.items.map(chat => chat.id));
    this.#publish({ items: [...this.#state.items, ...page.items.filter(chat => !ids.has(chat.id))], next: page.next });
  });
  #ensureChat = async () => {
    if (this.#state.chat) return this.#state.chat;
    const chat = await this.#history.create(this.#state.homePreferences);
    this.#drafts.set(chat.id, this.#state.draft);
    this.#show(chat);
    return chat;
  };
  editDraft = text => {
    if (typeof text !== 'string' || text.length > 100000) return Promise.reject(new Error('draft_limit'));
    if (!text && !this.#state.chat) return Promise.resolve();
    // 输入立即呈现，随后按顺序落盘；新聊天 ID 在同一队列分配，防止快速输入建立多个会话。
    this.#draftRevision++;
    this.#publish({ draft: text });
    const selectedId = this.#state.chat?.id;
    if (selectedId) this.#drafts.set(selectedId, text);
    return this.#serial(async () => {
      const chat = selectedId ? { id: selectedId } : await this.#ensureChat();
      await this.#history.update(chat.id, value => { value.draft = text; });
      await this.#changed(chat.id);
    }).catch(error => { this.#publish({ error: 'history_write_failed' }); throw error; });
  };
  preferences = patch => this.#serial(async () => {
    if (Object.keys(patch).some(key => !['provider', 'model', 'thinking', 'requestOptions'].includes(key))) throw new Error('invalid_preferences');
    if (patch.requestOptions !== undefined) patch = { ...patch, requestOptions: requestOptions(patch.requestOptions) };
    const current = this.#state.chat ? chatPreferences(this.#state.chat) : this.#state.homePreferences;
    const selection = { ...current, ...patch };
    const available = selectedModel(this.#state.providers, selection).model;
    if ((patch.model !== undefined || patch.provider !== undefined) && !available || patch.thinking !== undefined && typeof patch.thinking !== 'boolean') {
      throw new Error('invalid_preferences');
    }
    if (available?.thinking === 'none') patch = { ...patch, thinking: false };
    if (!this.#state.chat) { this.#publish({ homePreferences: { ...this.#state.homePreferences, ...patch } }); return; }
    const chat = await this.#ensureChat();
    await this.#history.update(chat.id, value => Object.assign(value, chatPreferences(value), patch));
    await this.#changed(chat.id);
  });
  rename = (id, title) => this.#serial(async () => { await this.#history.rename(id, title); await this.#changed(id); });
  remove = id => this.#serial(async () => {
    if (this.#state.owner === id) throw new Error('request_busy');
    await this.#history.delete(id);
    this.#drafts.delete(id);
    if (this.#state.chat?.id === id) this.#publish({ chat: null, draft: '' });
    await this.#refresh();
  });
  branch = (id, count, draft = '', attachments = []) => this.#serial(async () => {
    const chat = await this.#history.fork(id, count, draft, cleanAttachments(attachments));
    this.#show(chat); await this.#refresh(); return chat;
  });
  stop = () => { this.#stopRequested = true; this.#turn?.stop(); };
  send() {
    if (this.#closing) return Promise.reject(new Error('session_closed'));
    if (this.#state.busy) return Promise.reject(new Error('request_busy'));
    const selection = this.#state.chat ? chatPreferences(this.#state.chat) : this.#state.homePreferences;
    if (!selectedModel(this.#state.providers, selection).model) return Promise.reject(new Error('provider_model_missing'));
    if (!this.#state.configured) return Promise.reject(new Error('key_missing'));
    this.#stopRequested = false;
    this.#publish({ busy: true, error: null });
    const run = this.#send();
    this.#run = run;
    return run;
  }
  async #send() {
    let owner;
    let turn;
    let unsubscribe;
    let writes = Promise.resolve();
    let saveError;
    let pendingSnapshot;
    let flushTimer;
    const flush = () => {
      clearTimeout(flushTimer); flushTimer = undefined;
      const snapshot = pendingSnapshot; pendingSnapshot = undefined;
      if (!snapshot || saveError) return;
      writes = writes.then(() => {
        if (saveError) return;
        return this.#serial(async () => {
          await this.#history.update(owner, chat => {
            const stored = chat.turns.find(value => value.requestId === snapshot.requestId);
            if (!stored) throw new Error('ordinary_turn_missing');
            for (const key of ['status', 'content', 'reasoning', 'error', 'responseId', 'finishReason', 'usage']) stored[key] = snapshot[key];
          });
          if (this.#state.chat?.id === owner) this.#show(await this.#history.get(owner));
        });
      }).catch(error => { saveError = error; turn.stop(); this.#publish({ error: 'history_write_failed' }); });
    };
    try {
      const prepared = await this.#serial(async () => {
        if (this.#stopRequested) throw new Error('stopped');
        const chat = await this.#ensureChat();
        const current = await this.#history.get(chat.id);
        // 写草稿失败时，重试发送必须使用屏幕上的内容；同一次事务保存成功后才联网。
        const prompt = (this.#drafts.get(chat.id) ?? current.draft).trim();
        const attachments = cleanAttachments(current.attachments);
        if (!prompt && !attachments.length) throw new Error('empty_message');
        let preferences = chatPreferences(current);
        const selected = selectedModel(this.#state.providers, preferences);
        if (!selected.model) throw new Error('provider_model_missing');
        if (selected.model.thinking === 'none') preferences = { ...preferences, thinking: false };
        const messages = completionMessages(current, prompt, attachments, selected.model);
        const draftRevision = this.#draftRevision;
        owner = chat.id;
        const requestId = crypto.randomUUID();
        await this.#history.update(owner, value => {
          value.draft = '';
          value.attachments = [];
          if (!value.turns.length && value.title === '新聊天') value.title = prompt.split('\n')[0].slice(0, 60) || attachments[0].name;
          value.turns.push({ requestId, prompt, attachments, ...preferences, status: 'sending', content: '', reasoning: '', error: null });
        });
        if (this.#draftRevision === draftRevision) this.#drafts.set(owner, '');
        this.#publish({ owner });
        await this.#changed(owner);
        return { requestId, messages, ...preferences, ...(selected.provider.builtin ? {} : { providerRevision: selected.provider.revision }) };
      });
      turn = this.#turn = new OrdinaryTurn({ mode: 'ordinary', chatId: owner, requestId: prepared.requestId });
      unsubscribe = turn.subscribe(() => {
        const snapshot = turn.getSnapshot();
        pendingSnapshot = snapshot;
        // 合并同一小段时间内的分片，终态立即落盘；避免逐 token 重写整段历史。
        if (!['sending', 'streaming'].includes(snapshot.status)) flush();
        else if (!flushTimer) flushTimer = setTimeout(flush, 80);
      });
      await turn.run(signal => {
        if (this.#stopRequested) throw new DOMException('Request stopped', 'AbortError');
        return this.#native.open(prepared, signal);
      });
      flush();
      await writes;
      if (saveError) throw saveError;
      await this.#refresh();
      return turn.getSnapshot();
    } catch (error) {
      this.#publish({ error: saveError ? 'history_write_failed' : error.code ?? error.message });
      throw error;
    } finally {
      clearTimeout(flushTimer);
      unsubscribe?.(); turn?.dispose(); this.#turn = null;
      this.#publish({ busy: false, owner: null });
    }
  }
  export = () => this.#serial(() => this.#history.export());
  import = text => this.#serial(async () => {
    if (this.#state.busy) throw new Error('request_busy');
    const result = await this.#history.import(text);
    await this.#refresh(); return result;
  });
  clearHistory = () => this.#serial(async () => {
    if (this.#state.busy) throw new Error('request_busy');
    await this.#history.clear(); this.#drafts.clear();
    this.#publish({ chat: null, draft: '', items: [], next: null });
  });
  async dispose() {
    this.#closing = true;
    this.stop();
    await this.#run?.catch(() => {});
    await this.#queue;
    this.#disposed = true;
    this.#listeners.clear(); this.#history.close();
  }
}
