# Kalops development and deployment

- Use this existing checkout; do not create a worktree unless requested.
- Preserve the official black, white and off-white identity and prioritize mobile layouts.
- Keep product images proportional with `object-fit: contain`; do not restore the old generated lineup.
- Wholesale prices come from the supplied catalog; minimum quantity is 10 units per product.
- Run `npm run build` for application changes. With Vite running, use `node scripts/check.cjs` for routing/order changes and `node scripts/check-product-layout.cjs` for responsive product/layout changes.
- The owner requested automatic publication of future site updates. For requested implementation changes, complete relevant validation, commit only the intended changes, then push with `git push origin HEAD:main`. Respect any newer user instruction to keep changes local or use a review branch. Never force-push or overwrite remote changes; investigate and integrate concurrent work first.
- Production repository: `silvakapo74-sketch/kalops`, branch `main`. `netlify.toml` sets Node 24, build command `npm run build`, and output directory `dist`.
- The initial repository push is complete. Linking the existing Netlify site to this repository requires the owner to authorize the GitHub integration in Netlify. Do not claim automatic deployment is active or a release is live until there is evidence of that connection and a successful deploy.
- Never request credential values in chat or commit credentials, caches, or build output.
