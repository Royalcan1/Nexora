const SUPABASE_URL = "https://dmjctzpgondlavluwury.supabase.co";
const SUPABASE_KEY = "";

// -------------------- STATE --------------------
let doneOpen = localStorage.getItem("doneOpen") === "true";
let tasks = [];
let filter = "all";

console.log("JS CHARGE OK");

// -------------------- ADD TASK --------------------
async function addTask() {
  let input = document.getElementById("input").value;
  if (!input) return;

  let list = input.split(/[+,/]/).map(t => t.trim()).filter(Boolean);

  for (let t of list) {
    await saveTask({
      text: t,
      priority: getPriority(t),
      time: getTime(t),
      done: false
    });
  }

  document.getElementById("input").value = "";
  await loadTasks();
}

// -------------------- SAVE TASK --------------------
async function saveTask(task) {
  let res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(task)
  });

  let data = await res.json();
  console.log("TASK SAVED =", data);
  return data;
}

// -------------------- LOAD TASKS --------------------
async function loadTasks() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=*`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json"
    }
  });

  const data = await res.json();
  console.log("LOAD =", data);
  tasks = Array.isArray(data) ? data : [];
  render();
}

// -------------------- TOGGLE TASK --------------------
window.toggleTask = async function(id, currentDone) {
  if (!id) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({ done: !currentDone })
    });

    console.log("RES STATUS =", res.status);
    console.log("RES OK =", res.ok);

    if (!res.ok) {
      const text = await res.text();
      console.log("ERREUR SUPABASE =", text);
      return;
    }

    const data = await res.json();
    console.log("UPDATED =", data);
    await loadTasks();

  } catch (err) {
    console.error("TOGGLE ERROR =", err.message);
  }
};

// -------------------- DELETE TASK --------------------
window.deleteTask = async function(id) {
  if (!id) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      }
    });
    console.log("DELETE STATUS =", res.status);
    await loadTasks();
  } catch (err) {
    console.error("DELETE ERROR =", err);
  }
};

// -------------------- RENDER --------------------
function render() {
  let active = tasks
    .filter(t => !t.done)
    .sort((a, b) => {
      const order = { urgent: 0, medium: 1, normal: 2 };
      return order[a.priority] - order[b.priority];
    });
  let done = tasks.filter(t => t.done);

  let html = `
    <h2>Tes tâches</h2>
    <div class="done-section">
      <div class="done-header" onclick="toggleActiveSection()">
        Tâches en cours (${active.length})
      </div>
      <div id="active-list" class="open">
  `;

  active.forEach((t) => {
    html += `
      <div class="task ${t.priority}" id="task-${t.id}">
        <button class="check-btn" onclick="toggleTask(${t.id}, ${t.done})"></button>
        <div>
          <b>${t.text}</b><br>
          priorité : ${t.priority}<br>
          temps : ${t.time}
        </div>
      </div>
    `;
  });

  html += `
      </div>
    </div>
    <div class="done-section">
      <div class="done-header" onclick="toggleDoneSection()">
        Tâches terminées (${done.length})
      </div>
      <div id="done-list" class="${doneOpen ? "open" : "closed"}">
  `;

  done.forEach((t) => {
    html += `
      <div class="task done">
        <div><b>${t.text}</b></div>
        <button class="trash-btn" onclick="deleteTask(${t.id})">🗑</button>
      </div>
    `;
  });

  html += `</div></div>`;
  document.getElementById("output").innerHTML = html;
}

// -------------------- TOGGLE SECTIONS --------------------
function toggleActiveSection() {
  const el = document.getElementById("active-list");
  el.classList.toggle("open");
  el.classList.toggle("closed");
}

function toggleDoneSection() {
  const el = document.getElementById("done-list");
  doneOpen = !doneOpen;
  localStorage.setItem("doneOpen", doneOpen);
  el.classList.toggle("open");
  el.classList.toggle("closed");
}

function toggleMoreMenu() {
  const menu = document.getElementById("more-dropdown");
  menu.classList.toggle("open");
  menu.classList.toggle("closed");
}

// -------------------- PRIORITY --------------------
function getPriority(text) {
  text = text.toLowerCase();
  if (text.includes("examen") || text.includes("exam") || text.includes("contrôle") || text.includes("controle") || text.includes("demain") || text.includes("urgent")) return "urgent";
  if (text.includes("devoir") || text.includes("dm") || text.includes("révision") || text.includes("revision") || text.includes("test")) return "medium";
  return "normal";
}

// -------------------- TIME --------------------
function getTime(text) {
  text = text.toLowerCase();
  if (text.includes("examen") || text.includes("exam") || text.includes("controle") || text.includes("contrôle") || text.includes("urgent")) return "1h30";
  if (text.includes("devoir") || text.includes("dm") || text.includes("révision") || text.includes("revision")) return "1h";
  return "45 min";
}

// -------------------- FILTER --------------------
function setFilter(value) {
  filter = value;
  render();
}

// -------------------- RESET --------------------
function resetTasks() {
  tasks = [];
  render();
}

// -------------------- INIT --------------------
loadTasks();
