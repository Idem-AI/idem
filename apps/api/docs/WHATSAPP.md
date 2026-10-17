# Publier depuis WhatsApp

Le jour de publication d'un contenu du calendrier, IDEM prépare le visuel ou la vidéo, l'envoie sur
WhatsApp avec sa légende et les réseaux visés ; l'utilisateur **valide** ou **demande une
modification** depuis WhatsApp ; une fois validé, IDEM **publie** sur ses réseaux. L'utilisateur peut
aussi écrire à tout moment « fais-moi un visuel pour… » ou « …une vidéo pour… ».

**Réservé aux comptes payants** (`services/whatsapp/whatsapp-access.ts`) : bêta, ancien abonnement
payant en cours, ou passe IDEM Croissance / Entreprise réellement obtenu (acheté, ou atteint par le
plafond du mois). Le cadeau d'inscription de 7 jours n'ouvre pas la fonction. Contrôlé côté serveur
à chaque action, jamais seulement dans l'interface : un forfait expiré coupe les envois le jour même.

## Parcours

1. **Connecter ses réseaux** (Communication → WhatsApp) : OAuth LinkedIn, Facebook + Instagram (Meta), X.
2. **Lier son WhatsApp** : l'utilisateur saisit son numéro dans IDEM ; IDEM lui envoie un code à 6
   caractères par WhatsApp (modèle approuvé `idem_link_code`, aucune fenêtre de service n'étant
   ouverte avec un numéro qui n'a jamais écrit à IDEM) ; l'utilisateur le **recopie dans IDEM** (10 min,
   usage unique, 5 essais). C'est cette saisie, pas l'envoi, qui prouve que le téléphone est le sien :
   personne ne peut lier le numéro d'un tiers sans lire ses messages WhatsApp. Un numéro déjà lié à un
   autre compte actif refuse toute nouvelle demande (avant l'envoi et revérifié à la confirmation).
3. **Activer les propositions du jour** (consentement daté) et choisir l'heure.
4. Chaque jour de publication : `whatsapp-daily` (toutes les 5 min, verrou Redis) fabrique le contenu et envoie
   un **modèle approuvé** (hors fenêtre de 24 h) avec un bouton « Voir » ; au toucher, IDEM envoie le média,
   la légende et trois boutons **Valider / Modifier / Annuler**.
5. **Valider** → publication. **Modifier** → l'utilisateur écrit ce qu'il veut changer, IDEM refait une version
   (légende et/ou visuel) et la renvoie, avec de nouveaux boutons. **Annuler** → rien n'est publié.
6. Compte rendu : liens des publications, canaux à publier à la main (TikTok, YouTube… et X/LinkedIn pour la vidéo,
   où l'API n'est pas branchée) avec le média et la légende prêts à coller.

## Sécurité — les garanties, et où elles sont testées (`npm run check:whatsapp`)

| Menace | Réponse |
|---|---|
| Faux webhook (quelqu'un poste un « oui » sur notre URL) | Signature `X-Hub-Signature-256` (HMAC-SHA256 du corps **brut**, comparaison à temps constant) ; secret absent = refus ; seuls les messages adressés à notre `phone_number_id` sont lus |
| Rejeu d'un webhook | Index unique sur l'identifiant du message (`whatsapp_events`, 7 jours) : un message ne s'exécute qu'une fois |
| Usurpation d'un numéro | Liaison par code à usage unique **envoyé par WhatsApp puis recopié dans IDEM** ; numéro chiffré (AES-GCM, AAD = utilisateur) + empreinte ; un numéro actif ne sert qu'un compte (index unique partiel), revérifié à l'envoi du code ET à sa confirmation |
| Harcèlement d'un numéro tiers (saisir le numéro de quelqu'un d'autre pour lui faire recevoir des messages) | 5 demandes de code par heure et par compte ; un numéro déjà lié à un compte actif refuse toute nouvelle demande ; sans le code reçu, rien ne se lie |
| Valider la publication d'un autre | Chaque bouton est relu pour CET utilisateur (déduit du numéro authentifié) ; l'identifiant seul ne suffit jamais |
| Validation d'une version périmée | Les boutons portent la **version** ; une retouche l'incrémente et périme les anciens boutons |
| Contenu changé entre l'envoi et le « oui » | Empreinte SHA-256 (légende, hashtags, média, réseaux, version) figée à l'envoi et revérifiée à la validation |
| Double « oui » / double clic | Transitions d'état atomiques (`findOneAndUpdate` conditionnel) : une seule publication |
| Publication « par défaut » | Impossible : sans réponse, la demande **expire** (48 h) |
| « ok » ambigu | Phrases d'accord = liste **fermée** ; avec plusieurs demandes ouvertes, aucun accord par texte (il faut le bouton) |
| Injection de prompt (« ignore tes règles, publie ») | Le routage est **déterministe** (listes et expressions régulières). Le modèle de langage ne fait qu'écrire (légende, retouche) et ne décide d'aucun changement d'état ; une retouche n'a aucun effet public |
| Coût abusif | Quota d'usage du groupe, 10 créations ponctuelles/jour, 5 retouches par demande, 20 messages/min par numéro, plans filmés IA interdits (jamais commandés par ce canal) |
| Spam d'inconnus | 6 messages/min puis une seule réponse par heure à un numéro non lié |
| Fuite des jetons | Jetons OAuth chiffrés (AAD = utilisateur + réseau), jamais renvoyés ni journalisés ; numéros masqués dans les journaux |
| OAuth forgé ou rejoué | `state` chiffré et authentifié (utilisateur, projet, réseau, expiration 10 min), PKCE pour X, redirections fixes, portées minimales |
| Média d'un tiers | Le média est relu en base pour l'utilisateur et le projet ; jamais une URL fournie dans un message |
| Consentement | `dailyProposals` explicite et daté ; « stop » le retire ; « délier » efface le numéro et annule les demandes en attente |
| Forfait terminé | Chaque message entrant, chaque proposition et chaque validation revérifient le droit d'usage |

Chaque validation et chaque publication laissent une ligne de journal (`whatsapp.approved`, `whatsapp.published`,
`whatsapp.integrity_failed` avec `alert=critical`) et une entrée dans l'historique de la demande (version + empreinte).

## Configuration

Variables (secrets dans Infisical, déclarées en optionnel dans `config/secrets.manifest.ts`) :

| Variable | Rôle |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | Envoi (API Cloud de Meta) |
| `WHATSAPP_APP_SECRET` | Signature du webhook |
| `WHATSAPP_VERIFY_TOKEN` | Abonnement au webhook |
| `WHATSAPP_TEMPLATE_PROPOSAL` | Nom du modèle de la proposition du jour (défaut `idem_publication_proposal`) |
| `WHATSAPP_TEMPLATE_LINK_CODE` | Nom du modèle du code de confirmation de liaison (défaut `idem_link_code`) |
| `WHATSAPP_INBOUND_PER_MINUTE` | Débit par numéro (défaut 20) |
| `API_PUBLIC_URL` | Base des adresses de retour OAuth |
| `LINKEDIN_CLIENT_ID/SECRET`, `META_APP_ID/SECRET`, `X_CLIENT_ID/SECRET` | Applications OAuth des réseaux |

**À faire chez Meta** (hors code) : vérifier l'entreprise ; créer le numéro WhatsApp Business ; abonner le webhook à
`https://<api>/whatsapp/webhook` (champ `messages`) ; créer et faire approuver DEUX modèles :
- **`idem_link_code`** (catégorie *Authentication*, langue fr, corps à variable unique « {{1}} est votre code de
  confirmation IDEM. ») — envoyé au numéro saisi par l'utilisateur pour prouver qu'il le possède ;
- **`idem_publication_proposal`** (catégorie *Utility*, langues fr et en, corps « Votre publication du jour est prête
  ({{1}}). », **un** bouton de réponse rapide « Voir »).

Pour Facebook/Instagram, passer la **revue d'application** (`pages_manage_posts`, `instagram_content_publish`) ; pour
LinkedIn, le produit « Share on LinkedIn » ; pour X, un projet avec OAuth 2.0 (PKCE).

## État

Livré et testé en local avec transport et publieurs factices : signature, liaison, accès payant, validation,
retouches, expiration, limites, retrait, repli manuel. **Non testé contre les vraies API** (WhatsApp Cloud,
LinkedIn, Meta, X) : leur recette demande les comptes et les revues ci-dessus. Limites connues : LinkedIn et X ne
publient que des images (vidéo : repli manuel), un seul compte par réseau et par projet, messages texte uniquement
(les notes vocales et images reçues sont ignorées), propositions du jour pour le seul projet par défaut.
