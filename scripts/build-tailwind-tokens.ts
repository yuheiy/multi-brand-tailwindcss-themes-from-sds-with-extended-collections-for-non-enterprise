import fs from 'node:fs/promises';
import path from 'node:path';

import { omit } from 'es-toolkit';
import mapObject, { mapObjectSkip } from 'map-obj';

import designTokens from './design.tokens.json' with { type: 'json' };

function isObject(value: unknown) {
  return typeof value === 'object' && value !== null;
}

function isToken(value: unknown) {
  return isObject(value) && '$value' in value;
}

type ExtractToken<T> = T extends { $value: unknown }
  ? T
  : T extends Record<string, unknown>
    ? { [K in keyof T]: ExtractToken<T[K]> }[keyof T]
    : never;

function mapTokens<T extends Record<string, unknown>>(
  source: T,
  mapper: (key: string, value: ExtractToken<T>) => [string, unknown] | typeof mapObjectSkip,
) {
  const clone = structuredClone(source);

  return mapObject(
    clone,
    (key, value) => {
      if (isToken(value)) {
        const mapResult = mapper(key, value as ExtractToken<T>);

        if (mapResult === mapObjectSkip) {
          return mapObjectSkip;
        }

        const [newKey, newValue] = mapResult;

        return [newKey, newValue, { shouldRecurse: false }];
      }

      return [key, value];
    },
    { deep: true },
  );
}

const basePxFontSize = 16;

function pxToRem(token: ExtractToken<typeof designTokens>) {
  if (typeof token.$value === 'string' && !token.$value.includes('{')) {
    token.$value = `${parseFloat(token.$value) / basePxFontSize}rem`;
  }

  if ('$extensions' in token && 'mode' in token.$extensions) {
    token.$extensions.mode = mapObject(token.$extensions.mode, (key, value: string) => {
      if (!value.includes('{')) {
        value = `${parseFloat(value) / basePxFontSize}rem`;
      }

      return [key, value];
    });
  }

  return token;
}

const typographyTheme = omit(designTokens.Theme, ['Background', 'Text', 'Icon', 'Border']);

function extractTypographyTokensWithPrefix(prefix: string) {
  const result: Record<string, ExtractToken<typeof typographyTheme>> = {};

  for (const [groupKey, group] of Object.entries(typographyTheme)) {
    for (const [tokenKey, token] of Object.entries(group)) {
      if (tokenKey.startsWith(prefix)) {
        result[`${groupKey}${tokenKey.replace(prefix, '')}`] = token;
      }
    }
  }

  return result;
}

const themeTokens = {
  color: {
    ...designTokens['Color Primitives'],
  },

  'background-color': {
    ...omit(designTokens.Theme.Background, ['Utilities']),
  },

  'text-color': {
    ...omit(designTokens.Theme.Text, ['Utilities']),
    icon: omit(designTokens.Theme.Icon, ['Utilities']),
  },

  'border-color': {
    ...omit(designTokens.Theme.Border, ['Utilities']),
  },

  'ring-color': {
    ...omit(designTokens.Theme.Border, ['Utilities']),
  },

  spacing: {
    ...mapTokens(
      {
        ...designTokens.Size.Space,
        Icon: designTokens.Size.Icon,
      },
      (key, token) => [key, pxToRem(token)],
    ),
  },

  font: {
    ...mapTokens(omit(designTokens['Typography Primitives'], ['Weight', 'Scale']), (key, token) => {
      token.$type = 'fontFamily';

      switch (key) {
        case 'Family Sans': {
          // @ts-expect-error
          token.$value = [token.$value, 'sans-serif'];
          break;
        }
        case 'Family Serif': {
          // @ts-expect-error
          token.$value = [token.$value, 'serif'];
          break;
        }
        case 'Family Mono': {
          // @ts-expect-error
          token.$value = [token.$value, 'monospace'];
          break;
        }
      }

      return [key.replace(/^Family /, ''), token];
    }),

    ...extractTypographyTokensWithPrefix('Font Family'),
  },

  text: mapTokens(
    {
      ...mapTokens(designTokens['Typography Primitives'].Scale, (key, token) => [
        key.replace(/Scale /, ''),
        token,
      ]),

      ...extractTypographyTokensWithPrefix('Font Size'),
    },
    (key, token) => [key, pxToRem(token)],
  ),

  'font-weight': {
    ...mapTokens(designTokens['Typography Primitives'].Weight, (key, token) => {
      if (key.endsWith(' Italic')) {
        return mapObjectSkip;
      }

      return [key.replace(/^Weight /, ''), token];
    }),

    ...extractTypographyTokensWithPrefix('Font Weight'),
  },

  tracking: mapTokens(
    {
      ...extractTypographyTokensWithPrefix('Letter Spacing'),
    },
    (key, token) => [key, pxToRem(token)],
  ),

  leading: mapTokens(
    {
      ...extractTypographyTokensWithPrefix('Line Height'),
    },
    (key, token) => [key, pxToRem(token)],
  ),

  radius: {
    ...designTokens.Size.Radius,
  },

  depth: {
    ...designTokens.Size.Depth,
  },

  shadow: {
    ...designTokens['Effect-styles']['Drop Shadow'],
  },

  'inset-shadow': {
    ...designTokens['Effect-styles']['Inner Shadow'],
  },

  blur: {
    ...designTokens['Size']['Blur'],
  },

  'default-border-width': designTokens.Size.Stroke['Border'],
  'default-ring-width': designTokens.Size.Stroke['Focus Ring'],
};

