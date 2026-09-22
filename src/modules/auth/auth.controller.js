const authService = require("./auth.service");
const { validarRegistro, validarLogin } = require("./auth.validator");

// Responsabilidade do Controller: receber a requisição HTTP, validar a entrada,
// chamar o Service e devolver a resposta correta. Sem regra de negócio e sem Prisma.

async function register(req, res) {
  const { name, email, password } = req.body || {};

  const erros = validarRegistro({ name, email, password });

  if (Object.keys(erros).length > 0) {
    return res.status(400).json({
      error: "Dados inválidos",
      fields: erros
    });
  }

  try {
    const resultado = await authService.register({
      name: name.trim(),
      email: email.trim(),
      password
    });

    return res.status(201).json(resultado);
  } catch (error) {
    // P2002 = violação de restrição UNIQUE (e-mail já cadastrado)
    if (error.code === "P2002") {
      return res.status(409).json({
        error: "E-mail já cadastrado",
        fields: { email: "Este e-mail já está em uso. Tente fazer login." }
      });
    }

    console.error("Erro ao cadastrar usuário:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

async function login(req, res) {
  const { email, password } = req.body || {};

  const erros = validarLogin({ email, password });

  if (Object.keys(erros).length > 0) {
    return res.status(400).json({
      error: "Dados inválidos",
      fields: erros
    });
  }

  try {
    const resultado = await authService.login({
      email: email.trim(),
      password
    });

    if (!resultado) {
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }

    return res.json(resultado);
  } catch (error) {
    console.error("Erro ao autenticar usuário:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

async function me(req, res) {
  try {
    const user = await authService.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const totalRestaurantes = await authService.countRestaurantsByUser(user.id);

    return res.json({ user, stats: { restaurants: totalRestaurantes } });
  } catch (error) {
    console.error("Erro ao carregar perfil:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

module.exports = { register, login, me };
