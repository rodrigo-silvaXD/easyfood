// Validações de entrada reaproveitadas pelos módulos. Cada função devolve o valor já
// limpo ou lança um erro com statusCode 400, que os controllers transformam em resposta.

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function text(value, label, { min = 1, max = 255 } = {}) {
  if (typeof value !== "string" || value.trim().length < min) {
    throw badRequest(min > 1 ? `${label} deve ter pelo menos ${min} caracteres` : `${label} é obrigatório`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw badRequest(`${label} deve ter no máximo ${max} caracteres`);
  }
  return trimmed;
}

function email(value) {
  const normalized = text(value, "E-mail", { max: 150 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalized)) {
    throw badRequest("E-mail inválido");
  }
  return normalized;
}

function number(value, label, { min, max }) {
  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw badRequest(`${label} deve ser um número entre ${min} e ${max}`);
  }
  return parsed;
}

function id(value) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw badRequest("Identificador inválido");
  }
  return parsed;
}

module.exports = { text, email, number, id };
