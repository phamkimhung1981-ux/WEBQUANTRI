/// <reference types="vite/client" />

declare const __BUILD_TIME__: string;
declare const __COMMIT_SHA__: string;
declare const __APP_ENV__: string;

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

