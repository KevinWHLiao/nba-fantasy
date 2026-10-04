"use strict";

const DC = (() => {
  const KEY = "dream-court-2026";
  const TEAM_META = LEAGUE_DATA.teams;
  const PLAYERS = LEAGUE_DATA.players;
  const BY_ID = Object.fromEntries(PLAYERS.map((p) => [p.id, p]));
  const SLOTS = [
    ["PG", "控衛"], ["SG", "分衛"], ["SF", "小前"], ["PF", "大前"], ["C", "中鋒"],
    ["G", "後衛"], ["F", "前鋒"], ["U1", "任意"], ["U2", "任意"]
  ];
  const SLOT_KEYS = SLOTS.map((s) => s[0]);
  const AI_TEAMS = [
    { name: "數據怪咖", strategy: "value", color: "#3d8bfd" },
    { name: "全明星收藏家", strategy: "stars", color: "#f5c518" },
    { name: "青春風暴", strategy: "youth", color: "#3dd68c" },
    { name: "鐵血防守", strategy: "stocks", color: "#c84bff" },
    { name: "三分雨", strategy: "threes", color: "#ff7a18" },
    { name: "禁區霸主", strategy: "bigs", color: "#ff5d73" },
    { name: "控球藝術", strategy: "guards", color: "#49d6ff" },
    { name: "穩健投資", strategy: "safe", color: "#9aa6c3" },
    { name: "搖擺專家", strategy: "balance", color: "#e8b931" }
  ];

  let state = null;

  function round1(n) { return Math.round((n + Number.EPSILON) * 10) / 10; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function randn() {
    let u = 1 - Math.random();
    let v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function emptyLineup() {
    return { PG: null, SG: null, SF: null, PF: null, C: null, G: null, F: null, U1: null, U2: null };
  }
  function emptySeason() {
    return { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, tpm: 0, fp: 0 };
  }
  function me() { return state.teams[0]; }
  function teamById(id) { return state.teams.find((t) => t.id === id); }
  function ov(id) { return state.ov[id]; }
  function P(id) { return Object.assign({}, BY_ID[id], state.ov[id]); }

  function news(text, kind) {
    state.news.unshift({ week: state.week, text, kind: kind || "info" });
    state.news = state.news.slice(0, 80);
  }
  function log(text) {
    state.log.unshift({ week: state.week, text });
    state.log = state.log.slice(0, 80);
  }

  function canPlay(p, slot) {
    if (!p) return false;
    if (slot === "U1" || slot === "U2") return true;
    if (slot === "G") return p.elig.includes("PG") || p.elig.includes("SG");
    if (slot === "F") return p.elig.includes("SF") || p.elig.includes("PF");
    return p.elig.includes(slot);
  }

  function scheduled(team, week) {
    if (!state || !state.nba[team]) return 0;
    return state.nba[team][week - 1] || 0;
  }

  function project(p, week) {
    if (!p || p.status === "OUT" || p.inj > 0) return 0;
    const games = scheduled(p.team, week);
    let g = games;
    if (p.status === "DTD") g *= 0.62;
    if (p.age >= 36 && games >= 4) g -= 0.18;
    const hot = 1 + (p.hot || 0) * 0.04;
    const fatigue = games >= 4 ? 0.97 : 1;
    return Math.max(0, p.fppg * g * hot * fatigue);
  }

  function ros(id) {
    const base = BY_ID[id];
    const extra = ov(id);
    let m = 1;
    if (extra.status === "OUT" || extra.inj > 0) m = extra.inj >= 3 ? 0.55 : 0.72;
    else if (extra.status === "DTD") m = 0.88;
    m *= 1 + (extra.hot || 0) * 0.035;
    return base.fppg * m;
  }

  function priceOf(id) {
    const base = BY_ID[id];
    const extra = ov(id);
    let mult = 1;
    if (extra.status === "OUT" || extra.inj > 0) mult = extra.inj >= 3 ? 0.5 : 0.7;
    else if (extra.status === "DTD") mult = 0.86;
    return clamp(Math.round((base.fppg * mult - 27) * 1.1), 0, 34);
  }

  function buildNba() {
    const pattern = [4, 3, 4, 3, 3, 4, 4, 3, 4, 3, 4, 3, 4, 3, 4];
    const nba = {};
    Object.keys(TEAM_META).forEach((code, i) => {
      const weeks = [];
      for (let w = 0; w < 15; w++) weeks.push(pattern[(w + i) % 15]);
      weeks.push(4, 4, 4);
      nba[code] = weeks;
    });
    return nba;
  }

  function roundRobin(ids) {
    const n = ids.length;
    const arr = ids.slice();
    const weeks = [];
    for (let r = 0; r < n - 1; r++) {
      const pairs = [];
      for (let i = 0; i < n / 2; i++) pairs.push([arr[i], arr[n - 1 - i]]);
      weeks.push(pairs);
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      arr.splice(0, arr.length, arr[0], ...rest);
    }
    const extra = weeks.slice(0, 6).map((pairs) => pairs.map(([a, b]) => [b, a]));
    return weeks.concat(extra);
  }

  function assertSchedule(sched) {
    if (sched.length !== 15) throw new Error("schedule weeks");
    sched.forEach((week) => {
      const seen = new Set();
      week.forEach(([a, b]) => {
        if (a === b || seen.has(a) || seen.has(b)) throw new Error("bad pair");
        seen.add(a); seen.add(b);
      });
      if (seen.size !== 10) throw new Error("missing team");
    });
  }

  function freshOverlay() {
    const all = {};
    PLAYERS.forEach((p) => {
      all[p.id] = { own: null, status: "OK", inj: 0, hot: 0, recent: [], season: emptySeason() };
    });
    return all;
  }

  function openingInjuries() {
    let starHurts = 0;
    let total = 0;
    const order = PLAYERS.slice().sort((a, b) => b.risk - a.risk);
    order.forEach((base) => {
      if (total >= 12) return;
      if (base.id <= 10 && starHurts >= 1) return;
      const chance = base.risk * (base.id <= 10 ? 0.85 : 1.35);
      const roll = Math.random();
      if (roll >= chance) return;
      const extra = ov(base.id);
      if (roll < chance * 0.45) {
        extra.status = "OUT";
        extra.inj = Math.random() < 0.7 ? 1 : 2;
        news(`${base.name} 開季缺陣，預估 ${extra.inj} 週。`, "injury");
      } else {
        extra.status = "DTD";
        news(`${base.name} 開季出賽成疑。`, "injury");
      }
      total += 1;
      if (base.id <= 10) starHurts += 1;
    });
  }

  function newGame(name, slot, color) {
    name = String(name || "我的球隊").trim().slice(0, 16) || "我的球隊";
    slot = Number(slot);
    if (!(slot >= 1 && slot <= 10)) slot = 1 + Math.floor(Math.random() * 10);
    const colors = ["#7c5cff", "#e03a3e", "#007a33", "#fdb927", "#1d9bf0", "#ff7a18", "#3dd68c", "#f0c14b"];
    if (!colors.includes(color)) color = colors[0];
    const teams = [{
      id: 0, name, user: true, strategy: "value", color, faab: 100,
      roster: [], il: [], lineup: emptyLineup(), w: 0, l: 0, pf: 0, pa: 0, weeks: []
    }];
    AI_TEAMS.forEach((ai, i) => {
      teams.push({
        id: i + 1, name: ai.name, user: false, strategy: ai.strategy, color: ai.color, faab: 100,
        roster: [], il: [], lineup: emptyLineup(), w: 0, l: 0, pf: 0, pa: 0, weeks: []
      });
    });
    const order = [];
    let ai = 1;
    for (let s = 0; s < 10; s++) order.push(s === slot - 1 ? 0 : ai++);
    const sched = roundRobin(teams.map((t) => t.id));
    assertSchedule(sched);
    state = {
      v: 1, manager: name, color, tab: "draft", phase: "draft", week: 1,
      teams, order, overall: 0, picks: [], ov: freshOverlay(), nba: buildNba(), sched,
      playoff: null, news: [], log: [], results: {}, offer: null, watch: [],
      awards: null, grade: null, created: Date.now()
    };
    news("2026-27 夢幻賽季開幕。球員能力以 2025-26 正規賽場均為基礎。", "info");
    news("上季回顧：尼克奪冠，Shai Gilgeous-Alexander 拿下 MVP，Cooper Flagg 當選最佳新秀。", "info");
    openingInjuries();
    save();
    return state;
  }

  function onClock() {
    if (!state || state.phase !== "draft") return null;
    const round = Math.floor(state.overall / 10);
    const pos = state.overall % 10;
    const idx = round % 2 === 0 ? pos : 9 - pos;
    return state.order[idx];
  }

  function aiScore(base, extra, rosterBases, strategy, noise) {
    let s = base.fppg * (0.7 + 0.3 * Math.min(base.g, 80) / 80);
    if (extra.status === "OUT") s *= 0.7;
    else if (extra.status === "DTD") s *= 0.9;
    const counts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 };
    rosterBases.forEach((p) => { counts[p.pos] += 1; });
    if (counts[base.pos] === 0) s *= 1.14;
    else if (counts[base.pos] === 1) s *= 1.03;
    else if (counts[base.pos] === 2) s *= 0.9;
    else s *= 0.76;
    if (strategy === "stars") s = Math.pow(base.fppg, 1.12) * (counts[base.pos] >= 3 ? 0.8 : 1) * (extra.status === "OUT" ? 0.75 : 1);
    if (strategy === "youth") s *= base.age <= 23 ? 1.2 : base.age <= 26 ? 1.08 : base.age >= 32 ? 0.86 : 1;
    if (strategy === "stocks") s *= 1 + (base.stl + base.blk) * 0.14;
    if (strategy === "threes") s *= 1 + Math.min(base.tpm, 4) * 0.09;
    if (strategy === "bigs") s *= (base.pos === "C" || base.pos === "PF") ? 1.16 : 0.9;
    if (strategy === "guards") s *= (base.pos === "PG" || base.pos === "SG") ? 1.14 : 0.92;
    if (strategy === "safe") s *= 0.45 + 0.55 * (base.g / 82);
    if (noise) s *= 0.93 + Math.random() * 0.14;
    return s;
  }

  function bestPick(teamId, noise) {
    const team = teamById(teamId);
    const roster = team.roster.map((id) => BY_ID[id]);
    const strategy = team.user ? "value" : team.strategy;
    let best = null;
    let score = -1;
    PLAYERS.forEach((p) => {
      if (ov(p.id).own != null) return;
      const s = aiScore(p, ov(p.id), roster, strategy, noise);
      if (s > score) { score = s; best = p; }
    });
    return best ? best.id : null;
  }

  function recommendations() {
    const roster = me().roster.map((id) => BY_ID[id]);
    return PLAYERS
      .filter((p) => ov(p.id).own == null)
      .map((p) => ({ id: p.id, s: aiScore(p, ov(p.id), roster, "value", false) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 5)
      .map((x) => x.id);
  }

  function autoIL(team) {
    const outs = team.roster.map(P).filter((p) => p.status === "OUT").sort((a, b) => b.inj - a.inj);
    outs.slice(0, 2).forEach((p) => {
      team.roster = team.roster.filter((id) => id !== p.id);
      team.il.push(p.id);
    });
  }

  function gradeUser() {
    const rows = state.teams.map((t) => ({
      id: t.id,
      power: t.roster.reduce((sum, id) => sum + BY_ID[id].fppg * (ov(id).status === "OUT" ? 0.78 : 1), 0)
    })).sort((a, b) => b.power - a.power);
    const rank = rows.findIndex((r) => r.id === 0) + 1;
    const letters = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D"];
    return { rank, letter: letters[rank - 1] || "C" };
  }

  function finishDraft() {
    state.phase = "season";
    state.tab = "home";
    state.teams.forEach((team) => {
      autoIL(team);
      optimizeTeam(team.id, 1);
    });
    state.grade = gradeUser();
    news(`選秀結束。你的名單評等 ${state.grade.letter}，戰力排名第 ${state.grade.rank}。`, "draft");
    const parked = me().il.length;
    if (parked) news(`已把 ${parked} 名缺陣球員放進傷兵名單，名單空出的位子可以補人。`, "info");
  }

  function draftPlayer(teamId, playerId) {
    if (state.phase !== "draft") return { ok: false, message: "選秀已經結束。" };
    if (onClock() !== teamId) return { ok: false, message: "還沒輪到這支球隊。" };
    playerId = Number(playerId);
    if (!BY_ID[playerId] || ov(playerId).own != null) return { ok: false, message: "這名球員已被選走。" };
    const team = teamById(teamId);
    team.roster.push(playerId);
    ov(playerId).own = teamId;
    const round = Math.floor(state.overall / 10) + 1;
    state.picks.push({ overall: state.overall + 1, round, teamId, playerId });
    state.overall += 1;
    if (team.user) news(`第 ${round} 輪選進 ${BY_ID[playerId].name}。`, "draft");
    if (state.overall >= 130) finishDraft();
    save();
    return { ok: true };
  }

  function draft(playerId) {
    return draftPlayer(0, playerId);
  }

  function autoUntil() {
    let guard = 0;
    while (state.phase === "draft" && onClock() !== 0 && guard < 140) {
      draftPlayer(onClock(), bestPick(onClock(), true));
      guard += 1;
    }
    return { ok: true };
  }

  function autoRest() {
    let guard = 0;
    while (state.phase === "draft" && guard < 140) {
      const teamId = onClock();
      draftPlayer(teamId, bestPick(teamId, teamId !== 0));
      guard += 1;
    }
    return { ok: true };
  }

  function bestAssignment(team, week) {
    const cands = team.roster.map((id) => {
      const p = P(id);
      return { id, proj: project(p, week), p };
    }).filter((x) => x.p.status !== "OUT" && x.p.inj <= 0);
    const ranked = cands.slice().sort((a, b) => b.proj - a.proj);
    let best = emptyLineup();
    let bestScore = -1;
    const used = new Set();
    const assign = emptyLineup();
    function bound(left) {
      let s = 0;
      let n = 0;
      for (const row of ranked) {
        if (used.has(row.id)) continue;
        s += row.proj;
        n += 1;
        if (n === left) break;
      }
      return s;
    }
    function rec(i, score) {
      if (score + bound(SLOT_KEYS.length - i) <= bestScore + 1e-6) return;
      if (i === SLOT_KEYS.length) {
        if (score > bestScore) {
          bestScore = score;
          best = Object.assign(emptyLineup(), assign);
        }
        return;
      }
      const slot = SLOT_KEYS[i];
      const options = cands.filter((row) => !used.has(row.id) && canPlay(row.p, slot));
      options.sort((a, b) => b.proj - a.proj);
      if (!options.length) {
        assign[slot] = null;
        rec(i + 1, score);
        return;
      }
      options.forEach((row) => {
        used.add(row.id);
        assign[slot] = row.id;
        rec(i + 1, score + row.proj);
        used.delete(row.id);
        assign[slot] = null;
      });
    }
    rec(0, 0);
    return { assignment: best, score: Math.max(0, bestScore) };
  }

  function optimizeTeam(teamId, week) {
    const team = teamById(teamId);
    const { assignment } = bestAssignment(team, week || state.week);
    team.lineup = assignment;
    save();
    return assignment;
  }

  function lineupProblems(team) {
    const used = new Set();
    for (const slot of SLOT_KEYS) {
      const id = team.lineup[slot];
      if (!id) {
        const open = team.roster.some((pid) => {
          if (used.has(pid)) return false;
          const p = P(pid);
          return p.status !== "OUT" && p.inj <= 0 && canPlay(p, slot);
        });
        if (open) return true;
        continue;
      }
      if (used.has(id) || !team.roster.includes(id)) return true;
      used.add(id);
      const p = P(id);
      if (p.status === "OUT" || p.inj > 0 || !canPlay(p, slot)) return true;
    }
    return false;
  }

  function setLineup(slot, id) {
    if (!SLOT_KEYS.includes(slot)) return { ok: false };
    const team = me();
    id = id ? Number(id) : null;
    SLOT_KEYS.forEach((key) => { if (id && team.lineup[key] === id) team.lineup[key] = null; });
    if (id) {
      const p = P(id);
      if (!team.roster.includes(id) || !canPlay(p, slot) || p.status === "OUT" || p.inj > 0) {
        return { ok: false, message: "這個位置不能放這名球員。" };
      }
    }
    team.lineup[slot] = id;
    save();
    return { ok: true };
  }

  function insertPlayer(id) {
    id = Number(id);
    const team = me();
    const p = P(id);
    if (!team.roster.includes(id) || p.status === "OUT" || p.inj > 0) {
      return { ok: false, message: "缺陣球員不能先發，可先放進傷兵名單。" };
    }
    SLOT_KEYS.forEach((key) => { if (team.lineup[key] === id) team.lineup[key] = null; });
    const preferred = [p.pos];
    if (p.pos === "PG" || p.pos === "SG") preferred.push("G");
    if (p.pos === "SF" || p.pos === "PF") preferred.push("F");
    preferred.push("U1", "U2");
    for (const slot of preferred) {
      if (!team.lineup[slot] && canPlay(p, slot)) {
        team.lineup[slot] = id;
        save();
        return { ok: true };
      }
    }
    let worstSlot = null;
    let worstV = Infinity;
    SLOT_KEYS.forEach((slot) => {
      if (!canPlay(p, slot)) return;
      const cur = team.lineup[slot];
      const value = cur ? project(P(cur), state.week) : -1;
      if (value < worstV) { worstV = value; worstSlot = slot; }
    });
    if (worstSlot == null) return { ok: false, message: "沒有適合的先發位。" };
    team.lineup[worstSlot] = id;
    save();
    return { ok: true };
  }

  function moveIL(id) {
    id = Number(id);
    const team = me();
    const p = P(id);
    if (!team.roster.includes(id)) return { ok: false, message: "他不在可動名單裡。" };
    if (p.status === "OK" && p.inj <= 0) return { ok: false, message: "健康球員不能放進傷兵名單。" };
    if (team.il.length >= 2) return { ok: false, message: "傷兵名單已滿（2 人）。" };
    team.roster = team.roster.filter((x) => x !== id);
    team.il.push(id);
    SLOT_KEYS.forEach((key) => { if (team.lineup[key] === id) team.lineup[key] = null; });
    save();
    return { ok: true, message: `${p.name} 進入傷兵名單，你可以再補一名球員。` };
  }

  function activate(id) {
    id = Number(id);
    const team = me();
    if (!team.il.includes(id)) return { ok: false, message: "他不在傷兵名單。" };
    if (team.roster.length >= 13) return { ok: false, message: "名單已滿，請先釋出球員。" };
    team.il = team.il.filter((x) => x !== id);
    team.roster.push(id);
    save();
    return { ok: true, message: `${BY_ID[id].name} 已回到名單。` };
  }

  function release(team, id) {
    team.roster = team.roster.filter((x) => x !== id);
    team.il = team.il.filter((x) => x !== id);
    SLOT_KEYS.forEach((key) => { if (team.lineup[key] === id) team.lineup[key] = null; });
    ov(id).own = null;
  }

  function sign(team, id, pay) {
    if (ov(id).own != null) return false;
    if (team.roster.length >= 13) return false;
    if (team.faab < pay) return false;
    team.faab -= pay;
    team.roster.push(id);
    ov(id).own = team.id;
    return true;
  }

  function canSign() { return !!state && state.phase === "season"; }
  function canTrade() { return !!state && state.phase === "season" && state.week <= 12; }

  function drop(id) {
    id = Number(id);
    if (!canSign()) return { ok: false, message: "現在不能調整名單。" };
    if (!me().roster.includes(id) && !me().il.includes(id)) return { ok: false, message: "他不在你的名單。" };
    const name = BY_ID[id].name;
    release(me(), id);
    log(`你釋出 ${name}。`);
    save();
    return { ok: true, message: `已釋出 ${name}。` };
  }

  function signPlayer(id, dropId) {
    id = Number(id);
    if (!canSign()) return { ok: false, message: "現在不能補人。" };
    if (ov(id).own != null) return { ok: false, message: "他已經有球隊。" };
    const price = priceOf(id);
    const team = me();
    if (team.faab < price) return { ok: false, message: `簽約金要 $${price}，預算不夠。` };
    if (team.roster.length >= 13) {
      dropId = Number(dropId);
      if (!team.roster.includes(dropId)) return { ok: false, message: "名單已滿，請選擇一名球員釋出。" };
      release(team, dropId);
    }
    sign(team, id, price);
    log(`你以 $${price} 簽下 ${BY_ID[id].name}。`);
    save();
    return { ok: true, message: `簽下 ${BY_ID[id].name}，花費 $${price}。` };
  }

  function canFill(players) {
    const slots = ["PG", "SG", "SF", "PF", "C"];
    const used = new Set();
    for (const slot of slots) {
      const hit = players.find((p) => !used.has(p.id) && (p.pos === slot || p.elig.includes(slot)));
      if (!hit) return false;
      used.add(hit.id);
    }
    return true;
  }

  function tradeView(team, incoming, outgoing) {
    const have = team.roster.concat(team.il).map(P);
    const after = have.filter((p) => !outgoing.some((x) => x.id === p.id)).concat(incoming);
    function fit(group, p) {
      const count = group.filter((x) => x.pos === p.pos).length;
      let f = ros(p.id);
      if (count <= 1) f *= 1.08;
      if (count >= 4) f *= 0.82;
      return f;
    }
    const inV = incoming.reduce((s, p) => s + fit(after, p), 0);
    const outV = outgoing.reduce((s, p) => s + fit(have, p), 0);
    return { inV, outV, after };
  }

  function acceptThreshold(team, incoming) {
    let mult = 1.01;
    if (team.strategy === "stars") mult = 1.06;
    if (team.strategy === "safe") mult = 1.04;
    if (team.strategy === "youth") {
      const ageIn = incoming.reduce((s, p) => s + p.age, 0) / incoming.length;
      if (ageIn <= 25) mult = 0.98;
    }
    return mult;
  }

  function propose(toId, giveIds, getIds) {
    if (!canTrade()) return { ok: false, message: "交易窗口已在第 12 週後關閉。" };
    giveIds = (giveIds || []).map(Number);
    getIds = (getIds || []).map(Number);
    if (!giveIds.length || giveIds.length !== getIds.length || giveIds.length > 2) {
      return { ok: false, message: "請用 1 換 1，或 2 換 2。" };
    }
    const user = me();
    const ai = teamById(Number(toId));
    if (!ai || ai.user) return { ok: false, message: "請選擇一支電腦球隊。" };
    if (!giveIds.every((id) => user.roster.includes(id))) return { ok: false, message: "送出的球員必須在你的 13 人名單。" };
    if (!getIds.every((id) => ai.roster.includes(id))) return { ok: false, message: "你要的球員已經不在對方名單。" };
    const give = giveIds.map(P);
    const get = getIds.map(P);
    const userAfter = user.roster.map(P).filter((p) => !giveIds.includes(p.id)).concat(get);
    const aiView = tradeView(ai, give, get);
    if (!canFill(userAfter) || !canFill(aiView.after)) {
      return { ok: false, message: "交易後會缺掉一個先發位置，這筆不能成立。" };
    }
    const bestOut = Math.max(...ai.roster.map(ros));
    const givingBest = get.some((p) => ros(p.id) >= bestOut - 0.01);
    const gettingBetter = Math.max(...give.map((p) => ros(p.id))) > Math.max(...get.map((p) => ros(p.id)));
    let accept = aiView.inV >= aiView.outV * acceptThreshold(ai, give);
    if (givingBest && !gettingBetter) accept = aiView.inV >= aiView.outV * 1.12;
    const flavor = ai.strategy === "stars" ? "我只收真正能帶隊的人。" : ai.strategy === "youth" ? "我在看未來，也看現在。" : "我用期望積分算過了。";
    if (!accept) {
      const close = aiView.inV >= aiView.outV * 0.94;
      return { ok: true, accepted: false, message: close ? `${ai.name}：差一點。${flavor}` : `${ai.name}：這筆我不做。你要再拿出更好的球員。` };
    }
    giveIds.forEach((id) => movePlayer(id, ai));
    getIds.forEach((id) => movePlayer(id, user));
    optimizeTeam(ai.id, state.week);
    const namesOut = give.map((p) => p.name).join("、");
    const namesIn = get.map((p) => p.name).join("、");
    news(`交易成立：你用 ${namesOut} 向 ${ai.name} 換來 ${namesIn}。`, "trade");
    log(`你用 ${namesOut} 換到 ${namesIn}。`);
    state.offer = null;
    save();
    return { ok: true, accepted: true, message: `${ai.name}：成交。${flavor}` };
  }

  function movePlayer(id, toTeam) {
    const fromId = ov(id).own;
    if (fromId != null) {
      const from = teamById(fromId);
      from.roster = from.roster.filter((x) => x !== id);
      from.il = from.il.filter((x) => x !== id);
      SLOT_KEYS.forEach((key) => { if (from.lineup[key] === id) from.lineup[key] = null; });
    }
    toTeam.roster.push(id);
    ov(id).own = toTeam.id;
  }

  function maybeAiTrade() {
    if (!canTrade() || Math.random() > 0.62) return;
    const ais = state.teams.filter((t) => !t.user);
    for (let n = 0; n < 10; n++) {
      const A = ais[Math.floor(Math.random() * ais.length)];
      const B = ais[Math.floor(Math.random() * ais.length)];
      if (A.id === B.id) continue;
      const aPlayers = A.roster.map(P).sort((x, y) => ros(x.id) - ros(y.id)).slice(0, 7);
      const bPlayers = B.roster.map(P).sort((x, y) => ros(x.id) - ros(y.id)).slice(0, 7);
      for (const a of aPlayers) {
        for (const b of bPlayers) {
          const aView = tradeView(A, [b], [a]);
          const bView = tradeView(B, [a], [b]);
          if (aView.inV > aView.outV * 1.04 && bView.inV > bView.outV * 1.04 && canFill(aView.after) && canFill(bView.after)) {
            movePlayer(a.id, B);
            movePlayer(b.id, A);
            optimizeTeam(A.id, state.week);
            optimizeTeam(B.id, state.week);
            news(`${A.name} 用 ${a.name} 向 ${B.name} 換來 ${b.name}。`, "trade");
            return;
          }
        }
      }
    }
  }

  function maybeOffer() {
    if (state.offer || !canTrade() || Math.random() > 0.38) return;
    const user = me();
    const mine = user.roster.map(P).sort((a, b) => ros(b.id) - ros(a.id));
    const ais = state.teams.filter((t) => !t.user).sort(() => Math.random() - 0.5);
    for (const ai of ais) {
      const theirs = ai.roster.map(P).sort((a, b) => ros(b.id) - ros(a.id));
      for (const want of mine.slice(1, 8)) {
        for (const give of theirs.slice(1, 9)) {
          const aiView = tradeView(ai, [want], [give]);
          const userView = tradeView(user, [give], [want]);
          if (aiView.inV > aiView.outV * 1.02 && userView.inV > userView.outV * 0.92 && canFill(aiView.after) && canFill(userView.after)) {
            state.offer = {
              from: ai.id,
              week: state.week,
              youGive: [want.id],
              youGet: [give.id],
              note: `${ai.name} 想用 ${give.name} 換你的 ${want.name}。`
            };
            news(`${ai.name} 向你提出交易。`, "trade");
            return;
          }
        }
      }
    }
  }

  function offerValid() {
    if (!state.offer) return false;
    const offer = state.offer;
    const ai = teamById(offer.from);
    const ok = offer.youGive.every((id) => me().roster.includes(id)) && offer.youGet.every((id) => ai && ai.roster.includes(id));
    if (!ok) state.offer = null;
    return ok;
  }

  function acceptOffer() {
    if (!offerValid()) return { ok: false, message: "這筆報價已經失效。" };
    const offer = state.offer;
    return propose(offer.from, offer.youGive, offer.youGet);
  }

  function declineOffer() {
    if (state.offer) {
      news(`你拒絕了 ${teamById(state.offer.from).name} 的交易。`, "trade");
      state.offer = null;
      save();
    }
    return { ok: true, message: "已拒絕交易。" };
  }

  function droppable(team) {
    const players = team.roster.map(P);
    const options = players.filter((p) => {
      const others = players.filter((x) => x.id !== p.id);
      return ["PG", "SG", "SF", "PF", "C"].every((pos) => {
        if (p.pos !== pos && !p.elig.includes(pos)) return true;
        return others.some((o) => o.pos === pos || o.elig.includes(pos));
      });
    });
    options.sort((a, b) => ros(a.id) - ros(b.id));
    return options[0] || null;
  }

  function aiWaivers() {
    const ais = state.teams.filter((t) => !t.user).sort(() => Math.random() - 0.5);
    let moves = 0;
    ais.forEach((team) => {
      if (moves >= 4) return;
      const worst = droppable(team);
      if (!worst || team.roster.length < 13) return;
      let best = null;
      PLAYERS.forEach((base) => {
        if (ov(base.id).own != null) return;
        const price = priceOf(base.id);
        if (price > team.faab) return;
        if (base.fppg > 48 && price > team.faab * 0.55) return;
        const gain = ros(base.id) - ros(worst.id);
        if (gain < 3.2) return;
        if (!best || gain > best.gain) best = { id: base.id, price, gain, name: base.name };
      });
      if (!best) return;
      const dropped = worst.name;
      release(team, worst.id);
      sign(team, best.id, best.price);
      optimizeTeam(team.id, state.week);
      news(`${team.name} 釋出 ${dropped}，以 $${best.price} 簽下 ${best.name}。`, "wire");
      moves += 1;
    });
  }

  function settleIL(team) {
    const healthy = team.il.filter((id) => ov(id).status === "OK" && ov(id).inj <= 0);
    if (!healthy.length) return true;
    if (team.user && team.roster.length + healthy.length > 13) return false;
    healthy.forEach((id) => {
      if (team.roster.length >= 13) {
        const worst = droppable(team);
        if (worst) release(team, worst.id);
      }
      if (team.roster.length < 13) {
        team.il = team.il.filter((x) => x !== id);
        team.roster.push(id);
      }
    });
    return true;
  }

  function scoreBox(b) {
    let s = b.pts + b.reb * 1.2 + b.ast * 1.5 + b.stl * 3 + b.blk * 3 - b.tov + b.tpm * 0.5;
    const tens = [b.pts, b.reb, b.ast, b.stl, b.blk].filter((n) => n >= 10).length;
    if (tens >= 2) s += 2;
    if (tens >= 3) s += 3;
    return round1(s);
  }

  function simGame(base, mult) {
    const fgaMean = Math.max(0.2, base.fga * mult);
    const fga = Math.round(clamp(fgaMean + randn() * (Math.sqrt(fgaMean) * 0.72 + 0.35), 0, fgaMean * 1.85 + 3));
    const fg = Math.round(clamp(base.fgp * fga + randn() * Math.sqrt(fga * Math.max(base.fgp, 0.05) * (1 - Math.min(base.fgp, 0.9)) + 0.2), 0, fga));
    const tpa = Math.round(clamp(base.tpa * mult + randn() * (Math.sqrt(base.tpa * mult + 0.2) * 0.75 + 0.2), 0, fga));
    const tpPct = base.tpp || 0;
    const tpm = tpa ? Math.round(clamp(tpPct * tpa + randn() * Math.sqrt(tpa * Math.max(tpPct, 0.08) * (1 - Math.min(tpPct || 0.35, 0.9)) + 0.12), 0, Math.min(tpa, fg))) : 0;
    const ftaMean = Math.max(0, base.fta * mult);
    const fta = Math.round(clamp(ftaMean + randn() * (Math.sqrt(ftaMean + 0.2) * 0.7 + 0.25), 0, ftaMean * 2 + 2));
    const ftPct = base.ftp || 0.75;
    const ftm = fta ? Math.round(clamp(ftPct * fta + randn() * Math.sqrt(fta * ftPct * (1 - ftPct) + 0.1), 0, fta)) : 0;
    const scale = (mean) => Math.round(clamp(mean * mult + randn() * (Math.sqrt(mean * mult + 0.3) + 0.45), 0, mean * mult * 2.5 + 4));
    return {
      pts: (fg - tpm) * 2 + tpm * 3 + ftm,
      reb: scale(base.reb),
      ast: scale(base.ast),
      stl: Math.round(clamp(base.stl * mult + randn() * 0.72, 0, 6)),
      blk: Math.round(clamp(base.blk * mult + randn() * 0.68, 0, 8)),
      tov: Math.round(clamp(base.tov * mult + randn() * 0.7, 0, 10)),
      tpm, fg, fga, ftm, fta
    };
  }

  function emptyBox() {
    return { g: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, tpm: 0, fg: 0, fga: 0, ftm: 0, fta: 0, fp: 0 };
  }

  function simPlayerWeek(base, week) {
    const extra = ov(base.id);
    const tot = emptyBox();
    const games = scheduled(base.team, week);
    if (extra.status === "OUT" || extra.inj > 0) return tot;
    const hot = 1 + (extra.hot || 0) * 0.04;
    const fatigue = games >= 4 ? 0.96 : 1;
    for (let g = 0; g < games; g++) {
      if (extra.status === "DTD" && Math.random() > 0.62) continue;
      if (base.age >= 36 && games >= 4 && g === games - 1 && Math.random() < 0.2) continue;
      const mult = hot * fatigue * (0.9 + Math.random() * 0.22);
      const box = simGame(base, mult);
      tot.g += 1;
      ["pts", "reb", "ast", "stl", "blk", "tov", "tpm", "fg", "fga", "ftm", "fta"].forEach((key) => { tot[key] += box[key]; });
      tot.fp = round1(tot.fp + scoreBox(box));
    }
    return tot;
  }

  function updateForm(base, box, games) {
    const extra = ov(base.id);
    extra.recent.push(box.fp);
    if (extra.recent.length > 6) extra.recent.shift();
    if (!box.g) return;
    const expected = base.fppg * box.g;
    if (box.fp > expected * 1.22) extra.hot = Math.min(3, (extra.hot || 0) + 1);
    else if (box.fp < expected * 0.78) extra.hot = Math.max(-2, (extra.hot || 0) - 1);
    else if (extra.hot > 0) extra.hot -= 1;
    else if (extra.hot < 0) extra.hot += 1;
    if (games >= 4 && box.fp > expected * 1.35) news(`${base.name} 在 ${games} 場賽程週爆量，拿下 ${box.fp.toFixed(1)} 分。`, "hot");
  }

  function addSeason(id, box) {
    const season = ov(id).season;
    ["g", "pts", "reb", "ast", "stl", "blk", "tov", "tpm"].forEach((key) => { season[key] += box[key]; });
    season.fp = round1(season.fp + box.fp);
  }

  function scoreTeam(teamId, boxes) {
    const team = teamById(teamId);
    const lines = [];
    let total = 0;
    SLOT_KEYS.forEach((slot) => {
      const id = team.lineup[slot];
      const fp = id && boxes[id] ? boxes[id].fp : 0;
      total += fp;
      lines.push({ slot, id: id || null, fp: round1(fp) });
    });
    return { total: round1(total), lines };
  }

function decideWinner(aId, bId, sa, sb) {
  if (sa !== sb) return sa > sb ? aId : bId;
  const A = teamById(aId);
  const B = teamById(bId);
  if (A.pf !== B.pf) return A.pf > B.pf ? aId : bId;
  return aId < bId ? aId : bId;
}

function applyRecord(aId, bId, sa, sb, week) {
  const A = teamById(aId);
  const B = teamById(bId);
  const winner = decideWinner(aId, bId, sa, sb);
    const aw = winner === aId;
    if (aw) { A.w += 1; B.l += 1; } else { B.w += 1; A.l += 1; }
    A.pf = round1(A.pf + sa); A.pa = round1(A.pa + sb);
    B.pf = round1(B.pf + sb); B.pa = round1(B.pa + sa);
    A.weeks.push({ week, opp: bId, pf: sa, pa: sb, result: aw ? "W" : "L" });
    B.weeks.push({ week, opp: aId, pf: sb, pa: sa, result: aw ? "L" : "W" });
    return winner;
  }

  function writeUserResult(aId, bId, sa, sb, week, winner) {
    if (aId === 0 || bId === 0) {
      const mineIsA = aId === 0;
      const opp = teamById(mineIsA ? bId : aId);
      const win = winner === 0;
      news(`第 ${week} 週${win ? "擊敗" : "不敵"} ${opp.name}，${(mineIsA ? sa : sb).toFixed(1)} 對 ${(mineIsA ? sb : sa).toFixed(1)}。`, "result");
    }
  }

  function standings() {
    return state.teams.slice().sort((a, b) => b.w - a.w || b.pf - a.pf || a.pa - b.pa || a.id - b.id);
  }

  function seedIndex(id) { return state.playoff.seeds.indexOf(id); }

  function orderSeries(series) {
    if (series.a == null || series.b == null) return;
    if (seedIndex(series.b) < seedIndex(series.a)) {
      const tmp = series.a;
      series.a = series.b;
      series.b = tmp;
    }
  }

  function blankSeries(a, b) { return { a, b, sa: null, sb: null, winner: null }; }

  function createPlayoff() {
    const seeds = standings().map((t) => t.id);
    state.playoff = {
      seeds,
      qf: [blankSeries(seeds[2], seeds[5]), blankSeries(seeds[3], seeds[4])],
      sf: [blankSeries(seeds[0], null), blankSeries(seeds[1], null)],
      final: blankSeries(null, null),
      third: blankSeries(null, null),
      champ: null
    };
    const mine = seeds.indexOf(0);
    news(mine < 6 ? `季後賽開始，你是第 ${mine + 1} 種子。` : "常規賽結束，你未進季後賽。球員數據仍會繼續累積。", "award");
  }

  function playSeries(series, boxes, bucket) {
    orderSeries(series);
    const A = scoreTeam(series.a, boxes);
    const B = scoreTeam(series.b, boxes);
    const winner = A.total > B.total ? series.a : A.total < B.total ? series.b : series.a;
    series.sa = A.total;
    series.sb = B.total;
    series.winner = winner;
    bucket.push({ a: series.a, b: series.b, sa: A.total, sb: B.total, winner, la: A.lines, lb: B.lines });
    if (series.a === 0 || series.b === 0) {
      const win = winner === 0;
      const opp = teamById(series.a === 0 ? series.b : series.a);
      const mine = series.a === 0 ? A.total : B.total;
      const theirs = series.a === 0 ? B.total : A.total;
      news(`季後賽${win ? "過關" : "止步"}：對上 ${opp.name}，${mine.toFixed(1)} 對 ${theirs.toFixed(1)}。`, "result");
    }
  }

  function loserOf(series) { return series.winner === series.a ? series.b : series.a; }

  function advanceBracket(week) {
    const po = state.playoff;
    if (week === 16) {
      po.sf[0].b = po.qf[1].winner;
      po.sf[1].b = po.qf[0].winner;
      orderSeries(po.sf[0]);
      orderSeries(po.sf[1]);
      if (isBye(0, 16)) news("你本週輪空，直接晉級四強。", "result");
    }
    if (week === 17) {
      po.final = blankSeries(po.sf[0].winner, po.sf[1].winner);
      po.third = blankSeries(loserOf(po.sf[0]), loserOf(po.sf[1]));
      orderSeries(po.final);
      orderSeries(po.third);
    }
    if (week === 18) po.champ = po.final.winner;
  }

  function updateInjuries() {
    let spawned = 0;
    const list = PLAYERS.slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    list.forEach((base) => {
      const extra = ov(base.id);
      if (extra.inj > 0) {
        extra.inj -= 1;
        if (extra.inj <= 0) {
          extra.status = "DTD";
          extra.inj = 0;
          news(`${base.name} 接近復出，下一週列為出賽成疑。`, "injury");
        } else extra.status = "OUT";
        return;
      }
      if (extra.status === "DTD") {
        if (Math.random() < 0.72) {
          extra.status = "OK";
          news(`${base.name} 已恢復出賽。`, "injury");
        }
        return;
      }
      if (spawned >= 6) return;
      let chance = base.risk * 0.8;
      if (base.id <= 12) chance *= 0.5;
      if (Math.random() < chance) {
        extra.inj = Math.random() < 0.65 ? 1 : Math.random() < 0.75 ? 2 : 3;
        extra.status = "OUT";
        spawned += 1;
        news(`${base.name} 受傷，預估缺陣 ${extra.inj} 週。`, "injury");
      }
    });
  }

  function isBye(teamId, week) {
    if (week !== 16 || !state.playoff) return false;
    const seed = state.playoff.seeds.indexOf(teamId);
    return seed === 0 || seed === 1;
  }

  function competing(teamId, week) {
    if (week <= 15) return true;
    if (!state.playoff) return false;
    const rounds = week === 16 ? state.playoff.qf : week === 17 ? state.playoff.sf : [state.playoff.final, state.playoff.third];
    return rounds.some((series) => series && (series.a === teamId || series.b === teamId));
  }

  function expireOffer() {
    if (!state.offer) return;
    if (!canTrade() || state.offer.week == null || state.offer.week <= state.week) {
      const from = teamById(state.offer.from);
      news(`${from ? from.name : "對方"} 的交易提案已失效。`, "trade");
      state.offer = null;
    }
  }

  function simWeek() {
    if (!state || state.phase !== "season") return { ok: false, message: "現在沒有可模擬的週次。" };
    expireOffer();
    const week = state.week;
    if (me().il.some((id) => ov(id).status === "OK" && ov(id).inj <= 0) && me().roster.length >= 13) {
      return { ok: false, message: "傷兵名單有已康復的球員，請先騰出名額再模擬。" };
    }
    state.teams.forEach((team) => settleIL(team));
    const notes = [];
    state.teams.forEach((team) => {
      if (!competing(team.id, week)) return;
      if (team.user) {
        if (lineupProblems(team)) {
          optimizeTeam(team.id, week);
          notes.push("先發有空位或缺陣，已改成這一週的最佳陣容。");
        }
      } else optimizeTeam(team.id, week);
    });
    const boxes = {};
    PLAYERS.forEach((base) => {
      const box = simPlayerWeek(base, week);
      boxes[base.id] = box;
      addSeason(base.id, box);
      updateForm(base, box, scheduled(base.team, week));
    });
    const pairs = [];
    state.results[week] = { boxes, pairs };
    if (week <= 15) {
      state.sched[week - 1].forEach(([a, b]) => {
        const A = scoreTeam(a, boxes);
        const B = scoreTeam(b, boxes);
        const winner = applyRecord(a, b, A.total, B.total, week);
        pairs.push({ a, b, sa: A.total, sb: B.total, winner, la: A.lines, lb: B.lines });
        writeUserResult(a, b, A.total, B.total, week, winner);
      });
    } else {
      const rounds = week === 16 ? state.playoff.qf : week === 17 ? state.playoff.sf : [state.playoff.final, state.playoff.third];
      rounds.forEach((series) => { if (series && series.a != null && series.b != null) playSeries(series, boxes, pairs); });
      advanceBracket(week);
    }
    updateInjuries();
    if (week === 18) finishSeason();
    else {
      state.week = week + 1;
      if (state.week === 16) createPlayoff();
      aiWaivers();
      maybeAiTrade();
      maybeOffer();
    }
    save();
    const last = pairFor(week, 0);
    return { ok: true, week, notes, last };
  }

  function finishSeason() {
    const po = state.playoff;
    const champ = teamById(po.champ);
    const fpLeader = PLAYERS.slice().sort((a, b) => ov(b.id).season.fp - ov(a.id).season.fp)[0];
    const young = PLAYERS.filter((p) => p.age <= 22).sort((a, b) => ov(b.id).season.fp - ov(a.id).season.fp)[0];
    const by = (key) => PLAYERS.slice().sort((a, b) => ov(b.id).season[key] - ov(a.id).season[key])[0];
    const table = standings();
    state.awards = {
      champ: po.champ,
      champName: champ.name,
      userChamp: po.champ === 0,
      place: placeOf(0),
      mvp: fpLeader.id,
      young: young ? young.id : null,
      pts: by("pts").id,
      reb: by("reb").id,
      ast: by("ast").id,
      stl: by("stl").id,
      blk: by("blk").id,
      bestRecord: table[0].id,
      bestOffense: state.teams.slice().sort((a, b) => b.pf - a.pf)[0].id
    };
    state.phase = "done";
    state.tab = "home";
    news(`${champ.name} 奪下夢幻總冠軍。`, "award");
    news(`夢幻積分王是 ${fpLeader.name}。`, "award");
  }

  function placeOf(id) {
    const po = state.playoff;
    if (!po) return standings().findIndex((t) => t.id === id) + 1;
    if (po.champ === id) return 1;
    if (po.final && (po.final.a === id || po.final.b === id)) return 2;
    if (po.third && po.third.winner === id) return 3;
    if (po.third && (po.third.a === id || po.third.b === id)) return 4;
    const qfLosers = (po.qf || []).filter((s) => s.winner != null).map(loserOf);
    if (qfLosers.includes(id)) {
      const other = qfLosers.find((x) => x !== id);
      if (other == null) return 5;
      return seedIndex(id) < seedIndex(other) ? 5 : 6;
    }
    const seed = po.seeds.indexOf(id);
    return seed >= 0 ? seed + 1 : 10;
  }

  function pairFor(week, teamId) {
    const res = state.results[week];
    if (!res) return null;
    return res.pairs.find((p) => p.a === teamId || p.b === teamId) || null;
  }

  function opponentId(teamId, week) {
    if (!state || state.phase === "draft") return null;
    if (week <= 15 && state.sched[week - 1]) {
      const pair = state.sched[week - 1].find((p) => p[0] === teamId || p[1] === teamId);
      if (!pair) return null;
      return pair[0] === teamId ? pair[1] : pair[0];
    }
    if (!state.playoff || week > 18) return null;
    const rounds = week === 16 ? state.playoff.qf : week === 17 ? state.playoff.sf : [state.playoff.final, state.playoff.third];
    const series = rounds.find((s) => s && (s.a === teamId || s.b === teamId));
    if (!series) return null;
    return series.a === teamId ? series.b : series.a;
  }

  function lineupProj(team, week) {
    return round1(SLOT_KEYS.reduce((sum, slot) => {
      const id = team.lineup[slot];
      return sum + (id ? project(P(id), week) : 0);
    }, 0));
  }

  function preview() {
    if (!state || state.phase !== "season") return null;
    const week = state.week;
    const bye = isBye(0, week);
    const opp = opponentId(0, week);
    return {
      week, bye, opp,
      inPlay: competing(0, week) || bye,
      mine: lineupProj(me(), week),
      best: round1(bestAssignment(me(), week).score),
      theirs: opp == null ? null : round1(bestAssignment(teamById(opp), week).score)
    };
  }

  function power(team) {
    return team.roster.map(ros).sort((a, b) => b - a).slice(0, 9).reduce((s, n) => s + n, 0);
  }

  function gamesFor(id) {
    if (!state || state.phase !== "season") return null;
    return scheduled(BY_ID[id].team, state.week);
  }

  function toggleWatch(id) {
    id = Number(id);
    if (state.watch.includes(id)) state.watch = state.watch.filter((x) => x !== id);
    else state.watch.push(id);
    save();
  }

  function save() {
    if (!state) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const next = JSON.parse(raw);
      if (!next || next.v !== 1 || !Array.isArray(next.teams)) return false;
      state = next;
      return true;
    } catch (err) {
      return false;
    }
  }
  function reset() {
    localStorage.removeItem(KEY);
    state = null;
  }
  function exportState() { return JSON.stringify(state); }
  function importState(text) {
    const next = JSON.parse(text);
    if (!next || next.v !== 1 || !Array.isArray(next.teams)) throw new Error("bad save");
    state = next;
    save();
  }

  return {
    get state() { return state; },
    players: PLAYERS,
    teamMeta: TEAM_META,
    SLOTS, SLOT_KEYS,
    newGame, load, reset, save, exportState, importState,
    draft, autoUntil, autoRest, onClock, recommendations,
    setLineup, optimizeTeam, insertPlayer, moveIL, activate, drop, signPlayer,
    propose, acceptOffer, declineOffer, offerValid,
    simWeek, toggleWatch, project, priceOf, ros, gamesFor, standings, power,
    me, teamById, P, pairFor, opponentId, preview, isBye, competing, canTrade, canSign, placeOf, canPlay
  };
})();
