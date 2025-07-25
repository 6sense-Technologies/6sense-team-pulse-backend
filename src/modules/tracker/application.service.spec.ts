import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationService } from './application.service';
import { getModelToken } from '@nestjs/mongoose';
import { Application } from './entities/application.schema';
import { Model } from 'mongoose';

describe('ApplicationService', () => {
  let service: ApplicationService;
  let model: Model<Application>;

  const mockApp = {
    _id: '123456',
    name: 'Test App',
    icon: 'test-icon.png',
  };

  const mockAppModel = {
    findOneAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        {
          provide: getModelToken(Application.name),
          useValue: mockAppModel,
        },
      ],
    }).compile();

    service = module.get<ApplicationService>(ApplicationService);
    model = module.get<Model<Application>>(getModelToken(Application.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrCreate', () => {
    it('should return existing or newly created application', async () => {
      mockAppModel.findOneAndUpdate.mockResolvedValue(mockApp);

      const result = await service.findOrCreate('Test App', 'test-icon.png');

      expect(mockAppModel.findOneAndUpdate).toHaveBeenCalledWith(
        { name: 'Test App' },
        {
          $setOnInsert: {
            name: 'Test App',
            icon: 'test-icon.png',
          },
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
      expect(result).toEqual(mockApp);
    });

    it('should throw an error if model returns null', async () => {
      mockAppModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.findOrCreate('Broken App')).rejects.toThrow(
        'Failed to create or retrieve application: Broken App',
      );
    });

    it('should handle and log internal errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Database error');

      mockAppModel.findOneAndUpdate.mockRejectedValue(error);

      await expect(service.findOrCreate('Error App')).rejects.toThrow(
        `ApplicationService.findOrCreate failed: ${error.message}`,
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
