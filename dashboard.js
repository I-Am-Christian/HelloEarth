import { db, requireUser, statusMessage } from "./supabase-client.js";

const $ = id => document.getElementById(id);
const tr = (key, values = {}) => window.HelloEarthI18n?.t(key, values) ?? key.replace(/\{([^}]+)\}/g, (_, field) => String(values[field] ?? ""));
const state = { user: null, students: [], selected: null, notes: [], editMode: false, lastFocus: null };

function arrayLines(id) {
  const values = $(id).value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (values.length > 12) throw new Error("Use at most 12 items per list.");
  if (values.some(value => value.length > 180)) throw new Error("Each list item must be 180 characters or fewer.");
  return values;
}
function initials(name) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0].toUpperCase()).join("");
}
function labelledField(label, content) {
  const div = document.createElement("div");
  div.className = "ws-field";
  const title = document.createElement("strong");
  title.textContent = label;
  const text = document.createElement("span");
  text.textContent = content || "Not recorded";
  if (content && content !== "Not assessed yet") text.classList.add("i18n-user-content");
  div.append(title, text);
  return div;
}
function loadingMessage(message, isError = false) {
  statusMessage($("dashboard-feedback"), message, isError);
}
function message(err) {
  const m = String(err?.message || err || "Something went wrong.");
  if (/row.level.security|permission.denied/i.test(m)) return "Your account cannot access this record. Please sign in again.";
  return m.length > 190 ? "Request failed. Please try again." : m;
}
function setBusy(id, busy) {
  $(id).disabled = busy;
}
function showModal(id) {
  state.lastFocus = document.activeElement;
  $(id).hidden = false;
  $(id).querySelector("input,textarea,select,button")?.focus();
}
function hideModal(id) {
  $(id).hidden = true;
  if (state.lastFocus?.focus) state.lastFocus.focus();
}
function bindModal(id, closeId) {
  $(closeId).addEventListener("click", () => hideModal(id));
  $(id).addEventListener("click", event => {
    if (event.target === $(id)) hideModal(id);
  });
}
bindModal("student-modal", "modal-close");
bindModal("note-modal", "note-close");
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!$("note-modal").hidden) hideModal("note-modal");
    else if (!$("student-modal").hidden) hideModal("student-modal");
  }
});

async function loadPlan() {
  const label = $("plan-label");
  const capacity = $("plan-capacity");
  if (!label || !capacity || !state.user) return;
  try {
    const { data: entitlement, error: entitlementError } = await db
      .from("helloearth_subscriptions")
      .select("plan_code,status,current_period_end,is_internal")
      .eq("tutor_id", state.user.id)
      .maybeSingle();
    if (entitlementError) throw entitlementError;
    if (entitlement?.is_internal === true && entitlement.status === "active") {
      label.textContent = "Founder workspace";
      capacity.textContent = "Internal testing access · your student profiles are preserved.";
      return;
    }
    const activePaid = entitlement?.status === "active"
      && entitlement.plan_code !== "free"
      && Boolean(entitlement.current_period_end)
      && Date.parse(entitlement.current_period_end) > Date.now();
    const code = activePaid ? entitlement.plan_code : "free";
    const { data: plan, error: planError } = await db.from("helloearth_plans")
      .select("name,max_students,max_notes_total,max_notes_monthly")
      .eq("code", code).single();
    if (planError) throw planError;
    label.textContent = tr("{plan} plan", {plan:tr(plan.name)});
    capacity.textContent = tr("{used} of {limit} students · up to {notes} new notes a month", {used:state.students.length,limit:plan.max_students,notes:plan.max_notes_monthly});
  } catch (_) {
    label.textContent = "Subscription status unavailable";
    capacity.textContent = "Your records are still private. Try refreshing.";
  }
}

