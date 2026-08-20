import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const sourceUrl = new URL("../src/data/games.ts", import.meta.url);
const source = readFileSync(sourceUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourceUrl.pathname,
}).outputText;

const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox, { filename: sourceUrl.pathname });

const { allGames, getGameById } = sandbox.exports;
const expectedIds = [
  "voidavoid",
  "wreckavoid",
  "wordavoid",
  "flipside",
  "tankavoid",
  "bloomfall",
  "acrolis",
  "ttt3d",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(Array.isArray(allGames), "allGames must be an array");
assert(
  allGames.length === expectedIds.length,
  "catalog must contain exactly eight V1 titles",
);
assert(
  JSON.stringify(allGames.map((game) => game.id)) ===
    JSON.stringify(expectedIds),
  "catalog IDs or ordering changed without updating the V1 contract",
);
assert(
  new Set(allGames.map((game) => game.id)).size === allGames.length,
  "game IDs must be unique",
);
assert(
  new Set(allGames.map((game) => game.detailHref)).size === allGames.length,
  "detail routes must be unique",
);

for (const game of allGames) {
  assert(
    getGameById(game.id) === game,
    `${game.id} must resolve through getGameById`,
  );
  assert(
    game.detailHref === `/games/${game.id}/`,
    `${game.id} must use its canonical detail route`,
  );
  assert(
    game.highlights.length === 3,
    `${game.id} needs three detail-page highlights`,
  );
  assert(
    game.facts.length >= 3,
    `${game.id} needs at least three honest game facts`,
  );
  assert(
    game.deviceSupport.length >= 2,
    `${game.id} needs explicit device guidance`,
  );
}

const hostedRoutes = new Map([
  ["voidavoid", "/voidavoid/"],
  ["wreckavoid", "/wreckavoid/"],
  ["wordavoid", "/wordavoid/"],
]);

for (const [id, playHref] of hostedRoutes) {
  const game = getGameById(id);
  assert(
    game.hosting === "hosted",
    `${id} must remain a same-origin hosted game`,
  );
  assert(
    game.playHref === playHref,
    `${id} must preserve its immersive play route`,
  );
  assert(
    game.score.scope === "platform",
    `${id} must use the platform score boundary`,
  );
  assert(
    game.score.gameKey === id,
    `${id} must use its canonical platform game key`,
  );
}

const tank = getGameById("tankavoid");
assert(tank.status === "soon", "TankaVOID must remain coming soon for V1");
assert(
  tank.playHref === undefined,
  "TankaVOID must not expose a playable route",
);
assert(
  tank.score.scope === "none",
  "TankaVOID must not imply a live leaderboard",
);

for (const id of ["bloomfall", "acrolis", "ttt3d"]) {
  const game = getGameById(id);
  assert(
    game.hosting === "independent",
    `${id} must remain an independent-domain game`,
  );
  assert(
    game.score.scope === "independent",
    `${id} must not use the aVOID leaderboard`,
  );
  assert(
    game.playHref.startsWith("https://"),
    `${id} must launch its HTTPS-owned domain`,
  );
}

const flipside = getGameById("flipside");
assert(
  flipside.hosting === "subdomain",
  "FLIPSIDE must remain a first-party subdomain handoff",
);
assert(
  flipside.score.scope === "independent",
  "FLIPSIDE scores must remain independent until hardened",
);

console.log(
  "Game catalog contract verified: 8 titles, 8 details, 7 play destinations, 1 honest coming-soon state.",
);
