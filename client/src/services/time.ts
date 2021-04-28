import { Moment } from 'moment'
import { zeroPad } from 'react-countdown'

export interface TimeComponents {
  hours: number
  minutes: number
  seconds: number
}

/**
 * Creates a time string like 2h 12m 20s from time components
 * Omits every component that is zero.
 *
 * @param components
 * @param forceSeconds
 */
export const componentsToRelTime = (
  components: TimeComponents,
  forceSeconds = false
): string => {
  const { hours, minutes, seconds } = components
  if (hours + minutes + seconds <= 0) {
    return '0s'
  }

  let str = ''
  if (hours > 0) {
    str += `${hours}h `
  }
  if (minutes > 0) {
    str += `${minutes}m `
  }
  if (forceSeconds || seconds > 0) {
    str += `${zeroPad(seconds, 2)}s`
  }
  return str.trimRight()
}

export const secondsToRelTime = (sec: number) =>
  componentsToRelTime(secondsToComponents(sec))

export const momentDifferenceToRelTime = (date: Moment, now: Moment) =>
  secondsToRelTime(Math.max(0, date.diff(now, 's')))

export const secondsToComponents = (sec: number): TimeComponents => {
  const hours = Math.floor(sec / 3600)
  const minutes = Math.floor((sec - hours * 3600) / 60)
  const seconds = sec - hours * 3600 - minutes * 60
  return { hours, minutes, seconds }
}

export const componentsToSeconds = (components: TimeComponents): number => {
  return components.hours * 3600 + components.minutes * 60 + components.seconds
}

export function momentToIsoCb<T>(fn: (date?: string) => T) {
  return (m: Moment | null) => fn(m?.toISOString())
}
