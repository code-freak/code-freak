package de.code_freak.codefreak.service

import com.spotify.docker.client.DockerClient
import com.spotify.docker.client.exceptions.ImageNotFoundException
import com.spotify.docker.client.messages.ContainerConfig
import com.spotify.docker.client.messages.ExecState
import com.spotify.docker.client.messages.HostConfig
import de.code_freak.codefreak.config.AppConfiguration
import de.code_freak.codefreak.entity.Answer
import de.code_freak.codefreak.repository.AnswerRepository
import org.apache.commons.io.IOUtils
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.event.ContextRefreshedEvent
import org.springframework.context.event.EventListener
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Service
import java.util.UUID
import javax.transaction.Transactional

@Service
class ContainerService : BaseService() {
  class ExecException(val execState: ExecState, val output: String) : RuntimeException(
      """Command ${execState.processConfig().arguments().joinToString(" ")} failed with non-zero exit code (${execState.exitCode()})"""
  )

  companion object {
    private const val LABEL_PREFIX = "de.code-freak."
    const val LABEL_ANSWER_ID = LABEL_PREFIX + "answer-id"
    const val LABEL_LATEX_CONTAINER = "{$LABEL_PREFIX}latex-service"
    const val LABEL_INSTANCE_ID = LABEL_PREFIX + "instance-id"
    const val PROJECT_PATH = "/home/coder/project"
  }

  private val log = LoggerFactory.getLogger(this::class.java)
  private var idleContainers: Map<String, Long> = mapOf()

  @Autowired
  lateinit var docker: DockerClient

  @Autowired
  lateinit var config: AppConfiguration

  @Autowired
  private lateinit var answerRepository: AnswerRepository

  @Autowired
  private lateinit var containerService: ContainerService

  /**
   * Pull all required docker images on startup
   */
  @EventListener(ContextRefreshedEvent::class)
  fun pullDockerImages() {
    val images = listOf(config.ide.image, config.latex.image)
    for (image in images) {
      val imageInfo = try {
        docker.inspectImage(image)
      } catch (e: ImageNotFoundException) {
        null
      }

      val pullRequired = config.docker.pullPolicy == "always" || (config.docker.pullPolicy == "if-not-present" && imageInfo == null)
      if (!pullRequired) {
        if (imageInfo == null) {
          log.warn("Image pulling is disabled but $image is not available on the daemon!")
        } else {
          log.info("Image present: $image ${imageInfo.id()}")
        }
        continue
      }

      log.info("Pulling latest image for: $image")
      docker.pull(image)
      log.info("Updated docker image $image to ${docker.inspectImage(image).id()}")
    }
  }

  fun getLatexContainer() = getContainerWithLabel(LABEL_LATEX_CONTAINER, "true")

  fun createLatexContainer(): String {
    val hostConfig = HostConfig.builder()
        .restartPolicy(HostConfig.RestartPolicy.unlessStopped())
        .build()

    val containerConfig = ContainerConfig.builder()
        .image(config.latex.image)
        // keep the container running by tailing /dev/null
        .cmd("tail", "-f", "/dev/null")
        .labels(
            mapOf(LABEL_INSTANCE_ID to config.instanceId, LABEL_LATEX_CONTAINER to "true")
        )
        .hostConfig(hostConfig)
        .build()

    val containerId = docker.createContainer(containerConfig).id()!!
    docker.startContainer(containerId)
    return containerId
  }

  /**
   * Convert the latex file in the given archive to pdf and return the directory after pdflatex has been run
   */
  fun latexConvert(inputTar: ByteArray, file: String): ByteArray {
    val latexContainer = getLatexContainer() ?: createLatexContainer()
    val jobPath = exec(latexContainer, arrayOf("mktemp", "-d")).trim()
    docker.copyToContainer(inputTar.inputStream(), latexContainer, jobPath)
    try {
      exec(
          latexContainer,
          arrayOf("sh", "-c", "cd $jobPath && xelatex -synctex=1 -interaction=nonstopmode $file"),
          true
      )
      return docker.archiveContainer(latexContainer, "$jobPath/.").readBytes()
    } finally {
      // cleanup but throw the error
      exec(latexContainer, arrayOf("rm", "-rf", jobPath))
    }
  }

  /**
   * Start an IDE container for the given submission and returns the container ID
   * If there is already a container for the submission it will be used instead
   */
  fun startIdeContainer(answer: Answer) {
    // either take existing container or create a new one
    var containerId = this.getIdeContainer(answer)
    if (containerId == null) {
      containerId = this.createIdeContainer(answer)
      docker.startContainer(containerId)
      // prepare the environment after the container has started
      this.prepareIdeContainer(containerId, answer)
    } else if (!isContainerRunning(containerId)) {
      // make sure the container is running. Also existing ones could have been stopped
      docker.startContainer(containerId)
    }
  }

