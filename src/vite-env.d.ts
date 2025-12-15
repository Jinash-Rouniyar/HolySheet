/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly UNIVER_CLIENT_LICENSE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

