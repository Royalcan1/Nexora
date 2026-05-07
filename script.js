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
//  GO
// ==========================================
initAuth();
