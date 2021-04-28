import { PageHeaderWrapper } from '@ant-design/pro-layout'
import {
  CaretDownOutlined,
  PlusOutlined,
  CaretRightOutlined
} from '@ant-design/icons'
import {
  Button,
  DatePicker,
  Descriptions,
  Dropdown,
  Form,
  Menu,
  Modal,
  Steps,
  TimePicker
} from 'antd'
import { DropdownButtonProps } from 'antd/es/dropdown/dropdown-button'
import moment, { Moment, unitOfTime } from 'moment'
import { useCallback, useState } from 'react'
import { Route, Switch, useHistory, useRouteMatch } from 'react-router-dom'
import { debounce } from 'ts-debounce'
import ArchiveDownload from '../../components/ArchiveDownload'
import AssignmentStatusTag from '../../components/AssignmentStatusTag'
import AsyncPlaceholder from '../../components/AsyncContainer'
import Authorized from '../../components/Authorized'
import { createBreadcrumb } from '../../components/DefaultLayout'
import EditableTitle from '../../components/EditableTitle'
import SetTitle from '../../components/SetTitle'
import TimeIntervalInput, {
  TimeIntervalInputProps
} from '../../components/TimeIntervalInput'
import useAssignmentStatusChange from '../../hooks/useAssignmentStatusChange'
import { useFormatter } from '../../hooks/useFormatter'
import useHasAuthority from '../../hooks/useHasAuthority'
import useIdParam from '../../hooks/useIdParam'
import { useServerMoment } from '../../hooks/useServerTimeOffset'
import useSubPath from '../../hooks/useSubPath'
import {
  Assignment,
  AssignmentStatus,
  GetTaskListDocument,
  UpdateAssignmentMutationVariables,
  useAddTasksToAssignmentMutation,
  useGetAssignmentQuery,
  useUpdateAssignmentMutation
} from '../../services/codefreak-api'
import { getEntityPath } from '../../services/entity-path'
import { messageService } from '../../services/message'
import {
  componentsToSeconds,
  momentToIsoCb,
  secondsToComponents,
  secondsToRelTime
} from '../../services/time'
import { makeUpdater, noop, Updater } from '../../services/util'
import NotFoundPage from '../NotFoundPage'
import SubmissionListPage from '../submission/SubmissionListPage'
import TaskListPage from '../task/TaskListPage'
import './AssignmentPage.less'
import { useCreateRoutes } from '../../hooks/useCreateRoutes'
import { ShareAssignmentButton } from '../../components/ShareAssignmentButton'
import TimeLimitTag from '../../components/time-limit/TimeLimitTag'
import TaskSelection from '../../components/TaskSelection'
import ModificationTime from '../../components/ModificationTime'

const { Step } = Steps

const activeStep = {
  INACTIVE: 0,
  ACTIVE: 1,
  OPEN: 2,
  CLOSED: 3
}

