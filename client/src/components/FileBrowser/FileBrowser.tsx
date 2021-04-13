import React, { useMemo } from 'react'
import { useFormatter } from '../../hooks/useFormatter'
import {
  BasicFileAttributesFragment,
  FileContextType
} from '../../services/codefreak-api'
import AntdFileManager from '@codefreak/antd-file-manager'
import { ColumnsType } from 'antd/es/table'
import { basename, dirname, join } from 'path'
import FileBrowserBreadcrumb from './FileBrowserBreadcrumb'
import { Button, Col, Row } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { messageService } from '../../services/message'
import { useMutableQueryParam } from '../../hooks/useQuery'
import useFileCollection from '../../hooks/useFileCollection'

export interface FileBrowserProps {
  type: FileContextType
  id: string
  defaultPath?: string
}

export interface FileBrowserFile {
  path: string
  type: 'directory' | 'file'
  size?: number
  mode: number
  lastModified: string
}

const apiFilesToFileManagerFiles = (
  apiFiles: BasicFileAttributesFragment[]
): FileBrowserFile[] => {
  return apiFiles.map(file => ({
    ...file,
    size: file.size !== null ? file.size : undefined,
    path: file.path.replace(/^\.+\/+/, ''),
    type: file.type === 'FILE' ? 'file' : 'directory'
  }))
}

const FileBrowser: React.FC<FileBrowserProps> = props => {
  const { type, id, defaultPath = '/' } = props
  const { dateTime: formatDateTime, bytes: formatBytes } = useFormatter()
  const [currentPath, setCurrentPath] = useMutableQueryParam(
    'path',
    defaultPath
  )
  const {
    files: apiFiles,
    loading,
    moveFiles,
    reloadFiles,
    deleteFiles,
    createDirectory,
    uploadFiles
  } = useFileCollection(
    {
      type,
      id
    },
    currentPath
  )
  const files: FileBrowserFile[] = useMemo(() => {
    if (!apiFiles) {
      return []
    }
    return apiFilesToFileManagerFiles(apiFiles)
  }, [apiFiles])

  const onDoubleClickRow = (node: FileBrowserFile) => {
    if (node.type === 'directory') {
      setCurrentPath(node.path)
    }
  }

  const moveWithFeedback = async (sourcePaths: string[], target: string) => {
    try {
      await moveFiles(sourcePaths, target)

      if (sourcePaths.length === 1) {
        messageService.success(
          `Moved ${basename(sourcePaths[0])} to ${basename(target)}`
        )
      } else {
        messageService.success(
          `Moved ${sourcePaths.length} files to ${basename(target)}`
        )
      }
    } catch (e) {
      messageService.error(`Failed to move to ${basename(target)}`)
    }
  }

  const onAddDir = async (parent: string, newDirName: string) => {
    await createDirectory(join(parent, newDirName))
  }

  const onDeleteFiles = async (filesToDelete: FileBrowserFile[]) => {
    const paths = filesToDelete.map(file => file.path)
    await deleteFiles(paths)
  }

  const onRenameFile = async (file: FileBrowserFile, newName: string) => {
    const target = join(dirname(file.path), newName)
    return moveWithFeedback([file.path], target)
  }

  const onDragDropMove = async (
    sources: FileBrowserFile[],
    target: FileBrowserFile
  ) => {
    const sourcePaths = sources.map(source => source.path)
    return moveWithFeedback(sourcePaths, target.path)
  }

  return (
    <>
      <Row>
        <Col span={18}>
          <FileBrowserBreadcrumb
            path={currentPath}
            onPathClick={setCurrentPath}
            onAddDir={onAddDir}
          />
        </Col>
        <Col span={6} style={{ textAlign: 'right' }}>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={loading}
            onClick={reloadFiles}
          >
            Reload
          </Button>
        </Col>
      </Row>
      <AntdFileManager
        antdTableProps={{
          loading
        }}
        additionalColumns={
          [
            {
              width: '10%',
              key: 'size',
              sorter: (a, b) => (a.size || 0) - (b.size || 0),
              title: 'Size',
              dataIndex: 'size',
              render: (size: number, node) => {
                return node.type === 'directory' ? '-' : formatBytes(size)
              }
            },
            {
              width: '10%',
              key: 'lastModified',
              title: 'Last Modified',
              dataIndex: 'lastModified',
              render: (value: string) => (
                <span style={{ whiteSpace: 'nowrap' }}>
                  {formatDateTime(value)}
                </span>
              )
            }
          ] as ColumnsType<FileBrowserFile>
        }
        onDoubleClickRow={onDoubleClickRow}
        invalidDropTargetProps={{
          style: {
            opacity: 0.3
          }
        }}
        validDropTargetOverProps={{
          style: {
            position: 'relative',
            zIndex: 1,
            outline: '5px solid rgba(0, 255, 0, .3)'
          }
        }}
        data={files}
        onDelete={onDeleteFiles}
        onRename={onRenameFile}
        onDrop={onDragDropMove}
        onDropFiles={(droppedFiles, _, target) => {
          const targetPath = target?.path || currentPath
          return uploadFiles(targetPath, droppedFiles)
        }}
      />
    </>
  )
}

export default FileBrowser
