/* =========================================================================
   restaurants.js - listagem, busca, filtros, favoritos e cadastro
   ========================================================================= */

window.Restaurants = (function () {
  const $ = UI.$;
  const $$ = UI.$$;

  const POR_PAGINA = 6;
  const FAVORITOS_KEY = "easyfood:favoritos";

  const estado = {
    categoria: "Todos",
    busca: "",
    ordem: "rating",
    pagina: 1,
    total: 0,
    itens: [],
    categorias: []
  };

  // Ícone por categoria — mantém o cartão com cara de app, sem emoji.
  const ICONE_CATEGORIA = {
    Pizza: "pizza",
    Burger: "beef",
    Japonesa: "fish",
    Italiana: "utensils",
    Mexicana: "soup",
    Brasileira: "soup",
    "Saudável": "salad",
    Padaria: "croissant"
  };

  // ---- Favoritos (ficam só no navegador) -------------------------------

  function lerFavoritos() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITOS_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function salvarFavoritos(ids) {
    try {
      localStorage.setItem(FAVORITOS_KEY, JSON.stringify(ids));
    } catch (e) {
      /* ignora */
    }
    atualizarBadge();
  }

  function ehFavorito(id) {
    return lerFavoritos().indexOf(id) !== -1;
  }

  function alternarFavorito(id) {
    const favoritos = lerFavoritos();
    const posicao = favoritos.indexOf(id);

    if (posicao === -1) {
      favoritos.push(id);
    } else {
      favoritos.splice(posicao, 1);
    }

    salvarFavoritos(favoritos);

    return posicao === -1;
  }

  function atualizarBadge() {
    const badge = $("#nav-fav-badge");
    if (!badge) return;

    const total = lerFavoritos().length;

    badge.textContent = total > 9 ? "9+" : String(total);
    badge.hidden = total === 0;
  }

  // ---- Valor de entrega (visual, derivado do id) -----------------------
  // Calculado a partir do id para não mudar a cada renderização.
  function taxaEntrega(id) {
    const valor = 3 + ((id * 37) % 60) / 10;
    return valor.toFixed(2).replace(".", ",");
  }

  function tempoEntrega(id) {
    const base = 15 + ((id * 13) % 25);
    return base + "-" + (base + 10) + " min";
  }

  // ---- Cartão ----------------------------------------------------------

  function cartao(restaurant, indice, opcoes) {
    const config = opcoes || {};
    const favorito = ehFavorito(restaurant.id);
    const nota = restaurant.rating === null || restaurant.rating === undefined
      ? null
      : Number(restaurant.rating).toFixed(1);

    const acao = config.removivel
      ? '<button class="fav" type="button" data-remove="' + restaurant.id +
        '" aria-label="Remover ' + UI.escapeHtml(restaurant.name) + '">' + UI.icon("trash") + "</button>"
      : '<button class="fav" type="button" data-fav="' + restaurant.id +
        '" aria-pressed="' + favorito + '" aria-label="' +
        (favorito ? "Remover dos favoritos" : "Adicionar aos favoritos") + '">' + UI.icon("heart") + "</button>";

    return (
      '<article class="card" style="animation-delay:' + (indice * 45) + 'ms">' +
        '<div class="card__thumb">' +
          UI.icon(ICONE_CATEGORIA[restaurant.category] || "store") +
        "</div>" +
        '<div class="card__body">' +
          '<h3 class="card__name">' + UI.escapeHtml(restaurant.name) + "</h3>" +
          '<p class="card__meta">' + UI.escapeHtml(restaurant.category || "Sem categoria") +
            " &middot; " + tempoEntrega(restaurant.id) + "</p>" +
          (nota
            ? '<span class="rating">' + UI.icon("star") + nota + "</span>"
            : '<span class="card__meta">Sem avaliação</span>') +
        "</div>" +
        '<div class="card__side">' +
          acao +
          '<p class="card__delivery">Entrega<strong>R$ ' + taxaEntrega(restaurant.id) + "</strong></p>" +
        "</div>" +
      "</article>"
    );
  }

  // ---- Filtros ---------------------------------------------------------

  async function carregarCategorias() {
    const container = $("#category-chips");
    const select = $("#restaurant-category");

    try {
      estado.categorias = await API.restaurants.categories();
    } catch (e) {
      estado.categorias = [];
    }

    const todas = ["Todos"].concat(estado.categorias);

    container.innerHTML = todas
      .map(function (categoria) {
        const ativa = categoria === estado.categoria;
        return (
          '<button class="chip" type="button" data-category="' + UI.escapeHtml(categoria) + '" ' +
          'aria-pressed="' + ativa + '">' + UI.escapeHtml(categoria) + "</button>"
        );
      })
      .join("");

    if (select) {
      select.innerHTML =
        '<option value="">Selecione uma categoria</option>' +
        estado.categorias
          .map((c) => '<option value="' + UI.escapeHtml(c) + '">' + UI.escapeHtml(c) + "</option>")
          .join("");
    }
  }

  function selecionarCategoria(categoria) {
    estado.categoria = categoria;

    $$("#category-chips .chip").forEach(function (chip) {
      chip.setAttribute("aria-pressed", String(chip.dataset.category === categoria));
    });

    carregarLista({ reiniciar: true });
  }

  // ---- Lista -----------------------------------------------------------

  async function carregarLista(opcoes) {
    const config = opcoes || {};
    const lista = $("#restaurant-list");
    const botaoMais = $("#load-more");

    if (config.reiniciar) {
      estado.pagina = 1;
      estado.itens = [];
      lista.innerHTML = UI.skeletonList(4);
      lista.setAttribute("aria-busy", "true");
      botaoMais.hidden = true;
    }

    try {
      const resposta = await API.restaurants.list({
        category: estado.categoria,
        search: estado.busca,
        sort: estado.ordem,
        page: estado.pagina,
        limit: POR_PAGINA
      });

      estado.total = resposta.total === null ? resposta.data.length : resposta.total;
      estado.itens = estado.pagina === 1 ? resposta.data : estado.itens.concat(resposta.data);

      renderizarLista();
    } catch (erro) {
      lista.setAttribute("aria-busy", "false");
      botaoMais.hidden = true;

      lista.innerHTML = UI.emptyState(
        erro.status === 0 ? "wifi-off" : "alert",
        erro.status === 0 ? "Servidor offline" : "Não deu para carregar",
        erro.status === 0
          ? "Inicie a API com: npm start"
          : erro.message
      );
    }
  }

  function renderizarLista() {
    const lista = $("#restaurant-list");
    const botaoMais = $("#load-more");
    const titulo = $("#list-title");

    lista.setAttribute("aria-busy", "false");

    titulo.textContent =
      estado.categoria === "Todos" ? "Restaurantes" : estado.categoria;

    if (estado.itens.length === 0) {
      lista.innerHTML = UI.emptyState(
        "inbox",
        "Nenhum restaurante encontrado",
        estado.busca
          ? 'Nada bateu com "' + estado.busca + '". Tente outro termo.'
          : "Ainda não há restaurantes nesta categoria. Que tal cadastrar o primeiro?"
      );
      botaoMais.hidden = true;
      return;
    }

    lista.innerHTML = estado.itens
      .map((restaurant, indice) => cartao(restaurant, indice % POR_PAGINA))
      .join("");

    const faltam = estado.total - estado.itens.length;

    botaoMais.hidden = faltam <= 0;

    if (faltam > 0) {
      $("[data-label]", botaoMais).textContent =
        "Carregar mais (" + faltam + " restante" + (faltam > 1 ? "s" : "") + ")";
    }
  }

  async function carregarMais() {
    const botao = $("#load-more");

    UI.setLoading(botao, true, "Carregando...");
    estado.pagina += 1;

    await carregarLista();

    UI.setLoading(botao, false);
  }

  // ---- Favoritos (tela) ------------------------------------------------

  async function carregarFavoritos() {
    const lista = $("#favorites-list");
    const contador = $("#favorites-count");
    const ids = lerFavoritos();

    if (ids.length === 0) {
      lista.innerHTML = UI.emptyState(
        "heart",
        "Nenhum favorito ainda",
        "Toque no coração de um restaurante para salvar aqui."
      );
      contador.textContent = "";
      return;
    }

    lista.innerHTML = UI.skeletonList(Math.min(ids.length, 3));

    try {
      // Busca uma página grande e filtra localmente pelos ids salvos.
      const resposta = await API.restaurants.list({ limit: 50, sort: "rating" });
      const favoritos = resposta.data.filter((r) => ids.indexOf(r.id) !== -1);

      contador.textContent = favoritos.length + " salvo" + (favoritos.length === 1 ? "" : "s");

      if (favoritos.length === 0) {
        lista.innerHTML = UI.emptyState(
          "heart",
          "Seus favoritos sumiram",
          "Os restaurantes salvos não estão mais disponíveis."
        );
        return;
      }

      lista.innerHTML = favoritos.map((r, i) => cartao(r, i)).join("");
    } catch (erro) {
      lista.innerHTML = UI.emptyState("wifi-off", "Não deu para carregar", erro.message);
    }
  }

  // ---- Meus restaurantes ------------------------------------------------

  async function carregarMeusRestaurantes() {
    const lista = $("#my-restaurants");

    lista.innerHTML = UI.skeletonList(2);

    try {
      const meus = await API.restaurants.mine();

      if (meus.length === 0) {
        lista.innerHTML = UI.emptyState(
          "store",
          "Você ainda não cadastrou nenhum",
          "Use a aba Cadastrar para adicionar seu primeiro restaurante."
        );
        return;
      }

      lista.innerHTML = meus.map((r, i) => cartao(r, i, { removivel: true })).join("");
    } catch (erro) {
      lista.innerHTML = UI.emptyState("alert", "Não deu para carregar", erro.message);
    }
  }

  // ---- Cadastro de restaurante -----------------------------------------

  const regrasRestaurante = {
    name: function (valor) {
      if (!valor.trim()) return "Informe o nome do restaurante.";
      if (valor.trim().length < 3) return "O nome precisa ter pelo menos 3 caracteres.";
      return null;
    },
    category: function (valor) {
      if (!valor) return "Escolha uma categoria.";
      return null;
    },
    rating: function (valor) {
      if (!valor) return null;
      const nota = Number(valor);
      if (Number.isNaN(nota)) return "A avaliação precisa ser um número.";
      if (nota < 0 || nota > 5) return "A avaliação precisa estar entre 0 e 5.";
      return null;
    }
  };

  function validarRestaurante(form) {
    let ok = true;

    Object.keys(regrasRestaurante).forEach(function (name) {
      const input = $('[name="' + name + '"]', form);
      const erro = regrasRestaurante[name](input.value);

      UI.setFieldError(form, name, erro);

      if (erro) ok = false;
    });

    if (!ok) {
      const primeiro = $('[data-invalid="true"] input, [data-invalid="true"] select', form);
      if (primeiro) primeiro.focus();
    }

    return ok;
  }

  async function enviarRestaurante(event) {
    event.preventDefault();

    const form = event.currentTarget;

    UI.hideAlert("add-alert");

    if (!validarRestaurante(form)) return;

    const botao = $("[data-submit]", form);
    UI.setLoading(botao, true, "Cadastrando...");

    try {
      const novo = await API.restaurants.create({
        name: $("#restaurant-name").value.trim(),
        category: $("#restaurant-category").value,
        rating: $("#restaurant-rating").value
      });

      form.reset();
      UI.clearFieldErrors(form);
      UI.toast('"' + novo.name + '" cadastrado com sucesso!', "success");

      await carregarLista({ reiniciar: true });

      window.dispatchEvent(new CustomEvent("easyfood:navigate", { detail: "home" }));
    } catch (erro) {
      if (erro.fields) {
        UI.applyErrors(form, erro.fields);
      } else {
        UI.showAlert("add-alert", erro.message, "danger");
      }
    } finally {
      UI.setLoading(botao, false);
    }
  }

  // ---- Eventos delegados ------------------------------------------------

  function ligarCliquesDaLista(container, aoMudar) {
    container.addEventListener("click", async function (event) {
      const botaoFav = event.target.closest("[data-fav]");

      if (botaoFav) {
        const id = Number(botaoFav.dataset.fav);
        const adicionado = alternarFavorito(id);

        botaoFav.setAttribute("aria-pressed", String(adicionado));
        botaoFav.setAttribute(
          "aria-label",
          adicionado ? "Remover dos favoritos" : "Adicionar aos favoritos"
        );

        if (aoMudar) aoMudar();
        return;
      }

      const botaoRemover = event.target.closest("[data-remove]");

      if (botaoRemover) {
        const id = Number(botaoRemover.dataset.remove);
        const nome = botaoRemover.closest(".card").querySelector(".card__name").textContent;

        const confirmado = await UI.confirmDialog(
          "Remover restaurante?",
          'O restaurante "' + nome + '" será apagado do banco. Essa ação não pode ser desfeita.',
          "Remover"
        );

        if (!confirmado) return;

        try {
          await API.restaurants.remove(id);
          UI.toast("Restaurante removido.", "success");
          await carregarMeusRestaurantes();
          await carregarLista({ reiniciar: true });
        } catch (erro) {
          UI.toast(erro.message, "error");
        }
      }
    });
  }

  // ---- Inicialização ----------------------------------------------------

  function init() {
    const busca = $("#search-input");
    const limpar = $("#search-clear");

    const buscarComAtraso = UI.debounce(function () {
      estado.busca = busca.value.trim();
      carregarLista({ reiniciar: true });
    }, 350);

    busca.addEventListener("input", function () {
      limpar.hidden = busca.value.length === 0;
      buscarComAtraso();
    });

    limpar.addEventListener("click", function () {
      busca.value = "";
      limpar.hidden = true;
      estado.busca = "";
      carregarLista({ reiniciar: true });
      busca.focus();
    });

    $("#category-chips").addEventListener("click", function (event) {
      const chip = event.target.closest("[data-category]");
      if (chip) selecionarCategoria(chip.dataset.category);
    });

    $("#sort-select").addEventListener("change", function (event) {
      estado.ordem = event.target.value;
      carregarLista({ reiniciar: true });
    });

    $("#load-more").addEventListener("click", carregarMais);

    $("#form-restaurant").addEventListener("submit", enviarRestaurante);

    Object.keys(regrasRestaurante).forEach(function (name) {
      const input = $('#form-restaurant [name="' + name + '"]');
      if (!input) return;

      input.addEventListener("blur", function () {
        UI.setFieldError($("#form-restaurant"), name, regrasRestaurante[name](input.value));
      });
    });

    ligarCliquesDaLista($("#restaurant-list"));
    ligarCliquesDaLista($("#favorites-list"), carregarFavoritos);
    ligarCliquesDaLista($("#my-restaurants"));

    atualizarBadge();
  }

  return {
    init: init,
    carregarCategorias: carregarCategorias,
    carregarLista: carregarLista,
    carregarFavoritos: carregarFavoritos,
    carregarMeusRestaurantes: carregarMeusRestaurantes,
    contarFavoritos: () => lerFavoritos().length
  };
})();
