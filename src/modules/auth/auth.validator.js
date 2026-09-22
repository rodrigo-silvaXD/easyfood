// Validação de entrada do módulo auth.
// Fica separada do controller para que a mesma regra possa ser reaproveitada
// e testada sem depender de req/res.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

const NOME_MIN = 3;
const NOME_MAX = 150;
const SENHA_MIN = 6;
const SENHA_MAX = 72; // limite do bcrypt

function validarRegistro({ name, email, password }) {
  const erros = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    erros.name = "Informe seu nome.";
  } else if (name.trim().length < NOME_MIN) {
    erros.name = `O nome precisa ter pelo menos ${NOME_MIN} caracteres.`;
  } else if (name.trim().length > NOME_MAX) {
    erros.name = `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
  }

  if (typeof email !== "string" || email.trim().length === 0) {
    erros.email = "Informe seu e-mail.";
  } else if (!EMAIL_REGEX.test(email.trim())) {
    erros.email = "Digite um e-mail válido, como nome@email.com.";
  }

  if (typeof password !== "string" || password.length === 0) {
    erros.password = "Informe uma senha.";
  } else if (password.length < SENHA_MIN) {
    erros.password = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  } else if (password.length > SENHA_MAX) {
    erros.password = `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  }

  return erros;
}

function validarLogin({ email, password }) {
  const erros = {};

  if (typeof email !== "string" || email.trim().length === 0) {
    erros.email = "Informe seu e-mail.";
  } else if (!EMAIL_REGEX.test(email.trim())) {
    erros.email = "Digite um e-mail válido.";
  }

  if (typeof password !== "string" || password.length === 0) {
    erros.password = "Informe sua senha.";
  }

  return erros;
}

module.exports = { validarRegistro, validarLogin, EMAIL_REGEX };
