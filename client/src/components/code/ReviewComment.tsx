import { CloseOutlined } from '@ant-design/icons'
import { Button, Card, Col, Form, Popconfirm, Row, Select } from 'antd'
import TextArea from 'antd/es/input/TextArea'
import React, { useState } from 'react'
import { FeedbackSeverity } from '../../generated/graphql'
import useAuthenticatedUser from '../../hooks/useAuthenticatedUser'
import Avatar from '../user/Avatar'
import { FormProps } from 'antd/es/form'
import FeedbackSeverityIcon from '../FeedbackSeverityIcon'

// these are ordered by increasing severity
const FeedbackSeverityOptions: Record<FeedbackSeverity, string> = {
  [FeedbackSeverity.Info]: 'Info',
  [FeedbackSeverity.Minor]: 'Minor',
  [FeedbackSeverity.Major]: 'Major',
  [FeedbackSeverity.Critical]: 'Critical'
}

const renderSeveritySelect = () => {
  return (
    <Select
      style={{ width: '250px' }}
      placeholder="Select a severity"
      defaultValue={FeedbackSeverity.Info}
    >
      {Object.entries(FeedbackSeverityOptions).map(([key, value]) => {
        return (
          <Select.Option key={key} value={key}>
            <FeedbackSeverityIcon severity={key as FeedbackSeverity} /> {value}
          </Select.Option>
        )
      })}
    </Select>
  )
}

export interface ReviewCommentValues {
  comment: string
  severity?: FeedbackSeverity
}

export interface ReviewCommentFormProps extends FormProps {
  title?: string
  onSubmit?: (values: ReviewCommentValues) => void
  onClose?: () => void
}

const ReviewCommentForm: React.FC<ReviewCommentFormProps> = props => {
  const [hasValue, setHasValue] = useState<boolean>(false)
  const user = useAuthenticatedUser()
  const [form] = Form.useForm()

  const onSubmitFailed: FormProps['onFinishFailed'] = ({ errorFields }) => {
    form.scrollToField(errorFields[0].name)
  }

  const onClose = () => {
    if (props.onClose) {
      props.onClose()
    }
  }

  // confirm close if comment contains a value
  const onChange = () => setHasValue(form.getFieldValue('comment'))
  let close = <CloseOutlined onClick={!hasValue ? onClose : undefined} />
  if (hasValue) {
    close = (
      <Popconfirm title="Discard comment?" onConfirm={onClose}>
        {close}
      </Popconfirm>
    )
  }

  return (
    <Card
      size="small"
      className="review-comment"
      title={props.title}
      extra={close}
    >
      <Row>
        <Col>
          <Avatar user={user} />
        </Col>
        <Col style={{ flexGrow: 1 }}>
          <Form
            onFinish={props.onSubmit}
            onFinishFailed={onSubmitFailed}
            onChange={onChange}
            name="review-comment"
          >
            <Form.Item
              hasFeedback
              name="comment"
              rules={[
                {
                  required: true,
                  message: 'Please enter a comment'
                }
              ]}
            >
              <TextArea
                autoSize={{ minRows: 3, maxRows: 6 }}
                placeholder="Add a useful comment…"
              />
            </Form.Item>
            <Row>
              <Col span={12}>
                <Form.Item hasFeedback name="severity" label="Severity">
                  {renderSeveritySelect()}
                </Form.Item>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Button type="primary" htmlType="submit">
                  Save Comment
                </Button>
              </Col>
            </Row>
          </Form>
        </Col>
      </Row>
    </Card>
  )
}

export default ReviewCommentForm
