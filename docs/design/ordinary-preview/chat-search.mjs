export function searchChats(chats, input) {
  const query = input.trim().toLocaleLowerCase();
  if (!query) return [];
  return chats.flatMap(chat => {
    const matched = chat.messages.find(message => message.text.toLocaleLowerCase().includes(query));
    if (!chat.title.toLocaleLowerCase().includes(query) && !matched) return [];
    const text = (matched?.text || chat.messages[0]?.text || '').replace(/\s+/g, ' ');
    const offset = Math.max(0, text.toLocaleLowerCase().indexOf(query) - 24);
    return [{ chat, snippet: `${offset ? '…' : ''}${text.slice(offset, offset + 110)}${text.length > offset + 110 ? '…' : ''}` }];
  });
}
