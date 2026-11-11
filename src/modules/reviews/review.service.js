const prisma = require("../../database/prisma");
const validate = require("../shared/validation");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function findRestaurant(restaurantId) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: validate.id(restaurantId) } });
  if (!restaurant) throw httpError(404, "Restaurante não encontrado");
  return restaurant;
}

// Média com uma casa decimal, no formato da coluna Restaurant.rating (Decimal 2,1)
async function summary(restaurantId) {
  const result = await prisma.review.aggregate({
    where: { restaurantId },
    _avg: { rating: true },
    _count: { _all: true }
  });

  return {
    rating: result._avg.rating ? Math.round(result._avg.rating * 10) / 10 : 0,
    reviewsCount: result._count._all
  };
}

// Cria ou troca a avaliação do usuário e recalcula a nota do restaurante
async function rate(restaurantId, userId, value) {
  const restaurant = await findRestaurant(restaurantId);

  if (restaurant.ownerId === userId) {
    throw httpError(403, "Você não pode avaliar o próprio restaurante");
  }
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw httpError(400, "A nota deve ser um número inteiro de 1 a 5");
  }

  await prisma.review.upsert({
    where: { userId_restaurantId: { userId, restaurantId: restaurant.id } },
    create: { userId, restaurantId: restaurant.id, rating: value },
    update: { rating: value }
  });

  const result = await summary(restaurant.id);
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { rating: result.rating } });

  return { restaurantId: restaurant.id, ...result, myRating: value };
}

async function getMine(restaurantId, userId) {
  const restaurant = await findRestaurant(restaurantId);
  const review = await prisma.review.findUnique({
    where: { userId_restaurantId: { userId, restaurantId: restaurant.id } }
  });

  return { restaurantId: restaurant.id, myRating: review ? review.rating : null };
}

module.exports = { rate, getMine };
