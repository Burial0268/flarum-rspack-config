const fs = require('fs');
const path = require('path');
const { RsdoctorRspackPlugin } = require('@rsdoctor/rspack-plugin');

const entryPointNames = ['forum', 'admin'];
const entryPointExts = ['js', 'ts'];

function getEntryPoints() {
  const entries = {};

  appLoop: for (const app of entryPointNames) {
    for (const ext of entryPointExts) {
      const file = path.resolve(process.cwd(), `${app}.${ext}`);

      if (fs.existsSync(file)) {
        entries[app] = file;
        continue appLoop;
      }
    }
  }

  if (Object.keys(entries).length === 0) {
    console.error('ERROR: No JS entrypoints could be found.');
  }

  return entries;
}

const useBundleAnalyzer = process.env.ANALYZER === 'true';
const plugins = [
  (useBundleAnalyzer && process.env.RSDOCTOR) &&
  new RsdoctorRspackPlugin({
    // options (?)
  })
];

module.exports = function (options = {}) {
  return {
    // Set up entry points for each of the forum + admin apps, but only
    // if they exist.
    entry: getEntryPoints(),

    plugins: plugins,

    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },

    module: {
      rules: [
        {
          test: /\.(j|t)s$/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                },
                transform: {
                  react: {
                    runtime: "automatic",
                    development: false,
                    useBuiltins: false,
                  },
                },
              },
            },
          },
          type: 'javascript/auto',
        },
        {
          test: /\.(j|t)sx$/,
          use: [{
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: "automatic",
                    development: false,
                    useBuiltins: true,
                  },
                },
              },
              externalHelpers: true,
            },
          }, {
            loader: "babel-loader",
            options: require('./babel.config.cjs'),
          }],
        },
      ],
    },

    output: {
      path: path.resolve(process.cwd(), 'dist'),
      library: 'module.exports',
      libraryTarget: 'assign',
      devtoolNamespace: require(path.resolve(process.cwd(), 'package.json')).name,
    },

    externals: [
      {
        '@flarum/core/forum': 'flarum.core',
        '@flarum/core/admin': 'flarum.core',
        jquery: 'jQuery',
      },

      (function () {
        const externals = {};

        if (options.useExtensions) {
          for (const extension of options.useExtensions) {
            externals['@' + extension] =
              externals['@' + extension + '/forum'] =
              externals['@' + extension + '/admin'] =
                "flarum.extensions['" + extension + "']";
          }
        }

        return externals;
      })(),

      // Support importing old-style core modules.
      function ({ request }, callback) {
        let matches;
        if ((matches = /^flarum\/(.+)$/.exec(request))) {
          return callback(null, "root flarum.core.compat['" + matches[1] + "']");
        }
        callback();
      },
    ],

    devtool: 'source-map',
  };
};
