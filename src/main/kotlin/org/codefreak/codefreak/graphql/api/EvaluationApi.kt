package org.codefreak.codefreak.graphql.api

import com.expediagroup.graphql.annotations.GraphQLID
import com.expediagroup.graphql.annotations.GraphQLName
import com.expediagroup.graphql.spring.operations.Mutation
import com.expediagroup.graphql.spring.operations.Query
import com.expediagroup.graphql.spring.operations.Subscription
import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import graphql.schema.DataFetchingEnvironment
import org.codefreak.codefreak.auth.Authority
import org.codefreak.codefreak.auth.Authorization
import org.codefreak.codefreak.auth.hasAuthority
import org.codefreak.codefreak.entity.Evaluation
import org.codefreak.codefreak.entity.EvaluationStep
import org.codefreak.codefreak.entity.EvaluationStepDefinition
import org.codefreak.codefreak.entity.EvaluationStepResult
import org.codefreak.codefreak.entity.EvaluationStepStatus
import org.codefreak.codefreak.entity.Feedback
import org.codefreak.codefreak.graphql.BaseDto
import org.codefreak.codefreak.graphql.BaseResolver
import org.codefreak.codefreak.graphql.ResolverContext
import org.codefreak.codefreak.graphql.SubscriptionEventPublisher
import org.codefreak.codefreak.service.AnswerService
import org.codefreak.codefreak.service.AssignmentService
import org.codefreak.codefreak.service.EvaluationStatusUpdatedEvent
import org.codefreak.codefreak.service.EvaluationStepStatusUpdatedEvent
import org.codefreak.codefreak.service.IdeService
import org.codefreak.codefreak.service.TaskService
import org.codefreak.codefreak.service.evaluation.EvaluationRunner
import org.codefreak.codefreak.service.evaluation.EvaluationService
import org.codefreak.codefreak.service.evaluation.EvaluationStepService
import org.codefreak.codefreak.service.evaluation.StoppableEvaluationRunner
import org.codefreak.codefreak.service.evaluation.isBuiltIn
import org.codefreak.codefreak.util.exhaustive
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.access.annotation.Secured
import org.springframework.stereotype.Component
import org.springframework.util.Base64Utils
import reactor.core.publisher.Flux
import java.util.UUID

@GraphQLName("EvaluationStepDefinition")
class EvaluationStepDefinitionDto(definition: EvaluationStepDefinition, ctx: ResolverContext) {
  companion object {
    private val objectMapper = ObjectMapper()
  }

  val id = definition.id
  val runnerName = definition.runnerName
  val active = definition.active
  val position = definition.position
  val title = definition.title
  val options: String by lazy {
    ctx.authorization.requireAuthorityIfNotCurrentUser(definition.task.owner, Authority.ROLE_ADMIN)
    objectMapper.writeValueAsString(definition.options)
  }
  val runner by lazy {
    ctx.authorization.requireAuthority(Authority.ROLE_TEACHER)
    ctx.serviceAccess.getService(EvaluationService::class).getEvaluationRunner(runnerName).let { EvaluationRunnerDto(it) }
  }
  val timeout = definition.timeout
}

@GraphQLName("EvaluationStepDefinitionInput")
class EvaluationStepDefinitionInputDto(var id: UUID, var title: String, var active: Boolean, var timeout: Long?, var options: String) {
  constructor() : this(UUID.randomUUID(), "", true, null, "")
}

@GraphQLName("Evaluation")
class EvaluationDto(entity: Evaluation, ctx: ResolverContext) : BaseDto(ctx) {
  @GraphQLID
  val id = entity.id
  val answer by lazy { AnswerDto(entity.answer, ctx) }
  val createdAt = entity.createdAt
  val steps by lazy {
    entity.evaluationSteps
        .filter { it.definition.active }
        .map { EvaluationStepDto(it, ctx) }
        .sortedBy { it.definition.position }
  }
  val stepsResultSummary by lazy { EvaluationStepResultDto(entity.stepsResultSummary) }
  val stepsStatusSummary by lazy { EvaluationStepStatusDto(entity.stepStatusSummary) }
}

