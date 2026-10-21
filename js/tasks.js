/* Alvor · Your own garden tasks, next to Alvor's: buy compost, plant bulbs, clean the greenhouse.
   Kept in state.settings.tasks (the rules are in alerts.js: due day, repeating, ticking off), merged task by task
   between phones (sync.js). Due ones join Garden today and the morning notification; a task can be about plants,
   and ticking it off then adds a line to their journals.
   Plain script (no build step): loaded by index.html in a fixed order and sharing one global scope. */
"use strict";
const TASK_ICON = SV('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.3l2.4 2.4 4.8-5.2"/>');
const REP_TEXT = {"":tr("Doesn't repeat"), week:tr("Every week"), "2weeks":tr("Every 2 weeks"), month:tr("Every month"), year:tr("Every year")};
const REP_SHORT = {week:tr("every week"), "2weeks":tr("every 2 weeks"), month:tr("every month"), year:tr("every year")};
const myTasks = () => GA.taskList(state.settings);
const taskById = id => myTasks().find(x => x.id === id);
/* A change to one task: the newer change wins when phones merge (sync.js), so m always moves forward. */
function putTask(x){
  const old = (state.settings.tasks || []).find(t => t.id === x.id);
  x.m = Math.max(Date.now(), old ? (+old.m || 0) + 1 : 0);
  state.settings.tasks = GS.mergeEntries(state.settings.tasks, [x], Date.now());
}
function deleteTask(id){ putTask({id, del:1}); }

/* "Today", "2 days late", "Sat 18 Oct", "Some day" */
function taskWhen(x){
  const st = GA.taskState(x, today());
  if(st.stage === "done") return tr("Done {date}", {date:jDate(x.done, false)});
  if(st.stage === "someday") return tr("Some day");
  if(st.stage === "overdue") return trn(-st.days, "1 day late", "{n} days late");
  if(st.stage === "today") return tr("Today");
  if(st.days === 1) return tr("Tomorrow");
  const d = parseDay(x.d);
  return st.days <= 7 ? cap(d.toLocaleDateString(LOCALE, {weekday:"short", day:"numeric", month:"short"}))
    : d.toLocaleDateString(LOCALE, d.getFullYear() === new Date().getFullYear() ? {day:"numeric", month:"short"} : {day:"numeric", month:"short", year:"numeric"});
}
const taskPlants = x => (x.ids || []).map(plantById).filter(Boolean);
function taskRow(x, opt){
  const st = GA.taskState(x, today()), done = st.stage === "done";
  const names = taskPlants(x).map(p => p.name);
  const meta = [taskWhen(x), REP_SHORT[x.rep], names.length ? names.join(", ") : ""].filter(Boolean).join(" · ");
  return `<div class="tk-row s-${st.stage}">
    <button type="button" class="tk-check" data-task="toggle" data-id="${esc(x.id)}" aria-pressed="${done}" aria-label="${done ? tr("Not done yet: {t}", {t:esc(x.t)}) : tr("Done: {t}", {t:esc(x.t)})}">${ICON.check}</button>
    <button type="button" class="tk-main" data-task="edit" data-id="${esc(x.id)}"><b>${esc(x.t)}</b><small>${esc(meta)}</small>${opt && opt.note && x.n ? `<span class="tk-note">${esc(x.n)}</span>` : ""}</button>
  </div>`;
}
/* On Home, under Garden today: what's due and the next few days. A garden without tasks gets a quiet button. */
function tasksCardHtml(){
  const list = myTasks(), T = today();
  if(!list.length) return `<button class="tk-start" data-task="new">${ICON.plus}<span>${tr("Add your own task: buy compost, plant bulbs…")}</span></button>`;
  const open = list.filter(x => GA.taskState(x, T).stage !== "done");
  const near = open.filter(x => ["overdue", "today", "soon"].includes(GA.taskState(x, T).stage)).sort(byDue);
  const next = open.filter(x => GA.taskState(x, T).stage === "later").sort(byDue)[0];
  const due = near.filter(x => GA.taskState(x, T).days <= 0).length;
  return `<div class="acard tk-card ${due ? "has-due" : ""}">
    <div class="a-ic">${TASK_ICON}</div>
    <div class="a-main"><span class="a-lab">${tr("Your tasks")}</span>
      <h3>${due ? trn(due, "1 for today", "{n} for today") : near.length ? tr("Coming up this week") : tr("Nothing due this week")}</h3>
      ${near.length ? `<div class="tk-list">${near.slice(0, 5).map(x => taskRow(x)).join("")}</div>` : ""}
      ${!near.length && next ? `<p class="a-lead">${tr("Next: {t}, {when}", {t:esc(next.t), when:esc(taskWhen(next))})}</p>` : ""}
      <div class="tk-acts"><button class="btn small primary" data-task="new">${ICON.plus}${tr("Add a task")}</button><button class="btn small" data-task="all">${tr("All tasks")}${open.length ? ` · ${open.length}` : ""}</button></div>
    </div></div>`;
}
const byDue = (a, b) => (a.d || "9999") < (b.d || "9999") ? -1 : (a.d || "9999") > (b.d || "9999") ? 1 : a.t.localeCompare(b.t);

