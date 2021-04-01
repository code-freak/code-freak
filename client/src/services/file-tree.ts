import { dirname, resolve } from 'path'

export interface Node {
  path: string
}

export interface TreeNode<T> {
  path: string
  originalNode?: T
  children?: TreeNode<T>[]
}

interface RootNode<T> extends TreeNode<T> {
  path: ''
  children: TreeNode<T>[]
}

const abspath = (path: string) => resolve('/', path)
export const isSamePath = (a: string, b: string) => abspath(a) === abspath(b)

/**
 * List all directory names of path and all parents
 *
 * @param path
 */
export const dirnames = (path: string): string[] => {
  const dirs: string[] = []
  while (!isSamePath(dirname(path), path)) {
    dirs.push((path = dirname(path)))
  }
  return dirs
}

/**
 * Creates a tree from a list of objects containing at least a "path" property.
 * If a needed directory is not part of the passed list of files it will create an ad-hoc TreeNode.
 * Every resulting TreeNode will contain a "originalObject" property where you will find
 * your input node. This does of course not apply to ad-hoc TreeNodes.
 *
 * @param nodes
 */
export const fileTree = <T extends Node>(nodes: T[]): TreeNode<T>[] => {
  if (nodes.length === 0) {
    return []
  }

  const rootNode: RootNode<T> = {
    path: '',
    children: []
  }

  const attachToTree = (node: T) => {
    const parents = dirnames(node.path).reverse()
    let currentNode: TreeNode<T> = rootNode
    // create all needed parent nodes
    parents.forEach(parent => {
      if (currentNode.children === undefined) {
        currentNode.children = []
      }
      let parentNode = currentNode.children.find(candidate =>
        isSamePath(candidate.path, parent)
      )
      if (parentNode === undefined) {
        // create a virtual node and attach it to the current parent
        parentNode = {
          path: parent,
          children: []
        }
        currentNode.children.push(parentNode)
      }
      currentNode = parentNode
    })
    if (currentNode.children === undefined) {
      currentNode.children = []
    }

    // check if node already exists in parent
    const existing = currentNode.children.find(candidate =>
      isSamePath(candidate.path, node.path)
    )
    if (existing) {
      // insert original node in the virtual node
      existing.originalNode = node
    } else {
      currentNode.children.push({
        path: node.path,
        originalNode: node
      })
    }
  }

  nodes.map(attachToTree)

  return rootNode.children
}

export type TreeSortFunction<T> = (a: TreeNode<T>, b: TreeNode<T>) => number

/**
 * Default tree sorting function that compares TreeNodes by path alphabetically
 *
 * @param a
 * @param b
 */
export const treePathSorter = <T>(a: TreeNode<T>, b: TreeNode<T>) =>
  abspath(a.path).localeCompare(abspath(b.path))

/**
 * Sort a tree and its children recursively.
 * Sorts by path alphabetically be default
 *
 * @param nodes The children of the root node
 * @param sortFunction Optional custom function
 */
export const sortTree = <T>(
  nodes: TreeNode<T>[],
  sortFunction: TreeSortFunction<T> = treePathSorter
): TreeNode<T>[] => {
  return nodes
    .map(node => {
      if (!node.children) {
        return node
      } else {
        return {
          ...node,
          children: sortTree(node.children, sortFunction)
        }
      }
    })
    .sort(sortFunction)
}
