import { useState } from 'react'
import { Button, Card, Input, Modal, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { getEntityPath } from '../services/entity-path'
import { messageService } from '../services/message'
import { useHistory } from 'react-router-dom'
import {
  CreateAssignmentMutationResult,
  useAddTasksToAssignmentMutation,
  useCreateAssignmentMutation,
  useUpdateAssignmentMutation
} from '../services/codefreak-api'
import { extractTargetValue, noop } from '../services/util'
import { useInlineErrorMessage } from '../hooks/useInlineErrorMessage'
import TaskSelection from './TaskSelection'

type Assignment = NonNullable<
  CreateAssignmentMutationResult['data']
>['createAssignment']

const CreateAssignmentButton = () => {
  const history = useHistory()
  const [
    createEmptyAssignment,
    { loading: creating }
  ] = useCreateAssignmentMutation({
    context: { disableGlobalErrorHandling: true }
  })
  const [updateAssignment, { loading: updating }] = useUpdateAssignmentMutation(
    {
      context: { disableGlobalErrorHandling: true }
    }
  )
  const [addTasks, { loading: addingTasks }] = useAddTasksToAssignmentMutation()
  const [modalVisible, setModalVisible] = useState(false)
  const showModal = () => {
    setTitle('')
    setSelectedTaskIds([])
    setModalVisible(true)
  }
  const hideModal = () => setModalVisible(false)
  const [title, setTitle] = useState<string>('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [inlineError, setErrorMessage] = useInlineErrorMessage(
    'Error while creating assignment'
  )
  const okButtonDisabled = title.length === 0

  const createAssignment = async () => {
    createEmptyAssignment()
      .then(async result => {
        if (result.data) {
          const assignment = result.data.createAssignment
          if (title.length > 0) {
            await updateAssignmentTitle(assignment)
          }
          if (selectedTaskIds.length > 0) {
            await addTasksToAssignment(assignment)
          }
          redirectToAssignmentPage(assignment)
        }
      })
      .catch(error => setErrorMessage(error.message))
  }

  const updateAssignmentTitle = async (assignment: Assignment) => {
    await updateAssignment({
      variables: {
        id: assignment.id,
        title,
        active: false
      }
    }).catch(error => setErrorMessage(error.message))
  }

  const addTasksToAssignment = async (assignment: Assignment) => {
    await addTasks({
      variables: { assignmentId: assignment.id, taskIds: selectedTaskIds }
    }).catch(error => setErrorMessage(error.message))
  }

  const redirectToAssignmentPage = (assignment: Assignment) => {
    history.push(getEntityPath(assignment))
    messageService.success('Assignment created')
  }

  const titleInput = modalVisible ? ( // re-create for autoFocus
    <Input
      onPressEnter={okButtonDisabled ? noop : createAssignment}
      autoFocus
      value={title}
      placeholder="Set the title of the assignment here"
      onChange={extractTargetValue(setTitle)}
    />
  ) : null

  const createAssignmentButton = (
    <Button icon={<PlusOutlined />} type="primary" onClick={showModal}>
      Create Assignment
    </Button>
  )

  const taskSelection = (
    <TaskSelection
      selectedTaskIds={selectedTaskIds}
      setSelectedTaskIds={setSelectedTaskIds}
    />
  )

  const modal = (
    <Modal
      title="Create assignment"
      visible={modalVisible}
      onOk={createAssignment}
      okText="Create Assignment"
      okButtonProps={{
        disabled: okButtonDisabled,
        loading: creating || updating || addingTasks,
        title: okButtonDisabled ? 'The assignment needs a title!' : undefined
      }}
      onCancel={hideModal}
      width={800}
    >
      <Space direction="vertical">
        {inlineError}
        {titleInput}
        <Card>{taskSelection}</Card>
      </Space>
    </Modal>
  )

  return (
    <>
      {createAssignmentButton}
      {modal}
    </>
  )
}

export default CreateAssignmentButton
