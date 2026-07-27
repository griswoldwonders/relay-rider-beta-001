import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type MaterialElementProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  disabled?: boolean;
  href?: string;
  selected?: boolean;
  target?: string;
  trailingIcon?: boolean;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-filled-button': MaterialElementProps;
      'md-outlined-button': MaterialElementProps;
      'md-filter-chip': MaterialElementProps;
      'md-assist-chip': MaterialElementProps;
    }
  }
}

export {};