/* Ticking a task off. A repeating task moves on to its next day; a task about plants adds a line to their journals. */
function toggleTask(id){
  const x = taskById(id); if(!x) return;
  const st = GA.taskState(x, today());
  if(st.stage === "done"){ const y = {...x}; delete y.done; putTask(y); save(); refreshTasks(); return; }
  putTask({...x, ...GA.completeTask(x, today())});
  taskPlants(x).forEach(p => { if(!jEntries(p).some(e => e.task === x.id && e.d === today())) jPut(p, {id:uid(), d:today(), k:"note", n:x.t, task:x.id}); });
  save(); refreshTasks(); refreshJournal();
  toast(GA.TASK_REP[x.rep] ? tr("Done. Next time: {when}", {when:taskWhen(taskById(id))}) : tr("Done"));
}

/* ---------- The tasks dialog: the whole list, and adding or changing one ---------- */
const taskDlg = $("#taskDlg");
let TK = null;   // {mode:"list"|"form", f:{…the task being written}, showDone, plantFilter}
function openTasks(opt){
  TK = {mode:"list", showDone:false, ...(opt || {})};
  if(TK.mode === "form") TK.f = TK.f || blankTask();
  renderTasks(); if(!taskDlg.open) taskDlg.showModal();
  $("#taskBody").scrollTop = 0;
}
const blankTask = extra => ({id:null, t:"", d:"", rep:"", ids:[], n:"", ...(extra || {})});
/* Ideas for this month (hemisphere-adjusted), so the list never starts empty. */
const TASK_IDEAS = {
  1:[tr("Check stored dahlia and canna tubers"), tr("Order seeds for spring"), tr("Clean and sharpen the tools")],
  2:[tr("Buy compost for spring"), tr("Sow chillies and peppers indoors"), tr("Prune roses")],
  3:[tr("Sow tomatoes indoors"), tr("Clean the greenhouse"), tr("Divide crowded perennials")],
  4:[tr("Start hardening off seedlings"), tr("Put out slug protection"), tr("Check pots for vine weevil")],
  5:[tr("Plant out tender plants after the last frost"), tr("Stake tall plants"), tr("Start feeding plants in pots")],
  6:[tr("Deadhead flowers"), tr("Take softwood cuttings"), tr("Water pots early on hot days")],
  7:[tr("Collect rainwater"), tr("Ask a friend to water while you're away"), tr("Deadhead flowers")],
  8:[tr("Take cuttings of tender plants"), tr("Order spring bulbs"), tr("Save seeds")],
  9:[tr("Plant spring bulbs"), tr("Clean the greenhouse before winter"), tr("Check the frost fleece")],
  10:[tr("Plant spring bulbs"), tr("Check the frost fleece"), tr("Lift dahlias and cannas after the first frost")],
  11:[tr("Mulch tender roots"), tr("Wrap tree ferns and bananas"), tr("Clean and store empty pots")],
  12:[tr("Check plants under fleece"), tr("Water indoor plants less"), tr("Plan next year's garden")]
};
const ideasNow = () => (TASK_IDEAS[GA.seasonMonth(new Date().getMonth() + 1, state.settings)] || []).filter(t => !myTasks().some(x => x.t === t && GA.taskState(x, today()).stage !== "done"));
function renderTasks(){
  if(!TK) return;
  const body = $("#taskBody"), foot = $("#taskFoot");
  if(TK.mode === "form") return renderTaskForm();
  $("#taskTitle").textContent = tr("Your tasks");
  foot.hidden = true;
  const T = today(), list = myTasks(), by = {};
  list.forEach(x => (by[GA.taskState(x, T).stage] ||= []).push(x));
  const sec = (k, title) => by[k] && by[k].length ? `<h3 class="pick-h">${title}</h3><div class="tk-list">${by[k].sort(byDue).map(x => taskRow(x, {note:true})).join("")}</div>` : "";
  const recentDone = (by.done || []).filter(x => daysBetween(x.done, T) <= 30).sort((a, b) => a.done < b.done ? 1 : -1);
  const ideas = ideasNow();
  body.innerHTML = `<p class="status" style="margin-top:0">${tr("Your own jobs next to Alvor's. Those due today join Garden today and the morning notification.")}</p>
    <div class="jr-acts"><button type="button" class="btn small primary" data-task="new">${ICON.plus}${tr("Add a task")}</button></div>
    ${sec("overdue", tr("Late"))}${sec("today", tr("Today"))}${sec("soon", tr("This week"))}${sec("later", tr("Later"))}${sec("someday", tr("Some day"))}
    ${!list.filter(x => GA.taskState(x, T).stage !== "done").length ? `<p class="status jr-empty">${tr("No tasks yet.")}</p>` : ""}
    ${ideas.length ? `<h3 class="pick-h">${tr("Ideas for {month}", {month:GA.monthName(new Date().getMonth() + 1)})}</h3><div class="tk-ideas">${ideas.map(t => `<button type="button" class="chip" data-task="idea" data-t="${esc(t)}">${ICON.plus}${esc(t)}</button>`).join("")}</div>` : ""}
    ${recentDone.length ? `<details class="tk-done" ${TK.showDone ? "open" : ""}><summary>${tr("Done lately ({n})", {n:recentDone.length})}</summary><div class="tk-list">${recentDone.map(x => taskRow(x)).join("")}</div></details>` : ""}`;
  const d = body.querySelector(".tk-done"); if(d) d.addEventListener("toggle", () => { TK.showDone = d.open; });
}
/* Quick days: today, tomorrow, the weekend, next week, in a month, or some day. */
function quickDays(){
  const t = today(), wd = parseDay(t).getDay();
  const sat = wd === 6 || wd === 0 ? t : GA.addDays(t, 6 - wd), mon = GA.addDays(t, ((8 - wd) % 7) || 7);
  return [["today", tr("Today"), t], ["tomorrow", tr("Tomorrow"), GA.addDays(t, 1)], ["weekend", tr("This weekend"), sat],
    ["week", tr("Next week"), mon], ["month", tr("In a month"), GA.addMonths(t, 1)], ["some", tr("Some day"), ""]];
}
function renderTaskForm(){
  const F = TK.f, body = $("#taskBody"), foot = $("#taskFoot");
  $("#taskTitle").textContent = F.id ? tr("Task") : tr("New task");
  foot.hidden = false; $("#taskDel").hidden = !F.id;
  const plants = [...state.plants].sort((a, b) => a.name.localeCompare(b.name));
  const q = (TK.plantQ || "").toLowerCase(), shown = plants.filter(p => F.ids.includes(p.id) || !q || p.name.toLowerCase().includes(q)).slice(0, q ? 40 : 24);
  body.innerHTML = `<div class="field"><label for="tkT">${tr("What")}</label><input id="tkT" maxlength="120" value="${esc(F.t)}" placeholder="${tr("e.g. Buy compost")}"></div>
    <div class="field"><label>${tr("When")}</label>
      <div class="chips tk-days">${quickDays().map(([k, label, d]) => `<button type="button" class="chip" data-tkday="${d}" aria-pressed="${F.d === d}">${label}</button>`).join("")}</div>
      <input id="tkD" type="date" value="${esc(F.d)}" aria-label="${tr("Day")}"></div>
    <div class="field"><label for="tkRep">${tr("Repeats")}</label><select id="tkRep">${Object.entries(REP_TEXT).map(([k, l]) => `<option value="${k}"${(F.rep || "") === k ? " selected" : ""}>${l}</option>`).join("")}</select>
      <span class="hint" id="tkRepHint">${F.rep && !F.d ? tr("A repeating task starts today unless you pick a day.") : ""}</span></div>
    ${plants.length ? `<div class="field"><label>${tr("About these plants")} <span class="status">${tr("(optional)")}</span></label>
      ${plants.length > 12 ? `<input id="tkPQ" type="search" placeholder="${tr("Search plants")}" value="${esc(TK.plantQ || "")}" style="margin-bottom:8px">` : ""}
      <div class="chips tk-plants">${shown.map(p => `<button type="button" class="chip" data-tkp="${p.id}" aria-pressed="${F.ids.includes(p.id)}">${esc(p.name)}</button>`).join("")}</div>
      <span class="hint">${tr("When you tick it off, it's noted in their journals.")}</span></div>` : ""}
    <div class="field"><label for="tkN">${tr("Note")}</label><textarea id="tkN" rows="2" maxlength="500">${esc(F.n)}</textarea></div>`;
  $("#tkT").addEventListener("input", e => { F.t = e.target.value; });
  $("#tkD").addEventListener("change", e => { F.d = e.target.value; renderTaskForm(); });
  $("#tkRep").addEventListener("change", e => { F.rep = e.target.value; $("#tkRepHint").textContent = F.rep && !F.d ? tr("A repeating task starts today unless you pick a day.") : ""; });
  $("#tkN").addEventListener("input", e => { F.n = e.target.value; });
  const pq = $("#tkPQ"); if(pq) pq.addEventListener("input", e => { TK.plantQ = e.target.value; const pos = e.target.selectionStart; renderTaskForm(); const n = $("#tkPQ"); n.focus(); n.setSelectionRange(pos, pos); });
  if(!F.id && !F.t) setTimeout(() => { const i = $("#tkT"); if(i && document.activeElement !== $("#tkPQ")) i.focus(); }, 60);
}
$("#taskBody").addEventListener("click", e => {
  const day = e.target.closest("[data-tkday]"), pl = e.target.closest("[data-tkp]");
  if(day && TK && TK.f){ TK.f.d = day.dataset.tkday; renderTaskForm(); return; }
  if(pl && TK && TK.f){ const id = pl.dataset.tkp, ids = TK.f.ids; TK.f.ids = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]; pl.setAttribute("aria-pressed", TK.f.ids.includes(id)); }
});
$("#taskSave").addEventListener("click", () => {
  const F = TK && TK.f; if(!F) return;
  const t = F.t.trim();
  if(!t){ toast(tr("Say what the task is")); $("#tkT").focus(); return; }
  const old = F.id && taskById(F.id), d = F.d || (F.rep ? today() : "");
  const x = {...(old || {}), id:F.id || uid(), t:t.slice(0, 120), ids:F.ids.filter(id => plantById(id))};
  if(d) x.d = d; else delete x.d;
  if(F.rep && GA.TASK_REP[F.rep]){ x.rep = F.rep; if(GA.TASK_REP[F.rep][1] === "m") x.a = +d.slice(8, 10); else delete x.a; } else { delete x.rep; delete x.a; delete x.last; }
  if(F.n.trim()) x.n = F.n.trim().slice(0, 500); else delete x.n;
  if(!x.ids.length) delete x.ids;
  if(old && (old.d !== x.d || old.rep !== x.rep)) delete x.done;   // a new day: not done any more
  putTask(x); save();
  const back = TK.back;
  if(back === "home"){ taskDlg.close(); TK = null; } else { TK.mode = "list"; TK.f = null; }
  refreshTasks(); toast(old ? tr("Saved") : tr("Task added"));
});
$("#taskDel").addEventListener("click", () => {
  const F = TK && TK.f; if(!F || !F.id) return;
  if(!confirm(tr("Delete this task?"))) return;
  deleteTask(F.id); save();
  if(TK.back === "home"){ taskDlg.close(); TK = null; } else { TK.mode = "list"; TK.f = null; }
  refreshTasks(); toast(tr("Deleted"));
});
$("#taskCancel").addEventListener("click", () => {
  if(!TK) return;
  if(TK.back === "home"){ taskDlg.close(); TK = null; return; }
  TK.mode = "list"; TK.f = null; renderTasks();
});
$("#taskClose").addEventListener("click", () => { taskDlg.close(); TK = null; });
function refreshTasks(){
  if(taskDlg.open) renderTasks();
  render();
  if(dlg.open && editingId) renderPlantTasks();
}
/* Buttons anywhere: Home's card, the dialog, the plant sheet */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-task]"); if(!b) return;
  const a = b.dataset.task, inDlg = taskDlg.open;
  if(a === "toggle") toggleTask(b.dataset.id);
  else if(a === "all") openTasks();
  else if(a === "new") openTasks({mode:"form", f:blankTask(b.dataset.plant ? {ids:[b.dataset.plant]} : {}), back:inDlg ? "list" : "home"});
  else if(a === "idea") openTasks({mode:"form", f:blankTask({t:b.dataset.t}), back:"list"});
  else if(a === "edit"){ const x = taskById(b.dataset.id); if(x) openTasks({mode:"form", f:blankTask({...x, d:x.d || "", rep:x.rep || "", ids:[...(x.ids || [])], n:x.n || ""}), back:inDlg ? "list" : "home"}); }
});

/* ---------- In the plant sheet: its tasks ---------- */
function renderPlantTasks(){
  const p = editingId && plantById(editingId), box = $("#taskBox");
  if(!box) return;
  if(!p || p.archived){ box.hidden = true; return; }
  const list = myTasks().filter(x => (x.ids || []).includes(p.id) && GA.taskState(x, today()).stage !== "done").sort(byDue);
  box.hidden = !list.length;   // only when there are tasks for it (a task for a plant is added from the tasks list)
  $("#plantTasks").innerHTML = (list.length ? `<div class="tk-list">${list.map(x => taskRow(x)).join("")}</div>` : `<p class="status" style="margin:0">${tr("Prune it in March, check it for pests… Your own reminders for this plant.")}</p>`) +
    `<div class="jr-acts"><button type="button" class="btn small" data-task="new" data-plant="${p.id}">${ICON.plus}${tr("Add a task")}</button></div>`;
}
