// ==========================================
//  CONFIG SUPABASE
// ==========================================
const SUPABASE_URL = "https://dmjctzpgondlavluwury.supabase.co";
const SUPABASE_KEY = "sb_publishable_I4_a8MSGS0cFFRD_p2DMdg_pPm3W3Cr";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==========================================
//  ÉTAT GLOBAL
// ==========================================
let doneOpen = localStorage.getItem("doneOpen") === "true";
let tasks = [];
let currentUser = null;
let authMode = "login";
let isPasswordRecovery = false;

console.log("JS CHARGE OK");

// ==========================================
//  AUTH — INIT & GESTION DE LA SESSION
// ==========================================

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  handleAuthChange(session);

  db.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
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
  document.getElementById("auth-error").style.color = "";
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
  document.getElementById("auth-error").style.color = "";
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
  errorEl.style.color = "";

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
  errorEl.style.color = "";

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
    errorEl.style.color = "#22c55e";
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
    const { data: { session } } = await db.auth.getSession();
    handleAuthChange(session);
  } catch (err) {
    console.error("UPDATE PASSWORD ERROR =", err);
    errorEl.textContent = err.message || "Erreur lors de la mise à jour.";
  }
}

// ==========================================
//  TÂCHES — CRUD
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

  // On regarde combien de tâches étaient en cours AVANT le toggle
  const activeBeforeCount = tasks.filter(t => !t.done).length;

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

  // Si on vient de cocher la dernière tâche en cours -> on célèbre 🎉
  const justCompleted = !currentDone;
  if (justCompleted && activeBeforeCount === 1) {
    celebrate();
  }

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