  /**
   * Run a command as root inside container and return the result as string
   */
  fun exec(containerId: String, cmd: Array<String>, throwOnNonZero: Boolean = false): String {
    val exec = docker.execCreate(
        containerId, cmd,
        DockerClient.ExecCreateParam.attachStdin(), // this is not needed but a workaround for spotify/docker-client#513
        DockerClient.ExecCreateParam.attachStdout(),
        DockerClient.ExecCreateParam.attachStderr(),
        DockerClient.ExecCreateParam.user("root")
    )
    val output = docker.execStart(exec.id()).readFully()
    if (throwOnNonZero) {
      val status = docker.execInspect(exec.id())
      if (status.exitCode()?.equals(0L) != true) {
        throw ExecException(status, output)
      }
    }
    return output
  }

  /**
   * Get the URL for an IDE container
   * TODO: make this configurable for different types of hosting/reverse proxies/etc
   */
  fun getIdeUrl(answerId: UUID): String {
    return "${config.traefik.url}/ide/$answerId/"
  }

  /**
   * Try to find an existing container for the given submission
   */
  protected fun getIdeContainer(answer: Answer): String? {
    return getContainerWithLabel(LABEL_ANSWER_ID, answer.id.toString())
  }

  protected fun getContainerWithLabel(label: String, value: String): String? {
    return docker.listContainers(
        DockerClient.ListContainersParam.withLabel(label, value),
        DockerClient.ListContainersParam.withLabel(LABEL_INSTANCE_ID, config.instanceId),
        DockerClient.ListContainersParam.limitContainers(1)
    ).firstOrNull()?.id()
  }

  @Transactional
  fun saveAnswerFiles(answer: Answer): Answer {
    val containerId = getIdeContainer(answer) ?: throw IllegalArgumentException()
    docker.archiveContainer(containerId, "$PROJECT_PATH/.").use {
      answer.files = IOUtils.toByteArray(it)
    }
    log.info("Saved files of container with id: $containerId")
    return entityManager.merge(answer)
  }

  /**
   * Configure and create a new IDE container.
   * Returns the ID of the created container
   */
  protected fun createIdeContainer(answer: Answer): String {
    val answerId = answer.id.toString()

    val labels = mapOf(
        LABEL_INSTANCE_ID to config.instanceId,
        LABEL_ANSWER_ID to answerId,
        "traefik.enable" to "true",
        "traefik.frontend.rule" to "PathPrefixStrip: /ide/$answerId/",
        "traefik.port" to "3000",
        "traefik.frontend.headers.customResponseHeaders" to "Access-Control-Allow-Origin:*"
    )

    val hostConfig = HostConfig.builder()
        .restartPolicy(HostConfig.RestartPolicy.unlessStopped())
        .capAdd("SYS_PTRACE") // required for lsof
        .memory(config.docker.memory)
        .memorySwap(config.docker.memory) // memory+swap = memory ==> 0 swap
        .nanoCpus(config.docker.cpus * 1000000000L)
        .build()

    val containerConfig = ContainerConfig.builder()
        .image(config.ide.image)
        .labels(labels)
        .hostConfig(hostConfig)
        .build()

    val container = docker.createContainer(containerConfig)

    // attach to network
    docker.connectToNetwork(container.id(), config.docker.network)

    return container.id()!!
  }

  /**
   * Prepare a running container with files and other commands like chmod, etc.
   */
  protected fun prepareIdeContainer(containerId: String, answer: Answer) {
    // extract possible existing files of the current submission into project dir
    answer.files?.let {
      docker.copyToContainer(it.inputStream(), containerId, PROJECT_PATH)
    }
    // change owner from root to coder so we can edit our project files
    exec(containerId, arrayOf("chown", "-R", "coder:coder", PROJECT_PATH))
  }

  protected fun isContainerRunning(containerId: String): Boolean = docker.inspectContainer(containerId).state().running()

  @Scheduled(
      fixedRateString = "\${code-freak.ide.idle-check-rate}",
      initialDelayString = "\${code-freak.ide.idle-check-rate}"
  )
  protected fun shutdownIdleIdeContainers() {
    log.debug("Checking for idle containers")
    // create a new map to not leak memory if containers disappear in another way
    val newIdleContainers: MutableMap<String, Long> = mutableMapOf()
    docker.listContainers(
        DockerClient.ListContainersParam.withLabel(LABEL_ANSWER_ID),
        DockerClient.ListContainersParam.withStatusRunning()
    )
        .forEach {
          val containerId = it.id()
          // TODO: Use `cat /proc/net/tcp` instead of lsof (requires no privileges)
          val connections = exec(containerId, arrayOf("/opt/code-freak/num-active-connections.sh")).trim()
          if (connections == "0") {
            val now = System.currentTimeMillis()
            val idleSince = idleContainers[containerId] ?: now
            val idleFor = now - idleSince
            log.debug("Container $containerId has been idle for more than $idleFor ms")
            if (idleFor >= config.ide.idleShutdownThreshold) {
              val answerId = it.labels()!![LABEL_ANSWER_ID]
              val answer = answerRepository.findById(UUID.fromString(answerId))
              if (answer.isPresent) {
                containerService.saveAnswerFiles(answer.get())
              } else {
                log.warn("Answer $answerId not found. Files are not saved!")
              }
              log.info("Shutting down container $containerId of answer $answerId")
              docker.stopContainer(containerId, 5)
              docker.removeContainer(containerId)
            } else {
              newIdleContainers[containerId] = idleSince
            }
          }
        }
    idleContainers = newIdleContainers
  }
}
