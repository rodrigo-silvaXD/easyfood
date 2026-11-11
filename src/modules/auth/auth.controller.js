const authService = require("./auth.service");
const limiter = require("./login.limiter");
const validate = require("../shared/validation");

function handleError(res, error, context) {
  const status = error.statusCode || 500;
  if (status === 500) console.error(`${context}:`, error.message);
  res.status(status).json({ error: status === 500 ? "Erro interno do servidor" : error.message });
}

async function register(req, res) {
  try {
    const name = validate.text(req.body.name, "Nome", { min: 2, max: 150 });
    const email = validate.email(req.body.email);
    const password = req.body.password;

    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "A senha deve ter pelo menos 6 caracteres" });
    }
    // bcrypt só considera os primeiros 72 bytes da senha
    if (Buffer.byteLength(password) > 72) {
      return res.status(400).json({ error: "A senha deve ter no máximo 72 caracteres" });
    }

    const user = await authService.register({ name, email, password });
    res.status(201).json(user);
  } catch (error) {
    // e-mail duplicado (checagem do service ou violação do @unique)
    if (error.code === "P2002") {
      return res.status(409).json({ error: "E-mail já cadastrado" });
    }
    handleError(res, error, "Erro ao cadastrar usuário");
  }
}

async function login(req, res) {
  const { email, password } = req.body;

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
  }

  const normalized = email.trim().toLowerCase();
  const wait = limiter.minutesBlocked(req.ip, normalized);

  if (wait > 0) {
    return res.status(429).json({
      error: `Muitas tentativas de login. Tente novamente em ${wait} minuto${wait > 1 ? "s" : ""}.`
    });
  }

  try {
    const result = await authService.login({ email: normalized, password });

    if (!result) {
      limiter.registerFailure(req.ip, normalized);
      return res.status(401).json({ error: "E-mail ou senha incorretos" });
    }

    limiter.reset(req.ip, normalized);
    res.json(result);
  } catch (error) {
    handleError(res, error, "Erro no login");
  }
}

async function uploadImage(req, res) {
  try {
    const user = await authService.updateProfileImage(req.user.id, req.file.buffer);
    res.json(user);
  } catch (error) {
    handleError(res, error, "Erro ao salvar foto de perfil");
  }
}

async function removeImage(req, res) {
  try {
    const user = await authService.removeProfileImage(req.user.id);
    res.json(user);
  } catch (error) {
    handleError(res, error, "Erro ao remover foto de perfil");
  }
}

module.exports = { register, login, uploadImage, removeImage };
