// The story of Sol Dorado: mission definitions, dialogue and objectives.
// Each mission: giver tile, title, intro lines (subtitle dialogue), then a
// list of objective steps executed in order by systems/missions.js.

export const STORY = [
  {
    id: 'welcome',
    giver: 'diner',
    title: 'PALMS & PROBLEMS',
    lines: [
      ['ROSALIA', 'You made it off the bus, kid. Welcome to Sol Dorado.'],
      ['ROSALIA', 'Word of advice: nothing here is free, especially not trouble.'],
      ['ROSALIA', 'First job. My cousin Marco left a car parked in Meridian Core. Go bring it back to me.'],
    ],
    steps: [
      { type: 'steal-car', pos: 'towers', text: 'Boost the sedan near Cormorant Towers' },
      { type: 'deliver-car', pos: 'diner', text: 'Drive it back to the Sunrise Diner' },
    ],
    reward: 450,
  },
  {
    id: 'collections',
    giver: 'diner',
    title: 'SMALL DEBTS',
    lines: [
      ['ROSALIA', 'Three deadbeats owe the diner money. They suddenly love the beach.'],
      ['ROSALIA', 'Remind them what interest means. Do not get caught.'],
    ],
    steps: [
      { type: 'goto', pos: 'penthouse', text: 'Find Teo at Veranda Heights' },
      { type: 'kill', count: 3, pos: 'penthouse', text: 'Collect from the debt runners' },
      { type: 'goto', pos: 'diner', text: 'Return to Rosalia' },
    ],
    reward: 600,
  },
  {
    id: 'warehouse-run',
    giver: 'garage',
    title: 'AFTER HOURS FREIGHT',
    lines: [
      ['TEO', 'Del Oro Warehouse is moving crates nobody signed for. Tonight it is ours.'],
      ['TEO', 'Their crew will shoot. Try to look surprised.'],
    ],
    steps: [
      { type: 'goto', pos: 'warehouse', text: 'Get to the Del Oro Warehouse' },
      { type: 'kill', count: 4, pos: 'warehouse', text: 'Clear out the Del Oro crew' },
      { type: 'survive-wanted', stars: 3, text: 'Lose the heat (3 stars)' },
    ],
    reward: 900,
  },
  {
    id: 'race-marina',
    giver: 'raceStart',
    title: 'BOARDWALK STRIP',
    lines: [
      ['CHICO', 'Street race, boardwalk to the marina. Cash on the hood.'],
      ['CHICO', 'No cops, no rules, no excuses.'],
    ],
    steps: [
      { type: 'race', checkpoints: ['raceStart', 'marina', 'penthouse', 'towers'], text: 'Win the street race' },
    ],
    reward: 1200,
  },
  {
    id: 'confession',
    giver: 'garage',
    title: 'THE CORMORANT JOB',
    lines: [
      ['ROSALIA', 'The men who ran this city out of Cormorant Towers keep ledgers upstairs.'],
      ['ROSALIA', 'Bring me those ledgers and you can stop being nobody.'],
    ],
    steps: [
      { type: 'goto', pos: 'towers', text: 'Reach Cormorant Towers' },
      { type: 'kill', count: 5, pos: 'towers', text: 'Break the tower security' },
      { type: 'survive-wanted', stars: 4, text: 'Escape with the ledgers (4 stars)' },
      { type: 'deliver-car', pos: 'garage', text: 'Drive the ledgers to Mirage Customs' },
    ],
    reward: 1500,
  },
  {
    id: 'ambush',
    giver: 'garage',
    title: 'NO MORE FAVOURS',
    lines: [
      ['TEO', 'The ledger names a fixer. He already sent people for you.'],
      ['TEO', 'Hit the docks first. End it before he organises.'],
    ],
    steps: [
      { type: 'goto', pos: 'marina', text: 'Get to Marina Sur Docks' },
      { type: 'kill', count: 6, pos: 'marina', text: 'Wipe out the fixer\u2019s crew' },
      { type: 'survive-wanted', stars: 4, text: 'Shake the response (4 stars)' },
    ],
    reward: 2000,
  },
  {
    id: 'finale-drive',
    giver: 'hotel',
    title: 'LAST SUN OVER SOL DORADO',
    lines: [
      ['ROSALIA', 'It is done. The city will forget us by Friday, the way it forgets everything.'],
      ['ROSALIA', 'One last drive down the coast. Make it a good one.'],
    ],
    steps: [
      { type: 'goto', pos: 'raceStart', text: 'Take the coast road south' },
      { type: 'goto', pos: 'marina', text: 'Watch the sun go down at the marina' },
    ],
    reward: 3000,
  },
];

export const SIDE_JOBS = [
  { id: 'taxi-1', title: 'COURIER RUN', giver: 'gunShop', kind: 'delivery', pay: 300, text: 'Deliver the parcel across town before the timer ends.' },
  { id: 'rampage-1', title: 'BOARDWALK RAMPAGE', giver: 'raceStart', kind: 'rampage', pay: 350, text: 'Score 8 takedowns in 60 seconds.' },
  { id: 'race-2', title: 'NIGHT SPRINT', giver: 'garage', kind: 'race', pay: 500, text: 'Beat the clock through three checkpoints.' },
];

export const CHARACTERS = 'Rosalia, Teo, Chico, Marco, the Del Oro crew, the fixer Vann';
