describe('Assignment', () => {
  it('creates an empty assignment', () => {
    cy.loginTeacher()

    cy.visitAssignmentsListPage()

    cy.contains('Create Assignment').click()

    cy.get('.ant-modal')
      .get('#new-assignment-title')
      .type('My empty assignment')

    cy.get('.ant-modal-footer')
      .contains('Create Assignment')
      .should('not.be.disabled')

    cy.get('.ant-modal-footer').contains('Create Assignment').click()

    cy.contains('Assignment created').should('exist')

    cy.url().then(url => {
      const assignmentUrl = Cypress.config().baseUrl + '/assignments'
      const assignmentId = url.replace(assignmentUrl, '')
      expect(assignmentId).not.to.be.equal('/')
      expect(assignmentId).not.to.be.equal('')
    })
  })
})

// Convert this into a module instead of a script
export {}
