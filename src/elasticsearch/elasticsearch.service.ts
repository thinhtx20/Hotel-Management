import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

export interface RoomSearchDocument {
  id: string;
  roomNumber: string;
  floor: number;
  status: string;
  roomTypeId: string;
  roomTypeName: string;
  code: string;
  description: string;
  basePrice: number;
  capacityAdults: number;
  capacityChildren: number;
  amenities: string[];
}

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client | null = null;
  private isConnected = false;
  private readonly INDEX_NAME = 'hotel_rooms';

  async onModuleInit() {
    const node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';

    try {
      this.client = new Client({
        node,
        maxRetries: 2,
        requestTimeout: 3000,
      });

      const pingOk = await this.client.ping();
      if (pingOk) {
        this.isConnected = true;
        this.logger.log(`✅ Kết nối Elasticsearch thành công tại ${node}`);
        await this.initIndex();
      }
    } catch (err: any) {
      this.isConnected = false;
      this.logger.warn(`⚠️ Cảnh báo Elasticsearch (${err.message}). Vui lòng chạy 'docker compose up -d elasticsearch'.`);
    }
  }

  get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  private async initIndex() {
    if (!this.client) return;
    try {
      const exists = await this.client.indices.exists({ index: this.INDEX_NAME });
      if (!exists) {
        await this.client.indices.create({
          index: this.INDEX_NAME,
          mappings: {
            properties: {
              id: { type: 'keyword' },
              roomNumber: { type: 'keyword' },
              floor: { type: 'integer' },
              status: { type: 'keyword' },
              roomTypeId: { type: 'keyword' },
              roomTypeName: { type: 'text' },
              code: { type: 'keyword' },
              description: { type: 'text' },
              basePrice: { type: 'double' },
              capacityAdults: { type: 'integer' },
              capacityChildren: { type: 'integer' },
              amenities: { type: 'keyword' },
            },
          },
        } as any);
        this.logger.log(`Index '${this.INDEX_NAME}' đã được khởi tạo trên Elasticsearch`);
      }
    } catch (e: any) {
      this.logger.warn(`Không thể khởi tạo index ${this.INDEX_NAME}: ${e.message}`);
    }
  }

  /**
   * Đồng bộ một phòng vào Elasticsearch index
   */
  async indexRoom(roomDoc: RoomSearchDocument) {
    if (!this.isReady || !this.client) return;
    try {
      await this.client.index({
        index: this.INDEX_NAME,
        id: roomDoc.id,
        document: roomDoc,
      });
    } catch (err: any) {
      this.logger.warn(`Lỗi khi index phòng ${roomDoc.id} lên Elasticsearch: ${err.message}`);
    }
  }

  /**
   * Xóa phòng khỏi Elasticsearch index
   */
  async removeRoom(roomId: string) {
    if (!this.isReady || !this.client) return;
    try {
      await this.client.delete({
        index: this.INDEX_NAME,
        id: roomId,
      });
    } catch (err: any) {
      this.logger.warn(`Lỗi khi xóa phòng ${roomId} khỏi Elasticsearch: ${err.message}`);
    }
  }

  /**
   * Tìm kiếm Full-Text siêu tốc với Fuzzy Matching và Filters
   */
  async searchRooms(
    query?: string,
    minPrice?: number,
    maxPrice?: number,
    amenities?: string[],
  ): Promise<RoomSearchDocument[]> {
    if (!this.isReady || !this.client) {
      return [];
    }

    try {
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      // Full-text & Fuzzy search trên tên loại phòng, mô tả và tiện ích
      if (query && query.trim().length > 0) {
        mustClauses.push({
          multi_match: {
            query: query.trim(),
            fields: ['roomTypeName^3', 'description^2', 'amenities'],
            fuzziness: 'AUTO',
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      // Filter theo khoảng giá
      if (minPrice !== undefined || maxPrice !== undefined) {
        const range: any = {};
        if (minPrice !== undefined) range.gte = minPrice;
        if (maxPrice !== undefined) range.lte = maxPrice;
        filterClauses.push({ range: { basePrice: range } });
      }

      // Filter theo danh sách tiện ích
      if (amenities && amenities.length > 0) {
        amenities.forEach((amenity) => {
          filterClauses.push({ term: { amenities: amenity } });
        });
      }

      const response = await this.client.search<RoomSearchDocument>({
        index: this.INDEX_NAME,
        query: {
          bool: {
            must: mustClauses,
            filter: filterClauses,
          },
        },
      } as any);

      return (response.hits.hits || []).map((hit: any) => hit._source as RoomSearchDocument);
    } catch (err: any) {
      this.logger.warn(`Lỗi tìm kiếm Elasticsearch: ${err.message}`);
      return [];
    }
  }
}
