import { Moment } from 'moment'
import { useCallback, useEffect, useState } from 'react'

export type NowFn = typeof Date.now

/**
 * Hook that continuously checks if date has been reached.
 * If the date is reached the return value changes to true.
 * Also allows to pass in undefined in which case the hook simply returns undefined as well.
 *
 * @param date A {Date} instance or unix timestamp in milliseconds as {number}.
 * @param nowFn A function returning the current timestamp in milliseconds
 * @param precision An interval in ms
 */
const useMomentReached = (
  date: undefined | Moment,
  nowFn: NowFn = Date.now,
  precision = 100
): boolean | undefined => {
  const checkDateReached = useCallback((): boolean | undefined => {
    const timestamp = date?.valueOf()
    return timestamp ? timestamp <= nowFn() : undefined
  }, [date, nowFn])
  const [dateReached, setDateReached] = useState<boolean | undefined>(
    checkDateReached()
  )
  const updateReached = useCallback(() => {
    const reached = checkDateReached()
    setDateReached(reached)
    return reached
  }, [checkDateReached, setDateReached])

  useEffect(() => {
    // handle possible change of date
    if (updateReached() === false) {
      // schedule checks if deadline has NOT been reached (and is not undefined)
      const intervalId = setInterval(() => {
        // stop if reached is either true or undefined
        if (updateReached() !== false) clearInterval(intervalId)
      }, precision)
      return () => clearInterval(intervalId)
    }
  }, [date, nowFn, updateReached, precision])

  return dateReached
}

export default useMomentReached
