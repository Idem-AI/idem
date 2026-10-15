# Modèles IA par fonctionnalité

> Généré par `npm run ai:matrix` — ne pas éditer à la main. Pour changer un modèle : `apps/api/api/config/ai-models.config.ts` (crans) ou `ai.config.ts` (fonctionnalités indépendantes du cran).

## 1. Échelles de modèles (un modèle par cran)

| Échelle | low | medium | high | ultra |
|---|---|---|---|---|
| design | `qwen/qwen3.5-9b` | `qwen/qwen3.5-27b` | `qwen/qwen3.5-397b-a17b` | `deepseek/deepseek-v4-pro` |
| code | `qwen/qwen3-coder-30b-a3b-instruct` | `qwen/qwen3-coder-next` | `qwen/qwen3-coder` | `deepseek/deepseek-v4-pro` |

## 2. Rôles créatifs (vidéo, livrables graphiques) — modèle et plafond de sortie par cran

| Rôle | Échelle | low | medium | high | ultra | Mission |
|---|---|---|---|---|---|---|
| graphic.content | (modèle du profil) | `google/gemini-3.8-flash` · 3500 tok | `google/gemini-3.8-flash` · 3500 tok | `google/gemini-3.8-flash` · 3500 tok | `google/gemini-3.8-flash` · 3500 tok | rédiger le contenu structuré des livrables |
| graphic.director | design | `qwen/qwen3.5-9b` · 2500 tok | `qwen/qwen3.5-27b` · 2500 tok | `qwen/qwen3.5-397b-a17b` · 2500 tok | `deepseek/deepseek-v4-pro` · 2500 tok | concevoir la direction d’un document : la bible visuelle et l’idée de chaque page |
| graphic.author | code | `qwen/qwen3-coder-30b-a3b-instruct` · 12000 tok | `qwen/qwen3-coder-next` · 12000 tok | `qwen/qwen3-coder` · 12000 tok | `deepseek/deepseek-v4-pro` · 12000 tok | écrire (et corriger) le HTML Tailwind de chaque page |
| graphic.pattern-designer | (modèle du profil) | `google/gemini-3.8-flash` · 3000 tok | `google/gemini-3.8-flash` · 3000 tok | `google/gemini-3.8-flash` · 3000 tok | `google/gemini-3.8-flash` · 3000 tok | dessiner la tuile de motif propre à la marque (SVG) |
| graphic.asset-planner | (modèle du profil) | `google/gemini-3.8-flash` · 400 tok | `google/gemini-3.8-flash` · 400 tok | `google/gemini-3.8-flash` · 800 tok | `google/gemini-3.8-flash` · 1000 tok | déterminer les ressources visuelles nécessaires |
| video.intent-classifier | (modèle du profil) | `google/gemini-3.8-flash` · 400 tok | `google/gemini-3.8-flash` · 300 tok | `google/gemini-3.8-flash` · 300 tok | `google/gemini-3.8-flash` · 300 tok | comprendre le besoin vidéo et les médias disponibles |
| video.concept | design | `qwen/qwen3.5-9b` · 2500 tok | `qwen/qwen3.5-27b` · 2500 tok | `qwen/qwen3.5-397b-a17b` · 2500 tok | `deepseek/deepseek-v4-pro` · 2500 tok | inventer le film : concept, bible visuelle, idée de chaque scène |
| video.planner | design | `qwen/qwen3.5-9b` · 9000 tok | `qwen/qwen3.5-27b` · 9000 tok | `qwen/qwen3.5-397b-a17b` · 9000 tok | `deepseek/deepseek-v4-pro` · 9000 tok | écrire le storyboard : durées, intentions, idées, textes, médias, voix |
| video.author | code | `qwen/qwen3-coder-30b-a3b-instruct` · 8000 tok | `qwen/qwen3-coder-next` · 8000 tok | `qwen/qwen3-coder` · 8000 tok | `deepseek/deepseek-v4-pro` · 8000 tok | écrire (et corriger) le code Motion Canvas de chaque scène |
| video.reviser | design | `qwen/qwen3.5-9b` · 800 tok | `qwen/qwen3.5-27b` · 800 tok | `qwen/qwen3.5-397b-a17b` · 800 tok | `deepseek/deepseek-v4-pro` · 800 tok | lire une retouche écrite par le client |

