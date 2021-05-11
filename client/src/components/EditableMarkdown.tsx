import { EditOutlined } from '@ant-design/icons'
import { Button, Empty } from 'antd'
import React, { useState } from 'react'
import Markdown from './Markdown'
import ReactMde from 'react-mde'
import { GenerateMarkdownPreview } from 'react-mde/lib/definitions/types'
import 'react-mde/lib/styles/css/react-mde-all.css'
import './EditableMarkdown.less'

const generateMarkdownPreview: GenerateMarkdownPreview = markdown =>
  Promise.resolve(<Markdown>{markdown}</Markdown>)

const EditableMarkdown: React.FC<{
  content?: string | null
  editable: boolean
  onSave: (newContent: string | undefined) => Promise<unknown>
}> = ({ content, editable, onSave }) => {
  const [editing, setEditing] = useState(false)
  const [newContent, setNewContent] = useState<string>()
  const [selectedTab, setSelectedTab] = React.useState<'write' | 'preview'>(
    'write'
  )
  const [saving, setSaving] = useState(false)
  const edit = () => {
    setNewContent(content || undefined)
    setEditing(true)
  }
  const save = () => {
    setSaving(true)
    onSave(newContent)
      .then(() => setEditing(false))
      .finally(() => setSaving(false))
  }
  const cancel = () => setEditing(false)
  if (editing) {
    return (
      <>
        <ReactMde
          value={newContent}
          onChange={setNewContent}
          selectedTab={selectedTab}
          onTabChange={setSelectedTab}
          generateMarkdownPreview={generateMarkdownPreview}
        />
        <div style={{ marginTop: 8 }}>
          <Button style={{ marginRight: 8 }} onClick={cancel}>
            Cancel
          </Button>
          <Button type="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </div>
      </>
    )
  } else {
    return (
      <div
        onClick={editable ? edit : undefined}
        className={editable ? 'markdown-wrapper editable' : 'markdown-wrapper'}
      >
        <EditOutlined className="edit-icon" />
        {content || !editable ? (
          <Markdown>{content || ''}</Markdown>
        ) : (
          <Empty description={null} />
        )}
      </div>
    )
  }
}

export default EditableMarkdown
