<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import BattleView from '../../shared/battle/BattleView.vue'
import { activeMembers, spriteUrl, buildBattleLog } from '../../shared/battle/index.js'
import { multiplayerRequest, createOperationId } from './api.js'
import { createRoomSession } from './roomSession.js'

const config = shallowRef(null), guest = shallowRef(null), state = shallowRef({ envelope: null, playing: false, pending: null })
const battle = ref(null), displayed = shallowRef(null), log = ref([]), logHost = ref(null)
const name = ref(''), invitation = ref(''), busy = ref(false), connecting = ref(true), error = ref(''), notice = ref('')
const pendingOperation = shallowRef(null), networkOkay = ref(true), confirming = ref(false), now = ref(Date.now())
const pollInFlight = ref(false), unavailable = ref(false)
let lifetime = 0, disposed = false, pollTimer, clockTimer, pollController, commandController, failures = 0, serverOffset = 0, lastServerNow = -1, syncRequested = false
const room = computed(() => state.value.envelope?.room)
const latest = computed(() => state.value.envelope?.view)
const active = computed(() => room.value?.status === 'active')
const terminal = computed(() => ['ended', 'interrupted', 'closed', 'expired'].includes(room.value?.status))
const selected = computed(() => config.value?.presets.find(p => p.id === room.value?.own.presetId) ?? config.value?.presets[0])
const lead = computed(() => selected.value?.team[room.value?.own.leadIndex ?? 0])
const decision = computed(() => latest.value?.decision)
const locked = computed(() => busy.value || !!pendingOperation.value || state.value.playing || !active.value || !networkOkay.value)
const members = computed(() => activeMembers(displayed.value ?? latest.value))
const switches = computed(() => new Set(decision.value?.switches?.map(m => m.memberId) ?? []))
const inviteUrl = computed(() => room.value?.inviteToken ? `${location.origin}/multiplayer#join=${room.value.inviteToken}` : '')
const countdown = computed(() => {
  const deadline = state.value.envelope?.deadlineAt
  if (!deadline || !active.value) return ''
  const remaining = Math.max(0, Math.ceil((deadline - now.value) / 1000))
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
})
const moveInfo = move => config.value?.moves?.[String(move.id ?? move).toLowerCase().replace(/[^a-z0-9]/g, '')] ?? {}
const resultTitle = computed(() => room.value?.status === 'interrupted' ? 'Battle interrupted.'
  : latest.value?.result?.kind === 'win' ? latest.value.result.winnerSeat === latest.value.seat ? 'You won the battle.' : 'Your opponent won.'
    : latest.value?.result?.kind === 'draw' ? 'The battle is a draw.' : 'No contest.')
const prompt = computed(() => !networkOkay.value ? 'Reconnecting to the room…'
  : state.value.playing ? 'Playing the turn…'
    : pendingOperation.value ? 'Confirming your action…'
      : decision.value?.kind === 'wait' ? 'Waiting for your opponent…'
        : decision.value?.kind === 'switch' ? 'Choose a teammate to send out.' : `What will ${members.value[0]?.species || 'your Pokémon'} do?`)

function remember(id) { try { if (id) sessionStorage.setItem('battle-room-v1', id); else sessionStorage.removeItem('battle-room-v1') } catch {} }
const session = createRoomSession({
  onChange(value) {
    state.value = value
    if (!value.pending) pendingOperation.value = null
  },
  clear() { battle.value?.clear(); displayed.value = null; log.value = [] },
  async present(batch, { isCurrent }) {
    await nextTick(); if (!isCurrent()) return
    await battle.value?.present({ ...batch, playerLabel: room.value?.own.name || 'Your team', opponentName: room.value?.opponent?.name || 'Opponent', opponentTitle: 'Guest trainer' })
  },
  async sync(view, { isCurrent }) {
    battle.value?.clear()
    await nextTick(); if (!isCurrent()) return
    await battle.value?.sync(view)
    if (isCurrent()) displayed.value = view
  },
  onEvents(events, before, after) {
    const seen = new Set(log.value.map(entry => entry.cursor))
    log.value = [...log.value, ...buildBattleLog(events, before, after).filter(entry => !seen.has(entry.cursor))].slice(-150)
    nextTick(() => { if (logHost.value) logHost.value.scrollTop = logHost.value.scrollHeight })
  },
  onError(cause) { error.value = cause.message },
})

