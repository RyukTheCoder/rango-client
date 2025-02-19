import type { BestRouteResponse, BlockchainMeta } from 'rango-sdk';

export function getRequiredWallets(quote: BestRouteResponse | null): string[] {
  const wallets: string[] = [];

  quote?.result?.swaps.forEach((swap) => {
    const currentStepFromBlockchain = swap.from.blockchain;
    const currentStepToBlockchain = swap.to.blockchain;
    let lastAddedWallet = wallets[wallets.length - 1];
    if (currentStepFromBlockchain != lastAddedWallet) {
      wallets.push(currentStepFromBlockchain);
    }
    lastAddedWallet = wallets[wallets.length - 1];
    if (currentStepToBlockchain != lastAddedWallet) {
      wallets.push(currentStepToBlockchain);
    }
  });
  return wallets;
}

export function isValidAddress(
  chain: BlockchainMeta,
  address: string
): boolean {
  const regex = chain.addressPatterns;
  const valid = regex.filter((r) => new RegExp(r).test(address)).length > 0;
  return valid;
}
