import { Test, TestingModule } from '@nestjs/testing';
import { TrackerService } from './tracker.service';
import { getModelToken } from '@nestjs/mongoose';
import { Activity } from './entities/activity.schema';
import { Model } from 'mongoose';
import { CreateActivitiesDto } from './dto/create-activities.dto';

describe('TrackerService', () => {
  let service: TrackerService;
  let activityModel: Model<Activity>;

  const mockActivityModel = {
    insertMany: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackerService,
        {
          provide: getModelToken(Activity.name),
          useValue: mockActivityModel,
        },
      ],
    }).compile();

    service = module.get<TrackerService>(TrackerService);
    activityModel = module.get<Model<Activity>>(getModelToken(Activity.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create activities correctly', async () => {
    const userId = '67d8f6712d117be5fbc23a18';

    const inputDto: CreateActivitiesDto = {
      organizationUserId: userId,
      activities: [
        {
          name: 'Chrome - StackOverflow',
          applicationName: 'Google Chrome',
          startTime: '2025-04-29T09:00:00Z',
          endTime: '2025-04-29T09:20:00Z',
        },
        {
          name: 'VSCode - index.ts',
          applicationName: 'Visual Studio Code',
          startTime: '2025-04-29T09:21:00Z',
          endTime: '2025-04-29T10:00:00Z',
        },
      ],
    };

    const expectedOutput = inputDto.activities.map((a, index) => ({
      ...a,
      organizationUserRole: userId,
      _id: `fake_id_${index}`,
      __v: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    mockActivityModel.insertMany.mockResolvedValue(expectedOutput);

    const result = await service.createActivity(inputDto, userId);
    expect(mockActivityModel.insertMany).toHaveBeenCalledWith(
      inputDto.activities.map((a) => ({
        ...a,
        organizationUserRole: userId,
      })),
    );
    expect(result).toEqual(expectedOutput);
  });

  it('should throw an error if insertMany fails', async () => {
    const userId = '67d8f6712d117be5fbc23a18';

    const inputDto: CreateActivitiesDto = {
      organizationUserId: userId,
      activities: [
        {
          name: 'Chrome - StackOverflow',
          applicationName: 'Google Chrome',
          startTime: '2025-04-29T09:00:00Z',
          endTime: '2025-04-29T09:20:00Z',
        },
      ],
    };

    mockActivityModel.insertMany.mockRejectedValue(new Error());

    await expect(service.createActivity(inputDto, userId)).rejects.toThrow();

    expect(mockActivityModel.insertMany).toHaveBeenCalledWith([
      {
        name: 'Chrome - StackOverflow',
        startTime: '2025-04-29T09:00:00Z',
        endTime: '2025-04-29T09:20:00Z',
        organizationUserRole: userId,
      },
    ]);
  });
});
