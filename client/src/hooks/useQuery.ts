import { useHistory, useLocation } from 'react-router-dom'

export const useQuery = () => {
  return new URLSearchParams(useLocation().search)
}

export const useQueryParam = (param: string) => {
  return useQuery().get(param) || undefined
}

export const useMutableQueryParam = (
  param: string,
  defaultValue: string
): [string, (val: string) => void] => {
  const history = useHistory()
  const query = useQuery()
  const setter = (val: string) => {
    query.set(param, val)
    history.replace({
      pathname: history.location.pathname,
      search: query.toString()
    })
  }
  const value = query.get(param) || defaultValue
  return [value, setter]
}
