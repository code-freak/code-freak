export const noop = () => {
  /* do nothing */
}

export function makeUpdater<T, R>(
  currentValue: T,
  callback: (newValue: T) => Promise<R>
): Updater<T, R> {
  return <P extends keyof T>(propName: P) => (propValue: T[P]) => {
    const newValue = { ...currentValue }
    if (propValue === undefined) {
      delete newValue[propName]
    } else {
      newValue[propName] = propValue
    }
    return callback(newValue)
  }
}

export type Updater<T, R = unknown> = <P extends keyof T>(
  propName: P
) => (propValue: T[P]) => Promise<R>

export function extractTargetValue<V, T>(fn: (value: V) => T) {
  return (e: { target: { value: V } }) => fn(e.target.value)
}

export function extractTargetChecked<T>(fn: (value: boolean) => T) {
  return (e: { target: { checked: boolean } }) => fn(e.target.checked)
}

/**
 * Compares two values with the given transformation method.
 * Returns a positive number, if a is greater than b.
 * Returns a negative number, if b is greater than a.
 * Returns 0 otherwise.
 *
 * @param a the first value to be compared
 * @param b the second value to be compared
 * @param transform a function that transforms the values to a number
 */
export function compare<T>(a: T, b: T, transform: (value: T) => number) {
  if (a && b) {
    return transform(a) - transform(b)
  } else if (a) {
    return -1
  } else if (b) {
    return 1
  } else {
    return 0
  }
}
