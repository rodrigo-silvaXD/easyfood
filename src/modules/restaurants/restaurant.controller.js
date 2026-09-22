const restaurantService = require("./restaurant.service");
const { validarRestaurante, CATEGORIAS } = require("./restaurant.validator");

// GET /restaurants  (público)
// Continua devolvendo um array JSON, como nas aulas anteriores.
// Os filtros e a paginação são opcionais: ?category=Pizza&search=napoli&page=1&limit=8
// O total de resultados vai no header X-Total-Count para não quebrar o contrato da rota.
async function list(req, res) {
  try {
    const { category, search, page, limit, sort } = req.query;

    const { total, restaurants } = await restaurantService.listRestaurants({
      category,
      search,
      page,
      limit,
      sort
    });

    res.set("X-Total-Count", String(total));
    res.set("Access-Control-Expose-Headers", "X-Total-Count");

    return res.json(restaurants);
  } catch (error) {
    console.error("Erro ao buscar restaurantes:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

// GET /restaurants/categories  (público)
async function categories(req, res) {
  return res.json(CATEGORIAS);
}

// GET /restaurants/mine  (protegido)
async function mine(req, res) {
  try {
    const restaurants = await restaurantService.listByOwner(req.user.id);
    return res.json(restaurants);
  } catch (error) {
    console.error("Erro ao buscar restaurantes do usuário:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

// GET /restaurants/:id  (público)
async function show(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const restaurant = await restaurantService.findById(id);

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurante não encontrado" });
    }

    return res.json(restaurant);
  } catch (error) {
    console.error("Erro ao buscar restaurante:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

// POST /restaurants  (protegido por JWT)
async function create(req, res) {
  const { name, category, rating } = req.body || {};

  const erros = validarRestaurante({ name, category, rating });

  if (Object.keys(erros).length > 0) {
    return res.status(400).json({
      error: "Dados inválidos",
      fields: erros
    });
  }

  try {
    const restaurant = await restaurantService.createRestaurant({
      name: name.trim(),
      category: category.trim(),
      rating,
      ownerId: req.user.id
    });

    return res.status(201).json(restaurant);
  } catch (error) {
    console.error("Erro ao cadastrar restaurante:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

// DELETE /restaurants/:id  (protegido — só o dono remove)
async function remove(req, res) {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "Identificador inválido" });
  }

  try {
    const restaurant = await restaurantService.findById(id);

    if (!restaurant) {
      return res.status(404).json({ error: "Restaurante não encontrado" });
    }

    if (restaurant.ownerId !== req.user.id) {
      return res.status(403).json({ error: "Você só pode remover restaurantes que cadastrou" });
    }

    await restaurantService.deleteRestaurant(id);

    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover restaurante:", error.message);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
}

module.exports = { list, categories, mine, show, create, remove };
