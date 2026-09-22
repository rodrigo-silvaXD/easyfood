/* =========================================================================
   ui.js - utilidades de interface: ícones, toasts, diálogos, campos e tema
   ========================================================================= */

window.UI = (function () {
  const $ = (selector, scope) => (scope || document).querySelector(selector);
  const $$ = (selector, scope) => Array.from((scope || document).querySelectorAll(selector));

  // ---- Ícones ----------------------------------------------------------

  function icon(name, attrs) {
    return '<svg aria-hidden="true" ' + (attrs || "") + '><use href="#i-' + name + '"/></svg>';
  }

  // Evita injeção de HTML ao montar cartões com dados vindos da API.
  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---- Toasts ----------------------------------------------------------

  function toast(message, type) {
    const container = $("#toasts");
    if (!container) return;

    const el = document.createElement("div");
    el.className = "toast" + (type ? " toast--" + type : "");
    el.innerHTML =
      icon(type === "error" ? "alert" : "check") +
      "<span>" + escapeHtml(message) + "</span>";

    container.appendChild(el);

    setTimeout(function () {
      el.classList.add("is-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 400);
    }, 3600);
  }

  // ---- Diálogo de confirmação -----------------------------------------

  let confirmResolver = null;

  function confirmDialog(title, message, okLabel) {
    const backdrop = $("#confirm-backdrop");

    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-ok").textContent = okLabel || "Confirmar";
    backdrop.hidden = false;
    $("#confirm-ok").focus();

    return new Promise(function (resolve) {
      confirmResolver = resolve;
    });
  }

  function closeConfirm(result) {
    const backdrop = $("#confirm-backdrop");
    if (backdrop.hidden) return;

    backdrop.hidden = true;

    if (confirmResolver) {
      confirmResolver(result);
      confirmResolver = null;
    }
  }

  function initConfirm() {
    $("#confirm-ok").addEventListener("click", () => closeConfirm(true));
    $("#confirm-cancel").addEventListener("click", () => closeConfirm(false));
    $("#confirm-backdrop").addEventListener("click", function (event) {
      if (event.target === this) closeConfirm(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeConfirm(false);
    });
  }

  // ---- Campos de formulário -------------------------------------------

  function fieldOf(form, name) {
    return $('[data-field="' + name + '"]', form);
  }

  function setFieldError(form, name, message) {
    const field = fieldOf(form, name);
    if (!field) return;

    if (message) {
      field.dataset.invalid = "true";
      const span = $(".field__error span", field);
      if (span) span.textContent = message;
      const input = $("input, select", field);
      if (input) input.setAttribute("aria-invalid", "true");
    } else {
      delete field.dataset.invalid;
      const input = $("input, select", field);
      if (input) input.removeAttribute("aria-invalid");
    }
  }

  function clearFieldErrors(form) {
    $$("[data-field]", form).forEach(function (field) {
      delete field.dataset.invalid;
      const input = $("input, select", field);
      if (input) input.removeAttribute("aria-invalid");
    });
  }

  // Mostra os erros vindos da API e devolve o foco para o primeiro campo ruim.
  function applyErrors(form, errors) {
    clearFieldErrors(form);

    const names = Object.keys(errors || {});

    names.forEach(function (name) {
      setFieldError(form, name, errors[name]);
    });

    if (names.length > 0) {
      const first = fieldOf(form, names[0]);
      const input = first && $("input, select", first);
      if (input) input.focus();
    }
  }

  // ---- Alertas de formulário ------------------------------------------

  function showAlert(id, message, type) {
    const el = document.getElementById(id);
    if (!el) return;

    // Troca apenas o modificador de cor: classes como alert--form são preservadas.
    el.classList.remove("alert--danger", "alert--success");
    el.classList.add("alert", "alert--" + (type || "danger"));

    $("span", el).textContent = message;
    el.hidden = false;
  }

  function hideAlert(id) {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  }

  // ---- Botão com estado de carregamento -------------------------------

  function setLoading(button, loading, loadingLabel) {
    if (!button) return;

    const label = $("[data-label]", button);

    if (loading) {
      button.disabled = true;
      button.dataset.originalLabel = label ? label.textContent : "";
      if (label) label.textContent = loadingLabel || "Aguarde...";
      if (!$(".spinner", button)) {
        const spinner = document.createElement("span");
        spinner.className = "spinner";
        button.insertBefore(spinner, button.firstChild);
      }
    } else {
      button.disabled = false;
      if (label && button.dataset.originalLabel) {
        label.textContent = button.dataset.originalLabel;
      }
      const spinner = $(".spinner", button);
      if (spinner) spinner.remove();
    }
  }

  // ---- Estados de lista -----------------------------------------------

  function skeletonList(quantidade) {
    let html = "";

    for (let i = 0; i < (quantidade || 4); i++) {
      html +=
        '<div class="skeleton-card">' +
          '<div class="skeleton skeleton--thumb"></div>' +
          '<div class="skeleton--lines">' +
            '<div class="skeleton skeleton--line w-60"></div>' +
            '<div class="skeleton skeleton--line w-40"></div>' +
            '<div class="skeleton skeleton--line w-30"></div>' +
          "</div>" +
        "</div>";
    }

    return html;
  }

  function emptyState(iconName, title, message) {
    return (
      '<div class="state">' +
        '<div class="state__icon">' + icon(iconName) + "</div>" +
        "<h3>" + escapeHtml(title) + "</h3>" +
        "<p>" + escapeHtml(message) + "</p>" +
      "</div>"
    );
  }

  // ---- Tema claro / escuro --------------------------------------------

  const THEME_KEY = "easyfood:theme";

  function currentTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function applyTheme(theme) {
    const escuro =
      theme === "dark" ||
      (!theme && window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    const use = $("#theme-toggle use");
    if (use) use.setAttribute("href", escuro ? "#i-sun" : "#i-moon");

    const botao = $("#theme-toggle");
    if (botao) {
      botao.setAttribute("aria-label", escuro ? "Ativar tema claro" : "Ativar tema escuro");
    }
  }

  function initTheme() {
    applyTheme(currentTheme());

    const botao = $("#theme-toggle");
    if (!botao) return;

    botao.addEventListener("click", function () {
      const escuroAgora =
        document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.hasAttribute("data-theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);

      const proximo = escuroAgora ? "light" : "dark";

      try {
        localStorage.setItem(THEME_KEY, proximo);
      } catch (e) {
        /* ignora */
      }

      applyTheme(proximo);
    });
  }

  // ---- Mostrar / esconder senha ---------------------------------------

  function initPasswordToggles() {
    $$("[data-toggle-password]").forEach(function (botao) {
      botao.addEventListener("click", function () {
        const input = document.getElementById(botao.dataset.togglePassword);
        if (!input) return;

        const escondida = input.type === "password";

        input.type = escondida ? "text" : "password";
        botao.setAttribute("aria-label", escondida ? "Esconder senha" : "Mostrar senha");
        $("use", botao).setAttribute("href", escondida ? "#i-eye-off" : "#i-eye");
        input.focus();
      });
    });
  }

  // ---- Diversos --------------------------------------------------------

  function debounce(fn, delay) {
    let timer = null;

    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(null, args), delay);
    };
  }

  function formatarData(iso) {
    if (!iso) return "-";

    try {
      return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return "-";
    }
  }

  function iniciais(nome) {
    if (!nome) return "?";

    return nome
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0])
      .join("")
      .toUpperCase();
  }

  return {
    $: $,
    $$: $$,
    icon: icon,
    escapeHtml: escapeHtml,
    toast: toast,
    confirmDialog: confirmDialog,
    initConfirm: initConfirm,
    setFieldError: setFieldError,
    clearFieldErrors: clearFieldErrors,
    applyErrors: applyErrors,
    showAlert: showAlert,
    hideAlert: hideAlert,
    setLoading: setLoading,
    skeletonList: skeletonList,
    emptyState: emptyState,
    initTheme: initTheme,
    initPasswordToggles: initPasswordToggles,
    debounce: debounce,
    formatarData: formatarData,
    iniciais: iniciais
  };
})();
