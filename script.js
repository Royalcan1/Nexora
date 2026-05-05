// ==========================================
//  CONFIG SUPABASE
// ==========================================
const SUPABASE_URL = "https://dmjctzpgondlavluwury.supabase.co";
const SUPABASE_KEY = "sb_publishable_I4_a8MSGS0cFFRD_p2DMdg_pPm3W3Cr";

// On utilise le client officiel Supabase chargé via le CDN.
// ⚠️ On nomme notre client "db" et pas "supabase" pour éviter
// un conflit avec la variable globale "supabase" créée par le CDN.
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
// ==========================================
//  DÉTECTION DU RETOUR DEPUIS L'EMAIL DE RESET
// ==========================================
// Quand l'utilisateur clique le lien dans l'email, Supabase le redirige
// avec un fragment d'URL. On l'écoute via onAuthStateChange (PASSWORD_RECOVERY).
let isPasswordRecovery = false;

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

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  handleAuthChange(session);

  db.auth.onAuthStateChange((event, session) => {
  if (event === "PASSWORD_RECOVERY") {
    // L'utilisateur arrive depuis un lien de reset → on lui montre le modal
    isPasswordRecovery = true;
    showResetModal();
    return;
  }
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
      const { data, error } = await db.auth.signUp({ email, password });
      if (error) throw error;
      console.log("SIGNUP OK =", data);
      hideAuthModal();
    } else {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;
      console.log("LOGIN OK =", data);
      hideAuthModal();
    }
  } catch (err) {
    console.error("AUTH ERROR =", err);
    let msg = err.message || "Une erreur est survenue.";
    if (msg.includes("Invalid login credentials")) msg = "Email ou mot de passe incorrect.";
    if (msg.includes("User already registered")) msg = "Un compte existe déjà avec cet email.";
    if (msg.includes("Password should be at least")) msg = "Mot de passe trop court (min. 6 caractères).";
    errorEl.textContent = msg;
  }
}

async function logout() {
  await db.auth.signOut();
  console.log("LOGOUT OK");
}
// ==========================================
//  AUTH — MOT DE PASSE OUBLIÉ
// ==========================================

async function showResetPassword() {
  const email = document.getElementById("auth-email").value.trim();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  if (!email) {
    errorEl.textContent = "Entre d'abord ton email ci-dessus, puis re-clique.";
    document.getElementById("auth-email").focus();
    return;
  }

  try {
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    errorEl.style.color = "#22c55e"; // vert pour message de succès
    errorEl.textContent = "Email envoyé ! Vérifie ta boîte mail.";
    setTimeout(() => { errorEl.style.color = ""; }, 4000);
  } catch (err) {
    console.error("RESET ERROR =", err);
    errorEl.textContent = err.message || "Erreur lors de l'envoi.";
  }
}

function showResetModal() {
  hideAuthModal();
  document.getElementById("reset-error").textContent = "";
  document.getElementById("reset-password").value = "";
  const modal = document.getElementById("reset-modal");
  modal.classList.remove("closed");
  modal.classList.add("open");
  setTimeout(() => document.getElementById("reset-password").focus(), 100);
}

function hideResetModal() {
  const modal = document.getElementById("reset-modal");
  modal.classList.remove("open");
  modal.classList.add("closed");
}

async function submitNewPassword() {
  const password = document.getElementById("reset-password").value;
  const errorEl = document.getElementById("reset-error");
  errorEl.textContent = "";

  if (!password || password.length < 6) {
    errorEl.textContent = "Mot de passe trop court (min. 6 caractères).";
    return;
  }

  try {
    const { error } = await db.auth.updateUser({ password });
    if (error) throw error;
    console.log("PASSWORD UPDATED");
    isPasswordRecovery = false;
    hideResetModal();
    // L'utilisateur est déjà connecté grâce au token de récupération,
    // on déclenche juste le rafraîchissement de l'UI
    const { data: { session } } = await db.auth.getSession();
    handleAuthChange(session);
  } catch (err) {
    console.error("UPDATE PASSWORD ERROR =", err);
    errorEl.textContent = err.message || "Erreur lors de la mise à jour.";
  }
}

// ==========================================
//  TÂCHES — CRUD via le client Supabase
// ==========================================

