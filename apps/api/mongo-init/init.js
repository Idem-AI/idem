db = db.getSiblingDB('idem');

db.createUser({
  user: 'idem_user',
  pwd: 'idem_password',
  roles: [
    {
      role: 'readWrite',
      db: 'idem',
    },
  ],
});

db.createCollection('users');
db.createCollection('projects');
db.createCollection('deployments');
db.createCollection('archetypes');
db.createCollection('contacts');

print('MongoDB initialized for IDEM');
