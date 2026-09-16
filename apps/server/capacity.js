export const DEFAULT_HOST_CAPACITY = Object.freeze({ total: 24, solo: 14, multiplayer: 10 })

const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype

/** A static count partition, not a memory estimate or a distributed lease.
 * Both HTTP services must use the returned options in the same host process.
 */
export function resolveHostCapacity({ serviceOptions = {}, multiplayerOptions = {}, maxActiveBattles = DEFAULT_HOST_CAPACITY.total } = {}) {
  if (!plain(serviceOptions) || !plain(multiplayerOptions) || (multiplayerOptions.policy !== undefined && !plain(multiplayerOptions.policy))) throw new TypeError('Invalid host service options')
  const capacity = {
    total: maxActiveBattles,
    solo: serviceOptions.maxSessions === undefined ? DEFAULT_HOST_CAPACITY.solo : serviceOptions.maxSessions,
    multiplayer: multiplayerOptions.policy?.maxActiveMatches === undefined ? DEFAULT_HOST_CAPACITY.multiplayer : multiplayerOptions.policy.maxActiveMatches,
  }
  for (const [name, value] of Object.entries(capacity)) {
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`Invalid host battle capacity ${name}`)
  }
  // Subtraction avoids overflowing safe integer arithmetic for extreme config.
  if (capacity.solo > capacity.total || capacity.multiplayer > capacity.total - capacity.solo) {
    throw new TypeError('Solo and multiplayer allocations exceed the host battle capacity')
  }
  return Object.freeze({
    capacity: Object.freeze(capacity),
    serviceOptions: Object.freeze({ ...serviceOptions, maxSessions: capacity.solo }),
    multiplayerOptions: Object.freeze({
      ...multiplayerOptions,
      policy: Object.freeze({ ...multiplayerOptions.policy, maxActiveMatches: capacity.multiplayer }),
    }),
  })
}
