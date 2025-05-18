const path = require('path');

module.exports = {
  entry: './src/renderer.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.bundle.js'
  },
  target: 'electron-renderer',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      '@api': path.resolve(__dirname, 'src/api/'),
      '@services': path.resolve(__dirname, 'src/services/'),
      '@utils': path.resolve(__dirname, 'src/utils/'),
      '@components': path.resolve(__dirname, 'src/components/')
    }
  },
  mode: 'development'
};