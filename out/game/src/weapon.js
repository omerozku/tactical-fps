// Weapon definitions and recoil/spread model
export const WEAPONS = {
  pistol: {
    id: 'pistol',
    name: 'P250 Heavy Pistol',
    cost: 300,
    damage: 35,
    range: 100,
    fireRate: 0.2, // seconds between shots
    magSize: 12,
    reserve: 48,
    reloadTime: 1.5,
    recoil: 0.03,
    spread: 0.01,
    headshotMult: 2.5
  },
  rifle: {
    id: 'rifle',
    name: 'Tactical Rifle (M4)',
    cost: 2700,
    damage: 32,
    range: 150,
    fireRate: 0.09,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.2,
    recoil: 0.025,
    spread: 0.008,
    headshotMult: 4.0
  },
  sniper: {
    id: 'sniper',
    name: 'Scout Sniper',
    cost: 4750,
    damage: 85,
    range: 300,
    fireRate: 0.8,
    magSize: 10,
    reserve: 30,
    reloadTime: 3.0,
    recoil: 0.12,
    spread: 0.001,
    headshotMult: 5.0,
    scoped: true
  },
  shotgun: {
    id: 'shotgun',
    name: 'Tactical Shotgun',
    cost: 1200,
    damage: 18, // per pellet, 8 pellets
    pellets: 8,
    range: 40,
    fireRate: 0.5,
    magSize: 7,
    reserve: 28,
    reloadTime: 2.5,
    recoil: 0.08,
    spread: 0.04,
    headshotMult: 1.5
  }
};
