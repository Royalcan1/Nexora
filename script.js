// ==========================================
//  CONFIG SUPABASE
// ==========================================
const SUPABASE_URL = "https://dmjctzpgondlavluwury.supabase.co";
const SUPABASE_KEY = "sb_publishable_I4_a8MSGS0cFFRD_p2DMdg_pPm3W3Cr";

// On utilise maintenant le client officiel Supabase (chargé via le CDN dans index.html)
// Il gère automatiquement la session, le token, le refresh, etc.
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
//  ÉTAT GLOBAL
// ==========================================
let doneOpen = localStorage.getItem("doneOpen") === "true";
let tasks = [];
let currentUser = null;
let authMode = "login"; // "login" ou "signup"

console.log("JS CHARGE OK");

// ==========================================
//  AUTH — INIT & GESTION DE LA SESSION
// ==========================================

// Au chargement de la page, on vérifie si l'utilisateur est déjà connecté
async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  handleAuthChange(session);

  // Écoute les changements de session (login, logout, refresh token...)
  supabase.auth.onAuthStateChange((_event, session) => {
    handleAuthChange(session);
  });
}

function handleAuthChange(session) {
  currentUser = session?.user || null;
  updateUI();
  if (currentUser) {
    loadTasks();
  } else {
    tasks = [];
  }
}

function updateUI() {
  const loggedOut = document.getElementById("auth-buttons-logged-out");
  const loggedIn = document.getElementById("auth-buttons-logged-in");
  const appView = document.getElementById("app-view");
  const landingView = document.getElementById("landing-view");
  const userEmail = document.getElementById("user-email");

  if (currentUser) {
    loggedOut.style.display = "none";
    loggedIn.style.display = "flex";
    appView.style.display = "block";
    landingView.style.display = "none";
    userEmail.textContent = currentUser.email;
  } else {
    loggedOut.style.display = "flex";
    loggedIn.style.display = "none";
    appView.style.display = "none";
    landingView.style.display = "block";
  }
}

// ==========================================
//  AUTH — MODAL (login / signup)
// ==========================================

function showAuthModal(mode) {
  authMode = mode;
  updateAuthModalUI();
  document.getElementById("auth-error").textContent = "";
  document.getElementById("auth-email").value = "";
  document.getElementById("auth-password").value = "";
  const modal = document.getElementById("auth-modal");
  modal.classList.remove("closed");
  modal.classList.add("open");
  setTimeout(() => document.getElementById("auth-email").focus(), 100);
}

function hideAuthModal() {
  const modal = document.getElementById("auth-modal");
  modal.classList.remove("open");
  modal.classList.add("closed");
}

function switchAuthMode() {
  authMode = authMode === "login" ? "signup" : "login";
  updateAuthModalUI();
  document.getElementById("auth-error").textContent = "";
}

function updateAuthModalUI() {
  const title = document.getElementById("auth-title");
  const submit = document.getElementById("auth-submit");
  const switchText = document.getElementById("auth-switch-text");
  const switchLink = document.getElementById("auth-switch-link");

  if (authMode === "login") {
    title.textContent = "Se connecter";
    submit.textContent = "Se connecter";
    switchText.textContent = "Pas encore de compte ?";
    switchLink.textContent = "S'inscrire";
  } else {
    title.textContent = "Créer un compte";
    submit.textContent = "S'inscrire";
    switchText.textContent = "Déjà un compte ?";
    switchLink.textContent = "Se connecter";
  }
}

async function submitAuth() {
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  if (!email || !password) {
    errorEl.textContent = "Email et mot de passe requis.";
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = "Le mot de passe doit faire au moins 6 caractères.";
    return;
  }

  try {
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      console.log("SIGNUP OK =", data);
      // Avec confirmation email désactivée, l'utilisateur est déjà connecté
      hideAuthModal();
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log("LOGIN OK =", data);
      hideAuthModal();
    }
  } catch (err) {
    console.error("AUTH ERROR =", err);
    // Traduction des erreurs courantes en français
    let msg = err.message || "Une erreur est survenue.";
    if (msg.includes("Invalid login credentials")) msg = "Email ou mot de passe incorrect.";
    if (msg.includes("User already registered")) msg = "Un compte existe déjà avec cet email.";
    if (msg.includes("Password should be at least")) msg = "Mot de passe trop court (min. 6 caractères).";
    errorEl.textContent = msg;
  }
}

async function logout() {
  await supabase.auth.signOut();
  console.log("LOGOUT OK");
  // handleAuthChange est appelé automatiquement via onAuthStateChange
}

