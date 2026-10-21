// Individual edits based on the five photographs supplied by the brand owner.
// The inline attachments were processed with imagegen for a white background;
// these are edited derivatives, not byte-for-byte copies or website downloads.
// Never restore the old generated lineup or stretch/crop packaging in CSS.
const photograph = id => ({
  src: `/products/individual/${id}.png`,
  width: 1254,
  height: 1254,
  source: 'Fotografia enviada pelo proprietário da Kalops',
  treatment: 'Edição individual com imagegen para fundo branco',
});
export const productImages = {
  leave: photograph('leave'),
  stone: photograph('stone'),
  oleo: photograph('oleo'),
  ice: photograph('ice'),
  orion: photograph('orion'),
};
