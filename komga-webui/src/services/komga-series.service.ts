import {AxiosInstance} from 'axios'
import {AuthorDto, BookDto} from '@/types/komga-books'
import {GroupCountDto, SeriesDto, SeriesMetadataUpdateDto} from '@/types/komga-series'

const qs = require('qs')

const API_SERIES = '/api/v1/series'

export default class KomgaSeriesService {
  private http: AxiosInstance

  constructor(http: AxiosInstance) {
    this.http = http
  }

  async getSeries(libraryId?: string, pageRequest?: PageRequest, search?: string, status?: string[],
                  readStatus?: string[], genre?: string[], tag?: string[], language?: string[],
                  publisher?: string[], ageRating?: string[], releaseDate?: string[], authors?: AuthorDto[],
                  searchRegex?: string): Promise<Page<SeriesDto>> {
    try {
      const params = {...pageRequest} as any
      if (libraryId) params.library_id = libraryId
      if (search) params.search = search
      if (searchRegex) params.search_regex = searchRegex
      if (status) params.status = status
      if (readStatus) params.read_status = readStatus
      if (genre) params.genre = genre
      if (tag) params.tag = tag
      if (language) params.language = language
      if (publisher) params.publisher = publisher
      if (ageRating) params.age_rating = ageRating
      if (releaseDate) params.release_year = releaseDate
      if (authors) params.author = authors.map(a => `${a.name},${a.role}`)

      return (await this.http.get(API_SERIES, {
        params: params,
        paramsSerializer: params => qs.stringify(params, {indices: false}),
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve series'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getAlphabeticalGroups(libraryId?: string, search?: string, status?: string[],
                              readStatus?: string[], genre?: string[], tag?: string[], language?: string[],
                              publisher?: string[], ageRating?: string[], releaseDate?: string[], authors?: AuthorDto[]): Promise<GroupCountDto[]> {
    try {
      const params = {} as any
      if (libraryId) params.library_id = libraryId
      if (search) params.search = search
      if (status) params.status = status
      if (readStatus) params.read_status = readStatus
      if (genre) params.genre = genre
      if (tag) params.tag = tag
      if (language) params.language = language
      if (publisher) params.publisher = publisher
      if (ageRating) params.age_rating = ageRating
      if (releaseDate) params.release_year = releaseDate
      if (authors) params.author = authors.map(a => `${a.name},${a.role}`)

      return (await this.http.get(`${API_SERIES}/alphabetical-groups`, {
        params: params,
        paramsSerializer: params => qs.stringify(params, {indices: false}),
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve series alphabetical groups'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getNewSeries(libraryId?: string, pageRequest?: PageRequest): Promise<Page<SeriesDto>> {
    try {
      const params = {...pageRequest} as any
      if (libraryId) {
        params.library_id = libraryId
      }
      return (await this.http.get(`${API_SERIES}/new`, {
        params: params,
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve new series'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getUpdatedSeries(libraryId?: string, pageRequest?: PageRequest): Promise<Page<SeriesDto>> {
    try {
      const params = {...pageRequest} as any
      if (libraryId) {
        params.library_id = libraryId
      }
      return (await this.http.get(`${API_SERIES}/updated`, {
        params: params,
      })).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve updated series'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getOneSeries(seriesId: string): Promise<SeriesDto> {
    try {
      return (await this.http.get(`${API_SERIES}/${seriesId}`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve series'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async getBooks(seriesId: string, pageRequest?: PageRequest, readStatus?: string[], tag?: string[], authors?: AuthorDto[]): Promise<Page<BookDto>> {
    try {
      const params = {...pageRequest} as any
      if (readStatus) params.read_status = readStatus
      if (tag) params.tag = tag
      if (authors) params.author = authors.map(a => `${a.name},${a.role}`)

      return (await this.http.get(`${API_SERIES}/${seriesId}/books`, {
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

  async getCollections(seriesId: string): Promise<CollectionDto[]> {
    try {
      return (await this.http.get(`${API_SERIES}/${seriesId}/collections`)).data
    } catch (e) {
      let msg = 'An error occurred while trying to retrieve collections'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async analyzeSeries(series: SeriesDto) {
    try {
      await this.http.post(`${API_SERIES}/${series.id}/analyze`)
    } catch (e) {
      let msg = `An error occurred while trying to analyze series '${series.name}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async refreshMetadata(series: SeriesDto) {
    try {
      await this.http.post(`${API_SERIES}/${series.id}/metadata/refresh`)
    } catch (e) {
      let msg = `An error occurred while trying to refresh metadata for series '${series.name}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async updateMetadata(seriesId: string, metadata: SeriesMetadataUpdateDto) {
    try {
      await this.http.patch(`${API_SERIES}/${seriesId}/metadata`, metadata)
    } catch (e) {
      let msg = 'An error occurred while trying to update series metadata'
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async markAsRead(seriesId: string) {
    try {
      await this.http.post(`${API_SERIES}/${seriesId}/read-progress`)
    } catch (e) {
      let msg = `An error occurred while trying to mark as read for series '${seriesId}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }

  async markAsUnread(seriesId: string) {
    try {
      await this.http.delete(`${API_SERIES}/${seriesId}/read-progress`)
    } catch (e) {
      let msg = `An error occurred while trying to mark as unread for series '${seriesId}'`
      if (e.response.data.message) {
        msg += `: ${e.response.data.message}`
      }
      throw new Error(msg)
    }
  }
}
