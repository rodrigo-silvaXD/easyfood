/* =========================================================================
   auth.js - telas de login e cadastro, validação e sessão do usuário
   As regras espelham as do back (src/modules/auth/auth.validator.js).
   A validação do cliente é conveniência; quem decide é sempre o servidor.
   ========================================================================= */

window.Auth = (function () {
  const $ = UI.$;
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const SENHA_MIN = 6;

  // ---- Regras de validação --------------------------------------------

  const regras = {
    name: function (valor) {
      if (!valor.trim()) return "Informe seu nome.";
      if (valor.trim().length < 3) return "O nome precisa ter pelo menos 3 caracteres.";
      return null;
    },
    email: function (valor) {
      if (!valor.trim()) return "Informe seu e-mail.";
      if (!EMAIL_REGEX.test(valor.trim())) return "Digite um e-mail válido, como nome@email.com.";
      return null;
    },
    password: function (valor) {
      if (!valor) return "Informe uma senha.";
      if (valor.length < SENHA_MIN) return "A senha precisa ter pelo menos " + SENHA_MIN + " caracteres.";
      return null;
    },
    loginPassword: function (valor) {
      if (!valor) return "Informe sua senha.";
      return null;
    },
    confirm: function (valor, form) {
      if (!valor) return "Confirme sua senha.";
      if (valor !== $("#register-password", form).value) return "As senhas não conferem.";
      return null;
    }
  };

  function validarCampo(form, name, regra) {
    const input = $('[name="' + name + '"]', form);
    if (!input) return true;

    const erro = regra(input.value, form);

    UI.setFieldError(form, name, erro);

    return !erro;
  }

  // Valida ao sair do campo (blur), nunca a cada tecla digitada.
  function ligarValidacao(form, mapa) {
    Object.keys(mapa).forEach(function (name) {
      const input = $('[name="' + name + '"]', form);
      if (!input) return;

      input.addEventListener("blur", function () {
        validarCampo(form, name, mapa[name]);
      });

      // Depois que o campo ja errou uma vez, corrigimos em tempo real.
      input.addEventListener("input", function () {
        const field = input.closest("[data-field]");
        if (field && field.dataset.invalid === "true") {
          validarCampo(form, name, mapa[name]);
        }
      });
    });
  }

  function validarTudo(form, mapa) {
    let ok = true;

    Object.keys(mapa).forEach(function (name) {
      if (!validarCampo(form, name, mapa[name])) ok = false;
    });

    if (!ok) {
      const primeiro = $('[data-invalid="true"] input, [data-invalid="true"] select', form);
      if (primeiro) primeiro.focus();
    }

    return ok;
  }

  // ---- Força da senha --------------------------------------------------

  function medirForca(senha) {
    if (senha.length < SENHA_MIN) return { nivel: senha.length > 0 ? 1 : 0, texto: "Use pelo menos " + SENHA_MIN + " caracteres." };

    let pontos = 1;

    if (senha.length >= 10) pontos++;
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
    if (/\d/.test(senha)) pontos++;
    if (/[^A-Za-z0-9]/.test(senha)) pontos++;

    if (pontos <= 2) return { nivel: 1, texto: "Senha fraca. Misture letras, números e símbolos." };
    if (pontos === 3) return { nivel: 2, texto: "Senha média. Já dá para usar." };
    return { nivel: 3, texto: "Senha forte." };
  }

  function ligarForcaSenha() {
    const input = $("#register-password");
    const medidor = $("#password-strength");
    const label = $("#password-strength-label");

    if (!input || !medidor) return;

    input.addEventListener("input", function () {
      const resultado = medirForca(input.value);
      medidor.dataset.level = String(resultado.nivel);
      label.textContent = resultado.texto;
    });
  }

  // ---- Abas login / cadastro ------------------------------------------

  function trocarAba(alvo) {
    const ehLogin = alvo === "login";

    $("#tab-login").setAttribute("aria-selected", String(ehLogin));
    $("#tab-register").setAttribute("aria-selected", String(!ehLogin));
    $("#panel-login").hidden = !ehLogin;
    $("#panel-register").hidden = ehLogin;

    UI.hideAlert("login-alert");
    UI.hideAlert("register-alert");
  }

  // ---- Submissão -------------------------------------------------------

  async function enviarLogin(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const mapa = { email: regras.email, password: regras.loginPassword };

    UI.hideAlert("login-alert");

    if (!validarTudo(form, mapa)) return;

    const botao = $("[data-submit]", form);
    UI.setLoading(botao, true, "Entrando...");

    try {
      const resultado = await API.auth.login({
        email: $("#login-email").value.trim(),
        password: $("#login-password").value
      });

      API.saveSession(resultado.token, resultado.user);
      form.reset();
      UI.clearFieldErrors(form);

      window.dispatchEvent(new CustomEvent("easyfood:authenticated", { detail: resultado.user }));
      UI.toast("Bem-vindo de volta, " + resultado.user.name.split(" ")[0] + "!", "success");
    } catch (erro) {
      if (erro.fields) {
        UI.applyErrors(form, erro.fields);
      } else {
        UI.showAlert("login-alert", erro.message, "danger");
      }
    } finally {
      UI.setLoading(botao, false);
    }
  }

  async function enviarCadastro(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const mapa = {
      name: regras.name,
      email: regras.email,
      password: regras.password,
      confirm: regras.confirm
    };

    UI.hideAlert("register-alert");

    if (!validarTudo(form, mapa)) return;

    const botao = $("[data-submit]", form);
    UI.setLoading(botao, true, "Criando conta...");

    try {
      const resultado = await API.auth.register({
        name: $("#register-name").value.trim(),
        email: $("#register-email").value.trim(),
        password: $("#register-password").value
      });

      API.saveSession(resultado.token, resultado.user);
      form.reset();
      UI.clearFieldErrors(form);
      $("#password-strength").dataset.level = "0";

      window.dispatchEvent(new CustomEvent("easyfood:authenticated", { detail: resultado.user }));
      UI.toast("Conta criada! Bom apetite, " + resultado.user.name.split(" ")[0] + ".", "success");
    } catch (erro) {
      if (erro.fields) {
        UI.applyErrors(form, erro.fields);
        if (erro.status === 409) trocarAba("register");
      } else {
        UI.showAlert("register-alert", erro.message, "danger");
      }
    } finally {
      UI.setLoading(botao, false);
    }
  }

  // ---- Inicialização ---------------------------------------------------

  function init() {
    const formLogin = $("#form-login");
    const formCadastro = $("#form-register");

    ligarValidacao(formLogin, { email: regras.email, password: regras.loginPassword });
    ligarValidacao(formCadastro, {
      name: regras.name,
      email: regras.email,
      password: regras.password,
      confirm: regras.confirm
    });

    ligarForcaSenha();

    formLogin.addEventListener("submit", enviarLogin);
    formCadastro.addEventListener("submit", enviarCadastro);

    $("#tab-login").addEventListener("click", () => trocarAba("login"));
    $("#tab-register").addEventListener("click", () => trocarAba("register"));
  }

  return { init: init, trocarAba: trocarAba };
})();
