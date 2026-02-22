import { kebabCase } from 'es-toolkit';
import StyleDictionary, { type Config } from 'style-dictionary';
import { formats, transforms } from 'style-dictionary/enums';
import type { PreprocessedTokens } from 'style-dictionary/types';
import { fileHeader } from 'style-dictionary/utils';
import type { ConfigExtension, DefaultClassGroupIds, DefaultThemeGroupIds } from 'tailwind-merge';

const themes: Record<string, [lightModeKey: string, darkModeKey: string]> = {
  default: ['Light', 'Dark'],
  'brand-2': ['Brand #2 - Light', 'Brand #2 - Dark'],
  'brand-3': ['Brand #3 - Light', 'Brand #3 - Dark'],
};

function resolveModes(
  tokens: Record<string, unknown>,
  modeKeys: [light: string, dark: string],
): Record<string, unknown> {
  const [lightModeKey, darkModeKey] = modeKeys;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(tokens)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      result[key] = value;
      continue;
    }

    const obj = value as Record<string, unknown>;

    if (
      '$value' in obj &&
      '$extensions' in obj &&
      typeof obj.$extensions === 'object' &&
      obj.$extensions !== null &&
      'mode' in obj.$extensions
    ) {
      const mode = (obj.$extensions as { mode: Record<string, unknown> }).mode;

      if (lightModeKey in mode && darkModeKey in mode) {
        if (mode[lightModeKey] === mode[darkModeKey]) {
          result[key] = obj;
        } else {
          const $value =
            obj.$type === 'color'
              ? `light-dark(${mode[lightModeKey]}, ${mode[darkModeKey]})`
              : `var(--is-light, ${mode[lightModeKey]}) var(--is-dark, ${mode[darkModeKey]})`;
          result[key] = { ...obj, $value };
        }
        continue;
      }

      if ('Base' in mode && 'Compact' in mode && 'Comfortable' in mode) {
        if (mode.Base === mode.Compact && mode.Compact === mode.Comfortable) {
          result[key] = obj;
        } else {
          const $value = `var(--is-size-base, ${mode.Base}) var(--is-size-compact, ${mode.Compact}) var(--is-size-comfortable, ${mode.Comfortable})`;
          result[key] = { ...obj, $value };
        }
        continue;
      }
    }

    result[key] = resolveModes(obj, modeKeys);
  }

  return result;
}

for (const [key, modeKeys] of Object.entries(themes)) {
  StyleDictionary.registerPreprocessor({
    name: `custom/mode-${key}`,
    preprocessor: (dictionary) => resolveModes(dictionary, modeKeys) as PreprocessedTokens,
  });
}

StyleDictionary.registerFormat({
  name: 'custom/typography',
  format: async ({ dictionary }) => {
    const header = await fileHeader({});

    const nestInSelector = (content: string, selector: string) => {
      return `${selector} {\n` + content + `\n}`;
    };

    const content = dictionary.allTokens
      .map((token) => {
        const declarations: [string, string][] = [];
        const tokenValue = token.original.$value;

        for (const [property, value] of [
          ['font-family', tokenValue.fontFamily],
          ['font-size', tokenValue.fontSize],
          ['line-height', tokenValue.lineHeight],
          ['font-weight', String(tokenValue.fontWeight)],
          ['letter-spacing', tokenValue.letterSpacing],
          [
            'text-transform',
            {
              ORIGINAL: 'none',
              UPPER: 'uppercase',
              LOWER: 'lowercase',
              TITLE: 'none',
            }[tokenValue.textCase as never],
          ],
          ['font-style', tokenValue.fontStyle],
          [
            'text-decoration',
            {
              NONE: 'none',
              UNDERLINE: 'underline',
              STRIKETHROUGH: 'line-through',
            }[tokenValue.textDecoration as never],
          ],
        ]) {
          if (typeof value === 'string') {
            declarations.push([
              property,
              value.includes('{') ? `var(--${kebabCase(value)})` : value,
            ]);
          }
        }

        return nestInSelector(
          declarations.map(([property, value]) => `  ${property}: ${value};`).join('\n'),
          `@utility ${token.name}`,
        );
      })
      .join('\n\n');

    return header + content + '\n';
  },
});

StyleDictionary.registerFormat({
  name: 'custom/tailwind-merge',
  format: async ({ dictionary }) => {
    const config = {
      override: {
        theme: {
          leading: ['none'],
        } as Record<DefaultThemeGroupIds, string[]>,
      },
      extend: {
        theme: {} as Record<DefaultThemeGroupIds, string[]>,
      },
    } satisfies ConfigExtension<DefaultClassGroupIds, DefaultThemeGroupIds>;

    for (const token of dictionary.allTokens) {
      const themeKey = token.path.at(0);
      const name = kebabCase(token.path.slice(1).join(' '));

      switch (themeKey) {
        case 'blur':
        case 'drop-shadow':
        case 'font-weight':
        case 'inset-shadow':
        case 'leading':
        case 'radius':
        case 'shadow':
        case 'text':
        case 'tracking': {
          (config.override.theme[themeKey] ??= []).push(name);
          break;
        }

        case 'spacing': {
          (config.extend.theme[themeKey] ??= []).push(name);
          break;
        }
      }
    }

    return JSON.stringify(config, null, 2) + '\n';
  },
});

const config: Config = {
  source: ['./packages/ui/tokens/*.tokens.json'],
  platforms: {
    ...Object.fromEntries(
      Object.keys(themes).map((key) => [
        `theme/${key}`,
        {
          preprocessors: [`custom/mode-${key}`],
          transforms: [
            transforms.nameKebab,
            transforms.fontFamilyCss,
            transforms.shadowCssShorthand,
          ],
          files: [
            {
              destination: `./packages/themes/${key}/theme.generated.css`,
              format: formats.cssVariables,
              filter: ({ filePath }) => filePath === 'packages/ui/tokens/theme.tokens.json',
            },
          ],
          options: {
            selector: ['@theme'],
            outputReferences: true,
          },
        },
      ]),
    ),
    typography: {
      transforms: [transforms.nameKebab, transforms.fontFamilyCss],
      files: [
        {
          destination: './packages/ui/typography.generated.css',
          format: 'custom/typography',
          filter: ({ filePath }) => filePath === 'packages/ui/tokens/typography.tokens.json',
        },
      ],
    },
    tailwindMerge: {
      transforms: [transforms.nameKebab],
      files: [
        {
          destination: './packages/ui/src/tailwind-merge-config.json',
          format: 'custom/tailwind-merge',
          filter: ({ filePath }) => filePath === 'packages/ui/tokens/theme.tokens.json',
        },
      ],
    },
  },
};

export default config;
