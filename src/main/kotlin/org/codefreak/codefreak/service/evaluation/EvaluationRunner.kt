package org.codefreak.codefreak.service.evaluation

import kotlin.reflect.KClass
import kotlin.reflect.full.safeCast
import org.codefreak.codefreak.entity.Answer
import org.codefreak.codefreak.entity.Feedback

interface EvaluationRunner {

  fun getName(): String
  fun getDefaultTitle() = getName()
  fun getDocumentationUrl(): String? = null
  fun run(answer: Answer, options: Map<String, Any>): List<Feedback>

  /**
   * Returns the schema of the options map that is passed to [run].
   */
  fun getOptionsSchema() = "{}"

  /**
   * Returns the default options for the runner
   */
  fun getDefaultOptions() = mapOf<String, Any>()

  /**
   * Default feedback summary is the number of each severities
   */
  fun summarize(feedbackList: List<Feedback>): String {
    val severityCount = feedbackList.groupingBy { it.severity ?: Feedback.Severity.INFO }.eachCount()
    return severityCount.toSortedMap()
        .map { (severity, count) -> "${count}x ${severity.name.lowercase()}" }
        .joinToString(" / ")
  }

  fun <T : Any> Map<String, Any>.get(key: String, type: KClass<T>): T? =
      get(key)?.let { type.safeCast(it) ?: throw IllegalArgumentException("Option '$key' has invalid format") }

  fun <T : Any> Map<String, Any>.getRequired(key: String, type: KClass<T>): T =
      get(key, type) ?: throw IllegalArgumentException("Option '$key' is required")

  fun <T : Any> Map<String, Any>.getList(key: String, type: KClass<T>, required: Boolean = false): List<T>? {
    val result = if (required) getRequired(key, List::class) else get(key, List::class)
    return result?.map { type.safeCast(it) ?: throw IllegalArgumentException("Option '$key' has invalid format") }
  }
}
