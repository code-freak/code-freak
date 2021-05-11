const CracoAntDesignPlugin = require('craco-antd')
const CracoSvgReactLoaderPlugin = require('./craco/craco-svg-loader-plugin')
const CracoDefinePlugin = require('./craco/craco-define-plugin')
const CracoYamlPlugin = require('./craco/craco-yaml-plugin')
const GitRevisionPlugin = require('git-revision-webpack-plugin')

/**
 * Add globals to environment that expose build year and version/hash from Git
 * via DefinePlugin
 */
const createBuildDefinitions = () => {
  const gitRevisionPlugin = new GitRevisionPlugin()
  return {
    'process.env.BUILD_YEAR': JSON.stringify(new Date().getFullYear()),
    'process.env.BUILD_VERSION': JSON.stringify(gitRevisionPlugin.version()),
    'process.env.BUILD_HASH': JSON.stringify(gitRevisionPlugin.commithash())
  }
}

module.exports = {
  eslint: {
    pluginOptions: (currentOptions, { env }) => {
      if (env === 'development') {
        return {
          ...currentOptions,
          // Make compilation continue with errors during development
          failOnError: false
        }
      }
      return currentOptions
    }
  },
  plugins: [
    { plugin: CracoAntDesignPlugin },
    { plugin: CracoYamlPlugin },
    {
      plugin: CracoSvgReactLoaderPlugin,
      options: {
        exclude: /bootstrap-less\/fonts/ // prevent svg fonts from being processed
      }
    },
    {
      plugin: CracoDefinePlugin,
      options: {
        definitions: [
          createBuildDefinitions,
          {
            'process.env.CODEFREAK_DOCS_BASE_URL': JSON.stringify(
              'https://docs.codefreak.org/codefreak/'
            )
          }
        ]
      }
    }
  ]
}
