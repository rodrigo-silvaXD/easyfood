const jwt = require("jsonwebtoken");

// Middleware de autenticação: lê o header Authorization, valida o JWT e,
// se estiver tudo certo, coloca o usuário em req.user e segue para a rota.

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    req.user = { id: payload.sub, email: payload.email };

    return next();
  } catch (error) {
    const expirou = error.name === "TokenExpiredError";

    return res.status(401).json({
      error: expirou ? "Sessão expirada. Faça login novamente." : "Token inválido"
    });
  }
}

module.exports = authenticate;
