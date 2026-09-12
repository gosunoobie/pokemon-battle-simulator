// Fixed preview rules. Reference power and accuracy do not calculate damage.
export const MOVE_RULES = Object.freeze([
  {
    "id": "slash",
    "name": "Slash",
    "type": "Normal",
    "power": 70,
    "accuracy": 100,
    "damage": 40,
    "effective": false
  },
  {
    "id": "flamethrower",
    "name": "Flamethrower",
    "type": "Fire",
    "power": 90,
    "accuracy": 100,
    "damage": 64,
    "effective": true
  },
  {
    "id": "wing-attack",
    "name": "Wing Attack",
    "type": "Flying",
    "power": 60,
    "accuracy": 100,
    "damage": 52,
    "effective": true
  },
  {
    "id": "fire-blast",
    "name": "Fire Blast",
    "type": "Fire",
    "power": 110,
    "accuracy": 85,
    "damage": 82,
    "effective": true
  },
  {
    "id": "razor-leaf",
    "name": "Razor Leaf",
    "type": "Grass",
    "power": 55,
    "accuracy": 95,
    "damage": 36,
    "effective": false
  },
  {
    "id": "solar-beam",
    "name": "Solar Beam",
    "type": "Grass",
    "power": 120,
    "accuracy": 100,
    "damage": 78,
    "effective": false
  },
  {
    "id": "vine-whip",
    "name": "Vine Whip",
    "type": "Grass",
    "power": 45,
    "accuracy": 100,
    "damage": 32,
    "effective": false
  },
  {
    "id": "sludge-bomb",
    "name": "Sludge Bomb",
    "type": "Poison",
    "power": 90,
    "accuracy": 100,
    "damage": 60,
    "effective": false
  },
  {
    "id": "overheat",
    "name": "Overheat",
    "type": "Fire",
    "power": 130,
    "accuracy": 90,
    "damage": 92,
    "effective": true
  },
  {
    "id": "blaze-kick",
    "name": "Blaze Kick",
    "type": "Fire",
    "power": 85,
    "accuracy": 90,
    "damage": 58,
    "effective": true
  },
  {
    "id": "eruption",
    "name": "Eruption",
    "type": "Fire",
    "power": 150,
    "accuracy": 100,
    "damage": 96,
    "effective": true
  },
  {
    "id": "blast-burn",
    "name": "Blast Burn",
    "type": "Fire",
    "power": 150,
    "accuracy": 90,
    "damage": 104,
    "effective": true
  },
  {
    "id": "earthquake",
    "name": "Earthquake",
    "type": "Ground",
    "power": 100,
    "accuracy": 100,
    "damage": 72,
    "effective": false
  },
  {
    "id": "rock-slide",
    "name": "Rock Slide",
    "type": "Rock",
    "power": 75,
    "accuracy": 90,
    "damage": 54,
    "effective": false
  },
  {
    "id": "thunder-wave",
    "name": "Thunder Wave",
    "type": "Electric",
    "power": null,
    "accuracy": 90,
    "damage": 0,
    "effective": false,
    "condition": "paralysis"
  },
  {
    "id": "thunder-shock",
    "name": "Thunder Shock",
    "type": "Electric",
    "power": 40,
    "accuracy": 100,
    "damage": 28,
    "effective": false
  },
  {
    "id": "thunderbolt",
    "name": "Thunderbolt",
    "type": "Electric",
    "power": 90,
    "accuracy": 100,
    "damage": 62,
    "effective": false
  },
  {
    "id": "thunder",
    "name": "Thunder",
    "type": "Electric",
    "power": 110,
    "accuracy": 70,
    "damage": 84,
    "effective": false
  },
  {
    "id": "blizzard",
    "name": "Blizzard",
    "type": "Ice",
    "power": 110,
    "accuracy": 70,
    "damage": 86,
    "effective": true
  },
  {
    "id": "ice-punch",
    "name": "Ice Punch",
    "type": "Ice",
    "power": 75,
    "accuracy": 100,
    "damage": 50,
    "effective": true
  },
  {
    "id": "aurora-beam",
    "name": "Aurora Beam",
    "type": "Ice",
    "power": 65,
    "accuracy": 100,
    "damage": 54,
    "effective": true
  },
  {
    "id": "ice-beam",
    "name": "Ice Beam",
    "type": "Ice",
    "power": 90,
    "accuracy": 100,
    "damage": 68,
    "effective": true
  },
  {
    "id": "psychic",
    "name": "Psychic",
    "type": "Psychic",
    "power": 90,
    "accuracy": 100,
    "damage": 72,
    "effective": true
  },
  {
    "id": "shadow-ball",
    "name": "Shadow Ball",
    "type": "Ghost",
    "power": 80,
    "accuracy": 100,
    "damage": 58,
    "effective": false
  },
  {
    "id": "bubble",
    "name": "Bubble",
    "type": "Water",
    "power": 40,
    "accuracy": 100,
    "damage": 24,
    "effective": false
  },
  {
    "id": "bubble-beam",
    "name": "Bubble Beam",
    "type": "Water",
    "power": 65,
    "accuracy": 100,
    "damage": 44,
    "effective": false
  },
  {
    "id": "hydro-pump",
    "name": "Hydro Pump",
    "type": "Water",
    "power": 110,
    "accuracy": 80,
    "damage": 72,
    "effective": false
  },
  {
    "id": "surf",
    "name": "Surf",
    "type": "Water",
    "power": 90,
    "accuracy": 100,
    "damage": 66,
    "effective": false
  },
  {
    "id": "waterfall",
    "name": "Waterfall",
    "type": "Water",
    "power": 80,
    "accuracy": 100,
    "damage": 56,
    "effective": false
  },
  {
    "id": "quick-attack",
    "name": "Quick Attack",
    "type": "Normal",
    "power": 40,
    "accuracy": 100,
    "damage": 32,
    "effective": false
  },
  {
    "id": "mach-punch",
    "name": "Mach Punch",
    "type": "Fighting",
    "power": 40,
    "accuracy": 100,
    "damage": 28,
    "effective": false
  },
  {
    "id": "extreme-speed",
    "name": "Extreme Speed",
    "type": "Normal",
    "power": 80,
    "accuracy": 100,
    "damage": 58,
    "effective": false
  },
  {
    "id": "body-slam",
    "name": "Body Slam",
    "type": "Normal",
    "power": 85,
    "accuracy": 100,
    "damage": 62,
    "effective": false
  },
  {
    "id": "poison-powder", "name": "Poison Powder", "type": "Poison",
    "power": null, "accuracy": 75, "damage": 0, "effective": false, "condition": "poison"
  },
  {
    "id": "sleep-powder", "name": "Sleep Powder", "type": "Grass",
    "power": null, "accuracy": 75, "damage": 0, "effective": false, "condition": "sleep"
  },
  {
    "id": "stun-spore", "name": "Stun Spore", "type": "Grass",
    "power": null, "accuracy": 75, "damage": 0, "effective": false, "condition": "paralysis"
  },
  {
    "id": "bite", "name": "Bite", "type": "Dark",
    "power": 60, "accuracy": 100, "damage": 42, "effective": false
  },
  {
    "id": "crunch", "name": "Crunch", "type": "Dark",
    "power": 80, "accuracy": 100, "damage": 60, "effective": false
  },
  {
    "id": "hyper-fang", "name": "Hyper Fang", "type": "Normal",
    "power": 80, "accuracy": 90, "damage": 58, "effective": false
  },
  {
    "id": "poison-fang", "name": "Poison Fang", "type": "Poison",
    "power": 50, "accuracy": 100, "damage": 36, "effective": false
  },
  {
    "id": "smog", "name": "Smog", "type": "Poison",
    "power": 30, "accuracy": 70, "damage": 22, "effective": false
  },
  {
    "id": "poison-gas", "name": "Poison Gas", "type": "Poison",
    "power": null, "accuracy": 90, "damage": 0, "effective": false, "condition": "poison"
  },
  {
    "id": "smokescreen", "name": "Smokescreen", "type": "Normal",
    "power": null, "accuracy": 100, "damage": 0, "effective": false, "accuracyChange": -1
  },
  {
    "id": "toxic", "name": "Toxic", "type": "Poison",
    "power": null, "accuracy": 90, "damage": 0, "effective": false, "condition": "bad-poison"
  },
  {
    "id": "barrier", "name": "Barrier", "type": "Psychic", "target": "self",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "defenseChange": 2
  },
  {
    "id": "protect", "name": "Protect", "type": "Normal", "target": "self",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "guard": "protected"
  },
  {
    "id": "light-screen", "name": "Light Screen", "type": "Psychic", "target": "self",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "guard": "lightScreen"
  },
  {
    "id": "reflect", "name": "Reflect", "type": "Psychic", "target": "self",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "guard": "reflect"
  },
  {
    "id": "rapid-spin", "name": "Rapid Spin", "type": "Normal",
    "power": 50, "accuracy": 100, "damage": 34, "effective": false
  },
  {
    "id": "rollout", "name": "Rollout", "type": "Rock",
    "power": 30, "accuracy": 90, "damage": 32, "effective": false
  },
  {
    "id": "ice-ball", "name": "Ice Ball", "type": "Ice",
    "power": 30, "accuracy": 90, "damage": 36, "effective": true
  },
  {
    "id": "flame-wheel", "name": "Flame Wheel", "type": "Fire",
    "power": 60, "accuracy": 100, "damage": 48, "effective": true
  },
  {
    "id": "karate-chop", "name": "Karate Chop", "type": "Fighting",
    "power": 50, "accuracy": 100, "damage": 36, "effective": false
  },
  {
    "id": "brick-break", "name": "Brick Break", "type": "Fighting",
    "power": 75, "accuracy": 100, "damage": 54, "effective": false, "breakScreens": true
  },
  {
    "id": "cross-chop", "name": "Cross Chop", "type": "Fighting",
    "power": 100, "accuracy": 80, "damage": 70, "effective": false
  },
  {
    "id": "rock-smash", "name": "Rock Smash", "type": "Fighting",
    "power": 40, "accuracy": 100, "damage": 30, "effective": false
  },
  {
    "id": "peck", "name": "Peck", "type": "Flying",
    "power": 35, "accuracy": 100, "damage": 28, "effective": true
  },
  {
    "id": "horn-attack", "name": "Horn Attack", "type": "Normal",
    "power": 65, "accuracy": 100, "damage": 46, "effective": false
  },
  {
    "id": "drill-peck", "name": "Drill Peck", "type": "Flying",
    "power": 80, "accuracy": 100, "damage": 58, "effective": true
  },
  {
    "id": "megahorn", "name": "Megahorn", "type": "Bug",
    "power": 120, "accuracy": 85, "damage": 84, "effective": false
  },
  {
    "id": "cut", "name": "Cut", "type": "Normal",
    "power": 50, "accuracy": 95, "damage": 36, "effective": false
  },
  {
    "id": "fury-cutter", "name": "Fury Cutter", "type": "Bug",
    "power": 40, "accuracy": 95, "damage": 30, "effective": false
  },
  {
    "id": "leaf-blade", "name": "Leaf Blade", "type": "Grass",
    "power": 90, "accuracy": 100, "damage": 62, "effective": false
  },
  {
    "id": "air-cutter", "name": "Air Cutter", "type": "Flying",
    "power": 60, "accuracy": 95, "damage": 42, "effective": true
  },
  {
    "id": "ember", "name": "Ember", "type": "Fire",
    "power": 40, "accuracy": 100, "damage": 28, "effective": true
  },
  {
    "id": "dragon-rage", "name": "Dragon Rage", "type": "Dragon",
    "power": null, "accuracy": 100, "damage": 40, "effective": false
  },
  {
    "id": "will-o-wisp", "name": "Will-O-Wisp", "type": "Fire",
    "power": null, "accuracy": 85, "damage": 0, "effective": false, "condition": "burn"
  },
  {
    "id": "tri-attack", "name": "Tri Attack", "type": "Normal",
    "power": 80, "accuracy": 100, "damage": 58, "effective": false
  },
  {
    "id": "whirlpool", "name": "Whirlpool", "type": "Water",
    "power": 35, "accuracy": 85, "damage": 28, "effective": false
  },
  {
    "id": "fire-spin", "name": "Fire Spin", "type": "Fire",
    "power": 35, "accuracy": 85, "damage": 30, "effective": true
  },
  {
    "id": "sand-tomb", "name": "Sand Tomb", "type": "Ground",
    "power": 35, "accuracy": 85, "damage": 28, "effective": false
  },
  {
    "id": "whirlwind", "name": "Whirlwind", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "switchPreview": true
  },
  {
    "id": "absorb", "name": "Absorb", "type": "Grass",
    "power": 20, "accuracy": 100, "damage": 18, "effective": false, "drain": 0.5
  },
  {
    "id": "mega-drain", "name": "Mega Drain", "type": "Grass",
    "power": 40, "accuracy": 100, "damage": 34, "effective": false, "drain": 0.5
  },
  {
    "id": "giga-drain", "name": "Giga Drain", "type": "Grass",
    "power": 75, "accuracy": 100, "damage": 56, "effective": false, "drain": 0.5
  },
  {
    "id": "leech-life", "name": "Leech Life", "type": "Bug",
    "power": 80, "accuracy": 100, "damage": 54, "effective": false, "drain": 0.5
  },
  {
    "id": "refresh", "name": "Refresh", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "cure": "refresh"
  },
  {
    "id": "heal-bell", "name": "Heal Bell", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "cure": "all"
  },
  {
    "id": "aromatherapy", "name": "Aromatherapy", "type": "Grass",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "cure": "all"
  },
  {
    "id": "rest", "name": "Rest", "type": "Psychic",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "rest": true
  },
  {
    "id": "meditate", "name": "Meditate", "type": "Psychic",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "attackChange": 1
  },
  {
    "id": "calm-mind", "name": "Calm Mind", "type": "Psychic",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "specialAttackChange": 1, "specialDefenseChange": 1
  },
  {
    "id": "amnesia", "name": "Amnesia", "type": "Psychic",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "specialDefenseChange": 2
  },
  {
    "id": "focus-energy", "name": "Focus Energy", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "focusEnergy": true
  },
  {
    "id": "bulk-up", "name": "Bulk Up", "type": "Fighting",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "attackChange": 1, "defenseChange": 1
  },
  {
    "id": "howl", "name": "Howl", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "attackChange": 1
  },
  {
    "id": "swords-dance", "name": "Swords Dance", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "attackChange": 2
  },
  {
    "id": "dragon-dance", "name": "Dragon Dance", "type": "Dragon",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "attackChange": 1, "speedChange": 1
  },
  {
    "id": "agility", "name": "Agility", "type": "Psychic",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "speedChange": 2
  },
  {
    "id": "double-team", "name": "Double Team", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "evasionChange": 1
  },
  {
    "id": "minimize", "name": "Minimize", "type": "Normal",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "evasionChange": 2
  },
  {
    "id": "acid-armor", "name": "Acid Armor", "type": "Poison",
    "power": null, "accuracy": null, "damage": 0, "effective": false, "target": "self", "defenseChange": 2
  },
  { "id": "rage", "name": "Rage", "type": "Normal", "power": 20, "accuracy": 100, "damage": 24, "effective": false },
  { "id": "thrash", "name": "Thrash", "type": "Normal", "power": 120, "accuracy": 100, "damage": 78, "effective": false },
  { "id": "outrage", "name": "Outrage", "type": "Dragon", "power": 120, "accuracy": 100, "damage": 82, "effective": false },
  { "id": "struggle", "name": "Struggle", "type": "Normal", "power": 50, "accuracy": null, "damage": 36, "effective": false, "recoilMaxHp": 0.25 },
  {"id": "leer", "name": "Leer", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "effective": false, "defenseChange": -1},
  {"id": "scary-face", "name": "Scary Face", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "effective": false, "speedChange": -2},
  {"id": "glare", "name": "Glare", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "effective": false, "condition": "paralysis"},
  {"id": "mean-look", "name": "Mean Look", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "effective": false, "trapPreview": true},
  {"id": "scratch", "name": "Scratch", "type": "Normal", "power": 40, "accuracy": 100, "damage": 28, "effective": false},
  {"id": "metal-claw", "name": "Metal Claw", "type": "Steel", "power": 50, "accuracy": 95, "damage": 34, "effective": false},
  {"id": "dragon-claw", "name": "Dragon Claw", "type": "Dragon", "power": 80, "accuracy": 100, "damage": 58, "effective": false},
  {"id": "tackle", "name": "Tackle", "type": "Normal", "power": 40, "accuracy": 100, "damage": 28, "effective": false},
  {"id": "return", "name": "Return", "type": "Normal", "power": 102, "accuracy": 100, "damage": 72, "effective": false},
  {"id": "take-down", "name": "Take Down", "type": "Normal", "power": 90, "accuracy": 85, "damage": 64, "effective": false, "recoilDamage": 0.25},
  {"id": "double-edge", "name": "Double-Edge", "type": "Normal", "power": 120, "accuracy": 100, "damage": 84, "effective": false, "recoilDamage": 0.33},
  {"id": "slam", "name": "Slam", "type": "Normal", "power": 80, "accuracy": 75, "damage": 56, "effective": false},
  {"id": "stomp", "name": "Stomp", "type": "Normal", "power": 65, "accuracy": 100, "damage": 46, "effective": false},
  {"id": "strength", "name": "Strength", "type": "Normal", "power": 80, "accuracy": 100, "damage": 58, "effective": false},
  {"id": "mega-punch", "name": "Mega Punch", "type": "Normal", "power": 80, "accuracy": 85, "damage": 56, "effective": false},
  {"id": "meteor-mash", "name": "Meteor Mash", "type": "Steel", "power": 90, "accuracy": 90, "damage": 64, "effective": false},
  {"id": "dynamic-punch", "name": "Dynamic Punch", "type": "Fighting", "power": 100, "accuracy": 50, "damage": 70, "effective": false, "confuses": true},
  {"id": "focus-punch", "name": "Focus Punch", "type": "Fighting", "power": 150, "accuracy": 100, "damage": 100, "effective": false},
  {"id": "rock-blast", "name": "Rock Blast", "type": "Rock", "power": 25, "accuracy": 90, "damage": 54, "effective": false},
  {"id": "ancient-power", "name": "Ancient Power", "type": "Rock", "power": 60, "accuracy": 100, "damage": 44, "effective": false},
  {"id": "rock-tomb", "name": "Rock Tomb", "type": "Rock", "power": 60, "accuracy": 95, "damage": 42, "effective": false, "speedChange": -1},
  {"id": "confusion", "name": "Confusion", "type": "Psychic", "power": 50, "accuracy": 100, "damage": 34, "effective": false},
  {"id": "hypnosis", "name": "Hypnosis", "type": "Psychic", "power": null, "accuracy": 60, "damage": 0, "effective": false, "condition": "sleep", "requiresClearCondition": true},
  {"id": "confuse-ray", "name": "Confuse Ray", "type": "Ghost", "power": null, "accuracy": 100, "damage": 0, "effective": false, "confuses": true},
  {"id": "explosion", "name": "Explosion", "type": "Normal", "power": 250, "accuracy": 100, "damage": 124, "effective": false, "selfDestruct": true},
  {"id": "self-destruct", "name": "Self-Destruct", "type": "Normal", "power": 200, "accuracy": 100, "damage": 100, "effective": false, "selfDestruct": true},
  {"id": "vital-throw", "name": "Vital Throw", "type": "Fighting", "power": 70, "accuracy": null, "damage": 48, "effective": false},
  {"id": "submission", "name": "Submission", "type": "Fighting", "power": 80, "accuracy": 80, "damage": 56, "effective": false, "recoilDamage": 0.25},
  {"id": "sky-uppercut", "name": "Sky Uppercut", "type": "Fighting", "power": 85, "accuracy": 90, "damage": 60, "effective": false},
  {"id": "seismic-toss", "name": "Seismic Toss", "type": "Fighting", "power": null, "accuracy": 100, "damage": 0, "effective": false, "levelDamage": true},
  {"id": "rain-dance", "name": "Rain Dance", "type": "Water", "power": null, "accuracy": null, "damage": 0, "target": "field", "weather": "rain"},
  {"id": "sunny-day", "name": "Sunny Day", "type": "Fire", "power": null, "accuracy": null, "damage": 0, "target": "field", "weather": "sun"},
  {"id": "sandstorm", "name": "Sandstorm", "type": "Rock", "power": null, "accuracy": null, "damage": 0, "target": "field", "weather": "sandstorm"},
  {"id": "hail", "name": "Hail", "type": "Ice", "power": null, "accuracy": null, "damage": 0, "target": "field", "weather": "hail"},
  {"id": "fire-punch", "name": "Fire Punch", "type": "Fire", "power": 75, "accuracy": 100, "damage": 50},
  {"id": "thunder-punch", "name": "Thunder Punch", "type": "Electric", "power": 75, "accuracy": 100, "damage": 50},
  {"id": "shadow-punch", "name": "Shadow Punch", "type": "Ghost", "power": 60, "accuracy": null, "damage": 44},
  {"id": "mega-kick", "name": "Mega Kick", "type": "Normal", "power": 120, "accuracy": 75, "damage": 84},
  {"id": "low-kick", "name": "Low Kick", "type": "Fighting", "power": null, "accuracy": 100, "damage": 42},
  {"id": "rolling-kick", "name": "Rolling Kick", "type": "Fighting", "power": 60, "accuracy": 85, "damage": 44},
  {"id": "double-kick", "name": "Double Kick", "type": "Fighting", "power": 30, "accuracy": 100, "damage": 44},
  {"id": "triple-kick", "name": "Triple Kick", "type": "Fighting", "power": 10, "accuracy": 90, "damage": 60},
  {"id": "jump-kick", "name": "Jump Kick", "type": "Fighting", "power": 100, "accuracy": 95, "damage": 70},
  {"id": "high-jump-kick", "name": "High Jump Kick", "type": "Fighting", "power": 130, "accuracy": 90, "damage": 90},
  {"id": "bullet-seed", "name": "Bullet Seed", "type": "Grass", "power": 25, "accuracy": 100, "damage": 50},
  {"id": "pin-missile", "name": "Pin Missile", "type": "Bug", "power": 25, "accuracy": 95, "damage": 44},
  {"id": "spike-cannon", "name": "Spike Cannon", "type": "Normal", "power": 20, "accuracy": 100, "damage": 44},
  {"id": "icicle-spear", "name": "Icicle Spear", "type": "Ice", "power": 25, "accuracy": 100, "damage": 50},
  {"id": "poison-sting", "name": "Poison Sting", "type": "Poison", "power": 15, "accuracy": 100, "damage": 18},
  {"id": "twineedle", "name": "Twineedle", "type": "Bug", "power": 25, "accuracy": 100, "damage": 32},
  {"id": "swift", "name": "Swift", "type": "Normal", "power": 60, "accuracy": null, "damage": 42},
  {"id": "pay-day", "name": "Pay Day", "type": "Normal", "power": 40, "accuracy": 100, "damage": 28},
  {"id": "rock-throw", "name": "Rock Throw", "type": "Rock", "power": 50, "accuracy": 90, "damage": 40},
  {"id": "egg-bomb", "name": "Egg Bomb", "type": "Normal", "power": 100, "accuracy": 75, "damage": 70},
  {"id": "barrage", "name": "Barrage", "type": "Normal", "power": 15, "accuracy": 85, "damage": 42},
  {"id": "present", "name": "Present", "type": "Normal", "power": null, "accuracy": 90, "damage": 56},
  {"id": "fly", "name": "Fly", "type": "Flying", "power": 90, "accuracy": 95, "damage": 64},
  {"id": "bounce", "name": "Bounce", "type": "Flying", "power": 85, "accuracy": 85, "damage": 58},
  {"id": "dig", "name": "Dig", "type": "Ground", "power": 80, "accuracy": 100, "damage": 56},
  {"id": "dive", "name": "Dive", "type": "Water", "power": 80, "accuracy": 100, "damage": 56},
  {"id": "dragon-breath", "name": "Dragon Breath", "type": "Dragon", "power": 60, "accuracy": 100, "damage": 42},
  {"id": "sacred-fire", "name": "Sacred Fire", "type": "Fire", "power": 100, "accuracy": 95, "damage": 72},
  {"id": "psybeam", "name": "Psybeam", "type": "Psychic", "power": 65, "accuracy": 100, "damage": 46},
  {"id": "signal-beam", "name": "Signal Beam", "type": "Bug", "power": 75, "accuracy": 100, "damage": 52},
  {"id": "counter", "name": "Counter", "type": "Fighting", "power": null, "accuracy": 100, "damage": 0, "retaliates": "physical"},
  {"id": "mirror-coat", "name": "Mirror Coat", "type": "Psychic", "power": null, "accuracy": 100, "damage": 0, "retaliates": "special"},
  {"id": "pain-split", "name": "Pain Split", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "splitsHp": true},
  {"id": "endeavor", "name": "Endeavor", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "endeavor": true},
  {"id":"disable","name":"Disable","type":"Normal","power":null,"accuracy":100,"damage":0,"restrictionPreview":"disabled"},
  {"id":"encore","name":"Encore","type":"Normal","power":null,"accuracy":100,"damage":0,"restrictionPreview":"encored"},
  {"id":"torment","name":"Torment","type":"Dark","power":null,"accuracy":100,"damage":0,"restrictionPreview":"tormented"},
  {"id":"imprison","name":"Imprison","type":"Psychic","power":null,"accuracy":null,"damage":0,"restrictionPreview":"imprisoning","target":"self"},
  {"id":"taunt","name":"Taunt","type":"Dark","power":null,"accuracy":100,"damage":0,"restrictionPreview":"taunted"},
  {"id":"swagger","name":"Swagger","type":"Normal","power":null,"accuracy":85,"damage":0,"attackChange":2,"confuses":true},
  {"id":"flatter","name":"Flatter","type":"Dark","power":null,"accuracy":100,"damage":0,"specialAttackChange":1,"confuses":true},
  {"id":"fake-tears","name":"Fake Tears","type":"Dark","power":null,"accuracy":100,"damage":0,"specialDefenseChange":-2},
  {"id": "sing", "name": "Sing", "type": "Normal", "power": null, "accuracy": 55, "damage": 0, "condition": "sleep", "requiresClearCondition": true},
  {"id": "grass-whistle", "name": "Grass Whistle", "type": "Grass", "power": null, "accuracy": 55, "damage": 0, "condition": "sleep", "requiresClearCondition": true},
  {"id": "snore", "name": "Snore", "type": "Normal", "power": 50, "accuracy": 100, "damage": 36, "requiresSleep": true},
  {"id": "perish-song", "name": "Perish Song", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "field", "perishSong": true},
  {"id": "belly-drum", "name": "Belly Drum", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "bellyDrum": true},
  {"id": "trick", "name": "Trick", "type": "Psychic", "power": null, "accuracy": 100, "damage": 0, "swapItems": true},
  {"id": "charm", "name": "Charm", "type": "Fairy", "power": null, "accuracy": 100, "damage": 0, "attackChange": -2},
  {"id": "attract", "name": "Attract", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "supportPreview": "infatuated"},
  {"id": "sweet-kiss", "name": "Sweet Kiss", "type": "Fairy", "power": null, "accuracy": 75, "damage": 0, "confuses": true},
  {"id": "lovely-kiss", "name": "Lovely Kiss", "type": "Normal", "power": null, "accuracy": 75, "damage": 0, "condition": "sleep", "requiresClearCondition": true},
  {"id": "recover", "name": "Recover", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "healFraction": 0.5},
  {"id": "soft-boiled", "name": "Soft-Boiled", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "healFraction": 0.5},
  {"id": "milk-drink", "name": "Milk Drink", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "healFraction": 0.5},
  {"id": "slack-off", "name": "Slack Off", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "healFraction": 0.5},
  {"id": "morning-sun", "name": "Morning Sun", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "weatherHeal": true},
  {"id": "synthesis", "name": "Synthesis", "type": "Grass", "power": null, "accuracy": null, "damage": 0, "target": "self", "weatherHeal": true},
  {"id": "moonlight", "name": "Moonlight", "type": "Fairy", "power": null, "accuracy": null, "damage": 0, "target": "self", "weatherHeal": true},
  {"id": "wish", "name": "Wish", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "supportPreview": "wishPending"},
  {"id": "harden", "name": "Harden", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "defenseChange": 1},
  {"id": "iron-defense", "name": "Iron Defense", "type": "Steel", "power": null, "accuracy": null, "damage": 0, "target": "self", "defenseChange": 2},
  {"id": "defense-curl", "name": "Defense Curl", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "defenseChange": 1},
  {"id": "withdraw", "name": "Withdraw", "type": "Water", "power": null, "accuracy": null, "damage": 0, "target": "self", "defenseChange": 1},
  {"id": "safeguard", "name": "Safeguard", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "supportPreview": "safeguard"},
  {"id": "magic-coat", "name": "Magic Coat", "type": "Psychic", "power": null, "accuracy": null, "damage": 0, "target": "self", "supportPreview": "magicCoat"},
  {"id": "cosmic-power", "name": "Cosmic Power", "type": "Psychic", "power": null, "accuracy": null, "damage": 0, "target": "self", "defenseChange": 1, "specialDefenseChange": 1},
  {"id": "endure", "name": "Endure", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "supportPreview": "enduring"},
  {"id": "double-slap", "name": "Double Slap", "type": "Normal", "power": 15, "accuracy": 85, "damage": 30},
  {"id": "comet-punch", "name": "Comet Punch", "type": "Normal", "power": 18, "accuracy": 85, "damage": 42},
  {"id": "arm-thrust", "name": "Arm Thrust", "type": "Fighting", "power": 15, "accuracy": 100, "damage": 42},
  {"id": "fury-attack", "name": "Fury Attack", "type": "Normal", "power": 15, "accuracy": 85, "damage": 40},
  {"id": "steel-wing", "name": "Steel Wing", "type": "Steel", "power": 70, "accuracy": 90, "damage": 48},
  {"id": "iron-tail", "name": "Iron Tail", "type": "Steel", "power": 100, "accuracy": 75, "damage": 70},
  {"id": "poison-tail", "name": "Poison Tail", "type": "Poison", "power": 50, "accuracy": 100, "damage": 36},
  {"id": "headbutt", "name": "Headbutt", "type": "Normal", "power": 70, "accuracy": 100, "damage": 48},
  {"id": "frustration", "name": "Frustration", "type": "Normal", "power": 102, "accuracy": 100, "damage": 72},
  {"id": "facade", "name": "Facade", "type": "Normal", "power": 70, "accuracy": 100, "damage": 48, "statusDamageBoost": true},
  {"id": "smelling-salts", "name": "Smelling Salts", "type": "Normal", "power": 70, "accuracy": 100, "damage": 42, "paralysisDamageBoost": true, "cureParalysis": true},
  {"id": "hidden-power", "name": "Hidden Power", "type": "Normal", "power": 60, "accuracy": 100, "damage": 42},
  {"id": "zap-cannon", "name": "Zap Cannon", "type": "Electric", "power": 120, "accuracy": 50, "damage": 86, "conditionOnHit": "paralysis"},
  {"id": "weather-ball", "name": "Weather Ball", "type": "Normal", "power": 50, "accuracy": 100, "damage": 36},
  {"id": "mist-ball", "name": "Mist Ball", "type": "Psychic", "power": 95, "accuracy": 100, "damage": 66},
  {"id": "teleport", "name": "Teleport", "type": "Psychic", "power": null, "accuracy": null, "damage": 0, "target": "self", "previewOnly": "shimmered through Teleport! Switching and escape are not simulated."},
  {"id": "baton-pass", "name": "Baton Pass", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "previewOnly": "prepared Baton Pass! Switching and passing stat changes are not simulated."},
  {"id": "substitute", "name": "Substitute", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "substitute": true},
  {"id": "recycle", "name": "Recycle", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "recycle": true},
  {"id": "growl", "name": "Growl", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "attackChange": -1},
  {"id": "roar", "name": "Roar", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "previewOnly": "roared and pushed the opponent back! Forced switching is not simulated."},
  {"id": "screech", "name": "Screech", "type": "Normal", "power": null, "accuracy": 85, "damage": 0, "defenseChange": -2},
  {"id": "metal-sound", "name": "Metal Sound", "type": "Steel", "power": null, "accuracy": 85, "damage": 0, "specialDefenseChange": -2},
  {"id": "metronome", "name": "Metronome", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "previewOnly": "wagged a finger with Metronome! Random move selection and the called attack are not simulated."},
  {"id": "assist", "name": "Assist", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "previewOnly": "called for Assist! Party move selection and the called attack are not simulated."},
  {"id": "sleep-talk", "name": "Sleep Talk", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "requiresSleep": true, "previewOnly": "murmured through Sleep Talk! Move selection and the called attack are not simulated."},
  {"id": "nature-power", "name": "Nature Power", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "target": "self", "previewOnly": "gathered Nature Power! Terrain selection and the called attack are not simulated."},
  {"id": "mud-sport", "name": "Mud Sport", "type": "Ground", "power": null, "accuracy": null, "damage": 0, "target": "field", "sportPreview": "mudSport"},
  {"id": "water-sport", "name": "Water Sport", "type": "Water", "power": null, "accuracy": null, "damage": 0, "target": "field", "sportPreview": "waterSport"},
  {"id": "spikes", "name": "Spikes", "type": "Ground", "power": null, "accuracy": null, "damage": 0, "spikes": true},
  {"id": "sweet-scent", "name": "Sweet Scent", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "evasionChange": -2},
  {"id": "fake-out", "name": "Fake Out", "type": "Normal", "power": 40, "accuracy": 100, "damage": 28},
  {"id": "astonish", "name": "Astonish", "type": "Ghost", "power": 30, "accuracy": 100, "damage": 22},
  {"id": "tail-whip", "name": "Tail Whip", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "defenseChange": -1},
  {"id": "tickle", "name": "Tickle", "type": "Normal", "power": null, "accuracy": 100, "damage": 0, "attackChange": -1, "defenseChange": -1},
  {"id": "supersonic", "name": "Supersonic", "type": "Normal", "power": null, "accuracy": 55, "damage": 0, "confuses": true},
  {"id": "sonic-boom", "name": "Sonic Boom", "type": "Normal", "power": null, "accuracy": 90, "damage": 20},
  {"id": "hyper-voice", "name": "Hyper Voice", "type": "Normal", "power": 90, "accuracy": 100, "damage": 64},
  {"id": "uproar", "name": "Uproar", "type": "Normal", "power": 90, "accuracy": 100, "damage": 64},
  {"id": "lock-on", "name": "Lock-On", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "supportPreview": "aimed"},
  {"id": "mind-reader", "name": "Mind Reader", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "supportPreview": "aimed"},
  {"id": "foresight", "name": "Foresight", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "supportPreview": "identified"},
  {"id": "odor-sleuth", "name": "Odor Sleuth", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "supportPreview": "identified"},
  {"id": "mimic", "name": "Mimic", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "previewOnly": "studied a move with Mimic! Last-move copying, moveset replacement and PP are not simulated."},
  {"id": "psych-up", "name": "Psych Up", "type": "Normal", "power": null, "accuracy": null, "damage": 0, "copyStages": true},
  {"id": "role-play", "name": "Role Play", "type": "Psychic", "power": null, "accuracy": null, "damage": 0, "previewOnly": "studied an ability with Role Play! Ability copying and restrictions are not simulated."},
  {"id": "skill-swap", "name": "Skill Swap", "type": "Psychic", "power": null, "accuracy": null, "damage": 0, "previewOnly": "performed Skill Swap\u2019s exchange gesture! Ability exchange and restrictions are not simulated."},
  {"id": "water-gun", "name": "Water Gun", "type": "Water", "power": 40, "accuracy": 100, "damage": 28, "effective": false},
  {"id": "hydro-cannon", "name": "Hydro Cannon", "type": "Water", "power": 150, "accuracy": 90, "damage": 100, "effective": false},
  {"id": "spit-up", "name": "Spit Up", "type": "Normal", "power": null, "accuracy": 100, "damage": 70, "effective": false},
  {"id": "hyper-beam", "name": "Hyper Beam", "type": "Normal", "power": 150, "accuracy": 90, "damage": 100, "effective": false},
  {"id": "aeroblast", "name": "Aeroblast", "type": "Flying", "power": 100, "accuracy": 95, "damage": 70, "effective": false},
  {"id": "luster-purge", "name": "Luster Purge", "type": "Psychic", "power": 95, "accuracy": 100, "damage": 66, "effective": false},
].map(Object.freeze))
