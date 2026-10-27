import React from 'react';
import * as attachmentPlugin from '@upstream/ui-attachment/src/client/index.ts';

// 隔离协议回放，图片仍经过正式附件接收器、Session投影与聊天插槽。
export function imageChatFixture(model, transport, channels, history) {
  let active = false, fail = false, corrupt = false, crashGallery = false, reads = 0, cancels = 0, sequence = 0, disposePlugin;
  const errors = [];
  model.ctx.slots.onEntryError((slot, _entry, error, info) => { if (active) errors.push({ slot, message: String(error), abdicated: info.abdicated }); });
  const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 100;
  const context = canvas.getContext('2d'); context.fillStyle = '#4566ff'; context.fillRect(0, 0, 160, 100);
  const raw = atob(canvas.toDataURL('image/png').split(',')[1]);
  const attachment = { attachmentId: 'fixture-image-v1', mediaType: 'image/png', name: '图片回归.png', width: 160, height: 100, bytes: raw.length };
  const imageLoader = model.pluginSlots.imageLoader;
  const loaders = new WeakMap();
  model.pluginSlots.imageLoader = reference => {
    const source = imageLoader(reference);
    if (!active) return source;
    if (!loaders.has(source)) loaders.set(source, Object.assign(ref => source(ref), {
      peek(ref) { if (crashGallery) throw Error('image-render-fixture-crash'); return source.peek(ref); },
      forget: (ref, expectedUrl) => source.forget?.(ref, expectedUrl),
    }));
    return loaders.get(source);
  };
  const request = model.client.request.bind(model.client), call = model.client.call.bind(model.client);
  model.client.call = (method, ...args) => active && method === 'socket.send' ? Promise.resolve() : call(method, ...args);
  model.client.request = (operation, onEvent, ...rest) => {
    if (!active || operation.method !== 'remote.attachment' || operation.attachmentId !== attachment.attachmentId) return request(operation, onEvent, ...rest);
    reads++; let cancelled = false;
    const promise = (async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
      if (cancelled) return;
      if (fail) throw Error('remote_attachment_unavailable');
      onEvent({ type: 'metadata', attachment });
      onEvent({ type: 'chunk', offset: 0, data: btoa(corrupt ? '\0'.repeat(raw.length) : raw) });
    })();
    return { id: `image-fixture-${reads}`, promise, cancel() { if (!cancelled) { cancelled = true; cancels++; } } };
  };
  const records = (count, asFile = false) => [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'user/message', surfaceOp: 'append', data: { id: 'image-user', role: 'user', source: { kind: 'user' },
      content: [{ type: 'text', text: 'IMAGE_USER_TEXT' }, ...Array.from({ length: count }, () => ({ type: asFile ? 'file' : 'image', attachment }))] } },
    { type: 'assistant/message', surfaceOp: 'append', data: { turn: 1, step: 1, stream: [], message: { id: 'image-answer', role: 'assistant',
      source: { kind: 'model', provider: 'fixture', model: 'fixture' }, content: [{ type: 'text', text: 'IMAGE_ANSWER_TEXT' }, { type: 'image', attachment }] } } },
    { type: 'step/end', data: { turn: 1, step: 1 } },
    { type: 'turn/end', data: { turn: 1, reason: { kind: 'completed' } } },
  ].map((event, seq) => ({ ...event, seq, time: seq + 1 }));
  return {
    failure(value) { fail = value; },
    corrupt(value) { corrupt = value; },
    renderFailure(value) { crashGallery = value; },
    state: () => ({ reads, cancels, errors, sequence }),
    bytes: () => Uint8Array.from(raw, character => character.charCodeAt(0)),
    async originalPlugin() { await model.ctx.plugin({ ...attachmentPlugin, name: '@deepseek-ai/dsh-client-ui-attachment' }).await(); },
    tool() {
      const events = [
        { type: 'turn/start', data: { turn: 2 } },
        { type: 'step/start', data: { turn: 2, step: 1 } },
        { type: 'tool/call', data: { turn: 2, step: 1, callId: 'image-read', name: 'read_image', arguments: '{"file_path":"image.png"}' } },
        { type: 'tool/result', surfaceOp: 'append', data: { turn: 2, step: 1, message: { id: 'image-tool', role: 'tool', source: { kind: 'tool', callId: 'image-read' },
          toolCallId: 'image-read', content: [{ type: 'text', text: 'IMAGE_TOOL_TEXT' }, { type: 'image', attachment }], isError: false } } },
        { type: 'step/end', data: { turn: 2, step: 1 } },
        { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
      ];
      events.forEach((event, index) => channels.get('one')({ type: 'event', event: { ...event, seq: index + 6, time: index + 10 } }));
    },
    async prepareChild() {
      active = true;
      await model.select(null);
      const events = records(1);
      history.active = true; history.sessionId = 'child-chat';
      history.snapshot = () => ({ cursor: events.at(-1).seq, hasMore: false, records: events.map(event => ({ type: 'event', event })) });
      await model.select('one');
    },
    async open({ count = 1, live = false, asFile = false } = {}) {
      active = true;
      transport.capabilities.channels = [...new Set([...(transport.capabilities.channels ?? []), 'attachment'])];
      await model.select(null);
      const events = records(count, asFile);
      history.active = true; history.sessionId = 'one';
      history.snapshot = () => ({ cursor: live ? -1 : events.at(-1).seq, hasMore: false,
        records: live ? [] : events.map(event => ({ type: 'event', event })) });
      await model.select('one');
      if (live) for (const event of events) {
        channels.get('one')({ type: 'event', event });
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      sequence++;
    },
    async plugin(slot, crash = false) {
      disposePlugin?.();
      const plugin = model.ctx.plugin({ name: '@fixture/image-slot', inject: ['slots'], apply(ctx) {
        ctx.slots.inject(slot, () => ctx.slots.register({ name: slot, priority: -100, locale: 'conversation' }, props => {
          if (crash) throw Error('image-slot-fixture-crash');
          return <output data-image-slot={slot}>{props.images.length}:IMAGE_PLUGIN</output>;
        }));
      } });
      await plugin.await(); disposePlugin = () => plugin.dispose();
    },
    disablePlugin() { disposePlugin?.(); disposePlugin = undefined; },
  };
}
