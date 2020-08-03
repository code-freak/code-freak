package org.codefreak.codefreak.entity

import javax.persistence.Column
import javax.persistence.Embeddable
import javax.persistence.Embedded
import javax.persistence.Entity
import javax.persistence.EnumType
import javax.persistence.Enumerated
import javax.persistence.Lob
import javax.persistence.ManyToOne
import org.hibernate.annotations.Type

@Entity
class Feedback(
  @Column(length = 1048576)
  @Lob
  @Type(type = "org.hibernate.type.TextType")
  var summary: String
) : BaseEntity() {
  @ManyToOne(optional = false)
  var evaluationStep: EvaluationStep? = null

  /**
   * Describes the file-context this feedback refers to
   */
  @Embedded
  var fileContext: FileContext? = null

  /**
   * Longer description of the result. Supports Markdown.
   * Should be more precise than the summary or explain how to fix the problem.
   * Limit is set to 1MiB
   */
  @Column(length = 1048576)
  @Lob
  @Type(type = "org.hibernate.type.TextType")
  var longDescription: String? = null

  /**
   * An identifier that allows grouping similar feedback together
   * Useful for jUnit test suites or CodeClimate engine/check_name
   */
  var group: String? = null

  /**
   * Indicates if the result is good, bad or irrelevant
   */
  @Enumerated(EnumType.STRING)
  var status: Status? = null

  /**
   * If the result was bad, how bad was it exactly?
   */
  @Enumerated(EnumType.STRING)
  var severity: Severity? = null

  val isFailed
    get() = status == Status.FAILED

  @ManyToOne
  var author: User? = null

  /**
   * Context points to a file or more specific to a line, line-range or character range inside a file.
   *
   * Possibilities:
   * 1. Only path is defined: References the full file
   * 2. Path and lineStart is defined: Points to a line inside a file
   * 3. Path, lineStart and lineEnd is defined: Points to a range of lines inside a file
   * 4. All properties are defined: References a specific range of character inside a file
   */
  @Embeddable
  class FileContext(
    var path: String,
    var lineStart: Int? = null,
    var lineEnd: Int? = null,
    var columnStart: Int? = null,
    var columnEnd: Int? = null
  )

  enum class Severity {
    INFO,
    MINOR,
    MAJOR,
    CRITICAL
  }

  enum class Status {
    IGNORE, // useful for skipped unit-tests
    SUCCESS,
    FAILED
  }
}