function renderStudents() {
  const grid = $("student-grid");
  grid.replaceChildren();
  const q = $("student-search").value.trim().toLowerCase();
  const visible = state.students.filter(student => [
    student.display_name, student.cefr_level, ...(student.learning_goals || []), ...(student.interests || [])
  ].join(" ").toLowerCase().includes(q));
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "ws-empty";
    const strong = document.createElement("strong");
    strong.textContent = state.students.length ? "No matching students" : "Your new workspace awaits ✨";
    const p = document.createElement("span");
    p.textContent = state.students.length
      ? "Try a different search."
      : "Add a learner to start tracking goals, lessons and progress.";
    empty.append(strong, p);
    grid.append(empty);
  }
  for (const student of visible) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "student-card";
    const head = document.createElement("div");
    head.className = "student-card-head";
    const avatar = document.createElement("span");
    avatar.className = "student-avatar";
    avatar.textContent = initials(student.display_name);
    avatar.classList.add("i18n-user-content");
    const level = document.createElement("span");
    level.className = "cefr-pill";
    level.textContent = student.cefr_level === "UNASSESSED" ? "NOT ASSESSED" : student.cefr_level;
    head.append(avatar, level);
    const body = document.createElement("div");
    const name = document.createElement("h3");
    name.textContent = student.display_name;
    name.classList.add("i18n-user-content");
    const goal = document.createElement("p");
    goal.textContent = (student.learning_goals || []).slice(0, 2).join(" · ") || "Learning goals not recorded yet";
    if (student.learning_goals?.length) goal.classList.add("i18n-user-content");
    body.append(name, goal);
    const footer = document.createElement("span");
    footer.className = "student-card-footer";
    footer.textContent = "View student →";
    card.append(head, body, footer);
    card.addEventListener("click", () => openStudent(student.id));
    grid.append(card);
  }
  $("stat-students").textContent = state.students.length;
  $("stat-levels").textContent = new Set(state.students.map(s => s.cefr_level).filter(s => s !== "UNASSESSED")).size;
  $("stat-assess").textContent = state.students.filter(s => s.cefr_level === "UNASSESSED").length;
  const levels = {};
  for (const student of state.students) {
    const level = ["A1","A2","B1","B2","C1","C2"].includes(student.cefr_level) ? student.cefr_level : "UNASSESSED";
    levels[level] = (levels[level] || 0) + 1;
  }
  window.HelloEarthDashboardSummary = { total: state.students.length, levels };
  document.dispatchEvent(new CustomEvent("helloearth:studentsloaded", {
    detail: window.HelloEarthDashboardSummary
  }));
}

async function loadStudents() {
  loadingMessage("");
  const pageSize = 250;
  const results = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db.from("atlas_students")
      .select("*")
      .eq("tutor_id", state.user.id)
      .order("created_at", { ascending: false })
      .range(start, start + pageSize - 1);
    if (error) throw error;
    results.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  state.students = results;
  renderStudents();
}

async function openStudent(id) {
  state.selected = state.students.find(s => s.id === id) || null;
  if (!state.selected) return;
  const s = state.selected;
  $("student-detail").hidden = false;
  $("selected-name").textContent = s.display_name;
  const target = $("student-fields");
  target.replaceChildren(
    labelledField("CEFR level", s.cefr_level === "UNASSESSED" ? "Not assessed yet" : s.cefr_level),
    labelledField("Learning goals", (s.learning_goals || []).join(" • ")),
    labelledField("Focus areas", (s.focus_areas || []).join(" • ")),
    labelledField("Interests", (s.interests || []).join(" • ")),
    labelledField("Translation language", s.translation_language),
    labelledField("Assessment observations", s.assessment_notes),
    labelledField("Prior lesson references", s.lesson_history_notes),
    labelledField("Additional background", s.background_notes),
    labelledField("Provisional level notes", s.level_notes),
    labelledField("Teaching preferences", (s.teaching_preferences || []).join(" • "))
  );
  $("lesson-notes").replaceChildren();
  statusMessage($("detail-feedback"), "");
  $("student-detail").scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const { data, error } = await db.from("atlas_lesson_notes")
      .select("*")
      .eq("tutor_id", state.user.id)
      .eq("student_id", id)
      .order("lesson_date", { ascending: false })
      .limit(50);
    if (error) throw error;
    state.notes = data || [];
    const list = $("lesson-notes");
    if (!state.notes.length) {
      const p = document.createElement("p");
      p.textContent = "No dated lesson notes yet. Add one after your next lesson.";
      p.style.color = "#b7b8d2";
      list.append(p);
    }
    for (const note of state.notes) {
      const item = document.createElement("div");
      item.className = "ws-note";
      const time = document.createElement("time");
      time.textContent = note.lesson_date;
      const summary = document.createElement("div");
      summary.textContent = note.summary;
      summary.classList.add("i18n-user-content");
      const next = document.createElement("div");
      if (note.next_steps?.length) {next.textContent = tr("Next: {steps}", {steps:note.next_steps.join(" · ")});next.classList.add("i18n-user-content")}
      item.append(time, summary, next);
      list.append(item);
    }
  } catch (err) {
    statusMessage($("detail-feedback"), message(err), true);
  }
}

