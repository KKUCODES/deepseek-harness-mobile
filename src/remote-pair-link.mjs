/** 仅用于确认页展示服务器和 HTTP 提示；配对准入仍由原生严格校验。 */
export function pairingServerOf(link) {
  try {
    const value = new URL(link);
    const server = value.protocol === 'dshm:' ? new URL(value.searchParams.get('server')) : value;
    return ['http:', 'https:'].includes(server.protocol) && !server.username && !server.password ? server.origin : null;
  } catch { return null; }
}
