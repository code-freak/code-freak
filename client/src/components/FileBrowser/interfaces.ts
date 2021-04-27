export interface FileBrowserFile {
  type: 'directory' | 'file'
  path: string
  basename: string
  size?: number
  mode: number
  lastModified: string
}
