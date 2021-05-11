package org.codefreak.codefreak.util

import org.springframework.core.io.ClassPathResource

enum class TaskTemplate {
  JAVA, PYTHON, CSHARP, JAVASCRIPT, CPP
}

object TaskTemplateUtil {
  fun readTemplateTar(template: TaskTemplate): ByteArray {
    val path = "org/codefreak/templates/${template.name.lowercase()}.tar"
    return ClassPathResource(path).inputStream.use { it.readBytes() }
  }
}
