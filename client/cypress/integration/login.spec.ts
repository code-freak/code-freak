const username = 'teacher'
const validPassword = '123'
const invalidPassword = '321'

const successText = 'Welcome back'
const failureText = 'Bad Credentials'

describe('Login', () => {
  it('works with valid credentials', () => {
    cy.visitIndex()

    cy.get('#login_username').type(username)
    cy.get('#login_password').type(validPassword)
    cy.contains('Sign in').click()

    cy.url().should('include', '/assignments')

    cy.contains(successText).should('exist')

    cy.contains(failureText).should('not.exist')
  })

  it('does not work with invalid credentials', () => {
    cy.visitIndex()

    cy.get('#login_username').type(username)
    cy.get('#login_password').type(invalidPassword)
    cy.contains('Sign in').click()

    cy.url().should('not.include', '/assignments')

    cy.contains(successText).should('not.exist')

    cy.contains(failureText).should('exist')
  })
})

// Convert this into a module instead of a script
export {}
