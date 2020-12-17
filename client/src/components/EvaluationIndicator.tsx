import { Badge } from 'antd'
import React from 'react'
import { EvaluationErrorIcon } from './Icons'
import {
  EvaluationStepResult,
  EvaluationStepStatus
} from '../generated/graphql'
import useAnswerEvaluation from '../hooks/useAnswerEvaluation'

interface EvaluationIndicatorProps {
  style?: React.CSSProperties
  answerId: string
}

const EvaluationIndicator: React.FC<EvaluationIndicatorProps> = props => {
  const { answerId, style } = props
  const { latestEvaluation, evaluationStatus } = useAnswerEvaluation(answerId)

  if (
    evaluationStatus === EvaluationStepStatus.Running ||
    evaluationStatus === EvaluationStepStatus.Queued
  ) {
    return <Badge style={style} status="processing" />
  }

  if (latestEvaluation?.stepsResultSummary === EvaluationStepResult.Success) {
    return <Badge style={style} status="success" />
  }

  if (latestEvaluation?.stepsResultSummary === EvaluationStepResult.Failed) {
    return <Badge style={style} status="error" />
  }

  if (latestEvaluation?.stepsResultSummary === EvaluationStepResult.Errored) {
    return <EvaluationErrorIcon style={style} />
  }

  return <Badge style={style} status="default" />
}

export default EvaluationIndicator
