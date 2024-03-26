// General utilities that are too small to have their own file

/**
 *
 * @param {string} string - input string to parse
 * @returns {string | unkown } - parsed json object or fall back string
 */
export const tryJsonParse = (string: string): unknown | string => {
  try {
    return JSON.parse(string)
  } catch (e) {
    return string
  }
}

/**
 * Convert a string's first char to lowercase and return the string
 * @param {string} string
 * @returns {string}
 */
export const firstCharLowerCase = (string: string) =>
  string.charAt(0).toLowerCase() + string.slice(1)

/**
 * Force to array
 * @param item
 * @returns {any}
 */
export const forceArray = <T>(item: T | T[] | undefined): T[] =>
  Array.isArray(item) ? item : item && Object.keys(item).length ? [item] : []

/**
 * Filter out only unique values from array (will not work on array of objects)
 * @param {T} value
 * @param {number} index
 * @param {T[]} self
 * @returns {boolean}
 */
export function onlyUnique<T>(value: T, index: number, self: T[]): boolean {
  return self.indexOf(value) === index
}
