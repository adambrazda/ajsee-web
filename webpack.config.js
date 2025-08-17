// webpack.config.js
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const sass = require('sass'); // Dart Sass

module.exports = {
  entry: './src/main.js', // uprav dle potřeby

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/', // pro dev server/asset cesty
  },

  module: {
    rules: [
      {
        test: /\.scss$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: true,
            },
          },
          {
            loader: 'sass-loader',
            options: {
              // používá Dart Sass (@use/@forward)
              implementation: sass,
              sourceMap: true,
              additionalData: `
                @use "@styles/utils/variables" as *;
                @use "@styles/utils/mixins" as *;
              `,
              sassOptions: {
                // lze přidat vlastní includePaths, pokud chceš
                includePaths: [path.resolve(__dirname, 'src/styles')],
              },
            },
          },
        ],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            presets: [['@babel/preset-env', { targets: 'defaults' }]],
          },
        }],
      },
      // (volitelné) assets
      {
        test: /\.(png|jpe?g|gif|svg|webp)$/i,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
        generator: { filename: 'assets/img/[name][hash][ext]' },
      },
      {
        test: /\.(woff2?|ttf|otf|eot)$/,
        type: 'asset/resource',
        generator: { filename: 'assets/fonts/[name][hash][ext]' },
      },
    ],
  },

  resolve: {
    extensions: ['.js', '.scss'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@styles': path.resolve(__dirname, 'src/styles'),
    },
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: 'style.css', // nebo 'assets/css/style.[contenthash].css' pro prod
    }),
  ],

  devServer: {
    static: { directory: path.resolve(__dirname, 'dist') },
    open: true,
    port: 3000,
    hot: true,
    historyApiFallback: true,
  },

  mode: process.env.NODE_ENV || 'development',
  devtool: 'source-map',
};
