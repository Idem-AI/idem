# Modèles IA par fonctionnalité

> Généré par `npm run ai:matrix` — ne pas éditer à la main. Pour changer un modèle : `apps/api/api/config/ai-models.config.ts` (crans) ou `ai.config.ts` (fonctionnalités indépendantes du cran).

## 1. Échelles de modèles (un modèle par cran)

| Échelle | low | medium | high | ultra |
|---|---|---|---|---|
| design | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| code | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| catalog | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| video-design | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| video-code | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| video-sample | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| video-vision | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |
| video-teacher | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` | `deepseek/deepseek-v4.1-flash-1017` |

## 2. Rôles créatifs (vidéo, livrables graphiques) — modèle et plafond de sortie par cran

| Rôle | Échelle | low | medium | high | ultra | Mission |
|---|---|---|---|---|---|---|
| graphic.content | (modèle du profil) | `deepseek/deepseek-v4.1-flash-1017` · 3500 tok | `deepseek/deepseek-v4.1-flash-1017` · 3500 tok | `deepseek/deepseek-v4.1-flash-1017` · 3500 tok | `deepseek/deepseek-v4.1-flash-1017` · 3500 tok | rédiger le contenu structuré des livrables |
| graphic.director | design | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | concevoir la direction d’un document : la bible visuelle et l’idée de chaque page |
| graphic.explore | design | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | proposer quatre pistes d’idée distinctes pour un document |
| graphic.judge | video-vision | `deepseek/deepseek-v4.1-flash-1017` · 120 tok | `deepseek/deepseek-v4.1-flash-1017` · 120 tok | `deepseek/deepseek-v4.1-flash-1017` · 120 tok | `deepseek/deepseek-v4.1-flash-1017` · 120 tok | répondre par oui ou non à cinq questions sur la capture d’une page |
| graphic.template | catalog | `deepseek/deepseek-v4.1-flash-1017` · 700 tok | `deepseek/deepseek-v4.1-flash-1017` · 700 tok | `deepseek/deepseek-v4.1-flash-1017` · 700 tok | `deepseek/deepseek-v4.1-flash-1017` · 700 tok | choisir un gabarit du catalogue et mettre à jour sa configuration |
| video.template | catalog | `deepseek/deepseek-v4.1-flash-1017` · 2200 tok | `deepseek/deepseek-v4.1-flash-1017` · 2200 tok | `deepseek/deepseek-v4.1-flash-1017` · 2200 tok | `deepseek/deepseek-v4.1-flash-1017` · 2200 tok | choisir dans le catalogue vidéo le thème, le gabarit de chaque scène, ses animations et transitions |
| graphic.pattern-designer | (modèle du profil) | `deepseek/deepseek-v4.1-flash-1017` · 3000 tok | `deepseek/deepseek-v4.1-flash-1017` · 3000 tok | `deepseek/deepseek-v4.1-flash-1017` · 3000 tok | `deepseek/deepseek-v4.1-flash-1017` · 3000 tok | dessiner la tuile de motif propre à la marque (SVG) |
| graphic.asset-planner | (modèle du profil) | `deepseek/deepseek-v4.1-flash-1017` · 1000 tok | `deepseek/deepseek-v4.1-flash-1017` · 1000 tok | `deepseek/deepseek-v4.1-flash-1017` · 1000 tok | `deepseek/deepseek-v4.1-flash-1017` · 1000 tok | déterminer les ressources visuelles nécessaires |
| video.intent-classifier | (modèle du profil) | `deepseek/deepseek-v4.1-flash-1017` · 300 tok | `deepseek/deepseek-v4.1-flash-1017` · 300 tok | `deepseek/deepseek-v4.1-flash-1017` · 300 tok | `deepseek/deepseek-v4.1-flash-1017` · 300 tok | comprendre le besoin vidéo et les médias disponibles |
| video.concept | video-design | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | inventer le film : concept, bible visuelle, idée de chaque scène |
| video.concept-explore | design | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | `deepseek/deepseek-v4.1-flash-1017` · 800 tok | proposer quatre pistes de film distinctes avant le concept |
| video.planner | video-design | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | écrire le storyboard : durées, rôles, énergie, intentions, idées, textes, médias, voix |
| video.author | video-code | `deepseek/deepseek-v4.1-flash-1017` · 16000 tok | `deepseek/deepseek-v4.1-flash-1017` · 16000 tok | `deepseek/deepseek-v4.1-flash-1017` · 16000 tok | `deepseek/deepseek-v4.1-flash-1017` · 16000 tok | écrire (et réécrire) l’intention ou le programme d’une scène difficile — l’auteur de qualité |
| video.reviser | video-design | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | `deepseek/deepseek-v4.1-flash-1017` · 6000 tok | lire une retouche écrite par le client |
| video.sampler | video-sample | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | `deepseek/deepseek-v4.1-flash-1017` · 4000 tok | écrire beaucoup de variantes d’une scène (intention en sortie structurée) : l’échantillonnage |
| video.judge-vlm | video-vision | `deepseek/deepseek-v4.1-flash-1017` · 400 tok | `deepseek/deepseek-v4.1-flash-1017` · 400 tok | `deepseek/deepseek-v4.1-flash-1017` · 400 tok | `deepseek/deepseek-v4.1-flash-1017` · 400 tok | départager deux finalistes sur image (questions fermées, ordre inversé) — optionnel |
| video.teacher | video-teacher | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | `deepseek/deepseek-v4.1-flash-1017` · 12000 tok | hors ligne : fabriquer des scènes de référence pour la bibliothèque |

## 3. Fonctionnalités (`AI_CONFIG`) — indépendantes du cran

| Fonctionnalité | Modèle | Rôle | Température | Tokens max | Raisonnement |
|---|---|---|---|---|---|
| default | `deepseek/deepseek-v4.1-flash-1017` | `writing` | — | `16000` | oui/auto |
| coverBrief | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.65` | `600` | non |
| creative.agents | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.85` | `400` | non |
| creative.critic | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.3` | `400` | non |
| creative.coder | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `6000` | non |
| onboarding.default | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.5` | `2048` | non |
| onboarding.parseAnswer | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.1` | `256` | non |
| businessPlan | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `28000` | oui/auto |
| businessPlan › Company Summary | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Opportunity | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Target Audience | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Products & Services | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Marketing & Sales | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `44000` | oui/auto |
| businessPlan › Financial Plan | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Goal Planning | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Appendix | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.5` | `44000` | oui/auto |
| businessPlan › Executive Summary | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › One-Page Summary | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.5` | `24000` | oui/auto |
| businessPlan › Mission & Vision | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.6` | `28000` | oui/auto |
| businessPlan › Promoter Profile | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Management & Team | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Legal & Regulatory Framework | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Problem Statement | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Market Analysis | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Competitive Analysis | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Solution | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `36000` | oui/auto |
| businessPlan › Unique Value Proposition | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.6` | `24000` | oui/auto |
| businessPlan › Unfair Advantage | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.55` | `24000` | oui/auto |
| businessPlan › Business Model | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Strategy & Key Milestones | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Go-to-Market Strategy | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Traction & Proof Points | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Partnerships & Ecosystem | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Operational Plan | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Resources & Assets | `deepseek/deepseek-v4.1-flash-1017` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Key Metrics & KPIs | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Risk Analysis & Mitigation | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Funding Request & Use of Funds | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Guarantees & Collateral | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Exit Strategy & Investor Returns | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Theory of Change | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Social & Economic Impact | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Monitoring & Evaluation | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Sustainability Plan | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `28000` | oui/auto |
| pitchDeck | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `24000` | oui/auto |
| pitchDeck › Problem | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.62` | `22000` | oui/auto |
| pitchDeck › Solution | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.62` | `24000` | oui/auto |
| pitchDeck › Market | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.35` | `28000` | oui/auto |
| pitchDeck › Product | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `26000` | oui/auto |
| pitchDeck › Business Model | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `26000` | oui/auto |
| pitchDeck › Traction | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Competition | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `28000` | oui/auto |
| pitchDeck › Team | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Financials | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `32000` | oui/auto |
| pitchDeck › Ask | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Company Overview | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Funding Request | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Repayment Capacity | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `28000` | oui/auto |
| pitchDeck › Guarantees | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Customer Benefits | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Case Studies | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Pricing | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Next Steps | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `18000` | oui/auto |
| pitchDeck › Partnership Model | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `24000` | oui/auto |
| pitchDeck › Partner Benefits | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Impact | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Milestones | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Use of Funds | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.25` | `22000` | oui/auto |
| advisor | `deepseek/deepseek-v4.1-flash-1017` | `writing` | — | `6000` | oui/auto |
| legalDocs | `deepseek/deepseek-v4.1-flash-1017` | `writing` | — | — | oui/auto |
| deployment.terraform | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.3` | `4000` | oui/auto |
| deployment.chat | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `1024` | oui/auto |
| finance.autofill | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.35` | `48000` | oui/auto |
| finance.import | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.1` | `32000` | oui/auto |
| finance.intent | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.2` | `1024` | non |
| finance.pdfInterpretation | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `12000` | oui/auto |
| simulation.default | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.4` | `8192` | oui/auto |
| simulation.understanding | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.2` | `8192` | oui/auto |
| simulation.factors | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.5` | `32768` | oui/auto |
| simulation.scenarios | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `8192` | oui/auto |
| simulation.analysis | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.3` | `8192` | oui/auto |
| simulation.recommendations | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.4` | `8192` | oui/auto |
| simulation.redTeam | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `32768` | oui/auto |
| simulation.customers | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.5` | `8192` | oui/auto |
| simulation.investors | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `8192` | oui/auto |
| simulation.blackSwan | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.8` | `12288` | oui/auto |
| simulation.universes | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `8192` | oui/auto |
| simulation.experiments | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.5` | `8192` | oui/auto |
| communication.default | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | — | — | oui/auto |
| communication.context | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.2` | `2500` | non |
| communication.trends | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.5` | `2000` | non |
| communication.strategy | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.7` | `16000` | oui/auto |
| communication.calendar | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.8` | `20000` | oui/auto |
| communication.imageBrief | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.7` | `1200` | non |
| communication.flyer | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.8` | `48000` | oui/auto |
| communication.flyerEdit | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `16000` | oui/auto |
| communication.momentSuggestions | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `5000` | oui/auto |
| communication.occasions | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.3` | `4000` | non |
| communication.planBrief | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `2500` | non |
| communication.planContent | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.8` | `5000` | non |
| communication.planVideo | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.7` | `3500` | non |
| communication.planTrends | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.3` | `2500` | non |
| communication.video | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.7` | `900` | non |
| communication.videoAgents | `deepseek/deepseek-v4.1-flash-1017` | `mechanical` | `0.85` | `300` | non |
| communication.videoWriting | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.8` | `1600` | non |
| communication.videoReasoning | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.85` | `4000` | non |
| communication.studio | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `6000` | oui/auto |
| communication.moment | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.75` | `8000` | oui/auto |
| branding.brandIdentity | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `28000` | oui/auto |
| branding.brandIdentity › Logo Principal | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `36000` | oui/auto |
| branding.brandIdentity › Logomark | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Clair | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Sombre | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Monochrome | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Bonnes Pratiques | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `36000` | oui/auto |
| branding.brandIdentity › Usage Couleurs & Typographie | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.5` | `30000` | oui/auto |
| branding.brandIdentity › Color Palette | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Typography | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.62` | `26000` | oui/auto |
| branding.brandIdentity › Typeface Hierarchy | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `20000` | oui/auto |
| branding.brandIdentity › Graphic Patterns | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.6` | `20000` | oui/auto |
| branding.logo | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.45` | `48000` | oui/auto |
| branding.colors | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `6000` | non |
| branding.typography | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.6` | `6000` | non |
| branding.artDirection | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.65` | `24000` | oui/auto |
| branding.logoAnalysis | `deepseek/deepseek-v4.1-flash-1017` | `writing` | `0.2` | `2000` | oui/auto |
| branding.businessCard | `deepseek/deepseek-v4.1-flash-1017` | `reasoning` | `0.55` | `40000` | oui/auto |
