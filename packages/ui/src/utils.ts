import { extendTailwindMerge } from 'tailwind-merge';
import { createTV } from 'tailwind-variants';

import twMergeConfig from './tailwind-merge-config.json';

export const twMerge = extendTailwindMerge(twMergeConfig);

export const tv = createTV({ twMergeConfig });