// ==========================================
//  TÂCHES — CRUD via le client Supabase
// ==========================================

async function addTask() {
  if (!currentUser) return;
  let input = document.getElementById("input").value;
  if (!input) return;
  let list = input.split(/[+,/]/).map(t => t.trim()).filter(Boolean);

  // On prépare toutes les tâches en une seule insertion (plus rapide)
  const newTasks = list.map(t => ({
    text: t,
    priority: getPriority(t),
    time: getTime(t),
    done: false,
    user_id: currentUser.id  // 👈 obligatoire avec le RLS
  }));

  const { data, error } = await supabase.from("tasks").insert(newTasks).select();
  if (error) {
    console.error("INSERT ERROR =", error);
    return;
  }
  console.log("TASKS SAVED =", data);
  document.getElementById("input").value = "";
  await loadTasks();
}

async function loadTasks() {
  if (!currentUser) {
    tasks = [];
    render();
    return;
  }
  // Pas besoin de filtrer par user_id ici : le RLS le fait pour nous
  const { data, error } = await supabase.from("tasks").select("*");
  if (error) {
    console.error("LOAD ERROR =", error);
    tasks = [];
  } else {
    tasks = data || [];
  }
  console.log("LOAD =", tasks);
  render();
}

window.toggleTask = async function(id, currentDone) {
  if (!id) return;
  const { data, error } = await supabase
    .from("tasks")
    .update({ done: !currentDone })
    .eq("id", id)
    .select();
  if (error) {
    console.error("TOGGLE ERROR =", error);
    return;
  }
  console.log("UPDATED TASK =", data);
  await loadTasks();
};

window.deleteTask = async function(id) {
  if (!id) return;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("DELETE ERROR =", error);
    return;
  }
  console.log("DELETED =", id);
  await loadTasks();
};

// ==========================================
//  RENDU & UI TÂCHES
// ==========================================

function render() {
  let active = tasks.filter(t => !t.done).sort((a, b) => ({ urgent: 0, medium: 1, normal: 2 }[a.priority] - { urgent: 0, medium: 1, normal: 2 }[b.priority]));
  let done = tasks.filter(t => t.done);
  let html = `
    <h2>Tes tâches</h2>
    <div class="done-section">
      <div class="done-header" onclick="toggleActiveSection()">Tâches en cours (${active.length})</div>
      <div id="active-list" class="open">`;
  active.forEach((t) => {
    html += `<div class="task ${t.priority}" id="task-${t.id}">
      <button class="check-btn" onclick="toggleTask(${t.id}, ${t.done})"></button>
      <div><b>${t.text}</b><br>priorité : ${t.priority}<br>temps : ${t.time}</div>
    </div>`;
  });
  html += `</div></div>
    <div class="done-section">
      <div class="done-header" onclick="toggleDoneSection()">Tâches terminées (${done.length})</div>
      <div id="done-list" class="${doneOpen ? "open" : "closed"}">`;
  done.forEach((t) => {
    html += `<div class="task done">
      <div><b>${t.text}</b></div>
      <button class="trash-btn" onclick="deleteTask(${t.id})">🗑</button>
    </div>`;
  });
  html += `</div></div>`;
  document.getElementById("output").innerHTML = html;
}

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

// ==========================================
//  HELPERS — détection priorité / temps
// ==========================================

function getPriority(text) {
  text = text.toLowerCase();
  if (text.includes("examen") || text.includes("exam") || text.includes("contrôle") || text.includes("controle") || text.includes("demain") || text.includes("urgent")) return "urgent";
  if (text.includes("devoir") || text.includes("dm") || text.includes("révision") || text.includes("revision") || text.includes("test")) return "medium";
  return "normal";
}

function getTime(text) {
  text = text.toLowerCase();
  if (text.includes("examen") || text.includes("exam") || text.includes("controle") || text.includes("contrôle") || text.includes("urgent")) return "1h30";
  if (text.includes("devoir") || text.includes("dm") || text.includes("révision") || text.includes("revision")) return "1h";
  return "45 min";
}

// ==========================================
//  BONUS — Soumettre l'auth avec Entrée
// ==========================================
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const modal = document.getElementById("auth-modal");
    if (modal.classList.contains("open")) {
      submitAuth();
    }
  }
  if (e.key === "Escape") {
    const modal = document.getElementById("auth-modal");
    if (modal.classList.contains("open")) {
      hideAuthModal();
    }
  }
});

// ==========================================
//  GO
// ==========================================
initAuth();
