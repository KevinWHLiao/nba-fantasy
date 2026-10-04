"use strict";

const PX = (() => {
  const KEY = "dream-court-predict-2027";
  const NEED = 10;
  const HOME_SPOTS = [
    { x: 214, y: 280 },
    { x: 268, y: 112 },
    { x: 268, y: 448 },
    { x: 372, y: 196 },
    { x: 372, y: 364 }
  ];
  const AWAY_SPOTS = HOME_SPOTS.map((spot) => ({ x: 1000 - spot.x, y: spot.y }));
  const HOOP = { home: { x: 78, y: 280 }, away: { x: 922, y: 280 } };

  const BY = Object.fromEntries(DC.players.map((player) => [player.id, player]));
  let state = null;

  function round1(n) { return Math.round(n * 10) / 10; }
  function seasonResults() {
    return typeof SEASON_RESULTS === "undefined" ? null : SEASON_RESULTS;
  }
  function resultsReady() {
    const src = seasonResults();
    return !!(src && src.byName && Object.keys(src.byName).length);
  }
  function resultsLabel() {
    if (!resultsReady()) return "";
    return seasonResults().label || "2026-27 真實數據";
  }
  function actualOf(player) {
    if (!resultsReady()) return null;
    const row = seasonResults().byName[player.name];
    if (!row || !Number.isFinite(Number(row.fppg))) return null;
    return { fppg: Number(row.fppg) };
  }
  function baseline() {
    return DC.players.slice().sort((a, b) => b.fppg - a.fppg || a.id - b.id);
  }
  function rankMap(official) {
    const rows = DC.players.map((player) => {
      if (!official) return { id: player.id, fppg: player.fppg, known: true };
      const live = actualOf(player);
      return { id: player.id, fppg: live ? live.fppg : -1, known: !!live };
    });
    rows.sort((a, b) => b.fppg - a.fppg || a.id - b.id);
    const map = {};
    rows.forEach((row, index) => { map[row.id] = row.known ? index + 1 : null; });
    return map;
  }
  function pointsFor(predicted, actual) {
    if (actual == null) return 0;
    if (actual <= 10) return 80 - 6 * Math.abs(predicted - actual);
    if (actual <= 20) return 24 - (actual - 10);
    if (actual <= 40) return 8;
    return 0;
  }
  function production(id, official) {
    const player = BY[id];
    if (!player) return 0;
    if (!official) return player.fppg;
    const live = actualOf(player);
    return live ? live.fppg : 0;
  }
  function scoreList(picks, official) {
    const ranks = rankMap(!!official);
    let accuracy = 0;
    let power = 0;
    let hits = 0;
    const rows = picks.map((id, index) => {
      const predicted = index + 1;
      const actual = ranks[id];
      const got = pointsFor(predicted, actual);
      const fppg = production(id, official);
      accuracy += got;
      power += fppg;
      if (actual != null && actual <= 10) hits += 1;
      return { id, predicted, actual, got, fppg: round1(fppg) };
    });
    return { accuracy, power: round1(power), hits, rows, official: !!official, complete: picks.length === NEED };
  }
  function encode(ids) {
    if (!ids || ids.length !== NEED) return "";
    return `K7-${ids.map((id) => Number(id).toString(36)).join(".")}`;
  }
  function decode(code) {
    let text = String(code || "").trim().replace(/\s+/g, "");
    if (/^k7-/i.test(text)) text = text.slice(3);
    const parts = text.split(".");
    if (parts.length !== NEED) return null;
    const ids = [];
    for (const part of parts) {
      if (!/^[0-9a-z]+$/i.test(part)) return null;
      const id = parseInt(part, 36);
      if (!BY[id] || ids.includes(id)) return null;
      ids.push(id);
    }
    return ids;
  }
  function normalize(code) {
    const picks = decode(code);
    return picks ? encode(picks) : "";
  }
  function frozen() { return !!(state && (state.locked || resultsReady())); }
  function save() {
    if (!state) return;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const next = JSON.parse(raw);
      if (!next || next.v !== 1 || !Array.isArray(next.picks)) return false;
      next.picks = next.picks.map(Number).filter((id, index, list) => BY[id] && list.indexOf(id) === index).slice(0, NEED);
      next.friends = Array.isArray(next.friends) ? next.friends.filter((friend) => decode(friend.code)) : [];
      state = next;
      return true;
    } catch (err) {
      return false;
    }
  }
  function cleanName(name, fallback) {
    const text = String(name || "").replace(/[*~#&?=]/g, "").trim().slice(0, 16);
    return text || fallback;
  }
  function adopt(name, code) {
    if (resultsReady()) return false;
    const picks = decode(code);
    if (!picks) return false;
    state = {
      v: 1,
      name: cleanName(name, "我"),
      color: "#7c5cff",
      picks: picks.slice(),
      locked: false,
      friends: []
    };
    save();
    return true;
  }
  function create(name, color) {
    if (resultsReady()) return false;
    state = {
      v: 1,
      name: cleanName(name, "我"),
      color: color || "#7c5cff",
      picks: [],
      locked: false,
      friends: []
    };
    save();
    return true;
  }
  function reset() {
    localStorage.removeItem(KEY);
    state = null;
  }
  function add(id) {
    id = Number(id);
    if (!state || frozen() || !BY[id] || state.picks.includes(id) || state.picks.length >= NEED) return false;
    state.picks.push(id);
    save();
    return true;
  }
  function remove(id) {
    if (!state || frozen()) return false;
    const next = state.picks.filter((pick) => pick !== Number(id));
    if (next.length === state.picks.length) return false;
    state.picks = next;
    save();
    return true;
  }
  function move(id, dir) {
    if (!state || frozen()) return false;
    const index = state.picks.indexOf(Number(id));
    const target = index + dir;
    if (index < 0 || target < 0 || target >= state.picks.length) return false;
    const [item] = state.picks.splice(index, 1);
    state.picks.splice(target, 0, item);
    save();
    return true;
  }
  function lock() {
    if (!state || state.picks.length !== NEED) return false;
    state.locked = true;
    save();
    return true;
  }
  function unlock() {
    if (!state || resultsReady()) return false;
    state.locked = false;
    save();
    return true;
  }
  function addFriend(name, code) {
    if (resultsReady()) return { ok: false, message: "已經用真實數據結算，不能再加入新的預測。" };
    if (!state) return { ok: false, message: "先建立你的預測。" };
    const picks = decode(code);
    if (!picks) return { ok: false, message: "這組分享碼對不上，請朋友重新複製一次。" };
    const canonical = encode(picks);
    if (canonical && canonical === encode(state.picks)) return { ok: false, message: "這是你自己的名單。" };
    const clean = cleanName(name, "朋友");
    const entry = { name: clean, picks, code: canonical };
    const index = state.friends.findIndex((friend) => friend.code === canonical);
    if (index >= 0) state.friends[index] = entry;
    else state.friends.push(entry);
    save();
    return { ok: true, message: index >= 0 ? `已更新 ${clean} 的預測。` : `已把 ${clean} 加進排行榜。` };
  }
  function removeFriend(code) {
    if (!state) return;
    state.friends = state.friends.filter((friend) => friend.code !== code);
    save();
  }
  function parseLeague(text) {
    return String(text || "").split("~").map((part) => {
      const star = part.lastIndexOf("*");
      if (star <= 0) return null;
      let name = part.slice(0, star);
      try { name = decodeURIComponent(name); } catch (err) { /* keep raw */ }
      const code = normalize(part.slice(star + 1));
      if (!code) return null;
      return { name: cleanName(name, "朋友"), code };
    }).filter(Boolean);
  }
  function exportLeague() {
    if (!state || !encode(state.picks)) return "";
    const rows = [{ name: state.name, code: encode(state.picks) }].concat(state.friends);
    return rows.map((row) => `${encodeURIComponent(row.name)}*${row.code}`).join("~");
  }
  function readShare(text) {
    const raw = String(text || "").trim();
    if (!raw) return {};
    try {
      if (/^https?:/i.test(raw)) {
        const url = new URL(raw);
        if (url.searchParams.get("league")) return { league: url.searchParams.get("league") };
        if (url.searchParams.get("c")) return { code: url.searchParams.get("c"), name: url.searchParams.get("n") || "" };
      }
    } catch (err) { /* not a url */ }
    if (raw.includes("~") && raw.includes("*")) return { league: raw };
    return { code: raw };
  }
  function leaderboard() {
    const official = resultsReady();
    const rows = [];
    if (state) {
      rows.push({
        name: state.name,
        self: true,
        picks: state.picks.slice(),
        code: encode(state.picks),
        score: scoreList(state.picks, official),
        locked: state.locked || official
      });
      state.friends.forEach((friend) => {
        rows.push({
          name: friend.name,
          self: false,
          picks: friend.picks.slice(),
          code: friend.code,
          score: scoreList(friend.picks, official),
          locked: true
        });
      });
    }
    rows.sort((a, b) => {
      const done = (row) => (row.score.complete ? 1 : 0);
      return done(b) - done(a) || b.score.accuracy - a.score.accuracy || b.score.power - a.score.power || a.name.localeCompare(b.name, "zh-Hant");
    });
    return { official, label: resultsLabel(), rows };
  }
  function contrastIds(homeIds) {
    const used = new Set(homeIds);
    const ids = [];
    baseline().forEach((player) => {
      if (ids.length >= 5 || used.has(player.id)) return;
      ids.push(player.id);
    });
    return ids;
  }
  function lastName(name) {
    const parts = String(name).trim().split(/\s+/);
    return parts[parts.length - 1] || name;
  }
  function initials(name) {
    const parts = String(name).trim().split(/[\s-]+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return String(name).slice(0, 2).toUpperCase();
  }
  function ink(hex) {
    const raw = String(hex || "#888").replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((ch) => ch + ch).join("") : raw;
    const value = parseInt(full, 16);
    if (!Number.isFinite(value)) return "#fff";
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 186 ? "#1a1203" : "#fff";
  }
  function pickIndex(players, weight) {
    const weights = players.map((player) => Math.max(0.25, weight(player)));
    let roll = Math.random() * weights.reduce((sum, item) => sum + item, 0);
    for (let i = 0; i < players.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) return i;
    }
    return players.length - 1;
  }
  function onePlay(offense, defense, side) {
    const actor = pickIndex(offense, (player) => player.pts);
    const stopper = pickIndex(defense, (player) => player.stl + player.blk);
    const shooter = offense[actor];
    const guard = defense[stopper];
    const shooterName = lastName(shooter.name);
    const guardName = lastName(guard.name);
    const spots = side === "home" ? HOME_SPOTS : AWAY_SPOTS;
    const attack = side === "home" ? HOOP.away : HOOP.home;
    let points = 0;
    let made = false;
    let text = "";
    let ball = { x: attack.x, y: attack.y, arc: 86 };
    const live = side === "home" ? "home" : "away";
    if (Math.random() < 0.1 + shooter.tov * 0.015) {
      text = `${guardName} 抄到 ${shooterName} 的球，攻守交換。`;
      ball = { x: (side === "home" ? AWAY_SPOTS : HOME_SPOTS)[stopper].x, y: (side === "home" ? AWAY_SPOTS : HOME_SPOTS)[stopper].y, arc: 24 };
    } else {
      const three = Math.random() < Math.max(0.16, Math.min(0.52, shooter.tpm * 0.08));
      const odds = three ? shooter.tpp : shooter.fgp;
      made = Math.random() < Math.max(0.34, Math.min(0.68, odds));
      if (!made && Math.random() < guard.blk * 0.09) {
        text = `${guardName} 在籃框前封阻 ${shooterName}。`;
        made = false;
      } else if (made && three) {
        points = 3;
        text = `${shooterName} 運到三分線外，出手有。`;
      } else if (made) {
        points = 2;
        text = shooter.pos === "C" || shooter.pos === "PF"
          ? `${shooterName} 低位轉身，打板打進。`
          : `${shooterName} 切入禁區，上籃得手。`;
      } else if (three) {
        text = `${shooterName} 三分線外出手，彈框彈出。`;
      } else {
        text = `${shooterName} 中距離偏出。`;
      }
    }
    return { text, side: live, actor, points, made, from: spots[actor], ball };
  }
  function exhibition(homeIds, awayIds) {
    const home = homeIds.map((id) => BY[id]).filter(Boolean);
    const away = awayIds.map((id) => BY[id]).filter(Boolean);
    const plays = [];
    let homeScore = 0;
    let awayScore = 0;
    let side = "home";
    for (let n = 0; n < 16 && home.length && away.length; n += 1) {
      const play = onePlay(side === "home" ? home : away, side === "home" ? away : home, side);
      if (side === "home") homeScore += play.points;
      else awayScore += play.points;
      play.homeScore = homeScore;
      play.awayScore = awayScore;
      plays.push(play);
      side = side === "home" ? "away" : "home";
    }
    plays.push({
      text: "預告片到此。這段是用上季數據編成的開球畫面，不是 2026-27 的正式結果。",
      side: "home",
      actor: 0,
      points: 0,
      made: false,
      from: { x: 500, y: 280 },
      ball: { x: 500, y: 280, arc: 0 },
      homeScore,
      awayScore,
      end: true
    });
    return { plays, homeScore, awayScore };
  }

  return {
    get state() { return state; },
    NEED, HOME_SPOTS, AWAY_SPOTS, HOOP,
    load, create, adopt, reset, save, add, remove, move, lock, unlock, frozen,
    addFriend, removeFriend, encode, decode, normalize, parseLeague, exportLeague, readShare,
    scoreList, leaderboard, baseline, contrastIds, resultsReady, resultsLabel,
    exhibition, initials, lastName, ink, BY
  };
})();
