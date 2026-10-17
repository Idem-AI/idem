/**
 * Le contrat de l'API publique d'iDomain (OpenAPI 3.1), servi à `GET /v1/openapi.json`.
 * iDeploy et iCode s'appuient sur ces routes, jamais sur les modules internes d'iDomain.
 * Toute route de `v1.ts` ajoutée ou changée se reporte ici.
 */
const json = (schema: Record<string, unknown>) => ({ content: { 'application/json': { schema } } });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const ok = (schema: Record<string, unknown>, description = 'OK') => ({ description, ...json(schema) });
const errors = {
  401: { description: 'Session IDEM absente ou expirée.' },
  404: { description: 'Introuvable (ou pas à cet utilisateur).' },
  422: { description: 'Entrée invalide : `issues` détaille chaque champ.' },
};
const idParam = [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }];

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'iDomain API',
    version: '1.0.0',
    description:
      "Vente et gestion de noms de domaine d'IDEM. Authentification : le cookie httpOnly `session` posé par l'API IDEM sur `.idem.africa` (envoyer les requêtes avec les identifiants). Les prix sont en francs CFA (XAF), entiers. Le fournisseur (registrar) n'apparaît jamais dans les réponses, sauf `GET /domains/{id}/registrar` (information légale).",
  },
  servers: [{ url: 'https://idomain-api.idem.africa/v1' }, { url: 'http://localhost:3007/v1' }],
  components: {
    securitySchemes: { session: { type: 'apiKey', in: 'cookie', name: 'session' } },
    schemas: {
      Quote: {
        type: 'object',
        properties: {
          domain: { type: 'string', example: 'ma-boutique.africa' },
          tld: { type: 'string' },
          operation: { enum: ['register', 'renew', 'transfer'] },
          years: { type: 'integer' },
          state: { enum: ['available', 'taken', 'premium', 'not_sold', 'unavailable_now', 'unknown'] },
          priceXaf: { type: ['integer', 'null'] },
          renewalXaf: { type: ['integer', 'null'] },
          atCost: { type: 'boolean' },
          promotion: { type: ['object', 'null'], properties: { id: { type: 'integer' }, endsAt: { type: 'string', format: 'date-time' } } },
        },
      },
      PriceSession: { allOf: [ref('Quote'), { type: 'object', properties: { id: { type: 'string', format: 'uuid' }, expiresAt: { type: 'string', format: 'date-time' } } }] },
      Order: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          status: { enum: ['awaiting_contact', 'awaiting_payment', 'paid', 'processing', 'completed', 'on_hold', 'needs_review', 'failed', 'refunded', 'cancelled'] },
          statusReason: { type: ['string', 'null'] },
          totalXaf: { type: 'integer' },
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' }, domain: { type: 'string' }, years: { type: 'integer' }, priceXaf: { type: 'integer' }, renewalXaf: { type: ['integer', 'null'] }, status: { type: 'string' }, domainId: { type: ['string', 'null'] } } },
          },
        },
      },
      Domain: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          status: { type: 'string' },
          expiresAt: { type: ['string', 'null'], format: 'date-time' },
          daysLeft: { type: ['integer', 'null'] },
          renewalXaf: { type: ['integer', 'null'] },
          connection: { type: ['object', 'null'] },
        },
      },
      RecordSet: { type: 'object', required: ['name', 'type', 'values'], properties: { name: { type: 'string', example: 'www' }, type: { enum: ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'CAA', 'SRV'] }, ttl: { type: 'integer' }, values: { type: 'array', items: { type: 'string' } } } },
      Connection: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          host: { type: 'string' },
          hosts: { type: 'array', items: { type: 'string' } },
          appUuid: { type: 'string' },
          method: { enum: ['managed', 'manual'] },
          status: { enum: ['awaiting_domain', 'verifying_ownership', 'pending', 'configuring_dns', 'attaching', 'waiting_dns', 'activating_tls', 'active', 'failed', 'detached'] },
          error: { type: ['string', 'null'] },
          instructions: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' }, value: { type: 'string' }, zone: { type: 'string' }, purpose: { enum: ['ownership', 'address'] } } } },
        },
      },
    },
  },
  security: [{ session: [] }],
  paths: {
    '/catalog': { get: { summary: 'Prix publics par extension', security: [], responses: { 200: ok({ type: 'object' }) } } },
    '/domains/search': {
      get: {
        summary: 'Rechercher un nom et obtenir son prix public',
        security: [],
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string' } }, { name: 'years', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10 } }],
        responses: { 200: ok({ type: 'object', properties: { exact: ref('Quote'), extensions: { type: 'array', items: ref('Quote') }, suggestions: { type: 'array', items: ref('Quote') } } }) },
      },
    },
    '/contact': { get: { summary: 'Titulaire par défaut', responses: { 200: ok({ type: 'object' }), ...errors } }, put: { summary: 'Enregistrer le titulaire', responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/price-sessions': {
      post: {
        summary: 'Figer le prix d’un nom pour la durée de la commande',
        requestBody: json({ type: 'object', required: ['domain'], properties: { domain: { type: 'string' }, years: { type: 'integer' } } }),
        responses: { 201: ok(ref('PriceSession')), 409: { description: 'Nom indisponible (`domain_taken`, `domain_premium`, `domain_unavailable_now`…).' }, ...errors },
      },
    },
    '/orders': {
      post: {
        summary: 'Créer et payer une commande (portefeuille IDEM)',
        description: 'Idempotente par `idempotencyKey`. 402 : solde insuffisant (la commande reste `awaiting_payment`, payable par `/orders/{id}/pay`). 409 `contact_required` : titulaire à renseigner.',
        requestBody: json({ type: 'object', required: ['priceSessionIds', 'idempotencyKey'], properties: { priceSessionIds: { type: 'array', items: { type: 'string', format: 'uuid' } }, idempotencyKey: { type: 'string' }, domainSessionId: { type: 'string', format: 'uuid' }, connectAppUuid: { type: 'string' } } }),
        responses: { 201: ok(ref('Order')), 402: { description: 'Solde insuffisant : corps de refus d’IDEM (offres de recharge).' }, 409: { description: 'Conflit.' }, 410: { description: 'Prix garanti expiré.' }, ...errors },
      },
      get: { summary: 'Mes commandes', responses: { 200: ok({ type: 'object', properties: { orders: { type: 'array', items: ref('Order') } } }), ...errors } },
    },
    '/orders/{id}': { get: { summary: 'Suivre une commande', parameters: idParam, responses: { 200: ok(ref('Order')), ...errors } } },
    '/orders/{id}/pay': { post: { summary: 'Payer une commande en attente', parameters: idParam, responses: { 200: ok(ref('Order')), 402: { description: 'Solde insuffisant.' }, ...errors } } },
    '/orders/{id}/cancel': { post: { summary: 'Annuler (non payée, ou suspendue avec restitution)', parameters: idParam, responses: { 200: ok(ref('Order')), ...errors } } },
    '/domains': { get: { summary: 'Mes domaines', responses: { 200: ok({ type: 'object', properties: { domains: { type: 'array', items: ref('Domain') } } }), ...errors } } },
    '/domains/{id}': { get: { summary: 'Un domaine', parameters: idParam, responses: { 200: ok(ref('Domain')), ...errors } } },
    '/domains/{id}/status': { get: { summary: 'Statut du domaine et de sa connexion', parameters: idParam, responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/domains/{id}/registrar': { get: { summary: 'Registrar du domaine (information légale)', parameters: idParam, responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/domains/{id}/dns-records': {
      get: { summary: 'Lire la zone gérée par iDomain', parameters: idParam, responses: { 200: ok({ type: 'object', properties: { records: { type: 'array', items: ref('RecordSet') } } }), ...errors } },
      post: { summary: 'Écrire un jeu d’enregistrements (valeurs vides = supprimer)', parameters: idParam, requestBody: json(ref('RecordSet')), responses: { 200: ok({ type: 'object' }), ...errors } },
    },
    '/applications': { get: { summary: 'Mes applications iDeploy', responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/domain-sessions': {
      post: {
        summary: 'Ouvrir un parcours depuis iDeploy ou iCode pour une application',
        requestBody: json({ type: 'object', required: ['source', 'appUuid'], properties: { source: { enum: ['ideploy', 'icode'] }, appUuid: { type: 'string' }, environment: { type: 'string' }, returnUrl: { type: 'string', format: 'uri' } } }),
        responses: { 201: ok({ type: 'object', properties: { id: { type: 'string' }, url: { type: 'string', description: 'Page iDomain où envoyer l’utilisateur.' }, expiresAt: { type: 'string' } } }), ...errors },
      },
    },
    '/domain-sessions/{id}': { get: { summary: 'Un parcours', parameters: idParam, responses: { 200: ok({ type: 'object' }), ...errors } } },
    '/domain-connections': {
      post: { summary: 'Demander la connexion d’un domaine à une application', requestBody: json({ type: 'object', required: ['host', 'appUuid'], properties: { host: { type: 'string' }, appUuid: { type: 'string' }, includeWww: { type: 'boolean' }, domainSessionId: { type: 'string' } } }), responses: { 201: ok(ref('Connection')), 409: { description: 'Déjà relié ailleurs.' }, ...errors } },
      get: { summary: 'Mes connexions', parameters: [{ name: 'appUuid', in: 'query', schema: { type: 'string' } }], responses: { 200: ok({ type: 'object' }), ...errors } },
    },
    '/domain-connections/{id}': {
      get: { summary: 'Vérifier l’avancement', parameters: idParam, responses: { 200: ok(ref('Connection')), ...errors } },
      delete: { summary: 'Débrancher (zone restaurée)', parameters: idParam, responses: { 200: ok(ref('Connection')), ...errors } },
    },
    '/domain-connections/{id}/retry': { post: { summary: 'Relancer une connexion abandonnée', parameters: idParam, responses: { 200: ok(ref('Connection')), ...errors } } },
  },
  'x-webhooks': {
    description:
      'Événements envoyés aux produits (IDOMAIN_WEBHOOK_TARGETS) : `order.completed`, `order.failed`, `domain.registered`, `domain.active` (DNS bon ET HTTPS valide), `connection.failed`. En-têtes `X-IDomain-Event`, `X-IDomain-Delivery` (stable entre relivraisons), `X-IDomain-Signature: t=<s>,v1=<hex>` avec v1 = HMAC-SHA256(secret, `<t>.<corps>`).',
  },
};