function accept(response, { enter = false, synchronize = false } = {}) {
  if (response?.expired) {
    if (!room.value || response.roomId === room.value.id) { session.reset(); remember(null) }
    notice.value = 'That room has expired. Create a new invitation to play again.'
    return
  }
  if (response?.left) {
    if (response.roomId === room.value?.id) { session.reset(); remember(null) }
    pendingOperation.value = null; confirming.value = false
    return
  }
  if (!response?.room) return
  const accepted = enter ? session.enter(response, { synchronize }) : session.ingest(response, { synchronize })
  if (!accepted) return
  if (enter) lastServerNow = -1
  if (Number.isFinite(response.serverNow) && response.serverNow >= lastServerNow) {
    lastServerNow = response.serverNow; serverOffset = response.serverNow - Date.now(); now.value = Date.now() + serverOffset
  }
  remember(response.room.id)
  if (response.ack?.accepted === false) error.value = `That action was rejected (${response.ack.code}). The room shows the current choices.`
}
function inviteToken(value) {
  const text = value.trim()
  if (/^[a-f0-9]{32,128}$/.test(text)) return text
  try { return new URLSearchParams(new URL(text, location.origin).hash.slice(1)).get('join') || '' } catch { return '' }
}
function schedule(delay) {
  clearTimeout(pollTimer)
  if (disposed || !room.value || terminal.value || unavailable.value) return
  pollTimer = setTimeout(() => void poll(), delay ?? (document.hidden ? 10000 : active.value ? 1500 : 2000))
}
async function poll(synchronize = false) {
  if (synchronize) syncRequested = true
  if (disposed || !room.value || pollInFlight.value || unavailable.value) return
  synchronize = syncRequested; syncRequested = false
  clearTimeout(pollTimer)
  const token = lifetime, id = room.value.id, before = session.snapshot()
  pollInFlight.value = true
  const request = new AbortController(); pollController = request
  const query = new URLSearchParams({ afterRevision: String(before.revision), afterCursor: String(before.cursor) })
  if (before.envelope?.matchId) query.set('matchId', before.envelope.matchId)
  if (synchronize) query.set('sync', '1')
  try {
    const response = await multiplayerRequest(`rooms/${encodeURIComponent(id)}/updates?${query}`, { signal: request.signal })
    if (disposed || lifetime !== token || room.value?.id !== id) return
    networkOkay.value = true; failures = 0
    accept(response, { synchronize })
  } catch (cause) {
    if (disposed || lifetime !== token || room.value?.id !== id) return
    networkOkay.value = false; failures++
    if (['GUEST_EXPIRED', 'UNAUTHORIZED', 'NO_GUEST', 'ROOM_NOT_FOUND', 'ROOM_EXPIRED', 'NOT_A_MEMBER'].includes(cause.code) || [401,403,404,410].includes(cause.status)) {
      unavailable.value = true
      error.value = `${cause.message} Return to the lobby to create or join a new room.`
      clearTimeout(pollTimer)
      return
    }
    error.value = cause.message
  } finally {
    if (pollController === request) {
      pollInFlight.value = false; pollController = null
      if (!disposed && lifetime === token && room.value?.id === id) schedule(syncRequested ? 0 : failures ? Math.min(15000, 1500 * 2 ** Math.min(failures, 3)) + Math.random() * 500 : undefined)
    }
  }
}
async function initialize() {
  if (busy.value) return
  const token = ++lifetime
  pollController?.abort(); pollController = null; pollInFlight.value = false; commandController?.abort(); clearTimeout(pollTimer)
  connecting.value = true; error.value = ''; networkOkay.value = true; unavailable.value = false; syncRequested = false
  const request = new AbortController(); commandController = request
  try {
    const settings = await multiplayerRequest('config', { signal: request.signal })
    const identity = await multiplayerRequest('guest', { method: 'POST', body: {}, signal: request.signal })
    const recovered = await multiplayerRequest('session', { signal: request.signal })
    if (disposed || lifetime !== token) return
    config.value = settings; guest.value = identity.guest; name.value = identity.guest.name || ''
    if (recovered.room) accept(recovered.room, { enter: true, synchronize: true })
    else {
      let previous
      try { previous = sessionStorage.getItem('battle-room-v1') } catch {}
      if (previous) {
        try {
          const response = await multiplayerRequest(`rooms/${encodeURIComponent(previous)}/updates?sync=1`, { signal: request.signal })
          if (!disposed && lifetime === token) accept(response, { enter: true, synchronize: true })
        } catch (cause) {
          if (disposed || lifetime !== token) return
          if ([401,403,404,410].includes(cause.status)) { session.reset(); remember(null) } else throw cause
        }
      } else session.reset()
    }
  } catch (cause) { if (!disposed && lifetime === token) { error.value = cause.message; networkOkay.value = false } }
  finally { if (!disposed && lifetime === token) { connecting.value = false; schedule(0) } }
}
async function execute(operation, payload = {}, retry = false) {
  if (busy.value || disposed || !retry && pendingOperation.value) return
  const id = room.value?.id
  const request = retry ? pendingOperation.value : {
    path: operation === 'create' ? 'rooms' : operation === 'join' ? 'rooms/join' : `rooms/${encodeURIComponent(id)}/${operation}`,
    operation, body: { ...payload, operationId: createOperationId(), ...(id ? { afterCursor: state.value.cursor, afterRevision: state.value.revision } : {}) },
  }
  if (!request) return
  if (operation === 'choice' && !retry) request.body.commandId = request.body.operationId
  pendingOperation.value = request
  session.setPending(request.body)
  busy.value = true; error.value = ''; notice.value = ''
  commandController = new AbortController()
  const token = lifetime
  try {
    if (!retry && ['create', 'join'].includes(operation)) {
      const identity = await multiplayerRequest('guest', { method: 'POST', body: name.value.trim() ? { name: name.value.trim() } : {}, signal: commandController.signal })
      if (disposed || lifetime !== token) return
      guest.value = identity.guest
    }
    const response = await multiplayerRequest(request.path, { method: 'POST', body: request.body, signal: commandController.signal })
    if (disposed || lifetime !== token) return
    networkOkay.value = true; failures = 0
    accept(response, { enter: ['create', 'join'].includes(request.operation) })
    const acknowledgedId = response.ack?.operationId ?? response.ack?.commandId
    if (acknowledgedId === request.body.operationId) session.clearPending()
    if (request.operation === 'join') { invitation.value = ''; history.replaceState(null, '', location.pathname) }
    confirming.value = false
  } catch (cause) {
    if (disposed || lifetime !== token) return
    error.value = cause.message
    if (cause.status >= 400 && cause.status < 500 && cause.status !== 408 && cause.status !== 429) session.clearPending()
  } finally { if (!disposed && lifetime === token) { busy.value = false; schedule(0) } }
}
function createRoom() { return execute('create') }
function joinRoom() {
  const token = inviteToken(invitation.value)
  if (!token) { error.value = 'Paste a complete invitation link or room token.'; return }
  return execute('join', { inviteToken: token })
}
function selectTeam(presetId, leadIndex = 0) {
  return execute('selection', { presetId, leadIndex, selectionRevision: room.value.own.selectionRevision })
}
function ready() { return execute('ready', { ready: !room.value.own.ready, selectionRevision: room.value.own.selectionRevision, membershipEpoch: room.value.membershipEpoch }) }
function choose(action) { return execute('choice', { matchId: latest.value.matchId, decisionId: decision.value.id, action }) }
function forfeit() { return execute('forfeit', { matchId: latest.value.matchId }) }
function leave() { return execute('leave') }
function forget() {
  lifetime++; pollController?.abort(); pollController = null; pollInFlight.value = false; commandController?.abort(); clearTimeout(pollTimer)
  session.reset(); remember(null); busy.value = false; error.value = ''; networkOkay.value = true
  void initialize()
}
async function copyInvite() {
  try { await navigator.clipboard.writeText(inviteUrl.value); notice.value = 'Invitation copied. Send it to your opponent.' }
  catch { notice.value = 'Select and copy the invitation link above.' }
}
function visible() { if (!document.hidden && room.value) void poll(true); else schedule() }
onMounted(() => {
  invitation.value = new URLSearchParams(location.hash.slice(1)).get('join') || ''
  document.addEventListener('visibilitychange', visible)
  clockTimer = setInterval(() => { now.value = Date.now() + serverOffset }, 1000)
  void initialize()
})
onBeforeUnmount(() => {
  disposed = true; lifetime++; clearTimeout(pollTimer); clearInterval(clockTimer)
  pollController?.abort(); commandController?.abort(); document.removeEventListener('visibilitychange', visible); session.dispose()
})
</script>

