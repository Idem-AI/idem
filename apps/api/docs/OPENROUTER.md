# OpenRouter — le fournisseur de modèles

OpenRouter est le **seul** fournisseur de modèles de la plateforme (texte, vision, image, vidéo, voix). La trajectoire : des modèles dont les poids sont publiés, pour pouvoir les auto-héberger plus tard — il suffira de pointer `OPENROUTER_BASE_URL` vers un serveur vLLM/SGLang (même API).

## Changer de modèle (sans redéploiement)

```bash
npm run ai:models                                              # réglage en vigueur
npm run ai:models -- --model writing=qwen/qwen3.5-27b          # change le modèle d'un rôle
npm run ai:models -- --model image=black-forest-labs/flux.2-klein-4b
npm run ai:models -- --reset                                   # retour aux défauts
```

Écrit `platform_settings/ai` ; chaque instance le relit sous 15 s. Précédence : base > `IDEM_OPENROUTER_<ROLE>_MODEL` > défaut du code. iVision suit automatiquement (il passe par la passerelle d'IDEM).

## Liste blanche

`config/openrouter.config.ts` est la source unique : identifiant exact, `hugging_face_id`, licence lue sur Hugging Face, coût, effort d'auto-hébergement. Est refusé (variables d'env, CLI et base) :

- un modèle hors liste (sauf `OPENROUTER_ALLOW_UNLISTED=on`, pour l'essai ponctuel d'un nouveau modèle) ;
- un modèle à **API fermée** (sauf dérogation explicite `allowClosed`, ou `OPENROUTER_OPEN_ONLY=off` pour un test de qualité) ;
- un modèle ouvert à licence **non commerciale**.

`npm run openrouter:matrix` revérifie tout contre le catalogue en direct (identifiant, dépôt, licence, prix) et écrit [OPENROUTER_MODEL_MATRIX.md](OPENROUTER_MODEL_MATRIX.md) ; `-- --probe` ajoute un test de français (clé requise). « Disponible sur OpenRouter » ne prouve pas « open-weight » : la preuve est le `hugging_face_id` du catalogue et la licence de la fiche Hugging Face.

## Ce que le catalogue du 2026-10-11 a montré

- Qwen3.5-plus/flash et Qwen3.7 : API fermées. Les Qwen3.5 ouverts sont 9b, 27b, 35b-a3b, 122b-a10b, 397b-a17b (Apache-2.0).
- FLUX.2 : seul `flux.2-klein-4b` a des poids ouverts (Apache-2.0) ; `pro`, `flex`, `max` sont fermés.
- Qwen Image : fermé sur OpenRouter. FLUX.1-schnell : absent.
- Vidéo : aucun modèle ouvert (Wan 2.7/3.0 compris). **Seedance 2.0** (`bytedance/seedance-2.0`) est la vidéo par défaut, par dérogation produit : fermé, non auto-hébergeable. Variantes `-fast` / `-mini` via `IDEM_OPENROUTER_VIDEO_MODEL`.
- Voix : le seul modèle ouvert, commercial et francophone d'OpenRouter est **Kokoro 82M** (`ff_siwis`). Voxtral TTS est non commercial (exclu). **Qwen3-TTS** (Apache-2.0) et **Chatterbox Multilingual** (MIT) sont ouverts mais PAS sur OpenRouter : les servir soi-même derrière un `/audio/speech` OpenAI-compatible et pointer `IDEM_TTS_URL` + `IDEM_TTS_MODEL` (+ `IDEM_TTS_VOICE_FR`).
- Code : pas de « DeepSeek Coder » ; l'alternative à Qwen3-Coder-Next est DeepSeek V4 (MIT).

## Les cinq usages

| Usage | Principal | Alternative à tester | Comment tester |
|---|---|---|---|
| Texte / raisonnement | Qwen3.5 (par rôle) | DeepSeek V4 | `AI_OVERRIDES='{"Market":{"modelName":"deepseek/deepseek-v4-flash"}}'` ou `--model writing=…` |
| Code | Qwen3-Coder-Next | DeepSeek V4 Flash | sélecteur d'AppGen (we-dev-next) |
| Voix off | Kokoro (OpenRouter), puis Qwen3-TTS / Chatterbox auto-hébergés | Chatterbox / Qwen3-TTS | `IDEM_TTS_URL`, ou `IDEM_OPENROUTER_TTS_MODEL` |
| Image | FLUX.2 klein 4B | Qwen Image 3 (fermé) | `--model image=…` avec `OPENROUTER_OPEN_ONLY=off` |
| Vidéo | Seedance 2.0 (fermé, dérogation) | Wan 2.7 (fermé) | `IDEM_OPENROUTER_VIDEO_MODEL=alibaba/wan-2.7` + `OPENROUTER_OPEN_ONLY=off` |

Une langue sans voix lève `voice_language_unsupported` : iVision crée alors la vidéo sans voix.

## Variables

`OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `IDEM_OPENROUTER_<ROLE>_MODEL` (`MECHANICAL`, `WRITING`, `REASONING`, `VISION`, `OCR`, `IMAGE`), `IDEM_OPENROUTER_IMAGE_FALLBACK_MODEL`, `IDEM_OPENROUTER_TTS_MODEL`, `IDEM_OPENROUTER_VIDEO_MODEL`, `IDEM_OPENROUTER_CODE_MODEL`, `IDEM_TTS_URL`, `IDEM_TTS_MODEL`, `IDEM_TTS_VOICE_<LANGUE>`, `IDEM_TTS_API_KEY`, `OPENROUTER_OPEN_ONLY`, `OPENROUTER_ALLOW_UNLISTED`, `OPENROUTER_DATA_COLLECTION` (défaut `deny` : seuls les hébergeurs qui ne conservent pas les requêtes sont éligibles), `IDEM_OPENROUTER_CONCURRENCY`.
