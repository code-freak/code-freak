package org.codefreak.codefreak.service.file

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Path
import java.nio.file.Paths
import java.util.UUID
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.archivers.tar.TarConstants
import org.apache.commons.compress.utils.IOUtils
import org.codefreak.codefreak.entity.FileCollection
import org.codefreak.codefreak.repository.FileCollectionRepository
import org.codefreak.codefreak.service.EntityNotFoundException
import org.codefreak.codefreak.util.TarUtil
import org.codefreak.codefreak.util.TarUtil.entrySequence
import org.codefreak.codefreak.util.withoutTrailingSlash
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Service
import org.springframework.util.DigestUtils

@Service
@ConditionalOnProperty(name = ["codefreak.files.adapter"], havingValue = "JPA")
class JpaFileService : FileService {

  @Autowired
  private lateinit var fileCollectionRepository: FileCollectionRepository

  override fun writeCollectionTar(collectionId: UUID): OutputStream {
    val collection = fileCollectionRepository.findById(collectionId).orElseGet { FileCollection(collectionId) }
    return object : ByteArrayOutputStream() {
      override fun close() {
        collection.tar = toByteArray()
        fileCollectionRepository.save(collection)
      }
    }
  }

  protected fun getCollection(collectionId: UUID): FileCollection = fileCollectionRepository.findById(collectionId)
      .orElseThrow { EntityNotFoundException("File not found") }

  override fun readCollectionTar(collectionId: UUID): InputStream {
    return ByteArrayInputStream(getCollection(collectionId).tar)
  }

  override fun collectionExists(collectionId: UUID): Boolean {
    return fileCollectionRepository.existsById(collectionId)
  }

  override fun deleteCollection(collectionId: UUID) {
    fileCollectionRepository.deleteById(collectionId)
  }

  override fun getCollectionMd5Digest(collectionId: UUID): ByteArray {
    return DigestUtils.md5Digest(getCollection(collectionId).tar)
  }

  override fun walkFileTree(collectionId: UUID): Sequence<FileMetaData> {
    getTarInputStream(collectionId).use { stream ->
      return stream.entrySequence()
          .map { tarEntryToFileMetaData(it) }
    }
  }

  override fun listFiles(collectionId: UUID, path: String): Sequence<FileMetaData> {
    requireDirectoryDoesExist(collectionId, path)
    val parentPath = Paths.get("/" + TarUtil.normalizeFileName(path))
    return walkFileTree(collectionId).filter {
      Paths.get(it.path).parent == parentPath
    }
  }

  private fun tarEntryToFileMetaData(entry: TarArchiveEntry): FileMetaData {
    return FileMetaData(
        path = "/" + TarUtil.normalizeFileName(entry.name),
        lastModifiedDate = entry.modTime.toInstant(),
        type = when {
          entry.isDirectory -> FileType.DIRECTORY
          else -> FileType.FILE
        },
        size = entry.size,
        mode = entry.mode
    )
  }

  override fun createFiles(collectionId: UUID, paths: Set<String>) {
    val normalizedPaths = paths.map { path ->
      TarUtil.normalizeFileName(path).also {
        requireValidPath(it)
        val parentDir = TarUtil.normalizeDirectoryName(getParentDir(path))
        requireDirectoryDoesExist(collectionId, parentDir)
        require(!containsPath(collectionId, it))
      }
    }

    getTarOutputStream(collectionId).use { output ->
      getTarInputStream(collectionId).use { input ->
        TarUtil.copyEntries(input, output)
      }
      normalizedPaths.forEach { TarUtil.touch(it, output) }
    }
  }

  private fun requireValidPath(path: String) = require(path.isNotBlank()) { "`$path` is not a valid path" }
  private fun requireFileDoesExist(collectionId: UUID, path: String) =
      require(containsFile(collectionId, path)) { "File `$path` does not exist" }

  private fun requireDirectoryDoesExist(collectionId: UUID, path: String) =
      require(containsDirectory(collectionId, path)) { "Directory `$path` does not exist" }

  private fun requireDirectoryDoesNotExist(collectionId: UUID, path: String) =
      require(!containsDirectory(collectionId, path)) { "Directory `$path` already exists" }

  override fun containsFile(collectionId: UUID, path: String): Boolean {
    return containsPath(collectionId, path) { it.isFile }
  }

  override fun containsDirectory(collectionId: UUID, path: String): Boolean {
    return TarUtil.isRoot(path) || containsPath(collectionId, path) { it.isDirectory }
  }

  private fun containsPath(
    collectionId: UUID,
    path: String,
    restriction: (TarArchiveEntry) -> Boolean = { true }
  ): Boolean = findEntry(collectionId, path, restriction) != null