function startStudentForm(edit) {
  state.editMode = edit;
  const student = edit ? state.selected : null;
  $("student-form").reset();
  $("modal-heading").textContent = edit ? "Edit student" : "Add student";
  $("modal-subtitle").textContent = edit
    ? "Update this learner's goals and progress."
    : "Only store information you have permission to keep.";
  $("student-name").value = student?.display_name || "";
  $("student-cefr").value = student?.cefr_level || "UNASSESSED";
  $("student-goals").value = (student?.learning_goals || []).join("\n");
  $("student-focus").value = (student?.focus_areas || []).join("\n");
  $("student-interests").value = (student?.interests || []).join("\n");
  $("student-translation").value = student?.translation_language === "none" ? "" : (student?.translation_language || "");
  $("student-status").value = student?.record_status || "reference";
  $("student-assessment").value = student?.assessment_notes || "";
  $("student-history").value = student?.lesson_history_notes || "";
  statusMessage($("modal-feedback"), "");
  showModal("student-modal");
}

// Import never writes the uploaded file to GitHub or local browser storage.
// The tutor reviews the count before the authenticated RLS-scoped insert.
$("import-students").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > 2_000_000) {
    loadingMessage("Import file is too large (2 MB maximum).", true);
    return;
  }
  $("import-students").disabled = true;
  try {
    const payload = JSON.parse(await file.text());
    const list = payload?.students;
    if (payload?.schema_version !== 1 || !Array.isArray(list) || list.length < 1 || list.length > 250) {
      throw new Error("Expected Atlas student JSON (schema_version 1, 1–250 students).");
    }
    const existingNames = new Map(state.students.map(s => [s.display_name.toLocaleLowerCase(), s]));
    const existingIds = new Map(state.students.map(s => [s.id, s]));
    const seenIds = new Set(), seenNames = new Set(), additions = [];
    let skipped = 0;
    for (const raw of list) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid student profile in import.");
      const name = String(raw.display_name || "").trim();
      const id = String(raw.student_id || "");
      const level = String(raw.cefr_level || "").toUpperCase();
      if (!name || name.length > 120 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        throw new Error("A student name or UUID is invalid.");
      }
      if (!["A1","A2","B1","B2","C1","C2","UNASSESSED"].includes(level)) {
        throw new Error(tr("Unsupported CEFR level for {name}",{name}));
      }
      const compareName = name.toLocaleLowerCase();
      if (seenIds.has(id) || seenNames.has(compareName)) throw new Error("The file contains duplicate student names or IDs.");
      seenIds.add(id); seenNames.add(compareName);
      const byId = existingIds.get(id), byName = existingNames.get(compareName);
      if ((byId && byId.display_name.toLocaleLowerCase() !== compareName)
        || (byName && byName.id !== id)) {
        throw new Error(tr("An existing student has a matching name or ID but different identity: {name}. Review manually.",{name}));
      }
      if (byId || byName) { skipped++; continue; }
      const items = field => {
        const values = raw[field] ?? [];
        if (!Array.isArray(values) || values.length > 12 || values.some(v => typeof v !== "string" || v.trim().length > 180)) {
          throw new Error(tr("Invalid {field} for {name}",{field,name}));
        }
        return values.map(v => v.trim()).filter(Boolean);
      };
      const text = (field, max) => {
        const value = String(raw[field] ?? "").trim();
        if (value.length > max) throw new Error(tr("Field {field} is too long for {name}",{field,name}));
        return value;
      };
      const status = text("record_status", 20) || "reference";
      if (!["reference","incomplete","inquiry"].includes(status)) throw new Error(tr("Invalid record status for {name}",{name}));
      additions.push({
        id, tutor_id: state.user.id, display_name: name,
        cefr_level: level,
        learning_goals: items("learning_goals"), focus_areas: items("focus_areas"),
        interests: items("interests"), teaching_preferences: items("teaching_preferences"),
        translation_language: text("translation_language", 60) || "none",
        background_notes: text("background_notes", 2000),
        level_notes: text("level_notes", 1200),
        assessment_notes: text("assessment_notes", 3000),
        lesson_history_notes: text("lesson_history_notes", 3000),
        record_status: status,
        source_document: text("source_document", 300),
        ai_context_enabled: false
      });
    }
    if (!additions.length) {
      loadingMessage(tr("All {count} profiles are already present. No changes made.",{count:skipped}));
      return;
    }
    if (!window.confirm(
      tr("Import {count} new student profiles into YOUR private account?\n{skipped} existing profiles will be skipped.\nAI access will stay disabled. Imported notes have no invented lesson dates.",{count:additions.length,skipped})
    )) return;

    const { error } = await db.from("atlas_students").insert(additions);
    if (error) throw error;
    await loadStudents();
    await loadPlan();
    loadingMessage(tr("{count} students imported securely.",{count:additions.length})+(skipped ? " "+tr("{count} existing profiles skipped.",{count:skipped}) : ""));
  } catch (err) {
    loadingMessage(tr("Import stopped: {reason}",{reason:message(err)}), true);
  } finally {
    $("import-students").disabled = false;
  }
});
$("add-student").addEventListener("click", () => startStudentForm(false));
$("edit-student").addEventListener("click", () => startStudentForm(true));
$("close-detail").addEventListener("click", () => $("student-detail").hidden = true);
$("student-search").addEventListener("input", renderStudents);

