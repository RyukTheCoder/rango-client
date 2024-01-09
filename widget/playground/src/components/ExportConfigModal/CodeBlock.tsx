import type { CodeBlockProps } from './CodeBlock.types';

import { CopyIcon, DoneIcon, Tooltip, useCopyToClipboard } from '@rango-dev/ui';
import React from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  javascript,
  jsx,
} from 'react-syntax-highlighter/dist/esm/languages/prism';

import {
  CodeBlockContainer,
  CopyCodeBlock,
  CopyCodeBlockButton,
  CopyCodeBlockButtonDoneIcon,
  CopyCodeBlockButtonIcon,
} from './CodeBlock.styles';

const RESET_INTERVAL = 2_000;

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('jsx', jsx);

export function CodeBlock(props: CodeBlockProps) {
  const { language, theme, children } = props;

  const [isCopied, handleCopy] = useCopyToClipboard(RESET_INTERVAL);

  return (
    <Tooltip
      side="bottom"
      open={isCopied}
      content={<span> Code Copied! </span>}>
      <CodeBlockContainer>
        <CopyCodeBlock>
          <Tooltip content="Copy to clipboard" side="top">
            <CopyCodeBlockButton
              type="primary"
              onClick={() => {
                handleCopy(children);
              }}>
              <CopyCodeBlockButtonDoneIcon visible={isCopied}>
                <DoneIcon size={24} />
              </CopyCodeBlockButtonDoneIcon>
              <CopyCodeBlockButtonIcon visible={!isCopied}>
                <CopyIcon size={24} />
              </CopyCodeBlockButtonIcon>
            </CopyCodeBlockButton>
          </Tooltip>
        </CopyCodeBlock>
        <SyntaxHighlighter
          showLineNumbers
          language={language}
          customStyle={{ height: '100%', borderRadius: '15px' }}
          style={theme}>
          {children}
        </SyntaxHighlighter>
      </CodeBlockContainer>
    </Tooltip>
  );
}