  private fun findEntry(
    collectionId: UUID,
    path: String,
    restriction: (TarArchiveEntry) -> Boolean = { true }
  ): TarArchiveEntry? {
    // create a fake root entry as it might not be present in some archives
    if (TarUtil.isRoot(path)) {
      return TarArchiveEntry("./")
    }
    val normalizedFileName = TarUtil.normalizeFileName(path)
    getTarInputStream(collectionId).use { archive ->
      return archive.entrySequence().firstOrNull {
        TarUtil.normalizeFileName(it.name) == normalizedFileName && restriction(it)
      }
    }
  }

  private fun getTarInputStream(collectionId: UUID) = TarArchiveInputStream(readCollectionTar(collectionId))

  private fun getTarOutputStream(collectionId: UUID) = TarUtil.PosixTarArchiveOutputStream(writeCollectionTar(collectionId))

  /**
   * Return a set of ALL parent directories for a given path
   * This will not include path itself and not the root path /
   */
  private fun getParentDirs(path: String): Set<String> {
    val parents: MutableSet<String> = mutableSetOf()
    var currentParent: Path? = Paths.get("/$path").parent
    while (currentParent != null && currentParent.toString() != "/" && !parents.contains(currentParent.toString())) {
      parents.add(currentParent.toString())
      currentParent = currentParent.parent
    }
    return parents
  }

  private fun getParentDir(path: String): String {
    return Paths.get("/" + TarUtil.normalizeFileName(path)).parent?.toString() ?: "/"
  }

  override fun createDirectories(collectionId: UUID, paths: Set<String>) {
    val allDirs = paths.flatMap { path ->
      mutableSetOf<String>().also {
        it.addAll(getParentDirs(path))
        it.add(path)
      }
    }
    val normalizedPaths = allDirs.map { path ->
      TarUtil.normalizeFileName(path).also {
        requireValidPath(it)
        require(!containsFile(collectionId, it))
      }
    }.filter {
      // only create directories that are not already existing
      !containsDirectory(collectionId, it)
    }

    getTarOutputStream(collectionId).use { output ->
      getTarInputStream(collectionId).use { input ->
        TarUtil.copyEntries(input, output)
      }
      normalizedPaths.forEach { TarUtil.mkdir(it, output) }
    }
  }

  override fun deleteFiles(collectionId: UUID, paths: Set<String>) {
    val normalizedPaths = paths.map { path ->
      requireValidPath(TarUtil.normalizeEntryName(path))
      val fileExists = containsFile(collectionId, TarUtil.normalizeFileName(path))
      val directoryExists = containsDirectory(collectionId, TarUtil.normalizeDirectoryName(path))
      require(fileExists || directoryExists) { "`$path` does not exist" }

      if (fileExists) TarUtil.normalizeFileName(path) else TarUtil.normalizeDirectoryName(path)
    }

    getTarOutputStream(collectionId).use { output ->
      getTarInputStream(collectionId).use { input ->
        TarUtil.copyEntries(input, output) { entry -> !normalizedPaths.any { entry.name.startsWith(it) } }
      }
    }
  }

  override fun writeFile(collectionId: UUID, path: String): OutputStream {
    val normalizedPath = TarUtil.normalizeFileName(path)

    requireValidPath(normalizedPath)
    requireDirectoryDoesNotExist(collectionId, normalizedPath)

    return object : ByteArrayOutputStream() {
      override fun close() {
        getTarOutputStream(collectionId).use { output ->
          getTarInputStream(collectionId).use { input ->
            TarUtil.copyEntries(input, output) { entry -> entry.name != normalizedPath }
          }

          val contents = toByteArray()
          val entryToPut = TarArchiveEntry(normalizedPath, TarConstants.LF_NORMAL, false)
          entryToPut.mode = TarArchiveEntry.DEFAULT_FILE_MODE
          entryToPut.size = contents.size.toLong()
          output.putArchiveEntry(entryToPut)
          IOUtils.copy(contents.inputStream(), output)
          output.closeArchiveEntry()
        }
      }
    }
  }

  override fun readFile(collectionId: UUID, path: String): InputStream {
    val normalizedPath = TarUtil.normalizeFileName(path)

    requireValidPath(normalizedPath)
    requireFileDoesExist(collectionId, normalizedPath)

    getTarInputStream(collectionId).use {
      it.entrySequence().forEach { entry ->
        if (entry.name == normalizedPath) {
          val output = ByteArrayOutputStream()
          IOUtils.copy(it, output)
          return ByteArrayInputStream(output.toByteArray())
        }
      }
    }

    return ByteArrayInputStream(byteArrayOf())
  }

