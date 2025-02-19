import type { QuoteProps } from './Quote.types';
import type { Step } from '@rango-dev/ui';
import type { SwapResult } from 'rango-sdk';

import { i18n } from '@lingui/core';
import {
  Alert,
  ChevronDownIcon,
  ChevronRightIcon,
  Divider,
  Image,
  InfoIcon,
  QuoteCost,
  StepDetails,
  TokenAmount,
  Tooltip,
  Typography,
} from '@rango-dev/ui';
import BigNumber from 'bignumber.js';
import React, { useLayoutEffect, useRef, useState } from 'react';

import {
  GAS_FEE_MAX_DECIMALS,
  GAS_FEE_MIN_DECIMALS,
  PERCENTAGE_CHANGE_MAX_DECIMALS,
  PERCENTAGE_CHANGE_MIN_DECIMALS,
  TOKEN_AMOUNT_MAX_DECIMALS,
  TOKEN_AMOUNT_MIN_DECIMALS,
  USD_VALUE_MAX_DECIMALS,
  USD_VALUE_MIN_DECIMALS,
} from '../../constants/routing';
import {
  FooterAlert,
  FooterStepAlarm,
} from '../../containers/QuoteInfo/QuoteInfo.styles';
import { useAppStore } from '../../store/AppStore';
import { QuoteErrorType, QuoteWarningType } from '../../types';
import { getContainer } from '../../utils/common';
import {
  getBlockchainShortNameFor,
  getSwapperDisplayName,
} from '../../utils/meta';
import {
  formatTooltipNumbers,
  numberToString,
  secondsToString,
  totalArrivalTime,
} from '../../utils/numbers';
import { getPriceImpact, getPriceImpactLevel } from '../../utils/quote';
import { getTotalFeeInUsd } from '../../utils/swap';

import {
  BasicInfoOutput,
  basicInfoStyles,
  ChainImageContainer,
  Chains,
  ContainerInfoOutput,
  Content,
  EXPANDABLE_QUOTE_TRANSITION_DURATION,
  FrameIcon,
  HorizontalSeparator,
  IconContainer,
  QuoteContainer,
  stepsDetailsStyles,
  SummaryContainer,
  summaryStyles,
} from './Quote.styles';
import { QuoteSummary } from './QuoteSummary';

