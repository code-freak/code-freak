import { Col, Row, Table, Tooltip } from 'antd'
import {GetScoreboardByAssignmentIdQuery, GradeScoreboard} from '../../generated/graphql'
import '../SubmissionsTable.less'
import EditNickname from './EditNickname'
import React from 'react'
import Icon from "@ant-design/icons";

type AssignmentScoreboard = NonNullable<
  GetScoreboardByAssignmentIdQuery['scoreboardByAssignmentId']
>

type SubmissionsScoreboard = AssignmentScoreboard['submissionsScoreboard'][number]
type AnswersScoreboard = SubmissionsScoreboard['answersScoreboard'][number]
type TaskScoreboard = AssignmentScoreboard['tasksScoreboard'][number]

const { Column } = Table

const alphabeticSorter = (
  extractProperty: (x: SubmissionsScoreboard) => string | null | undefined
) => (a: SubmissionsScoreboard, b: SubmissionsScoreboard) => {
  const valA = extractProperty(a) || 0
  const valB = extractProperty(b) || 0
  return typeof valA !== "number" ? valA?.localeCompare(valB as string) : valA
}

const numericSorter = (
  extractProperty: (x: GradeScoreboard) => number
) => (a: GradeScoreboard, b: GradeScoreboard) => {
    const valA = extractProperty(a)
    const valB = extractProperty(b)
    return (valA>=valB) ? valA : valB
}

const ScoreboardTable: React.FC<{
  scoreboardByAssignmentId: AssignmentScoreboard
  fetchScoreboard: any
}> = props => {
  const assignments = props.scoreboardByAssignmentId
  const allSubmissions = assignments.submissionsScoreboard

  const titleFunc = () => {
    return (
      <Row gutter={16}>
        <Col span={6}>
          <EditNickname editable onChange={props.fetchScoreboard} />
        </Col>
      </Row>
    )
  }

  // 700px = width of first columns
  // 200px = min width for each task column
  const scrollX = assignments.submissionsScoreboard.length * 100


  return (
    <Table
      dataSource={allSubmissions}
      pagination={{
        pageSize: 100,
        hideOnSinglePage: true
      }}
      bordered
      className="submissions-table"
      rowKey="id"
      title={titleFunc}
      scroll={{
        x: scrollX
      }}
    >
      <Column
        title="Nickname"
        dataIndex={['useralias','alias']}
        width={200}
        fixed="left"
        defaultSortOrder="ascend"
        sorter={alphabeticSorter(submission => submission.useralias.alias)}
      />
      {taskColumnRenderer(assignments.tasksScoreboard,assignments.submissionsScoreboard)}
    </Table>
  )
}

const getAnswerFromSubmission = (
  submission: SubmissionsScoreboard,
  taskScoreboard: TaskScoreboard
): AnswersScoreboard | undefined =>
  submission.answersScoreboard.find(
    candidate => candidate.taskScoreboard.id === taskScoreboard.id
  )

const taskColumnRenderer = (tasks: TaskScoreboard[], submission: SubmissionsScoreboard[]) => {



  const renderAnswer = (
    task: TaskScoreboard,
    submission: SubmissionsScoreboard
  ) => {
    // There should always be a grade defined
    if (getAnswerFromSubmission(submission, task) !== undefined) {
      const grade = getAnswerFromSubmission(submission, task)!!.gradeScoreboard
      if (grade === null || !grade?.calculated) {
        return (
          <Tooltip title="No Grade Calculated">
            <Icon type="stop" className="no-answer" />
          </Tooltip>
        )
      } else {
        return (
          <div>
            {(Math.round(grade.gradePercentage * 100) / 100).toFixed(2)}%
          </div>
        )
      }
    }
  }

  // column width is determined by scrollX of the table
  return tasks.map(task => {
    return (
      <Column
        key={`task-${task.id}`}
        title={task.title}
        align="center"
        render={renderAnswer.bind(submission, task)}
        sorter={numericSorter(x => x.gradePercentage)}
        defaultSortOrder={"ascend"}
      />
    )
  })
}

export default ScoreboardTable
