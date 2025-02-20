/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Initializes the IndexedDb, ran befor each other custom IndexedDb function in the project. By default it creates 2 stores, "chatHistory" used for storing all of the chat histories, and "currentChatHistory" which is used to store the currently open chat.
 *
 * @returns Promise<void>
 *
 */
interface DBStoreConfig {
  name: string;
  keyPath?: string;
}

interface ChatRecord {
  id: string;
  created_at?: number;
  [key: string]: any;
}

const STORES: DBStoreConfig[] = [
  { name: "chatHistory", keyPath: "id" },
  { name: "currentChatHistory" },
];

const addCreatedAtField = (transaction: IDBTransaction) => {
  const yesterday = Date.now() - 86400000;

  const chatStore = transaction.objectStore("chatHistory");
  chatStore.getAll().onsuccess = function (e: Event) {
    const request = e.target as IDBRequest<ChatRecord[]>;
    if (!request.result) return;

    request.result.forEach((record: ChatRecord) => {
      if (!record.created_at) {
        const newRecord = {
          ...record,
          created_at: yesterday,
        };
        chatStore.put(newRecord);
      }
    });
  };

  const currentStore = transaction.objectStore("currentChatHistory");
  currentStore.getAll().onsuccess = function (e: Event) {
    const request = e.target as IDBRequest<ChatRecord[]>;
    if (!request.result) return;
    request.result.forEach((record: ChatRecord) => {
      if (!record.created_at) {
        const newRecord = {
          ...record,
          created_at: Date.now(),
        };
        currentStore.put(newRecord, "current");
      }
    });
  };
};

const initializeStores = (db: IDBDatabase) => {
  STORES.forEach((store) => {
    if (!db.objectStoreNames.contains(store.name)) {
      console.log(`Creating ${store.name} store`);
      db.createObjectStore(
        store.name,
        store.keyPath ? { keyPath: store.keyPath } : undefined
      );
    }
  });
};

const handleUpgrade = (event: IDBVersionChangeEvent) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = event.oldVersion || 0;
  const transaction = (event.target as IDBOpenDBRequest).transaction;

  console.log(`Upgrading from version ${oldVersion} to ${CURRENT_VERSION}`);

  if (!transaction) {
    throw new Error("No transaction found during upgrade");
  }

  // Init
  initializeStores(db);

  //We could add version specific upgrades here
  if (oldVersion < 3) {
    addCreatedAtField(transaction);
  }
};

const DB_NAME = "ChatHistoryDB";
const CURRENT_VERSION = 3;

export const initDB = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, CURRENT_VERSION);

    request.onupgradeneeded = handleUpgrade;

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
        window.location.reload();
      };

      resolve(db);
    };

    request.onerror = () => {
      console.error("Database error:", request.error);
      reject("Error opening IndexedDB");
    };

    request.onblocked = () => {
      console.warn(
        "Database upgrade blocked. Please close other tabs and reload."
      );
      reject("Blocked Upgrade of IndexedDB");
    };
  });
};

/**
 * Used for clearing out the entire IndexedDb, takes no parameters, will iterate through every single "store" and delete them individually.
 *
 * @returns Promise<void>
 */
export const clearDB = async () => {
  const db = await initDB();
  const transaction = db.transaction(
    Array.from(db.objectStoreNames),
    "readwrite"
  );

  const promises: Promise<void>[] = [];

  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const storeName = db.objectStoreNames[i];
    const store = transaction.objectStore(storeName);
    const clearRequest = store.clear();

    promises.push(
      new Promise((resolve, reject) => {
        clearRequest.onsuccess = () => resolve();
        clearRequest.onerror = () =>
          reject(`Error clearing store: ${storeName}`);
      })
    );
  }

  return Promise.all(promises)
    .then(() => {
      console.log("All object stores cleared successfully.");
      db.close();
    })
    .catch((error) => {
      console.error("Error clearing the database:", error);
      db.close();
    });
};

/**
 *
 * @param storeName The storeName you want to save your data into, will run into an error if the specified storeName doesn't exist in the IndexedDB.
 *
 * @param data The data you would want to save to the specified store.
 *
 * @returns Promise<void>
 */
export const saveData = async (storeName: string, data: any) => {
  const db = await initDB();
  if (!data) return;

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    if (storeName === "currentChatHistory") {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => {
        store.put(data, "current");
      };
      clearRequest.onerror = () => {
        reject(`Error clearing ${storeName}`);
      };
    } else if (storeName === "chatHistory") {
      if (Array.isArray(data)) {
        data.forEach((item) => {
          if (item.id) {
            store.put(item);
          } else {
            console.error("Each object in array must have an id key.");
            reject("DataError: Each object in array must have an id key.");
          }
        });
      } else {
        store.put(data);
      }
    }

    transaction.oncomplete = () => {
      resolve();
      db.close();
    };
    transaction.onerror = () => {
      reject(`Error saving data to ${storeName}`);
      db.close();
    };
  });
};

/**
 * Returns you all of the data inside the specified storeName
 *
 * @param storeName The store you want to get everything from.
 *
 * @returns Promise<any>
 *
 */
export const getData = async (storeName: string) => {
  const db = await initDB();

  return new Promise<any>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);

    const request = store.getAll();
    request.onsuccess = () => {
      resolve(request.result);
      db.close();
    };
    request.onerror = () => {
      reject(`Error retrieving all data from ${storeName}`);
      db.close();
    };
  });
};

/**
 * Will delete the specified store from the IndexedDB.
 *
 * @param storeName The name of the store you want to delete.
 *
 * @returns Promise<void>
 *
 */
export const deleteData = async (storeName: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    const request = store.clear();
    request.onsuccess = () => {
      resolve();
      db.close();
    };
    request.onerror = () => {
      reject(`Error deleting data from ${storeName}`);
      db.close();
    };
  });
};

/**
 * Deletes an entry from the store which matches to the ID provided via props.
 *
 * @param storeName The name of the store you want to delete from.
 *
 * @param id The key of the specified entry you want to delete.
 *
 * @return Promise<void>
 *
 */
export const deleteChat = async (storeName: string, id: string) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    const request = store.delete(id);
    request.onsuccess = () => {
      resolve();
      db.close();
    };
    request.onerror = () => {
      reject(`Error deleting item with ID ${id} from ${storeName}`);
      db.close();
    };
  });
};
