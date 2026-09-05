export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

/**
 * Xây dựng kết quả phân trang chuẩn hóa { data, meta }
 */
export function buildPaginatedResult<T>(
  items: T[],
  total: number,
  page?: number,
  limit?: number,
): PaginatedResult<T> {
  const isPaginated = page !== undefined || limit !== undefined;
  const activePage = Math.max(1, page ?? 1);
  const activeLimit = limit !== undefined ? Math.min(100, Math.max(1, limit)) : total;

  return {
    data: items,
    meta: {
      total,
      page: isPaginated ? activePage : 1,
      limit: isPaginated ? activeLimit : total,
      totalPages: isPaginated && activeLimit > 0 ? Math.max(1, Math.ceil(total / activeLimit)) : 1,
    },
  };
}

/**
 * Tính toán tham số skip/take cho truy vấn Prisma
 */
export function calculatePagination(query: { page?: number; limit?: number }) {
  const isPaginated = query.page !== undefined || query.limit !== undefined;
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));

  return {
    isPaginated,
    page,
    limit,
    skip: isPaginated ? (page - 1) * limit : undefined,
    take: isPaginated ? limit : undefined,
  };
}