window.editTask = async function(id, newText) {
  if (!id) return;
  newText = newText.trim();
  if (!newText) {
    await loadTasks();
    return;
  }
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

window.clearDoneTasks = async function(event) {
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
//  HELPERS — détection priorité / temps (v2)
// ==========================================

function getPriority(text) {
  text = text.toLowerCase();
  let score = 0;

  if (/\b(examen|exam|contrôle|controle|partiel|partielle|bac|brevet|oral|concours)\b/.test(text)) score += 3;
  else if (/\b(ds|devoir surveillé|devoir surveille|interro|interrogation|test|évaluation|evaluation)\b/.test(text)) score += 2;
  else if (/\b(dm|devoir maison|devoir|exposé|expose|dossier|projet|rapport|rendu)\b/.test(text)) score += 1;
  else if (/\b(révision|revision|réviser|reviser|fiche|lecture|lire|exercice|exo)\b/.test(text)) score += 0.5;

  if (/\b(aujourd'hui|aujourdhui|ce soir|ce midi|tout de suite|maintenant|asap)\b/.test(text)) score += 3;
  else if (/\b(demain|ce soir)\b/.test(text)) score += 3;
  else if (/\b(après-demain|apres-demain|après demain|apres demain|dans 2 jours)\b/.test(text)) score += 2;
  else if (/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(text)) score += 2;
  else if (/\b(cette semaine|d'ici (vendredi|jeudi|mercredi))\b/.test(text)) score += 1.5;
  else if (/\b(la semaine prochaine|semaine prochaine|dans (3|4|5|6|7) jours)\b/.test(text)) score += 1;
  else if (/\b(dans 2 semaines|dans deux semaines|le mois prochain|dans un mois)\b/.test(text)) score += 0.5;

  if (/\b(urgent|urgente|important|importante|vite|priorité|priorite)\b/.test(text)) score += 2;
  if (text.includes("!!")) score += 1;

  if (score >= 4) return "urgent";
  if (score >= 2) return "medium";
  return "normal";
}

function getTime(text) {
  text = text.toLowerCase();
  if (/\b(examen|exam|contrôle|controle|partiel|partielle|bac|brevet|oral|concours|ds|devoir surveillé|devoir surveille)\b/.test(text)) return "2h";
  if (/\b(dm|devoir maison|exposé|expose|dossier|projet|rapport|rendu)\b/.test(text)) return "1h30";
  if (/\b(devoir|interro|interrogation|test|évaluation|evaluation)\b/.test(text)) return "1h";
  if (/\b(révision|revision|réviser|reviser|fiche|lecture|lire|exercice|exo|relire)\b/.test(text)) return "45 min";
  return "30 min";
}

// ==========================================
//  🎉 CONFETTIS + TOAST DE FIN DE TÂCHES
// ==========================================

const COMPLETION_MESSAGES = [
  { title: "Bravo !", subtitle: "Toutes tes tâches sont terminées." },
  { title: "Tout est fait 👏", subtitle: "Tu peux souffler, c'est mérité." },
  { title: "Mission accomplie", subtitle: "Plus rien sur ta liste — profite-en." },
  { title: "Journée bouclée", subtitle: "Tu as tout terminé, beau travail." },
  { title: "Zéro tâche en attente", subtitle: "Le calme après l'effort." },
  { title: "Liste vide ✨", subtitle: "Rien à faire, et c'est bien." }
];

function showCompletionToast() {
  const msg = COMPLETION_MESSAGES[Math.floor(Math.random() * COMPLETION_MESSAGES.length)];

  const existing = document.getElementById("completion-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "completion-toast";
  toast.className = "completion-toast";
  toast.innerHTML = `
    <div class="completion-toast-title">${msg.title}</div>
    <div class="completion-toast-subtitle">${msg.subtitle}</div>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

function celebrate() {
  if (typeof confetti !== "function") return;

  // Affiche le toast de félicitations
  showCompletionToast();

  const duration = 2000;
  const end = Date.now() + duration;

  // Première salve : depuis le centre, vers le haut
  confetti({
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"]
  });

  // Salves continues depuis les côtés pendant 2 secondes
  (function frame() {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ["#3b82f6", "#22c55e", "#f59e0b"]
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ["#ef4444", "#a855f7", "#22c55e"]
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  }());
}

// ==========================================
//  ÉDITION INLINE
// ==========================================

function handleEditKey(event, el) {
  if (event.key === "Enter") {
    event.preventDefault();
    el.blur();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    el.textContent = el.dataset.original;
    el.dataset.cancelled = "true";
    el.blur();
  }
}

function finishEdit(el) {
  if (el.dataset.cancelled === "true") {
    delete el.dataset.cancelled;
    return;
  }
  const id = el.dataset.id;
  const newText = el.textContent;
  const original = el.dataset.original.replace(/&quot;/g, '"');
  if (newText.trim() === original.trim()) return;
  editTask(id, newText);
}

// ==========================================
//  📊 MODALS INFO (Dashboard / Support / Contact / À propos)
// ==========================================

const CONTACT_EMAIL = "nexora.app@proton.me";
const CREATOR_NAME = "Nicolas";
const APP_VERSION = "0.2";

function showInfoModal(type) {
  const menu = document.getElementById("more-dropdown");
  menu.classList.remove("open");
  menu.classList.add("closed");

  const body = document.getElementById("info-modal-body");
  body.innerHTML = renderInfoModalContent(type);

  const modal = document.getElementById("info-modal");
  modal.classList.remove("closed");
  modal.classList.add("open");
}

function hideInfoModal() {
  const modal = document.getElementById("info-modal");
  modal.classList.remove("open");
  modal.classList.add("closed");
}

function renderInfoModalContent(type) {
  if (type === "dashboard") return renderDashboard();
  if (type === "support") return renderSupport();
  if (type === "contact") return renderContact();
  if (type === "about") return renderAbout();
  return "";
}

function renderDashboard() {
  const total = tasks.length;
  const done = tasks.filter(t => t.done).length;
  const active = total - done;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  const urgentCount = tasks.filter(t => !t.done && t.priority === "urgent").length;
  const mediumCount = tasks.filter(t => !t.done && t.priority === "medium").length;
  const normalCount = tasks.filter(t => !t.done && t.priority === "normal").length;
  const maxActive = Math.max(urgentCount, mediumCount, normalCount, 1);

  if (total === 0) {
    return `
      <h2>📊 Dashboard</h2>
      <p class="info-subtitle">Tes statistiques</p>
      <div class="empty-state">
        <div class="empty-state-emoji">📋</div>
        Tu n'as pas encore de tâches.<br>Ajoute-en pour voir tes stats apparaître ici !
      </div>
    `;
  }

  return `
    <h2>📊 Dashboard</h2>
    <p class="info-subtitle">Tes statistiques en direct</p>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${active}</div>
        <div class="stat-label">En cours</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${done}</div>
        <div class="stat-label">Terminées</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-value">${completion}%</div>
        <div class="stat-label">Complétion</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total</div>
      </div>
    </div>

    <div class="info-section">
      <h3>Répartition des tâches en cours</h3>
      ${active === 0 ? `
        <p style="opacity:0.6;font-size:13px;">Aucune tâche en cours 🎉</p>
      ` : `
        <div class="priority-bars">
          <div class="priority-bar-row">
            <div class="priority-bar-label"><span class="priority-dot urgent"></span>Urgent</div>
            <div class="priority-bar-track"><div class="priority-bar-fill urgent" style="width:${(urgentCount/maxActive)*100}%"></div></div>
            <div class="priority-bar-count">${urgentCount}</div>
          </div>
          <div class="priority-bar-row">
            <div class="priority-bar-label"><span class="priority-dot medium"></span>Medium</div>
            <div class="priority-bar-track"><div class="priority-bar-fill medium" style="width:${(mediumCount/maxActive)*100}%"></div></div>
            <div class="priority-bar-count">${mediumCount}</div>
          </div>
          <div class="priority-bar-row">
            <div class="priority-bar-label"><span class="priority-dot normal"></span>Normal</div>
            <div class="priority-bar-track"><div class="priority-bar-fill normal" style="width:${(normalCount/maxActive)*100}%"></div></div>
            <div class="priority-bar-count">${normalCount}</div>
          </div>
        </div>
      `}
    </div>
  `;
}

function renderSupport() {
  return `
    <h2>💬 Support</h2>
    <p class="info-subtitle">Tout ce qu'il faut savoir pour bien utiliser Nexora</p>

    <div class="info-section">
      <h3>Ajouter des tâches</h3>
      <p>Pour ajouter <b>plusieurs tâches d'un coup</b>, sépare-les avec <kbd>+</kbd>, <kbd>,</kbd> ou <kbd>/</kbd>.</p>
      <p style="opacity:0.7;font-size:13px;">Exemple : <i>maths examen demain + devoir français + réviser bio</i></p>
    </div>

    <div class="info-section">
      <h3>Détection automatique</h3>
      <p>Nexora analyse le texte pour deviner la priorité et le temps estimé. Quelques mots-clés reconnus :</p>
      <ul>
        <li><b>Urgent</b> : examen, contrôle, oral, demain, urgent…</li>
        <li><b>Medium</b> : DM, devoir, projet, révision, lundi…</li>
        <li><b>Normal</b> : tout le reste</li>
      </ul>
    </div>

    <div class="info-section">
      <h3>Modifier une tâche</h3>
      <p>Clique sur le <b>texte</b> d'une tâche pour le modifier directement.</p>
      <ul>
        <li><kbd>Entrée</kbd> pour valider</li>
        <li><kbd>Échap</kbd> pour annuler</li>
      </ul>
    </div>

    <div class="info-section">
      <h3>Supprimer / archiver</h3>
      <p>Coche une tâche pour la passer en <i>terminées</i>. Utilise le bouton <b>🗑️ Vider</b> pour tout nettoyer d'un coup.</p>
    </div>

    <div class="info-section">
      <h3>Besoin d'aide ?</h3>
      <p>Un bug, une suggestion ? Passe par la page <b>Contact</b> du menu pour nous écrire 📩</p>
    </div>
  `;
}

function renderContact() {
  const subject = encodeURIComponent("Contact Nexora");
  const body = encodeURIComponent("Bonjour,\n\n");
  return `
    <h2>📩 Contact</h2>
    <p class="info-subtitle">Une question, un bug, une suggestion ? On est à l'écoute.</p>

    <div class="contact-card">
      <div style="font-size:13px;opacity:0.7;margin-bottom:6px;">Notre adresse email</div>
      <div class="contact-email">${CONTACT_EMAIL}</div>
    </div>

    <a class="btn-mailto" href="mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}">✉️ Envoyer un email</a>

    <div class="info-section" style="margin-top:20px;">
      <p style="font-size:13px;opacity:0.6;text-align:center;">
        On répond généralement sous 48h.<br>
        Tu peux aussi simplement copier l'adresse ci-dessus.
      </p>
    </div>
  `;
}

function renderAbout() {
  const year = new Date().getFullYear();
  return `
    <h2>ℹ️ À propos</h2>
    <p class="info-subtitle">L'app de gestion de tâches pour les étudiants</p>

    <div class="info-section">
      <p class="about-tagline">
        <b>Nexora</b> est née d'un constat simple : les étudiants jonglent avec
        des dizaines de devoirs, contrôles et révisions chaque semaine —
        et la plupart des outils existants sont trop compliqués ou pas pensés pour eux.
      </p>
      <p class="about-tagline">
        L'idée : une app <b>rapide, gratuite et sans prise de tête</b>. Tu écris ce que tu as à faire,
        Nexora s'occupe de prioriser. Tu coches quand c'est fini. C'est tout.
      </p>
    </div>

    <div class="info-section">
      <h3>Créateur</h3>
      <p>Imaginé et développé par <b>${CREATOR_NAME}</b>, étudiant et passionné de productivité.</p>
    </div>

    <div class="info-section">
      <h3>Vie privée</h3>
      <p>Tes tâches t'appartiennent. Elles sont stockées de façon sécurisée et personne d'autre que toi ne peut y accéder.</p>
    </div>

    <div class="about-meta">
      <span>Version ${APP_VERSION}</span>
      <span>© ${year} Nexora</span>
      <span>Fait avec ❤️</span>
    </div>
  `;
}

// ==========================================
//  RACCOURCIS CLAVIER GLOBAUX
// ==========================================

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const authModal = document.getElementById("auth-modal");
    if (authModal.classList.contains("open")) {
      submitAuth();
    }
  }
  if (e.key === "Escape") {
    const authModal = document.getElementById("auth-modal");
    if (authModal.classList.contains("open")) hideAuthModal();
    const infoModal = document.getElementById("info-modal");
    if (infoModal.classList.contains("open")) hideInfoModal();
  }
});

document.addEventListener("click", (e) => {
  const menu = document.getElementById("more-dropdown");
  const moreBtn = document.querySelector(".more-btn");
  if (menu && menu.classList.contains("open") && !menu.contains(e.target) && e.target !== moreBtn) {
    menu.classList.remove("open");
    menu.classList.add("closed");
  }
});

// ==========================================
//  GO
// ==========================================
initAuth();
