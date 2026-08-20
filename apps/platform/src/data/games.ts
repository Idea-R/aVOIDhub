export type GameStatus = "playable" | "external" | "soon";
export type GameHosting = "hosted" | "subdomain" | "independent";
export type GameScoreScope = "platform" | "independent" | "none";

export type GameFact = {
  label: string;
  value: string;
};

export type GameHighlight = {
  title: string;
  copy: string;
};

export type Game = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  premise: string;
  genre: string;
  image: string;
  imagePosition?: string;
  status: GameStatus;
  hosting: GameHosting;
  accent: string;
  meta: string;
  detailHref: `/games/${string}/`;
  playHref?: string;
  playLabel?: string;
  destination?: string;
  availability: string;
  statusNote: string;
  facts: GameFact[];
  highlights: GameHighlight[];
  deviceSupport: string[];
  score: {
    scope: GameScoreScope;
    headline: string;
    copy: string;
    gameKey?: "voidavoid" | "wreckavoid" | "wordavoid" | "tankavoid";
  };
};

export const originalGames: Game[] = [
  {
    id: "voidavoid",
    title: "VOIDaVOID",
    eyebrow: "The original",
    description:
      "Steer through a meteor field with nothing but your cursor and your nerve.",
    premise:
      "Your pointer is the player. Read the gaps, stay moving, and spend each detonator charge before the meteor field closes in.",
    genre: "Pointer survival",
    image: "/games/voidavoid.webp",
    status: "playable",
    hosting: "hosted",
    accent: "#ff5a2f",
    meta: "Hosted on aVOID",
    detailHref: "/games/voidavoid/",
    playHref: "/voidavoid/",
    playLabel: "Play VOIDaVOID",
    destination: "avoidgame.io/voidavoid",
    availability: "Playable now",
    statusNote:
      "The current game is live. Platform sign-in and secure new-run submission stay staged until the shared data foundation passes its branch rehearsal.",
    facts: [
      { label: "Move", value: "Mouse or touch drag" },
      { label: "Knockback", value: "Double-click or double-tap when charged" },
      { label: "Run shape", value: "Open-ended survival" },
    ],
    highlights: [
      {
        title: "Live inside the gap",
        copy: "Meteors arrive from every direction. Your safest line lasts only until the next wave changes it.",
      },
      {
        title: "Save one charge",
        copy: "Collect detonators, then spend a charge to destroy nearby threats and shove the next ring outward.",
      },
      {
        title: "Let the run breathe",
        copy: "Survival time drives the score. Distance, destroyed meteors, and clean movement tell the rest of the story.",
      },
    ],
    deviceSupport: ["Desktop mouse", "Touchscreen", "In-game audio controls"],
    score: {
      scope: "platform",
      gameKey: "voidavoid",
      headline: "Old scores remain history, not proof.",
      copy: "The existing board is being preserved as legacy data. New results will not be promoted beyond the evidence the platform actually checks.",
    },
  },
  {
    id: "wreckavoid",
    title: "WreckaVOID",
    eyebrow: "Physics survival",
    description:
      "Build momentum, swing the wrecking ball, and keep the arena from swallowing you.",
    premise:
      "You are tethered to the weapon. Move the body, shorten the chain, and turn a dangerous orbit into the thing that clears the arena.",
    genre: "Physics survival",
    image: "/games/wreckavoid.webp",
    status: "playable",
    hosting: "hosted",
    accent: "#ffc83d",
    meta: "Hosted on aVOID",
    detailHref: "/games/wreckavoid/",
    playHref: "/wreckavoid/",
    playLabel: "Play WreckaVOID",
    destination: "avoidgame.io/wreckavoid",
    availability: "Playable now",
    statusNote:
      "The playable build is live. Its secure score adapter is staged, while lifecycle, collision, and long-session cleanup remain part of the game’s own V1 sprint.",
    facts: [
      { label: "Move", value: "Mouse" },
      { label: "Chain", value: "Hold the mouse to retract" },
      { label: "Pause / help", value: "Space / H" },
    ],
    highlights: [
      {
        title: "Move the anchor",
        copy: "The ball follows your momentum, so positioning the player is only half of every decision.",
      },
      {
        title: "Shorten the problem",
        copy: "Retract the chain to change the orbit, recover control, or set up a harder return swing.",
      },
      {
        title: "Stay greedy carefully",
        copy: "Power-ups and chain hits reward aggression, but the arena keeps punishing a bad angle.",
      },
    ],
    deviceSupport: [
      "Desktop mouse",
      "Keyboard shortcuts",
      "Touch support not claimed yet",
    ],
    score: {
      scope: "platform",
      gameKey: "wreckavoid",
      headline: "A provisional board after the secure adapter lands.",
      copy: "The previous Wreck score table is being retired. Accepted runs will use one-use platform tickets and remain provisional until stronger checks exist.",
    },
  },
  {
    id: "wordavoid",
    title: "WORDaVOID",
    eyebrow: "Typing defense",
    description:
      "Type the incoming words before they reach you. Accuracy matters; panic is expensive.",
    premise:
      "Choose a mode, keep your hands moving, and clear each word before it reaches the center. Speed helps only when the letters are right.",
    genre: "Typing defense",
    image: "/games/wordavoid.webp",
    status: "playable",
    hosting: "hosted",
    accent: "#18c9b3",
    meta: "Hosted on aVOID",
    detailHref: "/games/wordavoid/",
    playHref: "/wordavoid/",
    playLabel: "Play WORDaVOID",
    destination: "avoidgame.io/wordavoid",
    availability: "Playable now",
    statusNote:
      "The game is live, builds cleanly, and already has the strongest test baseline of the hosted set. Its secure result path activates with the shared foundation.",
    facts: [
      { label: "Input", value: "Physical keyboard" },
      { label: "Pause", value: "Escape" },
      { label: "Modes", value: "Words, patterns, and difficulty choices" },
    ],
    highlights: [
      {
        title: "Read before you race",
        copy: "Incoming words become threats. Finish the active target cleanly before the board gets crowded.",
      },
      {
        title: "Pick the drill",
        copy: "Word and keyboard-pattern modes change whether the run tests reading, rhythm, or finger travel.",
      },
      {
        title: "Measure the useful parts",
        copy: "Score, accuracy, and words per minute describe different kinds of a good run.",
      },
    ],
    deviceSupport: [
      "Physical keyboard",
      "Desktop and laptop",
      "Audio and visual settings",
    ],
    score: {
      scope: "platform",
      gameKey: "wordavoid",
      headline: "The best candidate for validated results.",
      copy: "Its discrete keystroke stream can support stronger server checks than a free-form physics game. It still starts provisional until that validator is finished.",
    },
  },
  {
    id: "flipside",
    title: "FLIPSIDE",
    eyebrow: "Arena stunt driving",
    description:
      "Flip the car, land the line, and turn a tiny arena into a very bad idea.",
    premise:
      "Drive a toy-sized arena like gravity is a suggestion. Chain tricks, chase a cleaner landing, or bring a few friends into a battle room.",
    genre: "Stunt-driving arena",
    image: "/games/flipside.webp",
    status: "playable",
    hosting: "subdomain",
    accent: "#9dff50",
    meta: "Own aVOID subdomain",
    detailHref: "/games/flipside/",
    playHref: "https://flipside.avoidgame.io/",
    playLabel: "Play on FLIPSIDE",
    destination: "flipside.avoidgame.io",
    availability: "Live on its own subdomain",
    statusNote:
      "FLIPSIDE is a substantial live game with its own identity, scores, rooms, cosmetics, and checkout boundary. Those systems are not presented as shared aVOID platform features.",
    facts: [
      { label: "Drive", value: "Keyboard or on-screen controls" },
      { label: "Play", value: "Solo stunts and multiplayer rooms" },
      { label: "Account", value: "FLIPSIDE-owned" },
    ],
    highlights: [
      {
        title: "Make the landing count",
        copy: "A trick is only as good as the line you can drive away from.",
      },
      {
        title: "Change the arena",
        copy: "Different spaces turn the same car into a new problem of ramps, gaps, and recoveries.",
      },
      {
        title: "Bring a room",
        copy: "Multiplayer battles add countdowns, podiums, and rematches without turning this page into the game itself.",
      },
    ],
    deviceSupport: [
      "Desktop keyboard",
      "On-screen controls",
      "Multiplayer rooms",
    ],
    score: {
      scope: "independent",
      headline: "FLIPSIDE keeps its own scoreboards.",
      copy: "Its current results are written inside the FLIPSIDE product boundary. They do not join the shared aVOID ladder unless a separate hardening and migration project is approved.",
    },
  },
  {
    id: "tankavoid",
    title: "TankaVOID",
    eyebrow: "Directional tank combat",
    description:
      "Armor angles, ricochets, and deliberate movement. The rebuild is waiting in the hangar.",
    premise:
      "The V1 target is a compact tank survival game where facing matters: strong front armor, vulnerable sides and rear, and hits that explain why they penetrated or bounced.",
    genre: "Directional tank survival",
    image: "/games/tankavoid.webp",
    status: "soon",
    hosting: "hosted",
    accent: "#ee4d65",
    meta: "Rebuild queued",
    detailHref: "/games/tankavoid/",
    availability: "In development",
    statusNote:
      "The clean rebuild now completes a deterministic five-wave run with directional armor, touch-candidate controls, and bounded platform receipts. Public Play remains held for physical-device and deployed rollback checks.",
    facts: [
      { label: "V1 loop", value: "Five waves and one commander" },
      { label: "Core idea", value: "Front / side / rear armor" },
      { label: "Launch", value: "Release review only" },
    ],
    highlights: [
      {
        title: "Show the armor",
        copy: "Facing the threat should be a decision the player can read, not a hidden damage multiplier.",
      },
      {
        title: "Explain the hit",
        copy: "Impact angle, penetration, and ricochet feedback need to make every result feel earned.",
      },
      {
        title: "Keep V1 narrow",
        copy: "One complete survival run matters more than preserving every enemy, pickup, and half-connected prototype system.",
      },
    ],
    deviceSupport: [
      "Keyboard and pointer verified",
      "Touch release candidate",
      "Public route still gated",
    ],
    score: {
      scope: "platform",
      gameKey: "tankavoid",
      headline: "Five waves, one bounded provisional result.",
      copy: "The platform recomputes the score from a tightly bounded terminal summary and a one-use run. That makes the result provisional—not replay-verified—and keeps old prototype samples off this board.",
    },
  },
];

