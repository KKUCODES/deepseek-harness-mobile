export function draftStorage() {
  const entries = new Map();
  return { get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key),
    async batch(changes, current = () => true) {
      if (!current()) throw new Error('remote_draft_transfer_expired');
      for (const [key, value] of changes) { if (value === null) entries.delete(key); else entries.set(key, value); }
    } };
}
export const draftBinding = { paired: true, origin: 'https://relay.test', deviceId: 'device-one', fingerprint: 'public-one' };
