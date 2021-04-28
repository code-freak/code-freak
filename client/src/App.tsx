import { MenuDataItem } from '@ant-design/pro-layout/lib/typings'
import React, { useEffect, useState } from 'react'
import {
  BrowserRouter as Router,
  Redirect,
  Route,
  Switch
} from 'react-router-dom'
import './App.less'
import DefaultLayout from './components/DefaultLayout'
import ScrollToHash from './components/ScrollToHash'
import {
  AuthenticatedUser,
  AuthenticatedUserContext
} from './hooks/useAuthenticatedUser'
import {
  ServerTimeOffsetProvider,
  useCalculatedServerTimeOffset
} from './hooks/useServerTimeOffset'
import IdePage from './pages/IdePage'
import LoginPage from './pages/LoginPage'
import LtiPage from './pages/LtiPage'
import NotFoundPage from './pages/NotFoundPage'
import { routerConfig } from './router.config'
import {
  useGetAuthenticatedUserQuery,
  useLogoutMutation
} from './services/codefreak-api'
import { messageService } from './services/message'
import { displayName } from './services/user'
import { noop } from './services/util'
import { HideNavigationProvider } from './hooks/useHideNavigation'
import LoadingIndicator from './components/LoadingIndicator'

interface AppProps {
  /**
   * Will be called immediately after either a login our logout mutation has been
   * performed.
   */
  onUserChanged?: (type: 'login' | 'logout') => Promise<unknown>
}

const App: React.FC<AppProps> = props => {
  const onUserChanged = props.onUserChanged || noop
  const [
    authenticatedUser,
    setAuthenticatedUser
  ] = useState<AuthenticatedUser>()
  const timeOffset = useCalculatedServerTimeOffset()
  const [loggingOut, setLoggingOut] = useState<boolean>(false)
  const { data: authResult, loading } = useGetAuthenticatedUserQuery({
    context: { disableGlobalErrorHandling: true },
    fetchPolicy: 'network-only'
  })
  const [logoutMutation] = useLogoutMutation()

  // the user might already been authenticated. We query the backend for the
  // current user and while the auth status is undefined we will show a spinner
  useEffect(() => {
    if (authResult !== undefined) {
      setAuthenticatedUser(authResult.me)
    }
  }, [authResult])

  if (loading || timeOffset === undefined) {
    return <LoadingIndicator />
  }

  // this will show the login dialog while logout is in progress with all
  // fields disabled. Otherwise the user would not get any feedback after
  // clicking the logout button
  if (loggingOut || authenticatedUser === undefined) {
    const onLogin = async (user: AuthenticatedUser) => {
      await onUserChanged('login')
      messageService.success(`Welcome back, ${displayName(user)}!`)
      setAuthenticatedUser(user)
    }
    return <LoginPage loggingOut={loggingOut} onSuccessfulLogin={onLogin} />
  }

  const logout = async () => {
    // show the login dialog immediately after clicking logout. Both, the logout
    // mutation and onUserChanged() may take some time to complete.
    setLoggingOut(true)
    await logoutMutation()
    await onUserChanged('logout')
    setAuthenticatedUser(undefined)
    messageService.success('Successfully signed out. Goodbye 👋')
    setLoggingOut(false)
  }

  const routes: MenuDataItem[] = []
  flattenRoutes(routerConfig.routes || [], routes)

  return (
    <ServerTimeOffsetProvider value={timeOffset}>
      <AuthenticatedUserContext.Provider value={authenticatedUser}>
        <Router>
          <ScrollToHash />
          <Switch>
            <Route exact path="/">
              <Redirect to="/assignments" />
            </Route>
            <Route path="/ide/:type/:id" component={IdePage} />
            <Route path="/lti" component={LtiPage} />
            <Route>
              <HideNavigationProvider>
                <DefaultLayout logout={logout}>
                  <Switch>
                    {routes.map(renderRoute)}
                    <Route component={NotFoundPage} />
                  </Switch>
                </DefaultLayout>
              </HideNavigationProvider>
            </Route>
          </Switch>
        </Router>
      </AuthenticatedUserContext.Provider>
    </ServerTimeOffsetProvider>
  )
}

const flattenRoutes = (items: MenuDataItem[], routes: MenuDataItem[]) => {
  for (const item of items) {
    const { children = [], ...itemWithoutChildren } = item
    flattenRoutes(children, routes)
    routes.push(itemWithoutChildren)
  }
}

const renderRoute = (item: MenuDataItem, index: number): React.ReactNode => {
  const { component: Component, ...props } = item
  // external links will not be rendered via component
  if (!Component) {
    return null
  }
  return (
    <Route key={index} {...props}>
      <Component />
    </Route>
  )
}

export default App
