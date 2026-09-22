// Categorias aceitas pela EasyFood. Manter a lista no back garante que o
// filtro do front e o cadastro falem a mesma língua.
const CATEGORIAS = [
  "Pizza",
  "Burger",
  "Japonesa",
  "Italiana",
  "Mexicana",
  "Brasileira",
  "Saudável",
  "Padaria"
];

const NOME_MIN = 3;
const NOME_MAX = 150;

function validarRestaurante({ name, category, rating }) {
  const erros = {};

  if (typeof name !== "string" || name.trim().length === 0) {
    erros.name = "Informe o nome do restaurante.";
  } else if (name.trim().length < NOME_MIN) {
    erros.name = `O nome precisa ter pelo menos ${NOME_MIN} caracteres.`;
  } else if (name.trim().length > NOME_MAX) {
    erros.name = `O nome pode ter no máximo ${NOME_MAX} caracteres.`;
  }

  if (typeof category !== "string" || category.trim().length === 0) {
    erros.category = "Escolha uma categoria.";
  } else if (!CATEGORIAS.includes(category.trim())) {
    erros.category = `Categoria inválida. Use uma destas: ${CATEGORIAS.join(", ")}.`;
  }

  if (rating !== undefined && rating !== null && rating !== "") {
    const nota = Number(rating);

    if (Number.isNaN(nota)) {
      erros.rating = "A avaliação precisa ser um número.";
    } else if (nota < 0 || nota > 5) {
      erros.rating = "A avaliação precisa estar entre 0 e 5.";
    }
  }

  return erros;
}

module.exports = { validarRestaurante, CATEGORIAS };
