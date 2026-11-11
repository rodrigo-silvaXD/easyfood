// =============================================================
// EasyFood - Front-end
// Restaurantes com filtro, busca e paginação; login com JWT;
// cardápio com fotos dos pratos e foto de perfil.
// =============================================================

// Servido pelo Express usa a mesma origem; aberto direto do disco aponta para a API local
const API = location.protocol === "file:" ? "http://localhost:3000" : "";
const PAGE_SIZE = 4;
const MAX_IMAGE_MB = 5;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const CATEGORY_STYLE = {
  Burger: ["🍔", "#fbe7c2", "#f3c574"],
  Pizza: ["🍕", "#fde3cf", "#f6b98d"],
  Sushi: ["🍣", "#fde2e2", "#f2b2b2"],
  Saudável: ["🥗", "#e1f0e4", "#b5d9bf"],
  Mexicana: ["🌮", "#fbe4cc", "#efab72"],
  Brasileira: ["🍛", "#ebf0da", "#c9d7a2"],
  Japonesa: ["🍱", "#f3e1ef", "#d9b1cf"],
  Italiana: ["🍝", "#fde9dd", "#f1bc9b"]
};

// localStorage pode estar bloqueado (aba anônima, por exemplo); o app funciona sem ele
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
  remove(key) { try { localStorage.removeItem(key); } catch {} }
};

const state = {
  restaurants: [],
  category: "Todos",
  query: "",
  page: 0,
  token: storage.get("easyfood.token"),
  user: JSON.parse(storage.get("easyfood.user") || "null"),
  favorites: new Set(JSON.parse(storage.get("easyfood.favorites") || "[]")),
  view: "home",
  nav: "home",
  returnTo: "home",
  current: null,
  dishes: [],
  authMode: "login",
  pendingUpload: null
};

// ----- UTILITÁRIOS -----

