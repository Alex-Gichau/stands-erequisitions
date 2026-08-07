const fs = require('fs');
let content = fs.readFileSync('src/contexts/RequisitionContext.tsx', 'utf8');

const stubsStart = '// Firestore stubs';
const stubsEnd = '// Temporary fix until migration is fully cleaned up';

const newStubs = `// Supabase as Firestore Stubs
const collection = (db: any, table: string) => ({ table });
const doc = (db: any, table: string, id?: string) => {
  if (!id && typeof table !== 'string') {
     return { table: db.table, id: table }; // doc(collectionRef, id) form
  }
  return { table, id };
};

const getDocFromServer = async (docRef: any) => getDoc(docRef);
const deleteField = () => null;
const getFirestore = () => ({});
const initializeFirestore = (...args: any[]) => ({});

const setDoc = async (docRef: any, data: any, options?: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const payload = { id: docRef.id, ...data };
  const { error } = await supabase.from(docRef.table).upsert(payload);
  if (error) console.error("setDoc error", error);
};

const updateDoc = async (docRef: any, data: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from(docRef.table).update(data).eq("id", docRef.id);
  if (error) console.error("updateDoc error", error);
};

const deleteDoc = async (docRef: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from(docRef.table).delete().eq("id", docRef.id);
  if (error) console.error("deleteDoc error", error);
};

const getDoc = async (docRef: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { exists: () => false, data: () => ({} as any), id: docRef.id };
  const { data, error } = await supabase.from(docRef.table).select("*").eq("id", docRef.id).single();
  if (error || !data) return { exists: () => false, data: () => ({} as any), id: docRef.id };
  return { exists: () => true, data: () => data, id: docRef.id };
};

const limit = (val: number) => ({ type: 'limit', value: val });
const orderBy = (field: string, direction: string = 'asc') => ({ type: 'orderBy', field, direction });
const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });

const query = (col: any, ...constraints: any[]) => {
  let q = { ...col };
  constraints.forEach(c => {
    if (c.type === 'limit') q.limitCount = c.value;
    if (c.type === 'orderBy') {
      q.orderColumn = c.field;
      q.ascending = c.direction !== 'desc';
    }
    if (c.type === 'where') {
      q.whereColumn = c.field;
      q.whereOp = c.op;
      q.whereValue = c.value;
    }
  });
  return q;
};

const getDocs = async (queryRef: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { docs: [], empty: true, forEach: (cb: any) => {} };
  
  let q = supabase.from(queryRef.table).select("*");
  if (queryRef.whereColumn) {
    if (queryRef.whereOp === "==") q = q.eq(queryRef.whereColumn, queryRef.whereValue);
    else if (queryRef.whereOp === ">") q = q.gt(queryRef.whereColumn, queryRef.whereValue);
    else if (queryRef.whereOp === "<") q = q.lt(queryRef.whereColumn, queryRef.whereValue);
  }
  if (queryRef.orderColumn) q = q.order(queryRef.orderColumn, { ascending: queryRef.ascending });
  if (queryRef.limitCount) q = q.limit(queryRef.limitCount);
  
  const { data, error } = await q;
  if (error || !data) return { docs: [], empty: true, forEach: (cb: any) => {} };
  
  const docs = data.map(d => ({ data: () => d, id: d.id, exists: () => true }));
  return { docs, empty: docs.length === 0, forEach: (cb: any) => docs.forEach(cb) };
};

const addDoc = async (col: any, data: any) => {
  const supabase = getSupabaseClient();
  if (!supabase) return { id: "mock" };
  const { data: inserted, error } = await supabase.from(col.table).insert([data]).select().single();
  if (error || !inserted) return { id: "mock" };
  return { id: inserted.id };
};

const onSnapshot = (queryRef: any, callback: (snap: any) => void) => {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  
  const fetchData = async () => {
    if (queryRef.id) { 
      const res = await getDoc(queryRef);
      callback(res);
    } else {
      const res = await getDocs(queryRef);
      callback(res);
    }
  };
  
  fetchData();
  
  const channel = supabase.channel(\`public:\${queryRef.table}\`)
    .on('postgres_changes', { event: '*', schema: 'public', table: queryRef.table }, () => {
       fetchData();
    })
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
};

const handleFirestoreError = (a: any, b: any, c: any) => {};
enum OperationType { READ, WRITE, DELETE, UPDATE, CREATE, LIST, GET }
const initializeApp = (...args: any[]) => {};
const deleteApp = async (a: any) => {};
const firebaseConfig = {};

`;

const startIndex = content.indexOf(stubsStart);
const endIndex = content.indexOf(stubsEnd);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + newStubs + content.substring(endIndex);
  fs.writeFileSync('src/contexts/RequisitionContext.tsx', content);
  console.log("Stubs replaced successfully.");
} else {
  console.log("Could not find stubs section.");
}
