import 'highlight.js/styles/github-gist.css'
import React, { useCallback, useEffect, useRef } from 'react'
import SyntaxHighlighterComponent from 'react-syntax-highlighter'
import './SyntaxHighlighter.less'

export interface SyntaxHighlighterProps {
  firstLineNumber?: number
  highlightLines?: number[]
  onLineNumberClick?: (lineNumber: number, elem: HTMLSpanElement) => void
  language?: string
  noLineNumbers?: boolean
}

const SyntaxHighlighter: React.FC<SyntaxHighlighterProps> = props => {
  const { highlightLines, firstLineNumber, noLineNumbers } = props

  const absLineNumber = useCallback(
    (relLineNumber: number) => {
      if (!firstLineNumber) {
        return relLineNumber
      } else {
        return relLineNumber + firstLineNumber - 1
      }
    },
    [firstLineNumber]
  )

  let lineHighlighter: lineTagPropsFunction | undefined
  if (highlightLines && highlightLines.length) {
    lineHighlighter = lineNumber => {
      if (highlightLines.indexOf(absLineNumber(lineNumber)) !== -1) {
        return {
          className: 'highlight-line'
        }
      }
      return {}
    }
  }

  const lineNumberContainerRef = useRef<HTMLElement>()
  useEffect(() => {
    const container = lineNumberContainerRef.current
    const onClick = props.onLineNumberClick
    if (!container || !onClick) {
      return
    }
    const onClickListener = (e: Event) => {
      if (e.target instanceof HTMLSpanElement) {
        const lineNumber = parseInt(e.target.innerText, 10)
        onClick(lineNumber, e.target)
      }
    }

    container.addEventListener('click', onClickListener)
    return () => {
      container.removeEventListener('click', onClickListener)
    }
  }, [props.onLineNumberClick, absLineNumber])

  return (
    <SyntaxHighlighterComponent
      lineProps={lineHighlighter}
      wrapLines={lineHighlighter !== undefined}
      showLineNumbers={!noLineNumbers}
      language={props.language}
      useInlineStyles={false}
      startingLineNumber={props.firstLineNumber || 1}
      lineNumberContainerProps={{
        ref: lineNumberContainerRef,
        className: 'hljs-line-numbers',
        style: {}
      }}
    >
      {props.children}
    </SyntaxHighlighterComponent>
  )
}

SyntaxHighlighter.defaultProps = {
  language: 'plaintext'
}

export default SyntaxHighlighter
