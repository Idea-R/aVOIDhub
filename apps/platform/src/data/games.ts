export type GameStatus = 'playable' | 'external' | 'soon'

export type Game = {
  id: string
  title: string
  eyebrow: string
  description: string
  href?: string
  image?: string
  status: GameStatus
  accent: string
  meta: string
}

export const originalGames: Game[] = [
  {
    id: 'voidavoid',
    title: 'VOIDaVOID',
    eyebrow: 'The original',
    description: 'Steer through a meteor field with nothing but your cursor and your nerve.',
    href: '/voidavoid/',
    image: '/games/voidavoid.png',
    status: 'playable',
    accent: '#ff5a2f',
    meta: 'Play on aVOID',
  },
  {
    id: 'wreckavoid',
    title: 'WreckaVOID',
    eyebrow: 'Physics survival',
    description: 'Build momentum, swing the wrecking ball, and keep the arena from swallowing you.',
    href: '/wreckavoid/',
    image: '/games/wreckavoid.png',
    status: 'playable',
    accent: '#ffc83d',
    meta: 'Play on aVOID',
  },
  {
    id: 'wordavoid',
    title: 'WORDaVOID',
    eyebrow: 'Typing defense',
    description: 'Type the incoming words before they reach you. Accuracy matters; panic is expensive.',
    href: '/wordavoid/',
    image: '/games/wordavoid.png',
    status: 'playable',
    accent: '#18c9b3',
    meta: 'Play on aVOID',
  },
  {
    id: 'flipside',
    title: 'FLIPSIDE',
    eyebrow: 'Arena stunt driving',
    description: 'Flip the car, land the line, and turn a tiny arena into a very bad idea.',
    href: 'https://flipside.avoidgame.io/',
    image: '/games/flipside.png',
    status: 'playable',
    accent: '#9dff50',
    meta: 'Play on aVOID',
  },
  {
    id: 'tankavoid',
    title: 'TankaVOID',
    eyebrow: 'Directional tank combat',
    description: 'Armor angles, ricochets, and deliberate movement. The rebuild is waiting in the hangar.',
    image: '/games/tankavoid.png',
    status: 'soon',
    accent: '#ee4d65',
    meta: 'Rebuild queued',
  },
]

export const relatedGames: Game[] = [
  {
    id: 'bloomfall',
    title: 'Bloomfall',
    eyebrow: 'Top-down shooter RPG',
    description: 'A harsher world with its own progression, identity, and home on the web.',
    href: 'https://bloomfall.io/',
    status: 'external',
    accent: '#ff6ea8',
    meta: 'Opens bloomfall.io',
  },
  {
    id: 'acrolis',
    title: 'Acrolis Crawlers',
    eyebrow: 'Roguelike adventure',
    description: 'Choose a route, build a run, and explore a game world that lives beyond the aVOID ladder.',
    href: 'https://play.acrolis.io/',
    status: 'external',
    accent: '#8fa6ff',
    meta: 'Opens play.acrolis.io',
  },
  {
    id: 'ttt3d',
    title: 'Tic Tac Toe in 3D',
    eyebrow: 'Spatial strategy',
    description: 'The familiar grid gets another axis and enough room for your plans to go sideways.',
    href: 'https://ttt3d.app/',
    status: 'external',
    accent: '#f3b84b',
    meta: 'Opens ttt3d.app',
  },
]
