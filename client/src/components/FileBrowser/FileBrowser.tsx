import React, { useMemo, useRef, useState } from 'react'
import { useFormatter } from '../../hooks/useFormatter'
import {
  BasicFileAttributesFragment,
  FileContextType
} from '../../services/codefreak-api'
import AntdFileManager, {
  AntdDragLayer,
  AntdFileManagerProps
} from '@codefreak/antd-file-manager'
import { ColumnsType } from 'antd/es/table'
import { basename, dirname, join } from 'path'
import FileBrowserBreadcrumb from './FileBrowserBreadcrumb'
import { Button, Col, Modal, Row } from 'antd'
import {
  DeleteFilled,
  ReloadOutlined,
  ScissorOutlined,
  SnippetsOutlined
} from '@ant-design/icons'
import { messageService } from '../../services/message'
import { useMutableQueryParam } from '../../hooks/useQuery'
import useFileCollection from '../../hooks/useFileCollection'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'

import './FileBrowser.less'

export interface FileBrowserProps {
  type: FileContextType
  id: string
  defaultPath?: string
}

export interface FileBrowserFile {
  type: 'directory' | 'file'
  path: string
  basename: string
  size?: number
  mode: number
  lastModified: string
}

const apiFilesToFileManagerFiles = (
  apiFiles: BasicFileAttributesFragment[]
): FileBrowserFile[] => {
  return apiFiles.map(file => ({
    ...file,
    // be careful with a size of 0
    size: file.size !== null ? file.size : undefined,
    basename: basename(file.path),
    type: file.type === 'FILE' ? 'file' : 'directory'
  }))
}

const containsFileByPath = (
  haystack: FileBrowserFile[],
  needle: FileBrowserFile
): boolean => {
  return haystack.find(file => file.path === needle.path) !== undefined
}

const dataTransferToFiles = (items: DataTransferItemList): File[] => {
  const files = []
  for (let i = 0; i < items.length; i++) {
    const file = items[i].getAsFile()
    const entry = items[i].webkitGetAsEntry()
    if (entry && entry.isFile && file) files.push(file)
  }
  return files
}