function $(id) { return document.getElementById(id); }

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function icon(name, cls = "ic") {
  return `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
}

function categoryStyle(category) {
  if (CATEGORY_STYLE[category]) return CATEGORY_STYLE[category];
  const fallback = [["🍽️", "#efe7dd", "#dccbb8"], ["🥘", "#e7ecf3", "#bccbe0"], ["🍜", "#f4e8da", "#e2c49c"]];
  const hash = [...String(category || "")].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return fallback[hash % fallback.length];
}

function tileStyle(category) {
  const [, from, to] = categoryStyle(category);
  return `background: linear-gradient(140deg, ${from}, ${to})`;
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function deliveryFee(id) {
  return money(3 + ((id * 37) % 50) / 10);
}

function deliveryTime(id) {
  const min = 15 + ((id * 7) % 20);
  return `${min}-${min + 10} min`;
}

function normalize(text) {
  return String(text || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function initials(name) {
  return String(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function imageSrc(path) {
  return path ? API + path : "";
}

let toastTimer;
function toast(message, type = "") {
  const el = $("toast");
  el.textContent = message;
  el.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = `toast ${type}`; }, 3200);
}

// Imagens entram com fade suave quando terminam de carregar
function fadeInImages(root) {
  root.querySelectorAll("img[data-fade]").forEach((img) => {
    if (img.complete) img.classList.add("loaded");
    else img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  });
}

// ----- API -----

async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (state.token) headers.Authorization = `Bearer ${state.token}`;

  let response;
  try {
    response = await fetch(API + path, {
      method,
      headers,
      body: form || (body ? JSON.stringify(body) : undefined)
    });
  } catch {
    throw new Error("Servidor offline. Rode node server.js");
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && state.token) {
      logout(false);
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    const error = new Error((data && data.error) || "Algo deu errado");
    error.status = response.status;
    throw error;
  }

  return data;
}

// ----- SESSÃO -----

function saveSession() {
  if (state.token) {
    storage.set("easyfood.token", state.token);
    storage.set("easyfood.user", JSON.stringify(state.user));
  } else {
    storage.remove("easyfood.token");
    storage.remove("easyfood.user");
  }
}

function logout(showToast = true) {
  state.token = null;
  state.user = null;
  saveSession();
  renderHeader();
  renderAdd();
  renderProfile();
  if (state.view === "detail") renderDetail();
  if (showToast) toast("Você saiu da sua conta");
}

function isOwner(restaurant) {
  return Boolean(state.user && restaurant && restaurant.ownerId === state.user.id);
}

// ----- NAVEGAÇÃO -----

const VIEW_ORDER = { home: 0, add: 2, favorites: 3, profile: 4, detail: 5 };
const NAV_ORDER = ["home", "search", "add", "favorites", "profile"];

function showView(name) {
  const next = $(`view-${name}`);
  const prev = document.querySelector(".view.active");
  if (next === prev) return;

  const forward = VIEW_ORDER[name] >= VIEW_ORDER[state.view];

  // posiciona a próxima tela do lado de onde ela deve entrar, sem animar
  next.style.transition = "none";
  next.classList.toggle("leaving-left", !forward);
  void next.offsetWidth;
  next.style.transition = "";
  next.classList.remove("leaving-left");
  next.classList.add("active");
  next.scrollTop = 0;

  if (prev) {
    prev.classList.remove("active");
    prev.classList.toggle("leaving-left", forward);
  }

  state.view = name;
}

function setNav(name) {
  state.nav = name;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === name);
  });
  $("nav-indicator").style.transform = `translateX(${NAV_ORDER.indexOf(name) * 100}%)`;
}

function go(name) {
  if (name === "search") {
    setNav("search");
    showView("home");
    setTimeout(() => $("search").focus(), 350);
    return;
  }
  setNav(name);
  if (name === "favorites") renderFavorites();
  if (name === "profile") renderProfile();
  showView(name);
}

// ----- CABEÇALHO -----

function greeting() {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return state.user ? `${period}, ${state.user.name.split(" ")[0]}` : period;
}

function renderHeader() {
  const btn = $("header-avatar");
  if (state.user && state.user.imageUrl) {
    btn.innerHTML = `<img src="${esc(imageSrc(state.user.imageUrl))}" alt="">`;
  } else if (state.user) {
    btn.textContent = initials(state.user.name);
  } else {
    btn.innerHTML = icon("user");
  }
  $("greeting-sub").textContent = greeting();
}

function tickClock() {
  const now = new Date();
  $("clock").textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

// ----- RESTAURANTES (início) -----

function skeletons(count) {
  return Array.from({ length: count }, () => '<div class="skeleton"></div>').join("");
}

async function fetchRestaurants() {
  $("restaurant-list").innerHTML = skeletons(3);
  try {
    state.restaurants = await api("/restaurants");
    renderCategories();
    renderHome();
  } catch (error) {
    $("count").textContent = "";
    $("restaurant-list").innerHTML = `
      <div class="empty">
        <div class="icon">⚠️</div>
        <strong>Servidor offline</strong>
        Rode no terminal: <code>node server.js</code>
      </div>`;
  }
}

function renderCategories() {
  const categories = [...new Set(state.restaurants.map((r) => r.category).filter(Boolean))].sort();
  if (state.category !== "Todos" && !categories.includes(state.category)) state.category = "Todos";

  $("categories").innerHTML = ["Todos", ...categories].map((category) => `
    <button class="chip ${category === state.category ? "active" : ""}" data-category="${esc(category)}">
      ${category === "Todos" ? "✨" : categoryStyle(category)[0]} ${esc(category)}
    </button>`).join("");
}

function filteredRestaurants() {
  const query = normalize(state.query);
  return state.restaurants.filter((r) =>
    (state.category === "Todos" || r.category === state.category) &&
    (!query || normalize(r.name).includes(query) || normalize(r.category).includes(query))
  );
}

function restaurantCard(restaurant, index) {
  const fav = state.favorites.has(restaurant.id);
  return `
    <div class="restaurant-card" role="button" tabindex="0" data-open="${restaurant.id}" style="animation-delay:${Math.min(index, 6) * 0.05}s">
      <div class="tile" style="${tileStyle(restaurant.category)}">${categoryStyle(restaurant.category)[0]}</div>
      <div class="restaurant-info">
        <h3>${esc(restaurant.name)}</h3>
        <div class="meta">${esc(restaurant.category || "Restaurante")} • ${deliveryTime(restaurant.id)}</div>
        <span class="rating">${icon("star", "ic-fill")} ${Number(restaurant.rating || 0).toFixed(1)}</span>
      </div>
      <div class="card-right">
        <button class="heart ${fav ? "on" : ""}" data-fav="${restaurant.id}" aria-label="Favoritar">${icon("heart")}</button>
        <div class="delivery">Entrega<br><strong>${deliveryFee(restaurant.id)}</strong></div>
      </div>
    </div>`;
}

function renderHome() {
  const list = filteredRestaurants();
  const visible = list.slice(0, (state.page + 1) * PAGE_SIZE);
  const remaining = list.length - visible.length;

  $("count").textContent = `${list.length} ${list.length === 1 ? "lugar" : "lugares"}`;

  if (visible.length === 0) {
    $("restaurant-list").innerHTML = `
      <div class="empty">
        <div class="icon">🔍</div>
        <strong>Nada por aqui</strong>
        ${state.restaurants.length ? "Nenhum restaurante combina com essa busca." : "Seja o primeiro a cadastrar um restaurante."}
      </div>`;
    return;
  }

  let html = visible.map(restaurantCard).join("");
  if (remaining > 0) {
    html += `<button class="load-more-btn" id="load-more">Carregar mais (${remaining} restante${remaining > 1 ? "s" : ""})</button>`;
  }
  $("restaurant-list").innerHTML = html;
}

function renderFavorites() {
  const list = state.restaurants.filter((r) => state.favorites.has(r.id));
  $("favorites-count").textContent = list.length ? `${list.length}` : "";
  $("favorites-list").innerHTML = list.length
    ? list.map(restaurantCard).join("")
    : `<div class="empty"><div class="icon">💛</div><strong>Nenhum favorito ainda</strong>Toque no coração de um restaurante para salvá-lo aqui.</div>`;
}

function toggleFavorite(id, button) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  storage.set("easyfood.favorites", JSON.stringify([...state.favorites]));

  document.querySelectorAll(`[data-fav="${id}"]`).forEach((b) => b.classList.toggle("on", state.favorites.has(id)));
  button.classList.remove("pop");
  void button.offsetWidth;
  button.classList.add("pop");
  if (state.view === "favorites") renderFavorites();
}

// ----- CADASTRO DE RESTAURANTE -----

function renderAdd() {
  $("add-locked").style.display = state.token ? "none" : "";
  $("add-restaurant-form").style.display = state.token ? "" : "none";
}

async function submitRestaurant(event) {
  event.preventDefault();
  const name = $("restaurant-name").value.trim();
  const category = $("restaurant-category").value;
  const rating = parseFloat($("restaurant-rating").value);

  if (!name || !category || Number.isNaN(rating) || rating < 0 || rating > 5) {
    toast("Preencha todos os campos corretamente", "error");
    return;
  }

  const button = $("add-submit");
  button.disabled = true;
  try {
    const restaurant = await api("/restaurants", { method: "POST", body: { name, category, rating } });
    state.restaurants.push(restaurant);
    renderCategories();
    renderHome();
    event.target.reset();
    toast(`“${restaurant.name}” cadastrado. Agora monte o cardápio!`, "success");
    openRestaurant(restaurant.id, "add");
  } catch (error) {
    toast(error.message, "error");
  } finally {
    button.disabled = false;
  }
}

// ----- DETALHE + CARDÁPIO -----

async function openRestaurant(id, from = state.nav) {
  const restaurant = state.restaurants.find((r) => r.id === id);
  if (!restaurant) return;

  state.current = restaurant;
  state.dishes = null;
  state.returnTo = from === "search" ? "home" : from;
  renderDetail();
  showView("detail");

  try {
    state.dishes = await api(`/restaurants/${id}/dishes`);
  } catch (error) {
    state.dishes = [];
    toast(error.message, "error");
  }
  if (state.current && state.current.id === id) renderDetail();
}

function dishCard(dish, index, owner) {
  const photo = dish.imageUrl
    ? `<img src="${esc(imageSrc(dish.imageUrl))}" alt="${esc(dish.name)}" data-fade>`
    : `<span>${categoryStyle(state.current.category)[0]}</span>`;

  return `
    <article class="dish-card" style="animation-delay:${Math.min(index, 6) * 0.05}s">
      <div class="dish-photo" id="dish-photo-${dish.id}">
        ${photo}
        ${owner ? `<button class="photo-btn" data-upload-dish="${dish.id}" aria-label="Enviar foto do prato">${icon("camera")}</button>` : ""}
      </div>
      <div class="dish-info">
        <span class="tag">${esc(dish.category)}</span>
        <h3>${esc(dish.name)}</h3>
        <p>${esc(dish.description)}</p>
        <span class="price">${money(dish.price)}</span>
      </div>
    </article>`;
}

function renderDetail() {
  const r = state.current;
  if (!r) return;
  const owner = isOwner(r);
  const dishes = state.dishes;

  let menu;
  if (dishes === null) {
    menu = skeletons(2);
  } else if (dishes.length === 0) {
    menu = `<div class="empty"><div class="icon">🍽️</div><strong>Cardápio vazio</strong>${owner ? "Adicione o primeiro prato acima." : "Este restaurante ainda não publicou pratos."}</div>`;
  } else {
    menu = dishes.map((dish, i) => dishCard(dish, i, owner)).join("");
  }

  $("detail-content").innerHTML = `
    <div class="hero" style="${tileStyle(r.category)}">
      <button class="back-btn" id="back-btn" aria-label="Voltar">${icon("back")}</button>
      ${categoryStyle(r.category)[0]}
    </div>
    <div class="detail-head">
      <h1>${esc(r.name)}</h1>
      <div class="meta">
        <span>${esc(r.category || "Restaurante")} • ${deliveryTime(r.id)}</span>
        <span class="rating">${icon("star", "ic-fill")} ${Number(r.rating || 0).toFixed(1)}</span>
        ${owner ? '<span class="owner-tag">Seu restaurante</span>' : ""}
      </div>
    </div>

    ${owner ? `
      <div class="section-header" style="padding-bottom:10px">
        <h2>Gerenciar</h2>
        <button class="btn btn-dark btn-inline" id="toggle-dish-form">${icon("plus")} Novo prato</button>
      </div>
      <div class="collapse" id="dish-form-wrap"><div>
        <form class="panel" id="dish-form">
          <div class="field">
            <label for="dish-name">Nome do prato</label>
            <input id="dish-name" placeholder="Ex: Lasanha à bolonhesa" required>
          </div>
          <div class="row">
            <div class="field">
              <label for="dish-category">Categoria</label>
              <input id="dish-category" placeholder="Ex: Massas" required>
            </div>
            <div class="field">
              <label for="dish-price">Preço (R$)</label>
              <input id="dish-price" type="number" min="0" step="0.01" placeholder="42,90" required>
            </div>
          </div>
          <div class="field">
            <label for="dish-description">Descrição</label>
            <textarea id="dish-description" placeholder="Ingredientes, tamanho da porção..."></textarea>
          </div>
          <button class="btn btn-primary" type="submit" id="dish-submit">Adicionar ao cardápio</button>
        </form>
      </div></div>` : ""}

    <div class="section-header">
      <h2>Cardápio</h2>
      <span class="count">${dishes ? `${dishes.length} ${dishes.length === 1 ? "prato" : "pratos"}` : ""}</span>
    </div>
    <div class="dish-list">${menu}</div>`;

  fadeInImages($("detail-content"));
}

async function submitDish(event) {
  event.preventDefault();
  const restaurant = state.current;
  const body = {
    name: $("dish-name").value.trim(),
    category: $("dish-category").value.trim(),
    description: $("dish-description").value.trim(),
    price: $("dish-price").value
  };

  const button = $("dish-submit");
  button.disabled = true;
  try {
    const dish = await api(`/restaurants/${restaurant.id}/dishes`, { method: "POST", body });
    state.dishes = [...(state.dishes || []), dish];
    renderDetail();
    toast("Prato adicionado. Toque na câmera para colocar a foto.", "success");
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
}

// ----- UPLOAD DE IMAGENS (perfil e pratos) -----

function pickImage(target) {
  state.pendingUpload = target;
  const input = $("file-input");
  input.value = "";
  input.click();
}

async function uploadSelected(file) {
  const target = state.pendingUpload;
  state.pendingUpload = null;
  if (!file || !target) return;

  if (!IMAGE_TYPES.includes(file.type)) {
    toast("Envie uma imagem JPEG, PNG ou WebP", "error");
    return;
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    toast(`A imagem deve ter no máximo ${MAX_IMAGE_MB} MB`, "error");
    return;
  }

  const form = new FormData();
  form.append("image", file);

  const holder = target.type === "user" ? document.querySelector(".profile-avatar") : $(`dish-photo-${target.id}`);
  if (holder) holder.classList.add("uploading");

  try {
    if (target.type === "user") {
      const user = await api("/auth/me/image", { method: "POST", form });
      state.user = { ...state.user, imageUrl: user.imageUrl };
      saveSession();
      renderHeader();
      renderProfile();
      toast("Foto de perfil atualizada", "success");
    } else {
      const dish = await api(`/dishes/${target.id}/image`, { method: "POST", form });
      state.dishes = state.dishes.map((d) => (d.id === dish.id ? dish : d));
      renderDetail();
      toast("Foto do prato atualizada", "success");
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (holder) holder.classList.remove("uploading");
  }
}

// ----- PERFIL / LOGIN -----

function renderProfile() {
  const root = $("profile-content");

  if (!state.user) {
    const register = state.authMode === "register";
    root.innerHTML = `
      <div class="greeting">
        <p>Sua conta</p>
        <h1>${register ? "Crie sua <em>conta</em>" : "Bem-vindo <em>de volta</em>"}</h1>
      </div>
      <form class="panel" id="auth-form" style="margin-top:18px">
        <div class="segmented ${register ? "second" : ""}">
          <span class="thumb"></span>
          <button type="button" class="${register ? "" : "active"}" data-auth="login">Entrar</button>
          <button type="button" class="${register ? "active" : ""}" data-auth="register">Criar conta</button>
        </div>
        ${register ? `
          <div class="field">
            <label for="auth-name">Nome</label>
            <input id="auth-name" autocomplete="name" placeholder="Como devemos te chamar?" required>
          </div>` : ""}
        <div class="field">
          <label for="auth-email">E-mail</label>
          <input id="auth-email" type="email" autocomplete="email" placeholder="voce@email.com" required>
        </div>
        <div class="field">
          <label for="auth-password">Senha</label>
          <input id="auth-password" type="password" autocomplete="${register ? "new-password" : "current-password"}" placeholder="••••••••" required>
        </div>
        <button class="btn btn-primary" type="submit" id="auth-submit">${register ? "Criar conta" : "Entrar"}</button>
      </form>`;
    return;
  }

  const mine = state.restaurants.filter((r) => r.ownerId === state.user.id);
  const avatar = state.user.imageUrl
    ? `<img src="${esc(imageSrc(state.user.imageUrl))}" alt="Foto de perfil" data-fade>`
    : esc(initials(state.user.name));

  root.innerHTML = `
    <div class="profile-card">
      <div class="profile-avatar">
        <div class="frame">${avatar}</div>
        <button class="photo-btn" id="upload-avatar" aria-label="Trocar foto de perfil">${icon("camera")}</button>
      </div>
      <h2>${esc(state.user.name)}</h2>
      <p>${esc(state.user.email)}</p>
    </div>

    <div class="panel" style="margin-top:14px">
      <h2>Meus restaurantes</h2>
      <p class="hint">${mine.length ? "Toque para gerenciar o cardápio e as fotos dos pratos." : "Você ainda não cadastrou nenhum restaurante."}</p>
      ${mine.map((r) => `
        <button class="list-row" data-open="${r.id}">
          <span class="tile" style="${tileStyle(r.category)}">${categoryStyle(r.category)[0]}</span>
          <span><strong>${esc(r.name)}</strong><span>${esc(r.category)}</span></span>
          <svg class="ic chev"><use href="#i-chevron"/></svg>
        </button>`).join("")}
      ${mine.length ? "" : `<button class="btn btn-dark" data-go="add">${icon("plus")} Cadastrar restaurante</button>`}
    </div>

    <div style="padding:14px 20px 0">
      <button class="btn btn-ghost" id="logout-btn">${icon("logout")} Sair</button>
    </div>`;

  fadeInImages(root);
}

async function submitAuth(event) {
  event.preventDefault();
  const email = $("auth-email").value.trim();
  const password = $("auth-password").value;
  const button = $("auth-submit");
  button.disabled = true;

  try {
    if (state.authMode === "register") {
      await api("/auth/register", { method: "POST", body: { name: $("auth-name").value.trim(), email, password } });
    }
    const result = await api("/auth/login", { method: "POST", body: { email, password } });
    state.token = result.token;
    state.user = result.user;
    saveSession();
    renderHeader();
    renderAdd();
    renderProfile();
    if (state.view === "detail") renderDetail();
    toast(`Olá, ${state.user.name.split(" ")[0]}!`, "success");
  } catch (error) {
    toast(error.message, "error");
    button.disabled = false;
  }
}

// Confere se o token salvo ainda vale e traz os dados atualizados do usuário
async function refreshUser() {
  if (!state.token) return;
  try {
    const data = await api("/auth/me");
    state.user = data.user;
    saveSession();
    renderHeader();
    renderProfile();
  } catch {
    // api() já encerra a sessão se o token for inválido
  }
}

// ----- EVENTOS -----

document.addEventListener("click", (event) => {
  const el = (selector) => event.target.closest(selector);

  const fav = el("[data-fav]");
  if (fav) {
    event.stopPropagation();
    toggleFavorite(Number(fav.dataset.fav), fav);
    return;
  }

  const open = el("[data-open]");
  if (open) return openRestaurant(Number(open.dataset.open));

  const nav = el("[data-nav]");
  if (nav) return go(nav.dataset.nav);

  const goTo = el("[data-go]");
  if (goTo) return go(goTo.dataset.go);

  const chip = el("[data-category]");
  if (chip) {
    state.category = chip.dataset.category;
    state.page = 0;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c === chip));
    chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    return renderHome();
  }

  if (el("#load-more")) {
    state.page++;
    return renderHome();
  }

  if (el("#back-btn")) {
    setNav(state.returnTo);
    if (state.returnTo === "profile") renderProfile();
    if (state.returnTo === "favorites") renderFavorites();
    return showView(state.returnTo);
  }

  if (el("#toggle-dish-form")) {
    const wrap = $("dish-form-wrap");
    wrap.classList.toggle("open");
    if (wrap.classList.contains("open")) setTimeout(() => $("dish-name").focus(), 250);
    return;
  }

  const authTab = el("[data-auth]");
  if (authTab) {
    if (state.authMode !== authTab.dataset.auth) {
      state.authMode = authTab.dataset.auth;
      renderProfile();
    }
    return;
  }

  const dishUpload = el("[data-upload-dish]");
  if (dishUpload) return pickImage({ type: "dish", id: Number(dishUpload.dataset.uploadDish) });

  if (el("#upload-avatar")) return pickImage({ type: "user" });
  if (el("#header-avatar")) return go("profile");
  if (el("#logout-btn")) return logout();
});

document.addEventListener("keydown", (event) => {
  const card = event.target.closest && event.target.closest(".restaurant-card");
  if (card && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openRestaurant(Number(card.dataset.open));
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "add-restaurant-form") return submitRestaurant(event);
  if (event.target.id === "dish-form") return submitDish(event);
  if (event.target.id === "auth-form") return submitAuth(event);
});

$("search").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.page = 0;
  renderHome();
});

$("file-input").addEventListener("change", (event) => uploadSelected(event.target.files[0]));

// ----- INICIALIZA -----

tickClock();
setInterval(tickClock, 30000);
renderHeader();
renderAdd();
renderProfile();
fetchRestaurants().then(refreshUser);