const AssignmentPage: React.FC = () => {
  const assignmentId = useIdParam()
  const { path } = useRouteMatch()
  const result = useGetAssignmentQuery({
    variables: { id: assignmentId }
  })
  const subPath = useSubPath()
  const formatter = useFormatter()
  const createRoutes = useCreateRoutes()
  const [updateMutation] = useUpdateAssignmentMutation({
    onCompleted: () => {
      result.refetch()
      messageService.success('Assignment updated')
    }
  })

  useAssignmentStatusChange(
    assignmentId,
    useCallback(() => {
      result.refetch()
    }, [result])
  )

  const tabs = [{ key: '', tab: 'Tasks' }]
  if (useHasAuthority('ROLE_TEACHER')) {
    tabs.push({ key: '/submissions', tab: 'Submissions' })
  }

  if (result.data === undefined) {
    return <AsyncPlaceholder result={result} />
  }

  const { assignment } = result.data
  const { submission } = assignment

  const assignmentInput: UpdateAssignmentMutationVariables = {
    id: assignment.id,
    title: assignment.title,
    active: assignment.active,
    deadline: assignment.deadline,
    openFrom: assignment.openFrom,
    timeLimit: assignment.timeLimit
  }

  const updater = makeUpdater(assignmentInput, variables =>
    updateMutation({ variables })
  )

  const renderDate = (
    label: string,
    onOk: (date?: string) => void,
    value?: string | null
  ) => {
    const handleClear = (v: Moment | null) => (v === null ? onOk() : noop())
    return assignment.editable ? (
      <Descriptions.Item label={label}>
        <DatePicker
          key={'' + value}
          showTime
          onChange={handleClear}
          defaultValue={value ? moment(value) : undefined}
          onOk={momentToIsoCb(onOk)}
        />
      </Descriptions.Item>
    ) : value ? (
      <Descriptions.Item label={label}>
        {formatter.dateTime(value)}
      </Descriptions.Item>
    ) : null
  }

  const updateTimeLimit = updater('timeLimit')
  const onTimeLimitChange: TimeIntervalInputProps['onChange'] = async limit => {
    const seconds = limit ? componentsToSeconds(limit) : 0
    await updateTimeLimit(seconds > 0 ? seconds : null)
  }

  const timeLimitInput = (
    <TimeIntervalInput
      onChange={debounce(onTimeLimitChange, 500)}
      defaultValue={
        assignment.timeLimit
          ? secondsToComponents(assignment.timeLimit)
          : undefined
      }
      nullable
    />
  )

  const deadline = submission?.deadline
    ? moment(submission.deadline)
    : undefined
  const timeLimitTag = assignment.timeLimit
    ? [
        <TimeLimitTag
          key="time-limit"
          timeLimit={assignment.timeLimit}
          deadline={deadline}
        />
      ]
    : []

  const assignmentTags = [
    <AssignmentStatusTag key="assignment-status" status={assignment.status} />,
    ...timeLimitTag
  ]

  return (
    <>
      <SetTitle>{assignment.title}</SetTitle>
      <PageHeaderWrapper
        title={
          <EditableTitle
            editable={assignment.editable}
            title={assignment.title}
            onChange={updater('title')}
          />
        }
        tags={assignmentTags}
        tabList={tabs}
        tabActiveKey={subPath.get()}
        breadcrumb={createBreadcrumb(createRoutes.forAssignment(assignment))}
        onTabChange={subPath.set}
        extra={
          <Authorized condition={assignment.editable}>
            <ShareAssignmentButton />
            <ArchiveDownload url={assignment.exportUrl}>
              Export Assignment
            </ArchiveDownload>
            <AddTasksButton assignment={assignment} />
          </Authorized>
        }
        content={
          <>
            <Descriptions className="assignment-dates" size="small" column={4}>
              <Descriptions.Item label="Updated">
                <ModificationTime
                  updated={new Date(assignment.updatedAt)}
                  created={new Date(assignment.createdAt)}
                />
              </Descriptions.Item>
              {renderDate(
                'Open From',
                updater('openFrom'),
                assignment.openFrom
              )}
              {renderDate('Deadline', updater('deadline'), assignment.deadline)}
              <Descriptions.Item label="Time Limit">
                {assignment.editable
                  ? timeLimitInput
                  : assignment.timeLimit
                  ? secondsToRelTime(assignment.timeLimit)
                  : 'none'}
              </Descriptions.Item>
            </Descriptions>
            <Authorized condition={assignment.editable}>
              <StatusSteps
                input={assignmentInput}
                mutation={updateMutation}
                status={assignment.status}
                updater={updater}
              />
            </Authorized>
          </>
        }
      />
      <Switch>
        <Route exact path={path} component={TaskListPage} />
        <Route path={`${path}/submissions`} component={SubmissionListPage} />
        <Route component={NotFoundPage} />
      </Switch>
    </>
  )
}

const StatusSteps: React.FC<{
  status: AssignmentStatus
  updater: Updater<UpdateAssignmentMutationVariables>
  input: UpdateAssignmentMutationVariables
  mutation: (args: { variables: UpdateAssignmentMutationVariables }) => void
}> = props => {
  const { status, updater, mutation, input } = props
  const [stepsExpanded, setStepsExpanded] = useState(false)
  const toggleStepsExpanded = () => setStepsExpanded(!stepsExpanded)

  const closeNow = () =>
    mutation({
      variables: { ...input, deadline: moment().toISOString() }
    })

  const activate = () => updater('active')(true)
  const deactivate = () => updater('active')(false)

  const caretDown = <CaretDownOutlined />
  const caretRight = <CaretRightOutlined />

  return (
    <div className="statusSteps">
      <Button
        onClick={toggleStepsExpanded}
        icon={stepsExpanded ? caretDown : caretRight}
        size="small"
        style={{ marginRight: 16, marginTop: 4 }}
      />
      <div
        style={{ flexGrow: 1 }}
        className={stepsExpanded ? 'wrapper' : 'wrapper notExpanded'}
        onClick={stepsExpanded ? undefined : toggleStepsExpanded}
      >
        <Steps size="small" current={activeStep[status]}>
          <Step
            title="Inactive"
            description={
              stepsExpanded ? (
                <>
                  <p>The assignment is not public yet. Only you can see it.</p>
                  <Button disabled={status === 'INACTIVE'} onClick={deactivate}>
                    Deactivate
                  </Button>
                </>
              ) : undefined
            }
          />
          <Step
            title="Active"
            description={
              stepsExpanded ? (
                <>
                  <p>
                    The assignment is public. Students can see it but not work
                    on it yet.
                  </p>
                  <Button
                    type={status === 'INACTIVE' ? 'primary' : 'default'}
                    disabled={status === 'ACTIVE' || status === 'OPEN'}
                    onClick={activate}
                  >
                    Activate
                  </Button>
                </>
              ) : undefined
            }
          />
          <Step
            title="Open"
            description={
              stepsExpanded ? (
                <>
                  <p>
                    The assignment is open for submissions. If a deadline is
                    set, it will be closed automatically.
                  </p>
                  <OpenAssignmentButton
                    input={input}
                    mutation={mutation}
                    disabled={status === 'OPEN'}
                    type={status === 'ACTIVE' ? 'primary' : undefined}
                  />
                </>
              ) : undefined
            }
          />
          <Step
            title="Closed"
            description={
              stepsExpanded ? (
                <>
                  <p>
                    The assignment is closed. Students can still see it but not
                    change their submissions.
                  </p>
                  <Button
                    onClick={closeNow}
                    disabled={status === 'CLOSED'}
                    type={status === 'OPEN' ? 'primary' : 'default'}
                  >
                    Close Now
                  </Button>
                </>
              ) : undefined
            }
          />
        </Steps>
      </div>
    </div>
  )
}

