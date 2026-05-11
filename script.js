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
let editingCatIndex = null; // index de la catégorie en cours d'édition (null si aucune)
let isAddingCat = false;     // true si on ajoute une nouvelle catégorie

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
  const loggedIn = document.getElementById("auth-buttons-logged-in");
  const appView = document.getElementById("app-view");
  const landingView = document.getElementById("landing-view");
  const headerInner = document.querySelector(".header-inner");

  if (currentUser) {
    document.body.classList.remove("logged-out");
    if (loggedIn) loggedIn.style.display = "flex";
    if (headerInner) headerInner.style.justifyContent = "space-between";
    appView.style.display = "block";
    landingView.style.display = "none";
    updateAvatarUI();
    updateHero();
    scheduleTodayNotifications();
  } else {
    document.body.classList.add("logged-out");
    if (loggedIn) loggedIn.style.display = "none";
    if (headerInner) headerInner.style.justifyContent = "center";
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
  const fn = document.getElementById("auth-firstname");
  const ln = document.getElementById("auth-lastname");
  if (fn) fn.value = "";
  if (ln) ln.value = "";

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
  const nameFields = document.getElementById("auth-name-fields");
  if (nameFields) nameFields.style.display = authMode === "login" ? "none" : "block";
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
      const firstName = document.getElementById("auth-firstname").value.trim();
      const lastName = document.getElementById("auth-lastname").value.trim();
      if (!firstName) {
        errorEl.textContent = "Ton prénom est requis.";
        return;
      }
      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { first_name: firstName, last_name: lastName } }
      });
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
//  🎨 CATÉGORIES / MATIÈRES
// ==========================================

const DEFAULT_CATEGORIES = [
  { name: "Maths", color: "#3b82f6", icon: "📐", keywords: ["maths","math","mathématique","mathematique","mathématiques","mathematiques","algèbre","algebre","géométrie","geometrie","calcul","fonction","équation","equation","fractions","statistiques","statistique"] },
  { name: "Français", color: "#ef4444", icon: "📖", keywords: ["français","francais","dissertation","littérature","litterature","roman","poésie","poesie","commentaire de texte","grammaire","conjugaison","orthographe"] },
  { name: "Histoire-Géo", color: "#f59e0b", icon: "🗺️", keywords: ["histoire","géo","geo","géographie","geographie","géopolitique","geopolitique","hist-géo","hist","révolution","revolution","seconde guerre","première guerre","premiere guerre"] },
  { name: "SVT", color: "#22c55e", icon: "🌱", keywords: ["svt","biologie","bio","sciences nature","écologie","ecologie","génétique","genetique","cellule","adn","géologie","geologie"] },
  { name: "Anglais", color: "#a855f7", icon: "🇬🇧", keywords: ["anglais","english","ang"] },
  { name: "Physique-Chimie", color: "#06b6d4", icon: "⚗️", keywords: ["physique","chimie","phys","physique-chimie","mécanique","mecanique","électricité","electricite","atome","molécule","molecule","réaction","reaction"] },
  { name: "Espagnol", color: "#f97316", icon: "🇪🇸", keywords: ["espagnol","esp","español","espanol","spanish"] },
  { name: "Philo", color: "#6b7280", icon: "💭", keywords: ["philo","philosophie","dissertation philo"] },
  { name: "EPS", color: "#ec4899", icon: "⚽", keywords: ["eps","sport","gym","gymnastique","course","natation","muscul","football","basket","tennis"] }
];

const COLOR_PALETTE = [
  "#3b82f6", "#ef4444", "#f59e0b", "#22c55e",
  "#a855f7", "#06b6d4", "#f97316", "#ec4899",
  "#6b7280", "#14b8a6", "#84cc16", "#0ea5e9"
];

const ICON_PALETTE = [
  "📐", "📖", "🗺️", "🌱", "🇬🇧", "⚗️",
  "🇪🇸", "💭", "⚽", "🎨", "🎵", "💻",
  "📚", "🔬", "⚖️", "🌍", "🧠", "✏️"
];

function getCategories() {
  return currentUser?.user_metadata?.categories || DEFAULT_CATEGORIES;
}

function getCategoryByName(name) {
  if (!name) return null;
  const cats = getCategories();
  return cats.find(c => c.name.toLowerCase() === name.toLowerCase()) || null;
}

function detectCategory(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  const cats = getCategories();
  for (const cat of cats) {
    for (const kw of (cat.keywords || [])) {
      const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(lower)) return cat.name;
    }
  }
  return null;
}

async function saveCategories(cats) {
  const { error } = await db.auth.updateUser({ data: { categories: cats } });
  if (error) { console.error("CAT SAVE ERROR =", error); return false; }
  if (currentUser) {
    currentUser.user_metadata = { ...(currentUser.user_metadata || {}), categories: cats };
  }
  return true;
}

