"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var ElasticsearchService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchService = void 0;
const common_1 = require("@nestjs/common");
const elasticsearch_1 = require("@elastic/elasticsearch");
let ElasticsearchService = ElasticsearchService_1 = class ElasticsearchService {
    constructor() {
        this.logger = new common_1.Logger(ElasticsearchService_1.name);
        this.client = null;
        this.isConnected = false;
        this.INDEX_NAME = 'hotel_rooms';
    }
    async onModuleInit() {
        const node = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
        try {
            this.client = new elasticsearch_1.Client({
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
        }
        catch (err) {
            this.isConnected = false;
            this.logger.warn(`⚠️ Cảnh báo Elasticsearch (${err.message}). Vui lòng chạy 'docker compose up -d elasticsearch'.`);
        }
    }
    get isReady() {
        return this.isConnected && this.client !== null;
    }
    async initIndex() {
        if (!this.client)
            return;
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
                });
                this.logger.log(`Index '${this.INDEX_NAME}' đã được khởi tạo trên Elasticsearch`);
            }
        }
        catch (e) {
            this.logger.warn(`Không thể khởi tạo index ${this.INDEX_NAME}: ${e.message}`);
        }
    }
    async indexRoom(roomDoc) {
        if (!this.isReady || !this.client)
            return;
        try {
            await this.client.index({
                index: this.INDEX_NAME,
                id: roomDoc.id,
                document: roomDoc,
            });
        }
        catch (err) {
            this.logger.warn(`Lỗi khi index phòng ${roomDoc.id} lên Elasticsearch: ${err.message}`);
        }
    }
    async removeRoom(roomId) {
        if (!this.isReady || !this.client)
            return;
        try {
            await this.client.delete({
                index: this.INDEX_NAME,
                id: roomId,
            });
        }
        catch (err) {
            this.logger.warn(`Lỗi khi xóa phòng ${roomId} khỏi Elasticsearch: ${err.message}`);
        }
    }
    async searchRooms(query, minPrice, maxPrice, amenities) {
        if (!this.isReady || !this.client) {
            return [];
        }
        try {
            const mustClauses = [];
            const filterClauses = [];
            if (query && query.trim().length > 0) {
                mustClauses.push({
                    multi_match: {
                        query: query.trim(),
                        fields: ['roomTypeName^3', 'description^2', 'amenities'],
                        fuzziness: 'AUTO',
                    },
                });
            }
            else {
                mustClauses.push({ match_all: {} });
            }
            if (minPrice !== undefined || maxPrice !== undefined) {
                const range = {};
                if (minPrice !== undefined)
                    range.gte = minPrice;
                if (maxPrice !== undefined)
                    range.lte = maxPrice;
                filterClauses.push({ range: { basePrice: range } });
            }
            if (amenities && amenities.length > 0) {
                amenities.forEach((amenity) => {
                    filterClauses.push({ term: { amenities: amenity } });
                });
            }
            const response = await this.client.search({
                index: this.INDEX_NAME,
                query: {
                    bool: {
                        must: mustClauses,
                        filter: filterClauses,
                    },
                },
            });
            return (response.hits.hits || []).map((hit) => hit._source);
        }
        catch (err) {
            this.logger.warn(`Lỗi tìm kiếm Elasticsearch: ${err.message}`);
            return [];
        }
    }
};
exports.ElasticsearchService = ElasticsearchService;
exports.ElasticsearchService = ElasticsearchService = ElasticsearchService_1 = __decorate([
    (0, common_1.Injectable)()
], ElasticsearchService);
//# sourceMappingURL=elasticsearch.service.js.map