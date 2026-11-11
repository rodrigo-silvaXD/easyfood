const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");

const UPLOADS_DIR = path.join(__dirname, "../../../uploads");
const PUBLIC_PREFIX = "/uploads";

/**
 * Otimiza e armazena uma imagem. Não sabe se ela é de um usuário ou de um prato:
 * quem chama informa a pasta e o tamanho desejado.
 *
 * @returns {Promise<string>} caminho público da imagem, ex.: /uploads/dishes/abc.webp
 */
async function saveImage(buffer, { folder, width, height }) {
  let optimized;

  try {
    optimized = await sharp(buffer)
      .rotate() // respeita a orientação EXIF de fotos tiradas no celular
      .resize(width, height, { fit: "cover", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    // O mimetype vem do cliente e pode mentir; o Sharp é quem confirma se é imagem de verdade.
    const error = new Error("Arquivo de imagem inválido ou corrompido");
    error.statusCode = 422;
    throw error;
  }

  const dir = path.join(UPLOADS_DIR, folder);
  const fileName = `${crypto.randomUUID()}.webp`;

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, fileName), optimized);

  return `${PUBLIC_PREFIX}/${folder}/${fileName}`;
}

// Apaga uma imagem salva por este serviço. Caminhos fora de /uploads são ignorados.
async function removeImage(publicPath) {
  if (!publicPath || !publicPath.startsWith(`${PUBLIC_PREFIX}/`)) return;

  const filePath = path.resolve(UPLOADS_DIR, publicPath.slice(PUBLIC_PREFIX.length + 1));
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) return;

  await fs.rm(filePath, { force: true });
}

/**
 * Troca a imagem de um registro: salva a nova, deixa o módulo gravar o caminho no banco
 * (persist) e só então apaga a antiga. Se o banco falhar, a imagem nova é descartada.
 */
async function replaceImage(buffer, options, oldPath, persist) {
  const newPath = await saveImage(buffer, options);

  let result;
  try {
    result = await persist(newPath);
  } catch (error) {
    await removeImage(newPath).catch(() => {});
    throw error;
  }

  try {
    await removeImage(oldPath);
  } catch (error) {
    console.error("Não foi possível remover a imagem antiga:", error.message);
  }

  return result;
}

module.exports = { saveImage, removeImage, replaceImage, UPLOADS_DIR, PUBLIC_PREFIX };
