import { Test, TestingModule } from '@nestjs/testing';
import { KapalService } from './kapal.service';
import { RedisService } from 'src/common/redis/redis.service';
import { UtilsService } from 'src/utils/utils.service';
import { LogtrailService } from 'src/common/logtrail/logtrail.service';
import { NotFoundException } from '@nestjs/common';

// Mock the db module
jest.mock('src/common/utils/db', () => ({
  dbMssql: jest.fn(),
}));

describe('KapalService', () => {
  let service: KapalService;
  let redisService: jest.Mocked<RedisService>;
  let utilsService: jest.Mocked<UtilsService>;
  let logTrailService: jest.Mocked<LogtrailService>;
  let mockTrx: any;

  const mockRedisService = {
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
  };

  const mockUtilsService = {
    getTime: jest.fn().mockReturnValue('2025-11-21 12:00:00'),
    hasChanges: jest.fn(),
    lockAndDestroy: jest.fn(),
  };

  const mockLogTrailService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create mock transaction object
    mockTrx = jest.fn((tableName: string) => ({
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      andWhereRaw: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(),
      returning: jest.fn(),
    }));

    // Create mock transaction object
    mockTrx.raw = jest.fn((query: string) => query);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KapalService,
        {
          provide: 'REDIS_CLIENT',
          useValue: mockRedisService,
        },
        {
          provide: UtilsService,
          useValue: mockUtilsService,
        },
        {
          provide: LogtrailService,
          useValue: mockLogTrailService,
        },
      ],
    }).compile();

    service = module.get<KapalService>(KapalService);
    redisService = module.get('REDIS_CLIENT');
    utilsService = module.get(UtilsService);
    logTrailService = module.get(LogtrailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new kapal successfully', async () => {
      const createDto = {
        nama: 'kapal test',
        keterangan: 'keterangan test',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortDirection: 'asc',
      };

      const mockInsertedItem = {
        id: 1,
        nama: 'KAPAL TEST',
        keterangan: 'KETERANGAN TEST',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
        created_at: '2025-11-21 12:00:00',
        updated_at: '2025-11-21 12:00:00',
      };

      const mockFindAllData = [mockInsertedItem];

      // Setup mock chain
      const mockChain = mockTrx('kapal');
      mockChain.insert.mockReturnValue(mockChain);
      mockChain.returning.mockResolvedValue([mockInsertedItem]);

      // Mock findAll method
      jest.spyOn(service, 'findAll').mockResolvedValue({
        data: mockFindAllData,
        type: 'local',
        total: 1,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
        },
      });

      const result = await service.create(createDto, mockTrx);

      expect(result).toHaveProperty('newItem');
      expect(result).toHaveProperty('pageNumber');
      expect(result).toHaveProperty('itemIndex');
      expect(result.newItem.id).toBe(1);
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockLogTrailService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          namatabel: 'kapal',
          postingdari: 'ADD KAPAL',
          aksi: 'ADD',
        }),
        mockTrx,
      );
    });

    it('should throw error when create fails', async () => {
      const createDto = {
        nama: 'kapal test',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
      };

      const mockChain = mockTrx('kapal');
      mockChain.insert.mockReturnValue(mockChain);
      mockChain.returning.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto, mockTrx)).rejects.toThrow(
        'Error creating kapal: Database error',
      );
    });
  });

  describe('findAll', () => {
    it('should return all kapal with pagination', async () => {
      const params = {
        search: '',
        filters: {},
        pagination: { page: 1, limit: 10 },
        sort: { sortBy: 'id', sortDirection: 'asc' as const },
        isLookUp: false,
      };

      const mockData = [
        {
          id: 1,
          nama: 'KAPAL TEST',
          keterangan: 'KETERANGAN TEST',
          statusaktif: 1,
          pelayaran_id: 1,
          pelayaran: 'PELAYARAN TEST',
          modifiedby: 'testuser',
          created_at: '21-11-2025 12:00:00',
          updated_at: '21-11-2025 12:00:00',
          memo: 'AKTIF',
          text: 'Aktif',
        },
      ];

      mockTrx().select().leftJoin().leftJoin.mockResolvedValue(mockData);
      mockTrx().count().first.mockResolvedValue({ total: 1 });

      const result = await service.findAll(params, mockTrx);

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(mockData);
      expect(result?.pagination?.totalItems).toBe(1);
    });

    it('should filter kapal by search query', async () => {
      const params = {
        search: 'test',
        filters: {},
        pagination: { page: 1, limit: 10 },
        sort: { sortBy: 'id', sortDirection: 'asc' as const },
        isLookUp: false,
      };

      const mockData = [
        {
          id: 1,
          nama: 'KAPAL TEST',
          keterangan: 'KETERANGAN TEST',
          statusaktif: 1,
          pelayaran_id: 1,
          pelayaran: 'PELAYARAN TEST',
          modifiedby: 'testuser',
        },
      ];

      mockTrx().select().leftJoin().leftJoin.mockResolvedValue(mockData);
      mockTrx().count().first.mockResolvedValue({ total: 1 });

      const result = await service.findAll(params, mockTrx);

      expect(result.data).toEqual(mockData);
    });

    it('should return json type for lookup with > 500 records', async () => {
      const params = {
        search: '',
        filters: {},
        pagination: { page: 1, limit: 10 },
        sort: { sortBy: 'id', sortDirection: 'asc' as const },
        isLookUp: true,
      };

      mockTrx().count().first.mockResolvedValue({ total: 501 });

      const result = await service.findAll(params, mockTrx);

      expect(result.data).toEqual({ type: 'json' });
    });

    it('should throw error when query fails', async () => {
      const params = {
        search: '',
        filters: {},
        pagination: { page: 1, limit: 10 },
        sort: { sortBy: 'id', sortDirection: 'asc' as const },
        isLookUp: false,
      };

      mockTrx().count().first.mockRejectedValue(new Error('Database error'));

      await expect(service.findAll(params, mockTrx)).rejects.toThrow(
        'Failed to fetch data',
      );
    });
  });

  describe('getById', () => {
    it('should return kapal by id', async () => {
      const mockKapal = {
        id: 1,
        nama: 'KAPAL TEST',
        keterangan: 'KETERANGAN TEST',
        statusaktif: 1,
        pelayaran_id: 1,
      };

      mockTrx().where().first.mockResolvedValue(mockKapal);

      const result = await service.getById(1, mockTrx);

      expect(result).toEqual(mockKapal);
      expect(mockTrx).toHaveBeenCalledWith('kapal');
    });

    it('should throw error when kapal not found', async () => {
      mockTrx().where().first.mockResolvedValue(null);

      await expect(service.getById(999, mockTrx)).rejects.toThrow(
        'Failed to fetch data by id',
      );
    });
  });

  describe('update', () => {
    it('should update kapal successfully', async () => {
      const existingData = {
        id: 1,
        nama: 'KAPAL TEST',
        keterangan: 'OLD KETERANGAN',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
      };

      const updateData = {
        id: 1,
        nama: 'kapal updated',
        keterangan: 'new keterangan',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
        page: 1,
        limit: 10,
        sortBy: 'id',
        sortDirection: 'asc',
      };

      const mockFindAllData = [
        {
          id: 1,
          nama: 'KAPAL UPDATED',
          keterangan: 'NEW KETERANGAN',
          statusaktif: 1,
          pelayaran_id: 1,
        },
      ];

      mockTrx().where().first.mockResolvedValue(existingData);
      mockTrx().where().update.mockResolvedValue(1);
      mockUtilsService.hasChanges.mockReturnValue(true);

      jest.spyOn(service, 'findAll').mockResolvedValue({
        data: mockFindAllData,
        type: 'local',
        total: 1,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
        },
      });

      const result = await service.update(1, updateData, mockTrx);

      expect(result).toHaveProperty('updatedItem');
      expect(result).toHaveProperty('pageNumber');
      expect(result).toHaveProperty('itemIndex');
      expect(mockUtilsService.hasChanges).toHaveBeenCalled();
      expect(mockRedisService.set).toHaveBeenCalled();
      expect(mockLogTrailService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          namatabel: 'kapal',
          postingdari: 'EDIT KAPAL',
          aksi: 'EDIT',
        }),
        mockTrx,
      );
    });

    it('should throw error when kapal not found for update', async () => {
      mockTrx().where().first.mockResolvedValue(null);

      const updateData = {
        nama: 'kapal updated',
        modifiedby: 'testuser',
      };

      await expect(service.update(999, updateData, mockTrx)).rejects.toThrow(
        'Failed to update kapal',
      );
    });

    it('should not update when no changes detected', async () => {
      const existingData = {
        id: 1,
        nama: 'KAPAL TEST',
        keterangan: 'KETERANGAN TEST',
        statusaktif: 1,
        pelayaran_id: 1,
      };

      const updateData = {
        nama: 'KAPAL TEST',
        keterangan: 'KETERANGAN TEST',
        statusaktif: 1,
        pelayaran_id: 1,
        modifiedby: 'testuser',
        page: 1,
        limit: 10,
      };

      const mockFindAllData = [existingData];

      mockTrx().where().first.mockResolvedValue(existingData);
      mockUtilsService.hasChanges.mockReturnValue(false);

      jest.spyOn(service, 'findAll').mockResolvedValue({
        data: mockFindAllData,
        type: 'local',
        total: 1,
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
        },
      });

      const result = await service.update(1, updateData, mockTrx);

      expect(mockTrx().where().update).not.toHaveBeenCalled();
      expect(result).toHaveProperty('updatedItem');
    });
  });

  describe('delete', () => {
    it('should delete kapal successfully', async () => {
      const mockDeletedData = {
        id: 1,
        nama: 'KAPAL TEST',
        keterangan: 'KETERANGAN TEST',
        statusaktif: 1,
        pelayaran_id: 1,
      };

      mockUtilsService.lockAndDestroy.mockResolvedValue(mockDeletedData);

      const result = await service.delete(1, mockTrx, 'testuser');

      expect(result.status).toBe(200);
      expect(result.message).toBe('Data deleted successfully');
      expect(result.deletedData).toEqual(mockDeletedData);
      expect(mockUtilsService.lockAndDestroy).toHaveBeenCalledWith(
        1,
        'kapal',
        'id',
        mockTrx,
      );
      expect(mockLogTrailService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          namatabel: 'kapal',
          postingdari: 'DELETE KAPAL',
          aksi: 'DELETE',
        }),
        mockTrx,
      );
    });

    it('should throw NotFoundException when kapal not found', async () => {
      mockUtilsService.lockAndDestroy.mockRejectedValue(
        new NotFoundException('Data not found'),
      );

      await expect(service.delete(999, mockTrx, 'testuser')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw InternalServerErrorException on database error', async () => {
      mockUtilsService.lockAndDestroy.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.delete(1, mockTrx, 'testuser')).rejects.toThrow(
        'Failed to delete data',
      );
    });
  });

  describe('exportToExcel', () => {
    it('should export data to excel file', async () => {
      const mockData = [
        {
          id: 1,
          nama: 'KAPAL TEST',
          keterangan: 'KETERANGAN TEST',
          pelayaran: 'PELAYARAN TEST',
          text: 'Aktif',
          modifiedby: 'testuser',
          created_at: '21-11-2025 12:00:00',
          updated_at: '21-11-2025 12:00:00',
        },
      ];

      const result = await service.exportToExcel(mockData);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('laporan_kapal');
      expect(result).toContain('.xlsx');
    });

    it('should handle empty data array', async () => {
      const result = await service.exportToExcel([]);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });
});