const typographyTokens = {
  typography: omit(designTokens['Typography-styles'], ['.Utilities']),
};

const tailwindTokensFiles = new Map<string, Record<string, unknown>>([
  ['./packages/ui/tokens/theme.tokens.json', themeTokens],
  ['./packages/ui/tokens/typography.tokens.json', typographyTokens],
]);

function rewriteReferences(value: string) {
  // prettier-ignore
  return value
    .replaceAll(/{Theme\.(.+)\.Font Family( .+)?}/g, '{font.$1$2}')
    .replaceAll(/{Theme\.(.+)\.Font Size( .+)?}/g, '{text.$1$2}')
    .replaceAll(/{Theme\.(.+)\.Letter Spacing( .+)?}/g, '{tracking.$1$2}')
    .replaceAll(/{Theme\.(.+)\.Line Height( .+)?}/g, '{leading.$1$2}')
    .replaceAll(/{Size\.Depth\./g, '{depth.')
    .replaceAll(/{Color Primitives\./g, '{color.')
    .replaceAll(/{Typography Primitives\.Scale\.Scale /g, '{text.')
    .replaceAll(/{Typography Primitives\.Weight\.Weight /g, '{font-weight.')
    .replaceAll(/{Typography Primitives\.(.+)\.Family /g, '{font.$1.')
  ;
}

function rewriteReferencesInObject<T extends Record<string, unknown>>(object: T): T {
  return mapObject(
    object,
    (key, value) => {
      if (typeof value === 'string' && value.includes('{')) {
        value = rewriteReferences(value);
      }

      return [key, value];
    },
    { deep: true },
  ) as T;
}

function rewriteReferencesInToken(token: ExtractToken<typeof designTokens>) {
  if (typeof token.$value === 'object') {
    token.$value = Array.isArray(token.$value)
      ? token.$value.map((element) =>
          isObject(element) ? rewriteReferencesInObject(element) : element,
        )
      : rewriteReferencesInObject(token.$value);
  } else if (typeof token.$value === 'string' && token.$value.includes('{')) {
    token.$value = rewriteReferences(token.$value);
  }

  if ('$extensions' in token && 'mode' in token.$extensions) {
    token.$extensions.mode = rewriteReferencesInObject(token.$extensions.mode);
  }
}

async function outputTokens(file: string, tokens: Record<string, unknown>) {
  const dir = path.dirname(file);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(tokens, null, 2) + '\n');
}

for (const [file, tokens] of tailwindTokensFiles) {
  const transformedTokens = mapTokens(tokens, (key, token) => {
    rewriteReferencesInToken(token);
    return [key, token];
  });

  await outputTokens(file, transformedTokens);
}
