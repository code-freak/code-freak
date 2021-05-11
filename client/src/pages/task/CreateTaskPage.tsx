import { PageHeaderWrapper } from '@ant-design/pro-layout'
import { Alert, Button, Card, Col, Row } from 'antd'
import { useHistory } from 'react-router-dom'
import { TaskTemplate, useCreateTaskMutation } from '../../generated/graphql'
import { Entity, getEntityPath } from '../../services/entity-path'
import { messageService } from '../../services/message'
import { getAllTemplates } from '../../services/templates'

const CreateTaskPage: React.FC = () => {
  const taskTemplates = getAllTemplates()
  const [createTaskMutation] = useCreateTaskMutation()
  const history = useHistory()

  const onTaskCreated = (task: Entity) => {
    history.push(getEntityPath(task))
    messageService.success('Task created')
  }

  const createTask = (template?: TaskTemplate) => async () => {
    const result = await createTaskMutation({ variables: { template } })
    if (result.data) {
      onTaskCreated(result.data.createTask)
    }
  }

  return (
    <>
      <PageHeaderWrapper />
      <Alert
        message="Tasks can only be created in the task pool. You can later add them to any assignment."
        style={{ marginBottom: 16 }}
      />
      <Row gutter={16}>
        <TaskTemplateCard
          key="empty-task"
          title="Empty"
          description="Start from scratch"
          logo={
            <img
              alt="Empty task logo"
              src={`${process.env.PUBLIC_URL}/from-scratch-logo.svg`}
            />
          }
          callToActionTitle="Create empty task"
          onCallToAction={createTask()}
        />
        {(Object.keys(taskTemplates) as TaskTemplate[]).map(templateKey => {
          const template = taskTemplates[templateKey]
          return (
            <TaskTemplateCard
              key={templateKey}
              title={template.title}
              description={template.description}
              logo={<template.logo className="language-logo" />}
              callToActionTitle="Use this template"
              onCallToAction={createTask(templateKey)}
            />
          )
        })}
      </Row>
      <div style={{ marginBottom: 16 }}>
        <i>All trademarks are the property of their respective owners.</i>
      </div>
    </>
  )
}

interface TaskTemplateCardProps {
  title: string
  description: string
  logo: React.ReactNode
  callToActionTitle: string
  onCallToAction: () => void
}

const TaskTemplateCard = (props: TaskTemplateCardProps) => (
  <Col xs={24} sm={12} md={6} xl={4} style={{ marginBottom: 16 }}>
    <Card
      cover={<div style={{ padding: '2em 2em 0' }}>{props.logo}</div>}
      actions={[
        <Button key="1" type="primary" onClick={props.onCallToAction}>
          {props.callToActionTitle}
        </Button>
      ]}
    >
      <Card.Meta title={props.title} description={props.description} />
    </Card>
  </Col>
)

export default CreateTaskPage
