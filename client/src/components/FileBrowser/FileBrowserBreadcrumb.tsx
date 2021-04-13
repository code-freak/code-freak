import React, { useEffect, useState } from 'react'
import { dirnames } from '../../services/file-tree'
import { Breadcrumb, Input, Tooltip } from 'antd'
import { HomeOutlined, PlusCircleOutlined } from '@ant-design/icons'
import { basename } from 'path'
import './FileBrowserBreadcrumb.less'

export interface FileBrowserBreadcrumbProps {
  path: string
  onPathClick: (path: string) => void
  onAddDir: (path: string, name: string) => Promise<unknown> | void
}
const FileBrowserBreadcrumb: React.FC<FileBrowserBreadcrumbProps> = props => {
  const [addingDir, setAddingDir] = useState(false)
  const [isDirAddLoading, setIsDirAddLoading] = useState(false)
  const parentDirs = dirnames(props.path)
    .filter(dir => dir !== '.')
    .reverse()
  const paths = [...parentDirs, props.path]

  useEffect(() => {
    // reset dir adding when changing path
    setAddingDir(false)
  }, [props.path, setAddingDir])

  const onClickPath = (path: string) => () => props.onPathClick(path)

  const onNewDirKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setAddingDir(false)
    } else if (e.key === 'Enter') {
      setIsDirAddLoading(true)
      await props.onAddDir(props.path, e.currentTarget.value)
      setAddingDir(false)
      setIsDirAddLoading(false)
    }
  }

  const onAddDirClick = () => setAddingDir(true)

  return (
    <Breadcrumb className="file-manager-breadcrumb">
      <Breadcrumb.Item onClick={onClickPath('/')}>
        <HomeOutlined />
      </Breadcrumb.Item>
      {paths.map(path => (
        <Breadcrumb.Item key={path} onClick={onClickPath(path)}>
          {basename(path)}
        </Breadcrumb.Item>
      ))}
      <Breadcrumb.Item>
        {addingDir ? (
          <Input
            size="small"
            style={{ width: 200 }}
            placeholder="New directory name..."
            autoFocus
            onKeyDown={onNewDirKeyDown}
            disabled={isDirAddLoading}
          />
        ) : (
          <Tooltip title="Create new directory">
            <PlusCircleOutlined onClick={onAddDirClick} />
          </Tooltip>
        )}
      </Breadcrumb.Item>
    </Breadcrumb>
  )
}

export default FileBrowserBreadcrumb
