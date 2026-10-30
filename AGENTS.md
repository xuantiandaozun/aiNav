## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Cursor Cloud specific instructions

- Dependencies need Node.js 22.19 or newer (`undici`). A shell may resolve `/exec-daemon/node` (v22.14) first. Before `npm` or `astro`, prepend the newest directory under `~/.nvm/versions/node` to `PATH`.
- The environment start script already serves the site at http://127.0.0.1:4321 (`npm run dev -- --host 0.0.0.0 --port 4321`) and skips startup when that URL responds. Do not start a second dev server while it is up.
- `npm run build` writes the static site to `dist/`. There is no automated test suite. Check `/`, `/tools/` (scene filter), a tool detail page, `/cases/`, and `/news/`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
