// Game state holder
export const gameState = {
  phase: 'buy', // 'buy', 'live', 'roundEnd', 'matchEnd'
  roundTimer: 115, // seconds
  buyTimer: 15,
  scoreCT: 0,
  scoreT: 0,
  maxRounds: 15,
  money: 800,
  hp: 100,
  armor: 100,
  currentWeapon: 'rifle',
  mag: 30,
  reserve: 90,
  inventory: { pistol: true, rifle: true, sniper: false, shotgun: false },
  bombPlanted: false,
  bombSite: null, // 'A' or 'B'
  bombTimer: 40,
  matchWinner: null
};
