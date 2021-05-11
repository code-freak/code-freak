// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands'
import failOnConsoleError, { consoleType } from 'cypress-fail-on-console-error'

failOnConsoleError({
  includeConsoleTypes: [consoleType.ERROR, consoleType.WARN]
})

// Prevents Cypress failing on the ci because of a ResizeObserver-loop-limit-error
// https://stackoverflow.com/a/63519375
const resizeObserverLoopErrorRegex = /^[^(ResizeObserver loop limit exceeded)]/
Cypress.on('uncaught:exception', error => {
  /* returning false here prevents Cypress from failing the test */
  if (resizeObserverLoopErrorRegex.test(error.message)) {
    return false
  }
})
