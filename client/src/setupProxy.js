// workaround for https://github.com/facebook/create-react-app/issues/5280

// eslint-disable-next-line @typescript-eslint/no-var-requires
const proxy = require('http-proxy-middleware')

const proxyHost = process.env.NODE_PROXY_HOST || 'localhost'
const proxyPort = process.env.NODE_PROXY_PORT || '8080'
const proxyUrl = `${proxyHost}:${proxyPort}`

module.exports = function (app) {
  ;['/api', '/graphql', '/lti/login'].forEach(path => {
    app.use(proxy(`http://${proxyUrl}${path}`))
  })
  app.use(
    proxy('/subscriptions', {
      target: `ws://${proxyUrl}`,
      ws: true
    })
  )
}
