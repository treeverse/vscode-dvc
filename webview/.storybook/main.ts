import type { StorybookConfig } from '@storybook/react-webpack5'
import webpackConfig from '../webpack.config'

export const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-webpack5',
    options: { fastRefresh: true }
  },
  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
  staticDirs: ['../../extension/src/test/fixtures/plotsDiff/staticImages'],
  addons: [
    'storybook-addon-themes',
    {
      name: '@storybook/preset-scss',
      options: {
        cssLoaderOptions: {
          modules: {
            localIdentName: '[path][name]__[local]--[hash:base64:5]',
            auto: true
          }
        }
      }
    }
  ],
  typescript: {
    reactDocgen: false
  },
  webpackFinal: config => {
    return {
      ...config,
      module: webpackConfig.module,
      mode: 'development',
      resolve: {
        ...config.resolve,
        alias: {
          ...config.resolve?.alias,
          ...webpackConfig.resolve.alias
        }
      }
    }
  }
}

export default config
