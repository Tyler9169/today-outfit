export const categories = ["上衣", "裤子", "鞋子", "外套"] as const;
export type Category = (typeof categories)[number];
export type Attributes = { confirmed: boolean; featuresConfirmed?: boolean; pattern?: string; neckline?: string; sleeve?: string; length?: string; material?: string; materialConfirmed?: boolean; materialSource?: "manual" | "label"; labelText?: string; fit?: string; style?: string; thickness?: string; warmth?: string; minTemp?: number; maxTemp?: number; comfort?: number; rainSuitable?: boolean; scenes?: string[] };
export type Clothing = {
  attributes?: Attributes;
  dirty?: boolean;
  id: string;
  category: Category;
  color: string;
  photo: Blob;
  createdAt: number;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("当前浏览器无法使用本地存储，请换一个浏览器重试。"));
      return;
    }
    const request = indexedDB.open("my-wardrobe", 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      if (!db.objectStoreNames.contains("clothes")) {
        db.createObjectStore("clothes", { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("请关闭其他打开衣橱的标签页后重试。"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) { db.close(); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("clothes", mode);
      const request = action(transaction.objectStore("clothes"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error("本地存储操作中断"));
      transaction.onerror = () => reject(transaction.error ?? request.error);
    });
  } finally {
    db.close();
  }
}

export async function getClothes(): Promise<Clothing[]> {
  const items = await transact<Clothing[]>("readonly", (store) => store.getAll());
  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveClothing(item: Clothing): Promise<void> {
  await transact("readwrite", (store) => store.add(item));
}

export async function deleteClothing(id: string): Promise<void> {
  await transact("readwrite", (store) => store.delete(id));
}

// One transaction guarantees replace/import never leaves a partially written wardrobe.
export async function importClothes(items: Clothing[], replace = false, state?: unknown): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["clothes", "meta"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("导入已回滚"));
      tx.onerror = () => reject(tx.error);
      const store = tx.objectStore("clothes");
      if (replace) store.clear();
      for (const item of items) store.add(item);
      if (state !== undefined) tx.objectStore("meta").put(state, "app-state");
    });
  } finally { db.close(); }
}

export async function updateClothing(item: Clothing): Promise<void> {
  await transact("readwrite", store => store.put(item));
}

export async function readMeta(): Promise<unknown> {
  const db = await openDatabase();
  try { return await new Promise((resolve, reject) => { const tx = db.transaction("meta"); const request = tx.objectStore("meta").get("app-state"); tx.oncomplete = () => resolve(request.result); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
export async function writeMeta(value: unknown): Promise<void> {
  const db = await openDatabase();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("meta", "readwrite"); tx.objectStore("meta").put(value, "app-state"); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}

// Commit clothes and their references together; abort preserves the entire old snapshot.
export async function commitWardrobe(before: Clothing[], after: Clothing[], state: unknown): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(["clothes", "meta"], "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error("保存已回滚"));
      tx.onerror = () => reject(tx.error);
      try {
        const clothes = tx.objectStore("clothes"), nextIds = new Set(after.map(i => i.id));
        const old = new Map(before.map(i => [i.id, i]));
        for (const item of before) if (!nextIds.has(item.id)) clothes.delete(item.id);
        for (const item of after) if (old.get(item.id) !== item) clothes.put(item);
        tx.objectStore("meta").put(state, "app-state");
      } catch (error) { tx.abort(); reject(error); }
    });
  } finally { db.close(); }
}
