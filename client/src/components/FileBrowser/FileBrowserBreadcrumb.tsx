import React from "react";
import { dirnames } from "../../services/file-tree";
import { Breadcrumb } from "antd";
import { HomeOutlined, PlusCircleOutlined } from "@ant-design/icons";
import { basename } from "path";
import './FileBrowserBreadcrumb.less'

export interface FileBrowserBreadcrumbProps {
  path: string
  onPathClick: (path: string) => void
}
const FileBrowserBreadcrumb: React.FC<FileBrowserBreadcrumbProps> = props => {
  const parentDirs = dirnames(props.path).filter(dir => dir !== '.').reverse()
  const paths = [...parentDirs, props.path]

  const onClickPath = (path: string) => () => props.onPathClick(path)

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
        <PlusCircleOutlined />
      </Breadcrumb.Item>
    </Breadcrumb>
  )
}

export default FileBrowserBreadcrumb
