"use strict";

const session = {
  q: "", pos: "ALL", team: "ALL", sort: "adp",
  give: [], get: [], partner: 1, modal: null, pendingAdd: null,
  cmpA: 1, cmpB: 2, toast: ""
};
let keepScroll = true;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}
function pct(n) { return `${Math.round(n * 1000) / 10}%`; }
function n1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

function notify(message) {
  session.toast = message || "";
  render();
  if (!message) return;
  const current = message;
  setTimeout(() => {
    if (session.toast === current) {
      session.toast = "";
      const el = document.getElementById("toast");
      if (el) el.remove();
    }
  }, 2800);
}

function teamName(id) { return DC.teamById(id).name; }
function meta(code) { return DC.teamMeta[code]; }

function statusBits(p) {
  const bits = [];
  if (p.status === "OUT") bits.push(`<span class="status out">缺陣${p.inj ? ` ${p.inj}週` : ""}</span>`);
  else if (p.status === "DTD") bits.push(`<span class="status dtd">出賽成疑</span>`);
  if (p.hot >= 2) bits.push(`<span class="status hot">手感火燙</span>`);
  else if (p.hot <= -2) bits.push(`<span class="status cold">手感偏低</span>`);
  return bits.join(" ");
}
function tags(p) {
  return (p.tags || []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join(" ");
}
function teamPill(code) {
  const info = meta(code);
  return `<span class="team-pill"><i style="background:${info.color}"></i>${esc(code)} ${esc(info.name)}</span>`;
}

function shell(body) {
  const state = DC.state;
  if (!state) return setupScreen();
  document.documentElement.style.setProperty("--user", state.color || "#7c5cff");
  const me = DC.me();
  const rank = DC.standings().findIndex((t) => t.id === 0) + 1;
  const tabs = navItems();
  const tab = activeTab();
  return `
    <header class="top">
      <div class="wrap">
        <div class="top-row">
          <button class="brand" data-act="nav" data-tab="${state.phase === "draft" ? "draft" : "home"}">
            <span class="logo">DC</span>
            <span><strong>夢幻球場</strong><small>NBA Fantasy 2026-27</small></span>
          </button>
          <div class="scorebug">
            <div><span class="label">${esc(me.name)}</span><b>${state.phase === "draft" ? "選秀" : `${me.w}-${me.l}`}</b></div>
            ${state.phase === "draft" ? "" : `<div><span class="label">排名</span><b>#${rank}</b></div>`}
            ${state.phase === "draft" ? "" : `<div><span class="label">${state.phase === "done" ? "賽季" : "週次"}</span><b>${state.phase === "done" ? "結束" : state.week}</b></div>`}
          </div>
        </div>
        <div class="nav-row">
          ${tabs.map(([id, label]) => `<button data-act="nav" data-tab="${id}" class="${tab === id ? "active" : ""}">${label}</button>`).join("")}
        </div>
      </div>
    </header>
    <main class="page"><div class="wrap">${body}</div></main>
    ${session.modal ? modal(session.modal) : ""}
    ${session.pendingAdd ? dropModal(session.pendingAdd) : ""}
    ${session.toast ? `<div id="toast" class="toast">${esc(session.toast)}</div>` : ""}
  `;
}

function navItems() {
  const state = DC.state;
  if (state.phase === "draft") return [["draft", "選秀"], ["rules", "規則"]];
  const items = [["home", "總覽"], ["lineup", "陣容"], ["match", "對戰"], ["wire", "自由市場"], ["trade", "交易"], ["stand", "戰績"], ["stats", "數據"], ["news", "新聞"]];
  if (state.playoff || state.phase === "done") items.push(["playoff", "季後賽"]);
  items.push(["rules", "規則"]);
  return items;
}
function activeTab() {
  const state = DC.state;
  const tab = state.tab || "home";
  if (state.phase === "draft" && tab !== "rules") return "draft";
  const known = navItems().some(([id]) => id === tab);
  return known ? tab : "home";
}

function setupScreen() {
  const colors = ["#7c5cff", "#e03a3e", "#007a33", "#fdb927", "#1d9bf0", "#ff7a18", "#3dd68c", "#f0c14b"];
  return `
    <main class="page"><div class="wrap hero">
      <div class="kicker">2025-26 真實數據 · 2026-27 模擬賽季</div>
      <h1>組一支<br><span class="grad">夢幻球隊</span></h1>
      <p class="lead">10 隊聯盟、蛇形選秀、每週對戰、傷兵、自由市場、交易和季後賽。球員場均來自 2025-26 NBA 正規賽：尼克奪冠，Alexander 拿下 MVP，Flagg 是最佳新秀。</p>
      <div class="grid cards" style="margin:18px 0">
        ${[["210", "名真實球員"], ["13", "人名單 + 2 傷兵"], ["15", "週常規賽"], ["6", "隊打季後賽"]].map(([n, label]) => `<div class="panel stat"><span>${label}</span><b>${n}</b></div>`).join("")}
      </div>
      <form id="setup" class="panel">
        <h2>開一季新的</h2>
        <div class="row">
          <label class="field"><span>球隊名稱</span><input id="manager" type="text" maxlength="16" value="我的球隊" required></label>
          <label class="field"><span>選秀順位</span>
            <select id="slot">
              <option value="0">隨機</option>
              ${Array.from({ length: 10 }, (_, i) => `<option value="${i + 1}">第 ${i + 1} 順位</option>`).join("")}
            </select>
          </label>
          <div class="field"><span>球隊顏色</span><div class="swatches" id="colors">
            ${colors.map((color, i) => `<button type="button" class="swatch ${i === 0 ? "active" : ""}" data-act="color" data-color="${color}" style="background:${color}"></button>`).join("")}
          </div></div>
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn primary" type="submit">開始選秀</button>
          <button class="btn" type="button" data-act="import-click">讀取存檔</button>
          <input id="import" type="file" accept="application/json" hidden>
        </div>
        <p class="muted">進度會存在這台瀏覽器。計分：得分 1、籃板 1.2、助攻 1.5、抄截 3、阻攻 3、三分 0.5、失誤 -1、雙十 +2、大三元再 +3。</p>
      </form>
    </div></main>
    ${session.toast ? `<div id="toast" class="toast">${esc(session.toast)}</div>` : ""}
  `;
}

function page() {
  const tab = activeTab();
  const views = { draft: viewDraft, home: viewHome, lineup: viewLineup, match: viewMatch, wire: viewWire, trade: viewTrade, stand: viewStand, stats: viewStats, news: viewNews, playoff: viewPlayoff, rules: viewRules };
  return shell((views[tab] || viewHome)());
}

function viewDraft() {
  const state = DC.state;
  const clock = DC.onClock();
  const round = Math.floor(state.overall / 10) + 1;
  const mine = DC.me();
  const recs = state.phase === "draft" ? DC.recommendations() : [];
  const recent = state.picks.slice(-8).reverse();
  return `
    <div class="grid two">
      <section class="panel">
        <div class="split">
          <h2>${state.phase === "draft" ? `第 ${round} 輪 · ${clock === 0 ? "輪到你" : `輪到 ${esc(teamName(clock))}`}` : "選秀結束"}</h2>
          <div class="row">
            ${state.phase === "draft" && clock !== 0 ? `<button class="btn primary" data-act="until">快轉到我的順位</button>` : ""}
            ${state.phase === "draft" ? `<button class="btn" data-act="rest">剩餘自動選完</button>` : ""}
          </div>
        </div>
        <p class="muted">順位第 ${state.order.indexOf(0) + 1}。蛇形選秀，奇數輪由左到右，偶數輪反轉。建議優先：${recs.map((id) => `<button class="link" data-act="player" data-id="${id}">${esc(DC.P(id).name)}</button>`).join("、") || "—"}</p>
        ${filters()}
        ${playerTable(availablePlayers(), true)}
      </section>
      <aside class="grid">
        <section class="panel">
          <h3>你的名單 ${mine.roster.length}/13</h3>
          ${mine.roster.length ? mine.roster.map((id) => {
            const p = DC.P(id);
            return `<div class="person"><div><button class="link" data-act="player" data-id="${id}">${esc(p.name)}</button><div class="sub">${esc(p.pos)} · ${teamPill(p.team)}</div></div><b>${n1(p.fppg)}</b></div>`;
          }).join("") : `<p class="muted">還沒有球員。</p>`}
        </section>
        <section class="panel">
          <h3>最近選秀</h3>
          ${recent.map((pick) => `<div class="person"><div><b>${pick.overall}.</b> ${esc(teamName(pick.teamId))}<div class="sub">${esc(DC.P(pick.playerId).name)}</div></div></div>`).join("") || `<p class="muted">選秀即將開始。</p>`}
        </section>
      </aside>
    </div>`;
}

function viewHome() {
  const state = DC.state;
  const me = DC.me();
  const rank = DC.standings().findIndex((t) => t.id === 0) + 1;
  const lastWeek = me.weeks[me.weeks.length - 1];
  const preview = DC.preview();
  const injuries = me.roster.concat(me.il).map(DC.P).filter((p) => p.status !== "OK");
  const focusWeek = state.phase === "done" ? 18 : state.week - 1;
  const focus = focusWeek >= 1 ? hotLines(focusWeek) : [];
  return `
    ${state.phase === "done" ? trophy() : ""}
    <div class="grid cards">
      <div class="panel stat"><span>戰績</span><b>${me.w}-${me.l}</b></div>
      <div class="panel stat"><span>排名</span><b>#${rank}</b></div>
      <div class="panel stat"><span>得失分</span><b>${n1(me.pf)}</b><span class="muted">失分 ${n1(me.pa)}</span></div>
      <div class="panel stat"><span>選秀評等</span><b>${state.grade ? state.grade.letter : "—"}</b><span class="muted">${state.grade ? `戰力第 ${state.grade.rank}` : ""}</span></div>
    </div>
    <div class="grid two" style="margin-top:16px">
      <section class="panel">
        <h2>${state.phase === "done" ? "賽季結束" : `第 ${state.week} 週`}</h2>
        ${previewCard(preview)}
        <div class="pills" style="margin-top:12px">${me.weeks.map((w) => `<i class="${w.result}">${w.result}</i>`).join("") || `<span class="muted">常規賽還沒開打。</span>`}</div>
        ${lastPlayoffLine()}
        ${lastWeek ? `<p>常規賽最近一場對 ${esc(teamName(lastWeek.opp))}：<b class="${lastWeek.result === "W" ? "good" : "warn"}">${lastWeek.result === "W" ? "勝" : "負"} ${n1(lastWeek.pf)}-${n1(lastWeek.pa)}</b></p>` : ""}
        <div class="row">
          ${state.phase === "season" ? `<button class="btn primary" data-act="sim">模擬第 ${state.week} 週</button><button class="btn" data-act="nav" data-tab="lineup">調整先發</button>` : ""}
          <button class="btn" data-act="export">匯出存檔</button>
          <button class="btn danger" data-act="reset">重開新季</button>
        </div>
      </section>
      <section class="panel">
        <h3>球隊快訊</h3>
        ${state.phase === "season" && DC.canTrade() && state.offer && DC.offerValid() ? `<div class="panel" style="margin-bottom:10px"><b>交易提案</b><p>${esc(state.offer.note)}</p><div class="row"><button class="btn good" data-act="accept">接受</button><button class="btn" data-act="decline">拒絕</button></div></div>` : ""}
        ${injuries.length ? injuries.map((p) => `<div class="person"><button class="link" data-act="player" data-id="${p.id}">${esc(p.name)}</button>${statusBits(p)}</div>`).join("") : `<p class="muted">名單目前沒有傷兵。</p>`}
        <hr class="sep">
        <h3>聯盟焦點</h3>
        ${focus.map((row) => `<div class="person"><div><button class="link" data-act="player" data-id="${row.id}">${esc(DC.P(row.id).name)}</button><div class="sub">${row.box.g} 場 · ${row.box.pts}分 ${row.box.reb}籃 ${row.box.ast}助</div></div><b>${n1(row.box.fp)}</b></div>`).join("") || `<p class="muted">模擬一週之後，這裡會出現爆量表現。</p>`}
        <hr class="sep">
        ${state.news.slice(0, 4).map((item) => `<div class="news-item"><b>W${item.week}</b>${esc(item.text)}</div>`).join("")}
      </section>
    </div>
    <section class="panel" style="margin-top:16px">
      <h3>第 ${state.phase === "done" ? 18 : state.week} 週各隊出賽數</h3>
      <p class="muted">4 場的球隊畫了金框。老將在四場週有機會輪休最後一場。</p>
      ${scheduleGrid(state.phase === "done" ? 18 : state.week)}
    </section>`;
}

function trophy() {
  const awards = DC.state.awards;
  if (!awards) return "";
  const mvp = DC.P(awards.mvp);
  return `
    <section class="panel trophy" style="margin-bottom:16px">
      <div class="cup">${awards.userChamp ? "🏆" : "🏀"}</div>
      <h2>${awards.userChamp ? "你帶隊封王" : `${esc(awards.champName)} 奪冠`}</h2>
      <p>你的最終名次是第 ${awards.place}。夢幻積分王 ${esc(mvp.name)}，累積 ${n1(mvp.season.fp)}。</p>
      <div class="row" style="justify-content:center">
        <button class="btn" data-act="nav" data-tab="playoff">看對戰樹</button>
        <button class="btn" data-act="nav" data-tab="stats">看數據獎</button>
      </div>
    </section>`;
}

function lastPlayoffLine() {
  const state = DC.state;
  if (!state.playoff) return "";
  for (let week = 18; week >= 16; week--) {
    const pair = DC.pairFor(week, 0);
    if (!pair) continue;
    const mineA = pair.a === 0;
    const myScore = mineA ? pair.sa : pair.sb;
    const oppScore = mineA ? pair.sb : pair.sa;
    const win = pair.winner === 0;
    return `<p>季後賽對 ${esc(teamName(mineA ? pair.b : pair.a))}：<b class="${win ? "good" : "warn"}">${win ? "勝" : "負"} ${n1(myScore)}-${n1(oppScore)}</b></p>`;
  }
  return "";
}

function previewCard(preview) {
  if (!preview) return DC.state.phase === "done" ? `<p>這一季的對戰已經全部打完。</p>` : "";
  if (preview.bye) return `<p>你是前兩種子，本週輪空，直接晉級。仍可模擬聯盟其他系列賽。</p>`;
  if (!preview.inPlay) return `<p>你沒有本週對戰。按下模擬後，季後賽和全聯盟數據仍會前進。</p>`;
  const opp = DC.teamById(preview.opp);
  return `
    <div class="vs">
      <div class="side-score"><span class="label">${esc(DC.me().name)}</span><strong>${n1(preview.mine)}</strong><span class="muted">目前先發預估${preview.best - preview.mine > 8 ? ` · 最佳約 ${n1(preview.best)}` : ""}</span></div>
      <em>VS</em>
      <div class="side-score"><span class="label">${esc(opp.name)}</span><strong>${n1(preview.theirs)}</strong><span class="muted">對手最佳陣容預估</span></div>
    </div>`;
}

function scheduleGrid(week) {
  const state = DC.state;
  const codes = Object.keys(DC.teamMeta);
  return `<div class="sched">${codes.map((code) => {
    const games = state.nba[code][week - 1];
    return `<div class="${games >= 4 ? "g4" : ""}"><span>${teamPill(code)}</span><b>${games}</b></div>`;
  }).join("")}</div>`;
}

function viewLineup() {
  const state = DC.state;
  const me = DC.me();
  const week = state.phase === "season" ? state.week : 18;
  const total = DC.SLOT_KEYS.reduce((sum, slot) => sum + (me.lineup[slot] ? DC.project(DC.P(me.lineup[slot]), week) : 0), 0);
  const bench = me.roster.filter((id) => !DC.SLOT_KEYS.some((slot) => me.lineup[slot] === id));
  return `
    <div class="split"><h2>先發</h2><div class="row"><b>本週預估 ${n1(total)}</b><button class="btn primary" data-act="optimize">排入最佳陣容</button>${state.phase === "season" ? `<button class="btn" data-act="sim">模擬本週</button>` : ""}</div></div>
    <div class="grid two">
      <section class="panel">
        <div class="slot-list">
          ${DC.SLOTS.map(([slot, label]) => {
            const current = me.lineup[slot];
            const options = me.roster.map(DC.P).filter((p) => p.id === current || (DC.canPlay(p, slot) && p.status !== "OUT" && p.inj <= 0));
            options.sort((a, b) => DC.project(b, week) - DC.project(a, week));
            const proj = current ? DC.project(DC.P(current), week) : 0;
            return `<div class="slot"><b>${label}<div class="mini">${slot}</div></b>
              <select data-act="set-lineup" data-slot="${slot}">
                <option value="">空位</option>
                ${options.map((p) => `<option value="${p.id}" ${p.id === current ? "selected" : ""}>${esc(p.name)}${p.status === "OUT" || p.inj > 0 ? " · 缺陣" : ` · ${DC.gamesFor(p.id) || "?"}場 · ${n1(DC.project(p, week))}`}</option>`).join("")}
              </select>
              <span class="mini">${current ? n1(proj) : "—"}</span></div>`;
          }).join("")}
        </div>
      </section>
      <aside class="grid">
        <section class="panel">
          <h3>板凳與傷兵</h3>
          <p class="muted">名單 ${me.roster.length}/13 · 傷兵 ${me.il.length}/2 · 預算 $${me.faab}</p>
          ${bench.map((id) => personRow(DC.P(id), `<button class="btn" data-act="insert" data-id="${id}">換上</button><button class="btn" data-act="il" data-id="${id}">傷兵</button>`)).join("")}
          ${me.il.map((id) => personRow(DC.P(id), `<button class="btn" data-act="activate" data-id="${id}">啟用</button>`)).join("")}
          ${bench.length + me.il.length ? "" : `<p class="muted">所有人都在先發。</p>`}
        </section>
        <section class="panel"><h3>出賽數</h3>${scheduleGrid(week)}</section>
      </aside>
    </div>`;
}

function personRow(p, actions) {
  return `<div class="person"><div><button class="link" data-act="player" data-id="${p.id}">${esc(p.name)}</button><div class="sub">${esc(p.elig.join("/"))} · ${p.team} · ${statusBits(p) || "健康"} · 預估 ${n1(DC.project(p, DC.state.week || 1))}</div></div><div class="row">${actions || ""}</div></div>`;
}

function viewMatch() {
  const state = DC.state;
  const week = state.phase === "done" ? 18 : state.week;
  const lastNum = state.phase === "done" ? 18 : state.week - 1;
  const last = lastNum >= 1 ? DC.pairFor(lastNum, 0) : null;
  return `
    <section class="panel">
      <div class="split"><h2>本週對戰</h2>${state.phase === "season" ? `<button class="btn primary" data-act="sim">模擬第 ${week} 週</button>` : ""}</div>
      ${previewCard(DC.preview())}
      ${state.phase === "season" && DC.isBye(0, week) ? "" : ""}
    </section>
    ${last ? resultBlock(lastNum, last) : DC.isBye(0, lastNum) ? `<section class="panel" style="margin-top:16px"><h3>第 ${lastNum} 週</h3><p>你本週輪空。</p></section>` : `<section class="panel" style="margin-top:16px"><p class="muted">還沒有已結束的對戰。</p></section>`}
  `;
}

function resultBlock(week, pair) {
  const mineA = pair.a === 0;
  const myScore = mineA ? pair.sa : pair.sb;
  const oppScore = mineA ? pair.sb : pair.sa;
  const win = pair.winner === 0;
  const lines = mineA ? pair.la : pair.lb;
  const oppLines = mineA ? pair.lb : pair.la;
  const boxes = DC.state.results[week].boxes;
  return `
    <section class="panel" style="margin-top:16px">
      <h3>第 ${week} 週戰報</h3>
      <div class="vs">
        <div class="side-score ${win ? "win" : "loss"}"><span class="label">${esc(DC.me().name)}</span><strong>${n1(myScore)}</strong></div>
        <em>${win ? "勝" : "負"}</em>
        <div class="side-score ${win ? "loss" : "win"}"><span class="label">${esc(teamName(mineA ? pair.b : pair.a))}</span><strong>${n1(oppScore)}</strong></div>
      </div>
      <div class="grid two" style="margin-top:12px">
        <div>${lines.map((line) => lineRow(line, boxes)).join("")}</div>
        <div>${oppLines.map((line) => lineRow(line, boxes)).join("")}</div>
      </div>
    </section>`;
}
function lineRow(line, boxes) {
  const box = line.id ? boxes[line.id] : null;
  const name = line.id ? DC.P(line.id).name : "空位";
  return `<div class="person"><div><b>${line.slot}</b> ${line.id ? `<button class="link" data-act="player" data-id="${line.id}">${esc(name)}</button>` : "空位"}<div class="sub">${box && box.g ? `${box.g}場 · ${box.pts}分 ${box.reb}籃 ${box.ast}助 ${box.stl}抄 ${box.blk}阻 ${box.tpm}顆三分` : "沒有出賽"}</div></div><b>${n1(line.fp)}</b></div>`;
}

function viewWire() {
  const me = DC.me();
  const free = DC.players.filter((p) => DC.P(p.id).own == null);
  return `
    <section class="panel">
      <div class="split"><h2>自由市場</h2><b>預算 $${me.faab} · 名單 ${me.roster.length}/13</b></div>
      <p class="muted">簽約立即生效，費用依球員即戰力計算。觀察名單會優先排在表格前面。</p>
      ${filters()}
      ${playerTable(sortPlayers(free.filter(passFilter)), false)}
    </section>`;
}

function viewTrade() {
  const state = DC.state;
  const me = DC.me();
  const ais = state.teams.filter((t) => !t.user);
  if (!ais.some((t) => t.id === session.partner)) session.partner = ais[0].id;
  const partner = DC.teamById(session.partner);
  const open = DC.canTrade();
  return `
    <div class="grid two">
      <section class="panel">
        <div class="split"><h2>提出交易</h2><span class="muted">${open ? `窗口開到第 12 週，現在是第 ${state.week} 週` : "交易窗口已關閉"}</span></div>
        ${state.phase === "season" && DC.canTrade() && state.offer && DC.offerValid() ? `<div class="panel"><b>對方提案</b><p>${esc(state.offer.note)}</p><div class="row"><button class="btn good" data-act="accept">接受</button><button class="btn" data-act="decline">拒絕</button></div></div>` : ""}
        <label class="field"><span>交易對象</span>
          <select data-act="partner">${ais.map((t) => `<option value="${t.id}" ${t.id === partner.id ? "selected" : ""}>${esc(t.name)} ${t.w}-${t.l}</option>`).join("")}</select>
        </label>
        <div class="grid two" style="margin-top:12px">
          <div><h3>你送出</h3>${me.roster.map((id) => tradeCheck("give", DC.P(id))).join("")}</div>
          <div><h3>你收到</h3>${partner.roster.map((id) => tradeCheck("get", DC.P(id))).join("")}</div>
        </div>
        ${tradeSummary()}
        <button class="btn primary" data-act="propose" ${open ? "" : "disabled"}>送出報價</button>
      </section>
      <aside class="panel">
        <h3>交易紀錄</h3>
        ${state.log.filter((item) => item.text.includes("換") || item.text.includes("釋") || item.text.includes("簽")).slice(0, 12).map((item) => `<div class="news-item"><b>W${item.week}</b>${esc(item.text)}</div>`).join("") || `<p class="muted">還沒有人員異動。</p>`}
      </aside>
    </div>`;
}
function tradeCheck(bucket, p) {
  const on = session[bucket].includes(p.id);
  return `<label class="check"><input type="checkbox" data-act="trade-check" data-bucket="${bucket}" data-id="${p.id}" ${on ? "checked" : ""}><span><b>${esc(p.name)}</b><br><span class="muted">${esc(p.pos)} · 價值 ${n1(DC.ros(p.id))} ${statusBits(p)}</span></span></label>`;
}
function tradeSummary() {
  const give = session.give.map((id) => DC.ros(id)).reduce((a, b) => a + b, 0);
  const get = session.get.map((id) => DC.ros(id)).reduce((a, b) => a + b, 0);
  const max = Math.max(give, get, 1);
  return `<div style="margin:12px 0"><div class="split"><span>送出 ${n1(give)}</span><span>收到 ${n1(get)}</span></div><div class="bar"><span style="width:${Math.round(get / max * 100)}%"></span></div></div>`;
}

function viewStand() {
  const rows = DC.standings();
  const powers = DC.state.teams.map((t) => ({ id: t.id, power: DC.power(t) })).sort((a, b) => b.power - a.power);
  return `
    <section class="panel">
      <h2>戰績榜</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>球隊</th><th class="num">勝</th><th class="num">負</th><th class="num">得分</th><th class="num">失分</th><th class="num">戰力序</th><th>近況</th></tr></thead>
        <tbody>
          ${rows.map((team, i) => `<tr class="${team.user ? "me" : ""}"><td>${i + 1}</td><td>${esc(team.name)}${team.user ? " · 你" : ""}</td><td class="num">${team.w}</td><td class="num">${team.l}</td><td class="num">${n1(team.pf)}</td><td class="num">${n1(team.pa)}</td><td class="num">${powers.findIndex((p) => p.id === team.id) + 1}</td><td>${team.weeks.slice(-5).map((w) => w.result).join(" ") || "—"}</td></tr>`).join("")}
        </tbody>
      </table></div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h3>你的賽程</h3>
      ${DC.me().weeks.map((w) => `<div class="person"><div>第 ${w.week} 週 vs ${esc(teamName(w.opp))}</div><b class="${w.result === "W" ? "good" : "warn"}">${w.result} ${n1(w.pf)}-${n1(w.pa)}</b></div>`).join("") || `<p class="muted">賽程會在每週模擬後出現。</p>`}
    </section>`;
}

function viewStats() {
  const started = DC.players.some((p) => DC.P(p.id).season.g > 0);
  const key = session.sort === "adp" || session.sort === "fp" ? "fp" : session.sort;
  const rows = DC.players.slice().sort((a, b) => {
    if (!started) return b.fppg - a.fppg;
    return DC.P(b.id).season[key] - DC.P(a.id).season[key];
  }).slice(0, 25);
  const awards = DC.state.awards;
  return `
    ${awards ? `<section class="panel" style="margin-bottom:16px"><h2>賽季獎項</h2><div class="grid three">
      ${awardCard("總冠軍", DC.teamById(awards.champ).name)}
      ${awardCard("夢幻積分王", DC.P(awards.mvp).name)}
      ${awardCard("22 歲以下新星", awards.young ? DC.P(awards.young).name : "—")}
      ${awardCard("得分王", DC.P(awards.pts).name)}
      ${awardCard("籃板王", DC.P(awards.reb).name)}
      ${awardCard("助攻王", DC.P(awards.ast).name)}
      ${awardCard("抄截王", DC.P(awards.stl).name)}
      ${awardCard("阻攻王", DC.P(awards.blk).name)}
      ${awardCard("你的名次", `第 ${awards.place}`)}
    </div></section>` : ""}
    <section class="panel">
      <div class="split"><h2>${started ? "模擬賽季累積榜" : "2025-26 真實場均能力"}</h2>
        <select data-act="stat-sort">
          ${[["fp", "夢幻積分"], ["pts", "得分"], ["reb", "籃板"], ["ast", "助攻"], ["stl", "抄截"], ["blk", "阻攻"], ["tpm", "三分"]].map(([id, label]) => `<option value="${id}" ${session.sort === id || (!started && id === "fp" && session.sort === "adp") ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>球員</th><th>球隊</th><th class="num">${started ? "場次" : "GP"}</th><th class="num">${started ? "積分" : "FP"}</th><th class="num">得分</th><th class="num">籃板</th><th class="num">助攻</th><th class="num">抄截</th><th class="num">阻攻</th></tr></thead>
        <tbody>${rows.map((base, i) => {
          const p = DC.P(base.id);
          const src = started ? p.season : null;
          return `<tr class="${p.own === 0 ? "me" : ""}"><td>${i + 1}</td><td><button class="link" data-act="player" data-id="${p.id}">${esc(p.name)}</button></td><td>${teamPill(p.team)}</td><td class="num">${src ? src.g : p.g}</td><td class="num">${src ? n1(src.fp) : n1(p.fppg)}</td><td class="num">${src ? src.pts : n1(p.pts)}</td><td class="num">${src ? src.reb : n1(p.reb)}</td><td class="num">${src ? src.ast : n1(p.ast)}</td><td class="num">${src ? src.stl : n1(p.stl)}</td><td class="num">${src ? src.blk : n1(p.blk)}</td></tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>
    <section class="panel" style="margin-top:16px">
      <h3>球員比較</h3>
      <div class="row">
        <select data-act="cmp" data-which="A">${compareOptions(session.cmpA)}</select>
        <select data-act="cmp" data-which="B">${compareOptions(session.cmpB)}</select>
      </div>
      <div class="compare" style="margin-top:12px">${compareCard(session.cmpA)}${compareCard(session.cmpB)}</div>
    </section>`;
}
function awardCard(label, name) { return `<div class="stat"><span>${label}</span><b style="font-size:18px">${esc(name)}</b></div>`; }
function compareOptions(selected) {
  return DC.players.slice(0, 80).map((p) => `<option value="${p.id}" ${p.id === selected ? "selected" : ""}>${esc(p.name)}</option>`).join("");
}
function compareCard(id) {
  const p = DC.P(id);
  const rows = [["場均積分", n1(p.fppg)], ["得分", n1(p.pts)], ["籃板", n1(p.reb)], ["助攻", n1(p.ast)], ["抄截", n1(p.stl)], ["阻攻", n1(p.blk)], ["三分", n1(p.tpm)], ["出勤", `${p.g} 場`], ["年齡", p.age]];
  return `<div class="panel"><h3>${esc(p.name)}</h3><p>${teamPill(p.team)} · ${esc(p.elig.join("/"))}</p>${rows.map(([k, v]) => `<div class="person"><span>${k}</span><b>${v}</b></div>`).join("")}</div>`;
}

function viewNews() {
  const hurt = DC.players.map(DC.P).filter((p) => p.status !== "OK");
  return `
    <div class="grid two">
      <section class="panel"><h2>聯盟新聞</h2>${DC.state.news.map((item) => `<div class="news-item"><b>W${item.week}</b>${esc(item.text)}</div>`).join("")}</section>
      <section class="panel"><h2>傷兵報告</h2>${hurt.map((p) => `<div class="person"><div><button class="link" data-act="player" data-id="${p.id}">${esc(p.name)}</button><div class="sub">${teamPill(p.team)} ${p.own == null ? "自由市場" : esc(teamName(p.own))}</div></div>${statusBits(p)}</div>`).join("") || `<p class="muted">目前沒有傷兵。</p>`}</section>
    </div>`;
}

function viewPlayoff() {
  const po = DC.state.playoff;
  if (!po) return `<section class="panel"><h2>季後賽</h2><p>前 6 名在第 16 週展開。前兩種子首輪輪空。</p></section>`;
  return `
    <section class="panel">
      <h2>季後賽對戰樹</h2>
      <div class="bracket">
        <div><h3>第一輪</h3>${byeCard(po.seeds[0])}${byeCard(po.seeds[1])}${seriesCard(po.qf[0])}${seriesCard(po.qf[1])}</div>
        <div><h3>四強</h3>${seriesCard(po.sf[0])}${seriesCard(po.sf[1])}</div>
        <div><h3>決賽</h3>${seriesCard(po.final)}<h3>季軍戰</h3>${seriesCard(po.third)}</div>
      </div>
      ${po.champ != null ? `<p>冠軍：<b>${esc(teamName(po.champ))}</b></p>` : ""}
    </section>`;
}
function byeCard(id) {
  return `<div class="series"><div class="side win"><b>#${DC.state.playoff.seeds.indexOf(id) + 1} ${esc(teamName(id))}</b><span>輪空</span></div></div>`;
}
function seriesCard(series) {
  if (!series || series.a == null) return `<div class="series"><div class="side"><span class="muted">待定</span></div></div>`;
  const seed = (id) => DC.state.playoff.seeds.indexOf(id) + 1;
  const side = (id, score) => `<div class="side ${series.winner === id ? "win" : ""}"><b>#${seed(id)} ${esc(teamName(id))}</b><span>${score == null ? "" : n1(score)}</span></div>`;
  return `<div class="series">${side(series.a, series.sa)}${series.b == null ? "" : side(series.b, series.sb)}</div>`;
}

function viewRules() {
  return `
    <section class="panel">
      <h2>怎麼玩</h2>
      <div class="grid three">
        <div><h3>選秀</h3><p>10 隊各選 13 人，蛇形順逆。缺陣球員可在選秀後自動進入傷兵名單。</p></div>
        <div><h3>每週對戰</h3><p>只有先發計分。各 NBA 球隊一週打 3 或 4 場，四場週略為疲勞，36 歲以上可能輪休。</p></div>
        <div><h3>陣容</h3><p>PG、SG、SF、PF、C、後衛、前鋒、兩個任意位置。板凳 4 人，傷兵名單 2 人且不占 13 人額。</p></div>
        <div><h3>計分</h3><p>得分 1、籃板 1.2、助攻 1.5、抄截 3、阻攻 3、三分命中 0.5、失誤 -1。單場雙十 +2，大三元再 +3。</p></div>
        <div><h3>市場與交易</h3><p>自由市場用簽約預算，開季 $100。和電腦主帥交易到第 12 週為止，對方會按需求與價值決定。</p></div>
        <div><h3>季後賽</h3><p>15 週後前 6 名晉級。第 1、2 種子首輪輪空，之後單週淘汰，敗部分別打季軍戰。</p></div>
      </div>
      <hr class="sep">
      <p class="muted">能力值取自 2025-26 NBA 正規賽場均，並用隨機手感、傷病和出賽數模擬 2026-27 的 18 週縮短賽程。這是休閒遊戲，不是官方 Fantasy 產品，也不代表尚未發生的真實賽季。</p>
      <div class="row"><button class="btn" data-act="export">匯出存檔</button><button class="btn danger" data-act="reset">清除這季</button></div>
    </section>`;
}

function filters() {
  const poss = ["ALL", "PG", "SG", "SF", "PF", "C"];
  return `
    <div class="row" style="margin:10px 0">
      <input id="q" type="search" placeholder="搜尋球員或球隊" value="${esc(session.q)}">
      ${poss.map((pos) => `<button class="chip ${session.pos === pos ? "active" : ""}" data-act="pos" data-pos="${pos}">${pos === "ALL" ? "全部" : pos}</button>`).join("")}
      <select data-act="sort">
        ${[["adp", "預估順位"], ["fp", "場均積分"], ["pts", "得分"], ["reb", "籃板"], ["ast", "助攻"], ["stl", "抄截"], ["blk", "阻攻"], ["tpm", "三分"], ["last", "上週"]].map(([id, label]) => `<option value="${id}" ${session.sort === id ? "selected" : ""}>${label}</option>`).join("")}
      </select>
      <select data-act="team-filter">
        <option value="ALL">所有球隊</option>
        ${Object.entries(DC.teamMeta).map(([code, info]) => `<option value="${code}" ${session.team === code ? "selected" : ""}>${info.name}</option>`).join("")}
      </select>
    </div>`;
}

function availablePlayers() {
  return sortPlayers(DC.players.filter((p) => DC.P(p.id).own == null && passFilter(p)));
}
function passFilter(p) {
  if (session.pos !== "ALL" && p.pos !== session.pos && !p.elig.includes(session.pos)) return false;
  if (session.team !== "ALL" && p.team !== session.team) return false;
  const q = session.q.trim().toLowerCase();
  if (!q) return true;
  return p.name.toLowerCase().includes(q) || DC.teamMeta[p.team].name.includes(session.q.trim()) || p.team.toLowerCase().includes(q);
}
function sortPlayers(list) {
  const watched = new Set(DC.state.watch || []);
  const week = DC.state.week || 1;
  return list.slice().sort((a, b) => {
    const aw = watched.has(a.id) ? 1 : 0;
    const bw = watched.has(b.id) ? 1 : 0;
    if (aw !== bw) return bw - aw;
    if (session.sort === "adp") return a.id - b.id;
    if (session.sort === "fp") return b.fppg - a.fppg;
    if (session.sort === "last") return (DC.P(b.id).recent.slice(-1)[0] || 0) - (DC.P(a.id).recent.slice(-1)[0] || 0);
    if (session.sort === "proj") return DC.project(DC.P(b.id), week) - DC.project(DC.P(a.id), week);
    return (b[session.sort] || 0) - (a[session.sort] || 0);
  });
}
function playerTable(list, drafting) {
  const clock = DC.onClock();
  return `<div class="table-wrap"><table>
    <thead><tr><th>順位</th><th>球員</th><th>球隊</th><th>位置</th><th class="num">積分</th><th class="num">分</th><th class="num">籃</th><th class="num">助</th><th class="num">抄</th><th class="num">阻</th><th class="num">三分</th><th class="num">出勤</th><th></th></tr></thead>
    <tbody>${list.map((base) => {
      const p = DC.P(base.id);
      const action = drafting
        ? (clock === 0 ? `<button class="btn primary" data-act="draft" data-id="${p.id}">選他</button>` : "")
        : `<button class="btn" data-act="add" data-id="${p.id}" ${DC.me().faab < DC.priceOf(p.id) ? "disabled" : ""}>$${DC.priceOf(p.id)} 簽下</button>`;
      return `<tr><td>${p.id}</td><td><button class="link" data-act="player" data-id="${p.id}">${esc(p.name)}</button><div class="sub">${tags(p)} ${statusBits(p)} ${DC.state.watch.includes(p.id) ? "★" : ""}</div></td><td>${teamPill(p.team)}</td><td>${esc(p.elig.join("/"))}</td><td class="num">${n1(p.fppg)}</td><td class="num">${n1(p.pts)}</td><td class="num">${n1(p.reb)}</td><td class="num">${n1(p.ast)}</td><td class="num">${n1(p.stl)}</td><td class="num">${n1(p.blk)}</td><td class="num">${n1(p.tpm)}</td><td class="num">${p.g}</td><td>${action}</td></tr>`;
    }).join("")}</tbody>
  </table></div>`;
}

function hotLines(week) {
  const res = DC.state.results[week];
  if (!res) return [];
  return Object.entries(res.boxes)
    .map(([id, box]) => ({ id: Number(id), box }))
    .filter((row) => row.box.g > 0)
    .sort((a, b) => b.box.fp - a.box.fp)
    .slice(0, 5);
}

function modal(id) {
  const p = DC.P(id);
  const owner = p.own == null ? "自由市場" : teamName(p.own);
  const games = DC.gamesFor(p.id);
  const recent = (p.recent || []).slice(-5);
  return `
    <div class="modal-back" data-act="close">
      <div class="panel modal" data-act="stop">
        <div class="split"><h2>${esc(p.name)}</h2><button class="btn" data-act="close">關閉</button></div>
        <p>${teamPill(p.team)} · ${esc(p.elig.join("/"))} · ${p.age} 歲 · ${esc(owner)}</p>
        <p>${tags(p)} ${statusBits(p)}</p>
        <div class="grid cards">
          ${[["FP", n1(p.fppg)], ["PPG", n1(p.pts)], ["RPG", n1(p.reb)], ["APG", n1(p.ast)], ["SPG", n1(p.stl)], ["BPG", n1(p.blk)], ["3PM", n1(p.tpm)], ["TOV", n1(p.tov)]].map(([k, v]) => `<div class="stat"><span>${k}</span><b style="font-size:20px">${v}</b></div>`).join("")}
        </div>
        <p class="muted">2025-26：${p.g} 場，${n1(p.mpg)} 分鐘，投籃 ${pct(p.fgp)}，三分 ${pct(p.tpp)}，罰球 ${pct(p.ftp)}。${games ? `本週 ${p.team} 打 ${games} 場。` : ""}模擬累積 ${p.season.g} 場、${n1(p.season.fp)} 積分。</p>
        ${recent.length ? `<div class="pills">${recent.map((n) => `<i>${n1(n)}</i>`).join("")}</div>` : ""}
        <div class="row" style="margin-top:12px">
          <button class="btn" data-act="watch" data-id="${p.id}">${DC.state.watch.includes(p.id) ? "取消觀察" : "加入觀察"}</button>
          ${DC.state.phase === "draft" && DC.onClock() === 0 && p.own == null ? `<button class="btn primary" data-act="draft" data-id="${p.id}">選他</button>` : ""}
          ${DC.canSign() && p.own == null ? `<button class="btn primary" data-act="add" data-id="${p.id}">$${DC.priceOf(p.id)} 簽下</button>` : ""}
          ${p.own === 0 ? `<button class="btn danger" data-act="drop" data-id="${p.id}">釋出</button>` : ""}
        </div>
      </div>
    </div>`;
}

function dropModal(addId) {
  const p = DC.P(addId);
  return `
    <div class="modal-back" data-act="cancel-add">
      <div class="panel modal" data-act="stop">
        <h2>釋出誰來換 ${esc(p.name)}？</h2>
        <p class="muted">簽約金 $${DC.priceOf(addId)}。傷兵名單的人不在這裡，要先啟用或另外釋出。</p>
        ${DC.me().roster.map((id) => `<div class="person"><button class="link" data-act="player" data-id="${id}">${esc(DC.P(id).name)}</button><button class="btn danger" data-act="confirm-add" data-add="${addId}" data-drop="${id}">釋出並簽下</button></div>`).join("")}
        <button class="btn" data-act="cancel-add">取消</button>
      </div>
    </div>`;
}

function render() {
  const prev = document.activeElement;
  const prevId = prev && prev.id;
  const start = prev && prev.selectionStart;
  const end = prev && prev.selectionEnd;
  const y = keepScroll ? window.scrollY : 0;
  let html = "";
  try {
    html = DC.state ? page() : setupScreen();
  } catch (err) {
    html = `<pre style="color:#fff;padding:24px;white-space:pre-wrap">${esc(err && err.stack ? err.stack : err)}</pre>`;
  }
  document.getElementById("app").innerHTML = html;
  window.scrollTo(0, keepScroll ? y : 0);
  keepScroll = true;
  if (prevId) {
    const el = document.getElementById(prevId);
    if (el) {
      el.focus();
      if (start != null && el.setSelectionRange) el.setSelectionRange(start, end);
    }
  }
}

function go(tab) {
  if (!DC.state) return;
  DC.state.tab = tab;
  session.modal = null;
  session.pendingAdd = null;
  keepScroll = false;
  DC.save();
  render();
}

function handle(result) {
  if (!result) return;
  if (result.message) notify(result.message);
  else if (result.notes && result.notes.length) notify(result.notes.join(" "));
  else render();
}

function onClick(event) {
  const button = event.target.closest("[data-act]");
  if (!button) return;
  const act = button.dataset.act;
  if (act === "stop") { event.stopPropagation(); return; }
  if (act === "color") {
    document.querySelectorAll(".swatch").forEach((el) => el.classList.toggle("active", el === button));
    return;
  }
  if (act === "nav") { go(button.dataset.tab); return; }
  if (act === "close" || act === "cancel-add") { session.modal = null; session.pendingAdd = null; render(); return; }
  if (act === "player") { session.modal = Number(button.dataset.id); render(); return; }
  if (act === "pos") { session.pos = button.dataset.pos; render(); return; }
  if (act === "import-click") { document.getElementById("import").click(); return; }
  if (act === "reset") {
    if (window.confirm("要清除這一季並重來嗎？")) { DC.reset(); session.modal = null; keepScroll = false; render(); }
    return;
  }
  if (act === "export") {
    const blob = new Blob([DC.exportState()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dream-court-save.json"; a.click();
    URL.revokeObjectURL(url);
    return;
  }
  if (!DC.state) return;
  if (act === "draft") { session.modal = null; handle(DC.draft(button.dataset.id)); return; }
  if (act === "until") { handle(DC.autoUntil()); return; }
  if (act === "rest") {
    if (window.confirm("剩下的選秀都交給電腦，包含你的順位？")) handle(DC.autoRest());
    return;
  }
  if (act === "optimize") { DC.optimizeTeam(0, DC.state.week); notify("已排入本週預估最高的先發。"); return; }
  if (act === "insert") { handle(DC.insertPlayer(button.dataset.id)); return; }
  if (act === "il") { handle(DC.moveIL(button.dataset.id)); return; }
  if (act === "activate") { handle(DC.activate(button.dataset.id)); return; }
  if (act === "drop") {
    if (window.confirm("確定釋出這名球員？")) { session.modal = null; handle(DC.drop(button.dataset.id)); }
    return;
  }
  if (act === "add") {
    const id = Number(button.dataset.id);
    if (DC.me().roster.length >= 13) { session.modal = null; session.pendingAdd = id; render(); return; }
    session.modal = null;
    handle(DC.signPlayer(id));
    return;
  }
  if (act === "confirm-add") {
    const result = DC.signPlayer(button.dataset.add, button.dataset.drop);
    session.pendingAdd = null;
    session.modal = null;
    handle(result);
    return;
  }
  if (act === "watch") { DC.toggleWatch(button.dataset.id); render(); return; }
  if (act === "sim") {
    const result = DC.simWeek();
    keepScroll = false;
    if (result.ok) notify(result.notes && result.notes.length ? result.notes.join(" ") : "這一週已經打完。");
    else notify(result.message);
    return;
  }
  if (act === "propose") {
    const result = DC.propose(session.partner, session.give, session.get);
    if (result && result.accepted) { session.give = []; session.get = []; }
    handle(result);
    return;
  }
  if (act === "accept") { session.give = []; session.get = []; handle(DC.acceptOffer()); return; }
  if (act === "decline") { handle(DC.declineOffer()); return; }
}

function onChange(event) {
  const el = event.target;
  if (el.dataset.act === "set-lineup") { handle(DC.setLineup(el.dataset.slot, el.value)); return; }
  if (el.dataset.act === "partner") { session.partner = Number(el.value); session.get = []; render(); return; }
  if (el.dataset.act === "sort" || el.dataset.act === "stat-sort") { session.sort = el.value; render(); return; }
  if (el.dataset.act === "team-filter") { session.team = el.value; render(); return; }
  if (el.dataset.act === "cmp") { session[el.dataset.which === "A" ? "cmpA" : "cmpB"] = Number(el.value); render(); return; }
  if (el.dataset.act === "trade-check") {
    const id = Number(el.dataset.id);
    const bucket = session[el.dataset.bucket];
    const idx = bucket.indexOf(id);
    if (idx >= 0) bucket.splice(idx, 1);
    else if (bucket.length < 2) bucket.push(id);
    render();
    return;
  }
  if (el.id === "import" && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      try { DC.importState(reader.result); notify("已讀取存檔。"); }
      catch (err) { notify("這個檔案不是夢幻球場的存檔。"); }
    };
    reader.readAsText(el.files[0]);
  }
}

function onInput(event) {
  if (event.target.id === "q") {
    session.q = event.target.value;
    render();
  }
}

function onSubmit(event) {
  if (event.target.id !== "setup") return;
  event.preventDefault();
  const color = document.querySelector(".swatch.active");
  DC.newGame(
    document.getElementById("manager").value,
    document.getElementById("slot").value,
    color ? color.dataset.color : "#7c5cff"
  );
  keepScroll = false;
  render();
}

document.body.addEventListener("click", onClick);
document.body.addEventListener("change", onChange);
document.body.addEventListener("input", onInput);
document.body.addEventListener("submit", onSubmit);
DC.load();
render();
