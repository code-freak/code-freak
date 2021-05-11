package org.codefreak.codefreak.frontend

import java.io.InputStream
import java.io.OutputStream
import org.codefreak.codefreak.config.AppConfiguration
import org.codefreak.codefreak.entity.User
import org.codefreak.codefreak.service.AnswerService
import org.codefreak.codefreak.service.AssignmentService
import org.codefreak.codefreak.service.SubmissionService
import org.codefreak.codefreak.util.FrontendUtil
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.util.StreamUtils
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody

abstract class BaseController {

  @Autowired
  protected lateinit var submissionService: SubmissionService

  @Autowired
  protected lateinit var assignmentService: AssignmentService

  @Autowired
  protected lateinit var answerService: AnswerService

  @Autowired
  protected lateinit var config: AppConfiguration

  protected val user: User
    get() = FrontendUtil.getCurrentUser()

  protected fun download(filename: String, input: InputStream): ResponseEntity<StreamingResponseBody> {
    return download(filename) { out ->
      StreamUtils.copy(input, out)
    }
  }

  protected fun download(filename: String, writer: (out: OutputStream) -> Unit): ResponseEntity<StreamingResponseBody> {
    // allow only alphanumeric characters for download name and replace everything else by dash
    val sanitizedFilename = filename.lowercase().replace("[^\\w_\\-.]+".toRegex(), "-").trim('-')
    val headers = HttpHeaders().apply {
      add("Content-Disposition", "attachment; filename=$sanitizedFilename")
    }
    return ResponseEntity(StreamingResponseBody(writer), headers, HttpStatus.OK)
  }
}
