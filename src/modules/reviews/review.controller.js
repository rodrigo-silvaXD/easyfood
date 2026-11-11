const reviewService = require("./review.service");

function handleError(res, error) {
  const status = error.statusCode || 500;
  if (status === 500) console.error("Erro nas avaliações:", error.message);
  res.status(status).json({ error: status === 500 ? "Erro interno do servidor" : error.message });
}

async function rate(req, res) {
  try {
    const result = await reviewService.rate(req.params.restaurantId, req.user.id, req.body.rating);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
}

async function mine(req, res) {
  try {
    res.json(await reviewService.getMine(req.params.restaurantId, req.user.id));
  } catch (error) {
    handleError(res, error);
  }
}

module.exports = { rate, mine };
