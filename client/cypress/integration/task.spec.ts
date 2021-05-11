describe('Task', () => {
  it('creates an empty task', () => {
    cy.loginTeacher()

    cy.visitTaskPoolPage()

    cy.contains('Create Task').click()

    cy.url().should('contain', '/tasks/pool/create')

    cy.contains('Create empty task').click()

    cy.contains('Task created').should('exist')

    cy.url().should('not.contain', '/pool').should('contain', '/details')
  })
})

// Convert this into a module instead of a script
export {}
