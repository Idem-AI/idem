# Matrice des modèles OpenRouter

Générée le 2026-10-10 par `npm run openrouter:matrix` (liste blanche vérifiée le 2026-10-11). Ne pas éditer à la main : modifier `config/openrouter.config.ts`.

**Open-weight = `hugging_face_id` au catalogue + licence lue sur Hugging Face.** « Disponible sur OpenRouter » ne prouve rien.

| Identifiant OpenRouter | Type | Poids ouverts · licence | Usage commercial | Français | Coût | Auto-hébergement | Rôle |
|---|---|---|---|---|---|---|---|
| `qwen/qwen3.5-9b` | text | oui · apache-2.0 | oui | 4/4 · 2.4 s | 0.1 / 0.15 $/M | léger | **défaut mechanical** |
| `qwen/qwen3.5-35b-a3b` | text | oui · apache-2.0 | oui | 4/4 · 4.7 s | 0.08 / 0.75 $/M | léger | **défaut vision** |
| `qwen/qwen3.5-27b` | text | oui · apache-2.0 | oui | 4/4 · 2.9 s | 0.26 / 2.6 $/M | moyen | writing |
| `qwen/qwen3.5-122b-a10b` | text | oui · apache-2.0 | oui | 4/4 · 3.3 s | 0.26 / 2.08 $/M | moyen | **défaut writing** |
| `qwen/qwen3.5-397b-a17b` | text | oui · apache-2.0 | oui | 4/4 · 1.3 s | 0.55 / 3.5 $/M | lourd | **défaut reasoning** |
| `qwen/qwen3-vl-30b-a3b-instruct` | text | oui · apache-2.0 | oui | 4/4 · 2.9 s | 0.15 / 0.6 $/M | léger | **défaut ocr** |
| `qwen/qwen3-coder-next` | text | oui · apache-2.0 | oui | 4/4 · 2.5 s | 0.12 / 0.8 $/M | moyen | — |
| `qwen/qwen3-coder` | text | oui · apache-2.0 | oui | 4/4 · 6.5 s | 0.3 / 1 $/M | lourd | — |
| `qwen/qwen3.6-35b-a3b` | text | oui · apache-2.0 | oui | 4/4 · 1.9 s | 0.1 / 0.95 $/M | léger | mechanical, vision |
| `qwen/qwen3.8-27b` | text | oui · apache-2.0 | oui | 4/4 · 2.2 s | 0.425 / 2.55 $/M | moyen | writing |
| `deepseek/deepseek-v4-flash` | text | oui · mit | oui | 4/4 · 3.3 s | 0.03 / 1.28 $/M | lourd | writing, mechanical |
| `deepseek/deepseek-v4-pro` | text | oui · mit | oui | 4/4 · 3.9 s | 0.209 / 0.418 $/M | lourd | reasoning |
| `black-forest-labs/flux.2-klein-4b` | image | oui · apache-2.0 | oui | texte dans l’image : à tester | 0.0034 $/image | léger | **défaut image** |
| `black-forest-labs/flux.2-pro` | image | **non** (API fermée) | oui | texte dans l’image : à tester | 0.0073 $/image | impossible | — |
| `black-forest-labs/flux.2-flex` | image | **non** (API fermée) | oui | texte dans l’image : à tester | 0.0146 $/image | impossible | — |
| `black-forest-labs/flux.2-max` | image | **non** (API fermée) | oui | texte dans l’image : à tester | 0.0171 $/image | impossible | — |
| `alibaba/wan-2.7` | video | **non** (API fermée) | oui | n/a | — | impossible | — |
| `alibaba/wan-3.0` | video | **non** (API fermée) | oui | n/a | — | impossible | — |

## Écarts constatés à l’exécution
- aucun

## Modèles ouverts du catalogue non encore examinés
- `deepseek/deepseek-chat`
- `deepseek/deepseek-chat-v3-0324`
- `deepseek/deepseek-chat-v3.1`
- `deepseek/deepseek-r1`
- `deepseek/deepseek-r1-0528`
- `deepseek/deepseek-v3.1-terminus`
- `deepseek/deepseek-v3.2`
- `deepseek/deepseek-v3.2-exp`
- `deepseek/deepseek-v4-flash-0731`
- `deepseek/deepseek-v4-flash-vision-exp`
- `deepseek/deepseek-v4-pro-0813`
- `deepseek/deepseek-v4.1-flash`
- `qwen/qwen-2.5-72b-instruct`
- `qwen/qwen-2.5-7b-instruct`
- `qwen/qwen-2.5-coder-32b-instruct`
- `qwen/qwen2.5-vl-72b-instruct`
- `qwen/qwen3-14b`
- `qwen/qwen3-235b-a22b-2507`
- `qwen/qwen3-235b-a22b-thinking-2507`
- `qwen/qwen3-30b-a3b`
- `qwen/qwen3-30b-a3b-instruct-2507`
- `qwen/qwen3-32b`
- `qwen/qwen3-coder-30b-a3b-instruct`
- `qwen/qwen3-next-80b-a3b-instruct`
- `qwen/qwen3-next-80b-a3b-thinking`
- `qwen/qwen3-vl-235b-a22b-instruct`
- `qwen/qwen3-vl-30b-a3b-thinking`
- `qwen/qwen3-vl-8b-instruct`
- `qwen/qwen3.6-27b`
- `qwen/qwen3.8-2.4t-a95b`
- `qwen/qwen3.8-flash`
