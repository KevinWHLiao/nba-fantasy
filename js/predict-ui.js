"use strict";

(function () {
const px = {
  q: "",
  sort: "fppg",
  pos: "ALL",
  tab: "board",
  opponent: "lastyear",
  open: "me",
  pending: []
};
const demo = { token: 0, timer: 0, running: false, final: null, log: [], game: null };
let baseRank = null;

function esc(value) { return DreamUI.esc(value); }
function lastRank(id) {
  if (!baseRank) {
    baseRank = {};
    PX.baseline().forEach((player, index) => { baseRank[player.id] = index + 1; });
  }
  return baseRank[id];
}
function stop() {
  demo.token += 1;
  demo.running = false;
  if (demo.timer) clearTimeout(demo.timer);
  demo.timer = 0;
}
function cleanUrl() {
  const url = new URL(location.href);
  url.searchParams.delete("league");
  url.searchParams.delete("c");
  url.searchParams.delete("n");
  const next = url.pathname + url.search + url.hash;
  history.replaceState({}, "", next);
}
function bootIncoming() {
  const query = new URLSearchParams(location.search);
  if (query.get("league")) px.pending = PX.parseLeague(query.get("league"));
  else if (query.get("c") && PX.normalize(query.get("c"))) {
    px.pending = [{ name: (query.get("n") || "朋友").slice(0, 16), code: PX.normalize(query.get("c")) }];
  }
}
function takePending() {
  if (!PX.state || !px.pending.length) return 0;
  let count = 0;
  px.pending.forEach((entry) => {
    if (PX.addFriend(entry.name, entry.code).ok) count += 1;
  });
  px.pending = [];
  cleanUrl();
  return count;
}
function linkFor(params) {
  const url = new URL(location.href);
  url.search = "";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}
function copyText(text, ok) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => DreamUI.notify(ok)).catch(() => DreamUI.notify("沒辦法自動複製，請手動選取文字。"));
    return;
  }
  DreamUI.notify("沒辦法自動複製，請手動選取文字。");
}
function teamRail() {
  return `<div class="team-rail" aria-hidden="true">${Object.entries(DC.teamMeta).map(([, team]) => `<i style="background:${team.color}"></i>`).join("")}</div>`;
}
function pendingBanner() {
  if (!px.pending.length) return "";
  const names = px.pending.map((entry) => esc(entry.name)).join("、");
  if (!PX.state) {
    return `<div class="panel notice"><b>朋友傳來 ${px.pending.length} 份預測</b><p>${names}</p><p class="muted">填好你的名字並開始之後，這些預測會一起放進排行榜。</p></div>`;
  }
  return `<div class="panel notice"><b>這份連結有 ${px.pending.length} 份預測</b><p>${names}</p><button class="btn primary" type="button" data-px="import-pending">加進我的排行榜</button></div>`;
}
function statusLine() {
  if (PX.resultsReady()) {
    const when = typeof SEASON_RESULTS !== "undefined" && SEASON_RESULTS && SEASON_RESULTS.asOf ? `，截止 ${esc(SEASON_RESULTS.asOf)}` : "";
    return `<p class="led-note">正式排名使用${esc(PX.resultsLabel())}${when}。預測已封存，不能再改。</p>`;
  }
  return `<p class="led-note">2026-27 還沒有可結算的真實數據。下面的分數是用 2025-26 名次試算，方便先看榜怎麼排。賽季數據放進來之後，同一份預測會自動改成正式排名。</p>`;
}
function seasonBit(player) {
  if (!player.g) {
    return (player.tags || []).includes("2026新秀") ? "2026 新秀" : "上季未出賽";
  }
  return `上季 ${DreamUI.n1(player.fppg)}`;
}
function jersey(player, rank, extra) {
  const info = DC.teamMeta[player.team] || { name: player.team, color: "#888" };
  const ink = PX.ink(info.color);
  return `<article class="jersey" style="--team:${info.color};--ink:${ink}">
    <div class="jersey-rank">${rank}</div>
    <div class="jersey-pos">${esc(player.pos)}</div>
    ${DreamUI.face(player, "card")}
    <div class="jersey-name">${esc(PX.lastName(player.name))}</div>
    <div class="jersey-full">${esc(player.name)}</div>
    <div class="jersey-meta">${esc(info.name)} · ${player.age} 歲 · ${seasonBit(player)}</div>
    ${extra || ""}
  </article>`;
}
function athleteNode(player, spot, side, index) {
  if (!player) return "";
  const info = DC.teamMeta[player.team] || { color: "#333" };
  const ink = PX.ink(info.color);
  const rawLabel = PX.lastName(player.name);
  const label = rawLabel.length > 12 ? `${rawLabel.slice(0, 11)}…` : rawLabel;
  const heads = typeof PLAYER_HEADS === "undefined" ? null : PLAYER_HEADS;
  const url = heads && heads[player.id];
  const photo = url
    ? `<image class="mug" href="${esc(url)}" x="-26" y="-26" width="52" height="52" preserveAspectRatio="xMidYMin slice"></image>`
    : "";
  return `<g class="athlete" id="ath-${side}-${index}" transform="translate(${spot.x},${spot.y})">
    <circle r="26" fill="${info.color}"></circle>
    <text y="5" text-anchor="middle" font-size="13" font-weight="700" fill="${ink}">${esc(PX.initials(player.name))}</text>
    ${photo}
    <circle class="ring" r="26" fill="none" stroke="${ink === "#fff" ? "rgba(0,0,0,.55)" : ink}" stroke-width="2"></circle>
    <text y="48" text-anchor="middle" font-size="14" font-weight="700" fill="#1a1203" stroke="#f8f1e4" stroke-width="4" paint-order="stroke">${esc(label)}</text>
  </g>`;
}
function courtMarkup(home, away) {
  const homeNodes = PX.HOME_SPOTS.map((spot, index) => athleteNode(home[index], spot, "home", index)).join("");
  const awayNodes = PX.AWAY_SPOTS.map((spot, index) => athleteNode(away[index], spot, "away", index)).join("");
  return `<svg class="court-svg" viewBox="0 0 1000 560" role="img" aria-label="籃球場" font-family="Bahnschrift, Microsoft JhengHei, sans-serif">
    <defs>
      <pattern id="planks" width="36" height="560" patternUnits="userSpaceOnUse">
        <rect width="36" height="560" fill="#d39245"></rect>
        <rect width="3" height="560" fill="#b87432" opacity="0.45"></rect>
      </pattern>
    </defs>
    <rect width="1000" height="560" fill="url(#planks)"></rect>
    <rect x="36" y="170" width="190" height="220" fill="#c23b32" opacity="0.33"></rect>
    <rect x="774" y="170" width="190" height="220" fill="#1d4e89" opacity="0.28"></rect>
    <g fill="none" stroke="#f6efe2" stroke-width="3">
      <rect x="36" y="28" width="928" height="504"></rect>
      <line x1="500" y1="28" x2="500" y2="532"></line>
      <circle cx="500" cy="280" r="70"></circle>
      <rect x="36" y="170" width="190" height="220"></rect>
      <circle cx="226" cy="280" r="60"></circle>
      <rect x="774" y="170" width="190" height="220"></rect>
      <circle cx="774" cy="280" r="60"></circle>
      <path d="M36 86 H168 A210 210 0 0 1 168 474 H36"></path>
      <path d="M964 86 H832 A210 210 0 0 0 832 474 H964"></path>
      <path d="M92 232 A48 48 0 0 1 92 328"></path>
      <path d="M908 232 A48 48 0 0 0 908 328"></path>
    </g>
    <line x1="36" y1="248" x2="36" y2="312" stroke="#f6efe2" stroke-width="5"></line>
    <circle id="hoop-home" class="hoop" cx="78" cy="280" r="12" fill="none" stroke="#f97316" stroke-width="4"></circle>
    <line x1="964" y1="248" x2="964" y2="312" stroke="#f6efe2" stroke-width="5"></line>
    <circle id="hoop-away" class="hoop" cx="922" cy="280" r="12" fill="none" stroke="#f97316" stroke-width="4"></circle>
    ${homeNodes}${awayNodes}
    <circle id="game-ball" cx="500" cy="280" r="12" fill="#f26522" stroke="#1a1203" stroke-width="2"></circle>
  </svg>`;
}
function stories() {
  const items = [
    ["上季冠軍", "紐約尼克"],
    ["MVP", "Shai Gilgeous-Alexander"],
    ["最佳新秀", "Cooper Flagg"],
    ["得分王", "Luka Dončić"],
    ["籃板 / 助攻", "Nikola Jokić"],
    ["最佳防守球員", "Victor Wembanyama"]
  ];
  return `<div class="story-row">${items.map(([label, name]) => `<div class="story"><span>${label}</span><b>${esc(name)}</b></div>`).join("")}</div>`;
}
function hub() {
  const colors = ["#7c5cff", "#e03a3e", "#007a33", "#fdb927", "#1d9bf0", "#ff7a18", "#3dd68c", "#f0c14b"];
  const stars = PX.baseline().slice(0, 5);
  const next = PX.contrastIds(stars.map((player) => player.id)).map((id) => PX.BY[id]);
  const fantasyLabel = DC.state ? "繼續模擬賽季" : "改打模擬賽季";
  return `
    <main class="page"><div class="wrap hero">
      <div class="brand-lockup">${DreamUI.ball()}<div><strong>夢幻球場</strong><small>2026-27 PREDICTION</small></div></div>
      ${teamRail()}
      <div class="kicker">開季預測 · 賽後用真實數據排名</div>
      <h1>誰會在<br><span class="grad">2026-27 打出大季</span></h1>
      <p class="lead">和朋友各自排一張夢幻前十。先用上季數據試算，等 2026-27 的真實成績放進來，同一份名單會自動結算，看誰把名次排得最準。</p>
      ${stories()}
      <div class="stage court-hero">${courtMarkup(stars, next)}</div>
      <p class="muted court-caption">左半場是上季夢幻積分前五，右半場是緊接著的五人。這一季還會不會是他們，由你們來排。</p>
      ${pendingBanner()}
      <div class="grid two" style="margin-top:16px">
        <section class="panel">
          ${PX.state ? `
            <h2>你的預測還在這台瀏覽器</h2>
            <p>${esc(PX.state.name)} · 已排 ${PX.state.picks.length}/10${PX.state.friends.length ? ` · ${PX.state.friends.length} 位朋友` : ""}</p>
            <div class="row">
              <button class="btn primary" type="button" data-px="enter">回到預測榜</button>
              ${PX.resultsReady() ? "" : `<button class="btn danger" type="button" data-px="reset">清除重排</button>`}
            </div>` : PX.resultsReady() ? `
            <h2>這季預測已封存</h2>
            <p class="muted">真實數據已經公布。沒有事先留在這台瀏覽器的名單，就不能再補交。</p>` : `
            <h2>用你的名字進榜</h2>
            <form id="px-setup">
              <div class="row">
                <label class="field"><span>你的名字</span><input id="px-name" maxlength="16" value="我" required></label>
                <div class="field"><span>代表色</span><div class="swatches">
                  ${colors.map((color, index) => `<button type="button" class="swatch ${index === 0 ? "active" : ""}" data-act="color" data-color="${color}" style="background:${color}"></button>`).join("")}
                </div></div>
              </div>
              <div class="row" style="margin-top:14px"><button class="btn primary" type="submit">開始排前十</button></div>
            </form>`}
          <p class="muted">名單存在各自的瀏覽器。把分享連結貼到群組，朋友才會出現在你的排行榜。</p>
        </section>
        <section class="panel">
          <h2>想先自己打一季？</h2>
          <p class="muted">模擬賽季仍然在：蛇形選秀、每週對戰、傷兵、自由市場、交易和季後賽。它和預測榜分開存檔，不會混在一起。</p>
          <button class="btn" type="button" data-act="mode" data-mode="fantasy">${fantasyLabel}</button>
        </section>
      </div>
    </div></main>
    ${DreamUI.toastHtml()}`;
}
function shell(body) {
  document.documentElement.style.setProperty("--user", PX.state.color || "#7c5cff");
  const board = PX.leaderboard();
  const mine = board.rows.find((row) => row.self);
  const place = board.rows.findIndex((row) => row.self) + 1;
  const tabs = [["board", "預測榜"], ["picks", "排前十"], ["friends", "朋友"], ["live", "開球"], ["rules", "計分"]];
  const score = mine && mine.score.complete ? mine.score.accuracy : "—";
  return `
    <header class="top">
      <div class="wrap">
        <div class="top-row">
          <button class="brand" type="button" data-px="tab" data-tab="board">${DreamUI.ball()}<span><strong>夢幻球場</strong><small>2026-27 預測榜</small></span></button>
          <div class="scorebug">
            <div><span class="label">${esc(PX.state.name)}</span><b>${score}</b></div>
            <div><span class="label">${board.official ? "正式名次" : "試算名次"}</span><b>${mine && mine.score.complete ? `#${place}` : "未滿"}</b></div>
            <div><span class="label">狀態</span><b>${board.official ? "結算" : "待賽季"}</b></div>
          </div>
        </div>
        <div class="nav-row">
          <button type="button" data-act="mode" data-mode="hub">首頁</button>
          ${tabs.map(([id, label]) => `<button type="button" data-px="tab" data-tab="${id}" class="${px.tab === id ? "active" : ""}">${label}</button>`).join("")}
          <button type="button" data-act="mode" data-mode="fantasy">模擬賽季</button>
        </div>
      </div>
    </header>
    <main class="page"><div class="wrap">${pendingBanner()}${body}</div></main>
    ${DreamUI.toastHtml()}`;
}
function rowKey(row) { return row.self ? "me" : row.code; }
function detail(board) {
  const row = board.rows.find((item) => rowKey(item) === px.open) || board.rows[0];
  if (!row) return "";
  const rankLabel = board.official ? "真實名次" : "上季名次";
  const cards = row.picks.map((id, index) => {
    const scored = row.score.rows[index];
    return jersey(PX.BY[id], index + 1, `<div class="jersey-meta">${rankLabel} ${scored.actual || "—"} · 這格 ${scored.got} 分</div>`);
  }).join("");
  const blanks = Array.from({ length: 10 - row.picks.length }, (_, index) => `<article class="jersey empty"><div class="jersey-rank">${row.picks.length + index + 1}</div><div class="jersey-name">空位</div></article>`).join("");
  return `<section class="panel" style="margin-top:16px"><h2>${esc(row.name)} 的前十</h2><div class="jersey-grid">${cards}${blanks}</div></section>`;
}
function viewBoard() {
  const board = PX.leaderboard();
  const head = board.official ? "預測分" : "上季試算";
  const power = board.official ? "真實火力" : "上季火力";
  return `
    ${statusLine()}
    <section class="panel">
      <div class="split"><h2>${board.official ? "正式排行榜" : "朋友試算榜"}</h2><span class="muted">${board.rows.length} 人</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>名次</th><th>朋友</th><th class="num">${head}</th><th class="num">前十命中</th><th class="num">${power}</th><th>名單</th></tr></thead>
        <tbody>
          ${board.rows.map((row, index) => `<tr class="${row.self ? "me" : ""} ${rowKey(row) === px.open ? "open" : ""}">
            <td>${index + 1}</td>
            <td><button class="link" type="button" data-px="open" data-code="${row.self ? "me" : esc(row.code)}">${esc(row.name)}</button>${row.self ? " · 你" : ""}</td>
            <td class="num">${row.score.complete ? row.score.accuracy : "—"}</td>
            <td class="num">${row.score.hits}/10</td>
            <td class="num">${DreamUI.n1(row.score.power)}</td>
            <td>${row.score.complete ? (row.locked ? "已鎖定" : "還能改") : "未滿 10 人"}</td>
          </tr>`).join("")}
        </tbody>
      </table></div>
    </section>
    ${detail(board)}`;
}
function slotRow(index) {
  const id = PX.state.picks[index];
  if (!id) return `<div class="forecast-slot empty"><b>${index + 1}</b><span>從右邊點進來</span></div>`;
  const player = PX.BY[id];
  const info = DC.teamMeta[player.team];
  const actions = PX.frozen() ? "" : `
    <button class="btn" type="button" data-px="up" data-id="${id}" ${index === 0 ? "disabled" : ""}>上移</button>
    <button class="btn" type="button" data-px="down" data-id="${id}" ${index === PX.state.picks.length - 1 ? "disabled" : ""}>下移</button>
    <button class="btn danger" type="button" data-px="remove" data-id="${id}">移出</button>`;
  return `<div class="forecast-slot" style="--team:${info.color}">
    <b>${index + 1}</b>
    <div class="who">${DreamUI.face(player)}<div><strong>${esc(player.name)}</strong><div class="sub">${esc(player.pos)} · ${esc(info.name)} · ${player.age} 歲 · ${player.g ? `上季第 ${lastRank(id)} · ` : ""}${seasonBit(player)}</div></div></div>
    <div class="row">${actions}</div>
  </div>`;
}
function candidatePool() {
  const query = px.q.trim().toLowerCase();
  const list = DC.players.filter((player) => {
    const team = DC.teamMeta[player.team];
    if (px.pos !== "ALL" && player.pos !== px.pos && !(player.elig || []).includes(px.pos)) return false;
    if (!query) return true;
    return `${player.name} ${player.team} ${team.name} ${player.pos}`.toLowerCase().includes(query);
  });
  if (px.sort === "age") list.sort((a, b) => a.age - b.age || b.fppg - a.fppg);
  else if (px.sort === "pts") list.sort((a, b) => b.pts - a.pts);
  else if (px.sort === "g") list.sort((a, b) => b.g - a.g || b.fppg - a.fppg);
  else list.sort((a, b) => b.fppg - a.fppg);
  return list.slice(0, query ? 50 : 30);
}
function viewPicks() {
  const score = PX.scoreList(PX.state.picks, PX.resultsReady());
  const lockedNote = PX.resultsReady()
    ? "真實數據已進來，這份預測已封存。"
    : (PX.state.locked ? "名單已鎖定。結算前可以解鎖再改。" : "第 1 名權重最高。排的是你覺得這一季誰會打得好，不一定照上季順序。");
  const positions = ["ALL", "PG", "SG", "SF", "PF", "C"];
  return `
    <div class="grid two">
      <section class="panel">
        <div class="split"><h2>你的 2026-27 前十</h2><b>${PX.state.picks.length}/10</b></div>
        <p class="muted">${lockedNote}</p>
        <div class="pick-list">${Array.from({ length: 10 }, (_, index) => slotRow(index)).join("")}</div>
        <p class="muted">${score.complete ? `${PX.resultsReady() ? "正式預測分" : "若上季名次重演"} ${score.accuracy} 分，前十命中 ${score.hits} 人。` : "排滿 10 人才會計分。"}</p>
        <div class="row">
          ${PX.resultsReady() ? "" : PX.state.locked
            ? `<button class="btn" type="button" data-px="unlock">解鎖再改</button>`
            : `<button class="btn primary" type="button" data-px="lock" ${PX.state.picks.length === 10 ? "" : "disabled"}>鎖定這份預測</button>`}
          ${PX.resultsReady() ? "" : `<button class="btn danger" type="button" data-px="reset">清除重排</button>`}
        </div>
      </section>
      <section class="panel">
        <h2>從 2026-27 名單裡挑</h2>
        <div class="row">
          <input id="pxq" type="search" placeholder="搜尋名字或球隊，例如 Flagg、湖人" value="${esc(px.q)}" autocomplete="off">
          <select id="px-sort">
            <option value="fppg" ${px.sort === "fppg" ? "selected" : ""}>上季夢幻分</option>
            <option value="pts" ${px.sort === "pts" ? "selected" : ""}>上季得分</option>
            <option value="age" ${px.sort === "age" ? "selected" : ""}>年紀較輕</option>
            <option value="g" ${px.sort === "g" ? "selected" : ""}>出賽較多</option>
          </select>
        </div>
        <div class="pills" style="margin:10px 0">${positions.map((pos) => `<button type="button" class="chip ${px.pos === pos ? "active" : ""}" data-px="pos" data-pos="${pos}">${pos === "ALL" ? "全部" : pos}</button>`).join("")}</div>
        <div class="pick-scroll">
          ${candidatePool().map((player) => {
            const picked = PX.state.picks.indexOf(player.id);
            const info = DC.teamMeta[player.team];
            const action = picked >= 0
              ? `<span class="tag">第 ${picked + 1} 名</span>`
              : `<button class="btn primary" type="button" data-px="add" data-id="${player.id}" ${PX.frozen() ? "disabled" : ""}>放入</button>`;
            return `<div class="person"><div class="who">${DreamUI.face(player)}<div><b>${esc(player.name)}</b><div class="sub">${esc(player.pos)} · <i class="dot" style="background:${info.color}"></i>${esc(info.name)} · ${player.age} 歲 · ${player.g ? `上季第 ${lastRank(player.id)} · ` : ""}${seasonBit(player)}</div></div></div>${action}</div>`;
          }).join("")}
        </div>
      </section>
    </div>`;
}
function viewFriends() {
  const code = PX.encode(PX.state.picks);
  const league = PX.exportLeague();
  return `
    <div class="grid two">
      <section class="panel">
        <h2>把預測傳給朋友</h2>
        <p class="muted">排滿 10 人之後複製連結，貼到群組。朋友打開並建立名字，就會把你加進他們的榜。你也要打開他們回傳的連結。人都到齊後，再複製一次整份排行榜，大家看到的名單就會對上。</p>
        ${code ? `
          <label class="field"><span>你的分享碼</span><input readonly value="${esc(code)}"></label>
          <div class="row" style="margin-top:10px">
            <button class="btn primary" type="button" data-px="copy" data-copy="code">複製分享碼</button>
            <button class="btn" type="button" data-px="copy" data-copy="link">複製個人連結</button>
            ${league ? `<button class="btn" type="button" data-px="copy" data-copy="league">複製整份排行榜</button>` : ""}
          </div>` : `<p class="warn">先排滿 10 人，才有分享碼。</p>`}
      </section>
      <section class="panel">
        <h2>加入朋友傳來的預測</h2>
        ${PX.resultsReady() ? `<p class="muted">已經結算，不能再加入新名單。</p>` : `
        <form id="px-friend" class="grid">
          <label class="field"><span>朋友的名字</span><input id="friend-name" maxlength="16" placeholder="如果貼的是整段連結，名字可以留空"></label>
          <label class="field"><span>分享碼或連結</span><textarea id="friend-code" rows="3" placeholder="貼上 K7- 開頭的碼，或整段網址"></textarea></label>
          <button class="btn primary" type="submit">加入排行榜</button>
        </form>`}
        <div style="margin-top:12px">
          ${PX.state.friends.map((friend) => `<div class="person"><div><b>${esc(friend.name)}</b><div class="sub">${esc(friend.code)}</div></div><button class="btn danger" type="button" data-px="drop-friend" data-code="${esc(friend.code)}">移除</button></div>`).join("") || `<p class="muted">還沒有朋友。</p>`}
        </div>
      </section>
    </div>`;
}
function awayIds() {
  if (px.opponent !== "lastyear") {
    const friend = PX.state.friends.find((item) => item.code === px.opponent);
    if (friend) return friend.picks.slice(0, 5);
  }
  return PX.contrastIds(PX.state.picks.slice(0, 5));
}
function awayLabel() {
  if (px.opponent === "lastyear") return "上季對照";
  const friend = PX.state.friends.find((item) => item.code === px.opponent);
  return friend ? friend.name : "上季對照";
}
function viewLive() {
  const ready = PX.state.picks.length >= 5;
  const home = PX.state.picks.slice(0, 5).map((id) => PX.BY[id]);
  const away = ready ? awayIds().map((id) => PX.BY[id]) : [];
  const shown = demo.final;
  return `
    <section class="panel">
      <div class="split">
        <h2>開季預告片</h2>
        <div class="row">
          <label class="field"><span>右半場</span>
            <select id="px-opp">
              <option value="lastyear" ${px.opponent === "lastyear" ? "selected" : ""}>上季對照</option>
              ${PX.state.friends.map((friend) => `<option value="${esc(friend.code)}" ${px.opponent === friend.code ? "selected" : ""}>${esc(friend.name)} 的前五</option>`).join("")}
            </select>
          </label>
          <button class="btn primary" id="tipoff" type="button" data-px="tipoff" ${ready ? "" : "disabled"}>${shown ? "再看一次" : "開球"}</button>
        </div>
      </div>
      <p class="muted">${ready ? "你的前五在左半場，球會從出手的人飛向對面籃框。" : "先排進至少 5 名球員。"}這段用上季數據編成，用來想像開打的畫面，不是 2026-27 的正式結果。</p>
      <div class="broadcast-bar">
        <div class="bug-side"><span>${esc(PX.state.name)}</span><b id="score-home">${shown ? shown.homeScore : 0}</b></div>
        <div class="bug-mid">預告片</div>
        <div class="bug-side"><span>${esc(awayLabel())}</span><b id="score-away">${shown ? shown.awayScore : 0}</b></div>
      </div>
      <div class="stage">${courtMarkup(home, away)}</div>
      <p class="bug-call" id="play-line">${esc(demo.log[0] || "按下開球，看這五個人怎麼攻框。")}</p>
      <ol class="play-log" id="play-log">${demo.log.map((line) => `<li>${esc(line)}</li>`).join("")}</ol>
    </section>`;
}
function viewRules() {
  return `
    <section class="panel">
      <h2>預測分怎麼算</h2>
      <p>每人排 10 名，第 1 名代表你最看好他在 2026-27 打進全聯盟夢幻積分前段。賽季數據進來之後，用真實名次給分，滿分 800。</p>
      <div class="grid cards">
        <div class="panel stat"><span>排進真實前十</span><b>80</b><span class="muted">每差一名少 6 分</span></div>
        <div class="panel stat"><span>真實第 11 到 20</span><b>23–14</b><span class="muted">越接近前十越高</span></div>
        <div class="panel stat"><span>真實第 21 到 40</span><b>8</b><span class="muted">有進前段班</span></div>
        <div class="panel stat"><span>40 名開外</span><b>0</b><span class="muted">這格沒有猜中</span></div>
      </div>
      <p>舉例：你的第 1 名最後真的是第 1，這格 80 分。若他落到第 2，變 74 分。若落到第 15，這格只剩 19 分。十格加總就是預測分。</p>
      <p>現在看到的是上季試算：把 2025-26 的名次套進同一套公式。2026 新秀和上季沒出賽的人，試算是 0 分，要等真實數據才會計進正式排名。火力欄是這 10 人的場均夢幻積分加總，不決定名次。</p>
      <h2>和朋友一起玩</h2>
      <p>這個網站沒有中央伺服器。你的名單在自己的瀏覽器，朋友的名單要靠分享碼或連結加進來。資料更新、正式結算之前，先把想比的人都加進榜；結算之後就不能再補交新預測。</p>
      <h2>場上那顆球</h2>
      <p>開球預告片會把你的前五放到球場上，依上季得分、命中率和抄截阻攻編成十幾個攻防回合。那是開季畫面，不是預測本身的分數。</p>
    </section>`;
}
function view() {
  if (!PX.state) return hub();
  const pages = { board: viewBoard, picks: viewPicks, friends: viewFriends, live: viewLive, rules: viewRules };
  return shell((pages[px.tab] || viewBoard)());
}
function placeBall(x, y) {
  const ball = document.getElementById("game-ball");
  if (!ball) return;
  ball.setAttribute("cx", x);
  ball.setAttribute("cy", y);
}
function commitPlay(play) {
  const home = document.getElementById("score-home");
  const away = document.getElementById("score-away");
  const call = document.getElementById("play-line");
  if (home) home.textContent = play.homeScore;
  if (away) away.textContent = play.awayScore;
  if (call) call.textContent = play.text;
  const log = document.getElementById("play-log");
  if (log) {
    const item = document.createElement("li");
    item.textContent = play.text;
    log.prepend(item);
    while (log.children.length > 6) log.removeChild(log.lastChild);
  }
  demo.log.unshift(play.text);
  demo.log = demo.log.slice(0, 6);
  document.querySelectorAll(".athlete.on").forEach((el) => el.classList.remove("on"));
  document.querySelectorAll(".hoop.flash").forEach((el) => el.classList.remove("flash"));
  if (!play.end) {
    const athlete = document.getElementById(`ath-${play.side}-${play.actor}`);
    if (athlete) athlete.classList.add("on");
    if (play.points > 0) {
      const hoop = document.getElementById(play.side === "home" ? "hoop-away" : "hoop-home");
      if (hoop) hoop.classList.add("flash");
    }
  }
}
function runPlay(play, token, done) {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ball = document.getElementById("game-ball");
  if (!ball || reduced || play.end || !play.ball.arc) {
    placeBall(play.ball.x, play.ball.y);
    commitPlay(play);
    done();
    return;
  }
  placeBall(play.from.x, play.from.y);
  const from = play.from;
  const to = play.ball;
  const started = performance.now();
  function frame(now) {
    if (demo.token !== token) return;
    const k = Math.min(1, (now - started) / 560);
    const eased = 1 - Math.pow(1 - k, 3);
    placeBall(from.x + (to.x - from.x) * eased, from.y + (to.y - from.y) * eased - Math.sin(Math.PI * k) * to.arc);
    if (k < 1) requestAnimationFrame(frame);
    else { commitPlay(play); done(); }
  }
  requestAnimationFrame(frame);
}
function startDemo() {
  if (!PX.state || PX.state.picks.length < 5) return;
  stop();
  const token = demo.token;
  demo.running = true;
  demo.final = null;
  demo.log = [];
  const game = PX.exhibition(PX.state.picks.slice(0, 5), awayIds());
  demo.game = game;
  placeBall(500, 280);
  const home = document.getElementById("score-home");
  const away = document.getElementById("score-away");
  const call = document.getElementById("play-line");
  const log = document.getElementById("play-log");
  const button = document.getElementById("tipoff");
  if (home) home.textContent = "0";
  if (away) away.textContent = "0";
  if (call) call.textContent = "跳球，預告片開始。";
  if (log) log.innerHTML = "";
  if (button) button.disabled = true;
  let index = 0;
  const step = () => {
    if (demo.token !== token) return;
    if (index >= game.plays.length) {
      demo.running = false;
      demo.final = game;
      demo.log = game.plays.map((play) => play.text).slice().reverse().slice(0, 6);
      if (button) {
        button.disabled = false;
        button.textContent = "再看一次";
      }
      return;
    }
    const play = game.plays[index];
    index += 1;
    runPlay(play, token, () => {
      if (demo.token !== token) return;
      demo.timer = setTimeout(step, play.end ? 200 : 420);
    });
  };
  step();
}
function onPx(event) {
  const button = event.target.closest("[data-px]");
  if (!button) return;
  const act = button.dataset.px;
  if (act === "tab") { px.tab = button.dataset.tab; DreamUI.render(); return; }
  if (act === "enter") {
    px.tab = PX.state && PX.state.picks.length === 10 ? "board" : "picks";
    DreamUI.setMode("predict");
    return;
  }
  if (act === "pos") { px.pos = button.dataset.pos; DreamUI.render(); return; }
  if (act === "open") { px.open = button.dataset.code || "me"; DreamUI.render(); return; }
  if (act === "import-pending") {
    const count = takePending();
    px.tab = "board";
    DreamUI.setMode("predict");
    DreamUI.notify(count ? `已加入 ${count} 份預測。` : "這些預測已經在榜上。");
    return;
  }
  if (act === "reset") {
    if (PX.resultsReady()) { DreamUI.notify("真實數據已進來，這份預測已封存。"); return; }
    if (window.confirm("要清除你的預測和朋友名單嗎？")) { PX.reset(); DreamUI.setMode("hub"); }
    return;
  }
  if (!PX.state) return;
  if (act === "add") {
    if (PX.frozen()) { DreamUI.notify(PX.resultsReady() ? "真實數據已進來，這份預測已封存。" : "名單已鎖定。要改請先解鎖。"); return; }
    if (PX.state.picks.length >= 10) { DreamUI.notify("前十已經滿了，先移出一個人。"); return; }
    if (!PX.add(button.dataset.id)) DreamUI.notify("這名球員已經在名單裡。");
    else DreamUI.render();
    return;
  }
  if (act === "remove") { PX.remove(button.dataset.id); DreamUI.render(); return; }
  if (act === "up") { PX.move(button.dataset.id, -1); DreamUI.render(); return; }
  if (act === "down") { PX.move(button.dataset.id, 1); DreamUI.render(); return; }
  if (act === "lock") {
    if (PX.lock()) DreamUI.notify("已鎖定。結算前還可以解鎖。");
    else DreamUI.notify("排滿 10 人才能鎖定。");
    return;
  }
  if (act === "unlock") { PX.unlock(); DreamUI.notify("已解鎖，可以調整名次。"); return; }
  if (act === "drop-friend") { PX.removeFriend(button.dataset.code); DreamUI.render(); return; }
  if (act === "copy") {
    const code = PX.encode(PX.state.picks);
    if (button.dataset.copy === "link") copyText(linkFor({ c: code, n: PX.state.name }), "個人連結已複製，貼到群組即可。");
    else if (button.dataset.copy === "league") copyText(linkFor({ league: PX.exportLeague() }), "整份排行榜連結已複製。");
    else copyText(code, "分享碼已複製。");
    return;
  }
  if (act === "tipoff") startDemo();
}
function onSubmit(event) {
  if (event.target.id === "px-setup") {
    event.preventDefault();
    const color = document.querySelector(".swatch.active");
    if (!PX.create(document.getElementById("px-name").value, color ? color.dataset.color : "#7c5cff")) {
      DreamUI.notify("這季預測已封存，不能再交新名單。");
      return;
    }
    const count = takePending();
    px.tab = "picks";
    DreamUI.setMode("predict");
    if (count) DreamUI.notify(`已把 ${count} 份朋友預測加進排行榜。`);
    return;
  }
  if (event.target.id === "px-friend") {
    event.preventDefault();
    const raw = document.getElementById("friend-code").value;
    const parsed = PX.readShare(raw);
    if (parsed.league) {
      let count = 0;
      PX.parseLeague(parsed.league).forEach((entry) => {
        if (PX.addFriend(entry.name, entry.code).ok) count += 1;
      });
      DreamUI.notify(count ? `已加入 ${count} 份預測。` : "沒有新的預測可加入。");
      if (count) px.tab = "board";
      DreamUI.render();
      return;
    }
    const result = PX.addFriend(parsed.name || document.getElementById("friend-name").value, parsed.code || raw);
    if (result.ok) px.tab = "board";
    DreamUI.notify(result.message);
  }
}
function onInput(event) {
  if (event.target.id !== "pxq") return;
  px.q = event.target.value;
  DreamUI.render();
}
function onChange(event) {
  if (event.target.id === "px-sort") { px.sort = event.target.value; DreamUI.render(); return; }
  if (event.target.id === "px-opp") {
    px.opponent = event.target.value;
    demo.final = null;
    demo.log = [];
    DreamUI.render();
  }
}

window.PredictUI = { view, hub, stop };
bootIncoming();
document.body.addEventListener("click", onPx);
document.body.addEventListener("submit", onSubmit);
document.body.addEventListener("input", onInput);
document.body.addEventListener("change", onChange);
DreamUI.render();
})();
