/**
 * Mock Firestore minimaliste — assez pour exercer les écritures et lectures
 * de BBM.API sans réseau. Stocke tout en mémoire.
 */

class MockBatch {
  constructor(db) {
    this._db = db;
    this._ops = [];
  }
  delete(ref) { this._ops.push({ type: 'delete', ref }); return this; }
  set(ref, data, opts) { this._ops.push({ type: 'set', ref, data, opts }); return this; }
  update(ref, data) { this._ops.push({ type: 'update', ref, data }); return this; }
  async commit() {
    for (const op of this._ops) {
      if (op.type === 'delete') await op.ref.delete();
      else if (op.type === 'set') await op.ref.set(op.data, op.opts);
      else if (op.type === 'update') await op.ref.update(op.data);
    }
  }
}

class MockDocSnap {
  constructor(id, data) {
    this.id = id;
    this._data = data;
  }
  get exists() { return this._data != null; }
  data() { return this._data; }
}

class MockQuerySnap {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(fn) { this.docs.forEach(fn); }
  docChanges() { return this.docs.map(d => ({ type: 'added', doc: d })); }
}

class MockDocRef {
  constructor(coll, id) {
    this._coll = coll;
    this.id = id;
  }
  async get() {
    const data = this._coll._docs[this.id];
    return new MockDocSnap(this.id, data ? { ...data } : null);
  }
  async set(data, opts = {}) {
    if (opts.merge) {
      this._coll._docs[this.id] = { ...(this._coll._docs[this.id] || {}), ...data };
    } else {
      this._coll._docs[this.id] = { ...data };
    }
  }
  async update(data) {
    const existing = this._coll._docs[this.id] || {};
    // Naive — flat keys with dot notation supported partial
    for (const [k, v] of Object.entries(data)) {
      if (k.includes('.')) {
        const parts = k.split('.');
        let target = existing;
        for (let i = 0; i < parts.length - 1; i++) {
          target[parts[i]] = target[parts[i]] || {};
          target = target[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (v === '__delete__') delete target[last]; else target[last] = v;
      } else {
        existing[k] = v;
      }
    }
    this._coll._docs[this.id] = existing;
  }
  async delete() { delete this._coll._docs[this.id]; }
  collection(name) {
    const subKey = `${this._coll._name}/${this.id}/${name}`;
    if (!this._coll._db._colls[subKey]) {
      this._coll._db._colls[subKey] = new MockColl(this._coll._db, subKey);
    }
    return this._coll._db._colls[subKey];
  }
  onSnapshot(cb) {
    cb(new MockDocSnap(this.id, this._coll._docs[this.id] || null));
    return () => {};
  }
}

class MockColl {
  constructor(db, name) {
    this._db = db;
    this._name = name;
    this._docs = {};
  }
  doc(id) {
    if (!id) id = 'auto-' + (Date.now() + Math.random());
    return new MockDocRef(this, id);
  }
  async add(data) {
    const id = 'auto-' + (Date.now() + Math.random()).toString(36).replace('.', '');
    this._docs[id] = data;
    return new MockDocRef(this, id);
  }
  where(field, op, value) {
    const filtered = Object.entries(this._docs)
      .filter(([id, d]) => {
        if (op === '==') return d[field] === value;
        return true;
      })
      .map(([id, d]) => new MockDocSnap(id, d));
    return {
      get: async () => new MockQuerySnap(filtered),
      onSnapshot: (cb) => { cb(new MockQuerySnap(filtered)); return () => {}; }
    };
  }
  orderBy() { return this; }
  limit() { return this; }
  async get() {
    const docs = Object.entries(this._docs)
      .map(([id, d]) => new MockDocSnap(id, d));
    return new MockQuerySnap(docs);
  }
  onSnapshot(cb) {
    const docs = Object.entries(this._docs).map(([id, d]) => new MockDocSnap(id, d));
    cb(new MockQuerySnap(docs));
    return () => {};
  }
}

class MockDB {
  constructor() {
    this._colls = {};
  }
  collection(name) {
    if (!this._colls[name]) this._colls[name] = new MockColl(this, name);
    return this._colls[name];
  }
  batch() { return new MockBatch(this); }
}

export function createMockDB() {
  return new MockDB();
}
