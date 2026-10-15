// 在业务模块之前安装，模块/CSS加载失败时仍保留本地重试入口。
(() => {
  let state = 'loading';
  let frame;
  const native = message => window.DSHMStartup?.postMessage(message);
  const screen = () => document.getElementById('dshm-startup');
  const fail = () => {
    if (state !== 'loading') return;
    state = 'failed';
    clearTimeout(timeout);
    cancelAnimationFrame(frame);
    const show = () => {
      const cover = screen();
      if (!cover) return;
      cover.querySelectorAll('[hidden]').forEach(element => { element.hidden = false; });
      cover.querySelector('button').addEventListener('click', () => location.reload(), { once: true });
      if (document.documentElement.lang === 'en') {
        cover.querySelector('p').textContent = 'Could not load this page. Please try again.';
        cover.querySelector('button').textContent = 'Try again';
      }
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
    native('failed');
  };
  const timeout = setTimeout(fail, 30_000);
  window.addEventListener('error', fail, true);
  window.addEventListener('unhandledrejection', fail);
  window.__dshmStartup = {
    fail,
    ready() {
      if (state !== 'loading') return;
      // React已提交本地记录和输入框；让布局经过一帧，再交给原生的绘制屏障。
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (state !== 'loading') return;
          state = 'ready';
          clearTimeout(timeout);
          window.removeEventListener('error', fail, true);
          window.removeEventListener('unhandledrejection', fail);
          const cover = screen();
          if (window.DSHMStartup) {
            cover?.remove();
            native('ready');
          } else if (cover) {
            cover.style.opacity = '0';
            cover.addEventListener('transitionend', () => cover.remove(), { once: true });
            setTimeout(() => cover.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
          }
        });
      });
    },
  };
})();
