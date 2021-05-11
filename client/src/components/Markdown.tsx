import React from 'react'
import ReactMarkdown from 'react-markdown'

export interface MarkdownProps {
  children: string
  allowedElements?: string[]
  unwrapDisallowed?: boolean
  className?: string
}

const Markdown: React.FC<MarkdownProps> = props => {
  const { children, allowedElements, unwrapDisallowed, className } = props
  return (
    <ReactMarkdown
      allowedElements={allowedElements}
      unwrapDisallowed={unwrapDisallowed}
      className={className}
    >
      {children}
    </ReactMarkdown>
  )
}

export default Markdown
