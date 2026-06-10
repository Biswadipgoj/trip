// In-memory localStorage so the zustand persist middleware works under node.
const store = new Map<string, string>()

const localStorageMock: Storage = {
  get length() {
    return store.size
  },
  clear: () => store.clear(),
  getItem: (key: string) => store.get(key) ?? null,
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => {
    store.delete(key)
  },
  setItem: (key: string, value: string) => {
    store.set(key, value)
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
