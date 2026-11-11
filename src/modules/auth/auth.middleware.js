const jwt = require("jsonwebtoken");
const prisma = require("../../database/prisma");

const JWT_SECRET = process.env.JWT_SECRET;


async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Espera o formato: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const token = authHeader.split(" ")[1];

  let payload;
  try {
    // Verifica a assinatura e a validade do token
    payload = jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  if (!Number.isInteger(payload.sub)) {
    return res.status(401).json({ error: "Token inválido ou expirado" });
  }

  // Um token válido pode ser de uma conta que já foi apagada (ADR-005):
  // sem esta checagem, a requisição seguia e gravava dados de um usuário inexistente
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true }
  });

  if (!user) {
    return res.status(401).json({ error: "Sua conta não existe mais. Faça login novamente." });
  }

  // Anexa os dados atuais do usuário (do banco, não do token) na requisição
  req.user = user;

  next(); // token válido → segue para a rota
}

module.exports = authenticate;
