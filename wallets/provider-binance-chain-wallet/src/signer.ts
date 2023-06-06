import { DefaultEvmSigner } from '@rango-dev/signer-evm';
import { Network, getNetworkInstance } from '@rango-dev/wallets-shared';
import type { SignerFactory } from 'rango-types';
import { CustomCosmosSigner } from './cosmos-signer';

import Rango from 'rango-types';

// For cjs compatibility.
const { DefaultSignerFactory, TransactionType: TxType } = Rango;

export default function getSigners(provider: any): SignerFactory {
  const ethProvider = getNetworkInstance(provider, Network.ETHEREUM);
  const cosmosProvider = getNetworkInstance(provider, Network.COSMOS);
  const signers = new DefaultSignerFactory();
  signers.registerSigner(TxType.EVM, new DefaultEvmSigner(ethProvider));
  signers.registerSigner(TxType.COSMOS, new CustomCosmosSigner(cosmosProvider));
  return signers;
}
