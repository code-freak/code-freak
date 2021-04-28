import {
  DeleteOutlined,
  PlusOutlined,
  SettingOutlined
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Modal,
  Switch,
  Tag,
  Tooltip
} from 'antd'
import { ButtonProps } from 'antd/lib/button'
import { CardProps } from 'antd/lib/card'
import { CheckboxChangeEvent } from 'antd/lib/checkbox'
import { JSONSchema6 } from 'json-schema'
import YAML from 'json-to-pretty-yaml'
import { useState } from 'react'
import AsyncPlaceholder from '../../components/AsyncContainer'
import CardList from '../../components/CardList'
import SyntaxHighlighter from '../../components/code/SyntaxHighlighter'
import EditableTitle from '../../components/EditableTitle'
import JsonSchemaEditButton from '../../components/JsonSchemaEditButton'
import {
  EvaluationRunner,
  EvaluationStepDefinitionInput,
  GetEvaluationStepDefinitionsQueryResult,
  useCreateEvaluationStepDefinitionMutation,
  useDeleteEvaluationStepDefinitionMutation,
  useGetEvaluationStepDefinitionsQuery,
  useSetEvaluationStepDefinitionPositonMutation,
  useUpdateEvaluationStepDefinitionMutation
} from '../../services/codefreak-api'
import { messageService } from '../../services/message'
import { makeUpdater } from '../../services/util'
import TimeIntervalInput from '../../components/TimeIntervalInput'
import useSystemConfig from '../../hooks/useSystemConfig'
import {
  componentsToSeconds,
  secondsToComponents,
  secondsToRelTime,
  TimeComponents
} from '../../services/time'
import HelpTooltip from '../../components/HelpTooltip'
import { debounce } from 'ts-debounce'

type EvaluationStepDefinition = NonNullable<
  GetEvaluationStepDefinitionsQueryResult['data']
>['task']['evaluationStepDefinitions'][0]

const parseSchema = (schema: string) => {
  const optionsSchema: JSONSchema6 = JSON.parse(schema)
  const hasProperties =
    optionsSchema.properties && Object.keys(optionsSchema.properties).length > 0
  return { optionsSchema, hasProperties }
}

