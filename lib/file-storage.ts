export function openFiles() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open("hermes-leilao-files", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function storeFiles(files: { key: string; file: Blob }[]) {
  const d = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = d.transaction("files", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Gravação de anexos cancelada"));
      try {
        for (const { key, file } of files) tx.objectStore("files").put(file, key);
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    d.close();
  }
}
export async function discardFiles(keys: string[]) {
  const database = await openFiles();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("files", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error("Remoção cancelada"));
      keys.forEach(key => tx.objectStore("files").delete(key));
    });
  } finally { database.close(); }
}
export async function readStoredFile(key: string): Promise<Blob> {
  const database = await openFiles();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const request = database.transaction("files").objectStore("files").get(key);
      request.onsuccess = () => request.result instanceof Blob
        ? resolve(request.result)
        : reject(new Error("Arquivo ausente neste navegador"));
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}