const FileBrowser: React.FC<FileBrowserProps> = props => {
  const { type, id, defaultPath = '/' } = props
  const { dateTime: formatDateTime, bytes: formatBytes } = useFormatter()
  const [currentPath, setCurrentPath] = useMutableQueryParam(
    'path',
    defaultPath
  )
  const [deletingFiles, setDeletingFiles] = useState<
    FileBrowserFile[] | undefined
  >()
  const [cutFiles, setCutFiles] = useState<FileBrowserFile[] | undefined>()
  const [pasteFiles, setPasteFiles] = useState<FileBrowserFile[] | undefined>()
  const [selectedFiles, setSelectedFiles] = useState<FileBrowserFile[]>([])
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

  const onRenameFile = async (file: FileBrowserFile, newName: string) => {
    setCutFiles(undefined)
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

  const getAdditionalRowProperties: AntdFileManagerProps<FileBrowserFile>['additionalRowProperties'] = (
    item,
    currentProps
  ) => {
    let additionalProps = {}
    if (cutFiles && containsFileByPath(cutFiles, item)) {
      additionalProps = {
        className: `${currentProps.className || ''} file-manager-row-cut`
      }
    }
    return {
      ...currentProps,
      ...additionalProps
    }
  }

  const additionalColumns = [
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
        <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(value)}</span>
      )
    }
  ] as ColumnsType<FileBrowserFile>

  const onDropFiles: AntdFileManagerProps<FileBrowserFile>['onDropFiles'] = (
    droppedFiles,
    target
  ) => {
    const targetPath = target?.path || currentPath
    const filesToUpload = dataTransferToFiles(droppedFiles)
    if (filesToUpload.length) {
      return uploadFiles(targetPath, filesToUpload)
    }
  }

  const onDeleteToolbar = () => setDeletingFiles(selectedFiles)
  const onPasteToolbar = () => setPasteFiles(cutFiles)
  const onCutToolbar = () => setCutFiles(selectedFiles)
  const onReallyDeleteOk = async () => {
    if (!deletingFiles) return
    try {
      await deleteFiles(deletingFiles.map(file => file.path))
    } finally {
      setDeletingFiles(undefined)
      // this will get out of sync with the table when deleting a single file
      // table has to support a controlled mode
      setSelectedFiles([])
    }
  }
  const onReallyDeleteCancel = () => setDeletingFiles(undefined)
  const onReallyMoveOk = async () => {
    if (!pasteFiles) return
    try {
      await moveFiles(
        pasteFiles.map(file => file.path),
        currentPath
      )
    } finally {
      setPasteFiles(undefined)
      setCutFiles(undefined)
      // this will get out of sync with the table when deleting a single file
      // table has to support a controlled mode
      setSelectedFiles([])
    }
  }
  const onReallyMoveCancel = () => setPasteFiles(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)
  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
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
            disabled={selectedFiles.length === 0}
            size="small"
            loading={loading}
            icon={<DeleteFilled />}
            onClick={onDeleteToolbar}
          >
            Delete
          </Button>{' '}
          <Button
            disabled={!cutFiles || !!pasteFiles}
            icon={<SnippetsOutlined />}
            size="small"
            loading={loading}
            onClick={onPasteToolbar}
          >
            Paste Files {cutFiles ? `(${cutFiles.length})` : ''}
          </Button>{' '}
          <Button
            disabled={selectedFiles.length === 0}
            icon={<ScissorOutlined />}
            size="small"
            loading={loading}
            onClick={onCutToolbar}
          >
            Cut Files
          </Button>{' '}
          <Button
            icon={<ReloadOutlined />}
            size="small"
            loading={loading}
            onClick={reloadFiles}
          >
            Reload
          </Button>{' '}
        </Col>
      </Row>
      <Modal
        title={`Really delete ${deletingFiles?.length} files?`}
        onOk={onReallyDeleteOk}
        onCancel={onReallyDeleteCancel}
        visible={deletingFiles !== undefined}
      >
        This will delete the following files:
        <ul>
          {deletingFiles?.map(file => (
            <li key={file.path}>{file.basename}</li>
          ))}
        </ul>
      </Modal>
      <Modal
        title={`Move ${pasteFiles?.length} files to ${currentPath}?`}
        onOk={onReallyMoveOk}
        onCancel={onReallyMoveCancel}
        visible={pasteFiles !== undefined}
      >
        This will move the following files to the current directory:
        <ul>
          {pasteFiles?.map(file => (
            <li key={file.path}>{file.basename}</li>
          ))}
        </ul>
      </Modal>
      <DndProvider backend={HTML5Backend}>
        <AntdDragLayer relativeToElement={wrapperRef} />
        <AntdFileManager
          dataSource={files}
          dataKey="path"
          canDropFiles
          hideNativeDragPreview
          antdTableProps={{
            loading
          }}
          onSelectionChange={setSelectedFiles}
          additionalColumns={additionalColumns}
          additionalRowProperties={getAdditionalRowProperties}
          onDoubleClickItem={onDoubleClickRow}
          itemDndStatusProps={{
            invalidDropTargetProps: {
              className: 'file-manager-row-invalid-drop-target'
            },
            validDropTargetOverProps: {
              className: 'file-manager-row-valid-drop-target-over'
            }
          }}
          rootDndStatusProps={{
            validDropTargetOverProps: {
              className: 'file-manager-valid-drop-target-over'
            }
          }}
          onDeleteItems={setDeletingFiles}
          onRenameItem={onRenameFile}
          onDropItems={onDragDropMove}
          onDropFiles={onDropFiles}
        />
      </DndProvider>
    </div>
  )
}

export default FileBrowser
