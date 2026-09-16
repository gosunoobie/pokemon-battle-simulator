const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

/** One serial writer is deliberate for the RAM beta. No engine lives in this store.
 * A database adapter must make the same guest indexes, room and receipts atomic.
 * Reads are immutable, writes are detached, and a rejected transaction publishes nothing.
 */
export function createMemoryRoomStore({ beforeCommit } = {}) {
  let tables = Object.fromEntries(['guests', 'tokens', 'rooms', 'active', 'invites'].map(name => [name, new Map()]))
  let tail = Promise.resolve()
  let closed = false
  return Object.freeze({
    transact(_scope, operation) {
      const pending = tail.then(async () => {
        if (closed) throw new Error('Room store is closed')
        const next = { ...tables }
        const dirty = new Set()
        const table = name => {
          if (!Object.hasOwn(next, name)) throw new TypeError('Unknown room table')
          return next[name]
        }
        const writable = name => {
          table(name)
          if (!dirty.has(name)) { next[name] = new Map(next[name]); dirty.add(name) }
          return next[name]
        }
        const transaction = Object.freeze({
          get: (name, key) => table(name).get(key),
          values: name => [...table(name).values()],
          entries: name => [...table(name).entries()],
          size: name => table(name).size,
          put(name, key, value) { writable(name).set(key, freeze(structuredClone(value))) },
          delete(name, key) { writable(name).delete(key) },
        })
        const result = await operation(transaction)
        if (dirty.size && beforeCommit) await beforeCommit(transaction)
        tables = next
        return structuredClone(result)
      })
      tail = pending.catch(() => {})
      return pending
    },
    async close() { await tail; closed = true; Object.values(tables).forEach(table => table.clear()) },
  })
}
