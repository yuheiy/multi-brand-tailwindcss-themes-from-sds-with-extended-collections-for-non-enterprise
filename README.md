# Simple Design System with Extended Collections to Tailwind CSS

A reference implementation for transforming Figma design tokens into Tailwind CSS v4 themes using [TokensBrücke](https://www.figma.com/community/plugin/1254538877056388290/tokensbrucke) and [Style Dictionary](https://styledictionary.com/).

## Overview

This project demonstrates how to:

- Export Figma variables and styles as design tokens
- Transform Figma's token structure to Tailwind's theme format
- Generate CSS variables compatible with Tailwind CSS v4
- Handle Figma modes (Light/Dark, size variants)
- Support multiple themes via Figma's Extended Collections

Based on [Simple Design System with Extended Collections](https://www.figma.com/community/file/1575803530898880325).

## Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BUILD PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Figma                                                                     │
│     │                                                                       │
│     │  Export via TokensBrücke                                              │
│     ▼                                                                       │
│   scripts/figma.tokens.json                                                 │
│     │                                                                       │
│     │  Transform via build-tailwind-tokens.ts                               │
│     │    • Map Figma structure → Tailwind theme keys                        │
│     │    • Rewrite token references                                         │
│     │    • Embed mode switching (light-dark(), CSS variables)               │
│     ▼                                                                       │
│   packages/themes/*/tokens/theme.tokens.json                                │
│   packages/ui/tokens/typography.tokens.json                                 │
│     │                                                                       │
│     │  Generate via Style Dictionary                                        │
│     │    • CSS variables in @theme blocks                                   │
│     │    • Typography utilities with @utility                               │
│     │    • tailwind-merge configuration                                     │
│     ▼                                                                       │
│   packages/themes/*/theme.generated.css                                     │
│   packages/ui/typography.generated.css                                      │
│   packages/ui/src/tailwind-merge-config.json                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

**Prerequisites:** Node.js 24+, pnpm 10+

```bash
# Install dependencies
pnpm install

# Build tokens and packages
pnpm build

# Start development server
pnpm dev
```

| Command         | Description                                 |
| --------------- | ------------------------------------------- |
| `pnpm build`    | Transform tokens → Generate CSS → Build all |
| `pnpm build:sd` | Transform and generate tokens only          |
| `pnpm dev`      | Start development server                    |

## Project Structure

```
sds-with-extended-collections-to-tailwindcss/
├── scripts/
│   ├── figma.tokens.json           # TokensBrücke export (input)
│   └── build-tailwind-tokens.ts    # Token transformation logic
├── packages/
│   ├── themes/
│   │   └── default/
│   │       ├── tokens/
│   │       │   └── theme.tokens.json   # (generated)
│   │       ├── theme.generated.css     # (generated)
│   │       ├── index.css               # Theme entry point
│   │       └── package.json
│   └── ui/
│       ├── tokens/
│       │   └── typography.tokens.json  # (generated)
│       ├── typography.generated.css    # (generated)
│       ├── index.css
│       └── src/
├── apps/
│   └── web/                        # Demo application
├── sd.config.ts                    # Style Dictionary configuration
└── package.json
```

## How It Works

### 1. Token Export (Figma → JSON)

Use [TokensBrücke](https://www.figma.com/community/plugin/1254538877056388290/tokensbrucke) to export Figma variables and styles:

**Required settings:**

- Enable **Typography-styles**
- Enable **Effect-styles**
- Enable **Use DTCG keys format**

The export creates `scripts/figma.tokens.json` with this structure:

```json
{
  "Color Primitives": {
    "Slate": {
      "100": { "$type": "color", "$value": "#f3f3f3" }
    }
  },
  "Theme": {
    "Background": {
      "Primary": {
        "$type": "color",
        "$value": "#ffffff",
        "$extensions": {
          "mode": { "Light": "#ffffff", "Dark": "#1a1a1a" }
        }
      }
    }
  },
  "Typography-styles": { ... },
  "Effect-styles": { ... }
}
```

### 2. Token Transformation (JSON → Tailwind-compatible JSON)

`scripts/build-tailwind-tokens.ts` restructures tokens for Tailwind:

**Mapping Figma structure to Tailwind theme keys:**

| Figma Path                | Tailwind Theme Key   |
| ------------------------- | -------------------- |
| `Theme.Background.*`      | `background-color.*` |
| `Theme.Text.*`            | `text-color.*`       |
| `Theme.Icon.*`            | `text-color.icon.*`  |
| `Theme.Border.*`          | `border-color.*`     |
| `Color Primitives.*`      | `color.*`            |
| `Size.Space.*`            | `spacing.*`          |
| `Size.Radius.*`           | `radius.*`           |
| `Typography Primitives.*` | `font.*`, `text.*`   |
| `Effect-styles.*`         | `shadow.*`           |

**Reference rewriting:**

Token references are rewritten to match the new structure:

```
{Theme.Primary.Font Family} → {font.Primary}
{Color Primitives.Slate.500} → {color.Slate.500}
{Typography Primitives.Scale.Scale 14} → {text.14}
```

**Mode embedding:**

Tokens with modes are transformed into CSS-compatible values:

```typescript
// Light/Dark modes → light-dark() function
{ "Light": "#fff", "Dark": "#000" }
// becomes:
"light-dark(#fff, #000)"

// Size modes → CSS variable toggle (space toggle hack)
{ "Base": "16px", "Compact": "12px", "Comfortable": "20px" }
// becomes:
"var(--is-size-base, 16px) var(--is-size-compact, 12px) var(--is-size-comfortable, 20px)"
```

### 3. CSS Generation (JSON → CSS)

Style Dictionary (`sd.config.ts`) generates the final CSS:

**Theme CSS** (`theme.generated.css`):

<!-- prettier-ignore -->
```css
@theme {
  --color-slate-100: #f3f3f3;
  --color-slate-200: #e3e3e3;

  --background-color-default-default: light-dark(var(--color-white-1000), var(--color-gray-900));
  --background-color-default-secondary: light-dark(var(--color-gray-100), var(--color-gray-800));
  --background-color-default-tertiary: light-dark(var(--color-gray-300), var(--color-gray-600));

  --text-color-default-default: light-dark(var(--color-gray-900), var(--color-white-1000));
  --text-color-default-secondary: light-dark(var(--color-gray-500), var(--color-white-500));
  --text-color-default-tertiary: light-dark(var(--color-gray-400), var(--color-white-400));

  --spacing-100: var(--is-size-base, 4px) var(--is-size-compact, 2px) var(--is-size-comfortable, 8px);
  --radius-200: var(--is-size-base, 8px) var(--is-size-compact, 6px) var(--is-size-comfortable, 12px);
}
```

**Typography CSS** (`typography.generated.css`):

<!-- prettier-ignore -->
```css
@utility typography-title-hero {
  font-family: var(--font-title-hero);
  font-size: var(--text-title-hero);
  line-height: var(--leading-title-hero);
  font-weight: 700;
  letter-spacing: var(--tracking-title-hero);
}

@utility typography-body-base {
  font-family: var(--font-body);
  font-size: var(--text-body);
  line-height: var(--leading-body);
  font-weight: 400;
  letter-spacing: var(--tracking-body);
}
```

## Customization Guide

### Using Your Own Tokens

1. **Export your Figma tokens** using TokensBrücke with the required settings
2. **Replace** `scripts/figma.tokens.json` with your export
3. **Update** `scripts/build-tailwind-tokens.ts` to match your token structure

### Token Mapping

Modify the mapping in `build-tailwind-tokens.ts` to match your Figma organization:

```typescript
const themeTokens = {
  // Map your Figma collections to Tailwind theme keys
  'background-color': {
    ...omit(themeGroup.Background, ['Utilities']),
  },

  'text-color': {
    ...omit(themeGroup.Text, ['Utilities']),
    icon: omit(themeGroup.Icon, ['Utilities']),
  },

  // Add your own mappings
  'accent-color': {
    ...themeGroup.Accent,
  },
};
```

### Reference Rewriting

Add rules for your token paths in the `rewriteReferences` function:

```typescript
function rewriteReferences(value: string) {
  return (
    value
      .replaceAll(/{Theme\.(.+)\.Font Family( .+)?}/g, '{font.$1$2}')
      .replaceAll(/{Color Primitives\./g, '{color.')
      // Add your own rules
      .replaceAll(/{YourCollection\./g, '{your-theme-key.')
  );
}
```

### Mode Handling

**Light/Dark modes** use the CSS `light-dark()` function:

```typescript
// In build-tailwind-tokens.ts
case 'Light' in mode && 'Dark' in mode: {
  token.$value = `light-dark(${mode.Light}, ${mode.Dark})`;
  break;
}
```

Enable dark mode in your application:

```css
:root {
  color-scheme: light dark;
}
```

**Size modes** use the [space toggle hack](https://lea.verou.me/blog/2020/10/the-var-space-hack-to-toggle-multiple-values-with-one-custom-property/):

```css
/* Enable Base size (default) */
:root {
  --is-size-base: ;
  --is-size-compact: initial;
  --is-size-comfortable: initial;
}

/* Switch to Compact */
:root[data-size='compact'] {
  --is-size-base: initial;
  --is-size-compact: ;
  --is-size-comfortable: initial;
}
```

### Multiple Themes (Extended Collections)

Figma's Extended Collections allow multiple theme variants. TokensBrücke exports each mode as a separate group:

```json
{
  "Theme": {
    /* Brand #1 (default) */
  },
  "Brand #2": {
    /* Brand #2 tokens */
  },
  "Brand #3": {
    /* Brand #3 tokens */
  }
}
```

**1. Update `build-tailwind-tokens.ts`:**

```typescript
const themeTokensEntries = Object.entries({
  default: figmaTokens.Theme,
  'brand-2': figmaTokens['Brand #2'],
  'brand-3': figmaTokens['Brand #3'],
}).map(([key, themeGroup]) => {
  // ... mapping logic
  return [`./packages/themes/${key}/tokens/theme.tokens.json`, themeTokens] as const;
});
```

**2. Update `sd.config.ts`:**

```typescript
['default', 'brand-2', 'brand-3'].map((themeKey) => [
  `theme/${themeKey}`,
  {
    // ... configuration
    files: [
      {
        destination: `./packages/themes/${themeKey}/theme.generated.css`,
        // ...
      },
    ],
  },
]);
```

**3. Create theme directories:**

```
packages/themes/
├── default/
│   ├── tokens/theme.tokens.json
│   ├── theme.generated.css
│   ├── index.css
│   └── package.json
├── brand-2/
│   └── ...
└── brand-3/
    └── ...
```

## Integration

### Application Setup

Import Tailwind CSS with your theme:

```css
/* apps/web/src/index.css */
@import 'tailwindcss';
@import '@acme/ui/index.css';
@import '@acme/theme-default/index.css';
@source '../node_modules/@acme/ui';
```

### Using Tokens

Use the generated Tailwind utilities in your HTML/JSX:

```html
<div class="bg-brand-default p-400 text-brand-on-brand">
  <h1 class="typography-title-hero">Hello World</h1>
</div>
```

### Switching Themes

Import a different theme package:

```diff
 /* apps/web/src/index.css */
 @import 'tailwindcss';
 @import '@acme/ui/index.css';
-@import '@acme/theme-default/index.css';
+@import '@acme/theme-brand-2/index.css';
 @source '../node_modules/@acme/ui';
```

## Background

### Why Transform Tokens?

Figma organizes tokens semantically (e.g., `Theme.Background.Primary`), while Tailwind organizes by utility (e.g., `background-color`). This structural mismatch requires transformation regardless of your Figma organization.

### Why TokensBrücke?

TokensBrücke uniquely:

- Exports both variables and styles as tokens in one operation
- Preserves mode values in token properties (Light/Dark, size variants)

### Why This Implementation?

The [Simple Design System](https://github.com/figma/sds) wasn't designed for Tailwind CSS. This project bridges that gap, showing how to:

- Transform Figma's structure to Tailwind's requirements
- Handle Extended Collections for multi-brand systems
- Preserve mode information through the transformation
- Generate production-ready Tailwind CSS v4 themes
