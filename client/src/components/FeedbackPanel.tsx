import React from 'react'
import { Feedback } from '../generated/graphql'
import { Collapse } from 'antd'
import { CodeViewerCard } from './CodeViewer'
import FeedbackIcon from './FeedbackIcon'
import FileContextTag from './FileContextTag'
import Markdown from './Markdown'

interface FeedbackPanelProps {
  answerId: string
  feedback: Feedback
}

/**
 * Q: why is this no regular functional component?!
 * A: because <Collapse.Panel/> has to be a immediate descendant of <Collapse/>
 *
 * @param props
 */
const renderFeedbackPanel: (
  props: FeedbackPanelProps
) => React.ReactElement = props => {
  const { answerId, feedback } = props

  const title = (
    <>
      <FeedbackIcon
        status={feedback.status || undefined}
        severity={feedback.severity || undefined}
      />
      <Markdown
        allowedElements={[
          'inlineCode',
          'text',
          'strong',
          'delete',
          'emphasis',
          'link'
        ]}
        unwrapDisallowed
      >
        {feedback.summary}
      </Markdown>
    </>
  )
  let body = null
  if (feedback.fileContext) {
    const { lineStart, lineEnd } = feedback.fileContext
    body = (
      <CodeViewerCard
        answerId={answerId}
        path={feedback.fileContext.path}
        lineStart={lineStart || undefined}
        lineEnd={lineEnd || undefined}
      />
    )
  }

  if (feedback.longDescription) {
    body = (
      <>
        {body}
        <Markdown className="feedback-long-description">
          {feedback.longDescription}
        </Markdown>
      </>
    )
  }

  return (
    <Collapse.Panel
      disabled={!body}
      showArrow={!!body}
      header={title}
      extra={
        feedback.fileContext ? (
          <FileContextTag context={feedback.fileContext} />
        ) : null
      }
      key={feedback.id}
    >
      {body}
    </Collapse.Panel>
  )
}

export default renderFeedbackPanel
