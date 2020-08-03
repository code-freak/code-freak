package org.codefreak.codefreak.frontend

import java.lang.Exception
import java.lang.IllegalStateException
import java.util.UUID
import org.codefreak.codefreak.service.EntityNotFoundException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ControllerAdvice
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.method.HandlerMethod
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.ModelAndView
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler

/**
 * Global exception handler for the frontend (is applied to all controllers).
 */
@ControllerAdvice
class ExceptionHandlerAdvice : ResponseEntityExceptionHandler() {

  @ExceptionHandler(EntityNotFoundException::class, NoSuchElementException::class)
  fun handleNotFoundException(throwable: Throwable, controllerMethod: HandlerMethod): Any {
    return getResponse(throwable.message, controllerMethod, HttpStatus.NOT_FOUND)
  }

  @ExceptionHandler(IllegalArgumentException::class, IllegalStateException::class)
  fun handleIllegalArgumentOrStateException(
    ex: Exception,
    controllerMethod: HandlerMethod
  ): Any {
    return getResponse(ex.message, controllerMethod, HttpStatus.BAD_REQUEST)
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException::class)
  fun handleMethodArgumentTypeMismatchException(
    ex: MethodArgumentTypeMismatchException,
    controllerMethod: HandlerMethod
  ): Any {
    return if (ex.parameter.parameterType == UUID::class.java) {
      getResponse(null, controllerMethod, HttpStatus.NOT_FOUND)
    } else {
      getResponse(ex.message, controllerMethod, HttpStatus.BAD_REQUEST)
    }
  }

  /**
   * Generates a response depending on the current controller. For normal controllers the "error"
   * template is returned and supplied with the usual model, for REST controllers the
   * `message` is returned as response body.
   */
  protected fun getResponse(message: Any?, controllerMethod: HandlerMethod, status: HttpStatus): Any {

    val isRestHandler = controllerMethod.hasMethodAnnotation(RestHandler::class.java) ||
        controllerMethod.beanType.isAnnotationPresent(RestController::class.java)

    return if (isRestHandler) {
      ResponseEntity(message, status)
    } else {
      val model = mapOf(
          "message" to (message ?: "No message available"),
          "status" to status.value(),
          "error" to status.reasonPhrase
      )
      ModelAndView("error", model, status)
    }
  }
}
