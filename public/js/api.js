/* =========================================================================
   api.js - camada de acesso à API da EasyFood
   Concentra fetch, token JWT e tratamento de erro em um lugar só.
   ========================================================================= */

window.API = (function () {
  // A interface é servida pelo próprio Express, então usamos caminho relativo.
  const BASE_URL = "";
  const TOKEN_KEY = "easyfood:token";
  const USER_KEY = "easyfood:user";

  // ---- Sessão ----------------------------------------------------------

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(token, user) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (e) {
      /* modo privado pode bloquear o storage; a sessão dura só a página */
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch (e) {
      /* ignora */
    }
  }

  function isLoggedIn() {
    return Boolean(getToken());
  }

  // ---- Erro padronizado ------------------------------------------------

  class ApiError extends Error {
    constructor(message, status, fields) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.fields = fields || null;
    }
  }

  // Disparado quando o token expira ou fica inválido: o app volta para o login.
  function notifyUnauthorized() {
    window.dispatchEvent(new CustomEvent("easyfood:unauthorized"));
  }

  // ---- Request ---------------------------------------------------------

  async function request(path, options) {
    const config = options || {};
    const headers = Object.assign({}, config.headers);

    if (config.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = getToken();

    if (token && config.auth !== false) {
      headers.Authorization = "Bearer " + token;
    }

    let response;

    try {
      response = await fetch(BASE_URL + path, {
        method: config.method || "GET",
        headers: headers,
        body: config.body === undefined ? undefined : JSON.stringify(config.body)
      });
    } catch (networkError) {
      throw new ApiError(
        "Não foi possível falar com o servidor. Verifique se a API está rodando.",
        0
      );
    }

    if (response.status === 204) {
      return { data: null, total: 0 };
    }

    let payload = null;

    try {
      payload = await response.json();
    } catch (e) {
      payload = null;
    }

    if (!response.ok) {
      if (response.status === 401 && getToken()) {
        clearSession();
        notifyUnauthorized();
      }

      throw new ApiError(
        (payload && payload.error) || "Erro inesperado (" + response.status + ")",
        response.status,
        payload && payload.fields
      );
    }

    const total = Number(response.headers.get("X-Total-Count"));

    return {
      data: payload,
      total: Number.isNaN(total) ? null : total
    };
  }

  // ---- Endpoints -------------------------------------------------------

  const auth = {
    register(body) {
      return request("/auth/register", { method: "POST", body: body, auth: false })
        .then((r) => r.data);
    },
    login(body) {
      return request("/auth/login", { method: "POST", body: body, auth: false })
        .then((r) => r.data);
    },
    me() {
      return request("/auth/me").then((r) => r.data);
    }
  };

  const restaurants = {
    list(params) {
      const query = new URLSearchParams();

      Object.keys(params || {}).forEach(function (key) {
        const value = params[key];
        if (value !== undefined && value !== null && value !== "") {
          query.set(key, value);
        }
      });

      const suffix = query.toString() ? "?" + query.toString() : "";

      return request("/restaurants" + suffix, { auth: false });
    },
    categories() {
      return request("/restaurants/categories", { auth: false }).then((r) => r.data);
    },
    mine() {
      return request("/restaurants/mine").then((r) => r.data);
    },
    create(body) {
      return request("/restaurants", { method: "POST", body: body }).then((r) => r.data);
    },
    remove(id) {
      return request("/restaurants/" + id, { method: "DELETE" });
    }
  };

  return {
    ApiError: ApiError,
    auth: auth,
    restaurants: restaurants,
    getToken: getToken,
    getUser: getUser,
    saveSession: saveSession,
    clearSession: clearSession,
    isLoggedIn: isLoggedIn
  };
})();
