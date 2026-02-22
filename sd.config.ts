import { kebabCase } from 'es-toolkit';
import StyleDictionary, { type Config } from 'style-dictionary';
import { formats, transforms, transformTypes } from 'style-dictionary/enums';
import type { PreprocessedTokens } from 'style-dictionary/types';
import { fileHeader } from 'style-dictionary/utils';
import type { ConfigExtension, DefaultClassGroupIds, DefaultThemeGroupIds } from 'tailwind-merge';

function resolveModes(tokens: Record<string, unknown>): Record<string, unknown> {
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

      if ('Light' in mode && 'Dark' in mode) {
        if (mode.Light !== mode.Dark) {
          const $value =
            obj.$type === 'color'
              ? `light-dark(${mode.Light}, ${mode.Dark})`
              : `var(--is-light, ${mode.Light}) var(--is-dark, ${mode.Dark})`;
          result[key] = { ...obj, $value };
        } else {
          result[key] = obj;
        }
        continue;
      }

      if ('Base' in mode && 'Compact' in mode && 'Comfortable' in mode) {
        if (!(mode.Base === mode.Compact && mode.Compact === mode.Comfortable)) {
          const $value = `var(--is-size-base, ${mode.Base}) var(--is-size-compact, ${mode.Compact}) var(--is-size-comfortable, ${mode.Comfortable})`;
          result[key] = { ...obj, $value };
        } else {
          result[key] = obj;
        }
        continue;
      }
    }

    result[key] = resolveModes(obj);
  }

  return result;
}

StyleDictionary.registerPreprocessor({
  name: 'custom/resolve-modes',
  preprocessor: (dictionary) => resolveModes(dictionary) as PreprocessedTokens,
});

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
  source: ['./packages/ui/tokens/*.tokens.json', './packages/themes/*/tokens/*.tokens.json'],
  preprocessors: ['custom/resolve-modes'],
  platforms: {
    ...Object.fromEntries(
      [
        'default',
        // 'brand-1',
        // 'brand-2',
      ].map((themeKey) => [
        `theme/${themeKey}`,
        {
          transforms: [
            transforms.nameKebab,
            transforms.fontFamilyCss,
            transforms.shadowCssShorthand,
          ],
          files: [
            {
              destination: `./packages/themes/${themeKey}/theme.generated.css`,
              format: formats.cssVariables,
              filter: ({ filePath }) =>
                filePath === `packages/themes/${themeKey}/tokens/theme.tokens.json`,
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
          filter: ({ filePath }) => filePath === 'packages/themes/default/tokens/theme.tokens.json',
        },
      ],
    },
  },
};

export default config;
