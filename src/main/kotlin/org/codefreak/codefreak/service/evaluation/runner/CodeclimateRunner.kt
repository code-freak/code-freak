package org.codefreak.codefreak.service.evaluation.runner

import com.fasterxml.jackson.annotation.JsonIgnoreProperties
import com.fasterxml.jackson.annotation.JsonSubTypes
import com.fasterxml.jackson.annotation.JsonSubTypes.Type
import com.fasterxml.jackson.annotation.JsonTypeInfo
import com.fasterxml.jackson.databind.ObjectMapper
import org.codefreak.codefreak.config.AppConfiguration
import org.codefreak.codefreak.entity.Answer
import org.codefreak.codefreak.entity.Feedback
import org.codefreak.codefreak.entity.Feedback.FileContext
import org.codefreak.codefreak.entity.Feedback.Severity
import org.codefreak.codefreak.service.AnswerService
import org.codefreak.codefreak.service.ContainerService
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Component

@Component
class CodeclimateRunner : AbstractDockerRunner() {
  companion object {
    /**
     * Map from CodeClimate severities to Feedback severity
     * https://github.com/codeclimate/spec/blob/master/SPEC.md#data-types
     */
    private val CODECLIMATE_SEVERITY_MAP: Map<String, Severity> = mapOf(
        "info" to Severity.INFO,
        "minor" to Severity.MINOR,
        "major" to Severity.MAJOR,
        "critical" to Severity.CRITICAL,
        "blocker" to Severity.CRITICAL
    )
  }

  @Autowired
  lateinit var config: AppConfiguration

  @Autowired
  private lateinit var answerService: AnswerService

  @Autowired
  private lateinit var containerService: ContainerService

  override fun getName(): String {
    return "codeclimate"
  }

  override fun getDefaultTitle() = "Code Quality"

  override fun getDocumentationUrl() = "https://docs.codefreak.org/codefreak/for-teachers/definitions.html#codeclimate"

  override fun run(answer: Answer, options: Map<String, Any>): List<Feedback> {
    val codeclimateJson = analyzeInDocker(answer)
    return this.parseCodeclimateJson(codeclimateJson).map { issue ->
      Feedback(issue.description).apply {
        group = "${issue.engine_name}/${issue.check_name}"
        longDescription = issue.content?.body
        status = Feedback.Status.FAILED
        severity = CODECLIMATE_SEVERITY_MAP[issue.severity]
        fileContext = FileContext(
            issue.location.path,
            lineStart = issue.location.lines?.begin ?: issue.location.positions?.begin?.line,
            lineEnd = issue.location.lines?.end ?: issue.location.positions?.end?.line,
            columnStart = issue.location.positions?.begin?.column,
            columnEnd = issue.location.positions?.end?.column
        )
      }
    }
  }

  fun analyzeInDocker(answer: Answer): String {
    val containerId = containerService.createContainer(config.evaluation.codeclimate.image) {
      name = "codeclimate_orchestrator_${answer.id}"
      labels += getContainerLabelMap(answer)
      doNothingAndKeepAlive()
      hostConfig {
        appendBinds("/var/run/docker.sock:/var/run/docker.sock", "/tmp/cc:/tmp/cc")
      }
      containerConfig {
        env("CODECLIMATE_ORCHESTRATOR=$name", "CODECLIMATE_CODE=/code")
      }
    }
    containerService.useContainer(containerId) {
      answerService.copyFilesForEvaluation(answer).use {
        containerService.copyToContainer(it, containerId, "/code")
      }
      // `analyze` would also install missing engines but may time out in the process. Also `engines:install` will update images.
      containerService.exec(containerId, arrayOf("/usr/src/app/bin/codeclimate", "engines:install"))
      return containerService.exec(containerId, arrayOf("/usr/src/app/bin/codeclimate", "analyze", "-f", "json")).output
    }
  }

  private fun parseCodeclimateJson(content: String): List<Issue> {
    var json = content
    // codeclimate may print a message before the actual JSON
    if (!json.startsWith("[")) {
      json = json.drop(content.indexOfFirst { it == '\n' } + 1)
    }
    val mapper = ObjectMapper()
    val results = mapper.readValue(json, Array<Result>::class.java)
    return results.filterIsInstance<Issue>()
  }

  @JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
  @JsonSubTypes(
      Type(value = Issue::class, name = "issue"),
      Type(value = Measurement::class, name = "measurement")
  )
  @JsonIgnoreProperties(ignoreUnknown = true)
  open class Result {
    var engine_name = ""
  }

  class Measurement : Result() {
    var value = 0
    var name = ""
  }

  class Issue : Result() {
    var description = ""
    var check_name = ""
    var content: Content? = null
    var categories = listOf<String>()
    var location: Location = Location()
    var severity: String? = null
    var fingerprint: String? = null

    class Content {
      var body = ""
    }

    class Location {
      var path = ""
      var lines: Lines? = null
      var positions: Positions? = null

      class Lines {
        var begin = 0
        var end = 0
      }

      class Positions {
        var begin: Position? = null
        var end: Position? = null
      }

      // TODO: support "offset" position type
      // https://github.com/codeclimate/platform/blob/master/spec/analyzers/SPEC.md#positions
      class Position {
        var line: Int? = null
        var column: Int? = null
      }
    }
  }
}
