import {
  BasicFileAttributesFragment,
  FileContextInput,
  ListFilesDocument,
  useCreateDirectoryMutation,
  useDeleteFilesMutation,
  useListFilesQuery,
  useMoveFilesMutation,
  useUploadFilesMutation
} from '../generated/graphql'
import { basename, join } from 'path'
import { messageService } from '../services/message'

export interface FileCollectionScope {
  files: BasicFileAttributesFragment[]
  loading: boolean
  reloadFiles: () => Promise<void>
  deleteFiles: (name: string[]) => Promise<string[]>
  createDirectory: (name: string) => Promise<string>
  moveFiles: (sources: string[], target: string) => Promise<string[]>
  uploadFiles: (path: string, files: File[]) => Promise<string[]>
}

/**
 * Get an object with the current files of a collection in the given path
 * and a set of methods to operate on the files of the collection.
 */
const useFileCollection = (
  context: FileContextInput,
  workingDir: string
): FileCollectionScope => {
  const abspath = (path: string) => {
    if (path.startsWith('/')) return path
    return join(workingDir, path)
  }
  const variables = {
    context,
    path: workingDir
  }
  const commonMutationOptions = {
    refetchQueries: [
      {
        query: ListFilesDocument,
        variables
      }
    ]
  }
  const [deleteFiles, deleteFileResult] = useDeleteFilesMutation(
    commonMutationOptions
  )
  const [moveFiles, moveFileResult] = useMoveFilesMutation(
    commonMutationOptions
  )
  const [createDirectory, createDirectoryResult] = useCreateDirectoryMutation(
    commonMutationOptions
  )
  const [uploadFiles, uploadFilesResult] = useUploadFilesMutation(
    commonMutationOptions
  )
  const filesQuery = useListFilesQuery({
    variables
  })
  return {
    files: filesQuery.data?.listFiles || [],
    loading:
      filesQuery.loading ||
      deleteFileResult.loading ||
      moveFileResult.loading ||
      createDirectoryResult.loading ||
      uploadFilesResult.loading,
    reloadFiles: () => filesQuery.refetch().then(() => undefined),
    createDirectory: (dirName: string) => {
      const path = abspath(dirName)
      return createDirectory({
        variables: {
          context,
          path
        }
      }).then(() => {
        messageService.success(`Created directory ${path}!`)
        return path
      })
    },
    deleteFiles: (paths: string[]) => {
      if (paths.length === 0) {
        messageService.error(`There is nothing to delete`)
        return Promise.reject()
      }
      const absPaths = paths.map(path => abspath(path))
      return deleteFiles({
        variables: {
          context,
          paths: absPaths
        }
      }).then(() => {
        if (paths.length === 1) {
          messageService.success(`Deleted ${basename(paths[0])} successfully`)
        } else {
          messageService.success(`Deleted ${paths.length} files successfully`)
        }
        return absPaths
      })
    },
    moveFiles: (sourcePaths, target) => {
      if (sourcePaths.length === 0) {
        messageService.error(`There is nothing to move to ${basename(target)}`)
        return Promise.reject()
      }
      return moveFiles({
        variables: {
          context,
          sourcePaths,
          target
        }
      }).then(() => {
        if (sourcePaths.length === 1) {
          messageService.success(`Moved ${sourcePaths[0]} to ${target}`)
        } else {
          messageService.success(
            `Moved ${sourcePaths.length} files to ${target}`
          )
        }
        return sourcePaths
      })
    },
    uploadFiles: (dir, files) => {
      if (files.length === 0) {
        messageService.error(
          'Found no files to upload. Maybe you uploaded an empty directory?'
        )
        return Promise.reject()
      }
      return uploadFiles({
        variables: {
          context,
          dir,
          files
        }
      }).then(() => {
        messageService.success(`Uploaded ${files.length} files successfully!`)
        return files.map(file => join(dir, file.name))
      })
    }
  }
}

export default useFileCollection
