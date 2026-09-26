<script setup>
import { onBeforeUnmount } from 'vue'
import { SPRITE_URLS } from '@battle/pokemon-sprites'
import { createExperienceAudio } from '../../shared/music/audio.js'

const audio = createExperienceAudio()
onBeforeUnmount(() => audio.dispose())

const experiences = [
  {
    id: 'multiplayer', number: '01', href: '/multiplayer', label: 'CHALLENGE A FRIEND',
    title: 'Private battle', tag: 'TWO PLAYERS', action: 'Create or join a room',
    description: 'Invite a friend to a private Generation 3 battle. Pick a preset team, ready up, and face each other on the battlefield.',
    details: ['Guest players', 'Private invitation'],
  },
  {
    id: 'simulation', number: '02', href: '/simulation', label: 'PLAY A BATTLE',
    title: 'Battle simulation', tag: 'GENERATION 3', action: 'Enter the battle',
    description: 'Play a full Generation 3 singles battle with ready-made teams. Choose moves and switches as the battle unfolds.',
    details: ['6-Pokémon teams', 'Turn-by-turn play'],
  },
  {
    id: 'preview', number: '03', href: '/preview', label: 'TAKE A CLOSER LOOK',
    title: 'Move preview', tag: '335 MOVES', action: 'Choose a move',
    description: 'Choose from 335 moves and a roster of 386 Pokémon. See each animation with a fixed sample battle result.',
    details: ['Either perspective', 'Replay any move'],
  },
  {
    id: 'playground', number: '04', href: '/playground', label: 'EXPLORE THE EFFECTS',
    title: 'FX playground', tag: 'EFFECTS ONLY', action: 'Open the playground',
    description: 'Explore the animation on its own. Adjust the Pokémon, scale and battlefield, then play it from either side.',
    details: ['Layout controls', 'Reduced motion'],
  },
]
</script>

<template>
  <div class="home-shell">
    <a class="home-skip" href="#experiences">Skip to experiences</a>
    <header class="home-header">
      <a class="home-brand" href="/" aria-label="Battle Lab home"><span class="ball-mark" aria-hidden="true"></span><span>Battle Lab<span class="home-brand-dot">.</span></span></a>
      <nav class="home-navigation" aria-label="Main navigation">
        <a href="/" aria-current="page">Home</a>
        <a href="/multiplayer">Multiplayer</a>
        <a href="/simulation">Simulation</a>
        <a href="/preview">Move preview</a>
        <a href="/playground">FX playground</a>
      </nav>
    </header>

    <main>
      <section class="home-hero" aria-labelledby="home-title">
        <p class="home-eyebrow"><span aria-hidden="true"></span> A LITTLE NOSTALGIA. A NEW WAY TO PLAY.</p>
        <h1 id="home-title">Choose your next move.</h1>
        <p class="home-intro">A Generation 3 battle, a favorite move, or a closer look at the effects.<br class="home-desktop-break"> There’s a place for each.</p>
        <div class="home-hero-art" aria-hidden="true">
          <div class="home-orbit home-orbit-outer"></div>
          <div class="home-orbit home-orbit-inner"></div>
          <span class="home-art-tick home-art-tick-left"></span>
          <span class="home-art-tick home-art-tick-right"></span>
          <div class="home-pokemon home-pokemon-blastoise"><img :src="SPRITE_URLS['blastoise-front.png']" alt="" width="96" height="96" decoding="async"></div>
          <div class="home-pokemon home-pokemon-charizard"><img :src="SPRITE_URLS['charizard-front.png']" alt="" width="96" height="96" decoding="async" fetchpriority="high"></div>
          <div class="home-pokemon home-pokemon-venusaur"><img :src="SPRITE_URLS['venusaur-front.png']" alt="" width="96" height="96" decoding="async"></div>
        </div>
        <div class="home-roster-note"><span>GEN I–III</span><i aria-hidden="true"></i><span>386 POKÉMON</span><i aria-hidden="true"></i><span>335 MOVE EFFECTS</span></div>
      </section>

      <section id="experiences" class="home-experiences" aria-labelledby="experiences-title" tabindex="-1">
        <div class="home-section-heading"><h2 id="experiences-title">Four ways to play and explore</h2><span>Pick your starting point</span></div>
        <div class="home-card-grid">
          <a v-for="experience in experiences" :key="experience.id" :href="experience.href" class="home-card" :class="`home-card-${experience.id}`">
            <div class="home-card-top">
              <span class="home-card-icon" aria-hidden="true">
                <svg v-if="experience.id === 'simulation' || experience.id === 'multiplayer'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 5 1 10 13-3 3L5 9 4 4Z M17 3l3 1-1 4-3 3 M4 20l5-5 M3 17l4 4 M14 18l5-5"/></svg>
                <svg v-else-if="experience.id === 'preview'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="m10 8 6 4-6 4V8Z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z M20 2v4 M18 4h4"/></svg>
              </span>
              <span class="home-card-tag">{{ experience.tag }}</span>
            </div>
            <p class="home-card-label">{{ experience.number }} <span aria-hidden="true">/</span> {{ experience.label }}</p>
            <h3>{{ experience.title }}</h3>
            <p class="home-card-description">{{ experience.description }}</p>
            <ul class="home-card-details"><li v-for="detail in experience.details" :key="detail">{{ detail }}</li></ul>
            <div class="home-card-action"><span>{{ experience.action }}</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></div>
          </a>
        </div>
      </section>
    </main>

    <footer class="home-footer"><span>A fan-made Pokémon experience.</span><span>Pokémon © Nintendo / Game Freak <span aria-hidden="true">·</span> Sprites via <a href="https://github.com/PokeAPI/sprites" target="_blank" rel="noopener noreferrer">PokéAPI</a></span></footer>
  </div>
</template>
