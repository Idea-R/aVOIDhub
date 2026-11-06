import {
  ARENAS,
  CHARACTERS,
  UPGRADES,
  type MatchConfig,
  type Seat,
} from "@avoid/boomerangavoid-sim";
import {
  BIOMES,
  copy,
  newDraft,
  parseDraft,
  agentBrief,
  type StudioDraft,
} from "./studio-contract";
import type { Control } from "./input";
import "./studio.css";
import { assetStudio } from "./asset-studio";
import { moveStudioObject } from "./studio-edit";
import { StudioHistory } from "./studio-history";
import { captureMap, makeReport, readReports, setReportStatus } from "./studio-reports";

const STORAGE = "boomerangavoid.ads.draft.v1";
const escape = (v: unknown) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export function openStudio(
  root: HTMLElement,
  onPlay: (config: MatchConfig, seats: (Seat & { control: Control })[]) => void,
  onClose: () => void,
) {
  let active=true;
  let draft = newDraft(),
    selected = "",
    status =
      "Drafts stay in this browser. Playtests use the real local simulation.",
    tab = "maps";
  let disposeAssets: (() => void) | null = null;
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) draft = parseDraft(JSON.parse(saved));
  } catch {
    status = "Saved draft could not be loaded. A clean template is open.";
  }
  const history = new StudioHistory(draft);
  const fields = ["obstacles", "hazards", "platforms", "switches"] as const;
  const objects = () =>
    fields.flatMap((field) =>
      (draft.arena[field] || []).map((value) => ({ field, value })),
    );
  const current = () => objects().find((o) => o.value.id === selected);
  const save = () => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(draft));
    } catch {
      status = "Browser storage unavailable; export the draft to keep it.";
    }
  };
  const options = (items: [string, string][], value: string) =>
    items
      .map(
        ([id, name]) =>
          `<option value="${escape(id)}" ${id === value ? "selected" : ""}>${escape(name)}</option>`,
      )
      .join("");
  const number = (
    label: string,
    value: number,
    attr: string,
    min = -15,
    max = 30,
    step = 0.25,
  ) =>
    `<label>${label}<input type="number" value="${value}" min="${min}" max="${max}" step="${step}" ${attr}></label>`;
  function mapSvg() {
    const a = draft.arena;
    return `<svg id="ads-map" viewBox="${-a.width / 2 - 1} ${-a.height / 2 - 1} ${a.width + 2} ${a.height + 2}" role="img" aria-label="Arena plan; select objects to edit their measured geometry"><rect x="${-a.width / 2}" y="${-a.height / 2}" width="${a.width}" height="${a.height}" rx=".25" fill="${hex(a.ground)}"/>${objects()
      .map(
        ({ field, value: o }) =>
          `<g data-object="${escape(o.id)}" tabindex="0" role="button" aria-label="${escape(o.id)}"><rect x="${o.x - o.w / 2}" y="${o.y - o.h / 2}" width="${o.w}" height="${o.h}" rx=".08" fill="${field === "hazards" ? ("kind" in o && o.kind === "gap" ? "#163b4c" : "#d78d6b") : field === "platforms" ? "#efd088" : field === "switches" ? "#e1a2c6" : "#506e61"}" stroke="${o.id === selected ? "#fff7d4" : "#233d3b"}" stroke-width="${o.id === selected ? 0.14 : 0.04}"/>${field === "platforms" && "to" in o ? `<path d="M${o.x} ${o.y}L${o.to.x} ${o.to.y}" stroke="#ffefb5" stroke-width=".08" stroke-dasharray=".2 .2"/>` : ""}<text x="${o.x}" y="${o.y + 0.12}" text-anchor="middle" font-size=".32" fill="#fff">${escape(o.id)}</text></g>`,
      )
      .join(
        "",
      )}${a.spawns.map((s, i) => `<g><circle cx="${s.x}" cy="${s.y}" r=".38" fill="${hex(CHARACTERS[i].color)}" stroke="#233d3b" stroke-width=".06"/><text x="${s.x}" y="${s.y + 0.12}" font-size=".34" text-anchor="middle">${i + 1}</text></g>`).join("")}${a.targets.map((t, i) => `<circle cx="${t.x}" cy="${t.y}" r="1.15" fill="none" stroke="#fff0b1" stroke-width=".07" stroke-dasharray=".18 .16"><title>Relay target ${i + 1}</title></circle>`).join("")}</svg>`;
  }
  function inspector() {
    const item = current();
    if (!item)
      return `<h2>Object inspector</h2><p>Select a footprint on the map, or add a feature. Spawn dots and relay circles show placement constraints.</p>`;
    const o = item.value;
    return `<h2>${escape(o.id)}</h2><div class="ads-numbers">${["x", "y", "w", "h"].map((k) => number(k, Number(o[k as keyof typeof o]), `data-object-field="${k}"`)).join("")}${"to" in o ? number("Path end X", o.to.x, 'data-path="x"') + number("Path end Y", o.to.y, 'data-path="y"') : ""}${"period" in o ? number("Cycle (ticks)", o.period, 'data-object-field="period"', 1, 3600, 1) : ""}${"duration" in o ? number("Open (ticks)", o.duration, 'data-object-field="duration"', 30, 900, 1) : ""}</div>${
      "target" in o
        ? `<label>Shutter target<select data-target>${options(
            draft.arena.hazards
              .filter((h) => h.kind === "shutter")
              .map((h) => [h.id, h.id]),
            o.target,
          )}</select></label>`
        : ""
    }<button data-do="delete" class="secondary">Remove object</button>`;
  }
  function rules() {
    const selectedPowers = draft.match.enabledUpgrades ?? UPGRADES.map((u) => u.id);
    return `<section><h2>Match desk</h2><div class="ads-numbers"><label>Mode<select data-rule="mode">${options(
      [
        ["ffa", "Free for all"],
        ["teams", "Teams"],
        ["relay", "Relay Seed"],
      ],
      draft.match.mode,
    )}</select></label><label>Points to win<select data-rule="wins">${options(
      [3, 5, 7].map((n) => [String(n), String(n)]),
      String(draft.match.wins),
    )}</select></label>${number("Seed", draft.match.seed, 'data-rule="seed"', 0, 4294967295, 1)}</div><label class="check-row"><input type="checkbox" data-rule="friendlyFire" ${draft.match.friendlyFire ? "checked" : ""}>Friendly fire</label><h3>Power-up pool</h3><label class="check-row"><input type="checkbox" data-rule="upgrades" ${draft.match.upgrades ? "checked" : ""}>Spawn power-ups</label><p id="ads-power-status">${!draft.match.upgrades ? "Power-up drops are off. Your selected pool is kept for when you enable them." : selectedPowers.length === 0 ? "No power-ups selected. No drops will spawn." : `${selectedPowers.length} power-up ${selectedPowers.length === 1 ? "type can" : "types can"} spawn. Only selected types will appear.`}</p><fieldset class="ads-powers" aria-label="Allowed power-ups" aria-describedby="ads-power-status" ${draft.match.upgrades ? "" : "disabled"}>${UPGRADES.map((u) => `<label class="check-row"><input type="checkbox" data-power="${u.id}" ${selectedPowers.includes(u.id) ? "checked" : ""}><span><strong>${escape(u.name)}</strong><small>${escape(u.description)}</small></span></label>`).join("")}</fieldset></section>`;
  }
  function crew() {
    return `<section><h2>Players & bots</h2><p>Each human needs a unique input. Bot difficulty is per seat.</p>${draft.seats
      .map(
        (s, i) =>
          `<article class="ads-seat"><strong>Seat ${i + 1}</strong><label>Name<input value="${escape(s.name)}" maxlength="18" data-seat="${i}" data-field="name"></label><label>Character<select data-seat="${i}" data-field="character">${options(
            CHARACTERS.map((c) => [c.id, c.name]),
            s.character,
          )}</select></label><label>Input<select data-seat="${i}" data-field="control">${options([["keyboard1", "Keyboard 1 / Touch"], ["keyboard2", "Keyboard 2"], ...[0, 1, 2, 3, 4, 5].map((n) => [`pad${n}`, `Gamepad ${n + 1}`] as [string, string]), ["bot", "Bot"]], s.control)}</select></label>${
            s.bot
              ? `<label>Difficulty<select data-seat="${i}" data-field="bot">${options(
                  ["easy", "normal", "hard"].map((v) => [v, v]),
                  s.bot,
                )}</select></label>`
              : ""
          }<label>Team<select data-seat="${i}" data-field="team">${options(
            [
              ["0", "Sun"],
              ["1", "Moon"],
            ],
            String(s.team),
          )}</select></label>${draft.seats.length > 2 ? `<button data-remove-seat="${i}" class="text-button">Remove</button>` : ""}</article>`,
      )
      .join(
        "",
      )}${draft.seats.length < 6 ? '<button data-do="add-seat" class="secondary">Add bot / player</button>' : ""}</section>`;
  }
  function reports() {
    let saved = readReports(null);
    try {
      saved = readReports(JSON.parse(localStorage.getItem("bav.ads.reports") || "[]"));
    } catch {}
    return `<section><h2>Report pile</h2><p>Capture a measured map image with the exact seed, rules, crew and selected object.</p><textarea id="ads-note" rows="3" placeholder="What should change, and where?"></textarea><button data-do="report" class="secondary">Capture note + map</button><button id="ads-export-reports" class="secondary">Export report JSON</button>${saved.slice().reverse().map(r=>`<article class="ads-report"><strong>${escape(r.note)}</strong><p>${escape(r.status)} · ${escape(r.selected||r.draft.arena.name)} · seed ${r.draft.match.seed}</p>${r.mapSnapshot?`<img src="${r.mapSnapshot}" alt="Measured map when the report was captured">`:""}<label>Fix note<input maxlength="1000" data-fix-note="${escape(r.id)}" value="${escape(r.fixNote)}"></label><div class="ads-tools">${["open","fixed","archived"].map(status=>`<button data-report-id="${escape(r.id)}" data-report-status="${status}">${status}</button>`).join("")}</div></article>`).join("")}<textarea id="ads-reports" rows="6" readonly>${escape(JSON.stringify(saved, null, 2))}</textarea></section>`;
  }
  function render() {
    if(!active)return;
    root.innerHTML = `<main class="ads"><header><div><p class="eyebrow">AVOID · AGENT DEVELOPMENT STUDIO</p><h1>Garden workshop</h1><p>Arena drafts, proving yard and match desk</p></div><button data-do="close" class="secondary">Back to game</button></header><nav>${[
      ["maps", "Level maps"],
      ["rules", "Match rules"],
      ["crew", "Crew"],
      ["exchange", "Agent exchange"],
      ["reports", "Report pile"],
    ]
      .map(
        ([id, title]) =>
          `<button data-tab="${id}" class="${tab === id ? "primary" : "secondary"}">${title}</button>`,
      )
      .join(
        "",
      )}</nav><div class="ads-toolbar"><label>Template<select id="ads-template">${options(
      ARENAS.map((a) => [a.id, a.name]),
      draft.arena.id,
    )}</select></label><label>Biome<select id="ads-biome">${options(
      Object.entries(BIOMES).map(([id, b]) => [id, b.name]),
      draft.biome,
    )}</select></label><label>Draft label<input id="ads-label" maxlength="80" value="${escape(draft.label)}"></label><button data-do="undo" ${history.canUndo ? "" : "disabled"}>Undo</button><button data-do="redo" ${history.canRedo ? "" : "disabled"}>Redo</button><button data-do="audit" class="secondary">Audit draft</button><button data-do="play" class="primary">Playtest this draft</button></div><p class="ads-status" role="status">${escape(status)}</p><div class="ads-layout"><section class="ads-plan">${mapSvg()}<p class="field-help">Ground · dark pits · gold moving floors · pink switches · numbered spawns. Dashed lines show platform paths.</p></section><aside>${tab === "maps" ? inspector() + `<h3>Add a feature</h3><div class="ads-tools">${["stone", "gap", "vent", "platform", "shutter", "switch"].map((v) => `<button data-add="${v}" class="secondary">+ ${v}</button>`).join("")}</div>` : tab === "rules" ? rules() : tab === "crew" ? crew() : tab === "reports" ? reports() : `<h2>Agent exchange</h2><p>Export a complete versioned document, or copy the brief into your coding agent. Imported drafts pass the same audit before play. No model calls or paid service are embedded here.</p><textarea id="ads-json" rows="12">${escape(JSON.stringify(draft, null, 2))}</textarea><div class="ads-tools"><button data-do="import">Import JSON</button><button data-do="export">Download JSON</button><button data-do="brief">Copy agent brief</button></div>`}</aside></div></main>`;
    bind();
  }
  function commit(fn: () => void) {
    const previousSelection = selected;
    try {
      fn();
      history.replace(draft);
      draft = history.read();
      status = "Draft validated and saved.";
      save();
    } catch (error) {
      draft = history.read();
      selected = previousSelection;
      status = `Change rejected: ${(error as Error).message}`;
    }
    render();
  }
  function bind() {
    const map=root.querySelector<SVGSVGElement>("#ads-map")!;
    let drag:{id:string;pointer:number;start:DOMPoint;before:StudioDraft;moved:boolean}|null=null;
    const world=(event:PointerEvent)=>new DOMPoint(event.clientX,event.clientY).matrixTransform(map.getScreenCTM()!.inverse());
    map.onpointerdown=event=>{
      const target=(event.target as Element).closest<SVGElement>("[data-object]");
      if(!target||event.button!==0)return;
      event.preventDefault();selected=target.dataset.object!;
      drag={id:selected,pointer:event.pointerId,start:world(event),before:copy(draft),moved:false};map.setPointerCapture(event.pointerId);
    };
    map.onpointermove=event=>{
      if(!drag||event.pointerId!==drag.pointer)return;
      const point=world(event),dx=point.x-drag.start.x,dy=point.y-drag.start.y;
      drag.moved ||= Math.hypot(dx,dy)>.04;
      draft=moveStudioObject(drag.before,drag.id,dx,dy);
      const item=current()!.value,group=Array.from(map.querySelectorAll<SVGGElement>("[data-object]")).find(g=>g.dataset.object===drag!.id)!;
      const rect=group.querySelector("rect")!;rect.setAttribute("x",String(item.x-item.w/2));rect.setAttribute("y",String(item.y-item.h/2));rect.setAttribute("stroke","#fff7d4");rect.setAttribute("stroke-width",".14");
      const text=group.querySelector("text")!;text.setAttribute("x",String(item.x));text.setAttribute("y",String(item.y+.12));
      if("to" in item)group.querySelector("path")?.setAttribute("d",`M${item.x} ${item.y}L${item.to.x} ${item.to.y}`);
    };
    const endDrag=(event:PointerEvent)=>{
      if(!drag||event.pointerId!==drag.pointer)return;const ended=drag;drag=null;
      if(event.type==="pointercancel"){draft=ended.before;render();return;}
      if(ended.moved){commit(()=>{});return;}
      render();
    };
    map.onpointerup=endDrag;map.onpointercancel=endDrag;
    root.querySelectorAll<HTMLElement>("[data-report-status]").forEach(button=>button.onclick=()=>{
      const id=button.dataset.reportId!,fix=Array.from(root.querySelectorAll<HTMLInputElement>("[data-fix-note]")).find(el=>el.dataset.fixNote===id)?.value||"";
      try{const records=readReports(JSON.parse(localStorage.getItem("bav.ads.reports")||"[]"));localStorage.setItem("bav.ads.reports",JSON.stringify(setReportStatus(records,id,button.dataset.reportStatus as "open"|"fixed"|"archived",fix)));status="Report status saved.";}catch{status="Report could not be saved. Export your notes.";}render();
    });
    root.querySelector<HTMLElement>("#ads-export-reports")?.addEventListener("click",()=>{
      const value=root.querySelector<HTMLTextAreaElement>("#ads-reports")!.value,url=URL.createObjectURL(new Blob([value],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="boomerangavoid-reports.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    root.querySelectorAll<HTMLElement>("[data-tab]").forEach(
      (el) =>
        (el.onclick = () => {
          tab = el.dataset.tab!;
          render();
        }),
    );
    const nav = root.querySelector("nav")!;
    const assetButton = document.createElement("button");
    assetButton.textContent = "Cast & motion";
    assetButton.className = tab === "assets" ? "primary" : "secondary";
    assetButton.onclick = () => {
      tab = "assets";
      render();
    };
    nav.append(assetButton);
    disposeAssets?.();
    disposeAssets = null;
    if (tab === "assets")
      disposeAssets = assetStudio(root.querySelector("aside")!);
    if (tab === "rules") {
      if (draft.match.mode === "relay") {
        root.querySelector<HTMLSelectElement>('[data-rule="wins"]')!.disabled=true;
        root.querySelector("aside section")?.insertAdjacentHTML("beforeend",'<p>Relay Seed uses three deliveries and one arena per timed match. Round-win and stage-sequence settings apply to Free for all and Teams.</p>');
      }
      root.querySelector("aside section")?.insertAdjacentHTML(
        "beforeend",
        `<h3>Stage sequence</h3><p>One stage per round; the sequence loops. Your edited template uses the draft geometry.</p><div class="ads-numbers">${(
          draft.match.stageIds || [draft.arena.id]
        )
          .map(
            (id, i) =>
              `<label>Stage ${i + 1}<select data-stage="${i}">${options(
                ARENAS.map((a) => [a.id, a.name]),
                id,
              )}</select></label>`,
          )
          .join(
            "",
          )}</div><div class="ads-tools"><button data-stage-add>+ Stage</button><button data-stage-remove>Remove last</button></div>`,
      );
      root.querySelectorAll<HTMLSelectElement>("[data-stage]").forEach(
        (el) =>
          (el.onchange = () =>
            commit(() => {
              const stages = draft.match.stageIds || [draft.arena.id];
              stages[Number(el.dataset.stage)] = el.value;
              draft.match.stageIds = stages;
            })),
      );
      root.querySelector<HTMLElement>("[data-stage-add]")!.onclick = () =>
        commit(() => {
          const stages = draft.match.stageIds || [draft.arena.id];
          if (stages.length < 6)
            stages.push(ARENAS[stages.length % ARENAS.length].id);
          draft.match.stageIds = stages;
        });
      root.querySelector<HTMLElement>("[data-stage-remove]")!.onclick = () =>
        commit(() => {
          if ((draft.match.stageIds?.length || 0) > 1)
            draft.match.stageIds!.pop();
        });
    }
    root.querySelectorAll<HTMLElement>("[data-object]").forEach((el) => {
      el.onclick = () => {
        selected = el.dataset.object!;
        tab = "maps";
        render();
      };
      el.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selected = el.dataset.object!;
          tab = "maps";
          render();
        }
      };
    });
    root
      .querySelectorAll<HTMLInputElement>("[data-object-field],[data-path]")
      .forEach(
        (el) =>
          (el.onchange = () =>
            commit(() => {
              const o = current()!.value as unknown as Record<string, unknown>;
              if (el.dataset.path)
                (o.to as Record<string, number>)[el.dataset.path] = Number(
                  el.value,
                );
              else o[el.dataset.objectField!] = Number(el.value);
            })),
      );
    root
      .querySelector<HTMLSelectElement>("[data-target]")
      ?.addEventListener("change", (e) =>
        commit(() => {
          (current()!.value as { target: string }).target = (
            e.target as HTMLSelectElement
          ).value;
        }),
      );
    root.querySelector<HTMLSelectElement>("#ads-template")!.onchange = (e) =>
      commit(() => {
        draft = newDraft((e.target as HTMLSelectElement).value);
        selected = "";
      });
    root.querySelector<HTMLSelectElement>("#ads-biome")!.onchange = (e) =>
      commit(() => {
        draft.biome = (e.target as HTMLSelectElement)
          .value as keyof typeof BIOMES;
        Object.assign(draft.arena, BIOMES[draft.biome]);
        draft.arena.name = draft.label;
      });
    root.querySelector<HTMLInputElement>("#ads-label")!.onchange = (e) =>
      commit(() => {
        draft.label = (e.target as HTMLInputElement).value;
        draft.arena.name = draft.label;
      });
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-rule]")
      .forEach(
        (el) =>
          (el.onchange = () =>
            commit(() => {
              const key = el.dataset.rule!;
              (draft.match as unknown as Record<string, unknown>)[key] =
                el instanceof HTMLInputElement && el.type === "checkbox"
                  ? el.checked
                  : ["seed", "wins"].includes(key)
                    ? Number(el.value)
                    : el.value;
            })),
      );
    root.querySelectorAll<HTMLInputElement>("[data-power]").forEach(
      (el) =>
        (el.onchange = () =>
          commit(() => {
            draft.match.enabledUpgrades = Array.from(
              root.querySelectorAll<HTMLInputElement>("[data-power]:checked"),
            ).map(
              (v) =>
                v.dataset.power as NonNullable<
                  MatchConfig["enabledUpgrades"]
                >[number],
            );
          })),
    );
    root
      .querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-seat]")
      .forEach(
        (el) =>
          (el.onchange = () =>
            commit(() => {
              const s = draft.seats[Number(el.dataset.seat)],
                f = el.dataset.field!;
              if (f === "control") {
                s.control = el.value as Control;
                s.bot = s.control === "bot" ? "normal" : null;
              } else if (f === "team") s.team = Number(el.value);
              else (s as unknown as Record<string, unknown>)[f] = el.value;
            })),
      );
    root.querySelectorAll<HTMLElement>("[data-remove-seat]").forEach(
      (el) =>
        (el.onclick = () =>
          commit(() => {
            draft.seats.splice(Number(el.dataset.removeSeat), 1);
          })),
    );
    root.querySelectorAll<HTMLElement>("[data-add]").forEach(
      (el) =>
        (el.onclick = () =>
          commit(() => {
            const kind = el.dataset.add!,
              id = `${kind}-${Date.now().toString(36)}`,
              base = { id, x: 0, y: 0, w: 1.5, h: 1.5 };
            if (kind === "stone")
              draft.arena.obstacles.push({ ...base, height: 1, kind: "stone" });
            else if (kind === "platform")
              (draft.arena.platforms ||= []).push({
                ...base,
                to: { x: 0, y: 3 },
                period: 360,
                offset: 0,
              });
            else if (kind === "switch") {
              const target = draft.arena.hazards.find(
                (h) => h.kind === "shutter",
              );
              if (!target) throw Error("Add a shutter before its switch.");
              (draft.arena.switches ||= []).push({
                ...base,
                target: target.id,
                duration: 240,
              });
            } else
              draft.arena.hazards.push({
                ...base,
                kind: kind as "gap" | "vent" | "shutter",
                angle: 0,
                period: kind === "gap" ? 1 : 300,
                active: kind === "gap" ? 1 : 90,
                offset: 0,
              });
            selected = id;
          })),
    );
    root.querySelectorAll<HTMLElement>("[data-do]").forEach(
      (el) =>
        (el.onclick = async () => {
          try {
            const action = el.dataset.do;
            if (action === "close") {
              active=false;disposeAssets?.();disposeAssets=null;
              onClose();
              return;
            }
            if (action === "undo" && history.canUndo) {
              draft = history.undo();
              status = "Restored the previous validated draft.";
              save();
            }
            if (action === "redo" && history.canRedo) {
              draft = history.redo();
              status = "Restored the next validated draft.";
              save();
            }
            if (action === "delete") {
              commit(() => {
                const item = current()!;
                (draft.arena[item.field] as { id: string }[]) = draft.arena[
                  item.field
                ]!.filter((o) => o.id !== selected);
                selected = "";
              });
            }
            if (action === "add-seat")
              commit(() => {
                const i = draft.seats.length,
                  c = CHARACTERS[i];
                draft.seats.push({
                  id: `studio-${i}-${Date.now()}`,
                  name: `Bot ${i}`,
                  character: c.id,
                  color: c.color,
                  team: i % 2,
                  bot: "normal",
                  control: "bot",
                });
              });
            if (action === "audit") {
              parseDraft(draft);
              status =
                "Audit passed: bounded geometry, safe spawns, linked switches, legal crew and rules. Playtest to judge routes and fairness.";
            }
            if (action === "play") {
              const safe = parseDraft(draft);
              save();
              active=false;disposeAssets?.();disposeAssets=null;
              onPlay({ ...safe.match, arenaDraft: safe.arena }, safe.seats);
              return;
            }
            if (action === "import") {
              const parsed = parseDraft(
                JSON.parse(
                  root.querySelector<HTMLTextAreaElement>("#ads-json")!.value,
                ),
              );
              commit(() => { draft = parsed; selected = ""; });
              status = "Imported and validated a detached draft.";
            }
            if (action === "export") {
              parseDraft(draft);
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(draft, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "boomerangavoid-arena.json";
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            if (action === "brief") {
              void navigator.clipboard
                .writeText(agentBrief(parseDraft(draft)))
                .then(
                  () => {
                    status = "Agent brief copied.";
                    render();
                  },
                  () => {
                    status =
                      "Clipboard unavailable. Export JSON and use the documented brief.";
                    render();
                  },
                );
            }
            if (action === "report") {
              const snapshotDraft=copy(draft),note=root.querySelector<HTMLTextAreaElement>("#ads-note")!.value,object=selected;
              const snapshot=await captureMap(map);
              if(!active)return;
              let records = readReports(null);
              try {records=readReports(JSON.parse(localStorage.getItem("bav.ads.reports")||"[]"));}catch{}
              records.push(makeReport(snapshotDraft,note,object,snapshot));
              localStorage.setItem(
                "bav.ads.reports",
                JSON.stringify(records.slice(-20)),
              );
              status = "Captured a reproducible note, measured map and full draft.";
            }
            render();
          } catch (e) {
            status = (e as Error).message;
            render();
          }
        }),
    );
  }
  render();
}
