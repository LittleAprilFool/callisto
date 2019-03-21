const path = require('path');
const mode = process.env.NODE_ENV;

module.exports = {
    mode,
    devtool: 'inline-source-map',
    entry: './src/index.ts',
    target: 'node',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          loaders:[ 'babel-loader','ts-loader']
        }
      ]
    },
    resolve: {
      extensions: [".ts", ".tsx",".d.ts"]
    },
    output: {
      filename: 'bundle.js',
      path: path.resolve(__dirname, 'dist'),
      libraryTarget: 'amd',
    }
}