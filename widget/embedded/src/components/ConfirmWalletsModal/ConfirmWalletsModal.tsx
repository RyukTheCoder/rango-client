import type { PropTypes } from './ConfirmWalletsModal.types';
import type { ConnectedWallet } from '../../store/wallets';
import type { ConfirmSwapWarnings, Wallet } from '../../types';

import { i18n } from '@lingui/core';
import {
  Alert,
  BalanceErrors,
  Button,
  ChevronDownIcon,
  ChevronLeftIcon,
  Divider,
  MessageBox,
  Modal,
  Typography,
  WalletIcon,
} from '@rango-dev/ui';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { RANGO_SWAP_BOX_ID } from '../../constants';
import { getQuoteErrorMessage } from '../../constants/errors';
import { getQuoteUpdateWarningMessage } from '../../constants/warnings';
import { useAppStore } from '../../store/AppStore';
import { useQuoteStore } from '../../store/quote';
import { useWalletsStore } from '../../store/wallets';
import { getBlockchainShortNameFor } from '../../utils/meta';
import { confirmSwapDisabled } from '../../utils/swap';

import { getRequiredWallets, isValidAddress } from './ConfirmWallets.helpers';
import {
  alarmsStyles,
  CollapsibleContent,
  CollapsibleRoot,
  ConfirmButton,
  CustomDestination,
  CustomDestinationButton,
  EXPANDABLE_TRANSITION_DURATION,
  ExpandedIcon,
  ListContainer,
  NavigateBack,
  ShowMoreHeader,
  StyledTextField,
  Title,
  Trigger,
  Wallets,
  WalletsContainer,
  walletsListStyles,
} from './ConfirmWallets.styles';
import { WalletList } from './WalletList';

const NUMBER_OF_WALLETS_TO_DISPLAY = 2;