## 3. Fonctionnalités (`AI_CONFIG`) — indépendantes du cran

| Fonctionnalité | Modèle | Rôle | Température | Tokens max | Raisonnement |
|---|---|---|---|---|---|
| default | `qwen/qwen3.5-122b-a10b` | `writing` | — | `16000` | oui/auto |
| coverBrief | `qwen/qwen3.5-9b` | `mechanical` | `0.65` | `8000` | oui/auto |
| creative.agents | `google/gemini-3.8-flash` | `mechanical` | `0.85` | `400` | non |
| creative.critic | `google/gemini-3.8-flash` | `mechanical` | `0.3` | `400` | non |
| creative.coder | `google/gemini-3.8-flash` | `writing` | `0.7` | `6000` | non |
| onboarding.default | `qwen/qwen3.5-9b` | `mechanical` | `0.5` | `2048` | non |
| onboarding.parseAnswer | `qwen/qwen3.5-9b` | `mechanical` | `0.1` | `256` | non |
| businessPlan | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `28000` | oui/auto |
| businessPlan › Company Summary | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Opportunity | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Target Audience | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Products & Services | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `44000` | oui/auto |
| businessPlan › Marketing & Sales | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `44000` | oui/auto |
| businessPlan › Financial Plan | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Goal Planning | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Appendix | `google/gemini-3.8-flash` | `M` | `0.5` | `44000` | oui/auto |
| businessPlan › Executive Summary | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › One-Page Summary | `google/gemini-3.8-flash` | `M` | `0.5` | `24000` | oui/auto |
| businessPlan › Mission & Vision | `google/gemini-3.8-flash` | `M` | `0.6` | `28000` | oui/auto |
| businessPlan › Promoter Profile | `google/gemini-3.8-flash` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Management & Team | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Legal & Regulatory Framework | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Problem Statement | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Market Analysis | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Competitive Analysis | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Solution | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `36000` | oui/auto |
| businessPlan › Unique Value Proposition | `google/gemini-3.8-flash` | `M` | `0.6` | `24000` | oui/auto |
| businessPlan › Unfair Advantage | `google/gemini-3.8-flash` | `M` | `0.55` | `24000` | oui/auto |
| businessPlan › Business Model | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `44000` | oui/auto |
| businessPlan › Strategy & Key Milestones | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Go-to-Market Strategy | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `36000` | oui/auto |
| businessPlan › Traction & Proof Points | `google/gemini-3.8-flash` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Partnerships & Ecosystem | `google/gemini-3.8-flash` | `M` | `0.5` | `28000` | oui/auto |
| businessPlan › Operational Plan | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `44000` | oui/auto |
| businessPlan › Resources & Assets | `google/gemini-3.8-flash` | `M` | `0.45` | `28000` | oui/auto |
| businessPlan › Key Metrics & KPIs | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Risk Analysis & Mitigation | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Funding Request & Use of Funds | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `36000` | oui/auto |
| businessPlan › Guarantees & Collateral | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Exit Strategy & Investor Returns | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Theory of Change | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Social & Economic Impact | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `36000` | oui/auto |
| businessPlan › Monitoring & Evaluation | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `28000` | oui/auto |
| businessPlan › Sustainability Plan | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `28000` | oui/auto |
| pitchDeck | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `24000` | oui/auto |
| pitchDeck › Problem | `google/gemini-3.8-flash` | `reasoning` | `0.62` | `22000` | oui/auto |
| pitchDeck › Solution | `google/gemini-3.8-flash` | `reasoning` | `0.62` | `24000` | oui/auto |
| pitchDeck › Market | `google/gemini-3.8-flash` | `reasoning` | `0.35` | `28000` | oui/auto |
| pitchDeck › Product | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `26000` | oui/auto |
| pitchDeck › Business Model | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `26000` | oui/auto |
| pitchDeck › Traction | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Competition | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `28000` | oui/auto |
| pitchDeck › Team | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Financials | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `32000` | oui/auto |
| pitchDeck › Ask | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `20000` | oui/auto |
| pitchDeck › Company Overview | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Funding Request | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Repayment Capacity | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `28000` | oui/auto |
| pitchDeck › Guarantees | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Customer Benefits | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Case Studies | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Pricing | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `24000` | oui/auto |
| pitchDeck › Next Steps | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `18000` | oui/auto |
| pitchDeck › Partnership Model | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `24000` | oui/auto |
| pitchDeck › Partner Benefits | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Impact | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `22000` | oui/auto |
| pitchDeck › Milestones | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `20000` | oui/auto |
| pitchDeck › Use of Funds | `google/gemini-3.8-flash` | `reasoning` | `0.25` | `22000` | oui/auto |
| advisor | `qwen/qwen3.5-122b-a10b` | `writing` | — | — | oui/auto |
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
| communication.imageBrief | `google/gemini-3.8-flash` | `mechanical` | `0.7` | `1200` | non |
| communication.flyer | `google/gemini-3.8-flash` | `reasoning` | `0.8` | `48000` | oui/auto |
| communication.flyerEdit | `google/gemini-3.8-flash` | `writing` | `0.6` | `16000` | oui/auto |
| communication.momentSuggestions | `qwen/qwen3.5-122b-a10b` | `writing` | `0.7` | `5000` | oui/auto |
| communication.occasions | `qwen/qwen3.5-9b` | `mechanical` | `0.3` | `4000` | non |
| communication.planBrief | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.7` | `8000` | oui/auto |
| communication.planContent | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.8` | `20000` | oui/auto |
| communication.video | `google/gemini-3.8-flash` | `mechanical` | `0.7` | `900` | non |
| communication.videoAgents | `google/gemini-3.8-flash` | `mechanical` | `0.85` | `300` | non |
| communication.videoWriting | `google/gemini-3.8-flash` | `writing` | `0.8` | `1600` | non |
| communication.videoReasoning | `google/gemini-3.8-flash` | `reasoning` | `0.85` | `4000` | non |
| communication.studio | `qwen/qwen3.5-122b-a10b` | `writing` | `0.6` | `6000` | oui/auto |
| communication.moment | `qwen/qwen3.5-397b-a17b` | `reasoning` | `0.75` | `8000` | oui/auto |
| branding.brandIdentity | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `28000` | oui/auto |
| branding.brandIdentity › Logo Principal | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `36000` | oui/auto |
| branding.brandIdentity › Logomark | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Clair | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Fond Sombre | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Variation Monochrome | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `30000` | oui/auto |
| branding.brandIdentity › Logo Bonnes Pratiques | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `36000` | oui/auto |
| branding.brandIdentity › Usage Couleurs & Typographie | `google/gemini-3.8-flash` | `reasoning` | `0.5` | `30000` | oui/auto |
| branding.brandIdentity › Color Palette | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `26000` | oui/auto |
| branding.brandIdentity › Typography | `google/gemini-3.8-flash` | `reasoning` | `0.62` | `26000` | oui/auto |
| branding.brandIdentity › Typeface Hierarchy | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `20000` | oui/auto |
| branding.brandIdentity › Graphic Patterns | `google/gemini-3.8-flash` | `reasoning` | `0.6` | `20000` | oui/auto |
| branding.logo | `google/gemini-3.8-flash` | `reasoning` | `0.45` | `48000` | oui/auto |
| branding.colors | `google/gemini-3.8-flash` | `writing` | `0.6` | `6000` | non |
| branding.typography | `google/gemini-3.8-flash` | `writing` | `0.6` | `6000` | non |
| branding.artDirection | `google/gemini-3.8-flash` | `reasoning` | `0.65` | `24000` | oui/auto |
| branding.logoAnalysis | `qwen/qwen3.5-122b-a10b` | `writing` | `0.2` | `2000` | oui/auto |
| branding.businessCard | `google/gemini-3.8-flash` | `reasoning` | `0.55` | `40000` | oui/auto |
