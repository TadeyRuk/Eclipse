export type NetworkConfig = {
  networkId: string;
  indexer: string;
  indexerWS: string;
  node: string;
  nodeWS: string;
  proofServer: string;
  /** Programmatic drip endpoint used by testkit FaucetClient */
  faucet: string;
  /** Human faucet UI for manual funding / screenshots */
  faucetPage: string;
};

export const PREVIEW_CONFIG: NetworkConfig = {
  networkId: 'preview',
  indexer: 'https://indexer.preview.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preview.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preview.midnight.network',
  nodeWS: 'wss://rpc.preview.midnight.network',
  proofServer: process.env['MIDNIGHT_PROOF_SERVER'] ?? 'http://127.0.0.1:6300',
  faucet: 'https://faucet.preview.midnight.network/api/drips',
  faucetPage: 'https://faucet.preview.midnight.network/',
};

export const PREPROD_CONFIG: NetworkConfig = {
  networkId: 'preprod',
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  nodeWS: 'wss://rpc.preprod.midnight.network',
  proofServer: process.env['MIDNIGHT_PROOF_SERVER'] ?? 'http://127.0.0.1:6300',
  faucet: 'https://faucet.preprod.midnight.network/api/drips',
  faucetPage: 'https://faucet.preprod.midnight.network/',
};

export function getConfig(network = process.env['MIDNIGHT_NETWORK'] ?? 'preview'): NetworkConfig {
  if (network === 'preview') return PREVIEW_CONFIG;
  if (network === 'preprod') return PREPROD_CONFIG;
  throw new Error(`Unknown network: ${network}. Supported for deploy: 'preview', 'preprod'.`);
}
