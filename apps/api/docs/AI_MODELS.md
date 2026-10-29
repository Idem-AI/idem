# Modèles IA par fonctionnalité

> Généré par `npm run ai:matrix` — ne pas éditer à la main. Pour changer un modèle : `apps/api/api/config/ai-models.config.ts` (crans) ou `ai.config.ts` (fonctionnalités indépendantes du cran).

## 1. Échelles de modèles (un modèle par cran)

| Échelle | low | medium | high | ultra |
|---|---|---|---|---|
| design | `qwen/qwen3.5-9b` | `qwen/qwen3.5-27b` | `qwen/qwen3.5-397b-a17b` | `deepseek/deepseek-v4-pro` |
| code | `qwen/qwen3-coder-30b-a3b-instruct` | `qwen/qwen3-coder-next` | `qwen/qwen3-coder` | `deepseek/deepseek-v4-pro` |
| video-design | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `z-ai/glm-5.3-flash` | `z-ai/glm-5.3-flash` |
| video-code | `qwen/qwen3.6-35b-a3b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` |
| video-sample | `qwen/qwen3.6-35b-a3b` | `qwen/qwen3.6-35b-a3b` | `qwen/qwen3.6-35b-a3b` | `qwen/qwen3.6-35b-a3b` |
| video-vision | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` |
| video-teacher | `qwen/qwen3.8-2.4t-a95b` | `qwen/qwen3.8-2.4t-a95b` | `qwen/qwen3.8-2.4t-a95b` | `qwen/qwen3.8-2.4t-a95b` |

## 2. Rôles créatifs (vidéo, livrables graphiques) — modèle et plafond de sortie par cran

| Rôle | Échelle | low | medium | high | ultra | Mission |
|---|---|---|---|---|---|---|
| graphic.content | (modèle du profil) | `qwen/qwen3.5-9b` · 3500 tok | `qwen/qwen3.5-9b` · 3500 tok | `qwen/qwen3.5-9b` · 3500 tok | `qwen/qwen3.5-9b` · 3500 tok | rédiger le contenu structuré des livrables |
| graphic.director | design | `qwen/qwen3.5-9b` · 2500 tok | `qwen/qwen3.5-27b` · 2500 tok | `qwen/qwen3.5-397b-a17b` · 2500 tok | `deepseek/deepseek-v4-pro` · 2500 tok | concevoir la direction d’un document : la bible visuelle et l’idée de chaque page |
| graphic.author | code | `qwen/qwen3-coder-30b-a3b-instruct` · 12000 tok | `qwen/qwen3-coder-next` · 12000 tok | `qwen/qwen3-coder` · 12000 tok | `deepseek/deepseek-v4-pro` · 12000 tok | écrire (et corriger) le HTML Tailwind de chaque page |
| graphic.pattern-designer | (modèle du profil) | `qwen/qwen3.5-122b-a10b` · 3000 tok | `qwen/qwen3.5-122b-a10b` · 3000 tok | `qwen/qwen3.5-122b-a10b` · 3000 tok | `qwen/qwen3.5-122b-a10b` · 3000 tok | dessiner la tuile de motif propre à la marque (SVG) |
| graphic.asset-planner | (modèle du profil) | `qwen/qwen3.5-9b` · 400 tok | `qwen/qwen3.5-9b` · 400 tok | `qwen/qwen3.5-9b` · 800 tok | `qwen/qwen3.5-9b` · 1000 tok | déterminer les ressources visuelles nécessaires |
| video.intent-classifier | (modèle du profil) | `qwen/qwen3.5-9b` · 400 tok | `qwen/qwen3.5-9b` · 300 tok | `qwen/qwen3.5-9b` · 300 tok | `qwen/qwen3.5-9b` · 300 tok | comprendre le besoin vidéo et les médias disponibles |
| video.concept | video-design | `qwen/qwen3.8-27b` · 8000 tok | `qwen/qwen3.8-27b` · 8000 tok | `z-ai/glm-5.3-flash` · 8000 tok | `z-ai/glm-5.3-flash` · 8000 tok | inventer le film : concept, bible visuelle, idée de chaque scène |
| video.planner | video-design | `qwen/qwen3.8-27b` · 16000 tok | `qwen/qwen3.8-27b` · 16000 tok | `z-ai/glm-5.3-flash` · 16000 tok | `z-ai/glm-5.3-flash` · 16000 tok | écrire le storyboard : durées, rôles, énergie, intentions, idées, textes, médias, voix |
| video.author | video-code | `qwen/qwen3.6-35b-a3b` · 16000 tok | `qwen/qwen3.8-27b` · 16000 tok | `qwen/qwen3.8-27b` · 16000 tok | `qwen/qwen3.8-27b` · 16000 tok | écrire (et réécrire) l’intention ou le programme d’une scène difficile — l’auteur de qualité |
| video.reviser | video-design | `qwen/qwen3.8-27b` · 6000 tok | `qwen/qwen3.8-27b` · 6000 tok | `z-ai/glm-5.3-flash` · 6000 tok | `z-ai/glm-5.3-flash` · 6000 tok | lire une retouche écrite par le client |
| video.sampler | video-sample | `qwen/qwen3.6-35b-a3b` · 4000 tok | `qwen/qwen3.6-35b-a3b` · 4000 tok | `qwen/qwen3.6-35b-a3b` · 4000 tok | `qwen/qwen3.6-35b-a3b` · 4000 tok | écrire beaucoup de variantes d’une scène (intention en sortie structurée) : l’échantillonnage |
| video.judge-vlm | video-vision | `qwen/qwen3.8-27b` · 400 tok | `qwen/qwen3.8-27b` · 400 tok | `qwen/qwen3.8-27b` · 400 tok | `qwen/qwen3.8-27b` · 400 tok | départager deux finalistes sur image (questions fermées, ordre inversé) — optionnel |
| video.teacher | video-teacher | `qwen/qwen3.8-2.4t-a95b` · 12000 tok | `qwen/qwen3.8-2.4t-a95b` · 12000 tok | `qwen/qwen3.8-2.4t-a95b` · 12000 tok | `qwen/qwen3.8-2.4t-a95b` · 12000 tok | hors ligne : fabriquer des scènes de référence pour la bibliothèque |

## 3. Fonctionnalités (`AI_CONFIG`) — indépendantes du cran

| Fonctionnalité | Modèle | Rôle | Température | Tokens max | Raisonnement |
|---|---|---|---|---|---|
| default | `qwen/qwen3.5-122b-a10b` | `writing` | — | `16000` | oui/auto |
| coverBrief | `qwen/qwen3.5-9b` | `mechanical` | `0.65` | `600` | non |
| creative.agents | `qwen/qwen3.5-9b` | `mechanical` | `0.85` | `400` | non |
| creative.critic | `qwen/qwen3.5-9b` | `mechanical` | `0.3` | `400` | non |
| creative.coder | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `6000` | non |
| onboarding.default | `qwen/qwen3.5-9b` | `mechanical` | `0.5` | `2048` | non |
| onboarding.parseAnswer | `qwen/qwen3.5-9b` | `mechanical` | `0.1` | `256` | non |
| businessPlan | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `28000` | oui/auto |
| businessPlan › Company Summary | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Opportunity | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Target Audience | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Products & Services | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Marketing & Sales | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `44000` | oui/auto |
| businessPlan › Financial Plan | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Goal Planning | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Appendix | `qwen/qwen3.5-397b-a17b` | `M` | `0.5` | `44000` | oui/auto |
| businessPlan › Executive Summary | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › One-Page Summary | `qwen/qwen3.5-397b-a17b` | `M` | `0.5` | `24000` | oui/auto |
| businessPlan › Mission & Vision | `qwen/qwen3.5-397b-a17b` | `M` | `0.6` | `28000` | oui/auto |
| businessPlan › Promoter Profile | `qwen/qwen3.5-397b-a17b` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Management & Team | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Legal & Regulatory Framework | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Problem Statement | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Market Analysis | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Competitive Analysis | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Solution | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `36000` | oui/auto |
| businessPlan › Unique Value Proposition | `qwen/qwen3.5-397b-a17b` | `M` | `0.6` | `24000` | oui/auto |
| businessPlan › Unfair Advantage | `qwen/qwen3.5-397b-a17b` | `M` | `0.55` | `24000` | oui/auto |
| businessPlan › Business Model | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Strategy & Key Milestones | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Go-to-Market Strategy | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Traction & Proof Points | `qwen/qwen3.5-397b-a17b` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Partnerships & Ecosystem | `qwen/qwen3.5-397b-a17b` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Operational Plan | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Resources & Assets | `qwen/qwen3.5-397b-a17b` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Key Metrics & KPIs | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Risk Analysis & Mitigation | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Funding Request & Use of Funds | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Guarantees & Collateral | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Exit Strategy & Investor Returns | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Theory of Change | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Social & Economic Impact | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Monitoring & Evaluation | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Sustainability Plan | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `28000` | oui/auto |
| pitchDeck | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `24000` | oui/auto |
| pitchDeck › Problem | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.62` | `22000` | oui/auto |
| pitchDeck › Solution | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.62` | `24000` | oui/auto |
| pitchDeck › Market | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.35` | `28000` | oui/auto |
| pitchDeck › Product | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `26000` | oui/auto |
| pitchDeck › Business Model | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `26000` | oui/auto |
| pitchDeck › Traction | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Competition | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `28000` | oui/auto |
| pitchDeck › Team | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Financials | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `32000` | oui/auto |
| pitchDeck › Ask | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Company Overview | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Funding Request | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Repayment Capacity | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `28000` | oui/auto |
| pitchDeck › Guarantees | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Customer Benefits | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Case Studies | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Pricing | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Next Steps | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `18000` | oui/auto |
| pitchDeck › Partnership Model | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `24000` | oui/auto |
| pitchDeck › Partner Benefits | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Impact | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Milestones | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Use of Funds | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.25` | `22000` | oui/auto |
| advisor | `qwen/qwen3.5-122b-a10b` | `writing` | — | `6000` | oui/auto |
| legalDocs | `qwen/qwen3.5-122b-a10b` | `writing` | — | — | oui/auto |
| deployment.terraform | `qwen/qwen3.5-122b-a10b` | `writing` | `0.3` | `4000` | oui/auto |
| deployment.chat | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `1024` | oui/auto |
| finance.autofill | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.35` | `48000` | oui/auto |
| finance.import | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.1` | `32000` | oui/auto |
| finance.intent | `qwen/qwen3.5-9b` | `mechanical` | `0.2` | `1024` | non |
| finance.pdfInterpretation | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `12000` | oui/auto |
| simulation.default | `qwen/qwen3.5-122b-a10b` | `writing` | `0.4` | `8192` | oui/auto |
| simulation.understanding | `qwen/qwen3.5-122b-a10b` | `writing` | `0.2` | `8192` | oui/auto |
| simulation.factors | `qwen/qwen3.5-122b-a10b` | `writing` | `0.5` | `32768` | oui/auto |
| simulation.scenarios | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `8192` | oui/auto |
| simulation.analysis | `qwen/qwen3.5-122b-a10b` | `writing` | `0.3` | `8192` | oui/auto |
| simulation.recommendations | `qwen/qwen3.5-122b-a10b` | `writing` | `0.4` | `8192` | oui/auto |
| simulation.redTeam | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `32768` | oui/auto |
| simulation.customers | `qwen/qwen3.5-122b-a10b` | `writing` | `0.5` | `8192` | oui/auto |
| simulation.investors | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `8192` | oui/auto |
| simulation.blackSwan | `qwen/qwen3.5-122b-a10b` | `writing` | `0.8` | `12288` | oui/auto |
| simulation.universes | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `8192` | oui/auto |
| simulation.experiments | `qwen/qwen3.5-122b-a10b` | `writing` | `0.5` | `8192` | oui/auto |
| communication.default | `qwen/qwen3.5-397b-a17b` | `reasoning` | — | — | oui/auto |
| communication.context | `qwen/qwen3.5-9b` | `mechanical` | `0.2` | `2500` | non |
| communication.trends | `qwen/qwen3.5-9b` | `mechanical` | `0.5` | `2000` | non |
| communication.strategy | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.7` | `16000` | oui/auto |
| communication.calendar | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.8` | `20000` | oui/auto |
| communication.imageBrief | `qwen/qwen3.5-9b` | `mechanical` | `0.7` | `1200` | non |
| communication.flyer | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.8` | `48000` | oui/auto |
| communication.flyerEdit | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `16000` | oui/auto |
| communication.momentSuggestions | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `5000` | oui/auto |
| communication.occasions | `qwen/qwen3.5-9b` | `mechanical` | `0.3` | `4000` | non |
| communication.planBrief | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.7` | `8000` | oui/auto |
| communication.planContent | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.8` | `20000` | oui/auto |
| communication.video | `qwen/qwen3.5-9b` | `mechanical` | `0.7` | `900` | non |
| communication.videoAgents | `qwen/qwen3.5-9b` | `mechanical` | `0.85` | `300` | non |
| communication.videoWriting | `qwen/qwen3.5-122b-a10b` | `writing` | `0.8` | `1600` | non |
| communication.videoReasoning | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.85` | `4000` | non |
| communication.studio | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `6000` | oui/auto |
| communication.moment | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.75` | `8000` | oui/auto |
| branding.brandIdentity | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `28000` | oui/auto |
| branding.brandIdentity › Logo Principal | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `36000` | oui/auto |
| branding.brandIdentity › Logomark | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Clair | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Sombre | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Monochrome | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Bonnes Pratiques | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `36000` | oui/auto |
| branding.brandIdentity › Usage Couleurs & Typographie | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.5` | `30000` | oui/auto |
| branding.brandIdentity › Color Palette | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Typography | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.62` | `26000` | oui/auto |
| branding.brandIdentity › Typeface Hierarchy | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `20000` | oui/auto |
| branding.brandIdentity › Graphic Patterns | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.6` | `20000` | oui/auto |
| branding.logo | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.45` | `48000` | oui/auto |
| branding.colors | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `6000` | non |
| branding.typography | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `6000` | non |
| branding.artDirection | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.65` | `24000` | oui/auto |
| branding.logoAnalysis | `qwen/qwen3.5-122b-a10b` | `writing` | `0.2` | `2000` | oui/auto |
| branding.businessCard | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.55` | `40000` | oui/auto |
