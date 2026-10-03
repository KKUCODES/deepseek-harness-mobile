export function draftStorage() {
  const entries = new Map();
  return { get length() { return entries.size; }, key: index => [...entries.keys()][index] ?? null,
    getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
}
export const draftBinding = { paired: true, origin: 'https://relay.test', deviceId: 'device-one', fingerprint: 'public-one' };