$("student-form").addEventListener("submit", async event => {
  event.preventDefault();
  setBusy("save-student", true);
  statusMessage($("modal-feedback"), "");
  try {
    const name = $("student-name").value.trim();
    if (!name) throw new Error("A student name is required.");
    const payload = {
      display_name: name,
      cefr_level: $("student-cefr").value,
      learning_goals: arrayLines("student-goals"),
      focus_areas: arrayLines("student-focus"),
      interests: arrayLines("student-interests"),
      translation_language: $("student-translation").value.trim() || "none",
      record_status: $("student-status").value,
      assessment_notes: $("student-assessment").value.trim(),
      lesson_history_notes: $("student-history").value.trim(),
      updated_at: new Date().toISOString()
    };
    if (state.editMode) {
      const { data, error } = await db.from("atlas_students").update(payload)
        .eq("id", state.selected.id).eq("tutor_id", state.user.id).select().single();
      if (error) throw error;
      if (!data) throw new Error("The student could not be updated.");
      state.selected = data;
    } else {
      const { data, error } = await db.from("atlas_students").insert({
        ...payload, id: crypto.randomUUID(), tutor_id: state.user.id,
        ai_context_enabled: false
      }).select().single();
      if (error) throw error;
      if (!data) throw new Error("The student could not be created.");
    }
    hideModal("student-modal");
    await loadStudents();
    await loadPlan();
    if (state.editMode && state.selected) await openStudent(state.selected.id);
    else $("student-detail").hidden = true;
    loadingMessage("Student saved securely.");
  } catch (err) {
    statusMessage($("modal-feedback"), message(err), true);
  } finally { setBusy("save-student", false); }
});

$("add-note").addEventListener("click", () => {
  if (!state.selected) return;
  $("note-form").reset();
  $("note-date").value = new Date().toLocaleDateString("en-CA");
  statusMessage($("note-feedback"), "");
  showModal("note-modal");
});
$("note-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.selected) return;
  setBusy("save-note", true);
  statusMessage($("note-feedback"), "");
  try {
    const summary = $("note-summary").value.trim();
    if (!summary) throw new Error("Please enter a lesson summary.");
    const { error } = await db.from("atlas_lesson_notes").insert({
      id: crypto.randomUUID(), tutor_id: state.user.id,
      student_id: state.selected.id,
      lesson_date: $("note-date").value,
      summary,
      topics: arrayLines("note-topics"),
      strengths: arrayLines("note-strengths"),
      challenges: arrayLines("note-challenges"),
      next_steps: arrayLines("note-next")
    });
    if (error) throw error;
    hideModal("note-modal");
    await openStudent(state.selected.id);
    statusMessage($("detail-feedback"), "Lesson note saved.");
  } catch (err) { statusMessage($("note-feedback"), message(err), true); }
  finally { setBusy("save-note", false); }
});

$("signout").addEventListener("click", async () => {
  $("signout").disabled = true;
  await db.auth.signOut();
  window.location.replace("login.html");
});

async function init() {
  try {
    const user = await requireUser();
    if (!user) return;
    state.user = user;
    $("account-email").textContent = user.email || "Tutor";
    $("account-avatar").textContent = initials(user.user_metadata?.display_name || user.email || "H");
    $("checking").hidden = true;
    $("workspace").hidden = false;
    await loadStudents();
    await loadPlan();
  } catch (err) {
    $("checking").textContent = "We couldn't verify your account or load your records. Please sign in again.";
    $("checking").hidden = false;
    $("workspace").hidden = true;
    console.error("Workspace initialization failed", err?.name || "unknown error");
  }
}
init();

document.addEventListener("helloearth:languagechanged",()=>{if(state.user){renderStudents();loadPlan().catch(()=>{})}});