async function startEditCategory(index) {
  editingCatIndex = index;
  isAddingCat = false;
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

async function startAddCategory() {
  isAddingCat = true;
  editingCatIndex = null;
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

function cancelEditCategory() {
  editingCatIndex = null;
  isAddingCat = false;
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

async function saveEditCategory() {
  const nameEl = document.getElementById("cat-edit-name");
  if (!nameEl) return;
  const name = nameEl.value.trim();
  if (!name) {
    nameEl.style.borderColor = "#ef4444";
    return;
  }
  const selectedColor = document.querySelector(".cat-color-cell.selected")?.dataset.color || COLOR_PALETTE[0];
  const selectedIcon = document.querySelector(".cat-icon-cell.selected")?.dataset.icon || "📚";

  const cats = [...getCategories()];

  if (isAddingCat) {
    cats.push({ name, color: selectedColor, icon: selectedIcon, keywords: [name.toLowerCase()] });
  } else if (editingCatIndex !== null) {
    cats[editingCatIndex] = {
      ...cats[editingCatIndex],
      name,
      color: selectedColor,
      icon: selectedIcon
    };
  }

  await saveCategories(cats);
  editingCatIndex = null;
  isAddingCat = false;
  render(); // refresh tasks (badges might change)
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

async function deleteCategory(index) {
  const cats = [...getCategories()];
  const cat = cats[index];
  if (!cat) return;

  const confirmed = await showConfirm({
    icon: "🗑️",
    title: `Supprimer "${cat.name}"`,
    message: `La matière sera retirée de tes tâches existantes (qui resteront, juste sans matière).`,
    confirmText: "Supprimer",
    danger: true
  });
  if (!confirmed) return;

  cats.splice(index, 1);
  await saveCategories(cats);

  // Retire la catégorie des tâches en BDD
  const tasksWithCat = tasks.filter(t => t.category === cat.name);
  if (tasksWithCat.length > 0) {
    const ids = tasksWithCat.map(t => t.id);
    await db.from("tasks").update({ category: null }).in("id", ids);
    await loadTasks();
  } else {
    render();
  }

  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

async function resetCategories() {
  const confirmed = await showConfirm({
    icon: "🔄",
    title: "Réinitialiser les matières",
    message: "Tes matières seront remplacées par les 9 matières par défaut. Les tâches existantes garderont leurs catégories actuelles si elles existent encore.",
    confirmText: "Réinitialiser",
    danger: true
  });
  if (!confirmed) return;

  await saveCategories(DEFAULT_CATEGORIES);
  editingCatIndex = null;
  isAddingCat = false;
  render();
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCategories();
}

function renderCategories() {
  const cats = getCategories();

  // Mode édition / ajout
  if (editingCatIndex !== null || isAddingCat) {
    const cat = isAddingCat
      ? { name: "", color: COLOR_PALETTE[0], icon: "📚" }
      : cats[editingCatIndex];

    const colorCells = COLOR_PALETTE.map(c => `
      <div class="cat-color-cell ${c === cat.color ? 'selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectCatColor('${c}')"></div>
    `).join("");

    const iconCells = ICON_PALETTE.map(i => `
      <div class="cat-icon-cell ${i === cat.icon ? 'selected' : ''}" data-icon="${i}" onclick="selectCatIcon('${i}')">${i}</div>
    `).join("");

    return `
      <h2>🎨 ${isAddingCat ? "Nouvelle matière" : "Modifier la matière"}</h2>
      <p class="info-subtitle">Personnalise ta matière comme tu veux</p>

      <div class="cat-edit-form">
        <div class="cat-edit-form-title">Nom</div>
        <input type="text" id="cat-edit-name" class="cat-edit-input" placeholder="Ex: Anglais, Maths..." maxlength="30" value="${cat.name.replace(/"/g, '&quot;')}">

        <div class="cat-edit-form-title">Couleur</div>
        <div class="cat-color-picker">${colorCells}</div>

        <div class="cat-edit-form-title">Icône</div>
        <div class="cat-icon-picker">${iconCells}</div>

        <div class="cat-edit-actions">
          <button class="btn secondary" onclick="cancelEditCategory()">Annuler</button>
          <button class="btn primary" onclick="saveEditCategory()">${isAddingCat ? "Ajouter" : "Enregistrer"}</button>
        </div>
      </div>
    `;
  }

  // Mode liste
  const rows = cats.map((c, i) => `
    <div class="cat-row">
      <div class="cat-row-icon">${c.icon || "📚"}</div>
      <div class="cat-row-color" style="background:${c.color}"></div>
      <div class="cat-row-name">${c.name}</div>
      <div class="cat-row-actions">
        <button class="cat-icon-btn" onclick="startEditCategory(${i})" title="Modifier">✏️</button>
        <button class="cat-icon-btn danger" onclick="deleteCategory(${i})" title="Supprimer">🗑️</button>
      </div>
    </div>
  `).join("");

  return `
    <h2>🎨 Mes matières</h2>
    <p class="info-subtitle">Tes tâches sont automatiquement classées dans ces matières</p>

    <div class="cat-list">${rows}</div>

    <button class="cat-add-btn" onclick="startAddCategory()">+ Ajouter une matière</button>

    <button class="cat-reset-link" onclick="resetCategories()">↻ Réinitialiser aux matières par défaut</button>
  `;
}

function selectCatColor(color) {
  document.querySelectorAll(".cat-color-cell").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(`.cat-color-cell[data-color="${color}"]`).forEach(c => c.classList.add("selected"));
}

function selectCatIcon(icon) {
  document.querySelectorAll(".cat-icon-cell").forEach(c => c.classList.remove("selected"));
  document.querySelectorAll(".cat-icon-cell").forEach(c => {
    if (c.dataset.icon === icon) c.classList.add("selected");
  });
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
    category: detectCategory(t), // 🆕 catégorie auto-détectée
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

  const justCompleted = !currentDone;
  if (justCompleted && activeBeforeCount === 1) {
    celebrate(id);
    await new Promise(r => setTimeout(r, 2000));
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
      time: getTime(newText),
      category: detectCategory(newText) // 🆕 re-détecte la catégorie
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

  const n = doneTasks.length;
  const confirmed = await showConfirm({
    icon: "🗑️",
    title: "Vider les tâches terminées",
    message: `Tu vas supprimer définitivement ${n} tâche${n > 1 ? "s" : ""} terminée${n > 1 ? "s" : ""}. Cette action est irréversible.`,
    confirmText: "Supprimer",
    danger: true
  });
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

  if (active.length === 0 && done.length === 0) {
    document.getElementById("output").innerHTML = `
      <div class="empty-state-big">
        <span class="empty-state-big-emoji">🌱</span>
        <div class="empty-state-big-title">Tout est calme par ici</div>
        <div class="empty-state-big-sub">Ajoute ta première tâche pour démarrer.<br>Tu peux en mettre plusieurs d'un coup avec <b>+</b>, <b>,</b> ou <b>/</b>.</div>
      </div>
    `;
    updateHero();
    return;
  }

  let html = `<h2>Tes tâches</h2>
    <div class="done-section">
      <div class="done-header" onclick="toggleActiveSection()">Tâches en cours (${active.length})</div>
      <div id="active-list" class="open">`;

  if (active.length === 0) {
    html += `
      <div class="empty-state-small">
        <span class="empty-state-small-emoji">✨</span>
        Tout est terminé ! Profite ou ajoute-en de nouvelles.
      </div>`;
  } else {
    active.forEach((t) => {
      const safeText = t.text.replace(/"/g, "&quot;");
      const due = getDueDate(t.text);
      const dueBadge = due ? `<span class="due-badge ${due.urgency}">${due.label}</span>` : '';

      // 🆕 Badge catégorie
      const cat = t.category ? getCategoryByName(t.category) : null;
      const catBadge = cat
        ? `<span class="cat-badge" style="background:${cat.color}22;color:${cat.color};border-color:${cat.color}66">${cat.icon || "📚"} ${cat.name}</span>`
        : '';

      html += `<div class="task ${t.priority}" id="task-${t.id}">
        <button class="check-btn" onclick="toggleTask(${t.id}, ${t.done})"></button>
        <div class="task-content">
          <div class="task-header-row">
            <b class="task-text"
               contenteditable="true"
               spellcheck="false"
               data-id="${t.id}"
               data-original="${safeText}"
               onkeydown="handleEditKey(event, this)"
               onblur="finishEdit(this)">${t.text}</b>
            ${catBadge}
            ${dueBadge}
          </div>
          <div class="task-meta">priorité : ${t.priority}</div>
        </div>
      </div>`;
    });
  }
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
  updateHero();
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
  const profile = document.getElementById("profile-dropdown");
  if (profile) {
    profile.classList.remove("open");
    profile.classList.add("closed");
  }
}

// ==========================================
//  HELPERS — détection priorité / temps / date
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

function getDueDate(text) {
  const lower = text.toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const build = (date, label) => {
    const days = Math.round((date - today) / 86400000);
    let urgency = 'later';
    if (days <= 1) urgency = 'today';
    else if (days <= 3) urgency = 'soon';
    else if (days <= 7) urgency = 'week';
    return { date, label, urgency };
  };

  if (/\b(aujourd'?hui|ce soir|ce midi|cette aprem|cet aprem|ce matin|maintenant|tout de suite|asap)\b/.test(lower)) {
    return build(today, "Auj.");
  }
  if (/\bdemain\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 1);
    return build(d, "Demain");
  }
  if (/\b(après[- ]?demain|apres[- ]?demain)\b/.test(lower)) {
    const d = new Date(today); d.setDate(d.getDate() + 2);
    return build(d, "+2j");
  }

  const months = { janvier:0, février:1, fevrier:1, mars:2, avril:3, mai:4, juin:5, juillet:6, août:7, aout:7, septembre:8, octobre:9, novembre:10, décembre:11, decembre:11 };
  const dateMatch = lower.match(/\b(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\b/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = months[dateMatch[2]];
    let d = new Date(today.getFullYear(), month, day);
    if (d < today) d = new Date(today.getFullYear() + 1, month, day);
    return build(d, `${day} ${dateMatch[2].slice(0, 3)}.`);
  }

  const dayNames = { dimanche:0, lundi:1, mardi:2, mercredi:3, jeudi:4, vendredi:5, samedi:6 };
  const dayMatch = lower.match(/\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/);
  if (dayMatch) {
    const target = dayNames[dayMatch[1]];
    let diff = target - today.getDay();
    if (diff <= 0) diff += 7;
    const d = new Date(today); d.setDate(d.getDate() + diff);
    const label = dayMatch[1].charAt(0).toUpperCase() + dayMatch[1].slice(1, 3) + '.';
    return build(d, label);
  }

  return null;
}

// ==========================================
//  ⚠️ MODAL DE CONFIRMATION GÉNÉRIQUE
// ==========================================

let confirmResolve = null;

function showConfirm(options = {}) {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    document.getElementById("confirm-icon").textContent = options.icon || "⚠️";
    document.getElementById("confirm-title").textContent = options.title || "Confirmation";
    document.getElementById("confirm-message").textContent = options.message || "Es-tu sûr ?";

    const btn = document.getElementById("confirm-ok-btn");
    btn.textContent = options.confirmText || "Confirmer";
    btn.classList.remove("primary", "danger");
    btn.classList.add(options.danger ? "danger" : "primary");

    const modal = document.getElementById("confirm-modal");
    modal.classList.remove("closed");
    modal.classList.add("open");
  });
}

function hideConfirm() {
  const modal = document.getElementById("confirm-modal");
  modal.classList.remove("open");
  modal.classList.add("closed");
}

function confirmOk() {
  hideConfirm();
  if (confirmResolve) { confirmResolve(true); confirmResolve = null; }
}

function confirmCancel() {
  hideConfirm();
  if (confirmResolve) { confirmResolve(false); confirmResolve = null; }
}

// ==========================================
//  🌟 ACCUEIL PERSONNALISÉ + STATS
// ==========================================

function getDisplayName() {
  if (!currentUser) return "toi";
  const fn = currentUser.user_metadata?.first_name;
  if (fn && fn.trim()) {
    const trimmed = fn.trim();
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  if (!currentUser.email) return "toi";
  const prefix = currentUser.email.split("@")[0];
  const firstPart = prefix.split(/[._-]/)[0];
  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
}

function getSalutation() {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function getFormattedDate() {
  const days = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  const now = new Date();
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

function updateHero() {
  const greetingEl = document.getElementById("greeting");
  const dateEl = document.getElementById("date-line");
  const pillsEl = document.getElementById("stats-pills");
  if (!greetingEl || !dateEl || !pillsEl || !currentUser) return;

  const avatar = getCurrentAvatar();
  const wave = avatar || "👋";
  greetingEl.textContent = `${getSalutation()}, ${getDisplayName()} ${wave}`;

  const active = tasks.filter(t => !t.done).length;
  const done = tasks.filter(t => t.done).length;
  const total = active + done;
  const completion = total > 0 ? Math.round((done / total) * 100) : 0;

  let summary;
  if (total === 0) summary = "Prêt à démarrer ?";
  else if (active === 0) summary = "Tout est terminé, bravo !";
  else if (active === 1) summary = "1 tâche t'attend";
  else summary = `${active} tâches t'attendent`;

  dateEl.textContent = `${getFormattedDate()} · ${summary}`;

  if (total === 0) {
    pillsEl.innerHTML = "";
  } else {
    pillsEl.innerHTML = `
      <span class="stat-pill"><span class="stat-pill-icon">🎯</span>${active} active${active > 1 ? "s" : ""}</span>
      <span class="stat-pill"><span class="stat-pill-icon">✅</span>${done} terminée${done > 1 ? "s" : ""}</span>
      <span class="stat-pill accent"><span class="stat-pill-icon">📊</span>${completion}% complétion</span>
    `;
  }
}

// ==========================================
//  🔔 NOTIFICATIONS
// ==========================================

function getNotificationSettings() {
  return currentUser?.user_metadata?.notifications || {
    enabled: false,
    times: ["09:00", "13:00", "18:00"]
  };
}

async function saveNotificationSettings(settings) {
  const { error } = await db.auth.updateUser({ data: { notifications: settings } });
  if (error) { console.error("NOTIF SAVE ERROR =", error); return false; }
  if (currentUser) {
    currentUser.user_metadata = { ...(currentUser.user_metadata || {}), notifications: settings };
  }
  scheduleTodayNotifications();
  return true;
}

async function requestNotifPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return await Notification.requestPermission();
}

let notifTimeouts = [];

function scheduleTodayNotifications() {
  notifTimeouts.forEach((t) => clearTimeout(t));
  notifTimeouts = [];

  const s = getNotificationSettings();
  if (!s.enabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = new Date();
  s.times.forEach((timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target <= now) return;
    const delay = target - now;
    const t = setTimeout(() => fireReminder(timeStr), delay);
    notifTimeouts.push(t);
  });
  console.log(`Notifs planifiées : ${notifTimeouts.length} aujourd'hui`);
}

async function fireReminder() {
  const active = tasks.filter((t) => !t.done);
  if (active.length === 0) return;

  const urgent = active.filter((t) => t.priority === "urgent").length;
  let body;
  if (urgent > 0) body = `${urgent} tâche${urgent > 1 ? "s" : ""} urgente${urgent > 1 ? "s" : ""} ! ${active.length} en tout.`;
  else if (active.length === 1) body = `1 tâche en cours : ${active[0].text}`;
  else body = `Tu as ${active.length} tâches en cours. Allez, on s'y met !`;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("📚 Nexora", {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "nexora-reminder",
      renotify: true,
      vibrate: [100, 50, 100]
    });
  } catch (e) {
    console.error("Notif error:", e);
  }
}

async function testNotification() {
  console.log("=== TEST NOTIFICATION ===");
  console.log("Notification.permission:", typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  const perm = await requestNotifPermission();
  console.log("Permission après demande :", perm);

  if (perm !== "granted") {
    showConfirm({
      icon: "🚫",
      title: "Permission refusée",
      message: perm === "unsupported"
        ? "Ton navigateur ne supporte pas les notifications. Sur iPhone : iOS 16.4+ + app installée requis."
        : "Autorise les notifications dans les réglages de ton navigateur ou de ton téléphone.",
      confirmText: "OK"
    });
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    console.log("SW ready, on envoie la notif...");
    await reg.showNotification("📚 Nexora", {
      body: "Test réussi ! 🎉 Tes rappels sont prêts.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "nexora-test",
      vibrate: [100, 50, 100]
    });
    console.log("✅ Notification envoyée");
  } catch (e) {
    console.error("❌ Erreur notif :", e);
    showConfirm({
      icon: "⚠️",
      title: "Erreur d'envoi",
      message: "Une erreur est survenue. Détails dans la console (F12).",
      confirmText: "OK"
    });
  }
}

async function toggleNotifEnabled(checkbox) {
  if (checkbox.checked) {
    const perm = await requestNotifPermission();
    if (perm !== "granted") {
      checkbox.checked = false;
      showConfirm({
        icon: "🚫",
        title: "Permission refusée",
        message: perm === "unsupported"
          ? "Ton navigateur ne supporte pas les notifications. Sur iPhone, installe d'abord Nexora sur ton écran d'accueil et utilise iOS 16.4+."
          : "Autorise les notifications dans les réglages de ton téléphone pour utiliser cette fonctionnalité.",
        confirmText: "OK"
      });
      return;
    }
  }
  const s = getNotificationSettings();
  s.enabled = checkbox.checked;
  await saveNotificationSettings(s);
  document.getElementById("info-modal-body").innerHTML = renderNotifications();
}

async function updateNotifTime(index, value) {
  const s = getNotificationSettings();
  s.times[index] = value;
  await saveNotificationSettings(s);
}

async function addNotifTime() {
  const s = getNotificationSettings();
  if (s.times.length >= 6) return;
  s.times.push("12:00");
  await saveNotificationSettings(s);
  document.getElementById("info-modal-body").innerHTML = renderNotifications();
}

async function removeNotifTime(index) {
  const s = getNotificationSettings();
  if (s.times.length <= 1) return;
  s.times.splice(index, 1);
  await saveNotificationSettings(s);
  document.getElementById("info-modal-body").innerHTML = renderNotifications();
}

function renderNotifications() {
  const s = getNotificationSettings();
  const supported = "Notification" in window;
  const permission = supported ? Notification.permission : "unsupported";

  let permBadge = "";
  if (!supported) permBadge = `<div class="notif-warn">⚠️ Ton navigateur ne supporte pas les notifications.</div>`;
  else if (permission === "denied") permBadge = `<div class="notif-warn">🚫 Notifications bloquées dans tes réglages.</div>`;

  const timeRows = s.times.map((t, i) => `
    <div class="notif-time-row">
      <input type="time" class="notif-time-input" value="${t}" onchange="updateNotifTime(${i}, this.value)" ${!s.enabled ? 'disabled' : ''}>
      ${s.times.length > 1 ? `<button class="notif-time-remove" onclick="removeNotifTime(${i})" ${!s.enabled ? 'disabled' : ''}>✕</button>` : ''}
    </div>
  `).join("");

  return `
    <h2>🔔 Notifications</h2>
    <p class="info-subtitle">Reçois des rappels de tes tâches en cours</p>

    ${permBadge}

    <div class="notif-toggle-row">
      <div>
        <div class="notif-toggle-title">Activer les rappels</div>
        <div class="notif-toggle-sub">Notifications aux horaires choisis</div>
      </div>
      <label class="switch">
        <input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleNotifEnabled(this)">
        <span class="slider"></span>
      </label>
    </div>

    <div class="notif-times-section ${!s.enabled ? 'disabled' : ''}">
      <div class="notif-section-title">⏰ Horaires des rappels</div>
      ${timeRows}
      ${s.times.length < 6 ? `<button class="notif-add-time" onclick="addNotifTime()" ${!s.enabled ? 'disabled' : ''}>+ Ajouter un horaire</button>` : ''}
    </div>

    <div class="notif-test-section">
      <button class="btn primary" onclick="testNotification()">📤 Envoyer une notif de test</button>
    </div>

    <div class="notif-info">
      <p><b>📌 À savoir</b></p>
      <p>Les rappels arrivent quand l'app est ouverte ou récente en arrière-plan. Pour des notifs même app fermée, on ajoutera plus tard un serveur push.</p>
      <p>Sur iPhone : nécessite iOS 16.4+ et Nexora installé sur l'écran d'accueil.</p>
    </div>
  `;
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

function celebrate(taskId) {
  if (typeof confetti !== "function") return;
  showCompletionToast();

  let originX = 0.5, originY = 0.5;
  const taskEl = document.getElementById(`task-${taskId}`);
  if (taskEl) {
    const btn = taskEl.querySelector(".check-btn");
    if (btn) {
      const rect = btn.getBoundingClientRect();
      originX = (rect.left + rect.width / 2) / window.innerWidth;
      originY = (rect.top + rect.height / 2) / window.innerHeight;
    }
  }

  confetti({
    particleCount: 22,
    spread: 55,
    startVelocity: 16,
    decay: 0.88,
    ticks: 90,
    origin: { x: originX, y: originY },
    colors: ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"]
  });
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
//  📊 MODALS INFO
// ==========================================

const CONTACT_EMAIL = "nexora.app@proton.me";
const CREATOR_NAME = "Nicolas";
const APP_VERSION = "0.2";

function showInfoModal(type) {
  const menu = document.getElementById("more-dropdown");
  if (menu) {
    menu.classList.remove("open");
    menu.classList.add("closed");
  }

  // Reset cat editing state when opening categories
  if (type === "categories") {
    editingCatIndex = null;
    isAddingCat = false;
  }

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
  if (type === "notifications") return renderNotifications();
  if (type === "avatar") return renderAvatar();
  if (type === "categories") return renderCategories();
  if (type === "focus") return renderFocusStarter();
  if (type === "dashboard") return renderDashboard();
  if (type === "support") return renderSupport();
  if (type === "contact") return renderContact();
  if (type === "about") return renderAbout();
  if (type === "install-ios") return renderInstallIOS();
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
      <div class="stat-card"><div class="stat-value">${active}</div><div class="stat-label">En cours</div></div>
      <div class="stat-card"><div class="stat-value">${done}</div><div class="stat-label">Terminées</div></div>
      <div class="stat-card accent"><div class="stat-value">${completion}%</div><div class="stat-label">Complétion</div></div>
      <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Total</div></div>
    </div>

    <div class="info-section">
      <h3>Répartition des tâches en cours</h3>
      ${active === 0 ? `<p style="opacity:0.6;font-size:13px;">Aucune tâche en cours 🎉</p>` : `
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
      <p>Nexora analyse le texte pour deviner la priorité, la matière et l'échéance.</p>
      <ul>
        <li><b>Urgent</b> : examen, contrôle, oral, demain, urgent…</li>
        <li><b>Medium</b> : DM, devoir, projet, révision, lundi…</li>
        <li><b>Matières</b> : maths, français, histoire, SVT, anglais…</li>
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
      <h3>Personnaliser</h3>
      <p>Va dans <b>🎨 Mes matières</b> pour ajouter, renommer ou recolorer les matières détectées.</p>
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
        On répond généralement sous 48h.<br>Tu peux aussi simplement copier l'adresse ci-dessus.
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

function renderInstallIOS() {
  return `
    <h2>📲 Installer Nexora</h2>
    <p class="info-subtitle">Sur iPhone / iPad, en 3 étapes</p>
    <div class="install-step">
      <div class="install-step-num">1</div>
      <div class="install-step-text">Appuie sur le bouton <b>Partager</b>
        <span class="ios-share-icon">⎙</span> en bas de Safari</div>
    </div>
    <div class="install-step">
      <div class="install-step-num">2</div>
      <div class="install-step-text">Fais défiler et appuie sur <b>"Sur l'écran d'accueil"</b></div>
    </div>
    <div class="install-step">
      <div class="install-step-num">3</div>
      <div class="install-step-text">Appuie sur <b>Ajouter</b> en haut à droite</div>
    </div>
    <div class="info-section" style="margin-top:20px;">
      <p style="font-size:13px;opacity:0.6;text-align:center;">
        L'icône Nexora apparaîtra avec tes autres apps.<br>
        Tu pourras la lancer comme une vraie app native ! ✨
      </p>
    </div>
  `;
}

// ==========================================
//  RACCOURCIS CLAVIER GLOBAUX
// ==========================================

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const authModal = document.getElementById("auth-modal");
    if (authModal && authModal.classList.contains("open")) submitAuth();
    const confirmModal = document.getElementById("confirm-modal");
    if (confirmModal && confirmModal.classList.contains("open")) confirmOk();
  }
  if (e.key === "Escape") {
    const authModal = document.getElementById("auth-modal");
    if (authModal && authModal.classList.contains("open")) hideAuthModal();
    const infoModal = document.getElementById("info-modal");
    if (infoModal && infoModal.classList.contains("open")) hideInfoModal();
    const confirmModal = document.getElementById("confirm-modal");
    if (confirmModal && confirmModal.classList.contains("open")) confirmCancel();
  }
});

document.addEventListener("click", (e) => {
  const moreMenu = document.getElementById("more-dropdown");
  const moreBtn = document.querySelector(".more-btn");
  if (moreMenu && moreMenu.classList.contains("open") && !moreMenu.contains(e.target) && e.target !== moreBtn) {
    moreMenu.classList.remove("open");
    moreMenu.classList.add("closed");
  }

  const profileMenu = document.getElementById("profile-dropdown");
  const profileBtn = document.getElementById("profile-btn");
  if (profileMenu && profileMenu.classList.contains("open") && !profileMenu.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
    profileMenu.classList.remove("open");
    profileMenu.classList.add("closed");
  }

  const authModal = document.getElementById("auth-modal");
  if (e.target === authModal) hideAuthModal();
  const infoModal = document.getElementById("info-modal");
  if (e.target === infoModal) hideInfoModal();
  const resetModal = document.getElementById("reset-modal");
  if (e.target === resetModal) hideResetModal();
  const confirmModal = document.getElementById("confirm-modal");
  if (e.target === confirmModal) confirmCancel();
});

// ==========================================
//  🎭 AVATAR / PROFIL
// ==========================================

const AVATAR_CATEGORIES = {
  "Smileys": ["😀","😎","🥰","😴","🤓","😇","🥳","🤩","😏","🙃","☺️","😋","🤔","😌","🥹","🤗","😈","🤡","🥸","🫠","😤","🥺","🤠","🫡"],
  "Animaux": ["🐶","🐱","🦊","🐼","🐨","🦁","🐯","🐸","🐵","🦉","🦄","🐉","🦋","🐙","🐢","🦖","🐺","🐻","🐰","🦔","🐧","🦦","🦥","🐳"],
  "Films": ["🎬","🍿","🎭","🎞️","📽️","🎥","⭐","🎟️","👻","🧛","🧟","💀","🦇","🕷️","🗡️","💣","🔫","🎩"],
  "Jeux": ["🎮","🕹️","👾","🎲","♟️","🃏","🎯","🏆","⚔️","🛡️","🏹","🧙","🐲","💎","🗝️","⚗️","🪄","🧿"],
  "Musique": ["🎵","🎶","🎸","🎹","🎷","🥁","🎻","🎤","🎧","📻","🎼","🎺","🪕","🪗","💿","📀"],
  "Sport": ["⚽","🏀","🎾","🏈","⚾","🏐","🏓","🥋","🏊","🚴","🏃","🥊","⛷️","🏂","🥇","🛹","🏄","🤺"],
  "Nature": ["🌸","🌹","🌻","🌵","🌴","🌲","🍀","🍄","🌈","☀️","🌙","⭐","⚡","🔥","🌊","❄️","🌺","🌷"],
  "Food": ["🍕","🍔","🍟","🌮","🍣","🍰","🍪","🍩","🍦","🍓","🍎","🥑","🍉","🌶️","☕","🍵","🍫","🥨","🍜","🥟"],
  "Geek": ["🤖","👨‍💻","💻","⌨️","🖱️","📱","⚙️","🚀","🛸","🛰️","💡","🔭","🧪","🧬","⚛️","🦾"]
};

let currentAvatarTab = "Smileys";

function getCurrentAvatar() {
  return currentUser?.user_metadata?.avatar || null;
}

function getAvatarFallback() {
  const fn = currentUser?.user_metadata?.first_name;
  if (fn && fn.trim()) return fn.trim().charAt(0).toUpperCase();
  return (currentUser?.email || "?").charAt(0).toUpperCase();
}

function updateAvatarUI() {
  const el = document.getElementById("profile-avatar");
  const emailEl = document.getElementById("profile-email");
  if (!el) return;
  const avatar = getCurrentAvatar();
  if (avatar) {
    el.textContent = avatar;
    el.style.fontSize = "20px";
  } else {
    el.textContent = getAvatarFallback();
    el.style.fontSize = "16px";
  }
  if (emailEl && currentUser) emailEl.textContent = currentUser.email;
}

function toggleProfileMenu() {
  const menu = document.getElementById("profile-dropdown");
  menu.classList.toggle("open");
  menu.classList.toggle("closed");
  const other = document.getElementById("more-dropdown");
  if (other) {
    other.classList.remove("open");
    other.classList.add("closed");
  }
}

async function setAvatar(emoji) {
  const { error } = await db.auth.updateUser({ data: { avatar: emoji } });
  if (error) { console.error("AVATAR SAVE ERROR =", error); return; }
  if (currentUser) {
    currentUser.user_metadata = { ...(currentUser.user_metadata || {}), avatar: emoji };
  }
  updateAvatarUI();
  updateHero();
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderAvatar();
}

async function resetAvatar() {
  const { error } = await db.auth.updateUser({ data: { avatar: null } });
  if (error) { console.error("AVATAR RESET ERROR =", error); return; }
  if (currentUser) {
    currentUser.user_metadata = { ...(currentUser.user_metadata || {}), avatar: null };
  }
  updateAvatarUI();
  updateHero();
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderAvatar();
}

function setAvatarTab(name) {
  currentAvatarTab = name;
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderAvatar();
}

async function saveProfileName() {
  const firstNameEl = document.getElementById("profile-firstname");
  const lastNameEl = document.getElementById("profile-lastname");
  if (!firstNameEl || !lastNameEl) return;

  const firstName = firstNameEl.value.trim();
  const lastName = lastNameEl.value.trim();

  const currentFn = currentUser?.user_metadata?.first_name || "";
  const currentLn = currentUser?.user_metadata?.last_name || "";
  if (firstName === currentFn && lastName === currentLn) return;

  const { error } = await db.auth.updateUser({
    data: { first_name: firstName, last_name: lastName }
  });
  if (error) { console.error("PROFILE NAME SAVE ERROR =", error); return; }

  if (currentUser) {
    currentUser.user_metadata = {
      ...(currentUser.user_metadata || {}),
      first_name: firstName,
      last_name: lastName
    };
  }

  updateHero();
  updateAvatarUI();
  console.log("✅ Profil mis à jour :", firstName, lastName);
}

function renderAvatar() {
  const current = getCurrentAvatar();
  const fallback = getAvatarFallback();
  const previewContent = current || fallback;
  const fn = currentUser?.user_metadata?.first_name || "";
  const ln = currentUser?.user_metadata?.last_name || "";

  const tabs = Object.keys(AVATAR_CATEGORIES).map(name => `
    <button class="avatar-tab ${name === currentAvatarTab ? 'active' : ''}" onclick="setAvatarTab('${name}')">${name}</button>
  `).join('');

  const cells = AVATAR_CATEGORIES[currentAvatarTab].map(emoji => `
    <div class="avatar-cell ${emoji === current ? 'selected' : ''}" onclick="setAvatar('${emoji}')">${emoji}</div>
  `).join('');

  return `
    <h2>👤 Mon profil</h2>
    <p class="info-subtitle">Personnalise ton apparence dans Nexora</p>

    <div class="profile-name-section">
      <label class="profile-input-label">Prénom</label>
      <input type="text" id="profile-firstname" class="profile-input" placeholder="Ton prénom" maxlength="50" value="${fn.replace(/"/g, '&quot;')}" onblur="saveProfileName()">

      <label class="profile-input-label">Nom (optionnel)</label>
      <input type="text" id="profile-lastname" class="profile-input" placeholder="Ton nom" maxlength="50" value="${ln.replace(/"/g, '&quot;')}" onblur="saveProfileName()">
    </div>

    <div class="profile-section-divider"></div>

    <p class="info-subtitle" style="margin-top:0;">Choisis l'emoji qui te représente</p>

    <div class="avatar-current">
      <div class="avatar-current-preview">${previewContent}</div>
      <div class="avatar-current-text">
        <div class="avatar-current-title">${current ? 'Avatar actuel' : 'Avatar par défaut'}</div>
        <div class="avatar-current-sub">${current ? 'Clique sur un autre emoji pour changer' : 'Choisis-en un dans la liste'}</div>
        ${current ? `<button class="avatar-reset" onclick="resetAvatar()">Réinitialiser</button>` : ''}
      </div>
    </div>

    <div class="avatar-tabs">${tabs}</div>
    <div class="avatar-grid">${cells}</div>
  `;
}

// ==========================================
//  📲 PWA : Service Worker + Install Prompt
// ==========================================

function isStandalonePWA() {
  return window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !window.MSStream);
}

let deferredInstallPrompt = null;
let waitingWorker = null;

if ("serviceWorker" in navigator) {
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      console.log("SW registered:", reg.scope);

      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorker = reg.waiting;
        showUpdateBanner();
      }

      reg.addEventListener("updatefound", () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = newSW;
            showUpdateBanner();
          }
        });
      });

      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    }).catch((err) => console.error("SW registration failed:", err));
  });
}

function showUpdateBanner() {
  const banner = document.getElementById("update-banner");
  if (banner) banner.classList.add("visible");
}

window.dismissUpdateBanner = function() {
  const banner = document.getElementById("update-banner");
  if (banner) banner.classList.remove("visible");
};

window.applyUpdate = function() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else {
    window.location.reload();
  }
};

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  refreshInstallButtonVisibility();
});

function refreshInstallButtonVisibility() {
  const btn = document.getElementById("install-menu-item");
  if (!btn) return;
  if (isStandalonePWA()) { btn.style.display = "none"; return; }
  if (isIOS()) { btn.style.display = "block"; return; }
  btn.style.display = deferredInstallPrompt ? "block" : "none";
}

window.installApp = async function() {
  const menu = document.getElementById("more-dropdown");
  if (menu) { menu.classList.remove("open"); menu.classList.add("closed"); }

  if (isIOS()) { showInfoModal("install-ios"); return; }
  if (!deferredInstallPrompt) { showInfoModal("install-ios"); return; }

  const confirmed = await showConfirm({
    icon: "📲",
    title: "Installer Nexora",
    message: "Lance Nexora comme une vraie app native, avec son icône sur ton bureau et un fonctionnement même sans navigateur ouvert.",
    confirmText: "Installer"
  });
  if (!confirmed) return;

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log("Install outcome:", outcome);
  deferredInstallPrompt = null;
  refreshInstallButtonVisibility();
};

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  refreshInstallButtonVisibility();
  console.log("Nexora installé !");
});

document.addEventListener("DOMContentLoaded", refreshInstallButtonVisibility);

// ==========================================
//  🍅 MODE FOCUS / POMODORO
// ==========================================

let focusState = {
  active: false,
  paused: false,
  taskId: null,
  taskText: null,
  durationMin: 25,
  startTime: null,
  pausedAt: null,
  totalPausedMs: 0,
  intervalId: null
};

function getFocusStatsToday() {
  const today = new Date().toISOString().slice(0, 10);
  const stats = JSON.parse(localStorage.getItem("focusStats") || "{}");
  return stats[today] || 0;
}

function incrementFocusStats() {
  const today = new Date().toISOString().slice(0, 10);
  const stats = JSON.parse(localStorage.getItem("focusStats") || "{}");
  stats[today] = (stats[today] || 0) + 1;
  localStorage.setItem("focusStats", JSON.stringify(stats));
}

function renderFocusStarter() {
  const activeTasks = tasks.filter(t => !t.done);
  const taskOptions = activeTasks.map(t =>
    `<option value="${t.id}">${t.text.replace(/"/g, '&quot;')}</option>`
  ).join("");

  const todayCount = getFocusStatsToday();
  const todayHtml = todayCount > 0 ? `
    <div class="focus-today-stat">
      <span class="focus-today-icon">🔥</span>
      <span>${todayCount} session${todayCount > 1 ? 's' : ''} terminée${todayCount > 1 ? 's' : ''} aujourd'hui</span>
    </div>
  ` : '';

  const taskBlock = activeTasks.length > 0 ? `
    <div class="focus-section-title">Tâche associée (optionnel)</div>
    <select id="focus-task-select" class="focus-task-select">
      <option value="">— Aucune (focus libre) —</option>
      ${taskOptions}
    </select>
  ` : '';

  return `
    <h2>🍅 Mode Focus</h2>
    <p class="info-subtitle">Concentre-toi à fond sur une seule chose</p>

    ${todayHtml}

    <div class="focus-section-title">Durée</div>
    <div class="focus-duration-grid">
      <button class="focus-duration-btn" onclick="startFocusSession(15)">
        <div class="focus-duration-min">15</div>
        <div class="focus-duration-unit">min</div>
        <div class="focus-duration-label">Sprint</div>
      </button>
      <button class="focus-duration-btn primary" onclick="startFocusSession(25)">
        <div class="focus-duration-min">25</div>
        <div class="focus-duration-unit">min</div>
        <div class="focus-duration-label">Pomodoro</div>
      </button>
      <button class="focus-duration-btn" onclick="startFocusSession(45)">
        <div class="focus-duration-min">45</div>
        <div class="focus-duration-unit">min</div>
        <div class="focus-duration-label">Deep work</div>
      </button>
    </div>

    ${taskBlock}
  `;
}

function startFocusSession(durationMin) {
  const select = document.getElementById("focus-task-select");
  const taskId = select && select.value ? parseInt(select.value) : null;
  hideInfoModal();
  startFocus(durationMin, taskId);
}

function startFocus(durationMin, taskId) {
  focusState = {
    active: true,
    paused: false,
    taskId: taskId,
    taskText: taskId ? (tasks.find(t => t.id === taskId)?.text || null) : null,
    durationMin: durationMin,
    startTime: Date.now(),
    pausedAt: null,
    totalPausedMs: 0,
    intervalId: null
  };

  const overlay = document.getElementById("focus-overlay");
  overlay.classList.add("visible");
  overlay.classList.remove("paused");

  document.getElementById("focus-task-name").textContent = focusState.taskText || "";
  document.getElementById("focus-status").textContent = "Focus en cours";
  document.getElementById("focus-pause-btn").style.display = "inline-flex";
  document.getElementById("focus-resume-btn").style.display = "none";

  focusState.intervalId = setInterval(tickFocus, 250);
  tickFocus();
}

function tickFocus() {
  if (!focusState.active || focusState.paused) return;

  const elapsed = Date.now() - focusState.startTime - focusState.totalPausedMs;
  const totalMs = focusState.durationMin * 60 * 1000;
  const remaining = Math.max(0, totalMs - elapsed);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  document.getElementById("focus-time").textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const progress = Math.min(100, (elapsed / totalMs) * 100);
  document.getElementById("focus-progress-fill").style.width = `${progress}%`;

  if (remaining <= 0) completeFocus();
}

function pauseFocus() {
  if (!focusState.active || focusState.paused) return;
  focusState.paused = true;
  focusState.pausedAt = Date.now();
  document.getElementById("focus-overlay").classList.add("paused");
  document.getElementById("focus-status").textContent = "Pause";
  document.getElementById("focus-pause-btn").style.display = "none";
  document.getElementById("focus-resume-btn").style.display = "inline-flex";
}

function resumeFocus() {
  if (!focusState.active || !focusState.paused) return;
  focusState.totalPausedMs += Date.now() - focusState.pausedAt;
  focusState.paused = false;
  focusState.pausedAt = null;
  document.getElementById("focus-overlay").classList.remove("paused");
  document.getElementById("focus-status").textContent = "Focus en cours";
  document.getElementById("focus-pause-btn").style.display = "inline-flex";
  document.getElementById("focus-resume-btn").style.display = "none";
}

async function stopFocus() {
  const confirmed = await showConfirm({
    icon: "⏸️",
    title: "Arrêter la session ?",
    message: "Tu vas perdre le décompte en cours. Sûr ?",
    confirmText: "Arrêter",
    danger: true
  });
  if (!confirmed) return;
  cleanupFocus();
}

function completeFocus() {
  playFocusEndSound();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 400]);
  incrementFocusStats();

  const min = focusState.durationMin;
  const txt = focusState.taskText;
  cleanupFocus();

  setTimeout(() => {
    showConfirm({
      icon: "🎉",
      title: "Session terminée !",
      message: txt
        ? `Bravo, ${min} min focus sur "${txt}". Une pause s'impose ☕`
        : `Bravo, ${min} min de focus. Une pause s'impose ☕`,
      confirmText: "OK"
    });
  }, 300);
}

function cleanupFocus() {
  if (focusState.intervalId) clearInterval(focusState.intervalId);
  document.getElementById("focus-overlay").classList.remove("visible", "paused");
  focusState = {
    active: false, paused: false, taskId: null, taskText: null,
    durationMin: 25, startTime: null, pausedAt: null,
    totalPausedMs: 0, intervalId: null
  };
}

function playFocusEndSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1100, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.5);
      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch (e) { console.log("Sound failed:", e); }
}

// ==========================================
//  🔥 STREAKS + GAMIFICATION
// ==========================================

const ACHIEVEMENTS = [
  { id: 'first',    icon: '🌱', name: 'Premier pas',          desc: '1ère tâche terminée',  check: s => s.totalDone >= 1 },
  { id: 'tasks10',  icon: '💪', name: 'Productif',            desc: '10 tâches faites',     check: s => s.totalDone >= 10 },
  { id: 'streak3',  icon: '🔥', name: 'En forme',             desc: '3 jours d\'affilée',   check: s => s.bestStreak >= 3 },
  { id: 'streak7',  icon: '⚡', name: 'Sur ma lancée',        desc: '7 jours d\'affilée',   check: s => s.bestStreak >= 7 },
  { id: 'tasks50',  icon: '🏆', name: 'Champion',             desc: '50 tâches faites',     check: s => s.totalDone >= 50 },
  { id: 'focus10',  icon: '🍅', name: 'Concentré',            desc: '10 sessions Focus',    check: s => s.totalFocus >= 10 },
  { id: 'streak30', icon: '👑', name: 'Roi de la régularité', desc: '30 jours d\'affilée',  check: s => s.bestStreak >= 30 },
  { id: 'tasks100', icon: '🎯', name: 'Centurion',            desc: '100 tâches faites',    check: s => s.totalDone >= 100 },
];

function getGamification() {
  return currentUser?.user_metadata?.gamification || {
    current_streak: 0, best_streak: 0,
    last_active_date: null, total_done: 0,
    unlocked_achievements: []
  };
}

async function saveGamification(g) {
  const { error } = await db.auth.updateUser({ data: { gamification: g } });
  if (error) { console.error("GAMI SAVE ERROR =", error); return false; }
  if (currentUser) {
    currentUser.user_metadata = { ...(currentUser.user_metadata || {}), gamification: g };
  }
  return true;
}

function getStatsForAchievements() {
  const g = getGamification();
  const focusStats = JSON.parse(localStorage.getItem("focusStats") || "{}");
  const totalFocus = Object.values(focusStats).reduce((a, b) => a + b, 0);
  return {
    totalDone: g.total_done || 0,
    bestStreak: g.best_streak || 0,
    currentStreak: g.current_streak || 0,
    totalFocus
  };
}

async function recordTaskCompletion() {
  const today = new Date().toISOString().slice(0, 10);
  const g = { ...getGamification() };

  g.total_done = (g.total_done || 0) + 1;

  const lastDate = g.last_active_date;
  if (lastDate === today) {
    // déjà comptabilisé aujourd'hui
  } else if (lastDate) {
    const diff = Math.round((new Date(today) - new Date(lastDate)) / 86400000);
    if (diff === 1) g.current_streak = (g.current_streak || 0) + 1;
    else if (diff > 1) g.current_streak = 1;
  } else {
    g.current_streak = 1;
  }

  g.last_active_date = today;
  if ((g.current_streak || 0) > (g.best_streak || 0)) g.best_streak = g.current_streak;

  // Détection nouveaux succès
  const before = new Set(g.unlocked_achievements || []);
  const stats = {
    totalDone: g.total_done,
    bestStreak: g.best_streak,
    currentStreak: g.current_streak,
    totalFocus: Object.values(JSON.parse(localStorage.getItem("focusStats") || "{}")).reduce((a, b) => a + b, 0)
  };
  const newlyUnlocked = ACHIEVEMENTS.filter(a => a.check(stats)).filter(a => !before.has(a.id));
  g.unlocked_achievements = ACHIEVEMENTS.filter(a => a.check(stats)).map(a => a.id);

  await saveGamification(g);
  updateHero();

  if (newlyUnlocked.length > 0) {
    setTimeout(() => showAchievementToast(newlyUnlocked[0]), 600);
  }
}

function showAchievementToast(ach) {
  const existing = document.getElementById("achievement-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "achievement-toast";
  toast.className = "achievement-toast";
  toast.innerHTML = `
    <div class="ach-toast-icon">${ach.icon}</div>
    <div class="ach-toast-body">
      <div class="ach-toast-label">SUCCÈS DÉBLOQUÉ</div>
      <div class="ach-toast-name">${ach.name}</div>
      <div class="ach-toast-desc">${ach.desc}</div>
    </div>
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400);
  }, 5000);
}

// === Hook : enregistre la complétion à chaque tâche cochée ===
const _origToggleTask = window.toggleTask;
window.toggleTask = async function(id, currentDone) {
  await _origToggleTask(id, currentDone);
  if (!currentDone) {
    // La tâche vient d'être cochée
    await recordTaskCompletion();
  }
};

// === Override updateHero pour afficher le streak ===
const _origUpdateHero = updateHero;
updateHero = function() {
  _origUpdateHero();
  const pillsEl = document.getElementById("stats-pills");
  if (!pillsEl || !currentUser) return;
  const g = getGamification();
  const streak = g.current_streak || 0;
  if (streak > 0 && tasks.length > 0) {
    pillsEl.innerHTML += `<span class="stat-pill streak"><span class="stat-pill-icon">🔥</span>${streak} jour${streak > 1 ? 's' : ''}</span>`;
  }
};

// === Override renderDashboard pour ajouter Streak + Succès ===
const _origRenderDashboard = renderDashboard;
renderDashboard = function() {
  const original = _origRenderDashboard();
  const stats = getStatsForAchievements();

  const achievementCells = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(stats);
    return `
      <div class="ach-cell ${unlocked ? 'unlocked' : 'locked'}" title="${a.desc}">
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-name">${a.name}</div>
        <div class="ach-desc">${a.desc}</div>
      </div>
    `;
  }).join("");

  const unlockedCount = ACHIEVEMENTS.filter(a => a.check(stats)).length;

  const gamificationHtml = `
    <div class="info-section">
      <h3>🔥 Streak</h3>
      <div class="streak-grid">
        <div class="streak-card current">
          <div class="streak-value">${stats.currentStreak}</div>
          <div class="streak-label">Jour${stats.currentStreak > 1 ? 's' : ''} d'affilée</div>
        </div>
        <div class="streak-card best">
          <div class="streak-value">${stats.bestStreak}</div>
          <div class="streak-label">Record</div>
        </div>
      </div>
      ${stats.currentStreak === 0 ? `<p style="font-size:12px;opacity:0.55;margin-top:10px;text-align:center;">Termine une tâche aujourd'hui pour démarrer ta série 🔥</p>` : ''}
    </div>

    <div class="info-section">
      <h3>🏆 Succès (${unlockedCount}/${ACHIEVEMENTS.length})</h3>
      <div class="ach-grid">${achievementCells}</div>
    </div>

    <div class="info-section">
      <h3>📈 Lifetime</h3>
      <div class="lifetime-stats">
        <div><b>${stats.totalDone}</b>tâches terminées</div>
        <div><b>${stats.totalFocus}</b>sessions Focus</div>
      </div>
    </div>
  `;

  return original + gamificationHtml;
};
// ==========================================
//  🔁 TÂCHES RÉCURRENTES
// ==========================================

function detectRecurrence(text) {
  const l = text.toLowerCase();
  if (/\b(tous les jours|chaque jour|quotidien|chaque matin|chaque soir)\b/.test(l)) return 'daily';
  if (/\bchaque lundi\b|\btous les lundis\b/.test(l))    return 'weekly:1';
  if (/\bchaque mardi\b|\btous les mardis\b/.test(l))    return 'weekly:2';
  if (/\bchaque mercredi\b|\btous les mercredis\b/.test(l)) return 'weekly:3';
  if (/\bchaque jeudi\b|\btous les jeudis\b/.test(l))    return 'weekly:4';
  if (/\bchaque vendredi\b|\btous les vendredis\b/.test(l)) return 'weekly:5';
  if (/\bchaque samedi\b|\btous les samedis\b/.test(l))  return 'weekly:6';
  if (/\bchaque dimanche\b|\btous les dimanches\b/.test(l)) return 'weekly:7';
  if (/\b(en semaine|jours ouvrés|jours ouvres)\b/.test(l)) return 'weekdays';
  if (/\b(week-end|weekend|le weekend)\b/.test(l)) return 'weekends';
  return null;
}

function getRecurrenceLabel(rec) {
  if (!rec) return null;
  if (rec === 'daily') return 'Tous les jours';
  if (rec === 'weekdays') return 'En semaine';
  if (rec === 'weekends') return 'Week-end';
  if (rec.startsWith('weekly:')) {
    const day = parseInt(rec.split(':')[1]);
    const labels = ['', 'lundis', 'mardis', 'mercredis', 'jeudis', 'vendredis', 'samedis', 'dimanches'];
    return `Chaque ${labels[day]}`;
  }
  return null;
}

// Réactive automatiquement les tâches récurrentes le bon jour
async function resetRecurringTasksIfNeeded() {
  if (!currentUser || tasks.length === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().getDay() || 7;

  const activePatterns = ['daily', `weekly:${todayDay}`];
  if (todayDay >= 1 && todayDay <= 5) activePatterns.push('weekdays');
  if (todayDay === 6 || todayDay === 7) activePatterns.push('weekends');

  const idsToReset = [];
  for (const pattern of activePatterns) {
    const key = `lastReset_${pattern}_${currentUser.id}`;
    if (localStorage.getItem(key) === today) continue;
    tasks.filter(t => t.done && t.recurrence === pattern).forEach(t => idsToReset.push(t.id));
    localStorage.setItem(key, today);
  }

  if (idsToReset.length > 0) {
    const { error } = await db.from('tasks').update({ done: false }).in('id', idsToReset);
    if (!error) {
      console.log(`✅ ${idsToReset.length} tâche(s) récurrente(s) réactivée(s)`);
      const { data } = await db.from('tasks').select('*');
      tasks = data || [];
      render();
    }
  }
}

// === Hook : après loadTasks ===
const _origLoadTasksRecur = loadTasks;
loadTasks = async function() {
  await _origLoadTasksRecur();
  await resetRecurringTasksIfNeeded();
};

// === Override addTask : détecte la récurrence ===
addTask = async function() {
  if (!currentUser) return;
  let input = document.getElementById("input").value;
  if (!input) return;
  let list = input.split(/[+,/]/).map(t => t.trim()).filter(Boolean);

  const newTasks = list.map(t => ({
    text: t,
    priority: getPriority(t),
    time: getTime(t),
    category: detectCategory(t),
    recurrence: detectRecurrence(t),
    done: false,
    user_id: currentUser.id
  }));

  const { data, error } = await db.from("tasks").insert(newTasks).select();
  if (error) { console.error("INSERT ERROR =", error); return; }
  console.log("TASKS SAVED =", data);
  document.getElementById("input").value = "";
  await loadTasks();
};

// === Override editTask : met à jour la récurrence ===
window.editTask = async function(id, newText) {
  if (!id) return;
  newText = newText.trim();
  if (!newText) { await loadTasks(); return; }
  const { error } = await db.from("tasks").update({
    text: newText,
    priority: getPriority(newText),
    time: getTime(newText),
    category: detectCategory(newText),
    recurrence: detectRecurrence(newText)
  }).eq("id", id);
  if (error) { console.error("EDIT ERROR =", error); return; }
  await loadTasks();
};

// === Hook render : ajoute le badge 🔁 sur les tâches récurrentes ===
const _origRenderRecur = render;
render = function() {
  _origRenderRecur();
  document.querySelectorAll('.task').forEach(taskEl => {
    const id = taskEl.id?.replace('task-', '');
    if (!id) return;
    const task = tasks.find(t => t.id == id);
    if (!task || !task.recurrence) return;
    const headerRow = taskEl.querySelector('.task-header-row');
    if (!headerRow || headerRow.querySelector('.recur-badge')) return;
    const label = getRecurrenceLabel(task.recurrence) || '';
    const badge = document.createElement('span');
    badge.className = 'recur-badge';
    badge.title = label;
    badge.textContent = `🔁 ${label}`;
    headerRow.appendChild(badge);
  });
};
// ==========================================
//  🖱️ DRAG & DROP (réordonner les tâches actives)
// ==========================================

async function ensurePositionsBackfilled() {
  if (!currentUser) return;
  const active = tasks.filter(t => !t.done);
  if (active.length === 0) return;
  if (!active.some(t => t.position == null)) return;

  const priOrder = { urgent: 0, medium: 1, normal: 2 };
  const sorted = [...active].sort((a, b) => priOrder[a.priority] - priOrder[b.priority]);

  const updates = [];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].position !== i) {
      updates.push({ id: sorted[i].id, position: i });
      sorted[i].position = i;
    }
  }
  if (updates.length === 0) return;

  await Promise.all(updates.map(({ id, position }) =>
    db.from("tasks").update({ position }).eq("id", id)
  ));
  console.log(`📌 Backfill positions : ${updates.length} tâches`);
}

function compareTasksByPosition(a, b) {
  if (a.position != null && b.position != null) return a.position - b.position;
  if (a.position != null) return -1;
  if (b.position != null) return 1;
  const priOrder = { urgent: 0, medium: 1, normal: 2 };
  return priOrder[a.priority] - priOrder[b.priority];
}

let _sortableInstance = null;
function initSortableTasks() {
  const list = document.getElementById("active-list");
  if (!list) return;
  if (typeof Sortable === "undefined") {
    console.warn("⚠️ Sortable.js pas chargé");
    return;
  }
  if (_sortableInstance) {
    try { _sortableInstance.destroy(); } catch (e) {}
    _sortableInstance = null;
  }
  _sortableInstance = Sortable.create(list, {
    animation: 220,
    handle: ".drag-handle",
    ghostClass: "task-ghost",
    chosenClass: "task-chosen",
    dragClass: "task-dragging",
    forceFallback: true,
    fallbackTolerance: 5,
    onEnd: handleTaskReorder
  });
}

async function handleTaskReorder() {
  const list = document.getElementById("active-list");
  if (!list) return;
  const taskEls = list.querySelectorAll(".task");
  const updates = [];
  taskEls.forEach((el, idx) => {
    const id = parseInt(el.id.replace("task-", ""));
    if (isNaN(id)) return;
    updates.push({ id, position: idx });
    const t = tasks.find(t => t.id === id);
    if (t) t.position = idx;
  });

  await Promise.all(updates.map(({ id, position }) =>
    db.from("tasks").update({ position }).eq("id", id)
  ));
  console.log(`✅ ${updates.length} tâche(s) réordonnée(s)`);
}

// === Hook loadTasks (par-dessus le hook récurrence existant) ===
const _origLoadTasksDND = loadTasks;
loadTasks = async function() {
  await _origLoadTasksDND();
  await ensurePositionsBackfilled();
};

// === Override addTask (consolidé : récurrence + position) ===
addTask = async function() {
  if (!currentUser) return;
  let input = document.getElementById("input").value;
  if (!input) return;
  let list = input.split(/[+,/]/).map(t => t.trim()).filter(Boolean);

  const positioned = tasks.filter(t => !t.done && t.position != null);
  const maxPos = positioned.length > 0 ? Math.max(...positioned.map(t => t.position)) : -1;

  const newTasks = list.map((t, i) => ({
    text: t,
    priority: getPriority(t),
    time: getTime(t),
    category: detectCategory(t),
    recurrence: detectRecurrence(t),
    position: maxPos + i + 1,
    done: false,
    user_id: currentUser.id
  }));

  const { data, error } = await db.from("tasks").insert(newTasks).select();
  if (error) { console.error("INSERT ERROR =", error); return; }
  console.log("TASKS SAVED =", data);
  document.getElementById("input").value = "";
  await loadTasks();
};

// === Hook render (par-dessus le hook récurrence) ===
const _origRenderDND = render;
render = function() {
  _origRenderDND();

  // Ajoute le drag handle ⋮⋮
  document.querySelectorAll("#active-list .task").forEach(taskEl => {
    if (taskEl.querySelector(".drag-handle")) return;
    const handle = document.createElement("div");
    handle.className = "drag-handle";
    handle.innerHTML = "⋮⋮";
    handle.title = "Glisser pour réordonner";
    taskEl.appendChild(handle);
  });

  // Réordonne le DOM par position
  const list = document.getElementById("active-list");
  if (list) {
    const sorted = tasks.filter(t => !t.done).sort(compareTasksByPosition);
    sorted.forEach(t => {
      const el = document.getElementById(`task-${t.id}`);
      if (el) list.appendChild(el);
    });
  }

  initSortableTasks();
};
// ==========================================
//  📅 VUE CALENDRIER HEBDO
// ==========================================

let calendarWeekOffset = 0;

function getMondayOfWeek(offset = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay() || 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - day + 1 + offset * 7);
  return monday;
}

function navigateCalendar(delta) {
  calendarWeekOffset += delta;
  const body = document.getElementById("info-modal-body");
  if (body) body.innerHTML = renderCalendar();
}

function renderCalendar() {
  const start = getMondayOfWeek(calendarWeekOffset);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeTasks = tasks.filter(t => !t.done);
  const tasksByDay = [[], [], [], [], [], [], []];
  const tasksWithoutDate = [];

  activeTasks.forEach(task => {
    const due = getDueDate(task.text);
    if (!due) { tasksWithoutDate.push(task); return; }
    const dueDate = new Date(due.date);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((dueDate - start) / 86400000);
    if (diffDays >= 0 && diffDays < 7) {
      tasksByDay[diffDays].push(task);
    }
  });

  const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const monthsShort = ['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];

  let weekTitle;
  if (calendarWeekOffset === 0) weekTitle = "Cette semaine";
  else if (calendarWeekOffset === 1) weekTitle = "Semaine prochaine";
  else if (calendarWeekOffset === -1) weekTitle = "Semaine dernière";
  else weekTitle = `Du ${start.getDate()} ${monthsShort[start.getMonth()]}`;

  const dayCards = dayNames.map((name, idx) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + idx);
    const isToday = dayDate.getTime() === today.getTime();
    const isPast = dayDate < today;
    const isWeekend = idx >= 5;
    const dayTasks = tasksByDay[idx];

    const tasksHtml = dayTasks.length === 0
      ? `<div class="cal-empty">aucune tâche</div>`
      : dayTasks.map(t => {
          const cat = getCategoryByName(t.category);
          const catColor = cat ? cat.color : '#6b7280';
          const safeText = t.text.replace(/"/g, '&quot;');
          return `<div class="cal-task" style="border-left-color: ${catColor};" title="${safeText}">${t.text}</div>`;
        }).join("");

    return `
      <div class="cal-day ${isToday ? 'today' : ''} ${isPast && !isToday ? 'past' : ''} ${isWeekend ? 'weekend' : ''}">
        <div class="cal-day-header">
          <div class="cal-day-name">
            ${name}${isToday ? '<span class="today-tag">AUJOURD\'HUI</span>' : ''}
          </div>
          <div class="cal-day-date">${dayDate.getDate()} ${monthsShort[dayDate.getMonth()]}</div>
        </div>
        <div class="cal-day-tasks">${tasksHtml}</div>
      </div>
    `;
  }).join("");

  const noDateHtml = tasksWithoutDate.length > 0 ? `
    <div class="cal-no-date-section">
      <div class="cal-no-date-title">📌 Sans date précise (${tasksWithoutDate.length})</div>
      <div class="cal-no-date-tasks">
        ${tasksWithoutDate.map(t => {
          const cat = getCategoryByName(t.category);
          const catColor = cat ? cat.color : '#6b7280';
          return `<div class="cal-task" style="border-left-color: ${catColor};">${t.text}</div>`;
        }).join("")}
      </div>
    </div>
  ` : '';

  return `
    <h2>📅 Calendrier</h2>
    <p class="info-subtitle">Vue d'ensemble de ta semaine</p>

    <div class="cal-nav">
      <button class="cal-nav-btn" onclick="navigateCalendar(-1)" title="Semaine précédente">‹</button>
      <div class="cal-nav-title">${weekTitle}</div>
      <button class="cal-nav-btn" onclick="navigateCalendar(1)" title="Semaine suivante">›</button>
    </div>

    ${calendarWeekOffset !== 0 ? `<button class="cal-today-btn" onclick="navigateCalendar(${-calendarWeekOffset})">↩ Revenir à cette semaine</button>` : ''}

    <div class="cal-grid">${dayCards}</div>

    ${noDateHtml}
  `;
}

// === Hook : ajoute "calendar" aux types de modal ===
const _origRenderInfoModalContent = renderInfoModalContent;
renderInfoModalContent = function(type) {
  if (type === "calendar") return renderCalendar();
  return _origRenderInfoModalContent(type);
};

// === Hook : reset l'offset à l'ouverture du calendrier ===
const _origShowInfoModalCal = showInfoModal;
showInfoModal = function(type) {
  if (type === "calendar") calendarWeekOffset = 0;
  return _origShowInfoModalCal(type);
};

// ==========================================
//  🌅 ONBOARDING FLOW
// ==========================================

const ONBOARDING_SLIDES = [
  {
    icon: "👋",
    title: () => `Bienvenue ${getDisplayName()} !`,
    subtitle: "Ravi de t'avoir sur Nexora.",
    body: "En 3 étapes rapides, je te montre comment t'en servir efficacement."
  },
  {
    icon: "✍️",
    title: () => "Tape tes devoirs en vrac",
    subtitle: "Pas besoin de t'organiser, on s'en charge.",
    body: "Sépare-les avec <code>+</code>, <code>,</code> ou <code>/</code>.<br><br>Exemple : <code>examen maths demain + DM français + lire ch. 3</code> → 3 tâches créées d'un coup."
  },
  {
    icon: "🎯",
    title: () => "Tout est détecté automatiquement",
    subtitle: "Priorité, matière, échéance.",
    body: "<b>« Examen demain »</b> → urgent 🔴<br><b>« DM français »</b> → matière auto 📖<br><b>« Réviser chaque jour »</b> → récurrent 🔁<br><br>Tu écris naturellement, on classe pour toi."
  },
  {
    icon: "🚀",
    title: () => "Et bien plus dans le menu ⋯",
    subtitle: "Tout ce qu'il te faut pour bosser.",
    body: "🍅 <b>Mode Focus</b> — sessions 25 min<br>🔥 <b>Streaks</b> — habitude quotidienne<br>📅 <b>Calendrier</b> — vue d'ensemble<br>🎨 <b>Matières</b> — couleurs custom<br>🔔 <b>Rappels</b> — notifs aux bonnes heures"
  },
  {
    icon: "✨",
    title: () => "C'est parti !",
    subtitle: "Tu es prêt à tout gérer.",
    body: "Tu peux relancer ce tuto à tout moment depuis <b>💬 Support</b>.<br><br>Allez, on s'y met."
  }
];

let onboardingSlide = 0;

function shouldShowOnboarding() {
  return currentUser && !currentUser.user_metadata?.onboarding_completed;
}

function showOnboarding() {
  onboardingSlide = 0;
  const overlay = document.getElementById("onboarding-overlay");
  if (!overlay) return;
  overlay.classList.add("visible");
  renderOnboardingSlide();
}

function renderOnboardingSlide() {
  const slide = ONBOARDING_SLIDES[onboardingSlide];
  const total = ONBOARDING_SLIDES.length;
  const isLast = onboardingSlide === total - 1;

  const content = document.getElementById("onboarding-content");
  if (content) {
    content.innerHTML = `
      <div class="onb-icon">${slide.icon}</div>
      <h2 class="onb-title">${slide.title()}</h2>
      <p class="onb-subtitle">${slide.subtitle}</p>
      <p class="onb-body">${slide.body}</p>
    `;
  }

  const dots = document.getElementById("onboarding-dots");
  if (dots) {
    dots.innerHTML = ONBOARDING_SLIDES.map((_, i) =>
      `<span class="onb-dot ${i === onboardingSlide ? 'active' : ''}"></span>`
    ).join("");
  }

  const prev = document.getElementById("onb-prev");
  const next = document.getElementById("onb-next");
  if (prev) prev.style.visibility = onboardingSlide === 0 ? "hidden" : "visible";
  if (next) next.textContent = isLast ? "C'est parti ! ✨" : "Suivant →";
}

function nextOnboardingSlide() {
  if (onboardingSlide >= ONBOARDING_SLIDES.length - 1) {
    completeOnboarding();
    return;
  }
  onboardingSlide++;
  renderOnboardingSlide();
}

function prevOnboardingSlide() {
  if (onboardingSlide === 0) return;
  onboardingSlide--;
  renderOnboardingSlide();
}

async function completeOnboarding() {
  const overlay = document.getElementById("onboarding-overlay");
  if (overlay) overlay.classList.remove("visible");

  await db.auth.updateUser({ data: { onboarding_completed: true } });
  if (currentUser) {
    currentUser.user_metadata = {
      ...(currentUser.user_metadata || {}),
      onboarding_completed: true
    };
  }
  console.log("✅ Onboarding completed");
}

async function skipOnboarding() {
  await completeOnboarding();
}

// Permet de relancer manuellement le tuto (depuis Support par ex.)
async function replayOnboarding() {
  await db.auth.updateUser({ data: { onboarding_completed: false } });
  if (currentUser) {
    currentUser.user_metadata = {
      ...(currentUser.user_metadata || {}),
      onboarding_completed: false
    };
  }
  hideInfoModal();
  setTimeout(showOnboarding, 300);
}

// === Hook updateUI : déclenche l'onboarding au premier login ===
const _origUpdateUIOnb = updateUI;
updateUI = function() {
  _origUpdateUIOnb();
  if (shouldShowOnboarding()) {
    setTimeout(showOnboarding, 600); // délai pour que l'app charge d'abord
  }
};

// === Hook renderSupport : ajoute un bouton "Revoir le tuto" ===
const _origRenderSupport = renderSupport;
renderSupport = function() {
  return _origRenderSupport() + `
    <div class="info-section">
      <h3>Tutoriel</h3>
      <p>Tu veux revoir l'introduction de Nexora ?</p>
      <button class="btn secondary" style="margin-top:8px;" onclick="replayOnboarding()">🌅 Relancer le tuto</button>
    </div>
  `;
};

// ==========================================
//  ☀️ MODE CLAIR / SOMBRE
// ==========================================

function getCurrentTheme() {
  return localStorage.getItem('theme') || 'dark';
}

function applyTheme(theme) {
  document.documentElement.classList.toggle('theme-light', theme === 'light');

  // Met à jour la barre du navigateur (couleur de l'address bar mobile)
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'light' ? '#f5f7fa' : '#0b1220';
  }

  // Met à jour le label du menu
  const item = document.getElementById('theme-toggle-item');
  if (item) {
    item.innerHTML = theme === 'light' ? '🌙 Mode sombre' : '☀️ Mode clair';
  }
}

function toggleTheme() {
  const newTheme = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', newTheme);
  applyTheme(newTheme);

  // Ferme le menu
  const menu = document.getElementById('more-dropdown');
  if (menu) {
    menu.classList.remove('open');
    menu.classList.add('closed');
  }
}

// Applique le thème au chargement (le script anti-flash dans <head> a déjà mis la classe sur <html>)
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getCurrentTheme());
});

// ==========================================
//  🎬 ANIMATION HERO — wrap emoji dans un span animable
// ==========================================

const _origUpdateHeroAnim = updateHero;
updateHero = function() {
  _origUpdateHeroAnim();

  const greetingEl = document.getElementById("greeting");
  if (!greetingEl || !currentUser) return;

  // Remplace le greeting brut par une version où l'emoji peut être animé
  const avatar = getCurrentAvatar();
  const wave = avatar || "👋";

  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));

  greetingEl.innerHTML =
    `${escapeHTML(getSalutation())}, ${escapeHTML(getDisplayName())} ` +
    `<span class="hero-emoji">${escapeHTML(wave)}</span>`;
};

// ==========================================
//  📋 TEMPLATES DE TÂCHES
// ==========================================

const TASK_TEMPLATES = [
  {
    id: 'bac',
    icon: '🎓',
    name: 'Préparation BAC',
    description: 'Plan de révision multi-matières',
    tasks: [
      'Réviser maths fiches importantes',
      'Réviser français annales corrigées',
      'Réviser philo dissertations',
      'Réviser anglais oral et compréhension',
      'Réviser SVT chapitres clés',
      'Réviser histoire-géo cartes',
      'Faire des annales corrigées chaque jour'
    ]
  },
  {
    id: 'exposé',
    icon: '🎤',
    name: 'Préparation exposé',
    description: '5 étapes pour un exposé réussi',
    tasks: [
      'Recherche documentation et sources',
      'Faire le plan détaillé',
      'Rédiger le contenu',
      'Préparer les slides ou support',
      'Répéter à voix haute 3 fois'
    ]
  },
  {
    id: 'examen',
    icon: '📝',
    name: 'Examen dans 7 jours',
    description: 'Plan de révision sur une semaine',
    tasks: [
      'Faire fiches chapitres 1-2 lundi',
      'Faire fiches chapitres 3-4 mardi',
      'Faire fiches chapitres 5-6 mercredi',
      'Réviser toutes les fiches jeudi',
      'Faire annales corrigées vendredi',
      'Relire et auto-tester samedi',
      'Repos et révision légère dimanche'
    ]
  },
  {
    id: 'rentrée',
    icon: '🎒',
    name: 'Rentrée scolaire',
    description: 'Tout pour bien démarrer',
    tasks: [
      'Acheter fournitures (cahiers, stylos, classeur)',
      'Acheter manuels scolaires',
      'Compléter dossier d\'inscription',
      'Récupérer emploi du temps',
      'Préparer sac et trousse'
    ]
  },
  {
    id: 'lecture',
    icon: '📖',
    name: 'Lecture obligatoire',
    description: 'Découper un livre en sessions',
    tasks: [
      'Lire chapitres 1-3',
      'Lire chapitres 4-6',
      'Lire chapitres 7-9',
      'Lire chapitres 10-12',
      'Faire fiche de lecture complète',
      'Préparer commentaire ou questions'
    ]
  },
  {
    id: 'habits',
    icon: '🔁',
    name: 'Routine quotidienne',
    description: 'Habitudes récurrentes (auto-renouvelées)',
    tasks: [
      'Réviser 30 min chaque jour',
      'Faire devoirs chaque soir',
      'Sport ou marche chaque jour',
      'Lecture 20 min chaque soir',
      'Préparer sac la veille chaque soir'
    ]
  }
];

function renderTemplates() {
  const cards = TASK_TEMPLATES.map(t => `
    <div class="template-card" onclick="previewTemplate('${t.id}')">
      <div class="template-icon">${t.icon}</div>
      <div class="template-name">${t.name}</div>
      <div class="template-desc">${t.description}</div>
      <div class="template-count">${t.tasks.length} tâches</div>
    </div>
  `).join("");

  return `
    <h2>📋 Templates</h2>
    <p class="info-subtitle">Crée plusieurs tâches d'un coup avec un modèle prêt à l'emploi</p>
    <div class="templates-grid">${cards}</div>
  `;
}

function previewTemplate(id) {
  const tpl = TASK_TEMPLATES.find(t => t.id === id);
  if (!tpl) return;

  const tasksHtml = tpl.tasks.map(text => {
    const catName = detectCategory(text);
    const catObj = catName ? getCategoryByName(catName) : null;
    const catColor = catObj ? catObj.color : '#6b7280';
    return `<div class="template-preview-task" style="border-left-color:${catColor};">${text}</div>`;
  }).join("");

  const body = document.getElementById("info-modal-body");
  if (!body) return;
  body.innerHTML = `
    <h2>${tpl.icon} ${tpl.name}</h2>
    <p class="info-subtitle">${tpl.description}</p>
    <div class="template-preview-list">${tasksHtml}</div>
    <div class="template-preview-actions">
      <button class="btn secondary" onclick="showInfoModal('templates')">← Retour</button>
      <button class="btn primary" onclick="applyTemplate('${id}')">Ajouter ces ${tpl.tasks.length} tâches</button>
    </div>
  `;
}

async function applyTemplate(id) {
  const tpl = TASK_TEMPLATES.find(t => t.id === id);
  if (!tpl || !currentUser) return;

  const positioned = tasks.filter(t => !t.done && t.position != null);
  const maxPos = positioned.length > 0 ? Math.max(...positioned.map(t => t.position)) : -1;

  const newTasks = tpl.tasks.map((text, i) => ({
    text,
    priority: getPriority(text),
    time: getTime(text),
    category: detectCategory(text),
    recurrence: detectRecurrence(text),
    position: maxPos + i + 1,
    done: false,
    user_id: currentUser.id
  }));

  const { error } = await db.from('tasks').insert(newTasks);
  if (error) {
    console.error('Template apply error:', error);
    showConfirm({
      icon: '⚠️',
      title: 'Erreur',
      message: 'Impossible d\'ajouter les tâches. Réessaie.',
      confirmText: 'OK'
    });
    return;
  }

  hideInfoModal();
  await loadTasks();

  showAchievementToast({
    icon: tpl.icon,
    name: tpl.name,
    desc: `${tpl.tasks.length} tâches ajoutées 🎉`
  });
}

// Hook : ajoute "templates" aux types de modal
const _origRenderInfoModalTpl = renderInfoModalContent;
renderInfoModalContent = function(type) {
  if (type === "templates") return renderTemplates();
  return _origRenderInfoModalTpl(type);
};
// ==========================================
//  🔒 PRIVACY + CGU
// ==========================================

function renderPrivacy() {
  return `
    <h2>🔒 Politique de confidentialité</h2>
    <p class="info-subtitle">Dernière mise à jour : mai 2026</p>

    <div class="info-section">
      <h3>1. Données collectées</h3>
      <p>Pour utiliser Nexora, on a besoin de :</p>
      <ul>
        <li><b>Email</b> : pour ton compte et la récupération de mot de passe</li>
        <li><b>Prénom, nom (optionnel)</b> : pour personnaliser ton expérience</li>
        <li><b>Tes tâches</b> : contenu que tu écris dans l'app</li>
        <li><b>Avatar, matières, préférences</b> : tes personnalisations</li>
      </ul>
      <p>Aucune donnée de navigation, aucun tracking publicitaire, aucun cookie tiers.</p>
    </div>

    <div class="info-section">
      <h3>2. Où c'est stocké</h3>
      <p>Tes données sont stockées chez <b>Supabase</b> (serveurs en UE — Allemagne), hébergeur conforme RGPD. Le site est hébergé sur <b>Vercel</b>. Aucune autre tierce partie n'accède à tes données.</p>
    </div>

    <div class="info-section">
      <h3>3. Combien de temps</h3>
      <p>Tant que ton compte existe. Si tu supprimes ton compte, toutes tes données sont effacées définitivement sous 30 jours.</p>
    </div>

    <div class="info-section">
      <h3>4. Tes droits (RGPD)</h3>
      <p>Tu as le droit de :</p>
      <ul>
        <li>Accéder à toutes tes données</li>
        <li>Les rectifier ou les supprimer</li>
        <li>Demander leur portabilité (export)</li>
        <li>Retirer ton consentement à tout moment</li>
      </ul>
      <p>Pour exercer ces droits : écris à <b>nexora.app@proton.me</b>. Réponse sous 30 jours.</p>
    </div>

    <div class="info-section">
      <h3>5. Stockage local</h3>
      <p>Nexora utilise le <b>localStorage</b> de ton navigateur pour mémoriser tes préférences (thème clair/sombre, sections dépliées, sessions Focus du jour). Ces données restent sur ton appareil, on ne les voit pas.</p>
    </div>

    <div class="info-section">
      <h3>6. Sécurité</h3>
      <p>Connexions chiffrées en HTTPS. Mots de passe hashés (jamais stockés en clair). Tu es le seul à pouvoir accéder à tes tâches via ta session.</p>
    </div>

    <div class="info-section">
      <h3>7. IA</h3>
      <p>Quand tu utilises ✨ <b>Découper avec l'IA</b>, le texte de ta tâche est envoyé à <b>Anthropic</b> (Claude) pour générer les sous-tâches. Anthropic ne stocke pas tes données et ne les utilise pas pour entraîner ses modèles.</p>
    </div>

    <div class="info-section">
      <h3>8. Mineurs</h3>
      <p>Nexora s'adresse aux étudiants de 13 ans et plus. Si tu as moins de 15 ans, demande à un parent avant de créer un compte.</p>
    </div>
  `;
}

function renderCGU() {
  return `
    <h2>📜 Conditions Générales d'Utilisation</h2>
    <p class="info-subtitle">Dernière mise à jour : mai 2026</p>

    <div class="info-section">
      <h3>1. Service</h3>
      <p>Nexora est une application web gratuite de gestion de tâches pour étudiants, accessible à <b>nexora.app</b>. Service fourni "tel quel", sans garantie de disponibilité 100%.</p>
    </div>

    <div class="info-section">
      <h3>2. Inscription</h3>
      <p>Tu dois avoir au moins <b>13 ans</b> pour créer un compte. Tu t'engages à fournir des informations exactes (email valide) et à garder ton mot de passe secret.</p>
    </div>

    <div class="info-section">
      <h3>3. Utilisation acceptable</h3>
      <p>Tu t'engages à ne pas :</p>
      <ul>
        <li>Utiliser Nexora à des fins illégales</li>
        <li>Tenter de pirater, surcharger ou nuire au service</li>
        <li>Utiliser des bots ou scripts automatisés</li>
        <li>Stocker du contenu illégal, haineux ou nuisible</li>
      </ul>
    </div>

    <div class="info-section">
      <h3>4. Tes contenus</h3>
      <p>Tu restes propriétaire de tes tâches. On ne les utilise pas, on ne les revend pas, on ne les analyse pas. Elles sont entièrement privées.</p>
    </div>

    <div class="info-section">
      <h3>5. Gratuité</h3>
      <p>Nexora est 100% gratuit. Pas de pub, pas d'achat, pas d'abonnement. Si on ajoute des features premium un jour, on te le dira clairement avant.</p>
    </div>

    <div class="info-section">
      <h3>6. Limitation de responsabilité</h3>
      <p>Nexora est un outil d'organisation, pas une solution mission-critique. On ne peut pas être tenus responsables d'oublis, de perte de données ou d'erreurs liés à son utilisation. Pense à exporter régulièrement ce qui est important.</p>
    </div>

    <div class="info-section">
      <h3>7. Modification du service</h3>
      <p>On peut modifier, ajouter ou retirer des fonctionnalités à tout moment, sans préavis. On essaiera toujours de prévenir les changements importants.</p>
    </div>

    <div class="info-section">
      <h3>8. Suppression de compte</h3>
      <p>Tu peux demander la suppression de ton compte à tout moment via <b>nexora.app@proton.me</b>. Toutes tes données seront effacées sous 30 jours.</p>
    </div>

    <div class="info-section">
      <h3>9. Loi applicable</h3>
      <p>Ces CGU sont régies par le droit français. Tout litige relève des tribunaux compétents en France.</p>
    </div>

    <div class="info-section">
      <h3>10. Contact</h3>
      <p>Une question, un problème ? <b>nexora.app@proton.me</b></p>
    </div>
  `;
}

// Hook renderInfoModalContent
const _origRenderInfoLegal = renderInfoModalContent;
renderInfoModalContent = function(type) {
  if (type === 'privacy') return renderPrivacy();
  if (type === 'cgu') return renderCGU();
  return _origRenderInfoLegal(type);
};

// ==========================================
//  GO
// ==========================================
initAuth();
