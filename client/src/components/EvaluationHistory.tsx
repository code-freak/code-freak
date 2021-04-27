import { ApolloClient, ApolloProvider, useApolloClient } from '@apollo/client'
import { Button, Card, Modal, Timeline } from 'antd'
import React from 'react'
import {
  EvaluationStepResult,
  EvaluationStepStatus,
  GetEvaluationHistoryQueryResult,
  useGetEvaluationHistoryQuery
} from '../generated/graphql'
import AsyncPlaceholder from './AsyncContainer'
import './EvaluationHistory.less'
import EvaluationResult from './EvaluationResult'
import { EvaluationErrorIcon } from './Icons'
import useEvaluationStatus from '../hooks/useEvaluationStatus'
import { isEvaluationInProgress } from '../services/evaluation'
import useHasAuthority from '../hooks/useHasAuthority'

const EvaluationHistory: React.FC<{ answerId: string }> = ({ answerId }) => {
  const result = useGetEvaluationHistoryQuery({ variables: { answerId } })
  const apolloClient = useApolloClient()

  const evaluationStatus = useEvaluationStatus(answerId)

  const authority = useHasAuthority('ROLE_TEACHER')

  if (result.data === undefined) {
    return <AsyncPlaceholder result={result} />
  }

  const {
    answer: { evaluations }
  } = result.data

  return (
    <Card className="evaluation-history">
      <Timeline
        reverse
        pending={
          isEvaluationInProgress(evaluationStatus) ? 'Running...' : undefined
        }
      >
        {evaluations.map(
          renderEvaluation(apolloClient, evaluationStatus, authority)
        )}
      </Timeline>
    </Card>
  )
}

const renderEvaluation = (
  apolloClient: ApolloClient<any>,
  evaluationStatus: EvaluationStepStatus | undefined,
  teacherAuthority: boolean
) => (
  evaluation: NonNullable<
    GetEvaluationHistoryQueryResult['data']
  >['answer']['evaluations'][0]
) => {
  const showDetails = () =>
    Modal.info({
      icon: null,
      content: (
        <ApolloProvider client={apolloClient}>
          <EvaluationResult
            evaluationStatus={evaluationStatus}
            evaluationId={evaluation.id}
            teacherAuthority={teacherAuthority}
          />
        </ApolloProvider>
      ),
      width: 800,
      maskClosable: true
    })

  return (
    <Timeline.Item
      key={evaluation.id}
      {...getDot(evaluation.stepsResultSummary)}
    >
      {new Date(evaluation.createdAt).toLocaleString()}{' '}
      <Button size="small" onClick={showDetails}>
        Details
      </Button>
    </Timeline.Item>
  )
}

const getDot = (result: EvaluationStepResult) => {
  switch (result) {
    case 'SUCCESS':
      return { color: 'green' }
    case 'FAILED':
      return { color: 'red' }
    case 'ERRORED':
      return { dot: <EvaluationErrorIcon style={{ fontSize: '16px' }} /> }
  }
}

export default EvaluationHistory
