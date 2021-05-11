package org.codefreak.codefreak.service

import com.nhaarman.mockitokotlin2.any
import java.util.Optional
import java.util.UUID
import org.codefreak.codefreak.entity.Answer
import org.codefreak.codefreak.entity.Assignment
import org.codefreak.codefreak.entity.Submission
import org.codefreak.codefreak.entity.Task
import org.codefreak.codefreak.entity.User
import org.codefreak.codefreak.repository.AnswerRepository
import org.codefreak.codefreak.repository.AssignmentRepository
import org.codefreak.codefreak.repository.SubmissionRepository
import org.codefreak.codefreak.service.file.FileService
import org.hamcrest.MatcherAssert.assertThat
import org.hamcrest.Matchers.equalTo
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.InjectMocks
import org.mockito.Mock
import org.mockito.Mockito.`when`
import org.mockito.junit.MockitoJUnitRunner

@RunWith(MockitoJUnitRunner::class)
class AssignmentAndSubmissionServiceTest {
  private val assignment = Assignment("Assignment 1", User("user"), null)
  private val user = User("user")
  private val task = Task(assignment, user, position = 0L, title = "Task 1", body = "Do stuff", weight = 100)
  private val submission = Submission(user, assignment)
  private val answer = Answer(submission, task)

  init {
    assignment.tasks = sortedSetOf(task)
    submission.answers = mutableSetOf(answer)
  }

  @Mock
  lateinit var assignmentRepository: AssignmentRepository
  @Mock
  lateinit var submissionRepository: SubmissionRepository
  @Mock
  lateinit var answerRepository: AnswerRepository
  @Mock
  lateinit var answerService: AnswerService
  @Mock
  lateinit var fileService: FileService
  @InjectMocks
  val assignmentService = AssignmentService()
  @InjectMocks
  val submissionService = SubmissionService()

  @Test
  fun `findAssignment by ID`() {
    `when`(assignmentRepository.findById(any())).thenReturn(Optional.of(assignment))
    assertThat(assignmentService.findAssignment(UUID(0, 0)), equalTo(assignment))
  }

  @Test(expected = EntityNotFoundException::class)
  fun `findAssignment throws for no results`() {
    `when`(assignmentRepository.findById(any())).thenReturn(Optional.empty())
    assignmentService.findAssignment(UUID(0, 0))
  }

  @Test
  fun `findSubmission by ID`() {
    `when`(submissionRepository.findById(any())).thenReturn(Optional.of(submission))
    assertThat(submissionService.findSubmission(UUID(0, 0)), equalTo(submission))
  }

  @Test(expected = EntityNotFoundException::class)
  fun `findSubmission throws for no results`() {
    `when`(submissionRepository.findById(any())).thenReturn(Optional.empty())
    submissionService.findSubmission(UUID(0, 0))
  }
}
