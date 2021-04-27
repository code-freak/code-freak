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
import { join } from 'path'

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
      }).then(() => path)
    },
    deleteFiles: (paths: string[]) => {
      const absPaths = paths.map(path => abspath(path))
      return deleteFiles({
        variables: {
          context,
          paths: absPaths
        }
      }).then(() => absPaths)
    },
    moveFiles: (sourcePaths, target) => {
      return moveFiles({
        variables: {
          context,
          sourcePaths,
          target
        }
      }).then(() => sourcePaths)
    },
    uploadFiles: (dir, files) => {
      return uploadFiles({
        variables: {
          context,
          dir,
          files
        }
      }).then(() => files.map(file => join(dir, file.name)))
    }
  }
}

export default useFileCollection