export const relatedGames: Game[] = [
  {
    id: "bloomfall",
    title: "Bloomfall",
    eyebrow: "Top-down shooter RPG",
    description:
      "A harsher world with its own progression, identity, and home on the web.",
    premise:
      "Choose a hero and fight through a campaign built around ranged movement, chapter progression, and runs that belong to Bloomfall itself.",
    genre: "Top-down shooter RPG",
    image: "/games/bloomfall-live.webp",
    imagePosition: "center 31%",
    status: "external",
    hosting: "independent",
    accent: "#ff6ea8",
    meta: "Opens bloomfall.io",
    detailHref: "/games/bloomfall/",
    playHref: "https://bloomfall.io/",
    playLabel: "Open Bloomfall",
    destination: "bloomfall.io",
    availability: "Live on its own domain",
    statusNote:
      "Bloomfall is an independent Ideas Realized game with its own campaign, account, progression, and release work. This page does not imply shared aVOID saves or scores.",
    facts: [
      { label: "Campaign", value: "Heroes, difficulties, and chapters" },
      { label: "Play", value: "Guest play with optional account history" },
      { label: "Account", value: "Bloomfall-owned" },
    ],
    highlights: [
      {
        title: "Choose the hero",
        copy: "Different kits change how you create space, manage incoming enemies, and survive the next room.",
      },
      {
        title: "Carry a campaign",
        copy: "Chapters and milestones give each run somewhere to go beyond the immediate fight.",
      },
      {
        title: "Keep its world intact",
        copy: "Bloomfall remains its own product rather than being flattened into a shared arcade skin.",
      },
    ],
    deviceSupport: [
      "Keyboard and pointer",
      "Mobile controls in Bloomfall",
      "Independent save and account",
    ],
    score: {
      scope: "independent",
      headline: "Progress stays with Bloomfall.",
      copy: "Run history, campaign milestones, and identity remain on bloomfall.io. aVOID does not mirror them into a shared competition board.",
    },
  },
  {
    id: "acrolis",
    title: "Acrolis Crawlers",
    eyebrow: "Roguelike adventure",
    description:
      "Choose a route, build a run, and explore a game world that lives beyond the aVOID ladder.",
    premise:
      "Build a character, move through authored dungeons and towns, and carry a longer adventure through a game that already has its own progression systems.",
    genre: "Roguelike adventure",
    image: "/games/acrolis-live.webp",
    imagePosition: "center 42%",
    status: "external",
    hosting: "independent",
    accent: "#8fa6ff",
    meta: "Opens play.acrolis.io",
    detailHref: "/games/acrolis/",
    playHref: "https://play.acrolis.io/",
    playLabel: "Open Acrolis",
    destination: "play.acrolis.io",
    availability: "Live on its own domain",
    statusNote:
      "Acrolis has its own roadmap, account, progression, and leaderboard systems. aVOID presents the work and the destination without claiming those records.",
    facts: [
      {
        label: "Structure",
        value: "Dungeons, towns, and campaign progression",
      },
      { label: "Play", value: "Browser and installable PWA" },
      { label: "Account", value: "Acrolis-owned" },
    ],
    highlights: [
      {
        title: "Build the run",
        copy: "Routes, equipment, and character decisions shape what survives the next dungeon.",
      },
      {
        title: "Leave the dungeon",
        copy: "Towns, overworld progression, and longer systems make Acrolis more than a single arcade session.",
      },
      {
        title: "Follow its own roadmap",
        copy: "The game’s formal V1 work stays in the Acrolis project instead of being duplicated inside aVOID.",
      },
    ],
    deviceSupport: [
      "Keyboard",
      "Controller foundations",
      "Installable web app",
    ],
    score: {
      scope: "independent",
      headline: "Acrolis owns its runs and ladder.",
      copy: "Its profiles, run history, challenges, and leaderboards stay on play.acrolis.io. aVOID membership does not imply Acrolis benefits.",
    },
  },
  {
    id: "ttt3d",
    title: "Tic Tac Toe in 3D",
    eyebrow: "Spatial strategy",
    description:
      "The familiar grid gets another axis and enough room for your plans to go sideways.",
    premise:
      "Place a mark in a three-dimensional board, track lines across layers, and catch the win your opponent stopped watching two planes ago.",
    genre: "Spatial strategy",
    image: "/games/ttt3d-live.webp",
    imagePosition: "center 46%",
    status: "external",
    hosting: "independent",
    accent: "#f3b84b",
    meta: "Opens ttt3d.app",
    detailHref: "/games/ttt3d/",
    playHref: "https://ttt3d.app/",
    playLabel: "Open ttt3d.app",
    destination: "ttt3d.app",
    availability: "Live on its own domain",
    statusNote:
      "The public game is live, but its canonical source and account boundary are not part of the aVOID repository. This remains an external Ideas Realized listing.",
    facts: [
      { label: "Board", value: "Three spatial axes" },
      { label: "Input", value: "Pointer or touch selection" },
      { label: "Account", value: "No aVOID account promise" },
    ],
    highlights: [
      {
        title: "Watch every layer",
        copy: "A move can finish a line on one plane while opening a diagonal through the full cube.",
      },
      {
        title: "Make space readable",
        copy: "The challenge is not adding rules; it is seeing familiar rules across one more dimension.",
      },
      {
        title: "Keep the match independent",
        copy: "The game opens on ttt3d.app and does not borrow aVOID profiles or leaderboard claims.",
      },
    ],
    deviceSupport: ["Pointer", "Touchscreen", "Independent web app"],
    score: {
      scope: "independent",
      headline: "Matches stay on ttt3d.app.",
      copy: "This directory page offers context and a clean handoff. It does not create shared records, ratings, or profiles.",
    },
  },
];

export const allGames = [...originalGames, ...relatedGames];

export function getGameById(id: string): Game | undefined {
  return allGames.find((game) => game.id === id);
}
