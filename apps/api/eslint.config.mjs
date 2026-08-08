import nestConfig from '@imix/config/eslint/nest';

const eslintConfig = [
  ...nestConfig,
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**'],
  },
];

export default eslintConfig;
