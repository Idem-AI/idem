# OpenRouter — modèles ouverts et bascule à chaud

## Basculer (sans redéploiement)

```bash
npm run ai:provider                                  # réglage en vigueur
npm run ai:provider -- openrouter                    # texte, vision, OCR et image par OpenRouter
npm run ai:provider -- glm | gemini                  # retour
npm run ai:provider -- openrouter --media glm        # texte OpenRouter, image restée sur GLM
npm run ai:provider -- --model writing=qwen/qwen3.5-27b   # change le modèle d'un rôle
npm run ai:provider -- --reset                       # retour aux variables d'environnement
npm run mockups:provider -- openrouter               # mises en situation de la charte (FLUX.2)
```

Écrit `platform_settings/ai` ; chaque instance le relit sous 15 s. Précédence : base > `AI_DEFAULT_PROVIDER` / `IDEM_MEDIA_PROVIDER` > features (GLM). Une bascule vers un fournisseur sans clé est refusée. iVision suit automatiquement (il passe par la passerelle d'IDEM).

## Liste blanche

`config/openrouter.config.ts` est la source unique : identifiant exact, `hugging_face_id`, licence lue sur Hugging Face. Un modèle hors liste, ou à API fermée tant que `OPENROUTER_OPEN_ONLY` n'est pas coupé, est refusé (variables d'env, CLI et base). `npm run openrouter:matrix` revérifie tout contre le catalogue en direct et écrit `OPENROUTER_MODEL_MATRIX.md` (`-- --probe` ajoute un test de français, clé requise).

## Ce que le catalogue du 2026-10-11 a montré

- Qwen3.5-plus/flash et Qwen3.7 : API fermées. Les Qwen3.5 ouverts sont 9b, 27b, 35b-a3b, 122b-a10b, 397b-a17b (Apache-2.0).
- FLUX.2 : seul `flux.2-klein-4b` a des poids ouverts (Apache-2.0) ; `pro`, `flex`, `max` sont fermés (utilisables pour comparer la qualité avec `OPENROUTER_OPEN_ONLY=off`).
- FLUX.1-schnell et Qwen-Image : absents ou fermés sur OpenRouter.
- Vidéo (Wan 2.7/3.0 compris) : aucun modèle ouvert sur OpenRouter. **Seedance 2.0** (`bytedance/seedance-2.0`) est la vidéo par défaut, par dérogation produit (`allowClosed`) : fermé, non auto-hébergeable. Variantes `-fast` / `-mini` via `IDEM_OPENROUTER_VIDEO_MODEL`. Wan reste refusé sauf `OPENROUTER_OPEN_ONLY=off`. Sans OpenRouter comme média, CogVideoX-3.
- Voix : le seul modèle ouvert, commercial et francophone d'OpenRouter est **Kokoro 82M** (`ff_siwis`). Voxtral TTS est non commercial (exclu). **Qwen3-TTS** (Apache-2.0) et **Chatterbox Multilingual** (MIT) sont ouverts mais PAS sur OpenRouter : les servir soi-même derrière un `/audio/speech` OpenAI-compatible et pointer `IDEM_TTS_URL` + `IDEM_TTS_MODEL` (+ `IDEM_TTS_VOICE_FR`).
- Code : pas de « DeepSeek Coder » ; alternative = DeepSeek V4 (MIT).
- Qwen Image sur OpenRouter est fermé : alternative d'image à comparer, pas auto-hébergeable.

## Les cinq usages

| Usage | Principal | Alternative à tester | Comment tester |
|---|---|---|---|
| Texte / raisonnement | Qwen3.5 (par rôle) | DeepSeek V4 | `AI_OVERRIDES='{"Market":{"provider":"OPENROUTER","modelName":"deepseek/deepseek-v4-flash"}}'` ou `--model writing=…` |
| Code | Qwen3-Coder-Next | DeepSeek V4 Flash | sélecteur de we-dev-next |
| Voix off | Kokoro (OpenRouter) → Qwen3-TTS / Chatterbox auto-hébergés | Chatterbox / Qwen3-TTS | `IDEM_TTS_URL`, ou `IDEM_OPENROUTER_TTS_MODEL` |
| Image | FLUX.2 klein 4B | Qwen Image 3 (fermé) | `--model image=…` ; fermés avec `OPENROUTER_OPEN_ONLY=off` |
| Vidéo | Seedance 2.0 (fermé, dérogation) | Wan 2.7 / CogVideoX-3 | `IDEM_OPENROUTER_VIDEO_MODEL=alibaba/wan-2.7` + `OPENROUTER_OPEN_ONLY=off` |

La voix et la vidéo par OpenRouter ne s'activent que lorsque OpenRouter est le média en vigueur (`ai:provider -- openrouter`) ; en cas d'échec ou de langue sans voix, la chaîne habituelle (GLM-TTS → Gemini TTS ; CogVideoX-3) reprend.

## Variables

`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` (→ serveur vLLM/SGLang plus tard), `IDEM_OPENROUTER_<ROLE>_MODEL`, `IDEM_OPENROUTER_IMAGE_FALLBACK_MODEL`, `IDEM_OPENROUTER_TTS_MODEL`, `IDEM_OPENROUTER_VIDEO_MODEL`, `IDEM_TTS_URL`, `IDEM_TTS_MODEL`, `IDEM_TTS_API_KEY`, `OPENROUTER_OPEN_ONLY`, `OPENROUTER_ALLOW_UNLISTED`, `OPENROUTER_DATA_COLLECTION` (défaut `deny`).
