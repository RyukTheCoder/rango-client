import { deepCopy } from './helpers';
import {
  BlockchainMeta,
  Connect,
  CosmosBlockchainMeta,
  CosmosChainInfo,
  CosmosInfo,
  ProviderConnectResult,
} from './rango';
import { Keplr as InstanceType } from '@keplr-wallet/types';

type CosmosExperimentalChainsInfo = {
  [k: string]: { id: string; info: CosmosChainInfo; experimental: boolean };
};

const getCosmosMainChainsIds = (blockchains: CosmosBlockchainMeta[]) =>
  blockchains
    .filter((blockchain) => !blockchain.info?.experimental)
    .map((blockchain) => blockchain.chainId);

const getCosmosMiscChainsIds = (blockchains: CosmosBlockchainMeta[]) =>
  blockchains
    .filter((blockchain) => blockchain.info?.experimental)
    .map((blockchain) => blockchain.chainId);

const getCosmosExperimentalChainInfo = (blockchains: CosmosBlockchainMeta[]) =>
  blockchains
    .filter((blockchain) => !!blockchain.info)
    .reduce(
      (
        cosmosExperimentalChainsInfo: CosmosExperimentalChainsInfo,
        blockchain
      ) => {
        const info = deepCopy(blockchain.info) as CosmosInfo;
        info.stakeCurrency.coinImageUrl =
          window.location.origin + info.stakeCurrency.coinImageUrl;
        info.currencies = info.currencies.map((currency) => ({
          ...currency,
          coinImageUrl: window.location.origin + currency.coinImageUrl,
        }));
        info.feeCurrencies = info.feeCurrencies.map((currency) => ({
          ...currency,
          coinImageUrl: window.location.origin + currency.coinImageUrl,
        }));
        if (!info.gasPriceStep) delete info.gasPriceStep;
        const { experimental, ...otherProperties } = info;
        return (
          (cosmosExperimentalChainsInfo[blockchain.name] = {
            id: blockchain.chainId,
            info: { ...otherProperties, chainId: blockchain.chainId },
            experimental: experimental,
          }),
          cosmosExperimentalChainsInfo
        );
      },
      {}
    );

async function getMainAccounts({
  desiredChainIds,
  instance,
}: {
  desiredChainIds: string[];
  instance: any;
}): Promise<ProviderConnectResult[]> {
  // Trying to get accounts from all chains
  const offlineSigners = desiredChainIds
    .map((chainId) => {
      const signer = instance.getOfflineSigner(chainId);
      return {
        signer,
        chainId,
      };
    })
    .filter(Boolean);
  const accountsPromises = offlineSigners.map(({ signer }) =>
    signer.getAccounts()
  );
  const availableAccountForChains = await Promise.all(accountsPromises);

  const resolvedAccounts: ProviderConnectResult[] = [];
  availableAccountForChains.forEach(
    (accounts: { address: string }[], index) => {
      const { chainId } = offlineSigners[index];
      const addresses = accounts.map((account) => account.address);
      resolvedAccounts.push({ accounts: addresses, chainId });
    }
  );

  return resolvedAccounts;
}

async function tryRequestMiscAccounts({
  excludedChain,
  instance,
  meta,
}: {
  excludedChain?: string;
  instance: InstanceType;
  meta: BlockchainMeta[];
}): Promise<ProviderConnectResult[]> {
  const offlineSigners = getCosmosMiscChainsIds(meta as CosmosBlockchainMeta[])
    .filter((id) => id !== excludedChain)
    .map((chainId) => {
      const signer = instance.getOfflineSigner(chainId);
      return {
        signer,
        chainId,
      };
    });
  const accountsPromises = offlineSigners.map(({ signer }) =>
    signer.getAccounts()
  );
  const availableAccountForChains = await Promise.allSettled(accountsPromises);

  const resolvedAccounts: ProviderConnectResult[] = [];
  availableAccountForChains.forEach((result, index) => {
    if (result.status !== 'fulfilled') return;

    const accounts = result.value;
    const { chainId } = offlineSigners[index];
    const addresses = accounts.map((account) => account.address);

    resolvedAccounts.push({ accounts: addresses, chainId });
  });

  return resolvedAccounts;
}

export const getCosmosAccounts: Connect = async ({
  instance,
  network,
  meta,
}) => {
  const chainInfo = network
    ? getCosmosExperimentalChainInfo(meta as CosmosBlockchainMeta[])[network]
    : null;

  if (!!network && !chainInfo) {
    throw new Error(
      `You need to add ${network} to "COSMOS_EXPERIMENTAL_CHAINS_INFO" first.`
    );
  }

  // Asking for connect to wallet.
  if (!!chainInfo) {
    await instance.experimentalSuggestChain(chainInfo.info);
  }

  // Getting main chains + target network
  let desiredChainIds: string[] = getCosmosMainChainsIds(
    meta as CosmosBlockchainMeta[]
  );
  desiredChainIds.push(chainInfo!.id);
  desiredChainIds = Array.from(new Set(desiredChainIds));

  await instance.enable(desiredChainIds);

  const mainAccounts = await getMainAccounts({
    desiredChainIds,
    instance,
  });

  const exclude = !!chainInfo ? chainInfo.id : undefined;
  const miscAccounts = await tryRequestMiscAccounts({
    instance,
    meta,
    excludedChain: exclude,
  });

  const results = [...mainAccounts, ...miscAccounts];
  return results;
};
