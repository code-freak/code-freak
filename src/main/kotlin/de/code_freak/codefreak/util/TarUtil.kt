package de.code_freak.codefreak.util

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory
import org.apache.commons.compress.archivers.ArchiveException
import org.apache.commons.compress.archivers.ArchiveStreamFactory
import org.apache.commons.compress.archivers.tar.TarArchiveEntry
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.archivers.tar.TarArchiveOutputStream
import org.apache.commons.compress.archivers.zip.ZipArchiveEntry
import org.apache.commons.compress.archivers.zip.ZipArchiveOutputStream
import org.apache.commons.compress.compressors.CompressorException
import org.apache.commons.compress.compressors.CompressorStreamFactory
import org.apache.commons.compress.utils.IOUtils
import org.springframework.util.StreamUtils
import org.springframework.web.multipart.MultipartFile
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream

object TarUtil {
  fun extractTarToDirectory(`in`: InputStream, destination: File) {
    if (!destination.exists()) {
      destination.mkdirs()
    } else if (!destination.isDirectory) {
      throw IOException("${destination.absolutePath} already exists and is no directory")
    }
    val tar = TarArchiveInputStream(`in`)
    for (entry in generateSequence { tar.nextTarEntry }.filter { !it.isDirectory }) {
      val outFile = File(destination, entry.name)
      outFile.parentFile.mkdirs()
      outFile.outputStream().use { IOUtils.copy(tar, it) }
      outFile.setLastModified(entry.lastModifiedDate.time)
      // check if executable bit for user is set
      // octal 100 = dec 64
      outFile.setExecutable((entry.mode and 64) == 64)
    }
  }

  fun createTarFromDirectory(file: File, out: OutputStream) {
    require(file.isDirectory) { "FileCollection must be a directory" }

    val tar = TarArchiveOutputStream(out)
    tar.setBigNumberMode(TarArchiveOutputStream.BIGNUMBER_STAR)
    tar.setLongFileMode(TarArchiveOutputStream.LONGFILE_GNU)
    addFileToTar(tar, file, ".")
    tar.finish()
  }

  private fun addFileToTar(tar: TarArchiveOutputStream, file: File, name: String) {
    val entry = TarArchiveEntry(file, normalizeEntryName(name))
    // add the executable bit for user. Default mode is 0644
    // 0644 + 0100 = 0744
    if (file.isFile && file.canExecute()) {
      entry.mode += 64 // 0100
    }

    tar.putArchiveEntry(entry)

    if (file.isFile) {
      BufferedInputStream(FileInputStream(file)).use {
        IOUtils.copy(it, tar)
      }
      tar.closeArchiveEntry()
    } else if (file.isDirectory) {
      tar.closeArchiveEntry()
      for (child in file.listFiles() ?: emptyArray()) {
        addFileToTar(tar, child, "$name/${child.name}")
      }
    }
  }

  fun tarToZip(`in`: InputStream, out: OutputStream) {
    val tar = TarArchiveInputStream(`in`)
    val zip = ZipArchiveOutputStream(out)
    generateSequence { tar.nextTarEntry }.forEach { tarEntry ->
      val zipEntry = ZipArchiveEntry(normalizeEntryName(tarEntry.name))
      if (tarEntry.isFile) {
        zipEntry.size = tarEntry.size
        zip.putArchiveEntry(zipEntry)
        IOUtils.copy(tar, zip)
      } else {
        zip.putArchiveEntry(zipEntry)
      }
      zip.closeArchiveEntry()
    }
    zip.finish()
  }

  fun archiveToTar(`in`: InputStream, out: OutputStream) {
    var input = BufferedInputStream(`in`)
    try {
      // try to read input as compressed type
      input = BufferedInputStream(CompressorStreamFactory().createCompressorInputStream(input))
    } catch (e: CompressorException) {
      // input is not compressed or maybe even not an archive at all
    }
    val archive = ArchiveStreamFactory().createArchiveInputStream(input)
    val tar = TarArchiveOutputStream(out)
    generateSequence { archive.nextEntry }.forEach { archiveEntry ->
      val tarEntry = TarArchiveEntry(normalizeEntryName(archiveEntry.name))
      if (archiveEntry.isDirectory) {
        tar.putArchiveEntry(tarEntry)
      } else {
        val content = archive.readBytes()
        tarEntry.size = content.size.toLong()
        tar.putArchiveEntry(tarEntry)
        tar.write(content)
      }
      tar.closeArchiveEntry()
    }
    tar.finish()
  }

  fun normalizeEntryName(name: String): String {
    if (name == ".") return ""
    return if (name.startsWith("./")) name.drop(2) else name
  }

  fun copyEntries(from: TarArchiveInputStream, to: TarArchiveOutputStream, filter: (TarArchiveEntry) -> Boolean = { true }) {
    generateSequence { from.nextTarEntry }
        .filter { filter(it) }
        .forEach { copyEntry(from, to, it) }
  }

  private fun copyEntry(from: TarArchiveInputStream, to: TarArchiveOutputStream, entry: TarArchiveEntry) {
    to.putArchiveEntry(entry)
    if (entry.isFile) {
      StreamUtils.copy(from, to)
    }
    to.closeArchiveEntry()
  }

  inline fun <reified T> getYamlDefinition(`in`: InputStream): T {
    TarArchiveInputStream(`in`).let { tar -> generateSequence { tar.nextTarEntry }.forEach {
      if (it.isFile && normalizeEntryName(it.name) == "codefreak.yml") {
        val mapper = ObjectMapper(YAMLFactory())
        return mapper.readValue(tar, T::class.java)
      }
    } }
    throw java.lang.IllegalArgumentException("codefreak.yml does not exist")
  }

  fun extractSubdirectory(`in`: InputStream, out: OutputStream, path: String) {
    val prefix = normalizeEntryName(path).withTrailingSlash()
    val extracted = TarArchiveOutputStream(out)
    TarArchiveInputStream(`in`).let { tar ->
      generateSequence { tar.nextTarEntry }.forEach {
        if (normalizeEntryName(it.name).startsWith(prefix)) {
          it.name = normalizeEntryName(it.name).drop(prefix.length)
          copyEntry(tar, extracted, it)
        }
      }
    }
  }

  fun writeUploadAsTar(file: MultipartFile, out: OutputStream) {
    try {
      try {
        // try to read upload as archive
        file.inputStream.use { archiveToTar(it, out) }
      } catch (e: ArchiveException) {
        // unknown archive type or no archive at all
        // create a new tar archive that contains only the uploaded file
        wrapUploadInTar(file, out)
      }
    } catch (e: IOException) {
      throw IllegalArgumentException("File could not be processed")
    }
  }

  private fun wrapUploadInTar(file: MultipartFile, out: OutputStream) {
    val outputStream = TarArchiveOutputStream(out)
    val entry = TarArchiveEntry(file.originalFilename)
    entry.size = file.size
    outputStream.putArchiveEntry(entry)
    file.inputStream.use { StreamUtils.copy(it, outputStream) }
    outputStream.closeArchiveEntry()
    outputStream.finish()
  }
}