const AddTasksButton: React.FC<{
  assignment: Pick<Assignment, 'id' | 'title'>
}> = ({ assignment }) => {
  const [modalVisible, setModalVisible] = useState(false)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const showModal = () => {
    setTaskIds([])
    setModalVisible(true)
  }
  const hideModal = () => setModalVisible(false)
  const [addTasks, addTasksResult] = useAddTasksToAssignmentMutation()
  const history = useHistory()
  const submit = async () => {
    await addTasks({
      variables: { assignmentId: assignment.id, taskIds },
      refetchQueries: [
        {
          query: GetTaskListDocument,
          variables: { assignmentId: assignment.id }
        }
      ]
    })
    hideModal()
    messageService.success('Tasks added')
    const tasksPath = getEntityPath(assignment)
    if (history.location.pathname !== tasksPath) {
      history.push(tasksPath)
    }
  }

  const taskSelection = (
    <TaskSelection selectedTaskIds={taskIds} setSelectedTaskIds={setTaskIds} />
  )

  return (
    <>
      <Button type="primary" icon={<PlusOutlined />} onClick={showModal}>
        Add Tasks
      </Button>
      <Modal
        visible={modalVisible}
        width={700}
        onCancel={hideModal}
        title={`Add tasks to ${assignment.title}`}
        okButtonProps={{
          disabled: taskIds.length === 0,
          loading: addTasksResult.loading,
          title:
            taskIds.length === 0 ? "You haven't selected any tasks!" : undefined
        }}
        onOk={submit}
      >
        {taskSelection}
      </Modal>
    </>
  )
}

const OpenAssignmentButton: React.FC<
  {
    input: UpdateAssignmentMutationVariables
    mutation: (args: { variables: UpdateAssignmentMutationVariables }) => void
  } & Omit<DropdownButtonProps, 'overlay'>
> = ({ input, mutation, ...buttonProps }) => {
  const [modalVisible, setModalVisible] = useState(false)
  const serverMoment = useServerMoment()
  const [from, setFrom] = useState(serverMoment())
  const [period, setPeriod] = useState(moment('00:30:00', 'HH:mm:ss'))

  const onPeriodChange = (value: Moment | null) => {
    if (value) {
      setPeriod(value)
    }
  }

  const showModal = () => {
    setFrom(serverMoment())
    setPeriod(moment('00:30:00', 'HH:mm:ss'))
    setModalVisible(true)
  }
  const hideModal = () => setModalVisible(false)
  const submit = () => {
    mutation({
      variables: {
        ...input,
        active: true,
        openFrom: from.toISOString(),
        deadline: from
          .add(
            period.hours() * 60 * 60 + period.minutes() * 60 + period.seconds(),
            'seconds'
          )
          .toISOString()
      }
    })
    hideModal()
  }

  const isInPast = (date: Moment | null, resolution?: unitOfTime.StartOf) =>
    (date && date.isBefore(serverMoment(), resolution)) || false

  const openNow = () => {
    const variables = {
      ...input,
      active: true,
      openFrom: moment().toISOString()
    }
    if (variables.deadline && isInPast(moment(variables.deadline))) {
      delete variables.deadline
    }
    mutation({ variables })
  }

  const onChangeDate = (date: Moment | null) => date && setFrom(date)
  const isBeforeToday = (date: Moment | null) => isInPast(date, 'days')
  return (
    <>
      <Dropdown.Button
        style={{ marginRight: 8 }}
        onClick={openNow}
        overlay={
          <Menu>
            <Menu.Item key="1" onClick={showModal}>
              Open for specific period
            </Menu.Item>
          </Menu>
        }
        {...buttonProps}
      >
        Open Now
      </Dropdown.Button>
      <Modal
        visible={modalVisible}
        onCancel={hideModal}
        title="Open submissions for specific period of time"
        okButtonProps={{
          disabled: period.minutes() < 1
        }}
        onOk={submit}
      >
        <Form labelCol={{ span: 6 }}>
          <Form.Item label="From">
            <DatePicker
              showTime
              allowClear={false}
              value={from}
              onChange={onChangeDate}
              disabledDate={isBeforeToday}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }} label="For">
            <TimePicker
              allowClear={false}
              onChange={onPeriodChange}
              value={period}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}

export default AssignmentPage