export function Quote(props: QuoteProps) {
  const {
    quote,
    input,
    output,
    error,
    warning,
    type,
    recommended = true,
  } = props;
  const tokens = useAppStore().tokens();
  const blockchains = useAppStore().blockchains();
  const swappers = useAppStore().swappers();

  const [expanded, setExpanded] = useState(props.expanded);
  const quoteRef = useRef<HTMLButtonElement | null>(null);
  const prevExpanded = useRef(expanded);
  const totalFee = numberToString(
    getTotalFeeInUsd(quote.result?.swaps ?? [], tokens),
    GAS_FEE_MIN_DECIMALS,
    GAS_FEE_MAX_DECIMALS
  );
  const totalTime = secondsToString(totalArrivalTime(quote.result?.swaps));
  const roundedInput = numberToString(
    input.value,
    TOKEN_AMOUNT_MIN_DECIMALS,
    TOKEN_AMOUNT_MAX_DECIMALS
  );
  const roundedOutput = numberToString(
    output.value,
    TOKEN_AMOUNT_MIN_DECIMALS,
    TOKEN_AMOUNT_MAX_DECIMALS
  );
  const roundedOutputUsdValue = output.usdValue
    ? numberToString(
        output.usdValue,
        USD_VALUE_MIN_DECIMALS,
        USD_VALUE_MAX_DECIMALS
      )
    : '';
  const priceImpact = getPriceImpact(input.usdValue, output.usdValue ?? null);
  const percentageChange = numberToString(
    priceImpact,
    PERCENTAGE_CHANGE_MIN_DECIMALS,
    PERCENTAGE_CHANGE_MAX_DECIMALS
  );
  const priceImpactWarningLevel = getPriceImpactLevel(priceImpact ?? 0);

  const getQuoteSteps = (swaps: SwapResult[]): Step[] => {
    return swaps.map((swap, index) => {
      let stepState: 'error' | 'warning' | undefined = undefined;
      const stepHasError =
        (error?.type === QuoteErrorType.BRIDGE_LIMIT &&
          error.swap.swapperId === swap.swapperId) ||
        (error?.type === QuoteErrorType.INSUFFICIENT_SLIPPAGE &&
          error.recommendedSlippages?.has(index));
      const stepHasWarning =
        warning?.type === QuoteWarningType.INSUFFICIENT_SLIPPAGE &&
        warning.recommendedSlippages?.has(index);

      if (stepHasError) {
        stepState = 'error';
      } else if (stepHasWarning) {
        stepState = 'warning';
      }

      return {
        swapper: {
          displayName: getSwapperDisplayName(swap.swapperId, swappers),
          image: swap.swapperLogo,
        },
        from: {
          token: { displayName: swap.from.symbol, image: swap.from.logo },
          chain: {
            displayName: getBlockchainShortNameFor(
              swap.from.blockchain,
              blockchains
            ),
            image: swap.from.blockchainLogo,
          },
          price: {
            value:
              index === 0
                ? numberToString(
                    input.value,
                    TOKEN_AMOUNT_MIN_DECIMALS,
                    TOKEN_AMOUNT_MAX_DECIMALS
                  )
                : numberToString(
                    swap.fromAmount,
                    TOKEN_AMOUNT_MIN_DECIMALS,
                    TOKEN_AMOUNT_MAX_DECIMALS
                  ),
            usdValue: numberToString(
              (swap.from.usdPrice ?? 0) * parseFloat(swap.fromAmount),
              USD_VALUE_MIN_DECIMALS,
              USD_VALUE_MAX_DECIMALS
            ),
            realValue: formatTooltipNumbers(
              index === 0 ? input.value : swap.fromAmount
            ),
            realUsdValue: formatTooltipNumbers(
              new BigNumber(swap.from.usdPrice ?? 0).multipliedBy(
                swap.fromAmount
              )
            ),
          },
        },
        to: {
          token: { displayName: swap.to.symbol, image: swap.to.logo },
          chain: {
            displayName: getBlockchainShortNameFor(
              swap.to.blockchain,
              blockchains
            ),
            image: swap.to.blockchainLogo,
          },
          price: {
            value: numberToString(
              swap.toAmount,
              TOKEN_AMOUNT_MIN_DECIMALS,
              TOKEN_AMOUNT_MAX_DECIMALS
            ),
            usdValue: numberToString(
              (swap.to.usdPrice ?? 0) * parseFloat(swap.toAmount),
              USD_VALUE_MIN_DECIMALS,
              USD_VALUE_MAX_DECIMALS
            ),
            realValue: formatTooltipNumbers(swap.toAmount),
            realUsdValue: formatTooltipNumbers(
              new BigNumber(swap.to.usdPrice ?? 0).multipliedBy(swap.toAmount)
            ),
          },
        },
        state: stepState,
        alerts:
          stepHasError || stepHasWarning ? (
            <FooterStepAlarm>
              <Alert
                type={stepHasError ? 'error' : 'warning'}
                title={
                  error?.type === QuoteErrorType.BRIDGE_LIMIT
                    ? error?.recommendation
                    : i18n.t('Slippage Error:')
                }
                footer={
                  <FooterAlert>
                    {error?.type === QuoteErrorType.BRIDGE_LIMIT && (
                      <>
                        <Typography
                          size="xsmall"
                          variant="body"
                          color="neutral900">
                          {error.fromAmountRangeError}
                        </Typography>
                        <Divider direction="horizontal" size={8} />
                        <Typography
                          size="xsmall"
                          variant="body"
                          color="neutral900">
                          |
                        </Typography>
                        <Divider direction="horizontal" size={8} />
                        <Typography
                          size="xsmall"
                          variant="body"
                          color="neutral900">
                          {i18n.t({
                            id: 'Yours: {amount} {symbol}',
                            values: {
                              amount: numberToString(
                                swap.fromAmount,
                                TOKEN_AMOUNT_MIN_DECIMALS,
                                TOKEN_AMOUNT_MAX_DECIMALS
                              ),
                              symbol: swap?.from.symbol,
                            },
                          })}
                        </Typography>
                      </>
                    )}
                    {(error?.type === QuoteErrorType.INSUFFICIENT_SLIPPAGE ||
                      warning?.type ===
                        QuoteWarningType.INSUFFICIENT_SLIPPAGE) && (
                      <Typography
                        size="xsmall"
                        variant="body"
                        color="neutral900">
                        {i18n.t({
                          id: 'Minimum required slippage is {minRequiredSlippage}',
                          values: {
                            ...(error?.type ===
                              QuoteErrorType.INSUFFICIENT_SLIPPAGE && {
                              minRequiredSlippage:
                                error.recommendedSlippages?.get(index),
                            }),
                            ...(warning?.type ===
                              QuoteWarningType.INSUFFICIENT_SLIPPAGE && {
                              minRequiredSlippage:
                                warning.recommendedSlippages?.get(index),
                            }),
                          },
                        })}
                      </Typography>
                    )}
                  </FooterAlert>
                }
              />
            </FooterStepAlarm>
          ) : undefined,
      };
    });
  };
  const steps = getQuoteSteps(quote.result?.swaps ?? []);
  const numberOfSteps = steps.length;
  const tooltipContainer = getContainer();

  useLayoutEffect(() => {
    if (expanded && !prevExpanded.current && quoteRef.current) {
      setTimeout(() => {
        quoteRef?.current?.scrollIntoView({ behavior: 'smooth' });
      }, EXPANDABLE_QUOTE_TRANSITION_DURATION);
    }
    prevExpanded.current = expanded;
  }, [expanded, prevExpanded]);

  return (
    <>
      <SummaryContainer
        recommended={recommended}
        listItem={type === 'list-item'}
        basic={type === 'basic'}>
        <div className={summaryStyles()}>
          <QuoteCost fee={totalFee} time={totalTime} steps={numberOfSteps} />
          {type === 'basic' && (
            <div className={basicInfoStyles()}>
              <FrameIcon>
                <InfoIcon size={12} color="gray" />
              </FrameIcon>
              <ContainerInfoOutput>
                <BasicInfoOutput size="small" variant="body">
                  {`${roundedInput} ${steps[0].from.token.displayName} = `}
                </BasicInfoOutput>
                <Tooltip
                  content={formatTooltipNumbers(output.value)}
                  container={tooltipContainer}
                  open={!output.value ? false : undefined}>
                  <BasicInfoOutput size="small" variant="body">
                    &nbsp;
                    {`${roundedOutput} ${
                      steps[steps.length - 1].to.token.displayName
                    }`}
                  </BasicInfoOutput>
                </Tooltip>
              </ContainerInfoOutput>
              <Tooltip
                content={formatTooltipNumbers(output.usdValue)}
                container={tooltipContainer}
                style={{
                  display: 'flex',
                }}>
                <Typography
                  color="$neutral600"
                  ml={2}
                  size="xsmall"
                  variant="body">
                  {`($${roundedOutputUsdValue})`}
                </Typography>
              </Tooltip>
            </div>
          )}
          {type === 'list-item' && (
            <TokenAmount
              type="output"
              direction="vertical"
              tooltipContainer={tooltipContainer}
              price={{
                value: roundedOutput,
                usdValue: roundedOutputUsdValue,
                realValue: formatTooltipNumbers(output.value),
                realUsdValue: formatTooltipNumbers(output.usdValue),
              }}
              token={{
                displayName: steps[numberOfSteps - 1].to.token.displayName,
                image: steps[numberOfSteps - 1].to.token.image,
              }}
              chain={{ image: steps[numberOfSteps - 1].to.chain.image }}
              percentageChange={percentageChange}
              warningLevel={priceImpactWarningLevel}
            />
          )}
          {type === 'swap-preview' && (
            <>
              <QuoteSummary
                from={steps[0].from}
                to={steps[numberOfSteps - 1].to}
                percentageChange={percentageChange}
                warningLevel={priceImpactWarningLevel}
              />
              <Divider size={4} />
            </>
          )}
        </div>
        <QuoteContainer
          recommended={recommended}
          open={expanded}
          onOpenChange={setExpanded}>
          <Chains
            ref={(ref) => (quoteRef.current = ref)}
            recommended={recommended}
            onClick={() => setExpanded((prevState) => !prevState)}>
            <div>
              {steps.map((step, index) => {
                const key = `item-${index}`;
                const arrow = (
                  <IconContainer>
                    <ChevronRightIcon
                      size={12}
                      color="black"
                      {...(step.state && {
                        color: step.state === 'error' ? 'error' : 'warning',
                      })}
                    />
                  </IconContainer>
                );
                return (
                  <React.Fragment key={key}>
                    <Tooltip
                      container={tooltipContainer}
                      side="bottom"
                      sideOffset={4}
                      content={step.from.chain.displayName}>
                      <ChainImageContainer
                        state={step.state || steps[index - 1]?.state}>
                        <Image src={step.from.chain.image} size={16} />
                      </ChainImageContainer>
                    </Tooltip>
                    {index === numberOfSteps - 1 && (
                      <>
                        {arrow}
                        <Tooltip
                          container={tooltipContainer}
                          side="bottom"
                          sideOffset={4}
                          content={step.to.chain.displayName}>
                          <ChainImageContainer state={step.state}>
                            <Image src={step.to.chain.image} size={16} />
                          </ChainImageContainer>
                        </Tooltip>
                      </>
                    )}
                    {index !== numberOfSteps - 1 && <>{arrow}</>}
                  </React.Fragment>
                );
              })}
            </div>
            <IconContainer orientation={expanded ? 'up' : 'down'}>
              <ChevronDownIcon size={12} color="black" />
            </IconContainer>
          </Chains>
          <Content open={expanded}>
            <HorizontalSeparator />
            <div className={stepsDetailsStyles()}>
              {steps.map((step, index) => {
                const key = `item-${index}`;
                return (
                  <StepDetails
                    type="quote-details"
                    key={key}
                    step={step}
                    hasSeparator={index !== steps.length - 1}
                    state={step.state}
                    tooltipContainer={tooltipContainer}
                  />
                );
              })}
            </div>
          </Content>
        </QuoteContainer>
      </SummaryContainer>
    </>
  );
}
