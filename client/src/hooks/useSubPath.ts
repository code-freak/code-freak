import { useHistory, useLocation, useRouteMatch } from 'react-router-dom'

interface StringMap {
  [key: string]: string
}

const encodeQuery = (params: StringMap) =>
  Object.entries(params)
    .map(kv => kv.map(encodeURIComponent).join('='))
    .join('&')

/**
 * Control the path relative to the current route
 * @param replace when setting the subPath, should it be replaced or pushed in the history
 * @param deep when getting the subPath, include all levels below the current (true) or only the first level (false)
 */
const useSubPath = (replace = true, deep = false) => {
  const { url } = useRouteMatch()
  const { pathname } = useLocation()
  const history = useHistory()
  return {
    get: () => {
      const fullPath = pathname.substring(url.length)
      return deep || fullPath === '' ? fullPath : '/' + fullPath.split('/')[1]
    },
    set: (path: string, query?: StringMap) => {
      const newUrl = url + path + (query ? '?' + encodeQuery(query) : '')
      replace ? history.replace(newUrl) : history.push(newUrl)
    }
  }
}

export default useSubPath
