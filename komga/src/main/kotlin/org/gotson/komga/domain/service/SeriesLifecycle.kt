package org.gotson.komga.domain.service

import mu.KotlinLogging
import net.greypanther.natsort.CaseInsensitiveSimpleNaturalComparator
import org.apache.commons.lang3.StringUtils
import org.gotson.komga.application.events.EventPublisher
import org.gotson.komga.application.tasks.TaskReceiver
import org.gotson.komga.domain.model.Book
import org.gotson.komga.domain.model.BookMetadata
import org.gotson.komga.domain.model.BookMetadataAggregation
import org.gotson.komga.domain.model.BookMetadataPatchCapability
import org.gotson.komga.domain.model.DomainEvent
import org.gotson.komga.domain.model.KomgaUser
import org.gotson.komga.domain.model.Library
import org.gotson.komga.domain.model.Media
import org.gotson.komga.domain.model.ReadProgress
import org.gotson.komga.domain.model.Series
import org.gotson.komga.domain.model.SeriesMetadata
import org.gotson.komga.domain.model.ThumbnailSeries
import org.gotson.komga.domain.persistence.BookMetadataAggregationRepository
import org.gotson.komga.domain.persistence.BookMetadataRepository
import org.gotson.komga.domain.persistence.BookRepository
import org.gotson.komga.domain.persistence.LibraryRepository
import org.gotson.komga.domain.persistence.MediaRepository
import org.gotson.komga.domain.persistence.ReadProgressRepository
import org.gotson.komga.domain.persistence.SeriesCollectionRepository
import org.gotson.komga.domain.persistence.SeriesMetadataRepository
import org.gotson.komga.domain.persistence.SeriesRepository
import org.gotson.komga.domain.persistence.ThumbnailSeriesRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.io.File
import java.nio.file.Files
import java.nio.file.Paths
import java.time.LocalDateTime

private val logger = KotlinLogging.logger {}
private val natSortComparator: Comparator<String> = CaseInsensitiveSimpleNaturalComparator.getInstance()

