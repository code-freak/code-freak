/**
 * Create an ellipsis if the given string is longer than {max} chars.
 * Returns the input string otherwise.
 *
 * @param str The string to be limited
 * @param max Maximum number of chars
 * @param ellipsisChar Optional a custom ellipsis symbol (default is …/U+2026)
 */
export const ellipsis = (str: string, max: number, ellipsisChar = '…') => {
  if (str.length <= max) {
    return str
  }
  return str.substr(0, max) + ellipsisChar
}

/**
 * Check if haystack contains needle case insensitive
 *
 * @param needle
 * @param haystack
 */
export const matches = (needle: string, haystack: string) =>
  haystack.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase()) !== -1

/**
 * Capitalize the first letter of the string.
 * E.g. "hello" => "Hello"; "HELLO" => "Hello"
 *
 * @param s The string to be capitalized
 */
export const capitalize = (s: string) => {
  if (s.length === 0) {
    return s
  } else if (s.length === 1) {
    return s.charAt(0).toUpperCase()
  }

  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Remove one or more trailing slashes from a string
 *
 * @param str
 */
export const trimTrailingSlashes = (str: string): string => {
  return str.replace(/\/+$/, '')
}
