// Original photographs from the owner's orion.zip, copied without editing.
// Extensions match the actual encoded formats; provenance.json records SHA-256 hashes.
const photograph = (file, width, height, background = '#242424') => ({
  src: `/products/originals/${file}`,
  width,
  height,
  background,
  source: 'Fotografia original enviada pelo proprietário da Kalops em orion.zip',
  treatment: 'Nenhum; fundo, proporção e bytes originais preservados',
});
export const productImages = {
  leave: photograph('leave.webp', 667, 1000),
  stone: photograph('stone.jpg', 667, 1000),
  oleo: photograph('oleo.jpg', 1000, 750),
  ice: photograph('ice.jpg', 750, 1000),
  orion: photograph('orion.webp', 1000, 1000, '#fff'),
};