@Service
class SeriesLifecycle(
  private val libraryRepository: LibraryRepository,
  private val bookRepository: BookRepository,
  private val bookLifecycle: BookLifecycle,
  private val mediaRepository: MediaRepository,
  private val bookMetadataRepository: BookMetadataRepository,
  private val seriesRepository: SeriesRepository,
  private val thumbnailsSeriesRepository: ThumbnailSeriesRepository,
  private val seriesMetadataRepository: SeriesMetadataRepository,
  private val bookMetadataAggregationRepository: BookMetadataAggregationRepository,
  private val collectionRepository: SeriesCollectionRepository,
  private val readProgressRepository: ReadProgressRepository,
  private val taskReceiver: TaskReceiver,
  private val eventPublisher: EventPublisher,
  private val transactionTemplate: TransactionTemplate,
) {

  fun sortBooks(series: Series) {
    logger.debug { "Sorting books for $series" }

    val books = bookRepository.findAllBySeriesId(series.id)
    val metadatas = bookMetadataRepository.findAllByIds(books.map { it.id })
    logger.debug { "Existing books: $books" }
    logger.debug { "Existing metadata: $metadatas" }

    val sorted = books
      .sortedWith(compareBy(natSortComparator) { it.name })
      .map { book -> book to metadatas.first { it.bookId == book.id } }
    logger.debug { "Sorted books: $sorted" }

    bookRepository.update(
      sorted.mapIndexed { index, (book, _) -> book.copy(number = index + 1) }
    )

    val oldToNew = sorted.mapIndexedNotNull { index, (_, metadata) ->
      if (metadata.numberLock && metadata.numberSortLock) null
      else metadata to metadata.copy(
        number = if (!metadata.numberLock) (index + 1).toString() else metadata.number,
        numberSort = if (!metadata.numberSortLock) (index + 1).toFloat() else metadata.numberSort
      )
    }
    bookMetadataRepository.update(oldToNew.map { it.second })

    // refresh metadata to reimport book number, else the series resorting would overwrite it
    oldToNew.forEach { (old, new) ->
      if (old.number != new.number || old.numberSort != new.numberSort) {
        logger.debug { "Metadata numbering has changed, refreshing metadata for book ${new.bookId} " }
        taskReceiver.refreshBookMetadata(new.bookId, listOf(BookMetadataPatchCapability.NUMBER, BookMetadataPatchCapability.NUMBER_SORT))
      }
    }

    // update book count for series
    seriesRepository.findByIdOrNull(series.id)?.let {
      seriesRepository.update(it.copy(bookCount = books.size))
    }
  }

  fun addBooks(series: Series, booksToAdd: Collection<Book>) {
    booksToAdd.forEach {
      check(it.libraryId == series.libraryId) { "Cannot add book to series if they don't share the same libraryId" }
    }
    val toAdd = booksToAdd.map { it.copy(seriesId = series.id) }

    transactionTemplate.executeWithoutResult {
      bookRepository.insert(toAdd)

      // create associated media
      mediaRepository.insert(toAdd.map { Media(bookId = it.id) })

      // create associated metadata
      toAdd.map {
        BookMetadata(
          title = it.name,
          number = it.number.toString(),
          numberSort = it.number.toFloat(),
          bookId = it.id
        )
      }.let { bookMetadataRepository.insert(it) }
    }

    toAdd.forEach { eventPublisher.publishEvent(DomainEvent.BookAdded(it)) }
  }

  fun createSeries(series: Series): Series {
    transactionTemplate.executeWithoutResult {
      seriesRepository.insert(series)

      seriesMetadataRepository.insert(
        SeriesMetadata(
          title = series.name,
          titleSort = StringUtils.stripAccents(series.name),
          seriesId = series.id
        )
      )

      bookMetadataAggregationRepository.insert(
        BookMetadataAggregation(seriesId = series.id)
      )
    }

    eventPublisher.publishEvent(DomainEvent.SeriesAdded(series))

    return seriesRepository.findByIdOrNull(series.id)!!
  }

  fun softDeleteMany(series: Collection<Series>) {
    logger.info { "Soft delete series: $series" }
    val deletedDate = LocalDateTime.now()

    transactionTemplate.executeWithoutResult {
      bookLifecycle.softDeleteMany(bookRepository.findAllBySeriesIds(series.map { it.id }))
      series.forEach {
        seriesRepository.update(it.copy(deletedDate = deletedDate))
      }
    }

    series.forEach { eventPublisher.publishEvent(DomainEvent.SeriesUpdated(it)) }
  }

  fun deleteMany(series: Collection<Series>) {
    val seriesIds = series.map { it.id }
    logger.info { "Delete series ids: $seriesIds" }

    transactionTemplate.executeWithoutResult {
      bookLifecycle.deleteMany(bookRepository.findAllBySeriesIds(seriesIds))

      readProgressRepository.deleteBySeriesIds(seriesIds)
      collectionRepository.removeSeriesFromAll(seriesIds)
      thumbnailsSeriesRepository.deleteBySeriesIds(seriesIds)
      seriesMetadataRepository.delete(seriesIds)
      bookMetadataAggregationRepository.delete(seriesIds)

      seriesRepository.delete(seriesIds)
    }

    series.forEach { eventPublisher.publishEvent(DomainEvent.SeriesDeleted(it)) }
  }

  fun markReadProgressCompleted(seriesId: String, user: KomgaUser) {
    val progresses = mediaRepository.getPagesSizes(bookRepository.findAllIdsBySeriesId(seriesId))
      .map { (bookId, pageSize) -> ReadProgress(bookId, user.id, pageSize, true) }

    readProgressRepository.save(progresses)
    progresses.forEach { eventPublisher.publishEvent(DomainEvent.ReadProgressChanged(it)) }
    eventPublisher.publishEvent(DomainEvent.ReadProgressSeriesChanged(seriesId, user.id))
  }

  fun deleteReadProgress(seriesId: String, user: KomgaUser) {
    val bookIds = bookRepository.findAllIdsBySeriesId(seriesId)
    val progresses = readProgressRepository.findAllByBookIdsAndUserId(bookIds, user.id)
    readProgressRepository.deleteByBookIdsAndUserId(bookIds, user.id)

    progresses.forEach { eventPublisher.publishEvent(DomainEvent.ReadProgressDeleted(it)) }
    eventPublisher.publishEvent(DomainEvent.ReadProgressSeriesDeleted(seriesId, user.id))
  }

  fun getThumbnail(seriesId: String): ThumbnailSeries? {
    val selected = thumbnailsSeriesRepository.findSelectedBySeriesIdOrNull(seriesId)

    if (selected == null || !selected.exists()) {
      thumbnailsHouseKeeping(seriesId)
      return thumbnailsSeriesRepository.findSelectedBySeriesIdOrNull(seriesId)
    }

    return selected
  }

  fun getThumbnailBytes(seriesId: String, userId: String): ByteArray? {
    getThumbnail(seriesId)?.let {
      return File(it.url.toURI()).readBytes()
    }

    seriesRepository.findByIdOrNull(seriesId)?.let { series ->
      val bookId = when (libraryRepository.findById(series.libraryId).seriesCover) {
        Library.SeriesCover.FIRST -> bookRepository.findFirstIdInSeriesOrNull(seriesId)
        Library.SeriesCover.FIRST_UNREAD_OR_FIRST -> bookRepository.findFirstUnreadIdInSeriesOrNull(seriesId, userId)
          ?: bookRepository.findFirstIdInSeriesOrNull(seriesId)
        Library.SeriesCover.FIRST_UNREAD_OR_LAST -> bookRepository.findFirstUnreadIdInSeriesOrNull(seriesId, userId)
          ?: bookRepository.findLastIdInSeriesOrNull(seriesId)
        Library.SeriesCover.LAST -> bookRepository.findLastIdInSeriesOrNull(seriesId)
      }
      if (bookId != null) return bookLifecycle.getThumbnailBytes(bookId)
    }

    return null
  }

  fun addThumbnailForSeries(thumbnail: ThumbnailSeries) {
    // delete existing thumbnail with the same url
    thumbnailsSeriesRepository.findAllBySeriesId(thumbnail.seriesId)
      .filter { it.url == thumbnail.url }
      .forEach {
        thumbnailsSeriesRepository.delete(it.id)
      }
    thumbnailsSeriesRepository.insert(thumbnail)

    eventPublisher.publishEvent(DomainEvent.ThumbnailSeriesAdded(thumbnail))

    if (thumbnail.selected)
      thumbnailsSeriesRepository.markSelected(thumbnail)
  }

  private fun thumbnailsHouseKeeping(seriesId: String) {
    logger.info { "House keeping thumbnails for series: $seriesId" }
    val all = thumbnailsSeriesRepository.findAllBySeriesId(seriesId)
      .mapNotNull {
        if (!it.exists()) {
          logger.warn { "Thumbnail doesn't exist, removing entry" }
          thumbnailsSeriesRepository.delete(it.id)
          null
        } else it
      }

    val selected = all.filter { it.selected }
    when {
      selected.size > 1 -> {
        logger.info { "More than one thumbnail is selected, removing extra ones" }
        thumbnailsSeriesRepository.markSelected(selected[0])
      }
      selected.isEmpty() && all.isNotEmpty() -> {
        logger.info { "Series has no selected thumbnail, choosing one automatically" }
        thumbnailsSeriesRepository.markSelected(all.first())
      }
    }
  }

  private fun ThumbnailSeries.exists(): Boolean = Files.exists(Paths.get(url.toURI()))
}
