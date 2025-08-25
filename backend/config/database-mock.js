// Mock database for development/testing when PostgreSQL is not available
// This provides a degraded mode to allow server startup

class MockDatabase {
  constructor() {
    this.data = {
      users: [],
      streams: [],
      recordings: [],
      api_keys: [],
      analytics: []
    };
  }

  // Mock table access like db('tablename')
  call(tableName) {
    return this.table(tableName);
  }

  // Table access function to match Knex API
  table(tableName) {
    return {
      select: (fields) => {
        const records = this.data[tableName] || [];
        return {
          where: (condition) => {
            if (typeof condition === 'object') {
              const filtered = records.filter(record => {
                return Object.keys(condition).every(key => record[key] === condition[key]);
              });
              return {
                first: () => Promise.resolve(filtered[0] || null),
                limit: (n) => Promise.resolve(filtered.slice(0, n)),
                orderBy: (field, order) => Promise.resolve(filtered)
              };
            }
            return {
              first: () => Promise.resolve(null),
              limit: (n) => Promise.resolve([]),
              orderBy: (field, order) => Promise.resolve([])
            };
          },
          first: () => Promise.resolve(records[0] || null),
          limit: (n) => Promise.resolve(records.slice(0, n)),
          orderBy: (field, order) => Promise.resolve(records)
        };
      },
      
      where: (condition) => {
        const records = this.data[tableName] || [];
        if (typeof condition === 'object') {
          const filtered = records.filter(record => {
            return Object.keys(condition).every(key => record[key] === condition[key]);
          });
          return {
            first: () => Promise.resolve(filtered[0] || null),
            limit: (n) => Promise.resolve(filtered.slice(0, n)),
            orderBy: (field, order) => Promise.resolve(filtered)
          };
        }
        return {
          first: () => Promise.resolve(null),
          limit: (n) => Promise.resolve([]),
          orderBy: (field, order) => Promise.resolve([])
        };
      },
      
      insert: (data) => {
        if (!this.data[tableName]) this.data[tableName] = [];
        const id = data.id || (this.data[tableName].length + 1);
        const record = { ...data, created_at: new Date(), updated_at: new Date() };
        this.data[tableName].push(record);
        return Promise.resolve([id]);
      },
      
      update: (data) => ({
        where: (condition) => {
          if (!this.data[tableName]) return Promise.resolve(0);
          let updated = 0;
          this.data[tableName] = this.data[tableName].map(record => {
            if (typeof condition === 'object') {
              const matches = Object.keys(condition).every(key => record[key] === condition[key]);
              if (matches) {
                updated++;
                return { ...record, ...data, updated_at: new Date() };
              }
            }
            return record;
          });
          return Promise.resolve(updated);
        }
      }),
      
      del: () => ({
        where: (condition) => {
          if (!this.data[tableName]) return Promise.resolve(0);
          const initialLength = this.data[tableName].length;
          this.data[tableName] = this.data[tableName].filter(record => {
            if (typeof condition === 'object') {
              return !Object.keys(condition).every(key => record[key] === condition[key]);
            }
            return true;
          });
          return Promise.resolve(initialLength - this.data[tableName].length);
        }
      }),
      
      first: () => Promise.resolve((this.data[tableName] || [])[0] || null)
    };
  }

  // Mock Knex-like interface
  raw(query) {
    return Promise.resolve([{ test: 1 }]);
  }

  select(fields) {
    return {
      from: (table) => Promise.resolve(this.data[table] || []),
      where: (condition) => Promise.resolve([]),
      first: () => Promise.resolve(null),
      limit: (n) => Promise.resolve([]),
      orderBy: (field, order) => Promise.resolve([])
    };
  }

  insert(data) {
    return {
      into: (table) => {
        if (!this.data[table]) this.data[table] = [];
        const id = this.data[table].length + 1;
        const record = { id, ...data, created_at: new Date() };
        this.data[table].push(record);
        return Promise.resolve([id]);
      }
    };
  }

  update(data) {
    return {
      where: (condition) => Promise.resolve(1)
    };
  }

  del() {
    return {
      where: (condition) => Promise.resolve(1)
    };
  }

  // Mock migration methods
  migrate = {
    latest: () => Promise.resolve([])
  };

  // Mock destroy method
  destroy() {
    return Promise.resolve();
  }

  // Mock timeout method
  timeout(ms) {
    return this;
  }
}

// Create instance that can be called like a function
const mockDb = new MockDatabase();

// Export a function that can be called like db('tablename')
const dbFunction = function(tableName) {
  return mockDb.table(tableName);
};

// Copy all methods from the mock database to the function
Object.keys(mockDb).forEach(key => {
  if (typeof mockDb[key] === 'function') {
    dbFunction[key] = mockDb[key].bind(mockDb);
  } else {
    dbFunction[key] = mockDb[key];
  }
});

module.exports = dbFunction;