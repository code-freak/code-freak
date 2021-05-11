import { DeleteOutlined, FolderOpenOutlined } from '@ant-design/icons'
import { Button, Modal, Tooltip } from 'antd'
import { CardProps } from 'antd/lib/card'
import React from 'react'
import {
  TaskListItemFragment,
  useDeleteTaskMutation,
  useSetTaskPositonMutation
} from '../services/codefreak-api'
import { messageService } from '../services/message'
import CardList from './CardList'
import CropContainer from './CropContainer'
import EntityLink from './EntityLink'
import EvaluationIndicator from './EvaluationIndicator'
import ModificationTime from './ModificationTime'
import Authorized from './Authorized'
import Markdown from './Markdown'

const { confirm } = Modal

type Task = TaskListItemFragment & {
  answer?: {
    id: string
  } | null
}

interface RenderProps {
  delete: (taskId: string) => Promise<unknown>
}

const renderTask = (props: RenderProps) => (task: Task) => {
  const confirmDelete = () =>
    confirm({
      title: 'Are you sure?',
      content: task.inPool
        ? 'You are deleting this task from the task pool. This cannot be undone!'
        : 'You are removing this task from the assignment. The original template will stay in the task pool. All other data (including student submissions) will be lost.',
      async onOk() {
        await props.delete(task.id)
      }
    })

  const updatedAtTag = (
    <span style={{ marginRight: '1em' }}>
      Last Updated:{' '}
      <ModificationTime
        updated={new Date(task.updatedAt)}
        created={new Date(task.createdAt)}
      />
    </span>
  )

  const cardProps: CardProps = {
    title: (
      <>
        {task.title}
        {task.answer ? (
          <EvaluationIndicator
            style={{ marginLeft: 8 }}
            answerId={task.answer.id}
          />
        ) : null}
      </>
    ),
    extra: (
      <>
        <Authorized authority="ROLE_TEACHER">{updatedAtTag}</Authorized>
        {task.editable ? (
          <Tooltip
            title={task.inPool ? 'Delete from pool' : 'Remove from assignment'}
            placement="left"
          >
            <Button
              onClick={confirmDelete}
              type="dashed"
              shape="circle"
              icon={<DeleteOutlined />}
            />
          </Tooltip>
        ) : null}
      </>
    ),
    children: (
      <>
        {task.body ? (
          <CropContainer maxHeight={100}>
            <Markdown>{task.body}</Markdown>
          </CropContainer>
        ) : null}
        <EntityLink to={task} sub={task.answer ? '/answer' : undefined}>
          <Button icon={<FolderOpenOutlined />} type="primary">
            Details
          </Button>
        </EntityLink>
      </>
    )
  }

  return cardProps
}

interface TaskListProps {
  tasks: Task[]
  update: () => void
  sortable?: boolean
}

const TaskList: React.FC<TaskListProps> = props => {
  const [deleteTask] = useDeleteTaskMutation()
  const [setTaskPosition] = useSetTaskPositonMutation()
  const renderProps: RenderProps = {
    delete: async (id: string) => {
      const result = await deleteTask({ variables: { id } })
      if (result.data) {
        messageService.success('Task removed')
        props.update()
      }
    }
  }

  const handlePositionChange = (task: Task, newPosition: number) =>
    setTaskPosition({
      variables: { id: task.id, position: newPosition }
    }).then(() => messageService.success('Order updated'))

  return (
    <CardList
      sortable={props.sortable}
      items={props.tasks}
      renderItem={renderTask(renderProps)}
      handlePositionChange={handlePositionChange}
    />
  )
}

export default TaskList