@GraphQLName("EvaluationStep")
class EvaluationStepDto(entity: EvaluationStep, ctx: ResolverContext) {
  @GraphQLID
  val id = entity.id
  val definition by lazy { EvaluationStepDefinitionDto(entity.definition, ctx) }
  val result = entity.result?.let { EvaluationStepResultDto(it) }
  val summary = entity.summary
  val feedback by lazy { entity.feedback.map { FeedbackDto(it) } }
  val status = EvaluationStepStatusDto(entity.status)
}

@GraphQLName("EvaluationRunner")
class EvaluationRunnerDto(runner: EvaluationRunner) {
  val name = runner.getName()
  val builtIn = runner.isBuiltIn()
  val defaultTitle = runner.getDefaultTitle()
  val optionsSchema = runner.getOptionsSchema()
  val documentationUrl = runner.getDocumentationUrl()
  val stoppable = runner is StoppableEvaluationRunner
}

@GraphQLName("EvaluationStepResult")
enum class EvaluationStepResultDto { SUCCESS, FAILED, ERRORED }

fun EvaluationStepResultDto(entity: EvaluationStepResult) = when (entity) {
  EvaluationStepResult.SUCCESS -> EvaluationStepResultDto.SUCCESS
  EvaluationStepResult.FAILED -> EvaluationStepResultDto.FAILED
  EvaluationStepResult.ERRORED -> EvaluationStepResultDto.ERRORED
}.exhaustive

@GraphQLName("EvaluationStepStatus")
enum class EvaluationStepStatusDto { PENDING, QUEUED, RUNNING, FINISHED, CANCELED }

fun EvaluationStepStatusDto(entity: EvaluationStepStatus) = when (entity) {
  EvaluationStepStatus.PENDING -> EvaluationStepStatusDto.PENDING
  EvaluationStepStatus.QUEUED -> EvaluationStepStatusDto.QUEUED
  EvaluationStepStatus.RUNNING -> EvaluationStepStatusDto.RUNNING
  EvaluationStepStatus.FINISHED -> EvaluationStepStatusDto.FINISHED
  EvaluationStepStatus.CANCELED -> EvaluationStepStatusDto.CANCELED
}.exhaustive

@GraphQLName("Feedback")
class FeedbackDto(entity: Feedback) {
  @GraphQLID
  val id = entity.id
  val summary = entity.summary
  val fileContext = entity.fileContext?.let { FileContextDto(it) }
  val longDescription = entity.longDescription
  val group = entity.group
  val status = entity.status?.let { StatusDto(it) }
  val severity = entity.severity?.let { SeverityDto(it) }
}

@GraphQLName("FileContext")
class FileContextDto(entity: Feedback.FileContext) {
  val path = entity.path
  val lineStart = entity.lineStart
  val lineEnd = entity.lineEnd
  val columnStart = entity.columnStart
  val columnEnd = entity.columnEnd
}

@GraphQLName("FeedbackSeverity")
enum class SeverityDto {
  INFO,
  MINOR,
  MAJOR,
  CRITICAL
}

fun SeverityDto(entity: Feedback.Severity) = when (entity) {
  Feedback.Severity.INFO -> SeverityDto.INFO
  Feedback.Severity.MINOR -> SeverityDto.MINOR
  Feedback.Severity.MAJOR -> SeverityDto.MAJOR
  Feedback.Severity.CRITICAL -> SeverityDto.CRITICAL
}.exhaustive

@GraphQLName("FeedbackStatus")
enum class StatusDto {
  IGNORE,
  SUCCESS,
  FAILED
}

fun StatusDto(entity: Feedback.Status) = when (entity) {
  Feedback.Status.IGNORE -> StatusDto.IGNORE
  Feedback.Status.SUCCESS -> StatusDto.SUCCESS
  Feedback.Status.FAILED -> StatusDto.FAILED
}.exhaustive

