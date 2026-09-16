export const ROOM_POLICY = Object.freeze({
  version: 1,
  guestTtlMs: 24 * 60 * 60 * 1000,
  lobbyTtlMs: 15 * 60 * 1000,
  decisionMs: 5 * 60 * 1000,
  presenceMs: 45 * 1000,
  terminalTtlMs: 15 * 60 * 1000,
  cleanupMs: 1000,
  maxGuests: 128,
  maxRooms: 32,
  maxActiveMatches: 10,
  maxGuestOperations: 128,
  maxRoomReceipts: 2048,
  maxEventBytes: 128 * 1024,
  maxDeliveryEvents: 4096,
})

export function roomPolicy(overrides = {}) {
  if (!overrides || Object.getPrototypeOf(overrides) !== Object.prototype ||
      Object.keys(overrides).some(key => !Object.hasOwn(ROOM_POLICY, key) || key === 'version')) throw new TypeError('Invalid room policy')
  const policy = { ...ROOM_POLICY, ...overrides }
  if (Object.values(policy).some(value => !Number.isSafeInteger(value) || value < 1)) throw new TypeError('Room limits must be positive integers')
  return Object.freeze(policy)
}
