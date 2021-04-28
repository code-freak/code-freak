import {
  ApolloClient,
  ApolloError,
  ApolloLink,
  InMemoryCache,
  ServerError,
  split
} from '@apollo/client'
import { ErrorHandler, ErrorResponse, onError } from '@apollo/client/link/error'
import { messageService } from './message'
import { getMainDefinition } from '@apollo/client/utilities'
import { createUploadLink } from 'apollo-upload-client'
import { WebSocketLink } from '@apollo/client/link/ws'
import { GraphQLError } from 'graphql'

export * from '../generated/graphql'

type CommonNetworkError = Pick<
  ServerError,
  'response' | 'statusCode' | 'message'
>
const isNetworkError = (
  error?: Partial<CommonNetworkError>
): error is CommonNetworkError => {
  return (
    !!error &&
    'response' in error &&
    'statusCode' in error &&
    'message' in error
  )
}

export interface HttpError {
  statusCode?: number
  message: string
}

export const getFirstGraphqlError = (
  errors: ReadonlyArray<GraphQLError>
): HttpError => {
  const firstError = errors.find(e => !!e.message)
  const statusCode = firstError?.extensions?.errorCode
  return {
    statusCode: statusCode ? parseInt(statusCode, 10) : undefined,
    message: firstError?.message || 'Unknown GraphQL Error'
  }
}

export const getErrorMessageFromApolloError = (error: ApolloError) => {
  const { graphQLErrors } = error
  return getFirstGraphqlError(graphQLErrors).message
}

/**
 * Get the status code and a printable message from an ErrorResponse
 * The status code can either be in graphqlErrors (which is transported
 * over a network status 200) or inside the networkError
 *
 * @param error
 */
const extractHttpErrorFromResponse = (error: ErrorResponse): HttpError => {
  const { graphQLErrors, networkError } = error
  if (graphQLErrors !== undefined) {
    return getFirstGraphqlError(graphQLErrors)
  }
  if (isNetworkError(networkError)) {
    const { statusCode, message } = networkError
    return {
      statusCode,
      message
    }
  }
  return {
    message: 'Something went wrong. Please try again.'
  }
}

/**
 * Global Apollo error handler that shows an error notification
 * at the top of the screen.
 * There is a bug (or feature?) in Apollo where this error handling is never
 * applied to mutations:
 * https://github.com/apollographql/apollo-client/issues/6070
 *
 * @param error
 */
const apolloErrorHandler: ErrorHandler = error => {
  if (!error.operation.getContext().disableGlobalErrorHandling) {
    const { statusCode, message } = extractHttpErrorFromResponse(error)
    // If not authenticated or session expired, reload page to show the login dialog
    if (statusCode === 401) {
      window.location.reload()
      return
    }
    messageService.error(message)
  }
}

export const createHttpLink = () =>
  createUploadLink({ uri: '/graphql', credentials: 'include' })

export const createApolloWsLink = () => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocketLink({
    uri: `${wsProtocol}//${window.location.host}/subscriptions`,
    options: {
      reconnect: true,
      connectionParams: {
        credentials: 'include'
      }
    }
  })
}

export const createApolloClient = (wsLink: WebSocketLink) => {
  return new ApolloClient({
    link: ApolloLink.from([
      onError(apolloErrorHandler),
      split(
        ({ query }) => {
          const definition = getMainDefinition(query)
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          )
        },
        wsLink,
        createHttpLink()
      )
    ]),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network'
      }
    }
  })
}
