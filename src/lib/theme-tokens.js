/**
 * Canonical list of themeable CSS custom properties.
 * Structural tokens (--radius, --gap) are intentionally excluded —
 * they are constant across all themes.
 */

export const THEME_TOKEN_GROUPS = [
  {
    label: 'Surfaces',
    tokens: [
      { key: '--bg',           label: 'Page Background'      },
      { key: '--bg-panel',     label: 'Panel Background'     },
      { key: '--bg-item',      label: 'Item / Hover'         },
      { key: '--bg-selected',  label: 'Selected'             },
      { key: '--border',       label: 'Border'               },
    ],
  },
  {
    label: 'Text',
    tokens: [
      { key: '--text',         label: 'Primary Text'         },
      { key: '--text-dim',     label: 'Secondary Text'       },
      { key: '--accent',       label: 'Accent'               },
      { key: '--accent-dim',   label: 'Accent Muted'         },
      { key: '--code',         label: 'Code / Mono'          },
    ],
  },
  {
    label: 'Status',
    tokens: [
      { key: '--green',        label: 'Positive'             },
      { key: '--amber',        label: 'Warning'              },
      { key: '--red',          label: 'Negative'             },
    ],
  },
  {
    label: 'Error Surface',
    tokens: [
      { key: '--surface-error', label: 'Error Banner Background' },
      { key: '--text-error',    label: 'Error Banner Text'       },
    ],
  },
]

export const THEME_TOKENS = THEME_TOKEN_GROUPS.flatMap(g => g.tokens)
