import type {
  OnConnectHandler,
  PropTypes,
  WidgetContextInterface,
} from './Wallets.types';
import type { Wallet } from '../../types/wallets';
import type { ProvidersOptions } from '../../utils/providers';
import type { EventHandler } from '@rango-dev/wallets-react';
import type { Network } from '@rango-dev/wallets-shared';
import type { PropsWithChildren } from 'react';

import { Events, Provider } from '@rango-dev/wallets-react';
import { isEvmBlockchain } from 'rango-sdk';
import React, { createContext, useEffect, useRef, useState } from 'react';

import { useSyncStoresWithConfig } from '../../hooks/useSyncStoresWithConfig';
import { useWalletProviders } from '../../hooks/useWalletProviders';
import { AppStoreProvider, useAppStore } from '../../store/AppStore';
import { useWalletsStore } from '../../store/wallets';
import {
  prepareAccountsForWalletStore,
  walletAndSupportedChainsNames,
} from '../../utils/wallets';

export const WidgetContext = createContext<WidgetContextInterface>({
  onConnectWallet: () => {
    return;
  },
});

function Main(props: PropsWithChildren<PropTypes>) {
  const { updateConfig, updateSettings, fetch: fetchMeta } = useAppStore();
  const blockchains = useAppStore().blockchains();
  const tokens = useAppStore().tokens();
  const walletOptions: ProvidersOptions = {
    walletConnectProjectId: props.config?.walletConnectProjectId,
  };
  const [accounts, setAccounts] = useState<Wallet[]>([]);
  const { providers } = useWalletProviders(props.config.wallets, walletOptions);
  const { connectWallet, disconnectWallet } = useWalletsStore();
  const onConnectWalletHandler = useRef<OnConnectHandler>();
  useSyncStoresWithConfig();

  useEffect(() => {
    void fetchMeta().catch(console.log);
  }, []);

  useEffect(() => {
    if (props.config) {
      updateConfig(props.config);
      updateSettings(props.config);
    }
  }, [props.config]);

  const evmBasedChainNames = blockchains
    .filter(isEvmBlockchain)
    .map((chain) => chain.name);

  const onUpdateState: EventHandler = (type, event, value, state, meta) => {
    if (event === Events.ACCOUNTS) {
      if (value) {
        const supportedChainNames: Network[] | null =
          walletAndSupportedChainsNames(meta.supportedBlockchains);
        const data = prepareAccountsForWalletStore(
          type,
          value,
          evmBasedChainNames,
          supportedChainNames,
          meta.isContractWallet
        );
        setAccounts(data);
      } else {
        disconnectWallet(type);
      }
    }
    if (event === Events.ACCOUNTS && state.connected) {
      const key = `${type}-${state.network}-${value}`;

      if (state.connected) {
        if (!!onConnectWalletHandler.current) {
          onConnectWalletHandler.current(key);
        } else {
          console.warn(
            `onConnectWallet handler hasn't been set. Are you sure?`
          );
        }
      }
    }

    if (event === Events.NETWORK && state.network) {
      const key = `${type}-${state.network}`;
      if (!!onConnectWalletHandler.current) {
        onConnectWalletHandler.current(key);
      } else {
        console.warn(`onConnectWallet handler hasn't been set. Are you sure?`);
      }
    }

    // propagate updates for Dapps using external wallets
    if (props.onUpdateState) {
      props.onUpdateState(type, event, value, state, meta);
    }
  };

  useEffect(() => {
    if (accounts.length) {
      connectWallet(accounts, tokens);
    }
  }, [accounts, tokens]);

  return (
    <WidgetContext.Provider
      // eslint-disable-next-line react/jsx-no-constructed-context-values
      value={{
        onConnectWallet: (handler) => {
          onConnectWalletHandler.current = handler;
        },
      }}>
      <Provider
        allBlockChains={blockchains}
        providers={providers}
        onUpdateState={onUpdateState}
        autoConnect>
        {props.children}
      </Provider>
    </WidgetContext.Provider>
  );
}

export function WidgetWallets(props: PropsWithChildren<PropTypes>) {
  const { config, ...otherProps } = props;
  return (
    <AppStoreProvider config={config}>
      <Main {...otherProps} config={config} />
    </AppStoreProvider>
  );
}