const EditEvaluationPage: React.FC<{ taskId: string }> = ({ taskId }) => {
  const result = useGetEvaluationStepDefinitionsQuery({ variables: { taskId } })
  const { data: defaultEvaluationTimeout } = useSystemConfig(
    'defaultEvaluationTimeout'
  )
  const [deleteStep] = useDeleteEvaluationStepDefinitionMutation({
    onCompleted: () => {
      messageService.success('Evaluation step deleted')
      result.refetch()
    }
  })
  const [
    setEvaluationStepDefinitionPosition
  ] = useSetEvaluationStepDefinitionPositonMutation()

  const [updateMutation] = useUpdateEvaluationStepDefinitionMutation({
    onCompleted: () => {
      result.refetch()
      messageService.success('Step updated')
    }
  })

  const [createStep] = useCreateEvaluationStepDefinitionMutation()

  const [sureToEdit, setSureToEdit] = useState(false)
  const onSureToEditChange = (e: CheckboxChangeEvent) =>
    setSureToEdit(e.target.checked)

  if (result.data === undefined) {
    return <AsyncPlaceholder result={result} />
  }

  const {
    task: { evaluationStepDefinitions, assignment },
    evaluationRunners
  } = result.data

  const assignmentOpen = assignment?.status === 'OPEN'

  const handlePositionChange = (
    definition: EvaluationStepDefinition,
    newPosition: number
  ) =>
    setEvaluationStepDefinitionPosition({
      variables: { id: definition.id, position: newPosition }
    }).then(() => messageService.success('Order updated'))

  const renderEvaluationStepDefinition = (
    definition: EvaluationStepDefinition
  ) => {
    const definitionInput: EvaluationStepDefinitionInput = {
      id: definition.id,
      active: definition.active,
      title: definition.title,
      options: definition.options
    }

    const runner = evaluationRunners.find(r => r.name === definition.runnerName)

    if (!runner) {
      return <>Unknown Runner '{definition.runnerName}'</>
    }
    const { optionsSchema, hasProperties } = parseSchema(runner.optionsSchema)

    const updater = makeUpdater(definitionInput, input =>
      updateMutation({ variables: { input } })
    )

    const confirmDelete = () =>
      Modal.confirm({
        title: 'Are you sure?',
        width: 600,
        content: (
          <>
            <p>
              Do you want to delete this evaluation step? Custom configuration
              will be lost!
            </p>
            <Alert message="This will fail if the evaluation has already been run since this step was added. This is because it is referenced by the generated feedback. If you are in testing mode, exit it to delete your answer. You can always deactivate a step to exclude it from future evaluations." />
          </>
        ),
        async onOk() {
          try {
            await deleteStep({ variables: { id: definition.id } })
          } catch (e) {
            /* Close modal on error */
          }
        }
      })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateOptions = (newOptions: any) =>
      updater('options')(JSON.stringify(newOptions))
    const updateTimeout = debounce(updater('timeout'), 500)

    const configureButtonProps: ButtonProps = {
      type: 'primary',
      shape: 'circle',
      icon: <SettingOutlined />
    }

    const onTimeIntervalChange = (timeoutComps?: TimeComponents) => {
      const timeout = timeoutComps
        ? componentsToSeconds(timeoutComps)
        : undefined
      return updateTimeout(timeout)
    }
    const cardProps: CardProps = {
      title: (
        <EditableTitle
          editable
          title={definition.title}
          onChange={updater('title')}
        />
      ),
      extra: (
        <>
          {runner.builtIn ? null : (
            <Tooltip title="Delete evaluation step" placement="left">
              <Button
                style={{ marginRight: 8 }}
                onClick={confirmDelete}
                type="dashed"
                shape="circle"
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          )}
          {hasProperties ? (
            <JsonSchemaEditButton
              title={`Configure ${definition.runnerName} step`}
              value={JSON.parse(definition.options)}
              schema={optionsSchema}
              onSubmit={updateOptions}
              buttonProps={{
                ...configureButtonProps,
                disabled: assignmentOpen && !sureToEdit
              }}
            />
          ) : (
            <Tooltip
              placement="left"
              title="This runner does not have any configuration options"
            >
              <Button disabled {...configureButtonProps} />
            </Tooltip>
          )}
        </>
      ),
      children: (
        <>
          <Descriptions layout="horizontal" style={{ marginBottom: -8 }}>
            <Descriptions.Item label="Runner">
              {definition.runnerName}{' '}
              {runner.builtIn ? (
                <Tooltip
                  placement="right"
                  title="Built-in evaluation steps cannot be deleted. You can still hide them from students by deactivating."
                >
                  <Tag>built-in</Tag>
                </Tooltip>
              ) : null}{' '}
              {runner.documentationUrl ? (
                <>
                  (
                  <a
                    href={runner.documentationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Documentation
                  </a>
                  )
                </>
              ) : null}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <HelpTooltip
                  placement="right"
                  title="If disabled, this evaluation step will not be run in future evaluation. Feedback for this step is hidden from students in existing evaluations."
                >
                  Active
                </HelpTooltip>
              }
            >
              <Switch
                checked={definition.active}
                onChange={updater('active')}
                disabled={assignmentOpen && !sureToEdit}
              />
            </Descriptions.Item>
            {runner.stoppable ? (
              <Descriptions.Item
                label={
                  <HelpTooltip
                    title={`There is always a default time limit of ${secondsToRelTime(
                      defaultEvaluationTimeout || 0
                    )}. You can modify this timeout here.`}
                  >
                    Custom Time Limit
                  </HelpTooltip>
                }
              >
                <TimeIntervalInput
                  nullable
                  onChange={onTimeIntervalChange}
                  defaultValue={
                    definition.timeout
                      ? secondsToComponents(definition.timeout)
                      : undefined
                  }
                  placeholder={
                    defaultEvaluationTimeout
                      ? secondsToComponents(defaultEvaluationTimeout)
                      : undefined
                  }
                />
              </Descriptions.Item>
            ) : null}
          </Descriptions>
          {definition.options !== '{}' ? (
            <SyntaxHighlighter language="yaml" noLineNumbers>
              {YAML.stringify(JSON.parse(definition.options))}
            </SyntaxHighlighter>
          ) : null}
        </>
      )
    }
    return cardProps
  }

  const addableRunners = evaluationRunners.filter(r => !r.builtIn)

  const onCreate = (runnerName: string, options: string) =>
    createStep({ variables: { taskId, runnerName, options } }).then(() => {
      messageService.success('Evaluation step added')
      result.refetch()
    })

  return (
    <>
      <Alert
        message={
          <>
            Here you can configure the automatic evaluation. Only you as a
            teacher can see this. To try it out, enable testing mode and start
            the evaluation.
            <br />
            The order of evaluation steps determines the order of the feedback
            displayed to students.
          </>
        }
        style={{ marginBottom: 16 }}
      />
      {assignmentOpen ? (
        <Alert
          style={{ marginBottom: 16 }}
          message="Warning"
          description={
            <>
              The assignment is already open. If you make changes to the
              configuration, all evaluations are marked as out of date and must
              be re-run. <Checkbox onChange={onSureToEditChange} /> I understand
              this and want to do it anyway
            </>
          }
          type="warning"
          showIcon
        />
      ) : null}
      <CardList
        sortable
        items={evaluationStepDefinitions}
        renderItem={renderEvaluationStepDefinition}
        handlePositionChange={handlePositionChange}
      />
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <h3>Add Evaluation Step</h3>
        {addableRunners.map(renderAddStepButton(onCreate))}
      </div>
    </>
  )
}

const renderAddStepButton = (
  onCreate: (runnerName: string, options: string) => Promise<unknown>
) => (
  runner: Pick<EvaluationRunner, 'name' | 'defaultTitle' | 'optionsSchema'>
) => {
  const { optionsSchema, hasProperties } = parseSchema(runner.optionsSchema)
  const buttonProps: ButtonProps = {
    type: 'dashed',
    icon: <PlusOutlined />,
    children: runner.defaultTitle,
    style: { margin: '0 4px' }
  }
  const createStepWithoutOptions = () => createStep({})
  const createStep = (options: unknown) =>
    onCreate(runner.name, JSON.stringify(options))
  if (!hasProperties) {
    return (
      <Button
        key={runner.name}
        {...buttonProps}
        onClick={createStepWithoutOptions}
      />
    )
  }
  return (
    <JsonSchemaEditButton
      key={runner.name}
      title={`Configure ${runner.name} step`}
      value={{}}
      schema={optionsSchema}
      onSubmit={createStep}
      buttonProps={buttonProps}
    />
  )
}

export default EditEvaluationPage
