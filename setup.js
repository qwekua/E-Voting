const PocketBase = require('pocketbase');

async function setupPocketBase() {
  // Initialize PocketBase client
  const pb = new PocketBase('https://siga-2000.pockethost.io');

  // Authenticate as admin
  try {
    await pb.admins.authWithPassword('YOUR_ADMIN_EMAIL', 'YOUR_ADMIN_PASSWORD');
    console.log('Authenticated as admin');
  } catch (error) {
    console.error('Admin authentication failed:', error.message);
    return;
  }

  // Define collections schema
  const collections = [
    {
      name: 'app_config',
      type: 'base',
      schema: [
        { name: 'id', type: 'text', required: true, unique: true },
        { name: 'key', type: 'text', required: true, unique: true },
        { name: 'value', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'type', type: 'select', required: true, options: { values: ['string', 'number', 'boolean', 'json'] } },
        { name: 'isActive', type: 'bool', required: true, defaultValue: true },
      ],
      listRule: '@request.auth.id != "" || isActive = true',
      viewRule: '@request.auth.id != "" || isActive = true',
      createRule: '@request.auth.id != "" && @request.auth.admin = true',
      updateRule: '@request.auth.id != "" && @request.auth.admin = true',
      deleteRule: '@request.auth.id != "" && @request.auth.admin = true',
    },
    {
      name: 'categories',
      type: 'base',
      schema: [
        { name: 'id', type: 'text', required: true, unique: true },
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'displayOrder', type: 'number', required: true },
        { name: 'isActive', type: 'bool', required: true, defaultValue: true },
        { name: 'icon', type: 'text' },
      ],
      listRule: '@request.auth.id != "" || isActive = true',
      viewRule: '@request.auth.id != "" || isActive = true',
      createRule: '@request.auth.id != "" && @request.auth.admin = true',
      updateRule: '@request.auth.id != "" && @request.auth.admin = true',
      deleteRule: '@request.auth.id != "" && @request.auth.admin = true',
    },
    {
      name: 'nominees',
      type: 'base',
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'categoryId', type: 'relation', required: true, options: { collectionId: 'categories', cascadeDelete: false, maxSelect: 1 } },
        { name: 'bio', type: 'text' },
        { name: 'image', type: 'file', options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] } },
        { name: 'displayOrder', type: 'number', required: true, defaultValue: 0 },
        { name: 'isActive', type: 'bool', required: true, defaultValue: true },
        { name: 'totalVotes', type: 'number', required: true, defaultValue: 0 },
        { name: 'totalAmount', type: 'number', required: true, defaultValue: 0 },
      ],
      listRule: '@request.auth.id != "" || isActive = true',
      viewRule: '@request.auth.id != "" || isActive = true',
      createRule: '@request.auth.id != "" && @request.auth.admin = true',
      updateRule: '@request.auth.id != "" && @request.auth.admin = true',
      deleteRule: '@request.auth.id != "" && @request.auth.admin = true',
      indexes: [
        'CREATE INDEX idx_nominees_categoryId ON nominees (categoryId)',
        'CREATE INDEX idx_nominees_isActive ON nominees (isActive)',
        'CREATE INDEX idx_nominees_totalVotes ON nominees (totalVotes DESC)',
      ],
    },
    {
      name: 'users',
      type: 'base',
      schema: [
        { name: 'phone', type: 'text', required: true, unique: true },
        { name: 'name', type: 'text' },
        { name: 'email', type: 'text' },
        { name: 'isActive', type: 'bool', required: true, defaultValue: true },
        { name: 'totalSpent', type: 'number', required: true, defaultValue: 0 },
        { name: 'totalVotes', type: 'number', required: true, defaultValue: 0 },
        { name: 'firstLogin', type: 'date', required: true },
        { name: 'lastLogin', type: 'date' },
      ],
      listRule: '@request.auth.id = userId',
      viewRule: '@request.auth.id = userId || @request.auth.admin = true',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id = userId || @request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
      indexes: [
        'CREATE UNIQUE INDEX idx_users_phone ON users (phone)',
        'CREATE INDEX idx_users_isActive ON users (isActive)',
      ],
    },
    {
      name: 'votes',
      type: 'base',
      schema: [
        { name: 'userId', type: 'relation', required: true, options: { collectionId: 'users', cascadeDelete: false, maxSelect: 1 } },
        { name: 'nomineeId', type: 'relation', required: true, options: { collectionId: 'nominees', cascadeDelete: false, maxSelect: 1 } },
        { name: 'categoryId', type: 'relation', required: true, options: { collectionId: 'categories', cascadeDelete: false, maxSelect: 1 } },
        { name: 'votes', type: 'number', required: true },
        { name: 'amount', type: 'number', required: true },
        { name: 'transactionRef', type: 'text', required: true },
        { name: 'paymentStatus', type: 'select', required: true, options: { values: ['pending', 'completed', 'failed'] } },
        { name: 'paymentMethod', type: 'text' },
      ],
      listRule: '@request.auth.id = userId',
      viewRule: '@request.auth.id = userId || @request.auth.admin = true',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id = userId || @request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
      indexes: [
        'CREATE INDEX idx_votes_userId ON votes (userId)',
        'CREATE INDEX idx_votes_nomineeId ON votes (nomineeId)',
        'CREATE INDEX idx_votes_created ON votes (created DESC)',
        'CREATE INDEX idx_votes_paymentStatus ON votes (paymentStatus)',
      ],
    },
    {
      name: 'voting_sessions',
      type: 'base',
      schema: [
        { name: 'userId', type: 'relation', required: true, options: { collectionId: 'users', cascadeDelete: false, maxSelect: 1 } },
        { name: 'sessionToken', type: 'text', required: true, unique: true },
        { name: 'isActive', type: 'bool', required: true, defaultValue: true },
        { name: 'expiresAt', type: 'date', required: true },
        { name: 'ipAddress', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
      listRule: '@request.auth.id = userId',
      viewRule: '@request.auth.id = userId || @request.auth.admin = true',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id = userId || @request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
      indexes: [
        'CREATE INDEX idx_voting_sessions_userId ON voting_sessions (userId)',
        'CREATE UNIQUE INDEX idx_voting_sessions_sessionToken ON voting_sessions (sessionToken)',
        'CREATE INDEX idx_voting_sessions_isActive ON voting_sessions (isActive)',
        'CREATE INDEX idx_voting_sessions_expiresAt ON voting_sessions (expiresAt)',
      ],
    },
    {
      name: 'audit_logs',
      type: 'base',
      schema: [
        { name: 'userId', type: 'relation', options: { collectionId: 'users', cascadeDelete: false, maxSelect: 1 } },
        { name: 'action', type: 'text', required: true },
        { name: 'details', type: 'json' },
        { name: 'ipAddress', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
      listRule: '@request.auth.admin = true',
      viewRule: '@request.auth.admin = true',
      createRule: '@request.auth.admin = true',
      updateRule: '@request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
    },
  ];

  // Create or update collections
  for (const collection of collections) {
    try {
      const existingCollections = await pb.collections.getList(1, 100);
      const existingCollection = existingCollections.items.find(c => c.name === collection.name);

      if (existingCollection) {
        await pb.collections.update(existingCollection.id, {
          schema: collection.schema,
          listRule: collection.listRule,
          viewRule: collection.viewRule,
          createRule: collection.createRule,
          updateRule: collection.updateRule,
          deleteRule: collection.deleteRule,
          indexes: collection.indexes || [],
        });
        console.log(`Updated collection: ${collection.name}`);
      } else {
        await pb.collections.create({
          name: collection.name,
          type: collection.type,
          schema: collection.schema,
          listRule: collection.listRule,
          viewRule: collection.viewRule,
          createRule: collection.createRule,
          updateRule: collection.updateRule,
          deleteRule: collection.deleteRule,
          indexes: collection.indexes || [],
        });
        console.log(`Created collection: ${collection.name}`);
      }
    } catch (error) {
      console.error(`Error processing collection ${collection.name}:`, error.message);
    }
  }

  // Configure file storage for nominees.image
  try {
    const nomineesCollection = (await pb.collections.getList(1, 100)).items.find(c => c.name === 'nominees');
    if (nomineesCollection) {
      await pb.collections.update(nomineesCollection.id, {
        schema: nomineesCollection.schema.map(field => {
          if (field.name === 'image') {
            return {
              ...field,
              options: { maxSelect: 1, maxSize: 5242880, mimeTypes: ['image/jpeg', 'image/png', 'image/webp'] },
            };
          }
          return field;
        }),
      });
      console.log('Configured file storage for nominees.image');
    }
  } catch (error) {
    console.error('Error configuring file storage:', error.message);
  }

  // Populate sample data
  const sampleData = {
    app_config: [
      { id: 'app_title', key: 'app_title', value: 'ACK SRC Awards', type: 'string', isActive: true },
      { id: 'app_subtitle', key: 'app_subtitle', value: 'Vote for your favorite nominees', type: 'string', isActive: true },
      { id: 'voting_enabled', key: 'voting_enabled', value: 'true', type: 'boolean', isActive: true },
      { id: 'paystack_key', key: 'paystack_public_key', value: 'pk_test_...', type: 'string', isActive: true },
      { id: 'currency', key: 'currency', value: 'GHS', type: 'string', isActive: true },
      { id: 'currency_symbol', key: 'currency_symbol', value: '₵', type: 'string', isActive: true },
      { id: 'min_vote_amount', key: 'min_vote_amount', value: '1', type: 'number', isActive: true },
      { id: 'max_vote_amount', key: 'max_vote_amount', value: '100', type: 'number', isActive: true },
      { id: 'vote_rates', key: 'vote_conversion_rates', value: JSON.stringify([{ amount: 1, votes: 1 }, { amount: 5, votes: 5 }, { amount: 10, votes: 10 }, { amount: 20, votes: 20 }, { amount: 50, votes: 50 }]), type: 'json', isActive: true },
    ],
    categories: [
      { id: 'cat_famous', name: 'Most Famous', description: 'The most well-known student in the school', displayOrder: 1, isActive: true, icon: 'star' },
      { id: 'cat_dancer', name: 'Best Dancer', description: 'Student with the best dancing skills', displayOrder: 2, isActive: true, icon: 'music' },
      { id: 'cat_lady', name: 'Perfect Lady', description: 'The most elegant and well-mannered lady', displayOrder: 3, isActive: true, icon: 'crown' },
    ],
    nominees: [
      { name: 'Maccarthy Charles', categoryId: 'cat_famous', displayOrder: 1, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Samuel Boakye', categoryId: 'cat_famous', displayOrder: 2, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Victor Clarke Sosu', categoryId: 'cat_famous', displayOrder: 3, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'William Asare', categoryId: 'cat_dancer', displayOrder: 1, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Esther Mensah', categoryId: 'cat_dancer', displayOrder: 2, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Lordina Arthur', categoryId: 'cat_lady', displayOrder: 1, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Madinatu', categoryId: 'cat_lady', displayOrder: 2, isActive: true, totalVotes: 0, totalAmount: 0 },
      { name: 'Franka', categoryId: 'cat_lady', displayOrder: 3, isActive: true, totalVotes: 0, totalAmount: 0 },
    ],
  };

  // Populate sample data
  for (const [collectionName, records] of Object.entries(sampleData)) {
    try {
      for (const record of records) {
        try {
          await pb.collection(collectionName).create(record);
          console.log(`Created record in ${collectionName}: ${record.name || record.key}`);
        } catch (error) {
          if (error.status === 400 && error.message.includes('unique')) {
            console.log(`Record already exists in ${collectionName}: ${record.name || record.key}`);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error(`Error populating ${collectionName}:`, error.message);
    }
  }

  console.log('PocketBase configuration completed!');
}

setupPocketBase().catch(error => console.error('Setup failed:', error));