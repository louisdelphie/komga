import {AxiosInstance} from 'axios'
import {BookDto, BookImportBatchDto, BookMetadataUpdateDto, PageDto, ReadProgressUpdateDto} from '@/types/komga-books'
import {formatISO} from 'date-fns'

const qs = require('qs')

const API_BOOKS = '/api/v1/books'

export default class KomgaBooksService {
  private http: AxiosInstance;

  constructor(http: AxiosInstance) {
    this.http = http
  }

  async getBooks(libraryId?: string, pageRequest?: PageRequest, search?: string, mediaStatus?: string[], readStatus?: string[], releasedAfter?: Date): Promise<Page<BookDto>> {
    try {
      const params = {...pageRequest} as any
      if (libraryId) {
        params.library_id = libraryId
      }
      if (search) {
        params.search = search
      }
      if (mediaStatus) {
        params.media_status = mediaStatus
      }
      if (readStatus) {
        params.read_status = readStatus
      }
      if (releasedAfter) {
        params.released_after = formatISO(releasedAfter, { representation: 'date' })
      }
      return (await this.http.get(API_BOOKS, {
        params: params,
        paramsSerializer: params => qs.stringify(params, {indices: false}),
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve books'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBooksOnDeck(libraryId?: string, pageRequest?: PageRequest): Promise<Page<BookDto>> {
    try {
      const params = {...pageRequest} as any
      if (libraryId) {
        params.library_id = libraryId
      }
      return (await this.http.get(`${API_BOOKS}/ondeck`, {
        params: params,
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve books on deck'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBook(bookId: string): Promise<BookDto> {
    try {
      return (await this.http.get(`${API_BOOKS}/${bookId}`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve book'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBookSiblingNext(bookId: string): Promise<BookDto> {
    try {
      return (await this.http.get(`${API_BOOKS}/${bookId}/next`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve book'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBookSiblingPrevious(bookId: string): Promise<BookDto> {
    try {
      return (await this.http.get(`${API_BOOKS}/${bookId}/previous`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve book'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBookPages(bookId: string): Promise<PageDto[]> {
    try {
      return (await this.http.get(`${API_BOOKS}/${bookId}/pages`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve book pages'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getReadLists(bookId: string): Promise<ReadListDto[]> {
    try {
      return (await this.http.get(`${API_BOOKS}/${bookId}/readlists`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve read lists'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async analyzeBook(book: BookDto) {
    try {
      await this.http.post(`${API_BOOKS}/${book.id}/analyze`)
    } catch (e) {
      let msg = `An error occurred while trying to analyze book '${book.name}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async refreshMetadata(book: BookDto) {
    try {
      await this.http.post(`${API_BOOKS}/${book.id}/metadata/refresh`)
    } catch (e) {
      let msg = `An error occurred while trying to refresh metadata for book '${book.name}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async updateMetadata(bookId: string, metadata: BookMetadataUpdateDto) {
    try {
      await this.http.patch(`${API_BOOKS}/${bookId}/metadata`, metadata)
    } catch (e) {
      let msg = 'An error occurred while trying to update book metadata'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async updateReadProgress(bookId: string, readProgress: ReadProgressUpdateDto) {
    try {
      await this.http.patch(`${API_BOOKS}/${bookId}/read-progress`, readProgress)
    } catch (e) {
      let msg = 'An error occurred while trying to update read progress'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async deleteReadProgress(bookId: string) {
    try {
      await this.http.delete(`${API_BOOKS}/${bookId}/read-progress`)
    } catch (e) {
      let msg = 'An error occurred while trying to delete read progress'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async importBooks(batch: BookImportBatchDto) {
    try {
      await this.http.post(`${API_BOOKS}/import`, batch)
    } catch (e) {
      let msg = 'An error occurred while trying to submit book import batch'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }
}