async function addTask() {
  if (!currentUser) return;
  let input = document.getElementById("input").value;
  if (!input) return;
  let list = input.split(/[+,/]/).map(t => t.trim()).filter(Boolean);

  const newTasks = list.map(t => ({
    text: t,
    priority: getPriority(t),
    time: getTime(t),
    done: false,
    user_id: currentUser.id
  }));

  const { data, error } = await db.from("tasks").insert(newTasks).select();
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
  const { data, error } = await db.from("tasks").select("*");
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
  const { data, error } = await db
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
  const { error } = await db.from("tasks").delete().eq("id", id);
  if (error) {
    console.error("DELETE ERROR =", error);
    return;
  }
  console.log("DELETED =", id);
  await loadTasks();
};
window.clearDoneTasks = async function(event) {
  // Empêche le clic de propager au header (qui ouvre/ferme la section)
  if (event) event.stopPropagation();

  const doneTasks = tasks.filter(t => t.done);
  if (doneTasks.length === 0) return;

  const confirmed = confirm(`Supprimer les ${doneTasks.length} tâche(s) terminée(s) ?`);
  if (!confirmed) return;

  const ids = doneTasks.map(t => t.id);
  const { error } = await db.from("tasks").delete().in("id", ids);
  if (error) {
    console.error("CLEAR DONE ERROR =", error);
    return;
  }
  console.log("CLEARED DONE TASKS =", ids);
  await loadTasks();
};
window.editTask = async function(id, newText) {
  if (!id) return;
  newText = newText.trim();
  if (!newText) {
    // Si l'utilisateur a vidé le champ, on annule (on recharge sans modifier)
    await loadTasks();
    return;
  }
  // On recalcule la priorité et le temps en fonction du nouveau texte
  const { data, error } = await db
    .from("tasks")
    .update({
      text: newText,
      priority: getPriority(newText),
      time: getTime(newText)
    })
    .eq("id", id)
    .select();
  if (error) {
    console.error("EDIT ERROR =", error);
    return;
  }
  console.log("EDITED TASK =", data);
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
    // On échappe les guillemets dans le texte pour éviter de casser le HTML
    const safeText = t.text.replace(/"/g, "&quot;");
    html += `<div class="task ${t.priority}" id="task-${t.id}">
      <button class="check-btn" onclick="toggleTask(${t.id}, ${t.done})"></button>
      <div class="task-content">
        <b class="task-text"
           contenteditable="true"
           spellcheck="false"
           data-id="${t.id}"
           data-original="${safeText}"
           onkeydown="handleEditKey(event, this)"
           onblur="finishEdit(this)">${t.text}</b>
        <br>priorité : ${t.priority}<br>temps : ${t.time}
      </div>
    </div>`;
  });
  html += `</div></div>
    <div class="done-section">
      <div class="done-header" onclick="toggleDoneSection()">
  <span>Tâches terminées (${done.length})</span>
  ${done.length > 0 ? `<button class="clear-btn" onclick="clearDoneTasks(event)" title="Tout supprimer">🗑️ Vider</button>` : ""}
</div>
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

// ==========================================
//  HELPERS — détection priorité / temps (v2)
// ==========================================

function getPriority(text) {
  text = text.toLowerCase();
  let score = 0;

  // Axe 1 : type d'évaluation
  if (/\b(examen|exam|contrôle|controle|partiel|partielle|bac|brevet|oral|concours)\b/.test(text)) score += 3;
  else if (/\b(ds|devoir surveillé|devoir surveille|interro|interrogation|test|évaluation|evaluation)\b/.test(text)) score += 2;
  else if (/\b(dm|devoir maison|devoir|exposé|expose|dossier|projet|rapport|rendu)\b/.test(text)) score += 1;
  else if (/\b(révision|revision|réviser|reviser|fiche|lecture|lire|exercice|exo)\b/.test(text)) score += 0.5;

  // Axe 2 : échéance temporelle
  if (/\b(aujourd'hui|aujourdhui|ce soir|ce midi|tout de suite|maintenant|asap)\b/.test(text)) score += 3;
  else if (/\b(demain|ce soir)\b/.test(text)) score += 3;
  else if (/\b(après-demain|apres-demain|après demain|apres demain|dans 2 jours)\b/.test(text)) score += 2;
  else if (/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(text)) score += 2;
  else if (/\b(cette semaine|d'ici (vendredi|jeudi|mercredi))\b/.test(text)) score += 1.5;
  else if (/\b(la semaine prochaine|semaine prochaine|dans (3|4|5|6|7) jours)\b/.test(text)) score += 1;
  else if (/\b(dans 2 semaines|dans deux semaines|le mois prochain|dans un mois)\b/.test(text)) score += 0.5;

  // Axe 3 : mots d'urgence explicite
  if (/\b(urgent|urgente|important|importante|vite|priorité|priorite)\b/.test(text)) score += 2;
  if (text.includes("!!")) score += 1;

  // Conversion score → priorité
  if (score >= 4) return "urgent";
  if (score >= 2) return "medium";
  return "normal";
}

function getTime(text) {
  text = text.toLowerCase();

  // Examens et oraux : préparation longue
  if (/\b(examen|exam|contrôle|controle|partiel|partielle|bac|brevet|oral|concours|ds|devoir surveillé|devoir surveille)\b/.test(text)) return "2h";

  // Travaux écrits avec rendu : moyens
  if (/\b(dm|devoir maison|exposé|expose|dossier|projet|rapport|rendu)\b/.test(text)) return "1h30";

  // Devoirs courts et tests : standard
  if (/\b(devoir|interro|interrogation|test|évaluation|evaluation)\b/.test(text)) return "1h";

  // Révisions et lectures : courtes
  if (/\b(révision|revision|réviser|reviser|fiche|lecture|lire|exercice|exo|relire)\b/.test(text)) return "45 min";

  // Reste : tâches normales
  return "30 min";
}

// ==========================================
//  BONUS — Soumettre l'auth avec Entrée / fermer avec Échap
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
//  ÉDITION INLINE D'UNE TÂCHE
// ==========================================

function handleEditKey(event, el) {
  if (event.key === "Enter") {
    event.preventDefault(); // empêche le retour à la ligne
    el.blur(); // déclenche finishEdit
  }
  if (event.key === "Escape") {
    event.preventDefault();
    // On restaure le texte original et on quitte l'édition
    el.textContent = el.dataset.original;
    el.dataset.cancelled = "true";
    el.blur();
  }
}

function finishEdit(el) {
  // Si l'édition a été annulée par Échap, on ne sauvegarde pas
  if (el.dataset.cancelled === "true") {
    delete el.dataset.cancelled;
    return;
  }
  const id = el.dataset.id;
  const newText = el.textContent;
  const original = el.dataset.original.replace(/&quot;/g, '"');
  // Si le texte n'a pas changé, on ne fait rien (évite un appel API inutile)
  if (newText.trim() === original.trim()) return;
  editTask(id, newText);
}
// ==========================================
//  GO
// ==========================================
initAuth();
