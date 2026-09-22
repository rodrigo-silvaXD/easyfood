const prisma = require("../../database/prisma");

// Responsabilidade do Service: regras e operações de restaurantes.
// Repare que aqui não existe req nem res — o Service não depende de HTTP.

const LIMITE_PADRAO = 8;
const LIMITE_MAXIMO = 50;

const restaurantSelect = {
  id: true,
  name: true,
  category: true,
  rating: true,
  createdAt: true,
  ownerId: true,
  owner: { select: { id: true, name: true } }
};

// O Prisma devolve Decimal para o campo rating. Convertemos para número aqui
// para que a API sempre entregue JSON previsível ao front.
function serializar(restaurant) {
  if (!restaurant) {
    return null;
  }

  return {
    ...restaurant,
    rating: restaurant.rating === null ? null : Number(restaurant.rating)
  };
}

function montarFiltro({ category, search }) {
  const where = {};

  if (category && category !== "Todos") {
    where.category = category;
  }

  if (search) {
    where.name = { contains: search, mode: "insensitive" };
  }

  return where;
}

async function listRestaurants({ category, search, page = 1, limit = LIMITE_PADRAO, sort = "rating" } = {}) {
  const where = montarFiltro({ category, search });

  const paginaAtual = Math.max(1, Number(page) || 1);
  const porPagina = Math.min(LIMITE_MAXIMO, Math.max(1, Number(limit) || LIMITE_PADRAO));

  const orderBy =
    sort === "name"
      ? { name: "asc" }
      : sort === "recent"
        ? { createdAt: "desc" }
        : { rating: "desc" };

  // $transaction executa as duas consultas na mesma conexão e no mesmo snapshot:
  // o total e a página nunca ficam inconsistentes entre si, e a contagem não
  // disputa conexão com a listagem quando o banco está atrás de um pooler.
  const [total, restaurants] = await prisma.$transaction([
    prisma.restaurant.count({ where }),
    prisma.restaurant.findMany({
      where,
      orderBy,
      skip: (paginaAtual - 1) * porPagina,
      take: porPagina,
      select: restaurantSelect
    })
  ]);

  return { total, restaurants: restaurants.map(serializar) };
}

async function findById(id) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    select: restaurantSelect
  });

  return serializar(restaurant);
}

async function createRestaurant({ name, category, rating, ownerId }) {
  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      category,
      rating: rating === undefined || rating === null || rating === "" ? 0 : Number(rating),
      ownerId: ownerId ?? null
    },
    select: restaurantSelect
  });

  return serializar(restaurant);
}

async function deleteRestaurant(id) {
  await prisma.restaurant.delete({ where: { id } });
}

async function listByOwner(ownerId) {
  const restaurants = await prisma.restaurant.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: restaurantSelect
  });

  return restaurants.map(serializar);
}

module.exports = {
  listRestaurants,
  findById,
  createRestaurant,
  deleteRestaurant,
  listByOwner,
  LIMITE_PADRAO
};
