/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTRACT_ADDRESS: string;
  readonly VITE_NETWORK: string;
  readonly VITE_PROOF_SERVER_URL: string;
  readonly VITE_DEBUG: string;
  readonly VITE_USE_CHAIN: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