<template>
  <div class="sim-shell mp-shell">
    <a class="sim-skip-link" href="#multiplayer">Skip to multiplayer</a>
    <header class="sim-header">
      <a class="sim-brand" href="/"><span class="ball-mark" aria-hidden="true"></span>Battle Lab<span class="sim-brand-dot">.</span></a>
      <nav class="sim-nav" aria-label="Main navigation"><a href="/">Home</a><a href="/multiplayer" aria-current="page">Multiplayer</a><a href="/simulation">Simulation</a><a href="/preview">Move preview</a><a href="/playground">FX playground</a></nav>
    </header>
    <main id="multiplayer">
      <div class="sim-heading"><div><p class="sim-eyebrow">A FRIEND. A TEAM. A CHALLENGE.</p><h1>Private battle<span>.</span></h1><p class="sim-intro">Choose your team. Invite a friend. Make every turn count.</p></div><div class="sim-format"><span class="sim-dot"></span> GENERATION 3 SINGLES <small>Two players · Preset teams · Level 100</small></div></div>
      <div v-if="error" class="sim-error" role="alert"><p>{{ error }}</p><div class="sim-error-actions"><button v-if="pendingOperation" :disabled="busy" @click="execute(pendingOperation.operation, {}, true)">Retry last action</button><button v-if="room" :disabled="busy || pollInFlight" @click="poll(true)">Sync room</button><button v-if="!room" :disabled="busy" @click="initialize">Reconnect</button><button v-if="room && !networkOkay" :disabled="busy" @click="forget">Return to lobby</button></div></div>
      <p v-if="notice" class="mp-notice" role="status">{{ notice }}</p>
      <div v-if="connecting" class="sim-loading" role="status">Connecting to multiplayer…</div>
      <section v-if="config && !room && !connecting" class="sim-setup mp-welcome" aria-labelledby="room-title">
        <p class="sim-eyebrow">YOUR NEXT RIVAL IS ONE LINK AWAY</p><h2 id="room-title">Bring a friend to the battlefield.</h2>
        <p class="mp-muted">Play a private six-on-six battle with a ready-made team. No account needed.</p>
        <label class="mp-name">Trainer name <span>Optional · 24 characters</span><input v-model="name" maxlength="24" autocomplete="nickname" placeholder="Guest trainer" :disabled="busy || !!pendingOperation"></label>
        <div class="mp-entry-grid">
          <section class="mp-entry"><span class="mp-step">01 / HOST A BATTLE</span><h3>Set the challenge.</h3><p>Create a room, pick your team and send the invitation to your opponent.</p><button class="sim-primary" :disabled="busy || !!pendingOperation" @click="createRoom">Create private room <span aria-hidden="true">↗</span></button></section>
          <form class="mp-entry" @submit.prevent="joinRoom"><span class="mp-step">02 / ACCEPT AN INVITATION</span><h3>Meet your rival.</h3><label for="invitation">Invitation link</label><input id="invitation" v-model="invitation" type="text" placeholder="Paste your invitation link" autocomplete="off" :disabled="busy || !!pendingOperation"><button class="mp-secondary" :disabled="busy || !!pendingOperation || !invitation.trim()">Join room <span aria-hidden="true">↗</span></button></form>
        </div>
        <p class="sim-setup-note">Guest rooms are temporary. Reconnect in this browser while the room is available. A server restart ends open rooms.</p>
      </section>
      <template v-if="room">
        <section class="mp-room-strip" aria-label="Room status"><div><span class="sim-dot" :class="{ 'mp-offline': !networkOkay }"></span><strong>{{ room.own.name || 'You' }}</strong><span class="mp-versus">VS</span><strong>{{ room.opponent?.name || 'Waiting for a friend' }}</strong></div><span>{{ !networkOkay ? 'Reconnecting' : room.opponent && room.opponent.connected === false ? 'Opponent reconnecting' : room.status === 'lobby' ? 'Private lobby' : terminal ? 'Battle complete' : 'Connected' }}</span><span v-if="countdown" class="mp-clock" aria-label="Time left for your action">Your action · {{ countdown }}</span></section>
        <section v-if="room.status === 'lobby'" class="sim-setup" aria-labelledby="lobby-title">
          <div class="sim-setup-heading"><div><p class="sim-eyebrow">PREPARE FOR BATTLE</p><h2 id="lobby-title">Choose your team.</h2></div><button class="mp-text-button" :disabled="busy || !!pendingOperation" @click="leave">Leave room</button></div>
          <div v-if="inviteUrl" class="mp-invite"><label for="room-invite">Invite your opponent</label><div><input id="room-invite" :value="inviteUrl" readonly @focus="$event.target.select()"><button class="mp-secondary" @click="copyInvite">Copy link</button></div></div>
          <div class="sim-presets"><button v-for="preset in config.presets" :key="preset.id" class="sim-preset" :class="{ selected: selected?.id === preset.id }" :aria-pressed="selected?.id === preset.id" :disabled="busy || !!pendingOperation || !networkOkay" @click="selectTeam(preset.id)"><div class="sim-preset-top"><span>{{ preset.id.toUpperCase() }}</span><span aria-hidden="true">{{ selected?.id === preset.id ? '●' : '○' }}</span></div><h3>{{ preset.name }}</h3><p>{{ preset.description }}</p><div class="sim-preset-sprites"><img v-for="member in preset.team" :key="member.species" :src="spriteUrl(member.species)" :alt="member.species" width="56" height="56"></div></button></div>
          <div class="sim-lead-heading"><p class="sim-eyebrow">PICK YOUR LEAD</p><span>Your lead enters first. Your opponent's selection stays hidden.</span></div>
          <div class="sim-lead-grid"><button v-for="(member, index) in selected?.team" :key="member.species" class="sim-lead" :class="{ selected: room.own.leadIndex === index }" :aria-pressed="room.own.leadIndex === index" :disabled="busy || !!pendingOperation || !networkOkay" @click="selectTeam(selected.id,index)"><img :src="spriteUrl(member.species)" alt="" width="84" height="84"><strong>{{ member.species }}</strong><span>{{ room.own.leadIndex === index ? 'Selected lead' : 'Choose as lead' }}</span></button></div>
          <div v-if="lead" class="sim-team-summary"><div><h3>{{ lead.species }} <span>Lv. 100</span></h3><p>{{ lead.ability }} · {{ lead.item || 'No held item' }} · {{ lead.nature }}</p><div class="sim-lead-moves"><span v-for="move in lead.moves" :key="move">{{ moveInfo(move).name || move }}</span></div></div><button class="sim-primary" :disabled="busy || !!pendingOperation || !networkOkay || !room.opponent" @click="ready">{{ room.own.ready ? 'Cancel ready' : 'Ready to battle' }} <span aria-hidden="true">↗</span></button></div>
          <div class="mp-readiness" role="status"><span :class="{ ready: room.own.ready }">{{ room.own.ready ? '✓ You are ready' : '○ Choose your team, then ready up' }}</span><span :class="{ ready: room.opponent?.ready }">{{ !room.opponent ? '○ Waiting for your opponent to join' : room.opponent.ready ? '✓ Opponent ready' : '○ Opponent choosing a team' }}</span></div>
          <p class="sim-setup-note">The battle starts when both players are ready. Changing your team or lead cancels your ready status. A lobby expires after 15 minutes without a selection, join or ready change.</p>
        </section>
        <div v-if="latest" class="sim-layout">
          <section class="sim-arena" aria-label="Private battle and controls">
            <BattleView ref="battle" :player-label="room.own.name" :opponent-name="room.opponent?.name" opponent-title="Guest trainer" :inactive="room.status === 'interrupted'" @display="displayed = $event"/>
            <section v-if="terminal && !state.playing" class="sim-result" aria-labelledby="multiplayer-result"><p class="sim-eyebrow">{{ room.status === 'interrupted' ? 'CONNECTION TO THE BATTLE LOST' : 'BATTLE COMPLETE' }}</p><h2 id="multiplayer-result">{{ resultTitle }}</h2><p>{{ room.status === 'interrupted' ? 'The server could not continue this battle. No winner was awarded.' : latest.result?.reason === 'timeout' ? 'This battle ended when a decision timer expired.' : latest.result?.reason === 'forfeit' ? 'This battle ended by forfeit.' : `Finished on turn ${latest.turn}. Well played!` }}</p><button class="sim-primary" :disabled="busy || !!pendingOperation" @click="leave">Back to private rooms ↗</button></section>
            <div v-else class="sim-decisions">
              <div class="sim-decision-heading"><h2>{{ prompt }}</h2><span v-if="countdown">{{ countdown }}</span></div>
              <div v-if="decision?.kind !== 'switch'" class="sim-move-grid"><button v-for="move in decision?.moves" :key="move.slot" class="sim-move" :class="`sim-type-${moveInfo(move).type?.toLowerCase()}`" :disabled="locked || decision.kind !== 'move' || move.disabled" :title="moveInfo(move).shortDesc || move.name" @click="choose({ kind: 'move', slot: move.slot })"><div><span class="sim-move-type">{{ moveInfo(move).type || 'Move' }}</span><span>{{ move.pp ?? '—' }} / {{ move.maxpp ?? '—' }} PP</span></div><strong>{{ moveInfo(move).name || move.name }}</strong><small v-if="move.disabled">Unavailable this turn</small></button></div>
              <div class="sim-party-heading"><h3>{{ decision?.kind === 'switch' ? 'Send out a teammate' : 'Or switch Pokémon' }}</h3><span v-if="decision?.kind === 'wait'">Your submitted choice is final.</span></div>
              <div class="sim-party"><button v-for="member in (displayed ?? latest)?.own.team" :key="member.memberId" :class="{ active: member.active, fainted: member.fainted }" :disabled="locked || !switches.has(member.memberId)" @click="choose({ kind: 'switch', memberId: member.memberId })"><img :src="spriteUrl(member.species)" alt="" width="62" height="62"><strong>{{ member.species }}</strong><span>{{ member.fainted ? 'Fainted' : member.active ? 'On the field' : `${member.hp?.current} / ${member.hp?.max}` }}</span><small v-if="member.condition">{{ member.condition.toUpperCase() }}</small></button></div>
              <div class="sim-battle-actions"><span>Closing the page keeps your seat until the decision timer expires.</span><button :disabled="busy" @click="poll(true)">Sync battle</button><template v-if="confirming"><span>Forfeit and award your opponent the win?</span><button :disabled="busy || !!pendingOperation" @click="forfeit">Yes, forfeit</button><button @click="confirming = false">Cancel</button></template><button v-else :disabled="busy || !!pendingOperation || !active" @click="confirming = true">Forfeit battle</button></div>
            </div>
          </section>
          <aside class="sim-log-panel" aria-labelledby="mp-log-title"><div class="sim-log-heading"><div><p class="sim-eyebrow">THE STORY SO FAR</p><h2 id="mp-log-title">Battle log</h2></div><span class="sim-dot"></span></div><ol ref="logHost" class="sim-log"><li v-for="entry in log" :key="entry.cursor" :class="{ 'sim-log-turn': /^Turn \d/.test(entry.text) }">{{ entry.text }}</li><li v-if="!log.length">Your battle begins here.</li></ol><div class="sim-log-note">Your HP is exact. Opponent HP uses the public battle bar. Only revealed opponent details appear here.</div></aside>
        </div>
        <section v-else-if="terminal" class="sim-setup"><h2>This room has closed.</h2><p class="mp-muted">Create a new room to challenge a friend.</p><button class="sim-primary" @click="forget">Back to private rooms ↗</button></section>
      </template>
    </main>
    <footer class="sim-footer"><span>Battle Lab · Generation 3</span><p>Private rooms · Guest players · Same-browser reconnect</p><a href="/">Back to home ↗</a></footer>
  </div>
</template>
