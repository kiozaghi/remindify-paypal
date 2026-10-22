export {};

declare global {
  interface EthereumProvider {
    isMetaMask?: boolean;
    request(args: { method: string; params?: unknown[] | object }): Promise<any>;
  }

  interface Window {
    ethereum?: EthereumProvider;
  }
}
