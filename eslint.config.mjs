export default [
  {
    // Only lint our custom assets — Dawn's stock files have their own conventions
    files: ['assets/cart-upsell.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        // Browser
        HTMLElement: 'readonly',
        AbortController: 'readonly',
        URL: 'readonly',
        document: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        customElements: 'readonly',
        Intl: 'readonly',
        // Shopify / Dawn (defined in theme.liquid and global.js)
        Shopify: 'readonly',
        routes: 'readonly',
        subscribe: 'readonly',
        publish: 'readonly',
        PUB_SUB_EVENTS: 'readonly',
        fetchConfig: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-undef': 'error',
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
];
