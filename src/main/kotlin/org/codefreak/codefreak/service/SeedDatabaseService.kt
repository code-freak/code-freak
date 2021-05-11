package org.codefreak.codefreak.service

import java.time.Instant
import org.codefreak.codefreak.Env
import org.codefreak.codefreak.auth.Role
import org.codefreak.codefreak.entity.Assignment
import org.codefreak.codefreak.entity.Task
import org.codefreak.codefreak.repository.AssignmentRepository
import org.codefreak.codefreak.repository.UserRepository
import org.codefreak.codefreak.util.TaskTemplate
import org.codefreak.codefreak.util.TaskTemplateUtil
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationListener
import org.springframework.context.annotation.Profile
import org.springframework.context.event.ContextRefreshedEvent
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Service

/**
 * Seed the database with some initial assignments
 * This should only be needed until we have a UI for creation
 */
@Service
@Profile(Env.DEV)
@Order(Ordered.LOWEST_PRECEDENCE)
class SeedDatabaseService : ApplicationListener<ContextRefreshedEvent> {

  @Autowired
  lateinit var userRepository: UserRepository

  @Autowired
  lateinit var assignmentRepository: AssignmentRepository

  @Autowired
  lateinit var taskService: TaskService

  @Autowired
  lateinit var taskTarService: TaskTarService

  @Autowired
  lateinit var assignmentService: AssignmentService

  private val log = LoggerFactory.getLogger(this::class.java)

  override fun onApplicationEvent(event: ContextRefreshedEvent) {
    if (assignmentRepository.count() > 0) {
      return
    }

    // find someone in the DB who is teacher
    val teacher = userRepository.findAll().firstOrNull { it.roles.contains(Role.TEACHER) }

    if (teacher === null) {
      log.warn("Skip seeding of sample data: There are no teachers in your database.")
      return
    }

    log.info("Seeding database with sample data. Assignments belong to user '${teacher.username}'.")

    val tasks = mutableListOf<Task>()

    TaskTemplate.values().forEach {
      val templateTar = TaskTemplateUtil.readTemplateTar(it)
      val task = taskTarService.createFromTar(templateTar, teacher)

      val templateName = it.name.lowercase().replaceFirstChar { char -> char.uppercase() }
      task.title = "Program in $templateName"
      taskService.saveTask(task)
      tasks.add(task)

      val assignment = Assignment("$templateName Assignment", teacher, Instant.now(), active = true)
      assignmentService.saveAssignment(assignment)
      assignmentService.addTasksToAssignment(assignment, listOf(task))
    }

    val assignmentWithAllTasks = Assignment(
      "Sample Assignment",
      teacher,
      openFrom = Instant.now(),
      deadline = null,
      active = true
    )
    assignmentService.saveAssignment(assignmentWithAllTasks)
    assignmentService.addTasksToAssignment(assignmentWithAllTasks, tasks)
  }
}