  override fun renameFile(collectionId: UUID, source: String, target: String) {
    requireValidPath(source)
    requireValidPath(target)
    val sourceEntry = findEntry(collectionId, TarUtil.normalizeFileName(source))
        ?: throw IllegalArgumentException("$source does not exist")
    val targetEntry = findEntry(collectionId, TarUtil.normalizeFileName(target))
    when {
      targetEntry != null && targetEntry.name == sourceEntry.name -> return // renaming file to itself. done
      targetEntry != null -> throw IllegalArgumentException("Target already exists")
    }

    val replaceMap: Map<String, String> = if (sourceEntry.isDirectory) {
      mapOf(
          // Rename everything starting with /foo/bar/* to /foo/baz/*
          TarUtil.normalizeDirectoryName(source) to TarUtil.normalizeDirectoryName(target)
      )
    } else {
      mapOf(
          // /foo/bar to /foo/baz
          TarUtil.normalizeFileName(source) to TarUtil.normalizeFileName(target)
      )
    }
    renameByPrefixInCollection(collectionId, replaceMap)
  }

  override fun moveFile(collectionId: UUID, sources: Set<String>, target: String) {
    if (sources.isEmpty()) {
      throw IllegalArgumentException("At least a single source has to be given")
    }

    // first make sure all source files exist and get their canonical path
    val normalizedSources = sources.map { source ->
      val normalizedPath = TarUtil.normalizeFileName(source)
      requireValidPath(normalizedPath)
      // get information about the file
      val entry = findEntry(collectionId, normalizedPath)
      when {
        entry == null -> throw IllegalArgumentException("$source does not exist in $collectionId")
        entry.isDirectory -> TarUtil.normalizeDirectoryName(source)
        else -> TarUtil.normalizeFileName(source)
      }
    }

    val targetEntry = findEntry(collectionId, target)
    when {
      targetEntry == null -> throw IllegalArgumentException("$target does not exist")
      !targetEntry.isDirectory -> throw IllegalArgumentException("Cannot move to $target: Is not directory")
    }

    // The following part will create a "replace map" for each source and target.
    // The map is a search->replace string pair where each path starting with search will be replaced.
    // This will prefix every basename (!) of source with target

    // prefix is now something like /hello/world/
    val targetPrefix = TarUtil.normalizeDirectoryName(target)
    val replaceMap: Map<String, String> = normalizedSources.flatMap { normalizedSource ->
      val sourceBasename = Paths.get("/$normalizedSource").fileName.toString()
      if (normalizedSource.endsWith("/")) {
        if (targetPrefix.startsWith(normalizedSource)) {
          throw IllegalArgumentException("Cannot move '$normalizedSource' to a subdirectory of itself '$targetPrefix'")
        }

        listOf(
            Pair(normalizedSource, TarUtil.normalizeDirectoryName(targetPrefix + sourceBasename))
        )
      } else {
        listOf(
            Pair(normalizedSource, TarUtil.normalizeFileName(targetPrefix + sourceBasename))
        )
      }
    }.toMap()

    renameByPrefixInCollection(collectionId, replaceMap)
  }

  /**
   * Replace filenames in an archive. ReplaceMap is a originalName -> newName map.
   * For each file this will try to find a string starting with the key of the replacement map.
   * The value of the first occurrence will be used to rename the file.
   *
   * Warning!
   * If you want to rename a directory make sure to end the name with a slash.
   */
  private fun renameByPrefixInCollection(collectionId: UUID, replaceMap: Map<String, String>) {
    // make sure we will not override something in the new directory
    replaceMap.forEach { (oldName, newName) ->
      require(oldName == newName || !containsPath(collectionId, newName)) {
        "Cannot move ${oldName.withoutTrailingSlash()}: ${newName.withoutTrailingSlash()} already exists"
      }
    }

    // go over every entry and replace all paths based on our map
    getTarOutputStream(collectionId).use { tar ->
      getTarInputStream(collectionId).use { input ->
        input.entrySequence().forEach { entry ->
          // find first matching replacement pattern and apply it to the name
          // otherwise leave the entry name untouched
          entry.name = replaceMap.entries.find { (search, _) ->
            if (search.endsWith("/")) {
              // either match files inside the directory or the directory itself
              TarUtil.normalizeFileName(entry.name).startsWith(search) || (
                TarUtil.normalizeFileName(entry.name) == TarUtil.normalizeFileName(search)
              )
            } else {
              // otherwise only a full match is valid
              search == TarUtil.normalizeFileName(entry.name)
            }
          }?.let { (search, replace) ->
            if (search.endsWith("/") && TarUtil.normalizeFileName(entry.name) != TarUtil.normalizeFileName(search)) {
              TarUtil.normalizeFileName(entry.name).replaceRange(0, search.length, replace)
            } else {
              replace
            }
          } ?: entry.name

          tar.putArchiveEntry(entry)
          IOUtils.copy(input, tar)
          tar.closeArchiveEntry()
        }
      }
    }
  }
}