@GraphQLName("EvaluationStatusUpdatedEvent")
class EvaluationStatusUpdatedEventDto(event: EvaluationStatusUpdatedEvent, ctx: ResolverContext) {
  val evaluation = EvaluationDto(event.evaluation, ctx)
  val status = EvaluationStepStatusDto(event.status)
}

@Component
class EvaluationQuery : BaseResolver(), Query {

  @Secured(Authority.ROLE_TEACHER)
  fun evaluationRunners() = context {
    serviceAccess.getService(EvaluationService::class).getAllEvaluationRunners()
        .map { EvaluationRunnerDto(it) }
        .toTypedArray()
  }

  @Secured(Authority.ROLE_STUDENT)
  fun evaluation(id: UUID): EvaluationDto = context {
    val evaluation = serviceAccess.getService(EvaluationService::class).getEvaluation(id)
    authorization.requireAuthorityIfNotCurrentUser(evaluation.answer.submission.user, Authority.ROLE_TEACHER)
    EvaluationDto(evaluation, this)
  }
}

@Component
class EvaluationMutation : BaseResolver(), Mutation {

  companion object {
    val objectMapper = ObjectMapper()
  }

  @Secured(Authority.ROLE_STUDENT)
  fun startEvaluation(answerId: UUID): EvaluationDto = context {
    val answer = serviceAccess.getService(AnswerService::class).findAnswer(answerId)
    authorization.requireAuthorityIfNotCurrentUser(answer.submission.user, Authority.ROLE_TEACHER)
    val forceSaveFiles = authorization.isCurrentUser(answer.task.owner) || authorization.currentUser.hasAuthority(Authority.ROLE_ADMIN)
    val evaluation = serviceAccess.getService(EvaluationService::class).startEvaluation(answer, forceSaveFiles)
    EvaluationDto(evaluation, this)
  }

  @Secured(Authority.ROLE_TEACHER)
  fun startAssignmentEvaluation(
    assignmentId: UUID,
    invalidateAll: Boolean?,
    invalidateTask: UUID?
  ): List<EvaluationDto> = context {
    val assignment = serviceAccess.getService(AssignmentService::class).findAssignment(assignmentId)
    authorization.requireAuthorityIfNotCurrentUser(assignment.owner, Authority.ROLE_ADMIN)
    val evaluationService = serviceAccess.getService(EvaluationService::class)
    when {
      invalidateAll == true -> evaluationService.invalidateEvaluations(assignment)
      // find task in assignment and invalidate their evaluations + save modified task files from IDE
      // this also prevents passing IDs of foreign tasks
      invalidateTask != null -> assignment.tasks.find { it.id == invalidateTask }
          ?.let {
            evaluationService.invalidateEvaluations(it)
            serviceAccess.getService(IdeService::class).saveTaskFiles(it)
          }
    }

    evaluationService.startAssignmentEvaluation(assignmentId).map {
      EvaluationDto(it, this)
    }
  }

  fun createEvaluationStepDefinition(taskId: UUID, runnerName: String, options: String) = context {
    val evaluationService = serviceAccess.getService(EvaluationService::class)
    val taskService = serviceAccess.getService(TaskService::class)
    val task = taskService.findTask(taskId)
    val runner = evaluationService.getEvaluationRunner(runnerName)
    if (!task.isEditable(authorization)) {
      Authorization.deny()
    }
    val optionsMap = objectMapper.readValue(options, object : TypeReference<HashMap<String, Any>>() {})
    val definition = EvaluationStepDefinition(task, runner.getName(), task.evaluationStepDefinitions.size, runner.getDefaultTitle(), optionsMap)
    evaluationService.validateRunnerOptions(definition)
    task.evaluationStepDefinitions.add(definition)
    evaluationService.saveEvaluationStepDefinition(definition)
    taskService.saveTask(task)
    taskService.invalidateLatestEvaluations(task)
    true
  }