export function ConfirmWalletsModal(props: PropTypes) {
  //TODO: move component's logics to a custom hook
  const { open, onClose, onCancel, onCheckBalance, loading } = props;
  const config = useAppStore().config;
  const blockchains = useAppStore().blockchains();
  const {
    quote,
    setSelectedWallets: selectQuoteWallets,
    quoteWalletsConfirmed: quoteWalletsConfirmed,
    setQuoteWalletConfirmed: setQuoteWalletConfirmed,
    customDestination,
    setCustomDestination,
  } = useQuoteStore();
  const { connectedWallets, selectWallets } = useWalletsStore();

  const [showMoreWalletFor, setShowMoreWalletFor] = useState('');
  const [balanceWarnings, setBalanceWarnings] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [quoteWarning, setQuoteWarning] = useState<
    ConfirmSwapWarnings['quoteUpdate'] | null
  >(null);
  const [destination, setDestination] = useState(customDestination);
  const [showCustomDestination, setShowCustomDestination] = useState(
    !!customDestination
  );
  const customDestinationRef = useRef<HTMLDivElement | null>(null);

  const requiredWallets = getRequiredWallets(quote);

  const lastStepToBlockchain = blockchains.find(
    (blockchain) =>
      blockchain.name ===
      quote?.result?.swaps[quote?.result?.swaps.length - 1].to.blockchain
  );
  const isWalletRequiredFor = (blockchain: string) =>
    !!quote?.result?.swaps.find((swap) => swap.from.blockchain === blockchain);

  const [selectableWallets, setSelectableWallets] = useState<ConnectedWallet[]>(
    connectedWallets.filter((connectedWallet) => {
      return (
        connectedWallet.selected &&
        requiredWallets.includes(connectedWallet.chain)
      );
    })
  );
  const lastStepToBlockchainMeta = blockchains.find(
    (chain) => chain.name === lastStepToBlockchain?.name
  );

  const isSelected = (walletType: string, chain: string) =>
    !!selectableWallets.find(
      (selectableWallet) =>
        selectableWallet.walletType === walletType &&
        selectableWallet.chain === chain &&
        selectableWallet.selected &&
        (isWalletRequiredFor(chain) ||
          (!isWalletRequiredFor(chain) && !destination))
    );

  const isAddressMatched =
    !!destination &&
    showCustomDestination &&
    lastStepToBlockchainMeta &&
    !isValidAddress(lastStepToBlockchainMeta, destination);

  const resetCustomDestination = () => {
    setShowCustomDestination(false);
    setDestination('');
    setSelectableWallets((selectableWallets) => {
      let anyWalletSelected = false;
      return selectableWallets.map((selectableWallet) => {
        if (
          !anyWalletSelected &&
          selectableWallet.chain === lastStepToBlockchain?.name
        ) {
          anyWalletSelected = true;
          return {
            ...selectableWallet,
            selected: true,
          };
        }
        return selectableWallet;
      });
    });
  };

  const onChange = (wallet: Wallet) => {
    if (showMoreWalletFor) {
      setShowMoreWalletFor('');
    }
    const selected = isSelected(wallet.walletType, wallet.chain);
    if (selected) {
      return;
    }
    const connectedWallet = connectedWallets.find(
      (connectedWallet) =>
        connectedWallet.walletType === wallet.walletType &&
        connectedWallet.chain === wallet.chain
    );

    if (!connectedWallet) {
      return;
    }

    onCancel();
    if (wallet.chain === lastStepToBlockchain?.name && showCustomDestination) {
      setShowCustomDestination(false);
      setDestination('');
    }
    setSelectableWallets((selectableWallets) =>
      selectableWallets
        .filter((selectableWallet) => selectableWallet.chain !== wallet.chain)
        .concat({ ...connectedWallet, selected: true })
    );
  };

  const onConfirmBalance = () => {
    const lastSelectedWallets = selectableWallets.filter(
      (wallet) => wallet.selected
    );
    selectWallets(lastSelectedWallets);
    selectQuoteWallets(lastSelectedWallets);
    setCustomDestination(destination);
    setQuoteWalletConfirmed(true);
    onClose();
  };

  const onConfirmWallets = async () => {
    setBalanceWarnings([]);
    setError('');
    setQuoteWarning(null);
    const selectedWallets = connectedWallets.filter((connectedWallet) =>
      selectableWallets.find(
        (selectableWallet) =>
          selectableWallet.chain === connectedWallet.chain &&
          selectableWallet.walletType === connectedWallet.walletType
      )
    );
    const result = await onCheckBalance?.({
      selectedWallets,
      customDestination: destination,
    });

    const warnings = result.warnings;
    if (warnings?.balance?.messages) {
      setBalanceWarnings(warnings.balance.messages);
    }
    if (warnings?.quoteUpdate) {
      setQuoteWarning(warnings.quoteUpdate);
    }
    if (result.error) {
      setError(getQuoteErrorMessage(result.error));
    }

    if (!result.error && (!warnings?.balance?.messages.length || 0 > 0)) {
      onConfirmBalance();
    } else {
      setBalanceWarnings(warnings?.balance?.messages ?? []);
    }
  };

  useEffect(() => {
    setSelectableWallets((selectableWallets) =>
      selectableWallets.concat(
        connectedWallets.filter((connectedWallet) => {
          const anyWalletSelected = !!selectableWallets.find(
            (selectableWallet) =>
              selectableWallet.chain === connectedWallet.chain
          );

          return (
            !anyWalletSelected &&
            connectedWallet.selected &&
            requiredWallets.includes(connectedWallet.chain)
          );
        })
      )
    );
  }, [connectedWallets.length]);

  useLayoutEffect(() => {
    if (showCustomDestination && customDestinationRef.current) {
      setTimeout(() => {
        customDestinationRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, EXPANDABLE_TRANSITION_DURATION);
    }
  }, [showCustomDestination]);

  const modalContainer = document.getElementById(
    RANGO_SWAP_BOX_ID
  ) as HTMLDivElement;

  const navigate = useNavigate();
  return (
    <Modal
      open={open}
      onClose={() => {
        if (!quoteWalletsConfirmed) {
          const home = '../';
          navigate(home, { replace: true });
        }
        onClose();
      }}
      dismissible={!showMoreWalletFor}
      container={modalContainer}
      {...(!showMoreWalletFor && {
        footer: (
          <ConfirmButton>
            <Button
              loading={loading}
              disabled={confirmSwapDisabled(
                loading,
                showCustomDestination,
                destination,
                quote,
                selectableWallets,
                lastStepToBlockchain
              )}
              onClick={onConfirmWallets}
              variant="contained"
              type="primary"
              fullWidth
              size="large">
              {i18n.t('Confirm')}
            </Button>
          </ConfirmButton>
        ),
      })}
      {...(showMoreWalletFor && {
        containerStyle: { padding: '$0' },
        header: (
          <ShowMoreHeader>
            <NavigateBack
              variant="ghost"
              onClick={setShowMoreWalletFor.bind(null, '')}>
              <ChevronLeftIcon size={16} />
            </NavigateBack>
            <Typography variant="headline" size="small">
              {i18n.t({
                id: 'Your {blockchainName} wallets',
                values: {
                  blockchainName: getBlockchainShortNameFor(
                    showMoreWalletFor,
                    blockchains
                  ),
                },
              })}
            </Typography>
          </ShowMoreHeader>
        ),
      })}
      anchor="center">
      <Modal
        open={balanceWarnings.length > 0}
        onClose={setBalanceWarnings.bind(null, [])}
        container={modalContainer}>
        <MessageBox
          title={i18n.t('Insufficient account balance')}
          type="error"
          description={<BalanceErrors messages={balanceWarnings ?? []} />}>
          <Button
            variant="outlined"
            size="large"
            type="primary"
            fullWidth
            onClick={onConfirmBalance}>
            {i18n.t('Proceed anyway')}
          </Button>
        </MessageBox>
      </Modal>
      {showMoreWalletFor && (
        <WalletsContainer>
          <div className={walletsListStyles()}>
            <WalletList
              chain={showMoreWalletFor}
              isSelected={isSelected}
              selectWallet={onChange}
              onShowMore={setShowMoreWalletFor.bind(null, showMoreWalletFor)}
            />
          </div>
        </WalletsContainer>
      )}
      {!showMoreWalletFor && (
        <>
          {error && (
            <>
              <Alert variant="alarm" type="error" title={i18n.t(error)} />
              <Divider size={12} />
            </>
          )}
          {quoteWarning && (
            <>
              <Alert
                variant="alarm"
                type="warning"
                title={getQuoteUpdateWarningMessage(quoteWarning)}
              />
              <Divider size={12} />
            </>
          )}
          <Wallets>
            {requiredWallets.map((requiredWallet, index) => {
              const blockchain = blockchains.find(
                (blockchain) => blockchain.name === requiredWallet
              );

              const key = `wallet-${index}`;
              const isLastWallet = index === requiredWallets.length - 1;

              return (
                <div key={key}>
                  <Title>
                    <Typography variant="title" size="xmedium">
                      {i18n.t({
                        id: 'Your {blockchainName} wallets',
                        values: { blockchainName: blockchain?.shortName },
                      })}
                    </Typography>
                    <Typography
                      variant="label"
                      color="$neutral700"
                      size="medium">
                      {i18n.t({
                        id: 'You need to connect a {blockchainName} wallet.',
                        values: { blockchainName: blockchain?.shortName },
                      })}
                    </Typography>
                  </Title>
                  <Divider size={24} />
                  <ListContainer>
                    <WalletList
                      chain={requiredWallet}
                      isSelected={isSelected}
                      selectWallet={onChange}
                      limit={NUMBER_OF_WALLETS_TO_DISPLAY}
                      onShowMore={() =>
                        setShowMoreWalletFor(blockchain?.name ?? '')
                      }
                    />
                  </ListContainer>
                  {!isLastWallet && <Divider size={32} />}
                  {isLastWallet && config?.customDestination && (
                    <CustomDestination>
                      <CollapsibleRoot
                        ref={customDestinationRef}
                        selected={showCustomDestination}
                        open={showCustomDestination}
                        onOpenChange={(checked) => {
                          if (!checked) {
                            resetCustomDestination();
                          } else {
                            if (
                              !isWalletRequiredFor(
                                lastStepToBlockchain?.name ?? ''
                              )
                            ) {
                              setSelectableWallets((selectableWallets) =>
                                selectableWallets.map((selectableWallet) => {
                                  if (
                                    selectableWallet.chain ===
                                    lastStepToBlockchain?.name
                                  ) {
                                    return {
                                      ...selectableWallet,
                                      selected: false,
                                    };
                                  }
                                  return selectableWallet;
                                })
                              );
                            }
                          }
                        }}>
                        <Trigger
                          onClick={() =>
                            setShowCustomDestination((prevState) => !prevState)
                          }>
                          <CustomDestinationButton
                            fullWidth
                            variant="default"
                            suffix={
                              <ExpandedIcon
                                orientation={
                                  showCustomDestination ? 'up' : 'down'
                                }>
                                <ChevronDownIcon size={10} color="gray" />
                              </ExpandedIcon>
                            }>
                            <div className="button__content">
                              <WalletIcon size={18} color="info" />
                              <Divider size={4} direction="horizontal" />
                              <Typography variant="label" size="medium">
                                {i18n.t('Send to a different address')}
                              </Typography>
                            </div>
                          </CustomDestinationButton>
                        </Trigger>
                        <CollapsibleContent open={showCustomDestination}>
                          <>
                            <Divider size={4} />
                            <StyledTextField
                              autoFocus
                              placeholder={i18n.t('Your destination address')}
                              value={destination}
                              onChange={(e) => {
                                setDestination(e.target.value);
                              }}
                            />
                          </>
                        </CollapsibleContent>
                      </CollapsibleRoot>
                      {isAddressMatched && (
                        <div className={alarmsStyles()}>
                          <Alert
                            variant="alarm"
                            type="error"
                            title={i18n.t({
                              values: { destination },
                              id: "Address {destination} doesn't match the blockchain address pattern.",
                            })}
                          />
                        </div>
                      )}
                    </CustomDestination>
                  )}
                </div>
              );
            })}
          </Wallets>
        </>
      )}
    </Modal>
  );
}
