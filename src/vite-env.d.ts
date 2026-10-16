/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ALLOW_EDIT_DELETE?: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
  [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
