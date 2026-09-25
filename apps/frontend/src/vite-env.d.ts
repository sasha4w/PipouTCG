/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL publique de l'API, sans slash final (voir .env.example). */
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
