/* =========================================================================
   app.js - orquestração: navegação entre telas e ciclo de vida da sessão
   ========================================================================= */

(function () {
  const $ = UI.$;
  const $$ = UI.$$;

  const TITULOS = {
    home: "EasyFood",
    add: "Cadastrar",
    favorites: "Favoritos",
    profile: "Perfil"
  };

  let telaAtual = "home";

  // ---- Navegação --------------------------------------------------------

  function irPara(tela) {
    telaAtual = tela;

    $$(".screen").forEach(function (screen) {
      screen.hidden = screen.id !== "screen-" + tela;
    });

    $$(".nav-item").forEach(function (item) {
      if (item.dataset.screen === tela) {
        item.setAttribute("aria-current", "page");
      } else {
        item.removeAttribute("aria-current");
      }
    });

    $("#header-title").textContent = TITULOS[tela] || "EasyFood";

    const ativa = $("#screen-" + tela);
    if (ativa) ativa.scrollTop = 0;

    // Cada tela busca seus próprios dados ao ser aberta.
    if (tela === "favorites") Restaurants.carregarFavoritos();
    if (tela === "profile") carregarPerfil();

    // Mantém a tela atual na URL, para poder recarregar no mesmo lugar.
    if (location.hash !== "#" + tela) {
      history.replaceState(null, "", "#" + tela);
    }
  }

  // ---- Perfil -----------------------------------------------------------

  async function carregarPerfil() {
    const usuarioLocal = API.getUser();

    if (usuarioLocal) {
      preencherPerfil(usuarioLocal, null);
    }

    try {
      const resposta = await API.auth.me();
      preencherPerfil(resposta.user, resposta.stats);
    } catch (erro) {
      if (erro.status !== 401) {
        UI.toast("Não foi possível atualizar o perfil.", "error");
      }
    }

    Restaurants.carregarMeusRestaurantes();
  }

  function preencherPerfil(user, stats) {
    $("#profile-avatar").textContent = UI.iniciais(user.name);
    $("#profile-name").textContent = user.name;
    $("#profile-email").textContent = user.email;
    $("#profile-since").textContent = "Membro desde " + UI.formatarData(user.createdAt);
    $("#stat-favorites").textContent = String(Restaurants.contarFavoritos());

    if (stats) {
      $("#stat-restaurants").textContent = String(stats.restaurants);
    }
  }

  // ---- Sessão -----------------------------------------------------------

  function mostrarApp() {
    $("#view-auth").hidden = true;
    $("#app-header").hidden = false;
    $("#bottom-nav").hidden = false;

    const inicial = (location.hash || "#home").slice(1);

    irPara(TITULOS[inicial] ? inicial : "home");

    Restaurants.carregarCategorias().then(function () {
      Restaurants.carregarLista({ reiniciar: true });
    });
  }

  function mostrarLogin() {
    $("#view-auth").hidden = false;
    $("#app-header").hidden = true;
    $("#bottom-nav").hidden = true;

    $$(".screen").forEach((screen) => (screen.hidden = true));

    Auth.trocarAba("login");
  }

  function sair() {
    API.clearSession();
    mostrarLogin();
    UI.toast("Você saiu da conta.", "success");
  }

  // ---- Inicialização ----------------------------------------------------

  function init() {
    UI.initTheme();
    UI.initConfirm();
    UI.initPasswordToggles();

    Auth.init();
    Restaurants.init();

    $$(".nav-item").forEach(function (item) {
      item.addEventListener("click", () => irPara(item.dataset.screen));
    });

    $("#logout-btn").addEventListener("click", async function () {
      const confirmado = await UI.confirmDialog(
        "Sair da conta?",
        "Você precisará entrar novamente para cadastrar restaurantes.",
        "Sair"
      );

      if (confirmado) sair();
    });

    // O token expirou ou ficou inválido em alguma chamada.
    window.addEventListener("easyfood:unauthorized", function () {
      mostrarLogin();
      UI.showAlert("login-alert", "Sua sessão expirou. Entre novamente.", "danger");
    });

    window.addEventListener("easyfood:authenticated", mostrarApp);
    window.addEventListener("easyfood:navigate", (event) => irPara(event.detail));

    if (API.isLoggedIn()) {
      mostrarApp();
    } else {
      mostrarLogin();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
