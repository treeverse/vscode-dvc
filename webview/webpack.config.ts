import { resolve } from 'path'
import type { Configuration as DevServerConfiguration } from 'webpack-dev-server'
import { CleanWebpackPlugin } from 'clean-webpack-plugin'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'

const r = (file: string) => resolve(__dirname, file)

const styleLoader = 'style-loader'
const cssLoader = 'css-loader'

const devServer: DevServerConfiguration = {
  allowedHosts: 'all',
  headers: {
    'Access-Control-Allow-Headers':
      'X-Requested-With, content-type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Origin': '*'
  },
  hot: false,
  liveReload: true
}

export default {
  devServer,
  devtool: 'source-map',
  entry: {
    experiments: { dependOn: 'react', import: r('src/experiments/index.tsx') },
    plots: { dependOn: 'react', import: r('src/plots/index.tsx') },
    react: ['react', 'react-dom'],
    setup: {
      dependOn: 'react',
      import: r('src/setup/index.tsx')
    }
  },
  module: {
    rules: [
      {
        test: /\.py$/i,
        use: 'raw-loader'
      },
      {
        test: /\.svg$/,
        type: 'asset/inline'
      },
      {
        test: /\.less$/,
        use: [
          { loader: styleLoader },
          { loader: cssLoader },
          { loader: 'less-loader' }
        ]
      },
      {
        test: /\.css$/,
        use: [
          { loader: styleLoader },
          {
            loader: cssLoader,
            options: {
              modules: { auto: true }
            }
          }
        ]
      },
      {
        test: /\.scss$/,
        use: [
          { loader: styleLoader },
          {
            loader: cssLoader,
            options: {
              modules: {
                auto: true,
                localIdentName: '[local]--[hash:base64]'
              }
            }
          },
          { loader: 'sass-loader' }
        ]
      },
      {
        loader: 'file-loader',
        test: /\.(jpe?g|png|gif|eot|woff|woff2|md)$/i
      },
      {
        loader: 'ts-loader',
        options: { transpileOnly: true },
        test: /\.tsx?$/
      }
    ]
  },
  output: {
    chunkFilename: '[name]-[hash].js',
    devtoolModuleFilenameTemplate: (info: { absoluteResourcePath: string }) => {
      let result = info.absoluteResourcePath.replace(/\\/g, '/')
      if (!result.startsWith('file:')) {
        // Some paths already start with the file scheme.
        result = `file:///${result}`
      }
      return result
    },
    filename: '[name].js',
    path: r('dist')
  },
  plugins: (() => {
    return [new ForkTsCheckerWebpackPlugin(), new CleanWebpackPlugin()]
  })(),
  resolve: {
    alias: {
      dvc: r('../extension')
    },
    extensions: ['.webpack.js', '.web.js', '.ts', '.tsx', '.js'],
    fallback: { fs: false }
  }
}
