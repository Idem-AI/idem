/** Les textes envoyés sur WhatsApp. Courts : on lit sur un téléphone, parfois en 2G. */
type Lang = 'fr' | 'en';
type Params = Record<string, string | number>;

const TEXTS = {
  notEntitled: { fr: 'Publier depuis WhatsApp est réservé aux comptes payants (forfait IDEM Croissance ou Entreprise). Passez à un forfait depuis IDEM pour l’activer.', en: 'Publishing from WhatsApp is for paid accounts (IDEM Growth or Business plan). Upgrade in IDEM to enable it.' },
  unknownNumber: { fr: 'Ce numéro n’est lié à aucun compte IDEM. Dans IDEM, ouvrez Communication → WhatsApp pour le lier.', en: 'This number is not linked to any IDEM account. In IDEM, open Communication → WhatsApp to link it.' },
  textOnly: { fr: 'Je ne lis que le texte pour l’instant. Écrivez-moi votre demande.', en: 'I only read text for now. Write your request.' },
  tooFast: { fr: 'Doucement 🙂 Réessayez dans une minute.', en: 'Slow down 🙂 Try again in a minute.' },
  help: {
    fr: 'Voici ce que je sais faire :\n• Valider une publication : touchez « Valider » ou écrivez « ok ».\n• La modifier : touchez « Modifier » puis dites quoi changer.\n• Créer un visuel : « fais-moi un visuel pour… ».\n• Créer une vidéo : « fais-moi une vidéo pour… ».\n• « stop » : plus de propositions automatiques.\n• « délier » : retirer ce numéro d’IDEM.',
    en: 'Here is what I can do:\n• Approve a post: tap "Approve" or write "ok".\n• Edit it: tap "Edit" then say what to change.\n• Make a visual: "make me a visual for…".\n• Make a video: "make me a video for…".\n• "stop": no more automatic proposals.\n• "unlink": remove this number from IDEM.',
  },
  stopped: { fr: 'C’est noté : plus de propositions automatiques. Vous pouvez toujours me demander un visuel ici. Réactivez-les depuis IDEM.', en: 'Noted: no more automatic proposals. You can still ask me for a visual here. Turn them back on in IDEM.' },
  unlinked: { fr: 'Votre numéro est retiré d’IDEM. Plus rien ne sera envoyé ni publié depuis WhatsApp.', en: 'Your number is removed from IDEM. Nothing will be sent or published from WhatsApp anymore.' },
  proposal: { fr: 'Voici votre publication{{when}} pour {{networks}}. Qu’en pensez-vous ?', en: 'Here is your post{{when}} for {{networks}}. What do you think?' },
  proposalManual: { fr: ' À publier à la main sur : {{manual}}.', en: ' To post manually on: {{manual}}.' },
  btnApprove: { fr: 'Valider', en: 'Approve' },
  btnRevise: { fr: 'Modifier', en: 'Edit' },
  btnCancel: { fr: 'Annuler', en: 'Cancel' },
  askRevision: { fr: 'D’accord. Dites-moi ce que vous voulez changer (la légende, le visuel, un mot…).', en: 'Sure. Tell me what you want to change (caption, visual, a word…).' },
  revising: { fr: '✏️ Je modifie…', en: '✏️ Editing…' },
  revisionLimit: { fr: 'On a déjà fait {{n}} modifications. Validez cette version ou annulez, puis refaites une demande.', en: 'We already made {{n}} edits. Approve this version or cancel, then make a new request.' },
  preparing: { fr: '🎨 Je prépare ça, je vous l’envoie dans quelques minutes.', en: '🎨 Working on it, I will send it in a few minutes.' },
  videoPreparing: { fr: '🎬 Je prépare votre vidéo, cela peut prendre quelques minutes.', en: '🎬 Preparing your video, this can take a few minutes.' },
  published: { fr: '✅ Publié sur {{networks}}.', en: '✅ Published on {{networks}}.' },
  publishedLink: { fr: '• {{network}} : {{url}}', en: '• {{network}}: {{url}}' },
  manualStep: { fr: '📌 {{network}} : je ne publie pas encore directement ici. Voici la légende et le visuel à publier vous-même.', en: '📌 {{network}}: I cannot post there directly yet. Here is the caption and visual to post yourself.' },
  notConnected: { fr: '⚠️ {{network}} n’est pas connecté à IDEM. Connectez-le dans Communication → Réseaux, puis redemandez-moi.', en: '⚠️ {{network}} is not connected to IDEM. Connect it in Communication → Networks, then ask me again.' },
  failedNetwork: { fr: '⚠️ La publication sur {{network}} a échoué. Rien n’a été publié là-bas ; vous pouvez réessayer plus tard.', en: '⚠️ Publishing on {{network}} failed. Nothing was posted there; you can try again later.' },
  cancelled: { fr: 'Annulé : rien n’a été publié.', en: 'Cancelled: nothing was published.' },
  expired: { fr: '⌛ La publication du {{day}} n’a pas été validée à temps : rien n’a été publié.', en: '⌛ The post of {{day}} was not approved in time: nothing was published.' },
  stale: { fr: 'Cette proposition a changé ou n’est plus ouverte. Voici la dernière version.', en: 'This proposal changed or is no longer open. Here is the latest version.' },
  nothingOpen: { fr: 'Aucune publication n’attend votre avis. Demandez-moi un visuel ou une vidéo quand vous voulez.', en: 'No post is waiting for you. Ask me for a visual or a video anytime.' },
  several: { fr: 'Plusieurs publications attendent votre avis. Touchez le bouton du message concerné pour éviter toute erreur.', en: 'Several posts are waiting. Tap the button on the right message to avoid any mix-up.' },
  adhocLimit: { fr: 'Vous avez atteint la limite de {{n}} créations pour aujourd’hui. Revenez demain.', en: 'You reached the limit of {{n}} creations for today. Come back tomorrow.' },
  quota: { fr: 'Vous avez atteint votre limite d’usage pour le moment. Elle se renouvelle automatiquement.', en: 'You reached your usage limit for now. It renews automatically.' },
  noNetwork: { fr: 'Aucun réseau social n’est connecté à ce projet. Connectez-en un dans IDEM (Communication → Réseaux) pour que je puisse publier.', en: 'No social network is connected to this project. Connect one in IDEM (Communication → Networks) so I can publish.' },
  generationFailed: { fr: 'Je n’ai pas pu préparer cette publication. Rien n’a été publié et rien ne vous est débité. Réessayez dans un moment.', en: 'I could not prepare this post. Nothing was published or charged. Try again in a moment.' },
  unclear: { fr: 'Je n’ai pas bien compris. Écrivez « aide » pour voir ce que je sais faire.', en: 'I did not quite get that. Write "help" to see what I can do.' },
  noProject: { fr: 'Choisissez d’abord un projet par défaut dans IDEM (Communication → WhatsApp).', en: 'First choose a default project in IDEM (Communication → WhatsApp).' },
  planEnded: { fr: 'Votre forfait a pris fin : je ne peux plus publier ni envoyer de propositions. Renouvelez-le depuis IDEM.', en: 'Your plan has ended: I can no longer post or send proposals. Renew it in IDEM.' },
  templateProposal: { fr: 'Votre publication du jour est prête', en: 'Your post of the day is ready' },
} as const;

export type MessageKey = keyof typeof TEXTS;

export function say(lang: Lang, key: MessageKey, params: Params = {}): string {
  const entry = TEXTS[key] as Record<Lang, string>;
  return (entry[lang] ?? entry.fr).replace(/\{\{(\w+)\}\}/g, (_m, name: string) => String(params[name] ?? ''));
}

const NETWORK_LABELS: Record<string, string> = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', youtube: 'YouTube', blog: 'Blog', email: 'E-mail', other: '—' };
export const networkLabel = (network: string): string => NETWORK_LABELS[network] ?? network;
