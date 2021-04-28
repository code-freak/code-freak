const isDirectoryEntry = (
  entry: FileSystemEntry
): entry is FileSystemDirectoryEntry => entry.isDirectory
const isFileEntry = (entry: FileSystemEntry): entry is FileSystemFileEntry =>
  entry.isFile

/**
 * Create a clone of the given file but use "webkitRelativePath" as name property.
 * This is useful when uploading nested file structures.
 * We could also do this globally by modifying the Apollo upload client.
 */
const cloneFileWithRelativeName = (file: File): File => {
  return new File([file], file.webkitRelativePath || file.name, {
    type: file.type,
    lastModified: file.lastModified
  })
}

/**
 * Get a File instance from a FileSystemFileEntry.
 * The File instance will have the name property set to webkitRelativePath.
 */
const entryFileAsPromise = (entry: FileSystemFileEntry): Promise<File> => {
  return new Promise((resolve, reject) => {
    entry.file(file => {
      resolve(cloneFileWithRelativeName(file))
    }, reject)
  })
}

/**
 * Get all files from the given reader recursively. This will include files
 * from this directory and also nested
 */
const drainDirectoryReader = (
  reader: FileSystemDirectoryReader
): Promise<FileSystemFileEntry[]> => {
  return new Promise((resolve, _) => {
    reader.readEntries(entries => {
      if (!entries.length) {
        // entries is empty if the directory contains no files or multiple
        // calls of readEntries has reached the end
        resolve([])
        return
      }
      // This array will collected three types of promises:
      // 1. Files from this reader
      // 2. Files from child directories
      // 3. Files from repeated calls to this reader
      const promisedFiles: Promise<FileSystemFileEntry[]>[] = []
      for (const entry of entries) {
        if (isFileEntry(entry)) {
          // Also put single files into an array to match our recursive data structure
          promisedFiles.push(Promise.resolve([entry]))
        }
        if (isDirectoryEntry(entry)) {
          promisedFiles.push(drainDirectoryReader(entry.createReader()))
        }
      }
      // readEntries() has to be called multiple times on a reader until all files have been read...
      promisedFiles.push(drainDirectoryReader(reader))
      // resolve nested readers and files from this layer into a single array
      Promise.all(promisedFiles).then(nestedFiles => {
        // create a flat array of recursive read files
        resolve(nestedFiles.flatMap(nested => nested))
      })
    })
  })
}

/**
 * Get all files from a FileSystemEntry. In case a directory is passed
 * this will receive all files recursively.
 */
const getFilesFromEntryRecursive = async (
  entry: FileSystemEntry
): Promise<File[]> => {
  if (isFileEntry(entry)) {
    return entryFileAsPromise(entry).then(entry => [entry])
  }
  return drainDirectoryReader(entry.createReader()).then(entries => {
    return Promise.all(entries.map(entry => entryFileAsPromise(entry)))
  })
}

/**
 * Convert a DataTransferItemList to a set of File instances by recursively
 * walking over all files and directories.
 */
export const dataTransferToFiles = (
  items: DataTransferItemList
): Promise<File[]> => {
  return new Promise(resolve => {
    const promisedFiles: Promise<File[]>[] = []
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry()
      if (!entry) continue
      promisedFiles.push(getFilesFromEntryRecursive(entry))
    }
    Promise.all(promisedFiles).then(nestedFiles => {
      const files = nestedFiles
        // create a flat structure from nested files.
        // This will also create a cloned file instance with the name property
        // set to a relative path like foo/bar/baz.txt in case a directory
        // has been selected.
        .flatMap(f => f.map(cloneFileWithRelativeName))
      resolve(files)
    })
  })
}
