import React from 'react'
import { Button } from 'antd'
import {
  DeleteFilled,
  ReloadOutlined,
  ScissorOutlined,
  SnippetsOutlined
} from '@ant-design/icons'
import { FileBrowserFile } from './interfaces'

export interface FileBrowserToolbarProps {
  loading: boolean
  selectedFiles: FileBrowserFile[]
  cutFiles: FileBrowserFile[]
  onDelete: React.MouseEventHandler
  onCut: React.MouseEventHandler
  onPaste: React.MouseEventHandler
  onReload: React.MouseEventHandler
}

const FileBrowserToolbar: React.FC<FileBrowserToolbarProps> = props => {
  const {
    loading,
    selectedFiles,
    onDelete,
    onCut,
    onPaste,
    onReload,
    cutFiles
  } = props
  return (
    <>
      <Button
        disabled={selectedFiles.length === 0}
        size="small"
        loading={loading}
        icon={<DeleteFilled />}
        onClick={onDelete}
      >
        Delete
      </Button>{' '}
      <Button
        disabled={cutFiles.length === 0}
        icon={<SnippetsOutlined />}
        size="small"
        loading={loading}
        onClick={onPaste}
      >
        Paste Files {cutFiles.length ? `(${cutFiles.length})` : ''}
      </Button>{' '}
      <Button
        disabled={selectedFiles.length === 0}
        icon={<ScissorOutlined />}
        size="small"
        loading={loading}
        onClick={onCut}
      >
        Cut Files
      </Button>{' '}
      <Button
        icon={<ReloadOutlined />}
        size="small"
        loading={loading}
        onClick={onReload}
      >
        Reload
      </Button>
    </>
  )
}

export default FileBrowserToolbar
