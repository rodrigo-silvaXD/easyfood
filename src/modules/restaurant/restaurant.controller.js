const restaurantService = require("./restaurant.service");
const validate = require("../shared/validation");

async function list(req, res) {
  try {
    const restaurantes = await restaurantService.listRestaurants();
    res.json(restaurantes);
  } catch (error) {
    console.error("Erro ao buscar restaurantes:", error.message);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
}

function handleError(res, error, context) {
  const status = error.statusCode || 500;
  if (status === 500) console.error(`${context}:`, error.message);
  res.status(status).json({ error: status === 500 ? "Erro interno do servidor" : error.message });
}

async function create(req, res) {
  try {
    // "rating" no corpo é ignorado: o dono não define a própria nota (ADR-004)
    const data = {
      name: validate.text(req.body.name, "Nome", { max: 150 }),
      category: validate.text(req.body.category, "Categoria", { max: 100 })
    };

    const restaurant = await restaurantService.createRestaurant(data, req.user);
    res.status(201).json(restaurant);
  } catch (error) {
    handleError(res, error, "Erro ao cadastrar restaurante");
  }
}

async function uploadImage(req, res) {
  try {
    const restaurant = await restaurantService.updateRestaurantImage(req.params.restaurantId, req.file.buffer, req.user.id);
    res.json(restaurant);
  } catch (error) {
    handleError(res, error, "Erro ao salvar capa do restaurante");
  }
}

async function removeImage(req, res) {
  try {
    const restaurant = await restaurantService.removeRestaurantImage(req.params.restaurantId, req.user.id);
    res.json(restaurant);
  } catch (error) {
    handleError(res, error, "Erro ao remover capa do restaurante");
  }
}

module.exports = { list, create, uploadImage, removeImage };