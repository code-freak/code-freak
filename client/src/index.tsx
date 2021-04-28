import { ApolloProvider } from '@apollo/client'
import ReactDOM from 'react-dom'
import App from './App'
import './index.css'
import * as serviceWorker from './serviceWorker'
import {
  createApolloClient,
  createApolloWsLink
} from './services/codefreak-api'
import React from 'react'
import StandaloneErrorPage from './StandaloneErrorPage'

/**
 * Render the default Code FREAK frontend application
 */
const renderApp = () => {
  const wsLink = createApolloWsLink()
  const apolloClient = createApolloClient(wsLink)

  // Based on https://github.com/apollographql/apollo-link/issues/197#issuecomment-363387875
  // We need to re-connect the websocket so that the new session cookie is used for the handshake
  const resetWebsocket = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const websocket = (wsLink as any).subscriptionClient
    websocket.close(true, true)
    websocket.connect()
  }

  const onUserChanged = async (type: 'login' | 'logout') => {
    // on logout the server will close the connection and apollo will reconnect
    // automatically. On login we have to reconnect because we just received our
    // cookie from the server and this will be passed to the server when reconnecting
    if (type === 'login') {
      resetWebsocket()
    }
    await apolloClient.clearStore()
  }

  return (
    <ApolloProvider client={apolloClient}>
      <App onUserChanged={onUserChanged} />
    </ApolloProvider>
  )
}

/**
 * Renders a standalone error page based on server-side errors
 * This will not create a connection to the backend
 *
 * @param error
 */
const renderErrorPage = (error: CodefreakError) => {
  return <StandaloneErrorPage error={error} />
}

/**
 * Depending on if __CODEFREAK_ERROR is present or not this will render the
 * error page or the regular application
 */
const renderConditionally = (): React.ReactElement => {
  if (window.hasOwnProperty('__CODEFREAK_ERROR')) {
    return renderErrorPage(window.__CODEFREAK_ERROR)
  }

  return renderApp()
}

ReactDOM.render(renderConditionally(), document.getElementById('root'))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()