  fun updateEvaluationStepDefinition(input: EvaluationStepDefinitionInputDto): Boolean = context {
    val evaluationService = serviceAccess.getService(EvaluationService::class)
    val definition = evaluationService.findEvaluationStepDefinition(input.id)
    if (!definition.task.isEditable(authorization)) {
      Authorization.deny()
    }
    val options = objectMapper.readValue(input.options, object : TypeReference<HashMap<String, Any>>() {})
    evaluationService.updateEvaluationStepDefinition(definition,
        title = input.title,
        active = input.active,
        timeout = input.timeout,
        options = options)
    true
  }

  fun deleteEvaluationStepDefinition(id: UUID) = context {
    val evaluationService = serviceAccess.getService(EvaluationService::class)
    val definition = evaluationService.findEvaluationStepDefinition(id)
    if (!definition.task.isEditable(authorization)) {
      Authorization.deny()
    }
    require(!evaluationService.getEvaluationRunner(definition.runnerName).isBuiltIn()) { "Built-in evaluation steps cannot be deleted" }
    check(definition.task.answers.none { evaluationService.isEvaluationScheduled(it.id) }) { "Cannot delete evaluation step while waiting for evaluation" }
    try {
      evaluationService.deleteEvaluationStepDefinition(definition)
    } catch (e: DataIntegrityViolationException) {
      throw IllegalStateException("Evaluation steps cannot be deleted once used to generate feedback. You can deactivate it for future evaluation.")
    }
    // we do not need to invalidate evaluations here because we throw if there are any
    true
  }

  fun setEvaluationStepDefinitionPosition(id: UUID, position: Long): Boolean = context {
    val definition = serviceAccess.getService(EvaluationService::class).findEvaluationStepDefinition(id)
    if (!definition.task.isEditable(authorization)) {
      Authorization.deny()
    }
    serviceAccess.getService(EvaluationService::class).setEvaluationStepDefinitionPosition(definition, position)
    // we do not need to invalidate evaluations here because order does not matter
    true
  }

  @Secured(Authority.ROLE_TEACHER)
  fun addCommentFeedback(
    answerId: UUID,
    digest: String,
    comment: String,
    severity: SeverityDto?,
    path: String?,
    line: Int?
  ): Boolean = context {
    val answer = serviceAccess.getService(AnswerService::class).findAnswer(answerId)
    val user = authorization.currentUser
    val evaluationService = serviceAccess.getService(EvaluationService::class)
    val digestByteArray = Base64Utils.decodeFromString(digest)
    val feedback = evaluationService.createCommentFeedback(user, comment).apply {
      if (path != null) {
        fileContext = Feedback.FileContext(path).apply {
          lineStart = line
        }
      }
      this.severity = when {
        severity != null -> Feedback.Severity.valueOf(severity.name)
        else -> null
      }
      this.status = when {
        severity != null -> Feedback.Status.FAILED
        else -> null
      }
    }
    evaluationService.addCommentFeedback(answer, digestByteArray, feedback)
    true
  }
}

@Component
class EvaluationStatusUpdatedEventPublisher : SubscriptionEventPublisher<EvaluationStatusUpdatedEvent>()

@Component
class EvaluationSubscription : BaseResolver(), Subscription {

  @Autowired
  private lateinit var evaluationStatusUpdatedEventPublisher: EvaluationStatusUpdatedEventPublisher

  fun evaluationStatusUpdated(answerId: UUID, env: DataFetchingEnvironment): Flux<EvaluationStatusUpdatedEventDto> =
      context(env) {
        val answer = serviceAccess.getService(AnswerService::class).findAnswer(answerId)
        authorization.requireAuthorityIfNotCurrentUser(answer.submission.user, Authority.ROLE_TEACHER)
        evaluationStatusUpdatedEventPublisher.eventStream
            .filter { it.evaluation.answer.id == answerId }
            .map { EvaluationStatusUpdatedEventDto(it, this) }
      }

  fun evaluationFinished(env: DataFetchingEnvironment): Flux<EvaluationDto> = context(env) {
    evaluationStatusUpdatedEventPublisher.eventStream
        .filter { it.status >= EvaluationStepStatus.FINISHED && it.evaluation.answer.submission.user == authorization.currentUser }
        .map { EvaluationDto(it.evaluation, this) }
  }
}
