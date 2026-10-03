window.__ModuleLoader__.load({ id: '@dsh-mobile/panel-ui-verification', factory(require) {
  const React = require('react');
  const { Modal, Menu } = require('@deepseek-ai/dsh-client-ui-primitives');
  const id = '@dsh-mobile/panel-ui-verification';
  return { inject: ['slots', 'sidebarRightTabs', 'resources'], apply(ctx) {
    ctx.effect(() => ctx.sidebarRightTabs.register({ id, kind: 'dshm-verification-panel', title: () => 'DSHM 面板验收',
      guide: [{ id: 'dshm-panel', order: 1, title: () => 'DSHM 面板验收' }] }));
    ctx.slots.register({ name: 'sidebar.right.tab.menu.item', id: 'dshm-panel-menu' }, ({ tab, dismiss }) =>
      tab.kind === 'dshm-verification-panel' && React.createElement('button', { role: 'menuitem', onClick: () => {
        ctx.sidebarRight.openTab('dshm-verification-panel', { params: { marker: 'menu-action' } }); dismiss();
      } }, '插件菜单操作'));
    function FileResource({ address }) {
      const source = React.useMemo(() => ctx.resources.source(address), [address]);
      const snapshot = React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
      return React.createElement('output', { 'data-testid': 'live-file-resource' }, JSON.stringify(snapshot));
    }
    ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id }, function Panel({ sessionId, useTabInfo }) {
      const { tab } = useTabInfo();
      const [count, setCount] = React.useState(0), [path, setPath] = React.useState('');
      const [modal, setModal] = React.useState(false), [menu, setMenu] = React.useState(false), [value, setValue] = React.useState('');
      const [observing, setObserving] = React.useState(false);
      return React.createElement('section', { 'data-testid': 'live-panel', 'data-session': sessionId,
        style: { width: 720, boxSizing: 'border-box', padding: 20, background: '#fff', color: '#111' } },
      React.createElement('h3', null, 'DSHM 独立面板验证'),
      React.createElement('p', null, tab.navigation.params?.marker ?? 'initial'),
      React.createElement('button', { onClick: () => setModal(true) }, '打开插件弹窗'),
      React.createElement(Modal, { open: modal, onClose: () => setModal(false), title: '原插件弹窗', closeLabel: '关闭插件弹窗' },
        React.createElement('input', { 'aria-label': '插件弹窗输入', value, onChange: event => setValue(event.target.value) }),
        React.createElement(Menu, { open: menu, portal: true, anchor: React.createElement('button', { onClick: () => setMenu(true) }, '弹窗菜单'),
          items: [{ id: 'ok', label: '填入菜单值' }], onSelect: () => { setValue('menu-value'); setMenu(false); }, onClose: () => setMenu(false) })),
      React.createElement('button', { onClick: () => setCount(value => value + 1) }, `面板计数 ${count}`),
      React.createElement('button', { onClick: () => tab.actions.openTab('guide') }, '选择其他面板'),
      React.createElement('input', { 'aria-label': '面板测试文件', value: path, onChange: event => setPath(event.target.value), style: { width: 500 } }),
      React.createElement('button', { disabled: !path, onClick: () => setObserving(value => !value) }, observing ? '停止文件观察' : '观察文件资源'),
      observing && React.createElement(FileResource, { address: `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${path.split('/').map(encodeURIComponent).join('/')}` }),
      React.createElement('button', { disabled: !path, onClick: () => tab.actions.openResource(
        `dsh-resource://file/session/${encodeURIComponent(sessionId)}/${path.split('/').map(encodeURIComponent).join('/')}`, { params: { line: 1 } }) }, '面板预览文件'));
    });
  } };
} });
