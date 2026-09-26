// The generated module is typed per contract; consumers only need these two exports.
export type ContractModuleLoader = () => Promise<{
  Contract: unknown;
  ledger: (data: unknown) => Record<string, unknown>;
}>;
