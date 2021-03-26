package org.codefreak.codefreak.service.evaluation

import java.time.Instant
import java.util.UUID
import org.codefreak.codefreak.entity.Evaluation
import org.codefreak.codefreak.entity.EvaluationStep
import org.codefreak.codefreak.entity.EvaluationStepDefinition
import org.codefreak.codefreak.entity.EvaluationStepResult
import org.codefreak.codefreak.entity.EvaluationStepStatus
import org.codefreak.codefreak.repository.EvaluationStepRepository
import org.codefreak.codefreak.service.EntityNotFoundException
import org.codefreak.codefreak.service.EvaluationStatusUpdatedEvent
import org.codefreak.codefreak.service.EvaluationStepStatusUpdatedEvent
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.ApplicationEventPublisher
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class EvaluationStepService {

  @Autowired
  private lateinit var eventPublisher: ApplicationEventPublisher

  @Autowired
  private lateinit var stepRepository: EvaluationStepRepository

  @Autowired
  private lateinit var runnerService: EvaluationRunnerService

  fun getEvaluationStep(stepId: UUID): EvaluationStep {
    return stepRepository.findById(stepId).orElseThrow {
      EntityNotFoundException("EvaluationStep $stepId could not be found")
    }
  }

  /**
   * Determine if an evaluation step has to be executed by a runner
   */
  fun stepNeedsExecution(step: EvaluationStep): Boolean {
    if (!runnerService.isAutomated(step.definition.runnerName)) {
      return false
    }
    // non-finished steps or errored steps can be executed again
    return step.status != EvaluationStepStatus.FINISHED || step.result === EvaluationStepResult.ERRORED
  }

  @Transactional
  fun updateEvaluationStepStatus(stepId: UUID, status: EvaluationStepStatus) {
    updateEvaluationStepStatus(getEvaluationStep(stepId), status)
  }

  @Transactional
  fun updateEvaluationStepStatus(step: EvaluationStep, status: EvaluationStepStatus) {
    // We do not check if the step is already in the given status on purpose.
    // This allows updating the finishedAt timestamp (used for comments).
    when (status) {
      EvaluationStepStatus.QUEUED -> step.queuedAt = Instant.now()
      EvaluationStepStatus.FINISHED -> step.finishedAt = Instant.now()
      else -> Unit // all other status do not have a timestamp atm
    }
    val evaluation = step.evaluation
    val originalEvaluationStatus = evaluation.stepStatusSummary
    step.status = status
    val newEvaluationStatus = evaluation.stepStatusSummary
    eventPublisher.publishEvent(EvaluationStepStatusUpdatedEvent(step, status))
    // check if status of evaluation has changed
    if (originalEvaluationStatus !== newEvaluationStatus) {
      eventPublisher.publishEvent(EvaluationStatusUpdatedEvent(evaluation, newEvaluationStatus))
    }
  }

  /**
   * Add a new evaluation step to the evaluation based on a given definition.
   * If a step with the same definition already exists, it will be replaced.
   */
  fun addStepToEvaluation(evaluation: Evaluation, stepDefinition: EvaluationStepDefinition): EvaluationStep {
    // remove existing step with this definition from evaluation
    evaluation.evaluationSteps.removeIf { it.definition == stepDefinition }
    // mark all manual steps as finished without a result
    // otherwise the overall evaluation status would be stuck at "pending"
    val initialStatus = when {
      !runnerService.isAutomated(stepDefinition.runnerName) -> EvaluationStepStatus.FINISHED
      else -> EvaluationStepStatus.PENDING
    }
    return EvaluationStep(stepDefinition, evaluation, initialStatus).also {
      evaluation.addStep(it)
    }
  }

  fun saveEvaluationStep(step: EvaluationStep) {
    stepRepository.save(step)
  }
}
