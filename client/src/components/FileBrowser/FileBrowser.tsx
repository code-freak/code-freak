import React, { useMemo } from 'react'
import { useFormatter } from '../../hooks/useFormatter'
import {
  BasicFileAttributesFragment,
  FileContextType,
  ListFilesDocument,
  useDeleteFileMutation,
  useListFilesQuery,
  useMoveFileMutation
} from '../../services/codefreak-api'
import AntdFileManager from '@codefreak/antd-file-manager'
import { ColumnsType } from 'antd/es/table'
import { isSamePath } from '../../services/file-tree'
import { basename, dirname, join } from 'path'
import FileBrowserBreadcrumb from './FileBrowserBreadcrumb'
import { Button, Col, Row } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { messageService } from '../../services/message'
import { useMutableQueryParam } from '../../hooks/useQuery'

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

const isDotDir = (path: string) => path.match(/^\.+\/+$/)

const apiFilesToFileManagerFiles = (
  prefix: string,
  apiFiles: BasicFileAttributesFragment[]
): FileBrowserFile[] => {
  return apiFiles
    .filter(file => {
      return isSamePath(dirname(file.path), prefix) && !isDotDir(file.path)
    })
    .map(file => ({
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
  const context = {
    type,
    id
  }
  const variables = {
    context,
    path: currentPath
  }
  const refetchQueries = [
    {
      query: ListFilesDocument,
      variables
    }
  ]
  const [deleteFile, { loading: deleteLoading }] = useDeleteFileMutation({
    refetchQueries
  })
  const [moveFile, { loading: moveLoading }] = useMoveFileMutation({
    refetchQueries
  })
  const filesQuery = useListFilesQuery({
    variables
  })
  const files: FileBrowserFile[] = useMemo(() => {
    if (!filesQuery.data?.listFiles) {
      return []
    }
    return apiFilesToFileManagerFiles(currentPath, filesQuery.data?.listFiles)
  }, [filesQuery.data, currentPath])

  const onDoubleClickRow = (node: FileBrowserFile) => {
    if (node.type === 'directory') {
      setCurrentPath(node.path)
    }
  }

  const moveByPaths = async (sourcePaths: string[], target: string) => {
    try {
      await moveFile({
        variables: {
          context,
          sourcePaths,
          target
        }
      })

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

  const loading = filesQuery.loading || moveLoading || deleteLoading
  return (
    <>
      <Row>
        <Col span={18}>
          <FileBrowserBreadcrumb
            path={currentPath}
            onPathClick={setCurrentPath}
          />
        </Col>
        <Col span={6} style={{ textAlign: 'right' }}>
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={loading}
            onClick={() => filesQuery.refetch()}
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
        onDelete={nodes => {
          const paths = nodes.map(source => source.path)
          deleteFile({
            variables: {
              context,
              paths
            }
          })
        }}
        onRename={(node, newName) => {
          const target = join(dirname(node.path), newName)
          return moveByPaths([node.path], target)
        }}
        onDrop={(sources, target) => {
          const sourcePaths = sources.map(source => source.path)
          return moveByPaths(sourcePaths, target.path)
        }}
      />
    </>
  )
}

export default FileBrowser
